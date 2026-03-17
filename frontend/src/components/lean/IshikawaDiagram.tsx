"use client";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useI18n } from "@/stores/useI18n";
import { leanApi } from "@/lib/api";
import { useExport } from "@/hooks/useExport";
import ExportToolbar from "@/components/ui/ExportToolbar";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SubCause {
  text: string;
  isRoot: boolean;
}

interface Cause {
  text: string;
  isRoot: boolean;
  subCauses: SubCause[];
}

interface IshikawaData {
  title: string;
  effect: string;
  categories: Record<CategoryKey, Cause[]>;
  notes: string;
}

interface SavedIshikawa extends IshikawaData {
  id: number;
  created_at?: string;
  updated_at?: string;
}

interface Toast {
  type: "success" | "error";
  message: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const CATEGORIES = [
  { key: "man",         labelKey: "man",         stroke: "#3b82f6", fill: "#dbeafe", darkFill: "#1e3a5f", lightBg: "#eff6ff",   darkBg: "#1e3a5f80" },
  { key: "machine",     labelKey: "machine",     stroke: "#8b5cf6", fill: "#ede9fe", darkFill: "#3b1f5e", lightBg: "#f5f3ff",   darkBg: "#3b1f5e80" },
  { key: "method",      labelKey: "method",      stroke: "#14b8a6", fill: "#ccfbf1", darkFill: "#134e4a", lightBg: "#f0fdfa",   darkBg: "#134e4a80" },
  { key: "material",    labelKey: "material",    stroke: "#f59e0b", fill: "#fef3c7", darkFill: "#4a3d0a", lightBg: "#fffbeb",   darkBg: "#4a3d0a80" },
  { key: "measurement", labelKey: "measurement", stroke: "#f43f5e", fill: "#ffe4e6", darkFill: "#4c0519", lightBg: "#fff1f2",   darkBg: "#4c051980" },
  { key: "environment", labelKey: "environment", stroke: "#22c55e", fill: "#dcfce7", darkFill: "#14532d", lightBg: "#f0fdf4",   darkBg: "#14532d80" },
] as const;

type CategoryKey = (typeof CATEGORIES)[number]["key"];

// Top bones: Man, Material, Method  |  Bottom bones: Machine, Measurement, Environment
const UPPER_KEYS: CategoryKey[] = ["man", "material", "method"];
const LOWER_KEYS: CategoryKey[] = ["machine", "measurement", "environment"];

const TOAST_DURATION_MS = 4000;

const CATEGORY_BADGE_CLASSES: Record<CategoryKey, string> = {
  man:         "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  machine:     "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  method:      "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
  material:    "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  measurement: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  environment: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
};

const CATEGORY_CARD_CLASSES: Record<CategoryKey, string> = {
  man:         "bg-blue-50/80 border-blue-200/60 dark:bg-blue-500/5 dark:border-blue-500/15 hover:border-blue-300 dark:hover:border-blue-500/30",
  machine:     "bg-purple-50/80 border-purple-200/60 dark:bg-purple-500/5 dark:border-purple-500/15 hover:border-purple-300 dark:hover:border-purple-500/30",
  method:      "bg-teal-50/80 border-teal-200/60 dark:bg-teal-500/5 dark:border-teal-500/15 hover:border-teal-300 dark:hover:border-teal-500/30",
  material:    "bg-amber-50/80 border-amber-200/60 dark:bg-amber-500/5 dark:border-amber-500/15 hover:border-amber-300 dark:hover:border-amber-500/30",
  measurement: "bg-rose-50/80 border-rose-200/60 dark:bg-rose-500/5 dark:border-rose-500/15 hover:border-rose-300 dark:hover:border-rose-500/30",
  environment: "bg-green-50/80 border-green-200/60 dark:bg-green-500/5 dark:border-green-500/15 hover:border-green-300 dark:hover:border-green-500/30",
};

/* ------------------------------------------------------------------ */
/*  SVG Layout Constants — 1200 x 600 fishbone                        */
/* ------------------------------------------------------------------ */

const SVG_W = 1200;
const SVG_H = 600;
const SPINE_Y = 300;               // horizontal center
const SPINE_X_START = 80;          // tail
const SPINE_X_END = 950;           // where head begins
const HEAD_X = 960;                // fish head box start
const HEAD_W = 210;
const HEAD_H = 80;

// Bone attachment points on spine — 3 evenly spaced
const BONE_ATTACH_X = [250, 500, 750];

// Bone geometry
const BONE_TOP_Y = 60;             // top category labels Y
const BONE_BOTTOM_Y = 540;         // bottom category labels Y
const BONE_TOP_END_Y = 80;         // where top bones end (near label)
const BONE_BOTTOM_END_Y = 520;     // where bottom bones end

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function emptyCause(): Cause {
  return { text: "", isRoot: false, subCauses: [] };
}

function emptyCategories(): Record<CategoryKey, Cause[]> {
  return Object.fromEntries(
    CATEGORIES.map((c) => [c.key, [emptyCause()]])
  ) as Record<CategoryKey, Cause[]>;
}

function emptyForm(): IshikawaData {
  return {
    title: "",
    effect: "",
    categories: emptyCategories(),
    notes: "",
  };
}

function getCatDef(key: CategoryKey) {
  return CATEGORIES.find((c) => c.key === key)!;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function IshikawaDiagram() {
  const { t } = useI18n();
  const { printView, exportToExcel, exportToCSV } = useExport();

  // --- form state ---
  const [title, setTitle] = useState("");
  const [effect, setEffect] = useState("");
  const [categories, setCategories] = useState<Record<CategoryKey, Cause[]>>(emptyCategories);
  const [notes, setNotes] = useState("");

  // --- UI state ---
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [highlightedCategory, setHighlightedCategory] = useState<string | null>(null);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [savedAnalyses, setSavedAnalyses] = useState<SavedIshikawa[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [activeId, setActiveId] = useState<number | null>(null);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- toast helper ---
  const showToast = useCallback((type: Toast["type"], message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, message });
    toastTimer.current = setTimeout(() => setToast(null), TOAST_DURATION_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  // --- load history on mount ---
  const loadHistory = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await leanApi.listIshikawa();
      setSavedAnalyses(res.data ?? []);
    } catch {
      /* silent */
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // --- load a saved analysis ---
  const loadAnalysis = useCallback(
    async (id: number) => {
      try {
        const res = await leanApi.getIshikawa(id);
        const d = res.data as SavedIshikawa;
        setTitle(d.title ?? "");
        setEffect(d.effect ?? "");
        setCategories(d.categories ?? emptyCategories());
        setNotes(d.notes ?? "");
        setActiveId(d.id);
        setShowHistory(false);
        showToast("success", t("problem-solving.loaded") || "Loaded");
      } catch {
        showToast("error", t("problem-solving.loadError") || "Failed to load");
      }
    },
    [t, showToast],
  );

  // --- delete ---
  const deleteAnalysis = useCallback(
    async (id: number) => {
      try {
        await leanApi.deleteIshikawa(id);
        setSavedAnalyses((prev) => prev.filter((a) => a.id !== id));
        if (activeId === id) {
          setTitle("");
          setEffect("");
          setCategories(emptyCategories());
          setNotes("");
          setActiveId(null);
        }
        showToast("success", t("problem-solving.deleted") || "Deleted");
      } catch {
        showToast("error", t("problem-solving.deleteError") || "Delete failed");
      }
    },
    [activeId, t, showToast],
  );

  // --- save ---
  const save = useCallback(async () => {
    if (!title.trim() || !effect.trim()) {
      showToast("error", t("problem-solving.validationError") || "Title and effect are required");
      return;
    }
    setSaving(true);
    try {
      const payload: IshikawaData = { title, effect, categories, notes };
      await leanApi.createIshikawa(payload);
      showToast("success", t("problem-solving.saved") || "Analysis saved");
      loadHistory();
    } catch {
      showToast("error", t("problem-solving.saveError") || "Save failed");
    } finally {
      setSaving(false);
    }
  }, [title, effect, categories, notes, t, showToast, loadHistory]);

  // --- new analysis ---
  const resetForm = useCallback(() => {
    const fresh = emptyForm();
    setTitle(fresh.title);
    setEffect(fresh.effect);
    setCategories(fresh.categories);
    setNotes(fresh.notes);
    setActiveId(null);
    setHighlightedCategory(null);
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Cause mutations                                                  */
  /* ---------------------------------------------------------------- */

  const addCause = useCallback((catKey: CategoryKey) => {
    setCategories((prev) => ({
      ...prev,
      [catKey]: [...prev[catKey], emptyCause()],
    }));
  }, []);

  const updateCauseText = useCallback((catKey: CategoryKey, idx: number, text: string) => {
    setCategories((prev) => {
      const arr = [...prev[catKey]];
      arr[idx] = { ...arr[idx], text };
      return { ...prev, [catKey]: arr };
    });
  }, []);

  const toggleCauseRoot = useCallback((catKey: CategoryKey, idx: number) => {
    setCategories((prev) => {
      const arr = [...prev[catKey]];
      arr[idx] = { ...arr[idx], isRoot: !arr[idx].isRoot };
      return { ...prev, [catKey]: arr };
    });
  }, []);

  const removeCause = useCallback((catKey: CategoryKey, idx: number) => {
    setCategories((prev) => {
      const arr = prev[catKey].filter((_, i) => i !== idx);
      return { ...prev, [catKey]: arr.length > 0 ? arr : [emptyCause()] };
    });
  }, []);

  // --- sub-causes ---
  const addSubCause = useCallback((catKey: CategoryKey, causeIdx: number) => {
    setCategories((prev) => {
      const arr = [...prev[catKey]];
      const cause = { ...arr[causeIdx] };
      cause.subCauses = [...cause.subCauses, { text: "", isRoot: false }];
      arr[causeIdx] = cause;
      return { ...prev, [catKey]: arr };
    });
  }, []);

  const updateSubCauseText = useCallback(
    (catKey: CategoryKey, causeIdx: number, subIdx: number, text: string) => {
      setCategories((prev) => {
        const arr = [...prev[catKey]];
        const cause = { ...arr[causeIdx] };
        const subs = [...cause.subCauses];
        subs[subIdx] = { ...subs[subIdx], text };
        cause.subCauses = subs;
        arr[causeIdx] = cause;
        return { ...prev, [catKey]: arr };
      });
    },
    [],
  );

  const toggleSubCauseRoot = useCallback(
    (catKey: CategoryKey, causeIdx: number, subIdx: number) => {
      setCategories((prev) => {
        const arr = [...prev[catKey]];
        const cause = { ...arr[causeIdx] };
        const subs = [...cause.subCauses];
        subs[subIdx] = { ...subs[subIdx], isRoot: !subs[subIdx].isRoot };
        cause.subCauses = subs;
        arr[causeIdx] = cause;
        return { ...prev, [catKey]: arr };
      });
    },
    [],
  );

  const removeSubCause = useCallback(
    (catKey: CategoryKey, causeIdx: number, subIdx: number) => {
      setCategories((prev) => {
        const arr = [...prev[catKey]];
        const cause = { ...arr[causeIdx] };
        cause.subCauses = cause.subCauses.filter((_, i) => i !== subIdx);
        arr[causeIdx] = cause;
        return { ...prev, [catKey]: arr };
      });
    },
    [],
  );

  const toggleHighlight = useCallback((key: string) => {
    setHighlightedCategory((prev) => (prev === key ? null : key));
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Derived counts                                                   */
  /* ---------------------------------------------------------------- */

  const totalCauses = useMemo(() => {
    return CATEGORIES.reduce((sum, cat) => {
      const causes = categories[cat.key as CategoryKey] ?? [];
      return sum + causes.filter((c) => c.text.trim()).length;
    }, 0);
  }, [categories]);

  const rootCauses = useMemo(() => {
    return CATEGORIES.reduce((sum, cat) => {
      const causes = categories[cat.key as CategoryKey] ?? [];
      return sum + causes.filter((c) => c.isRoot).length + causes.reduce((s, c) => s + c.subCauses.filter((sc) => sc.isRoot).length, 0);
    }, 0);
  }, [categories]);

  /* ---------------------------------------------------------------- */
  /*  SVG Fishbone Bone Renderer                                       */
  /* ---------------------------------------------------------------- */

  const renderBone = useCallback(
    (catKey: CategoryKey, boneIndex: number, side: "upper" | "lower") => {
      const cat = getCatDef(catKey);
      const attachX = BONE_ATTACH_X[boneIndex];
      const dir = side === "upper" ? -1 : 1;

      // The bone goes from the spine diagonally to near the category label
      // Angle: the bone slants backward (toward the tail)
      const endX = attachX - 50;
      const endY = side === "upper" ? BONE_TOP_END_Y : BONE_BOTTOM_END_Y;

      const causesForCat = categories[catKey] ?? [];
      const activeCauses = causesForCat.filter((c) => c.text.trim() !== "");
      const isHighlighted = highlightedCategory === null || highlightedCategory === catKey;
      const isHovered = hoveredCategory === catKey;
      const opacity = isHighlighted ? 1 : 0.12;

      // Category label box position
      const labelCx = endX;
      const labelCy = side === "upper" ? BONE_TOP_Y : BONE_BOTTOM_Y;
      const labelW = 120;
      const labelH = 30;

      // Sub-causes: small horizontal lines branching off the diagonal bone
      const causeElements = activeCauses.map((cause, i) => {
        // Distribute causes evenly along the bone
        const totalSlots = activeCauses.length + 1;
        const frac = (i + 1) / totalSlots;
        // Position along the bone line
        const cx = attachX + (endX - attachX) * frac;
        const cy = SPINE_Y + (endY - SPINE_Y) * frac;

        // Horizontal sub-branch going left
        const branchLen = 70;
        const bx = cx - branchLen;
        const by = cy;

        const isRoot = cause.isRoot;
        const textTrunc = cause.text.length > 24 ? cause.text.slice(0, 22) + "\u2026" : cause.text;

        // Sub-cause tick marks along the cause branch
        const subElements = cause.subCauses
          .filter((s) => s.text.trim())
          .map((sub, si, arr) => {
            const sFrac = arr.length === 1 ? 0.5 : (si + 1) / (arr.length + 1);
            const sx = cx + (bx - cx) * sFrac;
            const sy = by;
            // Small vertical tick
            const tickLen = 35;
            const tickEndY = sy + dir * tickLen;

            return (
              <g key={`sub-${catKey}-${i}-${si}`}>
                <line
                  x1={sx} y1={sy} x2={sx} y2={tickEndY}
                  stroke={sub.isRoot ? "#ef4444" : cat.stroke}
                  strokeWidth={sub.isRoot ? 1.8 : 1}
                  strokeDasharray={sub.isRoot ? "" : "3,2"}
                  strokeLinecap="round"
                />
                <circle cx={sx} cy={sy} r={2} fill={sub.isRoot ? "#ef4444" : cat.stroke} />
                <text
                  x={sx}
                  y={tickEndY + (dir === -1 ? -5 : 13)}
                  textAnchor="middle"
                  fontSize={8}
                  fontFamily="system-ui, -apple-system, sans-serif"
                  fill={sub.isRoot ? "#ef4444" : "currentColor"}
                  fontWeight={sub.isRoot ? 700 : 400}
                  className="text-th-text"
                >
                  {sub.text.length > 16 ? sub.text.slice(0, 14) + "\u2026" : sub.text}
                </text>
                {sub.isRoot && (
                  <circle cx={sx} cy={tickEndY + (dir === -1 ? -14 : 20)} r={4} fill="#ef4444" fillOpacity={0.2} stroke="#ef4444" strokeWidth={0.5} />
                )}
              </g>
            );
          });

        return (
          <g key={`${catKey}-cause-${i}`}>
            {/* Horizontal cause branch */}
            <line
              x1={cx} y1={cy} x2={bx} y2={by}
              stroke={isRoot ? "#ef4444" : cat.stroke}
              strokeWidth={isRoot ? 2 : 1.2}
              strokeLinecap="round"
            />
            {/* Junction dot on bone */}
            <circle
              cx={cx} cy={cy}
              r={isRoot ? 3.5 : 2.5}
              fill={isRoot ? "#ef4444" : cat.stroke}
            />
            {/* Cause text */}
            <text
              x={bx - 4}
              y={by + 4}
              textAnchor="end"
              fontSize={isRoot ? 10.5 : 9.5}
              fontFamily="system-ui, -apple-system, sans-serif"
              fill={isRoot ? "#ef4444" : "currentColor"}
              fontWeight={isRoot ? 700 : 500}
              className="text-th-text"
            >
              {textTrunc}
            </text>
            {/* Root cause indicator */}
            {isRoot && (
              <g>
                <rect
                  x={bx - 32} y={by + 7}
                  width={28} height={12}
                  rx={3}
                  fill="#ef4444"
                  fillOpacity={0.15}
                  stroke="#ef4444"
                  strokeWidth={0.5}
                />
                <text
                  x={bx - 18} y={by + 16}
                  textAnchor="middle"
                  fontSize={7}
                  fontFamily="system-ui, -apple-system, sans-serif"
                  fill="#ef4444"
                  fontWeight={700}
                >
                  ROOT
                </text>
              </g>
            )}
            {subElements}
          </g>
        );
      });

      return (
        <g
          key={catKey}
          opacity={opacity}
          style={{ transition: "opacity 0.35s ease" }}
          onMouseEnter={() => setHoveredCategory(catKey)}
          onMouseLeave={() => setHoveredCategory(null)}
          onClick={() => toggleHighlight(catKey)}
          cursor="pointer"
        >
          {/* Main diagonal bone line */}
          <line
            x1={attachX} y1={SPINE_Y}
            x2={endX} y2={endY}
            stroke={cat.stroke}
            strokeWidth={isHovered ? 3.5 : 2.5}
            strokeLinecap="round"
            style={{ transition: "stroke-width 0.2s ease" }}
          />

          {/* Arrowhead at end of bone */}
          <polygon
            points={(() => {
              const aLen = 10;
              const angle = Math.atan2(endY - SPINE_Y, endX - attachX);
              const lx = endX - aLen * Math.cos(angle - 0.35);
              const ly = endY - aLen * Math.sin(angle - 0.35);
              const rx = endX - aLen * Math.cos(angle + 0.35);
              const ry = endY - aLen * Math.sin(angle + 0.35);
              return `${endX},${endY} ${lx},${ly} ${rx},${ry}`;
            })()}
            fill={cat.stroke}
          />

          {/* Category label box */}
          <rect
            x={labelCx - labelW / 2}
            y={labelCy - labelH / 2}
            width={labelW}
            height={labelH}
            rx={8}
            fill={cat.stroke}
            fillOpacity={isHovered ? 0.2 : 0.12}
            stroke={cat.stroke}
            strokeWidth={isHovered ? 2 : 1.2}
            style={{ transition: "all 0.2s ease" }}
          />
          <text
            x={labelCx}
            y={labelCy + 5}
            textAnchor="middle"
            fontSize={12}
            fontWeight={700}
            fontFamily="system-ui, -apple-system, sans-serif"
            fill={cat.stroke}
            letterSpacing="0.5"
          >
            {(t(`problem-solving.${cat.labelKey}`) || cat.key).toUpperCase()}
          </text>

          {/* Cause sub-branches */}
          {causeElements}

          {/* Tooltip on hover - cause count */}
          {isHovered && activeCauses.length > 0 && (
            <g>
              <rect
                x={attachX + 8} y={SPINE_Y + (dir === -1 ? 6 : -22)}
                width={60} height={16}
                rx={4}
                fill={cat.stroke}
                fillOpacity={0.9}
              />
              <text
                x={attachX + 38} y={SPINE_Y + (dir === -1 ? 17 : -10)}
                textAnchor="middle"
                fontSize={9}
                fontFamily="system-ui, -apple-system, sans-serif"
                fill="white"
                fontWeight={600}
              >
                {activeCauses.length} {activeCauses.length === 1 ? "cause" : "causes"}
              </text>
            </g>
          )}
        </g>
      );
    },
    [categories, highlightedCategory, hoveredCategory, t, toggleHighlight],
  );

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="space-y-6" data-print-area="true">
      {/* === Toast === */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg shadow-black/10 text-sm font-medium text-white backdrop-blur-sm transition-all animate-slide-in ${
            toast.type === "success" ? "bg-emerald-500/90 border border-emerald-400/30" : "bg-red-500/90 border border-red-400/30"
          }`}
        >
          <span className="mr-2">{toast.type === "success" ? "\u2713" : "\u2717"}</span>
          {toast.message}
        </div>
      )}

      {/* === Top bar: Title + Actions === */}
      <div className="bg-th-bg-2 backdrop-blur-sm p-5 rounded-2xl shadow-card border border-th-border transition-all">
        <div className="flex flex-wrap items-center gap-4">
          {/* Icon + title */}
          <div className="flex items-center gap-3 flex-1 min-w-[200px]">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-glow flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2.5 border rounded-xl bg-th-input text-th-text text-sm font-semibold border-th-border focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
              placeholder={t("problem-solving.analysisTitle") || "Analysis title\u2026"}
            />
          </div>

          {/* Stats pills */}
          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-1 rounded-full bg-th-bg-3 text-th-text-2 font-medium border border-th-border/50">
              {totalCauses} {t("problem-solving.cause") || "causes"}
            </span>
            {rootCauses > 0 && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 font-medium border border-red-500/20">
                {rootCauses} RC
              </span>
            )}
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <ExportToolbar
              onPrint={() => printView({ title: t("problem-solving.ishikawaTitle") || "Ishikawa Diagram", subtitle: title || effect })}
              onExportExcel={() => {
                const rows: Record<string, any>[] = [];
                for (const cat of CATEGORIES) {
                  const causes = categories[cat.key as CategoryKey] || [];
                  for (const cause of causes) {
                    rows.push({ category: t(`problem-solving.${cat.labelKey}`) || cat.key, cause: cause.text, root: cause.isRoot ? "Yes" : "", effect });
                    for (const sub of cause.subCauses) {
                      rows.push({ category: t(`problem-solving.${cat.labelKey}`) || cat.key, cause: `  \u2514 ${sub.text}`, root: sub.isRoot ? "Yes" : "", effect });
                    }
                  }
                }
                exportToExcel({
                  filename: `ishikawa_${title || "analysis"}`,
                  sheetName: "Ishikawa",
                  columns: [
                    { key: "category", header: t("problem-solving.category") || "Category", width: 18 },
                    { key: "cause", header: t("problem-solving.cause") || "Cause", width: 35 },
                    { key: "root", header: t("problem-solving.rootCause") || "Root Cause", width: 12 },
                    { key: "effect", header: t("problem-solving.effect") || "Effect", width: 30 },
                  ],
                  rows,
                  headerRows: [[t("problem-solving.effect") || "Effect", effect]],
                });
              }}
              onExportCSV={() => {
                const rows: Record<string, any>[] = [];
                for (const cat of CATEGORIES) {
                  const causes = categories[cat.key as CategoryKey] || [];
                  for (const cause of causes) {
                    rows.push({ category: t(`problem-solving.${cat.labelKey}`) || cat.key, cause: cause.text, root: cause.isRoot ? "Yes" : "", effect });
                    for (const sub of cause.subCauses) {
                      rows.push({ category: t(`problem-solving.${cat.labelKey}`) || cat.key, cause: `  \u2514 ${sub.text}`, root: sub.isRoot ? "Yes" : "", effect });
                    }
                  }
                }
                exportToCSV({
                  filename: `ishikawa_${title || "analysis"}`,
                  columns: [
                    { key: "category", header: t("problem-solving.category") || "Category" },
                    { key: "cause", header: t("problem-solving.cause") || "Cause" },
                    { key: "root", header: t("problem-solving.rootCause") || "Root Cause" },
                    { key: "effect", header: t("problem-solving.effect") || "Effect" },
                  ],
                  rows,
                });
              }}
            />
            <button
              onClick={save}
              disabled={saving}
              className="bg-gradient-to-r from-brand-500 to-brand-600 text-white px-5 py-2.5 rounded-xl hover:from-brand-600 hover:to-brand-700 hover:shadow-glow disabled:opacity-50 text-sm font-medium transition-all"
            >
              {saving
                ? t("problem-solving.saving") || "Saving\u2026"
                : t("problem-solving.saveIshikawa") || "Save"}
            </button>
            <button
              onClick={resetForm}
              className="bg-th-bg-2 text-th-text-2 px-4 py-2.5 rounded-xl hover:bg-th-bg-3 border border-th-border text-sm font-medium transition-all"
            >
              {t("problem-solving.newAnalysis") || "New Analysis"}
            </button>
            <button
              onClick={() => {
                setShowHistory((p) => !p);
                if (!showHistory) loadHistory();
              }}
              className="bg-th-bg-2 text-th-text-2 px-4 py-2.5 rounded-xl hover:bg-th-bg-3 border border-th-border text-sm font-medium transition-all"
            >
              {t("problem-solving.history") || "History"}
            </button>
          </div>
        </div>
      </div>

      {/* === History Panel === */}
      {showHistory && (
        <div className="bg-th-bg-2 backdrop-blur-sm rounded-2xl border border-th-border shadow-card overflow-hidden transition-all animate-slide-in">
          <div className="p-4 border-b border-th-border flex items-center justify-between">
            <h3 className="font-bold text-th-text text-sm flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-brand-500" />
              {t("problem-solving.savedAnalyses") || "Saved Analyses"}
            </h3>
            <button
              onClick={() => setShowHistory(false)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-th-text-3 hover:text-th-text hover:bg-th-bg-3 transition-all"
            >
              &times;
            </button>
          </div>
          {loadingList ? (
            <div className="p-6 flex items-center justify-center gap-2 text-th-text-3 text-sm">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              {t("problem-solving.loading") || "Loading\u2026"}
            </div>
          ) : savedAnalyses.length === 0 ? (
            <p className="p-6 text-sm text-th-text-3 text-center">
              {t("problem-solving.noAnalyses") || "No saved analyses yet."}
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-white/5 max-h-64 overflow-y-auto">
              {savedAnalyses.map((a) => (
                <li key={a.id} className="flex items-center justify-between px-4 py-3 hover:bg-th-bg-3 transition-all">
                  <button
                    onClick={() => loadAnalysis(a.id)}
                    className="flex-1 text-left"
                  >
                    <p className="text-sm font-medium text-th-text truncate">{a.title || a.effect}</p>
                    <p className="text-xs text-th-text-3">
                      {a.created_at
                        ? new Date(a.created_at).toLocaleDateString()
                        : ""}
                    </p>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteAnalysis(a.id);
                    }}
                    className="ml-2 w-7 h-7 rounded-lg flex items-center justify-center text-th-text-3 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 text-xs transition-all"
                    title={t("problem-solving.delete") || "Delete"}
                  >
                    &times;
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* === SVG Fishbone Diagram === */}
      <div className="bg-th-bg-2 backdrop-blur-sm p-6 rounded-2xl shadow-card border border-th-border transition-all">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-th-text">
              {t("problem-solving.ishikawaTitle") || "Ishikawa Diagram"}
            </h3>
            <p className="text-xs text-th-text-3 mt-0.5">
              {t("problem-solving.clickBranch") || "Click a branch to highlight it"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {highlightedCategory && (
              <button
                onClick={() => setHighlightedCategory(null)}
                className="text-xs text-th-text-3 hover:text-th-text px-3 py-1.5 rounded-lg border border-th-border hover:bg-th-bg-3 transition-all"
              >
                {t("problem-solving.showAll") || "Show all branches"}
              </button>
            )}
            {/* Category filter pills */}
            <div className="hidden lg:flex items-center gap-1.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => toggleHighlight(cat.key)}
                  className={`w-3 h-3 rounded-full transition-all hover:scale-125 ${
                    highlightedCategory === cat.key ? "ring-2 ring-offset-1 dark:ring-offset-slate-800" : "opacity-60 hover:opacity-100"
                  }`}
                  style={{ backgroundColor: cat.stroke, ...(highlightedCategory === cat.key ? { ringColor: cat.stroke } : {}) }}
                  title={t(`problem-solving.${cat.labelKey}`)}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="w-full overflow-x-auto rounded-xl bg-th-bg-3 border border-th-border p-3">
          <svg
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            className="w-full h-auto min-w-[800px]"
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-label={t("problem-solving.ishikawaTitle") || "Ishikawa Diagram"}
          >
            {/* Defs — gradients, filters, markers */}
            <defs>
              {/* Spine arrow marker */}
              <marker
                id="spine-arrow"
                markerWidth="14" markerHeight="12"
                refX="12" refY="6"
                orient="auto"
                markerUnits="userSpaceOnUse"
              >
                <path d="M 0 1 L 12 6 L 0 11 Z" fill="#475569" />
              </marker>

              {/* Effect box gradient */}
              <linearGradient id="effectGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#dc2626" />
                <stop offset="100%" stopColor="#991b1b" />
              </linearGradient>

              {/* Spine gradient */}
              <linearGradient id="spineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#94a3b8" stopOpacity="0.3" />
                <stop offset="30%" stopColor="#64748b" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#475569" stopOpacity="1" />
              </linearGradient>

              {/* Shadow for fish head */}
              <filter id="headShadow" x="-15%" y="-15%" width="140%" height="150%">
                <feDropShadow dx="2" dy="3" stdDeviation="4" floodColor="#00000040" />
              </filter>

              {/* Glow filter for highlighted bones */}
              <filter id="boneGlow">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              {/* Subtle grid pattern for background */}
              <pattern id="gridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.3" opacity="0.06" />
              </pattern>
            </defs>

            {/* Background grid */}
            <rect width={SVG_W} height={SVG_H} fill="url(#gridPattern)" className="text-th-text-2" />

            {/* === Fish Tail (decorative) === */}
            <g opacity={0.3}>
              <path
                d={`M ${SPINE_X_START} ${SPINE_Y} L ${SPINE_X_START - 40} ${SPINE_Y - 50} L ${SPINE_X_START - 15} ${SPINE_Y} L ${SPINE_X_START - 40} ${SPINE_Y + 50} Z`}
                fill="#94a3b8"
                fillOpacity={0.15}
                stroke="#94a3b8"
                strokeWidth={1}
                strokeLinejoin="round"
              />
            </g>

            {/* === Horizontal Spine === */}
            <line
              x1={SPINE_X_START} y1={SPINE_Y}
              x2={SPINE_X_END} y2={SPINE_Y}
              stroke="url(#spineGrad)"
              strokeWidth={4}
              strokeLinecap="round"
              markerEnd="url(#spine-arrow)"
            />

            {/* Spine junction dots at bone attachment points */}
            {BONE_ATTACH_X.map((x, i) => (
              <circle key={`spine-dot-${i}`} cx={x} cy={SPINE_Y} r={4} fill="#64748b" opacity={0.5} />
            ))}

            {/* === Upper Bones (3 categories) === */}
            {UPPER_KEYS.map((key, i) => renderBone(key, i, "upper"))}

            {/* === Lower Bones (3 categories) === */}
            {LOWER_KEYS.map((key, i) => renderBone(key, i, "lower"))}

            {/* === Fish Head — Effect/Problem Box === */}
            <g>
              {/* Fish head shape: a rounded rectangle with a pointed left side */}
              <path
                d={`
                  M ${HEAD_X} ${SPINE_Y - HEAD_H / 2 + 10}
                  Q ${HEAD_X} ${SPINE_Y - HEAD_H / 2} ${HEAD_X + 10} ${SPINE_Y - HEAD_H / 2}
                  L ${HEAD_X + HEAD_W - 20} ${SPINE_Y - HEAD_H / 2}
                  Q ${HEAD_X + HEAD_W} ${SPINE_Y - HEAD_H / 2} ${HEAD_X + HEAD_W} ${SPINE_Y - HEAD_H / 2 + 20}
                  L ${HEAD_X + HEAD_W} ${SPINE_Y + HEAD_H / 2 - 20}
                  Q ${HEAD_X + HEAD_W} ${SPINE_Y + HEAD_H / 2} ${HEAD_X + HEAD_W - 20} ${SPINE_Y + HEAD_H / 2}
                  L ${HEAD_X + 10} ${SPINE_Y + HEAD_H / 2}
                  Q ${HEAD_X} ${SPINE_Y + HEAD_H / 2} ${HEAD_X} ${SPINE_Y + HEAD_H / 2 - 10}
                  Z
                `}
                fill="url(#effectGrad)"
                stroke="#991b1b"
                strokeWidth={1.5}
                filter="url(#headShadow)"
              />

              {/* "Effect" label */}
              <text
                x={HEAD_X + HEAD_W / 2}
                y={SPINE_Y - 10}
                textAnchor="middle"
                fontSize={9}
                fontFamily="system-ui, -apple-system, sans-serif"
                fill="white"
                fillOpacity={0.7}
                fontWeight={500}
                letterSpacing="1.5"
              >
                {(t("problem-solving.effect") || "EFFECT").toUpperCase()}
              </text>

              {/* Problem text */}
              <foreignObject
                x={HEAD_X + 12}
                y={SPINE_Y - 2}
                width={HEAD_W - 24}
                height={HEAD_H / 2 + 4}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "center",
                    height: "100%",
                    color: "white",
                    fontSize: "12px",
                    fontWeight: 700,
                    textAlign: "center",
                    lineHeight: 1.3,
                    fontFamily: "system-ui, -apple-system, sans-serif",
                    overflow: "hidden",
                    wordBreak: "break-word",
                  }}
                >
                  {effect || t("problem-solving.effectPlaceholder") || "Problem"}
                </div>
              </foreignObject>

              {/* Fish eye (decorative) */}
              <circle
                cx={HEAD_X + HEAD_W - 28}
                cy={SPINE_Y - HEAD_H / 2 + 18}
                r={5}
                fill="white"
                fillOpacity={0.3}
              />
              <circle
                cx={HEAD_X + HEAD_W - 28}
                cy={SPINE_Y - HEAD_H / 2 + 18}
                r={2.5}
                fill="white"
                fillOpacity={0.6}
              />
            </g>

            {/* === Legend === */}
            <g>
              {/* Root cause legend */}
              <rect x={20} y={SVG_H - 34} width={130} height={24} rx={6} fill="currentColor" fillOpacity={0.03} stroke="currentColor" strokeOpacity={0.08} strokeWidth={0.5} className="text-th-text-2" />
              <circle cx={36} cy={SVG_H - 22} r={4} fill="#ef4444" />
              <text
                x={46} y={SVG_H - 18}
                fontSize={9}
                fontFamily="system-ui, -apple-system, sans-serif"
                fill="currentColor"
                fillOpacity={0.5}
                className="text-th-text"
              >
                = {t("problem-solving.rootCause") || "Root Cause"}
              </text>

              {/* Category legend */}
              <g transform={`translate(170, ${SVG_H - 34})`}>
                <rect width={CATEGORIES.length * 95 + 10} height={24} rx={6} fill="currentColor" fillOpacity={0.03} stroke="currentColor" strokeOpacity={0.08} strokeWidth={0.5} className="text-th-text-2" />
                {CATEGORIES.map((cat, i) => (
                  <g key={cat.key} transform={`translate(${i * 95 + 12}, 0)`}>
                    <rect y={7} width={8} height={8} rx={2} fill={cat.stroke} fillOpacity={0.8} />
                    <text
                      x={14} y={16}
                      fontSize={8}
                      fontFamily="system-ui, -apple-system, sans-serif"
                      fill={cat.stroke}
                      fontWeight={500}
                    >
                      {t(`problem-solving.${cat.labelKey}`) || cat.key}
                    </text>
                  </g>
                ))}
              </g>
            </g>
          </svg>
        </div>
      </div>

      {/* === Cause Input Form === */}
      <div className="bg-th-bg-2 backdrop-blur-sm p-6 rounded-2xl shadow-card border border-th-border transition-all">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-6 h-6 rounded-lg bg-brand-500/10 dark:bg-brand-500/20 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
          </div>
          <h3 className="text-sm font-bold text-th-text uppercase tracking-wider">
            {t("problem-solving.editCauses") || "Edit Causes"}
          </h3>
        </div>

        {/* Effect / Problem input */}
        <div className="mb-6">
          <label className="block text-xs font-semibold text-th-text-2 uppercase tracking-wider mb-1.5">
            {t("problem-solving.effectProblem") || "Effect / Problem Statement"}
          </label>
          <input
            type="text"
            value={effect}
            onChange={(e) => setEffect(e.target.value)}
            className="w-full px-4 py-2.5 border rounded-xl bg-th-input text-th-text text-sm border-th-border focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
            placeholder={t("problem-solving.effectPlaceholder") || "Describe the effect or problem\u2026"}
          />
        </div>

        {/* 6M Categories grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CATEGORIES.map((cat) => {
            const catKey = cat.key as CategoryKey;
            const label = t(`problem-solving.${cat.labelKey}`) || cat.key;
            const isActive = highlightedCategory === null || highlightedCategory === cat.key;
            const causesForCat = categories[catKey] ?? [];
            const filledCount = causesForCat.filter((c) => c.text.trim()).length;

            return (
              <div
                key={cat.key}
                className={`p-4 rounded-xl border transition-all duration-300 ${CATEGORY_CARD_CLASSES[catKey]} ${
                  isActive ? "opacity-100" : "opacity-40"
                }`}
              >
                {/* Category header */}
                <div className="flex items-center justify-between mb-3">
                  <button
                    className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${CATEGORY_BADGE_CLASSES[catKey]}`}
                    onClick={() => toggleHighlight(cat.key)}
                  >
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: cat.stroke }}
                    />
                    {label}
                  </button>
                  <span className="text-[10px] text-th-text-3 font-medium bg-th-bg-3 px-1.5 py-0.5 rounded">
                    {filledCount}
                  </span>
                </div>

                {/* Causes list */}
                {causesForCat.map((cause, idx) => (
                  <div key={idx} className="mb-2">
                    {/* Main cause row */}
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={cause.text}
                        onChange={(e) => updateCauseText(catKey, idx, e.target.value)}
                        className="flex-1 px-2.5 py-1.5 border rounded-lg text-sm bg-th-input text-th-text border-th-border focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 outline-none transition-all"
                        placeholder={t("problem-solving.causePlaceholder") || `Cause\u2026`}
                      />
                      <label
                        className={`flex items-center gap-0.5 text-[10px] cursor-pointer whitespace-nowrap px-1.5 py-1 rounded transition-colors ${
                          cause.isRoot ? "text-red-500 bg-red-500/10" : "text-th-text-3 hover:text-red-500"
                        }`}
                        title={t("problem-solving.markRoot") || "Mark as root cause"}
                      >
                        <input
                          type="checkbox"
                          checked={cause.isRoot}
                          onChange={() => toggleCauseRoot(catKey, idx)}
                          className="w-3 h-3 accent-red-600"
                        />
                        RC
                      </label>
                      <button
                        onClick={() => addSubCause(catKey, idx)}
                        className="text-th-text-3 hover:text-th-text text-xs px-1 transition-colors"
                        title={t("problem-solving.addSubCause") || "Add sub-cause"}
                      >
                        +&darr;
                      </button>
                      {causesForCat.length > 1 && (
                        <button
                          onClick={() => removeCause(catKey, idx)}
                          className="text-th-text-3 hover:text-red-500 text-xs px-1 transition-colors"
                          title={t("problem-solving.removeCause") || "Remove"}
                          aria-label={`Remove cause ${idx + 1}`}
                        >
                          &times;
                        </button>
                      )}
                    </div>

                    {/* Sub-causes */}
                    {cause.subCauses.length > 0 && (
                      <div className="ml-4 mt-1.5 space-y-1 border-l-2 pl-2.5" style={{ borderColor: `${cat.stroke}40` }}>
                        {cause.subCauses.map((sub, si) => (
                          <div key={si} className="flex items-center gap-1">
                            <input
                              type="text"
                              value={sub.text}
                              onChange={(e) =>
                                updateSubCauseText(catKey, idx, si, e.target.value)
                              }
                              className="flex-1 px-2 py-1 border rounded-lg text-xs bg-th-input text-th-text border-th-border focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 outline-none transition-all"
                              placeholder={t("problem-solving.subCausePlaceholder") || "Sub-cause\u2026"}
                            />
                            <label className={`flex items-center gap-0.5 text-[9px] cursor-pointer whitespace-nowrap px-1 py-0.5 rounded transition-colors ${
                              sub.isRoot ? "text-red-500 bg-red-500/10" : "text-th-text-3 hover:text-red-500"
                            }`}>
                              <input
                                type="checkbox"
                                checked={sub.isRoot}
                                onChange={() => toggleSubCauseRoot(catKey, idx, si)}
                                className="w-3 h-3 accent-red-600"
                              />
                              RC
                            </label>
                            <button
                              onClick={() => removeSubCause(catKey, idx, si)}
                              className="text-th-text-3 hover:text-red-500 text-[10px] px-0.5 transition-colors"
                              aria-label={`Remove sub-cause ${si + 1}`}
                            >
                              &times;
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                <button
                  onClick={() => addCause(catKey)}
                  className="text-xs text-th-text-3 hover:text-th-text mt-2 flex items-center gap-1 transition-colors"
                >
                  <span className="w-4 h-4 rounded-full border border-current flex items-center justify-center text-[10px]">+</span>
                  {t("problem-solving.addCause") || "Add cause"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* === Notes / Conclusion === */}
      <div className="bg-th-bg-2 backdrop-blur-sm p-6 rounded-2xl shadow-card border border-th-border transition-all">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-lg bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H6z" clipRule="evenodd" /></svg>
          </div>
          <h3 className="text-xs font-bold text-th-text uppercase tracking-wider">
            {t("problem-solving.conclusionNotes") || "Conclusion / Notes"}
          </h3>
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          className="w-full px-4 py-3 text-sm border rounded-xl bg-th-input text-th-text border-th-border resize-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
          placeholder={t("problem-solving.notesPlaceholder") || "Summary of findings, recommended next steps\u2026"}
        />
      </div>
    </div>
  );
}
