"use client";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  glow?: "none" | "brand" | "emerald" | "amber" | "rose";
  hover?: boolean;
}

const GLOW_CLASSES: Record<NonNullable<GlassCardProps["glow"]>, string> = {
  none: "",
  brand: "shadow-[0_0_20px_rgba(99,102,241,0.15)] dark:shadow-[0_0_20px_rgba(99,102,241,0.2)]",
  emerald: "shadow-[0_0_20px_rgba(16,185,129,0.15)] dark:shadow-[0_0_20px_rgba(16,185,129,0.2)]",
  amber: "shadow-[0_0_20px_rgba(245,158,11,0.15)] dark:shadow-[0_0_20px_rgba(245,158,11,0.2)]",
  rose: "shadow-[0_0_20px_rgba(244,63,94,0.15)] dark:shadow-[0_0_20px_rgba(244,63,94,0.2)]",
};

export default function GlassCard({ children, className = "", glow = "none", hover = false }: GlassCardProps) {
  return (
    <div
      className={[
        // Base glass styles — light
        "bg-white/65 dark:bg-[rgba(30,30,50,0.6)]",
        "backdrop-blur-[12px]",
        "border border-white/40 dark:border-white/[0.12]",
        "shadow-[0_4px_24px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.2)]",
        "rounded-xl",
        // Glow variant
        GLOW_CLASSES[glow],
        // Hover lift effect
        hover
          ? "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
          : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}
