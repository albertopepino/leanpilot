"use client";
import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useI18n } from "@/stores/useI18n";
import { advancedLeanApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/formatters";
import { useExport } from "@/hooks/useExport";
import ExportToolbar from "@/components/ui/ExportToolbar";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import {
  Brain,
  Plus,
  Trash2,
  Edit3,
  Palette,
  ZoomIn,
  ZoomOut,
  Link,
  Maximize,
  FilePlus,
  FolderOpen,
  Save,
  X,
  ChevronRight,
  ChevronDown,
  HelpCircle,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface MindMapNode {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  parentId: string | null;
  collapsed?: boolean;
}

interface MindMapConnector {
  id: string;
  fromId: string;
  toId: string;
  label: string;
  color: string;
}

interface MindMapData {
  title: string;
  description: string;
  nodes: MindMapNode[];
  connectors: MindMapConnector[];
}

interface SavedMindMap extends MindMapData {
  id: number;
  created_at: string;
  updated_at?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const NODE_COLORS = [
  { id: "indigo", bg: "bg-indigo-100 dark:bg-indigo-900/40", border: "border-indigo-300 dark:border-indigo-700", text: "text-indigo-800 dark:text-indigo-200", hex: "#6366f1", hexDark: "#818cf8" },
  { id: "emerald", bg: "bg-emerald-100 dark:bg-emerald-900/40", border: "border-emerald-300 dark:border-emerald-700", text: "text-emerald-800 dark:text-emerald-200", hex: "#10b981", hexDark: "#34d399" },
  { id: "amber", bg: "bg-amber-100 dark:bg-amber-900/40", border: "border-amber-300 dark:border-amber-700", text: "text-amber-800 dark:text-amber-200", hex: "#f59e0b", hexDark: "#fbbf24" },
  { id: "rose", bg: "bg-rose-100 dark:bg-rose-900/40", border: "border-rose-300 dark:border-rose-700", text: "text-rose-800 dark:text-rose-200", hex: "#f43f5e", hexDark: "#fb7185" },
  { id: "cyan", bg: "bg-cyan-100 dark:bg-cyan-900/40", border: "border-cyan-300 dark:border-cyan-700", text: "text-cyan-800 dark:text-cyan-200", hex: "#06b6d4", hexDark: "#22d3ee" },
  { id: "violet", bg: "bg-violet-100 dark:bg-violet-900/40", border: "border-violet-300 dark:border-violet-700", text: "text-violet-800 dark:text-violet-200", hex: "#8b5cf6", hexDark: "#a78bfa" },
  { id: "orange", bg: "bg-orange-100 dark:bg-orange-900/40", border: "border-orange-300 dark:border-orange-700", text: "text-orange-800 dark:text-orange-200", hex: "#f97316", hexDark: "#fb923c" },
  { id: "sky", bg: "bg-sky-100 dark:bg-sky-900/40", border: "border-sky-300 dark:border-sky-700", text: "text-sky-800 dark:text-sky-200", hex: "#0ea5e9", hexDark: "#38bdf8" },
];

const getNodeColor = (colorId: string) => NODE_COLORS.find((c) => c.id === colorId) || NODE_COLORS[0];

function genId(): string {
  return "n" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

const DEFAULT_CENTER = { x: 600, y: 400 };

function getInitialNodes(t: (k: string) => string): MindMapNode[] {
  return [
    { id: genId(), text: t("improvement.mindmapCentral") || "Central Topic", x: DEFAULT_CENTER.x, y: DEFAULT_CENTER.y, color: "indigo", parentId: null },
  ];
}

// ─── Edge intersection: compute where a line from center exits a rounded rect ─

function edgePoint(cx: number, cy: number, w: number, h: number, tx: number, ty: number): { x: number; y: number } {
  const hw = w / 2;
  const hh = h / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  let sx: number, sy: number;
  if (absDx * hh > absDy * hw) {
    // hits left or right edge
    sx = cx + Math.sign(dx) * hw;
    sy = cy + (dy / absDx) * hw;
  } else {
    // hits top or bottom edge
    sx = cx + (dx / absDy) * hh;
    sy = cy + Math.sign(dy) * hh;
  }
  return { x: sx, y: sy };
}

// ─── Curved path between edge points ────────────────────────────────────────

function curvePath(
  x1: number, y1: number, w1: number, h1: number,
  x2: number, y2: number, w2: number, h2: number,
  isConnector = false
): string {
  const p1 = edgePoint(x1, y1, w1, h1, x2, y2);
  const p2 = edgePoint(x2, y2, w2, h2, x1, y1);
  if (isConnector) {
    const mx = (p1.x + p2.x) / 2;
    const cy1 = p1.y - (p2.y - p1.y) * 0.25;
    const cy2 = p2.y + (p2.y - p1.y) * 0.25;
    return `M${p1.x},${p1.y} C${mx},${cy1} ${mx},${cy2} ${p2.x},${p2.y}`;
  }
  const dx = (p2.x - p1.x) * 0.45;
  return `M${p1.x},${p1.y} C${p1.x + dx},${p1.y} ${p2.x - dx},${p2.y} ${p2.x},${p2.y}`;
}

// ─── Node dimensions helper ─────────────────────────────────────────────────

function getNodeDims(node: MindMapNode, nodes: MindMapNode[]): { w: number; h: number } {
  const isRoot = !node.parentId;
  const w = isRoot ? 170 : Math.max(90, Math.min(150, node.text.length * 8 + 32));
  const h = isRoot ? 54 : 38;
  return { w, h };
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function MindMap() {
  const { t } = useI18n();
  const { printView, exportToExcel, exportToCSV } = useExport();

  // Data state
  const [data, setData] = useState<MindMapData>({
    title: "",
    description: "",
    nodes: getInitialNodes(t),
    connectors: [],
  });
  const [savedMaps, setSavedMaps] = useState<SavedMindMap[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [showList, setShowList] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout>>();

  // Confirm dialog
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // Canvas state
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 1200, h: 800 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  // Interaction state
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [connectMode, setConnectMode] = useState<{ fromId: string } | null>(null);
  const [editingConnectorId, setEditingConnectorId] = useState<string | null>(null);
  const [connectorLabel, setConnectorLabel] = useState("");
  const [colorPicker, setColorPicker] = useState<string | null>(null);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const flash = useCallback((type: "ok" | "err", msg: string) => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    setFeedback({ type, msg });
    feedbackTimer.current = setTimeout(() => setFeedback(null), 3000);
  }, []);

  const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");

  // ── Load / Save ────────────────────────────────────────────────────────────

  useEffect(() => {
    loadList();
  }, []);

  const loadList = useCallback(async () => {
    try {
      const res = await advancedLeanApi.listMindMaps?.();
      if (res?.data) setSavedMaps(res.data);
    } catch {
      // API might not exist yet
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!data.title.trim()) {
      flash("err", t("improvement.mindmapTitleRequired") || "Please enter a title");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: data.title,
        description: data.description,
        nodes: data.nodes as unknown as Record<string, unknown>[],
        connectors: data.connectors as unknown as Record<string, unknown>[],
      };
      if (activeId) {
        await advancedLeanApi.updateMindMap?.(activeId, payload);
      } else {
        const res = await advancedLeanApi.createMindMap?.(payload);
        if (res?.data?.id) setActiveId(res.data.id);
      }
      flash("ok", t("improvement.mindmapSaved") || "Mind map saved");
      loadList();
    } catch (err: unknown) {
      flash("err", getErrorMessage(err, t("improvement.mindmapSaveError") || "Save failed"));
    } finally {
      setSaving(false);
    }
  }, [data, activeId, t, flash, loadList]);

  const loadMap = useCallback((map: SavedMindMap) => {
    setData({
      title: map.title,
      description: map.description || "",
      nodes: map.nodes || [],
      connectors: map.connectors || [],
    });
    setActiveId(map.id);
    setShowList(false);
    setSelectedNodeId(null);
    setConnectMode(null);
  }, []);

  const handleNew = useCallback(() => {
    setData({
      title: "",
      description: "",
      nodes: getInitialNodes(t),
      connectors: [],
    });
    setActiveId(null);
    setSelectedNodeId(null);
    setConnectMode(null);
    setShowList(false);
  }, [t]);

  const handleDelete = useCallback(async (id: number) => {
    try {
      await advancedLeanApi.deleteMindMap?.(id);
      flash("ok", t("improvement.mindmapDeleted") || "Deleted");
      if (activeId === id) handleNew();
      loadList();
    } catch {
      flash("err", t("improvement.mindmapDeleteError") || "Delete failed");
    }
  }, [activeId, handleNew, loadList, flash, t]);

  // ── SVG coordinate conversion ─────────────────────────────────────────────

  const clientToSvg = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: clientX, y: clientY };
    const rect = svg.getBoundingClientRect();
    const x = viewBox.x + ((clientX - rect.left) / rect.width) * viewBox.w;
    const y = viewBox.y + ((clientY - rect.top) / rect.height) * viewBox.h;
    return { x, y };
  }, [viewBox]);

  // ── Node Operations ───────────────────────────────────────────────────────

  const addChild = useCallback((parentId: string) => {
    const parent = data.nodes.find((n) => n.id === parentId);
    if (!parent) return;

    const siblings = data.nodes.filter((n) => n.parentId === parentId);
    const angleBase = parent.parentId ? Math.atan2(parent.y - (data.nodes.find((n) => n.id === parent.parentId)?.y || parent.y), parent.x - (data.nodes.find((n) => n.id === parent.parentId)?.x || parent.x)) : 0;
    const spreadAngle = Math.PI / 3;
    const angle = angleBase - spreadAngle / 2 + (spreadAngle / Math.max(siblings.length, 1)) * siblings.length;
    const depth = getDepth(parent.id, data.nodes);
    const distance = depth === 0 ? 200 : 160;

    const colorIdx = (NODE_COLORS.findIndex((c) => c.id === parent.color) + siblings.length + 1) % NODE_COLORS.length;

    const newNode: MindMapNode = {
      id: genId(),
      text: t("improvement.mindmapNewNode") || "New idea",
      x: parent.x + Math.cos(angle) * distance,
      y: parent.y + Math.sin(angle) * distance,
      color: depth === 0 ? NODE_COLORS[colorIdx].id : parent.color,
      parentId: parentId,
    };

    setData((prev) => ({ ...prev, nodes: [...prev.nodes, newNode] }));
    setSelectedNodeId(newNode.id);
    setEditingNodeId(newNode.id);
    setEditText(newNode.text);
  }, [data.nodes, t]);

  const deleteNode = useCallback((nodeId: string) => {
    const node = data.nodes.find((n) => n.id === nodeId);
    if (!node || !node.parentId) return; // Can't delete root

    // Find all descendant IDs
    const toRemove = new Set<string>();
    const queue = [nodeId];
    while (queue.length) {
      const id = queue.shift()!;
      toRemove.add(id);
      data.nodes.filter((n) => n.parentId === id).forEach((n) => queue.push(n.id));
    }

    setData((prev) => ({
      ...prev,
      nodes: prev.nodes.filter((n) => !toRemove.has(n.id)),
      connectors: prev.connectors.filter((c) => !toRemove.has(c.fromId) && !toRemove.has(c.toId)),
    }));
    setSelectedNodeId(null);
  }, [data.nodes]);

  const updateNodeText = useCallback((nodeId: string, text: string) => {
    setData((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => (n.id === nodeId ? { ...n, text } : n)),
    }));
  }, []);

  const updateNodeColor = useCallback((nodeId: string, color: string) => {
    // Also update all descendants
    const toUpdate = new Set<string>();
    const queue = [nodeId];
    while (queue.length) {
      const id = queue.shift()!;
      toUpdate.add(id);
      data.nodes.filter((n) => n.parentId === id).forEach((n) => queue.push(n.id));
    }
    // Don't recolor root
    const node = data.nodes.find((n) => n.id === nodeId);
    if (node && !node.parentId) {
      toUpdate.delete(nodeId);
      // Only update the node itself
      setData((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) => (n.id === nodeId ? { ...n, color } : n)),
      }));
    } else {
      setData((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) => (toUpdate.has(n.id) ? { ...n, color } : n)),
      }));
    }
    setColorPicker(null);
  }, [data.nodes]);

  const toggleCollapse = useCallback((nodeId: string) => {
    setData((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => (n.id === nodeId ? { ...n, collapsed: !n.collapsed } : n)),
    }));
  }, []);

  // ── Connector Operations ──────────────────────────────────────────────────

  const addConnector = useCallback((fromId: string, toId: string) => {
    if (fromId === toId) return;
    // Don't duplicate
    const exists = data.connectors.some(
      (c) => (c.fromId === fromId && c.toId === toId) || (c.fromId === toId && c.toId === fromId)
    );
    if (exists) return;
    // Don't add if there's already a parent-child link
    const fromNode = data.nodes.find((n) => n.id === fromId);
    const toNode = data.nodes.find((n) => n.id === toId);
    if (fromNode?.parentId === toId || toNode?.parentId === fromId) return;

    const newConnector: MindMapConnector = {
      id: "c" + genId(),
      fromId,
      toId,
      label: "",
      color: getNodeColor(fromNode?.color || "indigo").hex,
    };
    setData((prev) => ({ ...prev, connectors: [...prev.connectors, newConnector] }));
  }, [data.connectors, data.nodes]);

  const deleteConnector = useCallback((connectorId: string) => {
    setData((prev) => ({
      ...prev,
      connectors: prev.connectors.filter((c) => c.id !== connectorId),
    }));
    setEditingConnectorId(null);
  }, []);

  const updateConnectorLabel = useCallback((connectorId: string, label: string) => {
    setData((prev) => ({
      ...prev,
      connectors: prev.connectors.map((c) => (c.id === connectorId ? { ...c, label } : c)),
    }));
  }, []);

  // ── Drag & Pan Handlers ───────────────────────────────────────────────────

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      // Middle-click or Alt+click = pan
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      e.preventDefault();
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      const dx = (e.clientX - panStart.x) * (viewBox.w / (containerRef.current?.clientWidth || 1));
      const dy = (e.clientY - panStart.y) * (viewBox.h / (containerRef.current?.clientHeight || 1));
      setViewBox((prev) => ({ ...prev, x: prev.x - dx, y: prev.y - dy }));
      setPanStart({ x: e.clientX, y: e.clientY });
    }
    if (draggingNodeId) {
      const pos = clientToSvg(e.clientX, e.clientY);
      setData((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) =>
          n.id === draggingNodeId ? { ...n, x: pos.x - dragOffset.x, y: pos.y - dragOffset.y } : n
        ),
      }));
    }
  }, [isPanning, panStart, viewBox, draggingNodeId, dragOffset, clientToSvg]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    setDraggingNodeId(null);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.1 : 0.9;
    const newZoom = Math.max(0.3, Math.min(3, zoom * factor));
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mx = viewBox.x + ((e.clientX - rect.left) / rect.width) * viewBox.w;
    const my = viewBox.y + ((e.clientY - rect.top) / rect.height) * viewBox.h;
    const newW = 1200 / newZoom;
    const newH = 800 / newZoom;
    setViewBox({
      x: mx - (mx - viewBox.x) * (newW / viewBox.w),
      y: my - (my - viewBox.y) * (newH / viewBox.h),
      w: newW,
      h: newH,
    });
    setZoom(newZoom);
  }, [zoom, viewBox]);

  const handleNodeMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    if (connectMode) {
      addConnector(connectMode.fromId, nodeId);
      setConnectMode(null);
      return;
    }
    const pos = clientToSvg(e.clientX, e.clientY);
    const node = data.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    setDraggingNodeId(nodeId);
    setDragOffset({ x: pos.x - node.x, y: pos.y - node.y });
    setSelectedNodeId(nodeId);
    setEditingConnectorId(null);
    setColorPicker(null);
  }, [connectMode, addConnector, clientToSvg, data.nodes]);

  const handleNodeDoubleClick = useCallback((nodeId: string) => {
    const node = data.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    setEditingNodeId(nodeId);
    setEditText(node.text);
  }, [data.nodes]);

  const commitEdit = useCallback(() => {
    if (editingNodeId && editText.trim()) {
      updateNodeText(editingNodeId, editText.trim());
    }
    setEditingNodeId(null);
  }, [editingNodeId, editText, updateNodeText]);

  const commitConnectorEdit = useCallback(() => {
    if (editingConnectorId) {
      updateConnectorLabel(editingConnectorId, connectorLabel);
    }
    setEditingConnectorId(null);
  }, [editingConnectorId, connectorLabel, updateConnectorLabel]);

  // ── Visible nodes (considering collapsed branches) ────────────────────────

  const visibleNodeIds = useMemo(() => {
    const hidden = new Set<string>();
    data.nodes.forEach((node) => {
      if (node.collapsed) {
        // Hide all descendants
        const queue = data.nodes.filter((n) => n.parentId === node.id).map((n) => n.id);
        while (queue.length) {
          const id = queue.shift()!;
          hidden.add(id);
          data.nodes.filter((n) => n.parentId === id).forEach((n) => queue.push(n.id));
        }
      }
    });
    return new Set(data.nodes.filter((n) => !hidden.has(n.id)).map((n) => n.id));
  }, [data.nodes]);

  const visibleNodes = useMemo(() => data.nodes.filter((n) => visibleNodeIds.has(n.id)), [data.nodes, visibleNodeIds]);

  // ── Auto-fit view ─────────────────────────────────────────────────────────

  const fitView = useCallback(() => {
    if (!visibleNodes.length) return;
    const padding = 150;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    visibleNodes.forEach((n) => {
      minX = Math.min(minX, n.x - 80);
      maxX = Math.max(maxX, n.x + 80);
      minY = Math.min(minY, n.y - 30);
      maxY = Math.max(maxY, n.y + 30);
    });
    setViewBox({
      x: minX - padding,
      y: minY - padding,
      w: Math.max(maxX - minX + padding * 2, 400),
      h: Math.max(maxY - minY + padding * 2, 300),
    });
  }, [visibleNodes]);

  // ── Keyboard ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (editingNodeId || editingConnectorId) {
        if (e.key === "Enter") {
          e.preventDefault();
          if (editingNodeId) commitEdit();
          if (editingConnectorId) commitConnectorEdit();
        }
        if (e.key === "Escape") {
          setEditingNodeId(null);
          setEditingConnectorId(null);
        }
        return;
      }
      if (e.key === "Escape") {
        setConnectMode(null);
        setSelectedNodeId(null);
        setColorPicker(null);
      }
      if (e.key === "Delete" && selectedNodeId) {
        deleteNode(selectedNodeId);
      }
      if (e.key === "Tab" && selectedNodeId) {
        e.preventDefault();
        addChild(selectedNodeId);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editingNodeId, editingConnectorId, selectedNodeId, commitEdit, commitConnectorEdit, deleteNode, addChild]);

  // ── Selected node info ────────────────────────────────────────────────────

  const selectedNode = data.nodes.find((n) => n.id === selectedNodeId);
  const hasChildren = (nodeId: string) => data.nodes.some((n) => n.parentId === nodeId);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col" data-print-area="true">
      {/* Top Bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-th-border bg-th-bg-2 shadow-sm flex-shrink-0 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Brain className="w-5 h-5 text-th-accent" />
          <input
            type="text"
            value={data.title}
            onChange={(e) => setData((prev) => ({ ...prev, title: e.target.value }))}
            placeholder={t("improvement.mindmapTitlePlaceholder") || "Mind map title..."}
            className="flex-1 bg-transparent text-lg font-semibold text-th-text border-none outline-none placeholder:text-th-text-3"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Zoom controls */}
          <div className="flex items-center gap-1 bg-th-bg-3 rounded-lg px-2 py-1">
            <button onClick={() => { setZoom((z) => Math.min(3, z * 1.2)); setViewBox((v) => ({ ...v, w: v.w / 1.2, h: v.h / 1.2 })); }} className="text-th-text-2 hover:text-th-text p-0.5" aria-label={t("common.zoomIn")}><ZoomIn className="w-3.5 h-3.5" /></button>
            <span className="text-xs text-th-text-3 min-w-[40px] text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => { setZoom((z) => Math.max(0.3, z / 1.2)); setViewBox((v) => ({ ...v, w: v.w * 1.2, h: v.h * 1.2 })); }} className="text-th-text-2 hover:text-th-text p-0.5" aria-label={t("common.zoomOut")}><ZoomOut className="w-3.5 h-3.5" /></button>
          </div>
          <button onClick={fitView} className="px-2.5 py-1.5 text-th-text-2 bg-th-bg-3 rounded-lg hover:bg-th-bg-hover transition" title={t("improvement.mindmapFitView") || "Fit view"}>
            <Maximize className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-6 bg-th-border" />

          {/* Actions */}
          <button onClick={handleNew} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-th-text-2 bg-th-bg-3 rounded-lg hover:bg-th-bg-hover transition">
            <FilePlus className="w-3.5 h-3.5" />
            {t("improvement.mindmapNew") || "New"}
          </button>
          <button onClick={() => setShowList(!showList)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-th-text-2 bg-th-bg-3 rounded-lg hover:bg-th-bg-hover transition">
            <FolderOpen className="w-3.5 h-3.5" />
            {t("improvement.mindmapLoad") || "Load"} {savedMaps.length > 0 && `(${savedMaps.length})`}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-th-accent rounded-lg hover:bg-th-accent-hover transition disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? "..." : (t("improvement.mindmapSave") || "Save")}
          </button>

          <ExportToolbar
            onPrint={() => printView({ title: data.title || "Mind Map" })}
            onExportExcel={() =>
              exportToExcel({
                filename: "mindmap_" + (data.title || "export"),
                sheetName: "MindMap",
                columns: [
                  { key: "text", header: "Node", width: 30 },
                  { key: "parent", header: "Parent", width: 30 },
                  { key: "connections", header: "Cross-connections", width: 40 },
                ],
                rows: data.nodes.map((n) => ({
                  text: n.text,
                  parent: data.nodes.find((p) => p.id === n.parentId)?.text || "(root)",
                  connections: data.connectors
                    .filter((c) => c.fromId === n.id || c.toId === n.id)
                    .map((c) => {
                      const other = c.fromId === n.id ? c.toId : c.fromId;
                      const otherNode = data.nodes.find((nn) => nn.id === other);
                      return otherNode?.text || "";
                    })
                    .join(", "),
                })),
              })
            }
            onExportCSV={() =>
              exportToCSV({
                filename: "mindmap_" + (data.title || "export"),
                columns: [
                  { key: "text", header: "Node" },
                  { key: "parent", header: "Parent" },
                  { key: "depth", header: "Depth" },
                ],
                rows: data.nodes.map((n) => ({
                  text: n.text,
                  parent: data.nodes.find((p) => p.id === n.parentId)?.text || "(root)",
                  depth: getDepth(n.id, data.nodes),
                })),
              })
            }
          />
        </div>
      </div>

      {/* Feedback toast */}
      {feedback && (
        <div className={`mx-4 mt-2 px-4 py-2 rounded-lg text-sm font-medium animate-slide-in ${
          feedback.type === "ok"
            ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
            : "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
        }`}>
          {feedback.msg}
        </div>
      )}

      {/* Saved maps dropdown */}
      {showList && (
        <div className="mx-4 mt-2 rounded-xl border border-th-border bg-th-bg-2 shadow-sm max-h-48 overflow-y-auto">
          {savedMaps.length === 0 ? (
            <p className="p-3 text-sm text-th-text-3 text-center">{t("improvement.mindmapNoSaved") || "No saved mind maps"}</p>
          ) : (
            savedMaps.map((m) => (
              <div key={m.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-th-bg-3 transition border-b border-th-border last:border-b-0">
                <button onClick={() => loadMap(m)} className="flex-1 text-left">
                  <span className="text-sm font-medium text-th-text">{m.title}</span>
                  <span className="text-xs text-th-text-3 ml-2">{new Date(m.created_at).toLocaleDateString()}</span>
                </button>
                <button onClick={() => setConfirmDeleteId(m.id)} className="text-red-500 hover:text-red-600 ml-2 p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition" aria-label={t("improvement.mindmapDelete")}><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Toolbar for selected node */}
      {selectedNode && !editingNodeId && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-th-border bg-th-bg flex-shrink-0 flex-wrap">
          <span className="text-xs text-th-text-3">{t("improvement.mindmapSelected") || "Selected"}:</span>
          <span className="text-sm font-medium text-th-text truncate max-w-[200px]">{selectedNode.text}</span>
          <div className="w-px h-5 bg-th-border" />
          <button onClick={() => addChild(selectedNode.id)} className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition border border-emerald-200 dark:border-emerald-800" title="Tab">
            <Plus className="w-3.5 h-3.5" /> {t("improvement.mindmapAddChild") || "Add child"}
          </button>
          <button
            onClick={() => { setConnectMode({ fromId: selectedNode.id }); }}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition border ${
              connectMode?.fromId === selectedNode.id
                ? "text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/40 border-indigo-300 dark:border-indigo-700"
                : "text-th-text-2 bg-th-bg-3 border-th-border hover:bg-th-bg-hover"
            }`}
          >
            <Link className="w-3.5 h-3.5" /> {t("improvement.mindmapConnect") || "Connect"}
          </button>
          <button onClick={() => handleNodeDoubleClick(selectedNode.id)} className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-th-text-2 bg-th-bg-3 rounded-lg hover:bg-th-bg-hover transition border border-th-border">
            <Edit3 className="w-3.5 h-3.5" /> {t("improvement.mindmapEdit") || "Edit"}
          </button>
          <button onClick={() => setColorPicker(colorPicker === selectedNode.id ? null : selectedNode.id)} className="px-2.5 py-1 text-th-text-2 bg-th-bg-3 rounded-lg hover:bg-th-bg-hover transition border border-th-border">
            <Palette className="w-3.5 h-3.5" />
          </button>
          {hasChildren(selectedNode.id) && (
            <button onClick={() => toggleCollapse(selectedNode.id)} className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-th-text-2 bg-th-bg-3 rounded-lg hover:bg-th-bg-hover transition border border-th-border">
              {selectedNode.collapsed ? <><ChevronRight className="w-3.5 h-3.5" /> Expand</> : <><ChevronDown className="w-3.5 h-3.5" /> Collapse</>}
            </button>
          )}
          {selectedNode.parentId && (
            <button onClick={() => deleteNode(selectedNode.id)} className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition border border-red-200 dark:border-red-800" title="Delete">
              <Trash2 className="w-3.5 h-3.5" /> {t("improvement.mindmapDelete") || "Delete"}
            </button>
          )}

          {/* Color picker */}
          {colorPicker === selectedNode.id && (
            <div className="flex items-center gap-1 ml-1 p-1 bg-th-bg-2 border border-th-border rounded-lg">
              {NODE_COLORS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => updateNodeColor(selectedNode.id, c.id)}
                  className={`w-5 h-5 rounded-full border-2 transition ${
                    selectedNode.color === c.id ? "border-th-text scale-125" : "border-transparent hover:scale-110"
                  }`}
                  style={{ backgroundColor: isDark ? c.hexDark : c.hex }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Connect mode banner */}
      {connectMode && (
        <div className="px-4 py-2 bg-indigo-50 dark:bg-indigo-950/30 border-b border-indigo-200 dark:border-indigo-800 text-sm text-indigo-700 dark:text-indigo-300 flex items-center gap-2 flex-shrink-0">
          <Link className="w-4 h-4" />
          <span>{t("improvement.mindmapClickToConnect") || "Click another node to create a cross-connection"}</span>
          <button onClick={() => setConnectMode(null)} className="ml-auto text-xs px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 rounded hover:bg-indigo-200 dark:hover:bg-indigo-800/40">
            {t("improvement.mindmapCancel") || "Cancel"}
          </button>
        </div>
      )}

      {/* Canvas */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden bg-th-bg cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg
          ref={svgRef}
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
          className="w-full h-full"
          style={{ minHeight: "500px" }}
          onWheel={handleWheel}
        >
          {/* Grid dots */}
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <circle cx="20" cy="20" r="0.8" className="fill-th-border" opacity="0.4" />
            </pattern>
          </defs>
          <rect x={viewBox.x - 2000} y={viewBox.y - 2000} width={viewBox.w + 4000} height={viewBox.h + 4000} fill="url(#grid)" />

          {/* Parent-child branches */}
          {visibleNodes.map((node) => {
            if (!node.parentId) return null;
            const parent = data.nodes.find((n) => n.id === node.parentId);
            if (!parent || !visibleNodeIds.has(parent.id)) return null;
            const nc = getNodeColor(node.color);
            const pDims = getNodeDims(parent, data.nodes);
            const nDims = getNodeDims(node, data.nodes);
            const depth = getDepth(node.id, data.nodes);
            return (
              <path
                key={`branch-${node.id}`}
                d={curvePath(parent.x, parent.y, pDims.w, pDims.h, node.x, node.y, nDims.w, nDims.h)}
                fill="none"
                stroke={isDark ? nc.hexDark : nc.hex}
                strokeWidth={Math.max(1.5, 3.5 - depth * 0.6)}
                strokeLinecap="round"
                opacity={0.75}
              />
            );
          })}

          {/* Cross-branch connectors (dashed, curved) */}
          {data.connectors.map((conn) => {
            const from = data.nodes.find((n) => n.id === conn.fromId);
            const to = data.nodes.find((n) => n.id === conn.toId);
            if (!from || !to || !visibleNodeIds.has(from.id) || !visibleNodeIds.has(to.id)) return null;
            const fDims = getNodeDims(from, data.nodes);
            const tDims = getNodeDims(to, data.nodes);
            const mx = (from.x + to.x) / 2;
            const my = (from.y + to.y) / 2;
            const isSelected = editingConnectorId === conn.id;
            const ep = edgePoint(to.x, to.y, tDims.w, tDims.h, from.x, from.y);
            return (
              <g key={`conn-${conn.id}`}>
                <path
                  d={curvePath(from.x, from.y, fDims.w, fDims.h, to.x, to.y, tDims.w, tDims.h, true)}
                  fill="none"
                  stroke={conn.color || "#6366f1"}
                  strokeWidth={isSelected ? 3 : 2}
                  strokeDasharray="8,4"
                  strokeLinecap="round"
                  opacity={isSelected ? 1 : 0.6}
                  style={{ cursor: "pointer" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingConnectorId(conn.id);
                    setConnectorLabel(conn.label);
                    setSelectedNodeId(null);
                  }}
                />
                {/* Arrow head */}
                <circle cx={ep.x} cy={ep.y} r={4} fill={conn.color || "#6366f1"} opacity={0.8} />
                {/* Label */}
                {conn.label && (
                  <g>
                    <rect x={mx - conn.label.length * 3.5 - 6} y={my - 18} width={conn.label.length * 7 + 12} height={18} rx={4} fill={isDark ? "#1e293b" : "#ffffff"} stroke={conn.color || "#6366f1"} strokeWidth={1} opacity={0.9} />
                    <text x={mx} y={my - 7} textAnchor="middle" dominantBaseline="central" className="text-[10px] font-medium pointer-events-none" fill={conn.color || "#6366f1"}>
                      {conn.label}
                    </text>
                  </g>
                )}
                {/* Click area for label editing */}
                <rect
                  x={mx - 30}
                  y={my - 20}
                  width={60}
                  height={24}
                  fill="transparent"
                  style={{ cursor: "pointer" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingConnectorId(conn.id);
                    setConnectorLabel(conn.label);
                  }}
                />
              </g>
            );
          })}

          {/* Nodes */}
          {visibleNodes.map((node) => {
            const nc = getNodeColor(node.color);
            const isRoot = !node.parentId;
            const isSelected = selectedNodeId === node.id;
            const isEditing = editingNodeId === node.id;
            const depth = getDepth(node.id, data.nodes);
            const dims = getNodeDims(node, data.nodes);
            const nodeW = dims.w;
            const nodeH = dims.h;
            const childCount = data.nodes.filter((n) => n.parentId === node.id).length;
            const fillColor = isDark ? "#1e293b" : "#ffffff";
            const borderColor = isDark ? nc.hexDark : nc.hex;

            return (
              <g
                key={node.id}
                onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                onDoubleClick={() => handleNodeDoubleClick(node.id)}
                style={{ cursor: "pointer" }}
              >
                {/* Shadow */}
                <rect
                  x={node.x - nodeW / 2 + 2}
                  y={node.y - nodeH / 2 + 3}
                  width={nodeW}
                  height={nodeH}
                  rx={isRoot ? 16 : 10}
                  fill={isDark ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.08)"}
                />

                {/* Node background — solid white/dark with colored border */}
                <rect
                  x={node.x - nodeW / 2}
                  y={node.y - nodeH / 2}
                  width={nodeW}
                  height={nodeH}
                  rx={isRoot ? 16 : 10}
                  fill={fillColor}
                  stroke={borderColor}
                  strokeWidth={isSelected ? 3 : isRoot ? 2.5 : 2}
                />

                {/* Colored accent bar on left side */}
                {!isRoot && (
                  <rect
                    x={node.x - nodeW / 2}
                    y={node.y - nodeH / 2 + 4}
                    width={4}
                    height={nodeH - 8}
                    rx={2}
                    fill={borderColor}
                  />
                )}

                {/* Root node gradient accent */}
                {isRoot && (
                  <rect
                    x={node.x - nodeW / 2 + 1}
                    y={node.y - nodeH / 2 + 1}
                    width={nodeW - 2}
                    height={nodeH - 2}
                    rx={15}
                    fill={isDark ? `${nc.hexDark}15` : `${nc.hex}10`}
                  />
                )}

                {/* Selected glow ring */}
                {isSelected && (
                  <rect
                    x={node.x - nodeW / 2 - 4}
                    y={node.y - nodeH / 2 - 4}
                    width={nodeW + 8}
                    height={nodeH + 8}
                    rx={isRoot ? 20 : 14}
                    fill="none"
                    stroke={borderColor}
                    strokeWidth={2}
                    opacity={0.3}
                    strokeDasharray="6,3"
                  >
                    <animate attributeName="stroke-dashoffset" values="0;9" dur="1.5s" repeatCount="indefinite" />
                  </rect>
                )}

                {/* Connect mode target highlight */}
                {connectMode && connectMode.fromId !== node.id && (
                  <rect
                    x={node.x - nodeW / 2 - 4}
                    y={node.y - nodeH / 2 - 4}
                    width={nodeW + 8}
                    height={nodeH + 8}
                    rx={isRoot ? 20 : 14}
                    fill="none"
                    stroke="#6366f1"
                    strokeWidth={2}
                    strokeDasharray="4,4"
                    opacity={0.6}
                  >
                    <animate attributeName="stroke-dashoffset" values="0;8" dur="0.8s" repeatCount="indefinite" />
                  </rect>
                )}

                {/* Text */}
                {isEditing ? (
                  <foreignObject x={node.x - nodeW / 2 + 4} y={node.y - nodeH / 2 + 2} width={nodeW - 8} height={nodeH - 4}>
                    <input
                      autoFocus
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitEdit();
                        if (e.key === "Escape") setEditingNodeId(null);
                      }}
                      className="w-full h-full bg-th-bg text-center text-sm border-none outline-none rounded px-1"
                      style={{ color: isDark ? nc.hexDark : nc.hex }}
                    />
                  </foreignObject>
                ) : (
                  <text
                    x={node.x + (isRoot ? 0 : 4)}
                    y={node.y + 1}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className={`pointer-events-none select-none ${isRoot ? "text-[14px] font-bold" : depth === 1 ? "text-[12px] font-semibold" : "text-[11px] font-medium"}`}
                    fill={isDark ? (isRoot ? nc.hexDark : "#e2e8f0") : (isRoot ? nc.hex : "#1e293b")}
                  >
                    {node.text.length > 18 ? node.text.slice(0, 16) + "…" : node.text}
                  </text>
                )}

                {/* Collapse indicator */}
                {node.collapsed && childCount > 0 && (
                  <g>
                    <circle cx={node.x + nodeW / 2 + 2} cy={node.y} r={10} fill={borderColor} />
                    <text x={node.x + nodeW / 2 + 2} y={node.y + 1} textAnchor="middle" dominantBaseline="central" className="text-[9px] font-bold" fill="white">
                      {childCount}
                    </text>
                  </g>
                )}

                {/* Quick add button */}
                {isSelected && !connectMode && (
                  <g onClick={(e) => { e.stopPropagation(); addChild(node.id); }} className="cursor-pointer">
                    <circle cx={node.x + nodeW / 2 + 14} cy={node.y} r={11} fill={borderColor} />
                    <text x={node.x + nodeW / 2 + 14} y={node.y + 1} textAnchor="middle" dominantBaseline="central" className="text-[14px] font-bold" fill="white">+</text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* Connector editing overlay */}
        {editingConnectorId && (
          <div className="absolute top-4 right-4 rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-4 w-64 z-10">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-th-text">{t("improvement.mindmapConnectorLabel") || "Connection label"}</span>
              <button onClick={() => setEditingConnectorId(null)} className="text-th-text-3 hover:text-th-text p-0.5 rounded-lg hover:bg-th-bg-3 transition" aria-label={t("improvement.mindmapCancel")}><X className="w-4 h-4" /></button>
            </div>
            <input
              autoFocus
              value={connectorLabel}
              onChange={(e) => setConnectorLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") commitConnectorEdit(); }}
              placeholder={t("improvement.mindmapLabelPlaceholder") || "e.g., relates to, causes..."}
              className="w-full px-3 py-2 text-sm bg-th-bg border border-th-border rounded-lg text-th-text outline-none focus:border-th-accent"
            />
            <div className="flex gap-2 mt-3">
              <button onClick={commitConnectorEdit} className="flex-1 px-3 py-1.5 text-xs font-semibold text-white bg-th-accent rounded-lg hover:bg-th-accent-hover transition">
                {t("improvement.mindmapApply") || "Apply"}
              </button>
              <button onClick={() => deleteConnector(editingConnectorId)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition">
                <Trash2 className="w-3 h-3" /> {t("improvement.mindmapRemove") || "Remove"}
              </button>
            </div>
          </div>
        )}

        {/* Help hint */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 text-[10px] text-th-text-3 bg-th-bg-2/80 backdrop-blur px-2.5 py-1.5 rounded-lg border border-th-border">
          <HelpCircle className="w-3 h-3 flex-shrink-0" />
          {t("improvement.mindmapHelp") || "Double-click to edit • Tab to add child • Drag to move • Scroll to zoom • Alt+drag to pan"}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title={t("common.confirmDelete")}
        message={t("improvement.confirmDeleteMindmap")}
        variant="danger"
        onConfirm={() => {
          if (confirmDeleteId !== null) handleDelete(confirmDeleteId);
          setConfirmDeleteId(null);
        }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}

// ── Utility ──────────────────────────────────────────────────────────────────

function getDepth(nodeId: string, nodes: MindMapNode[]): number {
  let depth = 0;
  let current = nodes.find((n) => n.id === nodeId);
  while (current?.parentId) {
    depth++;
    current = nodes.find((n) => n.id === current!.parentId);
  }
  return depth;
}
