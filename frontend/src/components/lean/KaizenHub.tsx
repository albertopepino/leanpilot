'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Suspense, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Lightbulb, Copy, ClipboardList, Loader2 } from 'lucide-react';

const KaizenBoard = dynamic(() => import('@/components/lean/KaizenBoard'), {
  loading: () => <TabLoader />,
});
const HorizontalDeployTracker = dynamic(() => import('@/components/lean/HorizontalDeployTracker'), {
  loading: () => <TabLoader />,
});
const LeaderStandardWork = dynamic(() => import('@/components/lean/LeaderStandardWork'), {
  loading: () => <TabLoader />,
});

type TabKey = 'suggestions' | 'horizontal-deploy' | 'lsw';

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'suggestions', label: 'Kaizen Suggestions', icon: <Lightbulb className="w-4 h-4" /> },
  { key: 'horizontal-deploy', label: 'Horizontal Deploy', icon: <Copy className="w-4 h-4" /> },
  { key: 'lsw', label: 'Leader Standard Work', icon: <ClipboardList className="w-4 h-4" /> },
];

function TabLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
    </div>
  );
}

function KaizenHubInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const activeTab = (searchParams.get('tab') as TabKey) || 'suggestions';

  const setTab = useCallback((key: TabKey) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', key);
    router.replace(`${pathname}?${params.toString()}`);
  }, [searchParams, router, pathname]);

  return (
    <div className="space-y-6">
      <div className="flex gap-1 overflow-x-auto border-b border-th-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all border-b-2 ${
              activeTab === t.key
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'suggestions' && <KaizenBoard />}
      {activeTab === 'horizontal-deploy' && <HorizontalDeployTracker />}
      {activeTab === 'lsw' && <LeaderStandardWork />}
    </div>
  );
}

export default function KaizenHub() {
  return (
    <Suspense fallback={<TabLoader />}>
      <KaizenHubInner />
    </Suspense>
  );
}
