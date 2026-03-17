import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  variant?: "flat" | "elevated" | "interactive" | "glass";
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
  onClick?: () => void;
}

const variantStyles = {
  flat: "bg-th-card border border-th-card-border",
  elevated: "bg-th-card border border-th-card-border shadow-card",
  interactive: "bg-th-card border border-th-card-border shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all cursor-pointer",
  glass: "bg-th-card/80 backdrop-blur-md border border-th-card-border/50",
};

const paddingStyles = {
  none: "",
  sm: "p-3",
  md: "p-4 md:p-5",
  lg: "p-5 md:p-6",
};

export default function Card({ children, variant = "flat", className = "", padding = "md", onClick }: CardProps) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      onClick={onClick}
      className={`rounded-xl ${variantStyles[variant]} ${paddingStyles[padding]} ${className}`}
      {...(onClick ? { type: "button" as const } : {})}
    >
      {children}
    </Wrapper>
  );
}
