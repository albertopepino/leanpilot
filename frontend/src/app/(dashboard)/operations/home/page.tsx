"use client";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { viewToRoute } from "@/lib/routes";
const HomePage = dynamic(() => import("@/components/dashboard/HomePage"), { ssr: false });
export default function OperationsHomeRoute() {
  const router = useRouter();
  return <HomePage onNavigate={(view: string) => router.push(viewToRoute(view))} />;
}
