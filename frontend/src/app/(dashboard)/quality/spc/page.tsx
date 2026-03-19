"use client";
import dynamic from "next/dynamic";
const SPCCharts = dynamic(() => import("@/components/quality/SPCCharts"), { ssr: false });
export default function SPCRoute() {
  return <SPCCharts />;
}
