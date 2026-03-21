'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Suspense, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Factory, ArrowRightLeft, Loader2 } from 'lucide-react';
import { useI18n } from '@/stores/useI18n';

const ShopFloorOps = dynamic(() => import('@/components/shopfloor/ShopFloorOps'), {
  loading: () => <TabLoader />,
});
const ShiftHandover = dynamic(() => import('@/components/lean/ShiftHandover'), {
  loading: () => <TabLoader />,
});

type TabKey = 'ops' | 'handover';

const TAB_KEYS: { key: TabKey; labelKey: string; icon: React.ReactNode }[] = [
  { key: 'ops', labelKey: 'common.tabShopFloorOps', icon: <Factory className="w-4 h-4" /> },
  { key: 'handover', labelKey: 'common.tabShiftHandover', icon: <ArrowRightLeft className="w-4 h-4" /> },
];

function TabLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
    </div>
  );
}

function ShopFloorHubInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();
  const activeTab = (searchParams.get('tab') as TabKey) || 'ops';

  const setTab = useCallback((key: TabKey) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', key);
    router.replace(`${pathname}?${params.toString()}`);
  }, [searchParams, router, pathname]);

  return (
    <div className="space-y-6">
      <div className="flex gap-1 overflow-x-auto border-b border-th-border">
        {TAB_KEYS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all border-b-2 ${
              activeTab === tab.key
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-th-text-3 hover:text-th-text-2'
            }`}
          >
            {tab.icon}
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {activeTab === 'ops' && <ShopFloorOps />}
      {activeTab === 'handover' && <ShiftHandover />}
    </div>
  );
}

export default function ShopFloorHub() {
  return (
    <Suspense fallback={<TabLoader />}>
      <ShopFloorHubInner />
    </Suspense>
  );
}
