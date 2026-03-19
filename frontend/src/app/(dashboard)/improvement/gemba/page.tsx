"use client";
import dynamic from "next/dynamic";
const GembaWalk = dynamic(() => import("@/components/lean/GembaWalk"), { ssr: false });
export default function GembaRoute() {
  return <GembaWalk />;
}
