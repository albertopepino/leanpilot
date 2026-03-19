"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useI18n } from "@/stores/useI18n";
import { advancedLeanApi, adminApi, manufacturingApi } from "@/lib/api";
import type { AndonEventCreate } from "@/lib/types";
import {
  AlertCircle,
  AlertTriangle,
  Camera,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Keyboard,
  List,
  Loader2,
  Minus,
  Package,
  Pause,
  Play,
  Plus,
  QrCode,
  Search,
  ShieldAlert,
  Square,
  Wrench,
  X,
  XCircle,
} from "lucide-react";

/* ── Types ─────────────────────────────────────────────────────────────────── */

interface ProductionLine {
  id: number;
  name: string;
  description?: string;
}

interface ProductionOrder {
  id: number;
  order_number: string;
  product_name?: string;
  product?: { name: string; code: string };
  planned_quantity: number;
  produced_quantity?: number;
  status: string;
}

type StatusTrigger = "running" | "changeover" | "minor_stop" | "breakdown" | "maintenance" | "quality_hold";
type QCAction = "fga_approved" | "fga_failed" | "in_process_check";
type POInputMode = "scan" | "manual" | "dropdown";

interface StatusEvent {
  trigger: StatusTrigger;
  andonStatus: "green" | "yellow" | "red" | "blue";
  timestamp: Date;
  description?: string;
}

/* ── Component ─────────────────────────────────────────────────────────────── */

export default function ShopFloorOps() {
  const { t } = useI18n();

  /* ── State: config ─────────────────────────────────────────────────── */
  const [lines, setLines] = useState<ProductionLine[]>([]);
  const [selectedLine, setSelectedLine] = useState<ProductionLine | null>(null);
  const [loading, setLoading] = useState(true);

  /* ── State: PO selection ───────────────────────────────────────────── */
  const [poInputMode, setPoInputMode] = useState<POInputMode>("dropdown");
  const [poSearchText, setPoSearchText] = useState("");
  const [availableOrders, setAvailableOrders] = useState<ProductionOrder[]>([]);
  const [selectedPO, setSelectedPO] = useState<ProductionOrder | null>(null);
  const [loadingOrders, setLoadingOrders] = useState(false);

  /* ── State: camera scanner ─────────────────────────────────────────── */
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  /* ── State: running PO ─────────────────────────────────────────────── */
  const [poRunning, setPoRunning] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [goodCount, setGoodCount] = useState(0);
  const [rejectCount, setRejectCount] = useState(0);
  const [currentStatus, setCurrentStatus] = useState<StatusTrigger>("running");

  /* ── State: modals ─────────────────────────────────────────────────── */
  const [triggerModal, setTriggerModal] = useState<StatusTrigger | null>(null);
  const [triggerNote, setTriggerNote] = useState("");
  const [triggerDuration, setTriggerDuration] = useState("");
  const [submitting, setSubmitting] = useState(false);

  /* ── State: QC section ─────────────────────────────────────────────── */
  const [qcExpanded, setQcExpanded] = useState(false);

  /* ── Clock ──────────────────────────────────────────────────────────── */
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  /* ── Elapsed timer ─────────────────────────────────────────────────── */
  useEffect(() => {
    if (!poRunning || !startTime) return;
    const iv = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(iv);
  }, [poRunning, startTime]);

  /* ── Current shift name ────────────────────────────────────────────── */
  const currentShift = useMemo(() => {
    const h = now.getHours();
    if (h >= 6 && h < 14) return t("shopfloor.shiftMorning");
    if (h >= 14 && h < 22) return t("shopfloor.shiftAfternoon");
    return t("shopfloor.shiftNight");
  }, [now, t]);

  /* ── Load lines ────────────────────────────────────────────────────── */
  useEffect(() => {
    (async () => {
      try {
        // Use /admin/factory (accessible to all users) instead of /admin/production-lines (admin only)
        const res = await adminApi.getFactory();
        const data = res.data?.production_lines ?? [];
        setLines(data);
        if (data.length > 0) setSelectedLine(data[0]);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ── Load orders for selected line ─────────────────────────────────── */
  useEffect(() => {
    if (!selectedLine) return;
    setLoadingOrders(true);
    manufacturingApi
      .listOrders({ line_id: selectedLine.id, status: "planned,in_progress" })
      .then((res) => {
        const data = res.data?.items ?? res.data ?? [];
        setAvailableOrders(data);
      })
      .catch(() => setAvailableOrders([]))
      .finally(() => setLoadingOrders(false));
  }, [selectedLine]);

  /* ── Camera helpers ────────────────────────────────────────────────── */
  const openCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      setCameraOpen(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 100);
    } catch {
      setCameraError(t("shopfloor.cameraError"));
    }
  }, [t]);

  const closeCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOpen(false);
  }, []);

  /* ── PO selection ──────────────────────────────────────────────────── */
  const selectPO = useCallback((po: ProductionOrder) => {
    setSelectedPO(po);
    setGoodCount(po.produced_quantity ?? 0);
    setRejectCount(0);
  }, []);

  const searchPO = useCallback(async () => {
    if (!poSearchText.trim() || !selectedLine) return;
    setLoadingOrders(true);
    try {
      const res = await manufacturingApi.listOrders({
        line_id: selectedLine.id,
        status: "planned,in_progress",
      });
      const data: ProductionOrder[] = res.data?.items ?? res.data ?? [];
      const match = data.find(
        (o) => o.order_number?.toLowerCase() === poSearchText.trim().toLowerCase()
      );
      if (match) selectPO(match);
    } catch {
      /* ignore */
    } finally {
      setLoadingOrders(false);
    }
  }, [poSearchText, selectedLine, selectPO]);

  /* ── Start / Stop PO ───────────────────────────────────────────────── */
  const startPO = useCallback(async () => {
    if (!selectedPO || !selectedLine) return;
    setSubmitting(true);
    try {
      await manufacturingApi.startOrder(selectedPO.id);
    } catch {
      /* PO might already be started — continue anyway */
    }
    try {
      await advancedLeanApi.createAndonEvent({
        production_line_id: selectedLine.id,
        status: "green",
        description: `[START] ${selectedLine.name} - ${selectedPO.order_number}`,
      });
    } catch {
      /* non-blocking */
    }
    setPoRunning(true);
    setStartTime(new Date());
    setCurrentStatus("running");
    setSubmitting(false);
  }, [selectedPO, selectedLine]);

  const stopPO = useCallback(async () => {
    if (!selectedPO || !selectedLine) return;
    setSubmitting(true);
    try {
      await manufacturingApi.closeOrder(selectedPO.id);
    } catch {
      /* ignore */
    }
    try {
      await advancedLeanApi.createAndonEvent({
        production_line_id: selectedLine.id,
        status: "green",
        description: `[STOP] ${selectedLine.name} - ${selectedPO.order_number} | Good: ${goodCount} Reject: ${rejectCount}`,
      });
    } catch {
      /* non-blocking */
    }
    setPoRunning(false);
    setStartTime(null);
    setElapsed(0);
    setSelectedPO(null);
    setGoodCount(0);
    setRejectCount(0);
    setCurrentStatus("running");
    setSubmitting(false);
  }, [selectedPO, selectedLine, goodCount, rejectCount]);

  /* ── Status trigger ────────────────────────────────────────────────── */
  const triggerStatus = useCallback(
    async (trigger: StatusTrigger) => {
      if (!selectedLine) return;
      const andonMap: Record<StatusTrigger, "green" | "yellow" | "red" | "blue"> = {
        running: "green",
        changeover: "yellow",
        minor_stop: "yellow",
        breakdown: "red",
        maintenance: "red",
        quality_hold: "blue",
      };
      const labelMap: Record<StatusTrigger, string> = {
        running: "RUNNING",
        changeover: "CHANGEOVER",
        minor_stop: "MINOR STOP",
        breakdown: "BREAKDOWN",
        maintenance: "MAINTENANCE",
        quality_hold: "QUALITY HOLD",
      };
      setSubmitting(true);
      try {
        const poLabel = selectedPO ? selectedPO.order_number : "No PO";
        const desc = `[${labelMap[trigger]}] ${selectedLine.name} - ${poLabel}${triggerNote ? ` | ${triggerNote}` : ""}${triggerDuration ? ` | ${triggerDuration} min` : ""}`;
        await advancedLeanApi.createAndonEvent({
          production_line_id: selectedLine.id,
          status: andonMap[trigger],
          description: desc,
        });
        setCurrentStatus(trigger);
      } catch {
        /* ignore */
      }
      setSubmitting(false);
      setTriggerModal(null);
      setTriggerNote("");
      setTriggerDuration("");
    },
    [selectedLine, selectedPO, triggerNote, triggerDuration]
  );

  /* ── QC actions ────────────────────────────────────────────────────── */
  const handleQC = useCallback(
    async (action: QCAction) => {
      if (!selectedLine || !selectedPO) return;
      const qcMap: Record<QCAction, { status: "green" | "blue"; label: string }> = {
        fga_approved: { status: "green", label: "FGA APPROVED" },
        fga_failed: { status: "blue", label: "FGA FAILED" },
        in_process_check: { status: "green", label: "IN-PROCESS CHECK PASS" },
      };
      const { status, label } = qcMap[action];
      try {
        await advancedLeanApi.createAndonEvent({
          production_line_id: selectedLine.id,
          status,
          description: `[QC: ${label}] ${selectedLine.name} - ${selectedPO.order_number}`,
        });
        if (action === "fga_failed") {
          setCurrentStatus("quality_hold");
        }
      } catch {
        /* ignore */
      }
    },
    [selectedLine, selectedPO]
  );

  /* ── Helpers ───────────────────────────────────────────────────────── */
  const fmtTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const poProductName = (po: ProductionOrder) =>
    po.product_name ?? po.product?.name ?? po.order_number;

  const statusColor = (s: StatusTrigger) => {
    if (s === "running") return "bg-green-500";
    if (s === "changeover" || s === "minor_stop") return "bg-yellow-500";
    if (s === "breakdown" || s === "maintenance") return "bg-red-500";
    return "bg-blue-500";
  };

  /* ── Loading state ─────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
      </div>
    );
  }

  /* ── RENDER ─────────────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col min-h-screen bg-th-bg">
      {/* ── Top Bar ──────────────────────────────────────────────────── */}
      <header className="bg-th-bg-2 text-th-text border-b border-th-border px-4 py-3 flex items-center justify-between gap-3 sticky top-0 z-30">
        <div className="flex items-center gap-3 min-w-0">
          {/* Line selector */}
          <select
            className="bg-th-input text-th-text rounded-lg px-3 py-2 text-lg font-bold min-h-[48px] border border-th-input-border truncate max-w-[200px]"
            value={selectedLine?.id ?? ""}
            onChange={(e) => {
              const ln = lines.find((l) => l.id === Number(e.target.value));
              setSelectedLine(ln ?? null);
              setSelectedPO(null);
              setPoRunning(false);
            }}
          >
            {lines.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          {/* Status dot */}
          {poRunning && (
            <span className={`inline-block w-4 h-4 rounded-full ${statusColor(currentStatus)} animate-pulse`} />
          )}
        </div>
        <div className="flex items-center gap-3 text-base">
          <span className="hidden sm:inline text-th-text-3">{currentShift}</span>
          <span className="font-mono text-lg tabular-nums">
            {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </header>

      <main className="flex-1 p-3 sm:p-4 space-y-4 max-w-3xl mx-auto w-full">
        {/* ── PO Selection ───────────────────────────────────────────── */}
        {!poRunning && (
          <section className="bg-th-card rounded-xl shadow p-4 space-y-4">
            <h2 className="text-lg font-bold">{t("shopfloor.selectPO")}</h2>

            {/* Tabs */}
            <div className="flex gap-1 bg-th-bg-3 rounded-lg p-1">
              {(["scan", "manual", "dropdown"] as POInputMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setPoInputMode(mode)}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-lg text-base font-medium transition min-h-[48px] ${
                    poInputMode === mode
                      ? "bg-th-card shadow text-blue-600 dark:text-blue-400"
                      : "text-th-text-2"
                  }`}
                >
                  {mode === "scan" && <QrCode className="h-5 w-5" />}
                  {mode === "manual" && <Keyboard className="h-5 w-5" />}
                  {mode === "dropdown" && <List className="h-5 w-5" />}
                  <span className="hidden sm:inline">
                    {mode === "scan" && t("shopfloor.tabScan")}
                    {mode === "manual" && t("shopfloor.tabManual")}
                    {mode === "dropdown" && t("shopfloor.tabDropdown")}
                  </span>
                </button>
              ))}
            </div>

            {/* Scan mode */}
            {poInputMode === "scan" && (
              <div className="space-y-3">
                {!cameraOpen ? (
                  <button
                    onClick={openCamera}
                    className="w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6 py-5 text-lg font-semibold min-h-[80px] transition"
                  >
                    <Camera className="h-7 w-7" />
                    {t("shopfloor.scanBarcode")}
                  </button>
                ) : (
                  <div className="relative rounded-xl overflow-hidden bg-black">
                    <video
                      ref={videoRef}
                      className="w-full aspect-video object-cover"
                      playsInline
                      muted
                    />
                    <button
                      onClick={closeCamera}
                      className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-2"
                    >
                      <X className="h-5 w-5" />
                    </button>
                    <p className="text-center text-sm text-th-text-3 py-2">
                      {t("shopfloor.scanHint")}
                    </p>
                  </div>
                )}
                {cameraError && (
                  <p className="text-red-500 text-base">{cameraError}</p>
                )}
                {/* Manual fallback for scan */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={t("shopfloor.barcodeManual")}
                    className="flex-1 border border-th-border rounded-lg px-4 py-3 text-base bg-th-input min-h-[56px]"
                    value={poSearchText}
                    onChange={(e) => setPoSearchText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && searchPO()}
                  />
                  <button
                    onClick={searchPO}
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-5 min-h-[56px]"
                  >
                    <Search className="h-5 w-5" />
                  </button>
                </div>
              </div>
            )}

            {/* Manual mode */}
            {poInputMode === "manual" && (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder={t("shopfloor.enterPONumber")}
                  className="flex-1 border border-th-border rounded-lg px-4 py-3 text-base bg-th-input min-h-[56px]"
                  value={poSearchText}
                  onChange={(e) => setPoSearchText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchPO()}
                />
                <button
                  onClick={searchPO}
                  disabled={loadingOrders}
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-6 min-h-[56px] font-medium text-base flex items-center gap-2"
                >
                  {loadingOrders ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                  {t("shopfloor.search")}
                </button>
              </div>
            )}

            {/* Dropdown mode */}
            {poInputMode === "dropdown" && (
              <div>
                {loadingOrders ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-6 w-6 animate-spin text-th-text-3" />
                  </div>
                ) : availableOrders.length === 0 ? (
                  <p className="text-th-text-3 text-base py-4 text-center">
                    {t("shopfloor.noOrders")}
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {availableOrders.map((po) => (
                      <button
                        key={po.id}
                        onClick={() => selectPO(po)}
                        className={`w-full text-left p-4 rounded-xl border-2 transition min-h-[56px] text-base ${
                          selectedPO?.id === po.id
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                            : "border-gray-200 border-th-border hover:border-gray-400"
                        }`}
                      >
                        <div className="font-semibold">{po.order_number}</div>
                        <div className="text-th-text-2 text-sm mt-1">
                          {poProductName(po)} &mdash; {t("shopfloor.qty")}: {po.planned_quantity}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Selected PO Details + START button */}
            {selectedPO && (
              <div className="border-t border-th-border pt-4 space-y-3">
                <div className="bg-th-bg-3 rounded-xl p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-base font-bold">{selectedPO.order_number}</p>
                      <p className="text-th-text-2 text-base mt-1">
                        {poProductName(selectedPO)}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        selectedPO.status === "in_progress"
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                          : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
                      }`}
                    >
                      {selectedPO.status}
                    </span>
                  </div>
                  <div className="flex gap-6 mt-3 text-base">
                    <div>
                      <span className="text-th-text-3">{t("shopfloor.planned")}:</span>{" "}
                      <span className="font-semibold">{selectedPO.planned_quantity}</span>
                    </div>
                    <div>
                      <span className="text-th-text-3">{t("shopfloor.done")}:</span>{" "}
                      <span className="font-semibold">{selectedPO.produced_quantity ?? 0}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={startPO}
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-3 bg-green-600 hover:bg-green-700 text-white rounded-xl px-6 py-5 text-xl font-bold min-h-[80px] transition disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="h-7 w-7 animate-spin" />
                  ) : (
                    <Play className="h-8 w-8" />
                  )}
                  {t("shopfloor.start")}
                </button>
              </div>
            )}
          </section>
        )}

        {/* ── Running PO Dashboard ───────────────────────────────────── */}
        {poRunning && selectedPO && (
          <>
            {/* Timer + Counters */}
            <section className="bg-th-card rounded-xl shadow p-4 space-y-4">
              {/* PO info row */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-base font-bold">{selectedPO.order_number}</p>
                  <p className="text-sm text-th-text-3">{poProductName(selectedPO)}</p>
                </div>
                <span className={`px-3 py-1.5 rounded-full text-sm font-bold text-white ${statusColor(currentStatus)}`}>
                  {t(`shopfloor.status_${currentStatus}`)}
                </span>
              </div>

              {/* Timer */}
              <div className="text-center py-2">
                <p className="text-sm text-th-text-3 uppercase tracking-wider">{t("shopfloor.elapsed")}</p>
                <p className="text-4xl sm:text-5xl font-mono font-bold tabular-nums mt-1">
                  {fmtTime(elapsed)}
                </p>
              </div>

              {/* Counters */}
              <div className="grid grid-cols-2 gap-3">
                {/* Good pieces */}
                <div className="bg-green-50 dark:bg-green-950 rounded-xl p-3 text-center">
                  <p className="text-sm text-green-700 dark:text-green-400 font-medium">
                    {t("shopfloor.good")}
                  </p>
                  <p className="text-3xl font-bold text-green-600 dark:text-green-400 my-2 tabular-nums">
                    {goodCount}
                  </p>
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={() => setGoodCount((c) => Math.max(0, c - 1))}
                      className="bg-green-200 dark:bg-green-800 rounded-lg p-3 min-h-[56px] min-w-[56px] flex items-center justify-center active:scale-95 transition"
                    >
                      <Minus className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => setGoodCount((c) => c + 1)}
                      className="bg-green-500 text-white rounded-lg p-3 min-h-[56px] flex-1 flex items-center justify-center text-lg font-bold active:scale-95 transition"
                    >
                      <Plus className="h-6 w-6 mr-1" /> 1
                    </button>
                  </div>
                </div>

                {/* Reject pieces */}
                <div className="bg-red-50 dark:bg-red-950 rounded-xl p-3 text-center">
                  <p className="text-sm text-red-700 dark:text-red-400 font-medium">
                    {t("shopfloor.reject")}
                  </p>
                  <p className="text-3xl font-bold text-red-600 dark:text-red-400 my-2 tabular-nums">
                    {rejectCount}
                  </p>
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={() => setRejectCount((c) => Math.max(0, c - 1))}
                      className="bg-red-200 dark:bg-red-800 rounded-lg p-3 min-h-[56px] min-w-[56px] flex items-center justify-center active:scale-95 transition"
                    >
                      <Minus className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => setRejectCount((c) => c + 1)}
                      className="bg-red-500 text-white rounded-lg p-3 min-h-[56px] flex-1 flex items-center justify-center text-lg font-bold active:scale-95 transition"
                    >
                      <Plus className="h-6 w-6 mr-1" /> 1
                    </button>
                  </div>
                </div>
              </div>

              {/* Progress */}
              <div>
                <div className="flex justify-between text-sm text-th-text-3 mb-1">
                  <span>{t("shopfloor.progress")}</span>
                  <span>
                    {goodCount + rejectCount} / {selectedPO.planned_quantity}
                  </span>
                </div>
                <div className="w-full bg-th-bg-3 rounded-full h-3">
                  <div
                    className="bg-blue-500 h-3 rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, ((goodCount + rejectCount) / (selectedPO.planned_quantity || 1)) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </section>

          </>
        )}

        {/* ── Status Trigger Buttons (always visible when line selected) ── */}
        {selectedLine && (
          <>
            <StatusTriggerButtons
              currentStatus={currentStatus}
              submitting={submitting}
              onTriggerRunning={() => triggerStatus("running")}
              onOpenModal={setTriggerModal}
              t={t}
            />

            {/* ── QC Section (collapsible) ───────────────────────────── */}
            <QCSection
              expanded={qcExpanded}
              onToggle={() => setQcExpanded(!qcExpanded)}
              onQCAction={handleQC}
              t={t}
            />

            {/* ── Stop PO ────────────────────────────────────────────── */}
            {poRunning && selectedPO && (
              <button
                onClick={stopPO}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-3 bg-th-bg-3 hover:bg-th-bg-hover text-th-text rounded-xl px-6 py-5 text-xl font-bold min-h-[80px] transition disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="h-7 w-7 animate-spin" />
                ) : (
                  <Square className="h-7 w-7" />
                )}
                {t("shopfloor.stopPO")}
              </button>
            )}
          </>
        )}
      </main>

      {/* ── Trigger Modal ──────────────────────────────────────────────── */}
      {triggerModal && (
        <TriggerModal
          trigger={triggerModal}
          note={triggerNote}
          duration={triggerDuration}
          submitting={submitting}
          onNoteChange={setTriggerNote}
          onDurationChange={setTriggerDuration}
          onClose={() => { setTriggerModal(null); setTriggerNote(""); setTriggerDuration(""); }}
          onConfirm={() => triggerStatus(triggerModal)}
          t={t}
        />
      )}
    </div>
  );
}

/* ================================================================== */
/*  StatusTriggerButtons                                               */
/* ================================================================== */

const TRIGGER_BUTTONS: {
  trigger: StatusTrigger;
  icon: React.ReactNode;
  labelKey: string;
  activeColor: string;
  inactiveColor: string;
}[] = [
  { trigger: "running", icon: <Play className="h-6 w-6" />, labelKey: "shopfloor.trigRunning", activeColor: "bg-green-500 text-white ring-4 ring-green-300", inactiveColor: "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300 hover:bg-green-200" },
  { trigger: "changeover", icon: <Package className="h-6 w-6" />, labelKey: "shopfloor.trigChangeover", activeColor: "bg-yellow-500 text-white ring-4 ring-yellow-300", inactiveColor: "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-300 hover:bg-yellow-200" },
  { trigger: "minor_stop", icon: <Pause className="h-6 w-6" />, labelKey: "shopfloor.trigMinorStop", activeColor: "bg-yellow-500 text-white ring-4 ring-yellow-300", inactiveColor: "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-300 hover:bg-yellow-200" },
  { trigger: "breakdown", icon: <XCircle className="h-6 w-6" />, labelKey: "shopfloor.trigBreakdown", activeColor: "bg-red-500 text-white ring-4 ring-red-300", inactiveColor: "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-300 hover:bg-red-200" },
  { trigger: "maintenance", icon: <Wrench className="h-6 w-6" />, labelKey: "shopfloor.trigMaintenance", activeColor: "bg-red-500 text-white ring-4 ring-red-300", inactiveColor: "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-300 hover:bg-red-200" },
  { trigger: "quality_hold", icon: <ShieldAlert className="h-6 w-6" />, labelKey: "shopfloor.trigQualityHold", activeColor: "bg-blue-500 text-white ring-4 ring-blue-300", inactiveColor: "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300 hover:bg-blue-200" },
];

function StatusTriggerButtons({
  currentStatus,
  submitting,
  onTriggerRunning,
  onOpenModal,
  t,
}: {
  currentStatus: StatusTrigger;
  submitting: boolean;
  onTriggerRunning: () => void;
  onOpenModal: (trigger: StatusTrigger) => void;
  t: (key: string) => string;
}) {
  return (
    <section className="bg-th-card rounded-xl shadow p-4 space-y-3">
      <h3 className="text-base font-bold">{t("shopfloor.statusTriggers")}</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {TRIGGER_BUTTONS.map((btn) => (
          <button
            key={btn.trigger}
            onClick={() => btn.trigger === "running" ? onTriggerRunning() : onOpenModal(btn.trigger)}
            disabled={btn.trigger === "running" ? (currentStatus === "running" || submitting) : submitting}
            className={`flex items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold min-h-[80px] transition active:scale-95 ${
              currentStatus === btn.trigger ? btn.activeColor : btn.inactiveColor
            }`}
          >
            {btn.icon}
            {t(btn.labelKey)}
          </button>
        ))}
      </div>
    </section>
  );
}

/* ================================================================== */
/*  QCSection                                                          */
/* ================================================================== */

function QCSection({
  expanded,
  onToggle,
  onQCAction,
  t,
}: {
  expanded: boolean;
  onToggle: () => void;
  onQCAction: (action: QCAction) => void;
  t: (key: string) => string;
}) {
  return (
    <section className="bg-th-card rounded-xl shadow overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-4 text-base font-bold"
      >
        <span>{t("shopfloor.qcChecks")}</span>
        {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
      </button>
      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          <button
            onClick={() => onQCAction("fga_approved")}
            className="w-full flex items-center gap-3 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300 rounded-xl px-4 min-h-[64px] text-base font-semibold transition hover:bg-green-200 active:scale-[0.98]"
          >
            <CheckCircle className="h-6 w-6" />
            {t("shopfloor.fgaApproved")}
          </button>
          <button
            onClick={() => onQCAction("fga_failed")}
            className="w-full flex items-center gap-3 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-300 rounded-xl px-4 min-h-[64px] text-base font-semibold transition hover:bg-red-200 active:scale-[0.98]"
          >
            <XCircle className="h-6 w-6" />
            {t("shopfloor.fgaFailed")}
          </button>
          <button
            onClick={() => onQCAction("in_process_check")}
            className="w-full flex items-center gap-3 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300 rounded-xl px-4 min-h-[64px] text-base font-semibold transition hover:bg-blue-200 active:scale-[0.98]"
          >
            <AlertCircle className="h-6 w-6" />
            {t("shopfloor.inProcessCheck")}
          </button>
        </div>
      )}
    </section>
  );
}

/* ================================================================== */
/*  TriggerModal                                                       */
/* ================================================================== */

function TriggerModal({
  trigger,
  note,
  duration,
  submitting,
  onNoteChange,
  onDurationChange,
  onClose,
  onConfirm,
  t,
}: {
  trigger: StatusTrigger;
  note: string;
  duration: string;
  submitting: boolean;
  onNoteChange: (v: string) => void;
  onDurationChange: (v: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  t: (key: string) => string;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-th-card w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-5 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold">
            {t(`shopfloor.trig${trigger.charAt(0).toUpperCase() + trigger.slice(1).replace("_", "")}`)}
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-th-bg-hover"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {(trigger === "changeover" || trigger === "minor_stop") && (
          <div>
            <label className="block text-base font-medium mb-1">
              {t("shopfloor.durationMin")}
            </label>
            <input
              type="number"
              inputMode="numeric"
              className="w-full border border-th-border rounded-lg px-4 py-3 text-base bg-th-input min-h-[56px]"
              value={duration}
              onChange={(e) => onDurationChange(e.target.value)}
              placeholder="0"
            />
          </div>
        )}

        {trigger === "minor_stop" && (
          <div>
            <label className="block text-base font-medium mb-1">
              {t("shopfloor.reason")}
            </label>
            <select
              className="w-full border border-th-border rounded-lg px-4 py-3 text-base bg-th-input min-h-[56px]"
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
            >
              <option value="">{t("shopfloor.selectReason")}</option>
              <option value="Material jam">{t("shopfloor.reasonJam")}</option>
              <option value="Sensor fault">{t("shopfloor.reasonSensor")}</option>
              <option value="Operator adjustment">{t("shopfloor.reasonAdjustment")}</option>
              <option value="Other">{t("shopfloor.reasonOther")}</option>
            </select>
          </div>
        )}

        {(trigger === "breakdown" || trigger === "maintenance" || trigger === "quality_hold") && (
          <div>
            <label className="block text-base font-medium mb-1">
              {trigger === "maintenance" ? t("shopfloor.requestDetails") : t("shopfloor.description")}
            </label>
            <textarea
              className="w-full border border-th-border rounded-lg px-4 py-3 text-base bg-th-input min-h-[100px]"
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder={t("shopfloor.descriptionPlaceholder")}
              rows={3}
            />
          </div>
        )}

        {trigger === "changeover" && (
          <div>
            <label className="block text-base font-medium mb-1">
              {t("shopfloor.notes")}
            </label>
            <input
              type="text"
              className="w-full border border-th-border rounded-lg px-4 py-3 text-base bg-th-input min-h-[56px]"
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder={t("shopfloor.notesPlaceholder")}
            />
          </div>
        )}

        <button
          onClick={onConfirm}
          disabled={submitting}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6 py-4 text-lg font-bold min-h-[56px] transition disabled:opacity-50"
        >
          {submitting ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : t("shopfloor.confirm")}
        </button>
      </div>
    </div>
  );
}
