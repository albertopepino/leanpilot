"use client";
import dynamic from "next/dynamic";
const KanbanBoard = dynamic(() => import("@/components/lean/KanbanBoard"), { ssr: false });
export default function KanbanRoute() {
  return <KanbanBoard />;
}
