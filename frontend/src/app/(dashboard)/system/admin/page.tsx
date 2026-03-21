"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import AdminPanel from "@/components/admin/AdminPanel";

export default function AdminRoute() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && user.role !== "admin") {
      router.replace("/operations/home");
    }
  }, [user, router]);

  if (!user || user.role !== "admin") {
    return null;
  }

  return <AdminPanel />;
}
