'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import dynamic from 'next/dynamic';
import {
  Map, Timer, BarChart3, Trash2, Loader2, ArrowLeft,
  Plus, Search, ChevronDown,
} from 'lucide-react';
import { advancedLeanApi, wasteApi } from '@/lib/api';
import { useI18n } from '@/stores/useI18n';
import type { YamazumiStation } from '@/components/lean/YamazumiChart';

const VSMEditor = dynamic(() => import('@/components/lean/VSMEditor'), {
  loading: () => <ToolLoader />,
});
const SMEDTracker = dynamic(() => import('@/components/lean/SMEDTracker'), {
  loading: () => <ToolLoader />,
});
const YamazumiChart = dynamic(() => import('@/components/lean/YamazumiChart'), {
  loading: () => <ToolLoader />,
});
const WasteTracker = dynamic(() => import('@/components/lean/WasteTracker'), {
  loading: () => <ToolLoader />,
});

type View = 'list' | 'vsm' | 'smed' | 'yamazumi' | 'waste';

interface ToolEntry {
  id: number;
  title: string;
  tool: 'vsm' | 'smed' | 'waste';
  date: string;
  status: string;
}

const DEMO_STATIONS: YamazumiStation[] = [
  {
    name: 'Station 1',
    elements: [
      { name: 'Assembly', duration: 45, type: 'value_add' },
      { name: 'Walk to bin', duration: 10, type: 'non_value_add' },
      { name: 'Rework', duration: 8, type: 'waste' },
    ],
  },
  {
    name: 'Station 2',
    elements: [
      { name: 'Welding', duration: 55, type: 'value_add' },
      { name: 'Wait for part', duration: 15, type: 'non_value_add' },
      { name: 'Scrap handling', duration: 5, type: 'waste' },
    ],
  },
  {
    name: 'Station 3',
    elements: [
      { name: 'Testing', duration: 35, type: 'value_add' },
      { name: 'Data entry', duration: 12, type: 'non_value_add' },
      { name: 'Defect sorting', duration: 6, type: 'waste' },
    ],
  },
  {
    name: 'Station 4',
    elements: [
      { name: 'Packaging', duration: 40, type: 'value_add' },
      { name: 'Label printing', duration: 8, type: 'non_value_add' },
      { name: 'Overproduction', duration: 10, type: 'waste' },
    ],
  },
];

function ToolLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
    </div>
  );
}

/* ── Badge helpers ───────────────────────────────────────────────── */
function ToolBadge({ tool }: { tool: ToolEntry['tool'] }) {
  const cfg = {
    vsm: { label: 'VSM', icon: <Map className="w-3 h-3" />, cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    smed: { label: 'SMED', icon: <Timer className="w-3 h-3" />, cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    waste: { label: 'Waste', icon: <Trash2 className="w-3 h-3" />, cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  }[tool];

  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${cfg.cls}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

/* ── Dropdown "+ New" button ─────────────────────────────────────── */
function NewDropdown({ onSelect }: { onSelect: (v: View) => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const items: { label: string; view: View }[] = [
    { label: t("improvement.newVSM") || "New VSM Map", view: 'vsm' },
    { label: t("improvement.newSMED") || "New SMED Analysis", view: 'smed' },
    { label: t("improvement.newWaste") || "New Waste Event", view: 'waste' },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 transition-colors text-sm"
      >
        <Plus className="w-4 h-4" />
        {t("common.create") || "New"}
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-48 bg-th-bg border border-th-border rounded-lg shadow-lg z-20 py-1">
          {items.map((it) => (
            <button
              key={it.view}
              onClick={() => { setOpen(false); onSelect(it.view); }}
              className="w-full text-left px-4 py-2 text-sm text-th-text hover:bg-th-bg-secondary transition-colors"
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── List View ───────────────────────────────────────────────────── */
function ToolList({
  onOpen,
  onNew,
  onYamazumi,
}: {
  onOpen: (entry: ToolEntry) => void;
  onNew: (v: View) => void;
  onYamazumi: () => void;
}) {
  const { t } = useI18n();
  const [entries, setEntries] = useState<ToolEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [vsmRes, wasteRes] = await Promise.allSettled([
        advancedLeanApi.listVSM(),
        wasteApi.list(),
      ]);

      const list: ToolEntry[] = [];

      if (vsmRes.status === 'fulfilled') {
        const arr = vsmRes.value?.data;
        if (Array.isArray(arr)) {
          for (const item of arr) {
            list.push({
              id: item.id,
              title: item.title || item.name || `VSM #${item.id}`,
              tool: 'vsm',
              date: item.created_at || item.date || '',
              status: item.status || 'draft',
            });
          }
        }
      }

      // SMED has no list endpoint -- skip

      if (wasteRes.status === 'fulfilled') {
        const arr = wasteRes.value?.data;
        if (Array.isArray(arr)) {
          for (const item of arr) {
            list.push({
              id: item.id,
              title: item.description || item.waste_type || `Waste #${item.id}`,
              tool: 'waste',
              date: item.created_at || item.date || item.reported_at || '',
              status: item.status || 'open',
            });
          }
        }
      }

      list.sort((a, b) => {
        if (!a.date && !b.date) return 0;
        if (!a.date) return 1;
        if (!b.date) return -1;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });

      setEntries(list);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = search
    ? entries.filter((e) =>
        e.title.toLowerCase().includes(search.toLowerCase()) ||
        e.tool.toLowerCase().includes(search.toLowerCase()) ||
        e.status.toLowerCase().includes(search.toLowerCase())
      )
    : entries;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-xl font-bold text-th-text">Lean Tools</h2>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onYamazumi}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-th-border text-sm font-medium text-th-text hover:bg-th-bg-secondary transition-colors"
          >
            <BarChart3 className="w-4 h-4" />
            {t("improvement.openYamazumi") || "Open Yamazumi"}
          </button>
          <NewDropdown onSelect={onNew} />
        </div>
      </div>

      {/* Search */}
      {entries.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-th-text-secondary" />
          <input
            type="text"
            placeholder={t("common.search") + "..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-th-border bg-th-bg text-sm text-th-text placeholder:text-th-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-500"
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
          <Map className="w-10 h-10 text-th-text-secondary mx-auto mb-3 opacity-40" />
          <p className="text-sm text-th-text-secondary">
            {search
              ? (t("improvement.noToolsMatch") || "No tools match your search.")
              : (t("improvement.noToolsYet") || "No lean tool records yet. Create a VSM map, SMED analysis, or waste event to get started.")}
          </p>
        </div>
      ) : (
        <div className="border border-th-border rounded-xl overflow-hidden">
          {/* Desktop header */}
          <div className="hidden sm:grid sm:grid-cols-[3rem_1fr_6rem_7rem_6rem] gap-2 px-4 py-2.5 bg-th-bg-secondary/60 text-xs font-semibold text-th-text-secondary uppercase tracking-wide">
            <span>ID</span>
            <span>Title</span>
            <span>Tool</span>
            <span>Date</span>
            <span>Status</span>
          </div>

          <div className="divide-y divide-th-border">
            {filtered.map((e) => (
              <button
                key={`${e.tool}-${e.id}`}
                onClick={() => onOpen(e)}
                className="w-full text-left sm:grid sm:grid-cols-[3rem_1fr_6rem_7rem_6rem] gap-2 px-4 py-3 hover:bg-th-bg-secondary/50 transition-colors flex flex-col sm:flex-row sm:items-center"
              >
                <span className="text-xs text-th-text-secondary font-mono">#{e.id}</span>
                <span className="text-sm font-medium text-th-text truncate">{e.title}</span>
                <ToolBadge tool={e.tool} />
                <span className="text-xs text-th-text-secondary">
                  {e.date ? new Date(e.date).toLocaleDateString() : '-'}
                </span>
                <span
                  className={`inline-block text-xs px-2 py-0.5 rounded-full w-fit ${
                    e.status === 'closed' || e.status === 'completed'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : e.status === 'draft'
                        ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                        : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                  }`}
                >
                  {e.status}
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
function LeanToolsHubInner() {
  const { t } = useI18n();
  const [view, setView] = useState<View>('list');

  const handleOpen = (entry: ToolEntry) => {
    setView(entry.tool);
  };

  if (view === 'list') {
    return (
      <ToolList
        onOpen={handleOpen}
        onNew={(v) => setView(v)}
        onYamazumi={() => setView('yamazumi')}
      />
    );
  }

  return (
    <div className="space-y-4">
      <button
        onClick={() => setView('list')}
        className="flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700 font-medium transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        {t("improvement.backToTools") || "Back to Lean Tools"}
      </button>

      {view === 'vsm' && <VSMEditor />}
      {view === 'smed' && <SMEDTracker />}
      {view === 'yamazumi' && (
        <YamazumiChart
          stations={DEMO_STATIONS}
          taktTime={60}
          title="Line Balancing - Yamazumi Chart"
        />
      )}
      {view === 'waste' && <WasteTracker />}
    </div>
  );
}

export default function LeanToolsHub() {
  return (
    <Suspense fallback={<ToolLoader />}>
      <LeanToolsHubInner />
    </Suspense>
  );
}
