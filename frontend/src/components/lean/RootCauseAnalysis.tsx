'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  HelpCircle, GitBranch, Loader2, ArrowLeft, Plus, Search, X,
} from 'lucide-react';
import { leanApi } from '@/lib/api';
import { useI18n } from '@/stores/useI18n';
import FlowBreadcrumb from '@/components/ui/FlowBreadcrumb';
import ToolInfoCard from "@/components/ui/ToolInfoCard";
import { TOOL_INFO } from "@/lib/toolInfo";

const FiveWhyForm = dynamic(() => import('@/components/lean/FiveWhyForm'), {
  loading: () => <ToolLoader />,
});
const IshikawaDiagram = dynamic(() => import('@/components/lean/IshikawaDiagram'), {
  loading: () => <ToolLoader />,
});

type View = 'list' | 'chooser' | 'five-why' | 'ishikawa';

interface AnalysisEntry {
  id: number;
  title: string;
  tool: 'five-why' | 'ishikawa';
  date: string;
  status: string;
  author?: string;
}

function ToolLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
    </div>
  );
}

/* ── Tool Chooser Modal ─────────────────────────────────────────── */
function ToolChooser({ onSelect, onClose }: { onSelect: (v: View) => void; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-th-bg border border-th-border rounded-xl shadow-xl w-full max-w-lg p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-th-text">{t("improvement.newRCA") || "New Root Cause Analysis"}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-th-bg-2 transition-colors">
            <X className="w-5 h-5 text-th-text-3" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* 5 Why */}
          <button
            onClick={() => onSelect('five-why')}
            className="border border-th-border rounded-xl p-5 bg-th-bg hover:shadow-lg hover:border-blue-400 transition-all text-left flex flex-col gap-3"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <HelpCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="font-semibold text-th-text">{t("common.titleFiveWhy") || "5 Why Analysis"}</span>
            </div>
            <p className="text-sm text-th-text-3">
              Ask Why 5 times to drill down to the root cause
            </p>
          </button>

          {/* Ishikawa */}
          <button
            onClick={() => onSelect('ishikawa')}
            className="border border-th-border rounded-xl p-5 bg-th-bg hover:shadow-lg hover:border-amber-400 transition-all text-left flex flex-col gap-3"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <GitBranch className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <span className="font-semibold text-th-text">{t("common.titleIshikawa") || "Ishikawa Diagram"}</span>
            </div>
            <p className="text-sm text-th-text-3">
              Map causes across 6M categories using a fishbone diagram
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── List View ───────────────────────────────────────────────────── */
function AnalysisList({ onOpen, onNew }: { onOpen: (entry: AnalysisEntry) => void; onNew: () => void }) {
  const { t } = useI18n();
  const [analyses, setAnalyses] = useState<AnalysisEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [fwRes, ikRes] = await Promise.allSettled([
        leanApi.listFiveWhy(),
        leanApi.listIshikawa(),
      ]);

      const entries: AnalysisEntry[] = [];

      if (fwRes.status === 'fulfilled') {
        const arr = fwRes.value?.data;
        if (Array.isArray(arr)) {
          for (const item of arr) {
            entries.push({
              id: item.id,
              title: item.problem_statement || item.title || `5-Why #${item.id}`,
              tool: 'five-why',
              date: item.created_at || item.date || '',
              status: item.status || 'open',
              author: item.author || item.created_by || '',
            });
          }
        }
      }

      if (ikRes.status === 'fulfilled') {
        const arr = ikRes.value?.data;
        if (Array.isArray(arr)) {
          for (const item of arr) {
            entries.push({
              id: item.id,
              title: item.problem_statement || item.title || `Ishikawa #${item.id}`,
              tool: 'ishikawa',
              date: item.created_at || item.date || '',
              status: item.status || 'open',
              author: item.author || item.created_by || '',
            });
          }
        }
      }

      entries.sort((a, b) => {
        if (!a.date && !b.date) return 0;
        if (!a.date) return 1;
        if (!b.date) return -1;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });

      setAnalyses(entries);
    } catch {
      setAnalyses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = search
    ? analyses.filter((a) =>
        a.title.toLowerCase().includes(search.toLowerCase()) ||
        a.tool.toLowerCase().includes(search.toLowerCase()) ||
        a.status.toLowerCase().includes(search.toLowerCase())
      )
    : analyses;

  return (
    <div className="space-y-4">
      <ToolInfoCard info={TOOL_INFO["root-cause"]} />
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-xl font-bold text-th-text">{t("common.rootCauseHeading")}</h2>
        <button
          onClick={onNew}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 transition-colors text-sm shrink-0"
        >
          <Plus className="w-4 h-4" />
          {t("common.newAnalysis")}
        </button>
      </div>

      {/* Search (show only if records exist) */}
      {analyses.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-th-text-3" />
          <input
            type="text"
            placeholder={t("common.search") + "..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-th-border bg-th-bg text-sm text-th-text placeholder:text-th-text-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-brand-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-th-border rounded-xl">
          <HelpCircle className="w-10 h-10 text-th-text-3 mx-auto mb-3 opacity-40" />
          <p className="text-sm text-th-text-3">
            {search
              ? t("common.noAnalysesMatch")
              : t("common.noAnalysesYet")}
          </p>
        </div>
      ) : (
        /* Table */
        <div className="border border-th-border rounded-xl overflow-hidden">
          {/* Desktop header */}
          <div className="hidden sm:grid sm:grid-cols-[3rem_1fr_7rem_7rem_6rem_6rem] gap-2 px-4 py-2.5 bg-th-bg-2/60 text-xs font-semibold text-th-text-3 uppercase tracking-wide">
            <span>{t("common.id")}</span>
            <span>{t("common.problemTitle")}</span>
            <span>{t("common.tool")}</span>
            <span>{t("common.date")}</span>
            <span>{t("common.status")}</span>
            <span>{t("common.author")}</span>
          </div>

          <div className="divide-y divide-th-border">
            {filtered.map((a) => (
              <button
                key={`${a.tool}-${a.id}`}
                onClick={() => onOpen(a)}
                className="w-full text-left sm:grid sm:grid-cols-[3rem_1fr_7rem_7rem_6rem_6rem] gap-2 px-4 py-3 hover:bg-th-bg-2/50 transition-colors flex flex-col sm:flex-row sm:items-center"
              >
                {/* ID */}
                <span className="text-xs text-th-text-3 font-mono">#{a.id}</span>

                {/* Title */}
                <span className="text-sm font-medium text-th-text truncate" title={a.title}>{a.title}</span>

                {/* Tool badge */}
                <span>
                  {a.tool === 'five-why' ? (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                      <HelpCircle className="w-3 h-3" /> 5 Why
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      <GitBranch className="w-3 h-3" /> Ishikawa
                    </span>
                  )}
                </span>

                {/* Date */}
                <span className="text-xs text-th-text-3">
                  {a.date ? new Date(a.date).toLocaleDateString() : '-'}
                </span>

                {/* Status */}
                <span
                  className={`inline-block text-xs px-2 py-0.5 rounded-full w-fit ${
                    a.status === 'closed' || a.status === 'completed'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                  }`}
                >
                  {a.status}
                </span>

                {/* Author */}
                <span className="text-xs text-th-text-3 truncate" title={a.author || ""}>
                  {a.author || '-'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────────────── */
function RootCauseAnalysisInner() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const fromModule = searchParams.get('from');
  const requestedTool = searchParams.get('tool') as View | null;

  // Auto-open the requested tool if linked from another module
  const [view, setView] = useState<View>(() => {
    if (requestedTool === 'five-why' || requestedTool === 'ishikawa') return requestedTool;
    return 'list';
  });
  const [showChooser, setShowChooser] = useState(false);

  const handleOpen = (entry: AnalysisEntry) => {
    setView(entry.tool);
  };

  if (view === 'list') {
    return (
      <>
        <AnalysisList onOpen={handleOpen} onNew={() => setShowChooser(true)} />
        {showChooser && (
          <ToolChooser
            onSelect={(t) => { setShowChooser(false); setView(t); }}
            onClose={() => setShowChooser(false)}
          />
        )}
      </>
    );
  }

  return (
    <div className="space-y-4">
      {/* Flow breadcrumb: shows where user came from */}
      <FlowBreadcrumb currentLabel={view === 'five-why' ? (t("common.titleFiveWhy") || "5-Why Analysis") : (t("common.titleIshikawa") || "Ishikawa Diagram")} />
      {/* Tool info card */}
      <ToolInfoCard info={TOOL_INFO["root-cause"]} />
      {!fromModule && (
        <button
          onClick={() => setView('list')}
          className="flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700 font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("improvement.backToRCA") || "Back to Root Cause Analysis"}
        </button>
      )}
      {view === 'five-why' && <FiveWhyForm />}
      {view === 'ishikawa' && <IshikawaDiagram />}
    </div>
  );
}

export default function RootCauseAnalysis() {
  return (
    <Suspense fallback={<ToolLoader />}>
      <RootCauseAnalysisInner />
    </Suspense>
  );
}
