"use client";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import dynamic from "next/dynamic";
import { viewToRoute } from "@/lib/routes";

const OEEDashboard = dynamic(() => import("@/components/dashboard/OEEDashboard"), {
  loading: () => <div className="animate-pulse bg-th-bg-3 rounded-xl h-96" />,
  ssr: false,
});

export default function OEERoute() {
  const router = useRouter();
  const navigate = useCallback((viewId: string) => {
    router.push(viewToRoute(viewId));
  }, [router]);

  return <OEEDashboard onNavigate={navigate} />;
}
