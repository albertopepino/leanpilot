"use client";
import { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/stores/useI18n";
import { useAuth } from "@/hooks/useAuth";
import { manufacturingApi, adminApi } from "@/lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────

interface OrderLine {
  id: number;
  production_line_id: number;
  planned_quantity: number;
  actual_quantity_good: number;
  actual_quantity_scrap: number;
  status: string;
  line_name?: string;
}

interface ProductionOrder {
  id: number;
  order_number: string;
  product_id: number;
  production_line_id: number;
  status: string;
  planned_quantity: number;
  actual_quantity_good: number;
  actual_quantity_scrap: number;
  planned_start: string | null;
  planned_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  customer_ref: string | null;
  qc_hold: boolean;
  qc_hold_reason: string | null;
  notes: string | null;
  created_at: string;
  product_name?: string;
  line_name?: string;
  order_lines?: OrderLine[];
}

interface Product {
  id: number;
  code: string;
  name: string;
}

interface Line {
  id: number;
  name: string;
}

type StatusColumn = "planned" | "released" | "in_progress" | "on_hold" | "completed";

type PermLevel = "full" | "modify" | "view" | "hidden";

// ─── Component ───────────────────────────────────────────────────────────────

export default function ProductionOrderBoard() {
  const { t } = useI18n();
  const { user } = useAuth();

  const STATUS_COLUMNS: { key: StatusColumn; label: string; color: string; bg: string }[] = [
    { key: "planned", label: t("manufacturing.statusPlanned"), color: "text-gray-700", bg: "bg-gray-50 dark:bg-gray-900/30" },
    { key: "released", label: t("manufacturing.statusReleased"), color: "text-blue-700", bg: "bg-blue-50 dark:bg-blue-900/20" },
    { key: "in_progress", label: t("manufacturing.statusInProgress"), color: "text-green-700", bg: "bg-green-50 dark:bg-green-900/20" },
    { key: "on_hold", label: t("manufacturing.statusOnHold"), color: "text-red-700", bg: "bg-red-50 dark:bg-red-900/20" },
    { key: "completed", label: t("manufacturing.statusCompleted"), color: "text-purple-700", bg: "bg-purple-50 dark:bg-purple-900/20" },
  ];

  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // ─── Detail / Edit modal state ───
  const [selectedOrder, setSelectedOrder] = useState<ProductionOrder | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    planned_quantity: 0,
    customer_ref: "",
    notes: "",
    planned_start: "",
    planned_end: "",
  });
  const [saveLoading, setSaveLoading] = useState(false);
  const [permLevel, setPermLevel] = useState<PermLevel>("view");

  // Create form
  const [newOrder, setNewOrder] = useState({
    product_id: 0,
    production_line_id: 0,
    planned_quantity: 0,
    customer_ref: "",
    notes: "",
    additional_lines: [] as { production_line_id: number; planned_quantity: number }[],
  });

  const fetchData = useCallback(async () => {
    try {
      const [ordersRes, productsRes, factoryRes] = await Promise.all([
        manufacturingApi.listOrders(),
        manufacturingApi.listProducts(),
        adminApi.getFactory(),
      ]);
      const ordersData = ordersRes.data ?? ordersRes;
      const productsData = productsRes.data ?? productsRes;
      const factory = factoryRes.data ?? factoryRes;

      // Enrich orders with product and line names
      const productMap = new Map<number, string>(productsData.map((p: Product) => [p.id, p.name]));
      const lineMap = new Map<number, string>((factory.production_lines || []).map((l: Line) => [l.id, l.name]));

      const enriched = (Array.isArray(ordersData) ? ordersData : []).map((o: ProductionOrder) => ({
        ...o,
        product_name: productMap.get(o.product_id) || `Product #${o.product_id}`,
        line_name: lineMap.get(o.production_line_id) || `Line #${o.production_line_id}`,
      }));

      setOrders(enriched);
      setProducts(productsData);
      setLines(factory.production_lines || []);
      setError(null);
    } catch {
      setError(t("manufacturing.failedLoadOrders"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Load user's permission level for production-orders tab ───
  useEffect(() => {
    adminApi.getMyPermissions()
      .then((res) => {
        const perms = res.data.permissions || {};
        const p = perms["production-orders"] as PermLevel | undefined;
        if (p) setPermLevel(p);
        else {
          // Fallback: admin/plant_manager get full, line_supervisor gets modify, rest get view
          const role = user?.role || "viewer";
          if (role === "admin" || role === "plant_manager") setPermLevel("full");
          else if (role === "line_supervisor") setPermLevel("modify");
          else setPermLevel("view");
        }
      })
      .catch(() => {
        // Fallback based on role
        const role = user?.role || "viewer";
        if (role === "admin" || role === "plant_manager") setPermLevel("full");
        else if (role === "line_supervisor") setPermLevel("modify");
        else setPermLevel("view");
      });
  }, [user?.role]);

  const canEdit = permLevel === "full" || permLevel === "modify";

  // ─── Open order detail ───
  const openDetail = (order: ProductionOrder) => {
    setSelectedOrder(order);
    setEditForm({
      planned_quantity: order.planned_quantity,
      customer_ref: order.customer_ref || "",
      notes: order.notes || "",
      planned_start: order.planned_start ? order.planned_start.slice(0, 16) : "",
      planned_end: order.planned_end ? order.planned_end.slice(0, 16) : "",
    });
    setIsEditing(false);
  };

  const closeDetail = () => {
    setSelectedOrder(null);
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    if (!selectedOrder) return;
    setSaveLoading(true);
    try {
      await manufacturingApi.updateOrder(selectedOrder.id, {
        planned_quantity: editForm.planned_quantity,
        customer_ref: editForm.customer_ref || null,
        notes: editForm.notes || null,
        planned_start: editForm.planned_start || null,
        planned_end: editForm.planned_end || null,
      });
      setIsEditing(false);
      await fetchData();
      // Update selected order with new data
      const refreshed = (await manufacturingApi.getOrder(selectedOrder.id)).data;
      if (refreshed) {
        const productMap = new Map<number, string>(products.map((p) => [p.id, p.name]));
        const lineMap = new Map<number, string>(lines.map((l) => [l.id, l.name]));
        setSelectedOrder({
          ...refreshed,
          product_name: productMap.get(refreshed.product_id) || `Product #${refreshed.product_id}`,
          line_name: lineMap.get(refreshed.production_line_id) || `Line #${refreshed.production_line_id}`,
        });
      }
    } catch {
      setError(t("manufacturing.failedUpdateOrder"));
      setTimeout(() => setError(null), 5000);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newOrder.product_id || !newOrder.production_line_id || !newOrder.planned_quantity) return;
    try {
      // Build order_lines from additional lines
      const order_lines = newOrder.additional_lines
        .filter(al => al.production_line_id && al.planned_quantity > 0)
        .map(al => ({
          production_line_id: al.production_line_id,
          planned_quantity: al.planned_quantity,
        }));

      await manufacturingApi.createOrder({
        product_id: newOrder.product_id,
        production_line_id: newOrder.production_line_id,
        planned_quantity: newOrder.planned_quantity,
        customer_ref: newOrder.customer_ref || undefined,
        notes: newOrder.notes || undefined,
        order_lines: order_lines.length > 0 ? order_lines : undefined,
      });
      setShowCreate(false);
      setNewOrder({ product_id: 0, production_line_id: 0, planned_quantity: 0, customer_ref: "", notes: "", additional_lines: [] });
      await fetchData();
    } catch {
      setError(t("manufacturing.failedCreateOrder"));
    }
  };

  const handleAction = async (orderId: number, action: string) => {
    setActionLoading(orderId);
    try {
      switch (action) {
        case "release":
          await manufacturingApi.releaseOrder(orderId);
          break;
        case "start":
          await manufacturingApi.startOrder(orderId);
          break;
        case "close":
          await manufacturingApi.closeOrder(orderId);
          break;
        case "hold":
          await manufacturingApi.holdOrder(orderId, "Manual hold");
          break;
        case "release-hold":
          await manufacturingApi.releaseHold(orderId);
          break;
      }
      await fetchData();
    } catch (err: any) {
      const msg = err?.response?.data?.detail?.message || err?.response?.data?.detail || "Action failed";
      setError(typeof msg === "string" ? msg : JSON.stringify(msg));
      setTimeout(() => setError(null), 5000);
    } finally {
      setActionLoading(null);
    }
  };

  const getOrdersByStatus = (status: StatusColumn) =>
    orders.filter((o) => o.status === status);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4" id="production-orders-view">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-th-text-3">
          {t("manufacturing.ordersTotal", { count: orders.length })}
        </p>
        {canEdit && (
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            {t("manufacturing.newOrder")}
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl text-sm border border-red-200 dark:border-red-800">
          {error}
        </div>
      )}

      {/* Kanban Board */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 min-h-[400px]">
        {STATUS_COLUMNS.map((col) => {
          const colOrders = getOrdersByStatus(col.key);
          return (
            <div key={col.key} className={`rounded-xl border border-th-border ${col.bg} p-3`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className={`text-sm font-bold ${col.color}`}>{col.label}</h3>
                <span className="text-xs bg-white dark:bg-th-bg-2 px-2 py-0.5 rounded-full font-semibold text-th-text-2 border border-th-border">
                  {colOrders.length}
                </span>
              </div>

              <div className="space-y-2">
                {colOrders.map((order) => {
                  const progress = order.planned_quantity > 0
                    ? Math.round((order.actual_quantity_good / order.planned_quantity) * 100)
                    : 0;

                  return (
                    <div
                      key={order.id}
                      onClick={() => openDetail(order)}
                      className={`bg-white dark:bg-th-bg rounded-lg border p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer ${
                        order.qc_hold
                          ? "border-red-400 dark:border-red-600 ring-1 ring-red-200 dark:ring-red-800"
                          : "border-th-border"
                      }`}
                    >
                      {/* QC Hold Badge */}
                      {order.qc_hold && (
                        <div className="mb-2 px-2 py-1 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-xs font-bold rounded flex items-center gap-1">
                          <span>{t("manufacturing.qcHold")}</span>
                          {order.qc_hold_reason && (
                            <span className="font-normal truncate">- {order.qc_hold_reason}</span>
                          )}
                        </div>
                      )}

                      <div className="flex justify-between items-start mb-1">
                        <span className="text-xs font-mono font-bold text-brand-600 dark:text-brand-400">
                          {order.order_number}
                        </span>
                      </div>

                      <p className="text-sm font-semibold text-th-text truncate">{order.product_name}</p>
                      <p className="text-xs text-th-text-3">
                        {order.line_name}
                        {order.order_lines && order.order_lines.length > 0 && (
                          <span className="ml-1 text-brand-500">+{order.order_lines.length} lines</span>
                        )}
                      </p>

                      {/* Progress bar */}
                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-th-text-3 mb-0.5">
                          <span>{order.actual_quantity_good} / {order.planned_quantity}</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              progress >= 100 ? "bg-green-500" : progress > 50 ? "bg-blue-500" : "bg-amber-500"
                            }`}
                            style={{ width: `${Math.min(progress, 100)}%` }}
                          />
                        </div>
                      </div>

                      {order.customer_ref && (
                        <p className="text-xs text-th-text-3 mt-1 truncate">{t("manufacturing.ref")}: {order.customer_ref}</p>
                      )}

                      {/* Action buttons */}
                      {canEdit && <div className="mt-2 flex gap-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
                        {order.status === "planned" && (
                          <ActionBtn
                            label={t("manufacturing.actionRelease")}
                            color="blue"
                            loading={actionLoading === order.id}
                            onClick={() => handleAction(order.id, "release")}
                          />
                        )}
                        {order.status === "released" && (
                          <ActionBtn
                            label={t("manufacturing.actionStart")}
                            color="green"
                            loading={actionLoading === order.id}
                            onClick={() => handleAction(order.id, "start")}
                          />
                        )}
                        {order.status === "in_progress" && (
                          <>
                            <ActionBtn
                              label={t("manufacturing.actionHold")}
                              color="amber"
                              loading={actionLoading === order.id}
                              onClick={() => handleAction(order.id, "hold")}
                            />
                            <ActionBtn
                              label={t("manufacturing.actionClose")}
                              color="purple"
                              loading={actionLoading === order.id}
                              onClick={() => handleAction(order.id, "close")}
                            />
                          </>
                        )}
                        {order.status === "on_hold" && (
                          <ActionBtn
                            label={t("manufacturing.actionReleaseHold")}
                            color="green"
                            loading={actionLoading === order.id}
                            onClick={() => handleAction(order.id, "release-hold")}
                          />
                        )}
                      </div>}
                    </div>
                  );
                })}

                {colOrders.length === 0 && (
                  <p className="text-xs text-th-text-3 text-center py-8 italic">{t("manufacturing.noOrders")}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ═══ ORDER DETAIL / EDIT MODAL ═══ */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={closeDetail}>
          <div className="bg-th-bg rounded-2xl shadow-xl border border-th-border w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="p-5 border-b border-th-border flex items-center justify-between">
              <div>
                <h3 className="font-bold text-th-text text-lg">{selectedOrder.order_number}</h3>
                <p className="text-sm text-th-text-2">{selectedOrder.product_name}</p>
              </div>
              <div className="flex items-center gap-2">
                {canEdit && !isEditing && selectedOrder.status !== "completed" && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold transition-colors"
                  >
                    {t("manufacturing.edit")}
                  </button>
                )}
                <button onClick={closeDetail} className="text-th-text-3 hover:text-th-text p-1">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {/* Status + QC Hold */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  selectedOrder.status === "planned" ? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" :
                  selectedOrder.status === "released" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" :
                  selectedOrder.status === "in_progress" ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" :
                  selectedOrder.status === "on_hold" ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" :
                  "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
                }`}>
                  {t(`manufacturing.status${selectedOrder.status.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join("")}`)}
                </span>
                {selectedOrder.qc_hold && (
                  <span className="px-2 py-1 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-xs font-bold rounded">
                    {t("manufacturing.qcHold")} {selectedOrder.qc_hold_reason && `- ${selectedOrder.qc_hold_reason}`}
                  </span>
                )}
              </div>

              {/* Progress */}
              <div>
                <div className="flex justify-between text-sm text-th-text-2 mb-1">
                  <span>{t("manufacturing.progress")}</span>
                  <span className="font-semibold">{selectedOrder.actual_quantity_good} / {selectedOrder.planned_quantity} ({selectedOrder.planned_quantity > 0 ? Math.round((selectedOrder.actual_quantity_good / selectedOrder.planned_quantity) * 100) : 0}%)</span>
                </div>
                <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      selectedOrder.planned_quantity > 0 && (selectedOrder.actual_quantity_good / selectedOrder.planned_quantity) >= 1
                        ? "bg-green-500" : "bg-brand-500"
                    }`}
                    style={{ width: `${Math.min(selectedOrder.planned_quantity > 0 ? (selectedOrder.actual_quantity_good / selectedOrder.planned_quantity) * 100 : 0, 100)}%` }}
                  />
                </div>
                {selectedOrder.actual_quantity_scrap > 0 && (
                  <p className="text-xs text-red-500 mt-1">{t("manufacturing.scrap")}: {selectedOrder.actual_quantity_scrap}</p>
                )}
              </div>

              {/* Editable Fields */}
              {isEditing ? (
                <div className="space-y-3 bg-th-bg-2 rounded-xl p-4 border border-th-border">
                  <div>
                    <label className="block text-xs font-semibold text-th-text-2 mb-1">{t("manufacturing.plannedQuantity")}</label>
                    <input
                      type="number"
                      min={1}
                      value={editForm.planned_quantity || ""}
                      onChange={(e) => setEditForm({ ...editForm, planned_quantity: parseInt(e.target.value) || 0 })}
                      className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-th-text-2 mb-1">{t("manufacturing.customerRef")}</label>
                    <input
                      type="text"
                      value={editForm.customer_ref}
                      onChange={(e) => setEditForm({ ...editForm, customer_ref: e.target.value })}
                      className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-th-text-2 mb-1">{t("manufacturing.plannedStart")}</label>
                      <input
                        type="datetime-local"
                        value={editForm.planned_start}
                        onChange={(e) => setEditForm({ ...editForm, planned_start: e.target.value })}
                        className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-th-text-2 mb-1">{t("manufacturing.plannedEnd")}</label>
                      <input
                        type="datetime-local"
                        value={editForm.planned_end}
                        onChange={(e) => setEditForm({ ...editForm, planned_end: e.target.value })}
                        className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-th-text-2 mb-1">{t("manufacturing.notes")}</label>
                    <textarea
                      value={editForm.notes}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      rows={3}
                      className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text resize-none"
                    />
                  </div>
                </div>
              ) : (
                /* Read-only detail fields */
                <div className="space-y-3">
                  <DetailRow label={t("manufacturing.productionLine")} value={selectedOrder.line_name || "-"} />
                  <DetailRow label={t("manufacturing.plannedQuantity")} value={String(selectedOrder.planned_quantity)} />
                  <DetailRow label={t("manufacturing.customerRef")} value={selectedOrder.customer_ref || "-"} />
                  <DetailRow label={t("manufacturing.plannedStart")} value={selectedOrder.planned_start ? new Date(selectedOrder.planned_start).toLocaleString() : "-"} />
                  <DetailRow label={t("manufacturing.plannedEnd")} value={selectedOrder.planned_end ? new Date(selectedOrder.planned_end).toLocaleString() : "-"} />
                  {selectedOrder.actual_start && (
                    <DetailRow label={t("manufacturing.actualStart")} value={new Date(selectedOrder.actual_start).toLocaleString()} />
                  )}
                  {selectedOrder.actual_end && (
                    <DetailRow label={t("manufacturing.actualEnd")} value={new Date(selectedOrder.actual_end).toLocaleString()} />
                  )}
                  <DetailRow label={t("manufacturing.notes")} value={selectedOrder.notes || "-"} />
                  <DetailRow label={t("manufacturing.created")} value={new Date(selectedOrder.created_at).toLocaleString()} />
                </div>
              )}

              {/* Order Lines */}
              {selectedOrder.order_lines && selectedOrder.order_lines.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-th-text-2 mb-2 uppercase tracking-wide">{t("manufacturing.orderLines")}</h4>
                  <div className="space-y-1">
                    {selectedOrder.order_lines.map((ol) => (
                      <div key={ol.id} className="flex justify-between items-center bg-th-bg-2 rounded-lg px-3 py-2 text-sm border border-th-border">
                        <span className="text-th-text">{ol.line_name || `Line #${ol.production_line_id}`}</span>
                        <span className="text-th-text-2">{ol.actual_quantity_good}/{ol.planned_quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              {canEdit && !isEditing && selectedOrder.status !== "completed" && (
                <div className="flex gap-2 flex-wrap pt-2 border-t border-th-border">
                  {selectedOrder.status === "planned" && (
                    <ActionBtn label={t("manufacturing.actionRelease")} color="blue" loading={actionLoading === selectedOrder.id} onClick={() => { handleAction(selectedOrder.id, "release"); closeDetail(); }} />
                  )}
                  {selectedOrder.status === "released" && (
                    <ActionBtn label={t("manufacturing.actionStart")} color="green" loading={actionLoading === selectedOrder.id} onClick={() => { handleAction(selectedOrder.id, "start"); closeDetail(); }} />
                  )}
                  {selectedOrder.status === "in_progress" && (
                    <>
                      <ActionBtn label={t("manufacturing.actionHold")} color="amber" loading={actionLoading === selectedOrder.id} onClick={() => { handleAction(selectedOrder.id, "hold"); closeDetail(); }} />
                      <ActionBtn label={t("manufacturing.actionClose")} color="purple" loading={actionLoading === selectedOrder.id} onClick={() => { handleAction(selectedOrder.id, "close"); closeDetail(); }} />
                    </>
                  )}
                  {selectedOrder.status === "on_hold" && (
                    <ActionBtn label={t("manufacturing.actionReleaseHold")} color="green" loading={actionLoading === selectedOrder.id} onClick={() => { handleAction(selectedOrder.id, "release-hold"); closeDetail(); }} />
                  )}
                </div>
              )}
            </div>

            {/* Footer (edit mode) */}
            {isEditing && (
              <div className="p-5 border-t border-th-border flex gap-3 justify-end">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-th-text-2 hover:bg-th-bg-3"
                >
                  {t("common.cancel")}
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={saveLoading || !editForm.planned_quantity}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-bold"
                >
                  {saveLoading ? t("manufacturing.saving") : t("manufacturing.saveChanges")}
                </button>
              </div>
            )}

            {/* View-only notice */}
            {!canEdit && (
              <div className="p-4 border-t border-th-border bg-amber-50 dark:bg-amber-900/10 text-center">
                <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">{t("manufacturing.viewOnlyNotice")}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ CREATE ORDER MODAL ═══ */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-th-bg rounded-2xl shadow-xl border border-th-border w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-th-border">
              <h3 className="font-bold text-th-text text-lg">{t("manufacturing.newProductionOrder")}</h3>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-th-text-2 mb-1">{t("manufacturing.product")} *</label>
                <select
                  value={newOrder.product_id}
                  onChange={(e) => setNewOrder({ ...newOrder, product_id: Number(e.target.value) })}
                  className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text"
                >
                  <option value={0}>{t("manufacturing.selectProduct")}</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-th-text-2 mb-1">{t("manufacturing.productionLine")} *</label>
                <select
                  value={newOrder.production_line_id}
                  onChange={(e) => setNewOrder({ ...newOrder, production_line_id: Number(e.target.value) })}
                  className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text"
                >
                  <option value={0}>{t("manufacturing.selectLine")}</option>
                  {lines.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-th-text-2 mb-1">{t("manufacturing.plannedQuantity")} *</label>
                <input
                  type="number"
                  min={1}
                  value={newOrder.planned_quantity || ""}
                  onChange={(e) => setNewOrder({ ...newOrder, planned_quantity: parseInt(e.target.value) || 0 })}
                  className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text"
                  inputMode="numeric"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-th-text-2 mb-1">{t("manufacturing.customerRef")}</label>
                <input
                  type="text"
                  value={newOrder.customer_ref}
                  onChange={(e) => setNewOrder({ ...newOrder, customer_ref: e.target.value })}
                  className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text"
                  placeholder={t("manufacturing.optional")}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-th-text-2 mb-1">Notes</label>
                <textarea
                  value={newOrder.notes}
                  onChange={(e) => setNewOrder({ ...newOrder, notes: e.target.value })}
                  rows={2}
                  className="w-full border border-th-border rounded-lg px-3 py-2 text-sm bg-th-bg text-th-text resize-none"
                />
              </div>

              {/* Additional Production Lines */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-th-text-2">Additional Lines ({newOrder.additional_lines.length})</label>
                  <button
                    onClick={() => setNewOrder({
                      ...newOrder,
                      additional_lines: [...newOrder.additional_lines, { production_line_id: 0, planned_quantity: 0 }],
                    })}
                    className="text-xs text-brand-600 hover:text-brand-700 font-semibold"
                  >
                    + Add Line
                  </button>
                </div>
                {newOrder.additional_lines.map((al, i) => (
                  <div key={i} className="flex gap-2 items-center mb-2">
                    <select
                      value={al.production_line_id}
                      onChange={(e) => {
                        const updated = [...newOrder.additional_lines];
                        updated[i] = { ...updated[i], production_line_id: Number(e.target.value) };
                        setNewOrder({ ...newOrder, additional_lines: updated });
                      }}
                      className="flex-1 border border-th-border rounded-lg px-2 py-1.5 text-sm bg-th-bg text-th-text"
                    >
                      <option value={0}>{t("manufacturing.selectLine")}</option>
                      {lines.filter(l => l.id !== newOrder.production_line_id).map((l) => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={1}
                      value={al.planned_quantity || ""}
                      onChange={(e) => {
                        const updated = [...newOrder.additional_lines];
                        updated[i] = { ...updated[i], planned_quantity: parseInt(e.target.value) || 0 };
                        setNewOrder({ ...newOrder, additional_lines: updated });
                      }}
                      className="w-24 border border-th-border rounded-lg px-2 py-1.5 text-sm bg-th-bg text-th-text"
                      placeholder="Qty"
                    />
                    <button
                      onClick={() => setNewOrder({
                        ...newOrder,
                        additional_lines: newOrder.additional_lines.filter((_, idx) => idx !== i),
                      })}
                      className="text-red-500 text-xs hover:text-red-700"
                    >{"🗑"}</button>
                  </div>
                ))}
                {newOrder.additional_lines.length === 0 && (
                  <p className="text-xs text-th-text-3 text-center py-2 italic">
                    Single-line order. Click &quot;+ Add Line&quot; for multi-line production.
                  </p>
                )}
              </div>
            </div>

            <div className="p-5 border-t border-th-border flex gap-3 justify-end">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-th-text-2 hover:bg-th-bg-3"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleCreate}
                disabled={!newOrder.product_id || !newOrder.production_line_id || !newOrder.planned_quantity}
                className="px-5 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-bold"
              >
                {t("common.create")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-xs font-semibold text-th-text-3 min-w-[120px] shrink-0">{label}</span>
      <span className="text-sm text-th-text text-right">{value}</span>
    </div>
  );
}

function ActionBtn({
  label,
  color,
  loading,
  onClick,
}: {
  label: string;
  color: string;
  loading: boolean;
  onClick: () => void;
}) {
  const colors: Record<string, string> = {
    blue: "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300",
    green: "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300",
    amber: "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300",
    purple: "bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/40 dark:text-purple-300",
    red: "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300",
  };
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${colors[color] || colors.blue}`}
    >
      {loading ? "..." : label}
    </button>
  );
}
