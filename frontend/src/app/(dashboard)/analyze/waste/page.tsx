"use client";
import dynamic from "next/dynamic";

const WasteTracker = dynamic(() => import("@/components/lean/WasteTracker"), {
  loading: () => <div className="animate-pulse space-y-4 p-6"><div className="h-8 bg-th-bg-3 rounded w-1/3" /><div className="h-64 bg-th-bg-3 rounded" /></div>,
});

export default function WasteRoute() {
  return <WasteTracker />;
}
