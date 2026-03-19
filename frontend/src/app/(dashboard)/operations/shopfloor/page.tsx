"use client";
import dynamic from "next/dynamic";
const ShopFloorHub = dynamic(() => import("@/components/shopfloor/ShopFloorHub"), { ssr: false });
export default function ShopFloorRoute() {
  return <ShopFloorHub />;
}
