"use client";
import { useEffect, useState, useMemo, Suspense } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/stores/useI18n";
import { useSite } from "@/stores/useSite";
import { organizationApi } from "@/lib/api";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Sidebar from "@/components/ui/Sidebar";
import MobileNav from "@/components/ui/MobileNav";
import ConsentGate from "@/components/gdpr/ConsentGate";
import ErrorBoundary from "@/components/shared/ErrorBoundary";
import Logo from "@/components/ui/Logo";
import CommandPalette from "@/components/ui/CommandPalette";
import NotificationPanel from "@/components/ui/NotificationPanel";
import SiteSwitcher from "@/components/ui/SiteSwitcher";
import OfflineBanner from "@/components/ui/OfflineBanner";
import ToastContainer from "@/components/shared/Toast";
// QuickActionsFAB removed per user preference
import CelebrationOverlay from "@/components/ui/CelebrationOverlay";
import { useCelebration } from "@/hooks/useCelebration";

const CORP_ROLES = ["admin", "plant_manager", "manager"];

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const { user, loading, loadUser } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { sites, setSites } = useSite();
  const { triggerCelebration } = useCelebration();
  const searchParams = useSearchParams();
  const isDisplayMode = searchParams.get("display") === "true";

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  // Superadmin initial redirect is handled by the login page — no redirect here
  // to avoid bounce loops when superadmin intentionally visits /operations/home

  // Bootstrap multi-site: load organization sites after user is confirmed
  useEffect(() => {
    if (!user) return;
    organizationApi.getMyOrg()
      .then((res) => {
        const orgSites = res.data?.sites;
        if (orgSites?.length) {
          setSites(orgSites);
        }
      })
      .catch(() => {
        // Single-factory installs have no org — ignore
      });
  }, [user?.id, setSites]);

  // Consistent hasCorpAccess — shared between SiteSwitcher and Sidebar
  const hasCorpAccess = useMemo(() => {
    const role = user?.role?.toLowerCase() ?? "";
    return CORP_ROLES.includes(role) || sites.length > 1;
  }, [user?.role, sites.length]);

  // Detect mobile operator mode — reactive to resize
  const [isMobileOperator, setIsMobileOperator] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || user?.role !== "Operator") {
      setIsMobileOperator(false);
      return;
    }
    const mq = window.matchMedia("(max-width: 768px)");
    const handler = (e: MediaQueryListEvent | MediaQueryList) => setIsMobileOperator(e.matches);
    handler(mq);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [user?.role]);

  // Welcome celebration on first-ever dashboard visit
  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined") return;
    if (!localStorage.getItem("leanpilot_welcome_shown")) {
      triggerCelebration({
        type: "first-login",
        icon: "\u{1F680}",
        title: "Welcome to LeanPilot!",
        subtitle: "Your lean journey starts here",
      });
      localStorage.setItem("leanpilot_welcome_shown", "1");
    }
  }, [user, triggerCelebration]);

  // Show loading spinner — uses th-* theme classes
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-th-bg">
        <div className="text-center">
          <div className="w-12 h-12 bg-brand-600 rounded-lg flex items-center justify-center text-white mx-auto mb-4">
            <Logo size={28} />
          </div>
          <h1 className="text-lg font-bold text-th-text mb-1 tracking-tight">LeanPilot</h1>
          <div className="w-32 h-0.5 mx-auto bg-th-border rounded-full overflow-hidden mt-4">
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
        {/* Desktop Sidebar — hidden in display mode */}
        {!isDisplayMode && (
          <div className="hidden md:block">
            <Sidebar
              collapsed={sidebarCollapsed}
              onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            />
          </div>
        )}

        {/* Main Content */}
        <main
          id="main-content"
          role="main"
          className="flex-1 min-w-0 overflow-auto"
        >
          {/* Top bar — hidden in display mode */}
          {!isDisplayMode && (
            <div className="flex items-center justify-end gap-3 px-4 md:px-6 lg:px-8 pt-3 pb-0 max-w-[1600px] mx-auto">
              <SiteSwitcher hasCorpAccess={hasCorpAccess} />
              <NotificationPanel />
            </div>
          )}
          <div className={isDisplayMode ? "p-0" : "p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto pt-0"}>
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </div>
        </main>

        {/* Mobile Bottom Nav — hidden in display mode */}
        {!isDisplayMode && (
          <div className="md:hidden">
            <MobileNav isOperatorMode={isMobileOperator} />
          </div>
        )}

        {/* QuickActionsFAB removed */}

        {/* Offline status banner */}
        <OfflineBanner />

        {/* Toast notifications */}
        <ToastContainer />

        {/* Gamification celebrations */}
        <CelebrationOverlay />
      </div>
    </ConsentGate>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-th-bg">
        <div className="w-12 h-12 bg-brand-600 rounded-lg flex items-center justify-center text-white mx-auto">
          <Logo size={28} />
        </div>
      </div>
    }>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </Suspense>
  );
}
