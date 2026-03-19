"use client";
import dynamic from "next/dynamic";
const SQCDPBoard = dynamic(() => import("@/components/lean/SQCDPBoard"), { ssr: false });
export default function SQCDPRoute() {
  return <SQCDPBoard />;
}
