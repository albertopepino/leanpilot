"use client";
import dynamic from "next/dynamic";
const KaizenBoard = dynamic(() => import("@/components/lean/KaizenBoard"), { ssr: false });
export default function KaizenRoute() {
  return <KaizenBoard />;
}
