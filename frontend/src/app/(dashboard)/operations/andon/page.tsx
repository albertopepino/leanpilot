"use client";
import dynamic from "next/dynamic";
const AndonBoard = dynamic(() => import("@/components/lean/AndonBoard"), { ssr: false });
export default function AndonRoute() {
  return <AndonBoard />;
}
