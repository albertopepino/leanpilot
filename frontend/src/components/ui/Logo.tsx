"use client";

interface LogoProps {
  size?: number;
  className?: string;
}

/**
 * LeanPilot logo mark — bold angular geometric shape
 * inspired by stacked chevrons / abstract "LP" letterform.
 * Works at any size (favicon 16px to sidebar 40px+).
 * Adapts to theme: black in light mode, white in dark mode.
 */
export default function Logo({ size = 40, className = "" }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Top parallelogram — angled bar */}
      <path
        d="M38 8L54 8L36 28L20 28Z"
        fill="currentColor"
      />
      {/* Middle parallelogram — angled bar */}
      <path
        d="M30 24L50 24L32 44L12 44Z"
        fill="currentColor"
      />
      {/* Bottom horizontal bar — base/ground */}
      <path
        d="M10 50L42 50L42 58L10 58Z"
        fill="currentColor"
      />
    </svg>
  );
}
