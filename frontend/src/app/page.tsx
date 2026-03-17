"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import Logo from "@/components/ui/Logo";

/**
 * Root page — redirects to /home (authenticated) or /login (unauthenticated).
 * The old monolith view-switcher has been replaced by App Router file-based routing.
 */
export default function RootPage() {
  const { user, loading, loadUser } = useAuth();
  const router = useRouter();

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.replace("/home");
      } else {
        router.replace("/login");
      }
    }
  }, [loading, user, router]);

  // Show branded loading while determining auth state
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-brand-900 via-[#1e1b4b] to-brand-800 relative overflow-hidden">
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl animate-pulse-slow" />
      <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-purple-500/8 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: "1.5s" }} />
      <div className="text-center relative z-10">
        <div className="relative mx-auto mb-6 w-20 h-20">
          <div className="absolute inset-0 bg-brand-500/20 rounded-2xl blur-xl animate-pulse-slow" />
          <div className="relative w-20 h-20 bg-gradient-to-br from-brand-400 to-brand-600 rounded-2xl flex items-center justify-center text-white shadow-glow">
            <Logo size={44} />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-white mb-1 tracking-tight">LeanPilot</h1>
        <p className="text-[10px] text-brand-300/60 uppercase tracking-[0.25em] mb-8">Lean Operations OS</p>
        <div className="w-48 h-0.5 mx-auto bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-brand-400 to-brand-500 rounded-full animate-[shimmer_1.5s_ease-in-out_infinite]" style={{ width: "60%" }} />
        </div>
      </div>
    </div>
  );
}
