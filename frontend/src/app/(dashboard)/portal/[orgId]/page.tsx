"use client";
import { useParams } from "next/navigation";
import ClientDetailView from "@/components/portal/ClientDetailView";

export default function ClientDetailPage() {
  const params = useParams();
  const orgId = Number(params.orgId);
  return <ClientDetailView orgId={orgId} />;
}
