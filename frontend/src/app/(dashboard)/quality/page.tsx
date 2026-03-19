"use client";
import dynamic from "next/dynamic";
const QCDashboard = dynamic(() => import("@/components/quality/QCDashboard"), { ssr: false });
export default function QualityRoute() {
  return <QCDashboard />;
}
