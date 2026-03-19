"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/stores/useI18n";
import { useRouter, usePathname } from "next/navigation";
import Sidebar from "@/components/ui/Sidebar";
import MobileNav from "@/components/ui/MobileNav";
import ConsentGate from "@/components/gdpr/ConsentGate";
import ErrorBoundary from "@/components/shared/ErrorBoundary";
import Logo from "@/components/ui/Logo";
import CommandPalette from "@/components/ui/CommandPalette";
import NotificationPanel from "@/components/ui/NotificationPanel";
import OfflineBanner from "@/components/ui/OfflineBanner";
import ToastContainer from "@/components/shared/Toast";
import QuickActionsFAB from "@/components/ui/QuickActionsFAB";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, loadUser } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  // Detect mobile operator mode preference
  const isMobileOperator = typeof window !== "undefined" &&
    window.matchMedia("(max-width: 768px)").matches &&
    user?.role === "Operator";

  // Show loading spinner
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="text-center">
          <div className="w-12 h-12 bg-brand-600 rounded-lg flex items-center justify-center text-white mx-auto mb-4">
            <Logo size={28} />
          </div>
          <h1 className="text-lg font-bold text-white mb-1 tracking-tight">LeanPilot</h1>
          <div className="w-32 h-0.5 mx-auto bg-white/10 rounded-full overflow-hidden mt-4">
            <div className="h-full bg-brand-500 rounded-full animate-[shimmer_1.5s_ease-in-out_infinite]" style={{ width: "60%" }} />
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <ConsentGate>
      <CommandPalette />
      <a
        href="#main-content"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-4 focus-visible:left-4 focus-visible:z-[100] focus-visible:px-4 focus-visible:py-2 focus-visible:rounded-lg focus-visible:bg-brand-600 focus-visible:text-white focus-visible:text-sm focus-visible:font-medium focus-visible:shadow-lg focus-visible:outline-none"
      >
        {t("common.skipToContent") || "Skip to content"}
      </a>
      <div className="flex min-h-screen bg-th-bg safe-area-all">
        {/* Desktop Sidebar */}
        <div className="hidden md:block">
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
        </div>

        {/* Main Content */}
        <main
          id="main-content"
          role="main"
          className="flex-1 min-w-0 overflow-auto"
        >
          {/* Top bar with notifications */}
          <div className="flex items-center justify-end px-4 md:px-6 lg:px-8 pt-3 pb-0 max-w-[1600px] mx-auto">
            <NotificationPanel />
          </div>
          <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto pt-0">
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </div>
        </main>

        {/* Mobile Bottom Nav (operators see simplified nav) */}
        <div className="md:hidden">
          <MobileNav isOperatorMode={isMobileOperator} />
        </div>

        {/* Quick Actions FAB */}
        <QuickActionsFAB />

        {/* Offline status banner */}
        <OfflineBanner />

        {/* Toast notifications */}
        <ToastContainer />
      </div>
    </ConsentGate>
  );
}
