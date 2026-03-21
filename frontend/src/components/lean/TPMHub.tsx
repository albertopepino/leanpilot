'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Suspense, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useI18n } from '@/stores/useI18n';
import { Wrench, ClipboardCheck, Loader2 } from 'lucide-react';
import ToolInfoCard from "@/components/ui/ToolInfoCard";
import { TOOL_INFO } from "@/lib/toolInfo";

const TPMDashboard = dynamic(() => import('@/components/lean/TPMDashboard'), {
  loading: () => <TabLoader />,
});
const CILTChecklist = dynamic(() => import('@/components/lean/CILTChecklist'), {
  loading: () => <TabLoader />,
});

type TabKey = 'equipment' | 'cilt';

const TAB_DEFS: { key: TabKey; labelKey: string; fallback: string; icon: React.ReactNode }[] = [
  { key: 'equipment', labelKey: 'maintenance.tpmEquipmentTab', fallback: 'Equipment / TPM', icon: <Wrench className="w-4 h-4" /> },
  { key: 'cilt', labelKey: 'maintenance.ciltTab', fallback: 'CILT Checklist', icon: <ClipboardCheck className="w-4 h-4" /> },
];

function TabLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
    </div>
  );
}

function TPMHubInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { t: i18nT } = useI18n();
  const activeTab = (searchParams.get('tab') as TabKey) || 'equipment';
  const TABS = TAB_DEFS.map((td) => ({ ...td, label: i18nT(td.labelKey) || td.fallback }));

  const setTab = useCallback((key: TabKey) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', key);
    router.replace(`${pathname}?${params.toString()}`);
  }, [searchParams, router, pathname]);

  return (
    <div className="space-y-6">
      <ToolInfoCard info={TOOL_INFO.tpm} />
      <div className="flex gap-1 overflow-x-auto border-b border-th-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all border-b-2 ${
              activeTab === t.key
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-th-text-3 hover:text-th-text-2'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'equipment' && <TPMDashboard />}
      {activeTab === 'cilt' && <CILTChecklist />}
    </div>
  );
}

export default function TPMHub() {
  return (
    <Suspense fallback={<TabLoader />}>
      <TPMHubInner />
    </Suspense>
  );
}
