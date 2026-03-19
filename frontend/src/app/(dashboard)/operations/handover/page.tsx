"use client";
import dynamic from "next/dynamic";
const ShiftHandover = dynamic(() => import("@/components/lean/ShiftHandover"), { ssr: false });
export default function HandoverRoute() {
  return <ShiftHandover />;
}
