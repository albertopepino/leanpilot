"use client";
import dynamic from "next/dynamic";
const PokaYoke = dynamic(() => import("@/components/lean/PokaYoke"), { ssr: false });
export default function PokaYokeRoute() {
  return <PokaYoke />;
}
