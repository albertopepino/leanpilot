"use client";
import dynamic from "next/dynamic";

const VSMEditor = dynamic(() => import("@/components/lean/VSMEditor"), {
  loading: () => <div className="animate-pulse bg-th-bg-3 rounded-xl h-96" />,
  ssr: false,
});

export default function VSMRoute() {
  return <VSMEditor />;
}
