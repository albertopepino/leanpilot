"use client";
import dynamic from "next/dynamic";
const SafetyHub = dynamic(() => import("@/components/lean/SafetyHub"), { ssr: false });
export default function SafetyRoute() {
  return <SafetyHub />;
}
