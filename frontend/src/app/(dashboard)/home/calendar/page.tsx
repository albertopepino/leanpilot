"use client";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import MasterCalendar from "@/components/calendar/MasterCalendar";
import { viewToRoute } from "@/lib/routes";

export default function CalendarRoute() {
  const router = useRouter();
  const navigate = useCallback((viewId: string) => {
    router.push(viewToRoute(viewId));
  }, [router]);

  return <MasterCalendar onNavigate={navigate} />;
}
