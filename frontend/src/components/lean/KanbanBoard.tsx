"use client";
import { useState, useEffect, useCallback, useMemo, useRef, type DragEvent } from "react";
import { useI18n } from "@/stores/useI18n";
import { useAuth } from "@/hooks/useAuth";
import { useExport } from "@/hooks/useExport";
import ExportToolbar from "@/components/ui/ExportToolbar";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import {
  LayoutDashboard,
  Columns3,
  PlusCircle,
  AlertTriangle,
  Clock,
  Truck,
  Target,
  TrendingUp,
  Package,
  ArrowRight,
  GripVertical,
  Pencil,
  Trash2,
  X,
  ChevronDown,
  Filter,
  Calendar,
  Timer,
  CheckCircle,
  BarChart3,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Priority = "low" | "medium" | "high" | "urgent";
type ViewMode = "board" | "form" | "settings";

interface KanbanCardData {
  id: number;
  board_id: number;
  factory_id: number;
  column_name: string;
  position: number;
  title: string;
  description: string | null;
  product_name: string | null;
  order_number: string | null;
  quantity: number | null;
  priority: Priority;
  assigned_line_id: number | null;
  due_date: string | null;
  started_at: string | null;
  completed_at: string | null;
  lead_time_hours: number | null;
  cycle_time_hours: number | null;
  status: string;
  blocked: boolean;
  blocked_reason: string | null;
  created_by_id: number;
  assigned_to_id: number | null;
  created_at: string;
  updated_at: string;
}

interface KanbanBoardData {
  id: number;
  factory_id: number;
  name: string;
  description: string | null;
  columns: string[];
  wip_limits: Record<string, number>;
  created_by_id: number;
  created_at: string;
  updated_at: string;
  cards: KanbanCardData[];
}

interface BoardMetrics {
  total_wip: number;
  wip_by_column: Record<string, number>;
  avg_lead_time_hours: number | null;
  avg_cycle_time_hours: number | null;
  throughput_per_day: number | null;
  on_time_delivery_pct: number | null;
  total_completed: number;
  total_overdue: number;
}

interface ProductionLine {
  id: number;
  name: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const PRIORITY_CONFIG: Record<Priority, { color: string; bg: string; border: string }> = {
  low:    { color: "text-green-400",  bg: "bg-green-500/20",  border: "border-green-500/30" },
  medium: { color: "text-amber-400",  bg: "bg-amber-500/20",  border: "border-amber-500/30" },
  high:   { color: "text-orange-400", bg: "bg-orange-500/20", border: "border-orange-500/30" },
  urgent: { color: "text-red-400",    bg: "bg-red-500/20",    border: "border-red-500/30" },
};

/* Card aging thresholds (in days) and their visual styles */
type AgingLevel = "fresh" | "normal" | "aging" | "stale";
const AGING_CONFIG: Record<AgingLevel, { color: string; bg: string; border: string; label: string }> = {
  fresh:  { color: "text-green-400",  bg: "bg-green-500/15",  border: "border-green-500/30", label: "<1d" },
  normal: { color: "text-yellow-400", bg: "bg-yellow-500/15", border: "border-yellow-500/30", label: "1-3d" },
  aging:  { color: "text-orange-400", bg: "bg-orange-500/15", border: "border-orange-500/30", label: "3-7d" },
  stale:  { color: "text-red-400",    bg: "bg-red-500/15",    border: "border-red-500/30",    label: ">7d" },
};

function getCardAgingLevel(createdAt: string): AgingLevel {
  const now = Date.now();
  const created = new Date(createdAt).getTime();
  const days = (now - created) / (1000 * 60 * 60 * 24);
  if (days < 1) return "fresh";
  if (days < 3) return "normal";
  if (days < 7) return "aging";
  return "stale";
}

function getCardAgeDays(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
}

const COLUMN_COLORS: Record<string, string> = {
  backlog:     "border-t-slate-400",
  in_queue:    "border-t-blue-400",
  in_progress: "border-t-amber-400",
  done:        "border-t-green-400",
  shipped:     "border-t-purple-400",
};

const DEFAULT_COLUMNS = ["backlog", "in_queue", "in_progress", "done", "shipped"];
const DEFAULT_WIP_LIMITS: Record<string, number> = {
  backlog: 0, in_queue: 5, in_progress: 3, done: 10, shipped: 0,
};

/* ------------------------------------------------------------------ */
/*  API helper                                                         */
/* ------------------------------------------------------------------ */

const API_BASE = "/api/v1";

function getHeaders(): HeadersInit {
  const token = typeof window !== "undefined" ? localStorage.getItem("leanpilot_token") : null;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, { headers: getHeaders(), ...opts });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `API error ${res.status}`);
  }
  return res.json();
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function KanbanBoard() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { printView, exportToExcel, exportToCSV } = useExport();

  const [view, setView] = useState<ViewMode>("board");
  const [boards, setBoards] = useState<KanbanBoardData[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<number | null>(null);
  const [board, setBoard] = useState<KanbanBoardData | null>(null);
  const [metrics, setMetrics] = useState<BoardMetrics | null>(null);
  const [lines, setLines] = useState<ProductionLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // Filters
  const [filterPriority, setFilterPriority] = useState("");
  const [filterLine, setFilterLine] = useState("");

  // Drag state
  const dragCard = useRef<KanbanCardData | null>(null);
  const dragOverColumn = useRef<string | null>(null);

  // Card form
  const [showCardForm, setShowCardForm] = useState(false);
  const [editingCard, setEditingCard] = useState<KanbanCardData | null>(null);
  const [cardForm, setCardForm] = useState({
    title: "",
    description: "",
    product_name: "",
    order_number: "",
    quantity: "",
    priority: "medium" as Priority,
    assigned_line_id: "",
    due_date: "",
    column_name: "backlog",
    blocked: false,
    blocked_reason: "",
  });

  // Board form
  const [boardForm, setBoardForm] = useState({
    name: "",
    description: "",
  });

  /* ---- Data fetching ---- */

  const fetchLines = useCallback(async () => {
    try {
      const data = await apiFetch<ProductionLine[] | { lines: ProductionLine[] }>("/admin/production-lines");
      setLines(Array.isArray(data) ? data : (data as { lines: ProductionLine[] })?.lines || []);
    } catch { setLines([]); }
  }, []);

  const fetchBoards = useCallback(async () => {
    try {
      const data = await apiFetch<KanbanBoardData[]>("/kanban/boards");
      setBoards(Array.isArray(data) ? data : []);
      if (data.length > 0 && !activeBoardId) {
        setActiveBoardId(data[0].id);
      }
    } catch (err) {
      console.error("Failed to fetch boards", err);
    }
  }, [activeBoardId]);

  const fetchBoard = useCallback(async (id: number) => {
    setLoading(true);
    try {
      const [boardData, metricsData] = await Promise.all([
        apiFetch<KanbanBoardData>(`/kanban/boards/${id}`),
        apiFetch<BoardMetrics>(`/kanban/boards/${id}/metrics`),
      ]);
      setBoard(boardData);
      setMetrics(metricsData);
    } catch (err) {
      console.error("Failed to fetch board", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBoards();
    fetchLines();
  }, [fetchBoards, fetchLines]);

  useEffect(() => {
    if (activeBoardId) fetchBoard(activeBoardId);
  }, [activeBoardId, fetchBoard]);

  /* ---- Cards by column ---- */

  const cardsByColumn = useMemo(() => {
    if (!board) return {};
    const map: Record<string, KanbanCardData[]> = {};
    for (const col of (board.columns || [])) map[col] = [];
    for (const card of (board.cards || [])) {
      if (filterPriority && card.priority !== filterPriority) continue;
      if (filterLine && card.assigned_line_id !== Number(filterLine)) continue;
      if (!map[card.column_name]) map[card.column_name] = [];
      map[card.column_name].push(card);
    }
    // Sort by position
    for (const col of Object.keys(map)) {
      map[col].sort((a, b) => a.position - b.position);
    }
    return map;
  }, [board, filterPriority, filterLine]);

  const lineMap = useMemo(() => {
    const m: Record<number, string> = {};
    for (const l of lines) m[l.id] = l.name;
    return m;
  }, [lines]);

  /* ---- Card form handlers ---- */

  const resetCardForm = () => {
    setCardForm({
      title: "", description: "", product_name: "", order_number: "",
      quantity: "", priority: "medium", assigned_line_id: "", due_date: "",
      column_name: "backlog", blocked: false, blocked_reason: "",
    });
    setEditingCard(null);
    setShowCardForm(false);
    setError("");
  };

  const handleEditCard = (card: KanbanCardData) => {
    setCardForm({
      title: card.title,
      description: card.description || "",
      product_name: card.product_name || "",
      order_number: card.order_number || "",
      quantity: card.quantity ? String(card.quantity) : "",
      priority: card.priority,
      assigned_line_id: card.assigned_line_id ? String(card.assigned_line_id) : "",
      due_date: card.due_date ? card.due_date.slice(0, 16) : "",
      column_name: card.column_name,
      blocked: card.blocked || false,
      blocked_reason: card.blocked_reason || "",
    });
    setEditingCard(card);
    setShowCardForm(true);
  };

  const handleSubmitCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardForm.title || !board) return;
    setSaving(true);
    setError("");
    try {
      const payload: Record<string, unknown> = {
        title: cardForm.title,
        description: cardForm.description || null,
        product_name: cardForm.product_name || null,
        order_number: cardForm.order_number || null,
        quantity: cardForm.quantity ? Number(cardForm.quantity) : 0,
        priority: cardForm.priority,
        assigned_line_id: cardForm.assigned_line_id ? Number(cardForm.assigned_line_id) : null,
        due_date: cardForm.due_date || null,
        column_name: cardForm.column_name,
        blocked: cardForm.blocked,
        blocked_reason: cardForm.blocked_reason || null,
      };

      if (editingCard) {
        await apiFetch(`/kanban/cards/${editingCard.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch(`/kanban/boards/${board.id}/cards`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      resetCardForm();
      fetchBoard(board.id);
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to save card");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCard = (cardId: number) => {
    if (!board) return;
    setConfirmDeleteId(cardId);
  };

  const executeDeleteCard = async () => {
    const cardId = confirmDeleteId;
    setConfirmDeleteId(null);
    if (!board || cardId == null) return;
    try {
      await apiFetch(`/kanban/cards/${cardId}`, { method: "DELETE" });
      fetchBoard(board.id);
    } catch (err) {
      console.error("Failed to delete card", err);
      setError(t("kanban.deleteCardFailed") || "Failed to delete card");
    }
  };

  /* ---- Board form handlers ---- */

  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!boardForm.name) return;
    setSaving(true);
    try {
      const newBoard = await apiFetch<KanbanBoardData>("/kanban/boards", {
        method: "POST",
        body: JSON.stringify({
          name: boardForm.name,
          description: boardForm.description || null,
          columns: DEFAULT_COLUMNS,
          wip_limits: DEFAULT_WIP_LIMITS,
        }),
      });
      setBoardForm({ name: "", description: "" });
      setActiveBoardId(newBoard.id);
      fetchBoards();
      setView("board");
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to create board");
    } finally {
      setSaving(false);
    }
  };

  /* ---- Drag & Drop ---- */

  const handleDragStart = (e: DragEvent, card: KanbanCardData) => {
    dragCard.current = card;
    e.dataTransfer.effectAllowed = "move";
    (e.target as HTMLElement).classList.add("opacity-50");
  };

  const handleDragEnd = (e: DragEvent) => {
    (e.target as HTMLElement).classList.remove("opacity-50");
    dragCard.current = null;
    dragOverColumn.current = null;
  };

  const handleDragOver = (e: DragEvent, columnName: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    dragOverColumn.current = columnName;
  };

  const handleDrop = async (e: DragEvent, columnName: string) => {
    e.preventDefault();
    const card = dragCard.current;
    if (!card || !board) return;
    if (card.column_name === columnName) return;

    try {
      await apiFetch(`/kanban/cards/${card.id}/move`, {
        method: "PATCH",
        body: JSON.stringify({ column_name: columnName, position: 0 }),
      });
      fetchBoard(board.id);
    } catch (err: unknown) {
      setError((err as Error).message || "Move failed");
    }
  };

  /* ---- Export ---- */

  const handleExportExcel = () => {
    if (!board) return;
    const columns = [
      { key: "order_number", header: t("kanban.orderNumber"), width: 15 },
      { key: "title", header: t("kanban.title"), width: 25 },
      { key: "product_name", header: t("kanban.productName"), width: 20 },
      { key: "column_name", header: t("kanban.column"), width: 15 },
      { key: "priority", header: t("kanban.priority"), width: 10 },
      { key: "quantity", header: t("kanban.quantity"), width: 10 },
      { key: "due_date", header: t("kanban.dueDate"), width: 18 },
      { key: "lead_time", header: t("kanban.leadTime"), width: 14 },
      { key: "assigned_line", header: t("kanban.assignedLine"), width: 18 },
    ];
    const rows = (board.cards || []).map((c) => ({
      order_number: c.order_number || "",
      title: c.title,
      product_name: c.product_name || "",
      column_name: t(`kanban.col_${c.column_name}`) || c.column_name,
      priority: t(`kanban.priority_${c.priority}`) || c.priority,
      quantity: c.quantity || 0,
      due_date: c.due_date ? new Date(c.due_date).toLocaleDateString() : "",
      lead_time: c.lead_time_hours ? `${c.lead_time_hours}h` : "",
      assigned_line: c.assigned_line_id ? (lineMap[c.assigned_line_id] || `#${c.assigned_line_id}`) : "",
    }));
    exportToExcel({ filename: `kanban-${board.name}`, columns, rows, sheetName: "Kanban" });
  };

  const handleExportCSV = () => {
    if (!board) return;
    const columns = [
      { key: "order_number", header: t("kanban.orderNumber") },
      { key: "title", header: t("kanban.title") },
      { key: "column_name", header: t("kanban.column") },
      { key: "priority", header: t("kanban.priority") },
      { key: "quantity", header: t("kanban.quantity") },
    ];
    const rows = (board.cards || []).map((c) => ({
      order_number: c.order_number || "",
      title: c.title,
      column_name: c.column_name,
      priority: c.priority,
      quantity: c.quantity || 0,
    }));
    exportToCSV({ filename: `kanban-${board.name}`, columns, rows });
  };

  const handlePrint = () => {
    printView({ title: `Kanban — ${board?.name || ""}`, orientation: "landscape" });
  };

  /* ---- Render: KPI cards ---- */

  const renderKPIs = () => {
    if (!metrics) return null;
    const kpis = [
      {
        label: t("kanban.totalWIP"),
        value: metrics.total_wip,
        icon: Package,
        color: "text-blue-400",
      },
      {
        label: t("kanban.avgLeadTime"),
        value: metrics.avg_lead_time_hours != null ? `${metrics.avg_lead_time_hours}h` : "N/A",
        icon: Timer,
        color: "text-amber-400",
      },
      {
        label: t("kanban.throughput"),
        value: metrics.throughput_per_day != null ? `${metrics.throughput_per_day}/d` : "N/A",
        icon: TrendingUp,
        color: "text-green-400",
      },
      {
        label: t("kanban.onTimeDelivery"),
        value: metrics.on_time_delivery_pct != null ? `${metrics.on_time_delivery_pct}%` : "N/A",
        icon: CheckCircle,
        color: "text-purple-400",
      },
    ];
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-1">
              <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
              <span className="text-xs uppercase tracking-wider text-th-text-3 font-semibold">{kpi.label}</span>
            </div>
            <p className="text-2xl font-bold text-th-text">{kpi.value}</p>
          </div>
        ))}
      </div>
    );
  };

  /* ---- Render: Pull signal ---- */

  const hasPullSignal = (card: KanbanCardData): boolean => {
    if (!board) return false;
    const colIndex = board.columns.indexOf(card.column_name);
    if (colIndex < 0 || colIndex >= board.columns.length - 1) return false;
    const nextCol = board.columns[colIndex + 1];
    const nextLimit = board.wip_limits[nextCol] || 0;
    if (nextLimit <= 0) return false;
    const nextCount = (cardsByColumn[nextCol] || []).length;
    return nextCount < nextLimit;
  };

  /* ---- Render: Card ---- */

  const renderCard = (card: KanbanCardData) => {
    const pConf = PRIORITY_CONFIG[card.priority] || PRIORITY_CONFIG.medium;
    const isOverdue = card.due_date && !card.completed_at && new Date(card.due_date) < new Date();
    const pullSignal = hasPullSignal(card);
    const agingLevel = getCardAgingLevel(card.created_at);
    const agingConf = AGING_CONFIG[agingLevel];
    const ageDays = getCardAgeDays(card.created_at);
    const isBlocked = card.blocked === true;

    return (
      <div
        key={card.id}
        draggable
        onDragStart={(e) => handleDragStart(e, card)}
        onDragEnd={handleDragEnd}
        className={`rounded-lg border-2 bg-th-card p-3 cursor-grab active:cursor-grabbing transition-all hover:shadow-md ${
          isBlocked
            ? "border-red-500 bg-red-500/5 ring-1 ring-red-500/20"
            : isOverdue
            ? "border-red-500/50 bg-red-500/5"
            : "border-th-border"
        }`}
      >
        {/* Blocked banner */}
        {isBlocked && (
          <div className="flex items-center gap-1.5 px-2 py-1 mb-2 -mx-1 -mt-1 rounded-t bg-red-500/15 border-b border-red-500/30">
            <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />
            <span className="text-[10px] font-bold text-red-400 uppercase tracking-wide">
              {t("kanban.blocked") || "Blocked"}
            </span>
            {card.blocked_reason && (
              <span className="text-[10px] text-red-300 truncate">— {card.blocked_reason}</span>
            )}
          </div>
        )}

        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            <GripVertical className="w-3.5 h-3.5 text-th-text-3 flex-shrink-0" />
            <span className={`inline-block px-1.5 py-0.5 text-[10px] font-bold rounded border ${pConf.bg} ${pConf.color} ${pConf.border}`}>
              {t(`kanban.priority_${card.priority}`) || card.priority.toUpperCase()}
            </span>
            {/* Card aging indicator */}
            {!card.completed_at && (
              <span
                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded border ${agingConf.bg} ${agingConf.color} ${agingConf.border}`}
                title={`${t("kanban.cardAge") || "Age"}: ${ageDays} ${t("kanban.days") || "days"}`}
              >
                <Clock className="w-3 h-3" />
                {ageDays}d
              </span>
            )}
            {pullSignal && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                <ArrowRight className="w-3 h-3" />
                {t("kanban.pull")}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={() => handleEditCard(card)} className="p-1 text-th-text-3 hover:text-blue-400 transition">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => handleDeleteCard(card.id)} className="p-1 text-th-text-3 hover:text-red-400 transition">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Title */}
        <h4 className="text-sm font-semibold text-th-text leading-tight mb-1 line-clamp-2">{card.title}</h4>

        {/* Order & Product */}
        {(card.order_number || card.product_name) && (
          <div className="flex items-center gap-2 text-[11px] text-th-text-3 mb-1.5">
            {card.order_number && <span className="font-mono">#{card.order_number}</span>}
            {card.product_name && <span className="truncate">{card.product_name}</span>}
          </div>
        )}

        {/* Metadata row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-th-text-3 mt-2">
          {card.quantity != null && card.quantity > 0 && (
            <span className="flex items-center gap-0.5">
              <Package className="w-3 h-3" /> {card.quantity}
            </span>
          )}
          {card.assigned_line_id && (
            <span className="truncate">
              {lineMap[card.assigned_line_id] || `Line #${card.assigned_line_id}`}
            </span>
          )}
          {card.due_date && (
            <span className={`flex items-center gap-0.5 ${isOverdue ? "text-red-400 font-semibold" : ""}`}>
              <Calendar className="w-3 h-3" />
              {new Date(card.due_date).toLocaleDateString()}
            </span>
          )}
          {card.lead_time_hours != null && (
            <span className="flex items-center gap-0.5">
              <Timer className="w-3 h-3" /> {card.lead_time_hours}h
            </span>
          )}
        </div>
      </div>
    );
  };

  /* ---- Render: Column ---- */

  const renderColumn = (colName: string) => {
    const cards = cardsByColumn[colName] || [];
    const wipLimit = board?.wip_limits[colName] || 0;
    const count = cards.length;
    const isWarning = wipLimit > 0 && count >= wipLimit - 1 && count < wipLimit;
    const isExceeded = wipLimit > 0 && count >= wipLimit;
    const colColor = COLUMN_COLORS[colName] || "border-t-gray-400";

    return (
      <div
        key={colName}
        className={`flex flex-col min-w-[280px] max-w-[320px] flex-1 rounded-xl border-t-4 ${colColor} border border-th-border bg-th-bg-2 ${
          isExceeded ? "ring-2 ring-red-500/40" : isWarning ? "ring-2 ring-amber-500/30" : ""
        }`}
        onDragOver={(e) => handleDragOver(e, colName)}
        onDrop={(e) => handleDrop(e, colName)}
      >
        {/* Column header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-th-border">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-th-text">
              {t(`kanban.col_${colName}`) || colName.replace(/_/g, " ")}
            </h3>
            <span className={`text-xs font-bold rounded-full px-2 py-0.5 ${
              isExceeded ? "bg-red-500/20 text-red-400" : isWarning ? "bg-amber-500/20 text-amber-400" : "bg-th-bg-3 text-th-text-3"
            }`}>
              {count}{wipLimit > 0 ? `/${wipLimit}` : ""}
            </span>
          </div>
          {isExceeded && <AlertTriangle className="w-4 h-4 text-red-400" />}
          {isWarning && !isExceeded && <AlertTriangle className="w-4 h-4 text-amber-400" />}
        </div>

        {/* Cards */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-[100px]">
          {cards.length === 0 ? (
            <div className="flex items-center justify-center h-20 text-xs text-th-text-3 italic">
              {t("kanban.emptyColumn")}
            </div>
          ) : (
            cards.map(renderCard)
          )}
        </div>

        {/* Add card button */}
        <div className="px-3 pb-3">
          <button
            onClick={() => {
              resetCardForm();
              setCardForm((f) => ({ ...f, column_name: colName }));
              setShowCardForm(true);
            }}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-th-border text-xs font-medium text-th-text-3 hover:bg-th-bg-3 hover:text-th-text-2 transition"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            {t("kanban.addCard")}
          </button>
        </div>
      </div>
    );
  };

  /* ---- Render: Card form modal ---- */

  const renderCardForm = () => {
    if (!showCardForm) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => resetCardForm()}>
        <div className="bg-th-bg-2 border border-th-border rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-th-border">
            <h3 className="text-lg font-bold text-th-text">
              {editingCard ? t("kanban.editCard") : t("kanban.newCard")}
            </h3>
            <button onClick={resetCardForm} className="p-1 text-th-text-3 hover:text-th-text transition">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmitCard} className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-th-text-3 mb-1">{t("kanban.title")} *</label>
              <input
                type="text"
                value={cardForm.title}
                onChange={(e) => setCardForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full rounded-lg border border-th-border bg-th-card px-3 py-2 text-sm text-th-text-2"
                placeholder={t("kanban.titlePlaceholder")}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-th-text-3 mb-1">{t("kanban.orderNumber")}</label>
                <input
                  type="text"
                  value={cardForm.order_number}
                  onChange={(e) => setCardForm((f) => ({ ...f, order_number: e.target.value }))}
                  className="w-full rounded-lg border border-th-border bg-th-card px-3 py-2 text-sm text-th-text-2"
                  placeholder="ORD-001"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-th-text-3 mb-1">{t("kanban.productName")}</label>
                <input
                  type="text"
                  value={cardForm.product_name}
                  onChange={(e) => setCardForm((f) => ({ ...f, product_name: e.target.value }))}
                  className="w-full rounded-lg border border-th-border bg-th-card px-3 py-2 text-sm text-th-text-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-th-text-3 mb-1">{t("kanban.quantity")}</label>
                <input
                  type="number"
                  min="0"
                  value={cardForm.quantity}
                  onChange={(e) => setCardForm((f) => ({ ...f, quantity: e.target.value }))}
                  className="w-full rounded-lg border border-th-border bg-th-card px-3 py-2 text-sm text-th-text-2"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-th-text-3 mb-1">{t("kanban.column")}</label>
                <select
                  value={cardForm.column_name}
                  onChange={(e) => setCardForm((f) => ({ ...f, column_name: e.target.value }))}
                  className="w-full rounded-lg border border-th-border bg-th-card px-3 py-2 text-sm text-th-text-2"
                >
                  {(board?.columns || DEFAULT_COLUMNS).map((col) => (
                    <option key={col} value={col}>{t(`kanban.col_${col}`) || col}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-th-text-3 mb-1">{t("kanban.priority")}</label>
              <div className="flex gap-2">
                {(["low", "medium", "high", "urgent"] as Priority[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setCardForm((f) => ({ ...f, priority: p }))}
                    className={`flex-1 py-2 rounded-lg border text-xs font-semibold transition ${
                      cardForm.priority === p
                        ? `${PRIORITY_CONFIG[p].bg} ${PRIORITY_CONFIG[p].color} ${PRIORITY_CONFIG[p].border}`
                        : "border-th-border text-th-text-3"
                    }`}
                  >
                    {t(`kanban.priority_${p}`) || p}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-th-text-3 mb-1">{t("kanban.dueDate")}</label>
                <input
                  type="datetime-local"
                  value={cardForm.due_date}
                  onChange={(e) => setCardForm((f) => ({ ...f, due_date: e.target.value }))}
                  className="w-full rounded-lg border border-th-border bg-th-card px-3 py-2 text-sm text-th-text-2"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-th-text-3 mb-1">{t("kanban.assignedLine")}</label>
                <select
                  value={cardForm.assigned_line_id}
                  onChange={(e) => setCardForm((f) => ({ ...f, assigned_line_id: e.target.value }))}
                  className="w-full rounded-lg border border-th-border bg-th-card px-3 py-2 text-sm text-th-text-2"
                >
                  <option value="">{t("kanban.unassigned")}</option>
                  {lines.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Blocked flag */}
            <div className={`rounded-lg border p-3 ${cardForm.blocked ? "border-red-500/40 bg-red-500/5" : "border-th-border"}`}>
              <label className="flex items-center gap-2 text-sm text-th-text cursor-pointer">
                <input
                  type="checkbox"
                  checked={cardForm.blocked}
                  onChange={(e) => setCardForm((f) => ({ ...f, blocked: e.target.checked }))}
                  className="rounded accent-red-500"
                />
                <AlertTriangle className={`w-4 h-4 ${cardForm.blocked ? "text-red-400" : "text-th-text-3"}`} />
                {t("kanban.markBlocked") || "Mark as Blocked"}
              </label>
              {cardForm.blocked && (
                <input
                  type="text"
                  value={cardForm.blocked_reason}
                  onChange={(e) => setCardForm((f) => ({ ...f, blocked_reason: e.target.value }))}
                  className="w-full mt-2 rounded-lg border border-red-500/30 bg-th-card px-3 py-2 text-sm text-th-text-2"
                  placeholder={t("kanban.blockedReasonPlaceholder") || "Reason for block..."}
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-th-text-3 mb-1">{t("kanban.description")}</label>
              <textarea
                value={cardForm.description}
                onChange={(e) => setCardForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                className="w-full rounded-lg border border-th-border bg-th-card px-3 py-2 text-sm text-th-text-2"
                placeholder={t("kanban.descriptionPlaceholder")}
              />
            </div>

            {error && (
              <p className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving || !cardForm.title}
                className="flex-1 bg-brand-600 hover:bg-brand-500 text-white rounded-lg font-semibold transition-colors py-2.5 px-4 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? t("kanban.saving") : editingCard ? t("kanban.updateCard") : t("kanban.createCard")}
              </button>
              <button
                type="button"
                onClick={resetCardForm}
                className="px-4 py-2.5 rounded-xl border border-th-border text-th-text-3 hover:bg-th-bg-hover transition text-sm font-medium"
              >
                {t("kanban.cancel")}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  /* ---- Render: Board creation form ---- */

  const renderBoardForm = () => (
    <div className="max-w-lg mx-auto">
      <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-6">
        <h3 className="text-lg font-bold text-th-text mb-4">{t("kanban.createBoard")}</h3>
        <form onSubmit={handleCreateBoard} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-th-text-3 mb-1">{t("kanban.boardName")} *</label>
            <input
              type="text"
              value={boardForm.name}
              onChange={(e) => setBoardForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full rounded-lg border border-th-border bg-th-card px-3 py-2 text-sm text-th-text-2"
              placeholder={t("kanban.boardNamePlaceholder")}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-th-text-3 mb-1">{t("kanban.description")}</label>
            <textarea
              value={boardForm.description}
              onChange={(e) => setBoardForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              className="w-full rounded-lg border border-th-border bg-th-card px-3 py-2 text-sm text-th-text-2"
            />
          </div>
          <button
            type="submit"
            disabled={saving || !boardForm.name}
            className="w-full bg-brand-600 hover:bg-brand-500 text-white rounded-lg font-semibold transition-colors py-2.5 px-4 disabled:opacity-50"
          >
            {saving ? t("kanban.saving") : t("kanban.createBoard")}
          </button>
        </form>
      </div>
    </div>
  );

  /* ---- Render: Board view (columns) ---- */

  const renderBoard = () => {
    if (!board) {
      return (
        <div className="text-center py-20">
          <Columns3 className="w-12 h-12 mx-auto text-th-text-3 mb-4" />
          <p className="text-th-text-3 mb-4">{t("kanban.noBoards")}</p>
          <button
            onClick={() => setView("settings")}
            className="bg-brand-600 hover:bg-brand-500 text-white rounded-lg font-semibold px-6 py-2.5 transition"
          >
            {t("kanban.createBoard")}
          </button>
        </div>
      );
    }

    return (
      <div>
        {renderKPIs()}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex items-center gap-1.5 text-xs text-th-text-3">
            <Filter className="w-3.5 h-3.5" />
            {t("kanban.filters")}:
          </div>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="rounded-lg border border-th-border bg-th-card text-sm px-3 py-1.5 text-th-text-2"
          >
            <option value="">{t("kanban.allPriorities")}</option>
            {(["low", "medium", "high", "urgent"] as Priority[]).map((p) => (
              <option key={p} value={p}>{t(`kanban.priority_${p}`) || p}</option>
            ))}
          </select>
          <select
            value={filterLine}
            onChange={(e) => setFilterLine(e.target.value)}
            className="rounded-lg border border-th-border bg-th-card text-sm px-3 py-1.5 text-th-text-2"
          >
            <option value="">{t("kanban.allLines")}</option>
            {lines.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>

        {/* Columns */}
        <div data-print-area className="flex gap-4 overflow-x-auto pb-4">
          {board.columns.map(renderColumn)}
        </div>
      </div>
    );
  };

  /* ---- Main render ---- */

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-th-text">{t("kanban.title")}</h1>
          <p className="text-sm text-th-text-3 mt-1">{t("kanban.subtitle")}</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Board selector */}
          {boards.length > 0 && (
            <select
              value={activeBoardId || ""}
              onChange={(e) => setActiveBoardId(Number(e.target.value))}
              className="rounded-lg border border-th-border bg-th-card text-sm px-3 py-2 text-th-text-2"
            >
              {boards.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}

          <ExportToolbar
            onPrint={handlePrint}
            onExportExcel={handleExportExcel}
            onExportCSV={handleExportCSV}
          />

          {/* View tabs */}
          <div className="flex bg-th-bg-3 rounded-xl p-1 gap-1">
            {([
              { key: "board" as ViewMode, label: t("kanban.boardView"), icon: Columns3 },
              { key: "settings" as ViewMode, label: t("kanban.newBoard"), icon: PlusCircle },
            ]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setView(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition ${
                  view === tab.key
                    ? "bg-th-card text-th-text shadow-sm"
                    : "text-th-text-3 hover:text-th-text-2"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {view === "board" && renderBoard()}
          {view === "settings" && renderBoardForm()}
        </>
      )}

      {/* Card form modal */}
      {renderCardForm()}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={confirmDeleteId !== null}
        title={t("kanban.confirmDeleteCard") || "Delete Card"}
        message={t("kanban.confirmDeleteCardMsg") || "Are you sure you want to delete this card?"}
        onConfirm={executeDeleteCard}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
