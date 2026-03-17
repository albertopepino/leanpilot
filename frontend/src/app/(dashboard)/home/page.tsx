"use client";
import { useRouter } from "next/navigation";
import { useCallback, useState, useEffect } from "react";
import HomePage from "@/components/dashboard/HomePage";
import OnboardingTutorial, { isOnboardingComplete } from "@/components/onboarding/OnboardingTutorial";
import { useAuth } from "@/hooks/useAuth";
import { viewToRoute } from "@/lib/routes";

export default function HomeRoute() {
  const router = useRouter();
  const { user } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (user && !isOnboardingComplete(user.id)) {
      setShowOnboarding(true);
    }
  }, [user]);

  const navigate = useCallback((viewId: string) => {
    router.push(viewToRoute(viewId));
  }, [router]);

  if (showOnboarding) {
    return (
      <OnboardingTutorial
        onNavigate={(v) => { setShowOnboarding(false); navigate(v); }}
        onComplete={() => setShowOnboarding(false)}
      />
    );
  }

  return <HomePage onNavigate={navigate} />;
}
