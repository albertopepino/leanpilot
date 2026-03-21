"use client";
import dynamic from "next/dynamic";
const FMEABoard = dynamic(() => import("@/components/lean/FMEABoard"), { ssr: false });
export default function FMEAPage() {
  return <FMEABoard />;
}
