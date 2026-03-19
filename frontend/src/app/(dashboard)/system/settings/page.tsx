"use client";
import dynamic from "next/dynamic";
const SettingsHub = dynamic(() => import("@/components/settings/SettingsHub"), { ssr: false });
export default function SettingsRoute() {
  return <SettingsHub />;
}
