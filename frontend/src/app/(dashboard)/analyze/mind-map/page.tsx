"use client";
import dynamic from "next/dynamic";

const MindMap = dynamic(() => import("@/components/lean/MindMap"), {
  loading: () => <div className="animate-pulse bg-th-bg-3 rounded-xl h-96" />,
  ssr: false,
});

export default function MindMapRoute() {
  return <MindMap />;
}
