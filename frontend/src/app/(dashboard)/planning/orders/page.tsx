"use client";
import dynamic from "next/dynamic";
const ProductionOrderBoard = dynamic(() => import("@/components/manufacturing/ProductionOrderBoard"), { ssr: false });
export default function OrdersRoute() {
  return <ProductionOrderBoard />;
}
