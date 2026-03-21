"use client";
import dynamic from "next/dynamic";
const ProductionMonitor = dynamic(() => import("@/components/lean/ProductionMonitor"), { ssr: false });
export default function ProductionRoute() {
  return <ProductionMonitor />;
}
