"use client";
import dynamic from "next/dynamic";
const SixSAudit = dynamic(() => import("@/components/lean/SixSAudit"), { ssr: false });
export default function SixSRoute() {
  return <SixSAudit />;
}
