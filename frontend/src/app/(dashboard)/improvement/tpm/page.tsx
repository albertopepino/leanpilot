"use client";
import dynamic from "next/dynamic";
const TPMDashboard = dynamic(() => import("@/components/lean/TPMDashboard"), { ssr: false });
export default function TPMRoute() {
  return <TPMDashboard />;
}
