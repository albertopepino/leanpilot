"use client";
import dynamic from "next/dynamic";
const OEEDashboard = dynamic(() => import("@/components/dashboard/OEEDashboard"), { ssr: false });
export default function OEERoute() {
  return <OEEDashboard />;
}
