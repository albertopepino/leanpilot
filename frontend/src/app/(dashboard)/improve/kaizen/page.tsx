"use client";
import dynamic from "next/dynamic";

const KaizenBoard = dynamic(() => import("@/components/lean/KaizenBoard"), {
  loading: () => <div className="animate-pulse bg-th-bg-3 rounded-xl h-96" />,
  ssr: false,
});

export default function KaizenRoute() {
  return <KaizenBoard />;
}
