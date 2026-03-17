"use client";
import dynamic from "next/dynamic";

const SixSAudit = dynamic(() => import("@/components/lean/SixSAudit"), {
  loading: () => <div className="animate-pulse bg-th-bg-3 rounded-xl h-96" />,
  ssr: false,
});

export default function SixSRoute() {
  return <SixSAudit />;
}
