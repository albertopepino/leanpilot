"use client";
import { useCallback } from "react";
import { useCelebration } from "@/hooks/useCelebration";
import Confetti from "@/components/ui/Confetti";
import AchievementToast from "@/components/ui/AchievementToast";

/**
 * Global celebration overlay — renders confetti + achievement toast.
 * Mount once in the dashboard layout so it is available on every page.
 */
export default function CelebrationOverlay() {
  const { celebration, showConfetti, dismiss } = useCelebration();

  const handleConfettiComplete = useCallback(() => {
    // Reset showConfetti so the next triggerCelebration causes a false→true transition
    useCelebration.setState({ showConfetti: false });
  }, []);

  return (
    <>
      <Confetti
        trigger={showConfetti}
        duration={2500}
        particleCount={50}
        onComplete={handleConfettiComplete}
      />
      <AchievementToast
        icon={celebration?.icon ?? ""}
        title={celebration?.title ?? ""}
        subtitle={celebration?.subtitle ?? ""}
        show={celebration !== null}
        onClose={dismiss}
      />
    </>
  );
}
