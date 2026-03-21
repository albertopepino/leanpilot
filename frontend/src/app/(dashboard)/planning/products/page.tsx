"use client";
import { useState, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { useI18n } from "@/stores/useI18n";
import { Package, ClipboardList, Loader2 } from "lucide-react";

const ProductCatalog = dynamic(() => import("@/components/manufacturing/ProductCatalog"), {
  ssr: false,
  loading: () => <TabLoader />,
});
const BOMManager = dynamic(() => import("@/components/manufacturing/BOMManager"), {
  ssr: false,
  loading: () => <TabLoader />,
});

function TabLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
    </div>
  );
}

type TabKey = "products" | "bom";

const TAB_DEFS: { key: TabKey; labelKey: string; fallback: string; icon: React.ReactNode }[] = [
  { key: "products", labelKey: "common.tabProducts", fallback: "Products", icon: <Package className="w-4 h-4" /> },
  { key: "bom", labelKey: "common.tabBOM", fallback: "Bill of Materials", icon: <ClipboardList className="w-4 h-4" /> },
];

function ProductsPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();
  const activeTab = (searchParams.get("tab") as TabKey) || "products";
  const TABS = TAB_DEFS.map((td) => ({ ...td, label: t(td.labelKey) || td.fallback }));

  const setTab = (key: TabKey) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", key);
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-1 overflow-x-auto border-b border-th-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all border-b-2 ${
              activeTab === t.key
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "products" && <ProductCatalog />}
      {activeTab === "bom" && <BOMManager />}
    </div>
  );
}

export default function ProductsRoute() {
  return (
    <Suspense fallback={<TabLoader />}>
      <ProductsPageInner />
    </Suspense>
  );
}
