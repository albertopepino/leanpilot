"use client";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { viewToRoute } from "@/lib/routes";

const HomePage = dynamic(() => import("@/components/dashboard/HomePage"), { ssr: false });
const OperatorHome = dynamic(() => import("@/components/dashboard/OperatorHome"), { ssr: false });
const SupervisorHome = dynamic(() => import("@/components/dashboard/SupervisorHome"), { ssr: false });

/* ─── Role → Dashboard mapping ─── */
const OPERATOR_ROLES = ["operator", "shopfloor_operator"];
const SUPERVISOR_ROLES = ["line_supervisor", "supervisor", "quality_supervisor", "quality_inspector"];
// Manager, plant_manager, admin, viewer → full HomePage (manager view)

export default function OperationsHomeRoute() {
  const router = useRouter();
  const { user } = useAuth();
  const navigate = (view: string) => router.push(viewToRoute(view));
  const role = user?.role?.toLowerCase() ?? "";

  if (OPERATOR_ROLES.includes(role)) {
    return <OperatorHome onNavigate={navigate} />;
  }

  if (SUPERVISOR_ROLES.includes(role)) {
    return <SupervisorHome onNavigate={navigate} />;
  }

  // Manager, plant_manager, admin, viewer → full manager dashboard
  return <HomePage onNavigate={navigate} />;
}
