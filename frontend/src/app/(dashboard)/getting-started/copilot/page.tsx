"use client";
import dynamic from "next/dynamic";

const FactoryCopilot = dynamic(() => import("@/components/ai/FactoryCopilot"), {
  loading: () => <div className="animate-pulse bg-th-bg-3 rounded-xl h-96" />,
  ssr: false,
});

export default function CopilotRoute() {
  return <FactoryCopilot />;
}
