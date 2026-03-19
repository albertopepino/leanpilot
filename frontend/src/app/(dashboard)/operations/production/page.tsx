"use client";
import dynamic from "next/dynamic";
const ProductionTracking = dynamic(() => import("@/components/lean/ProductionTracking"), { ssr: false });
export default function ProductionTrackingRoute() {
  return <ProductionTracking />;
}
