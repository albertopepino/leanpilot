"use client";
import dynamic from "next/dynamic";
const SMEDTracker = dynamic(() => import("@/components/lean/SMEDTracker"), { ssr: false });
export default function SMEDRoute() {
  return <SMEDTracker />;
}
