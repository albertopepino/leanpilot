'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Suspense, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { viewToRoute } from '@/lib/routes';
import {
  Settings,
  ClipboardList,
  Calendar,
  Bot,
  BookOpen,
  CalendarCheck,
  Puzzle,
  Upload,
  Loader2,
} from 'lucide-react';

const SettingsPage = dynamic(() => import('@/components/settings/SettingsPage'), {
  loading: () => <TabLoader />,
});
const LeanAssessment = dynamic(() => import('@/components/lean/LeanAssessment'), {
  loading: () => <TabLoader />,
});
const MasterCalendar = dynamic(() => import('@/components/calendar/MasterCalendar'), {
  loading: () => <TabLoader />,
});
const FactoryCopilot = dynamic(() => import('@/components/ai/FactoryCopilot'), {
  loading: () => <TabLoader />,
});
const AuditScheduler = dynamic(() => import('@/components/lean/AuditScheduler'), {
  loading: () => <TabLoader />,
});
const KanbanBoard = dynamic(() => import('@/components/lean/KanbanBoard'), {
  loading: () => <TabLoader />,
});
const MindMap = dynamic(() => import('@/components/lean/MindMap'), {
  loading: () => <TabLoader />,
});
const DataImport = dynamic(() => import('@/components/admin/DataImport'), {
  loading: () => <TabLoader />,
});

type TabKey = 'general' | 'assessment' | 'calendar' | 'copilot' | 'resources' | 'audit-scheduler' | 'extra-tools' | 'data-import';

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'general', label: 'General Settings', icon: <Settings className="w-4 h-4" /> },
  { key: 'assessment', label: 'Lean Assessment', icon: <ClipboardList className="w-4 h-4" /> },
  { key: 'calendar', label: 'Master Calendar', icon: <Calendar className="w-4 h-4" /> },
  { key: 'copilot', label: 'Factory Copilot', icon: <Bot className="w-4 h-4" /> },
  { key: 'resources', label: 'Lean Resources', icon: <BookOpen className="w-4 h-4" /> },
  { key: 'audit-scheduler', label: 'Audit Scheduler', icon: <CalendarCheck className="w-4 h-4" /> },
  { key: 'extra-tools', label: 'Extra Tools', icon: <Puzzle className="w-4 h-4" /> },
  { key: 'data-import', label: 'Import / Export', icon: <Upload className="w-4 h-4" /> },
];

function TabLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
    </div>
  );
}

function LeanResourcesView() {
  const resources = [
    { title: 'Lean Enterprise Institute', url: 'https://www.lean.org', desc: 'The original source for lean thinking and practice.' },
    { title: 'Toyota Production System', url: 'https://global.toyota/en/company/vision-and-philosophy/production-system/', desc: 'Learn about TPS directly from Toyota.' },
    { title: 'Gemba Academy', url: 'https://www.gembaacademy.com', desc: 'Online lean and six sigma training videos.' },
    { title: 'ASQ - Quality Resources', url: 'https://asq.org/quality-resources', desc: 'American Society for Quality knowledge base.' },
    { title: 'iSixSigma', url: 'https://www.isixsigma.com', desc: 'Six Sigma methodology resources and community.' },
    { title: 'Planet Lean', url: 'https://planet-lean.com', desc: 'Articles and interviews on lean management worldwide.' },
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-th-text">Lean Resources</h3>
      <p className="text-sm text-th-text-3">Curated links to lean manufacturing knowledge bases and training materials.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {resources.map((r) => (
          <a
            key={r.url}
            href={r.url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-5 hover:border-brand-500 transition-all group"
          >
            <h4 className="text-sm font-semibold text-th-text group-hover:text-brand-600 transition-colors">{r.title}</h4>
            <p className="text-xs text-th-text-3 mt-1">{r.desc}</p>
            <span className="text-xs text-brand-500 mt-2 inline-block">Visit &rarr;</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function ExtraToolsView() {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold text-th-text">Extra Tools</h3>
      <p className="text-sm text-th-text-3">Additional lean tools available in your workspace.</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-th-text-2 uppercase tracking-wide">Kanban Board</h4>
          <KanbanBoard />
        </div>
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-th-text-2 uppercase tracking-wide">Mind Map</h4>
          <MindMap />
        </div>
      </div>
    </div>
  );
}

function SettingsHubInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const activeTab = (searchParams.get('tab') as TabKey) || 'general';

  const setTab = useCallback((key: TabKey) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', key);
    router.replace(`${pathname}?${params.toString()}`);
  }, [searchParams, router, pathname]);

  const handleNavigate = useCallback((view: string) => {
    router.push(viewToRoute(view));
  }, [router]);

  return (
    <div className="flex flex-col md:flex-row gap-6">
      {/* Sidebar (desktop: vertical, mobile: horizontal scrollable pills) */}
      <nav className="md:w-56 flex-shrink-0">
        {/* Mobile: horizontal scrollable */}
        <div className="md:hidden flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === t.key
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-th-bg-2 text-th-text-2 border border-th-border hover:bg-th-bg'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Desktop: vertical sidebar */}
        <div className="hidden md:flex flex-col gap-1 sticky top-24">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-left transition-all w-full ${
                activeTab === t.key
                  ? 'bg-brand-600/10 text-brand-600 border-l-2 border-brand-600'
                  : 'text-th-text-2 hover:bg-th-bg-2 hover:text-th-text border-l-2 border-transparent'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {activeTab === 'general' && <SettingsPage />}
        {activeTab === 'assessment' && <LeanAssessment />}
        {activeTab === 'calendar' && <MasterCalendar onNavigate={handleNavigate} />}
        {activeTab === 'copilot' && <FactoryCopilot />}
        {activeTab === 'resources' && <LeanResourcesView />}
        {activeTab === 'audit-scheduler' && <AuditScheduler />}
        {activeTab === 'extra-tools' && <ExtraToolsView />}
        {activeTab === 'data-import' && <DataImport />}
      </div>
    </div>
  );
}

export default function SettingsHub() {
  return (
    <Suspense fallback={<TabLoader />}>
      <SettingsHubInner />
    </Suspense>
  );
}
