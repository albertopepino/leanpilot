"use client";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const ParetoChart = dynamic(() => import("@/components/lean/ParetoChart"), {
  loading: () => (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
    </div>
  ),
});

export default function ParetoPage() {
  return <ParetoChart />;
}
