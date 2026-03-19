"use client";
import dynamic from "next/dynamic";
const A3Report = dynamic(() => import("@/components/lean/A3Report"), { ssr: false });
export default function A3Route() {
  return <A3Report />;
}
