"use client";
import {
  Sparkles, Lightbulb, Settings, BarChart3, FileText,
  Search, Shield, ShieldCheck, Users, Truck, Target,
  ArrowRightLeft, Cpu,
} from "lucide-react";

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  Sparkles, Lightbulb, Settings, BarChart3, FileText,
  Search, Shield, ShieldCheck, Users, Truck, Target,
  ArrowRightLeft, Cpu,
};

export function getCategoryIcon(iconName: string, className = "w-5 h-5"): React.ReactNode {
  const Icon = ICON_MAP[iconName] || Target;
  return <Icon className={className} />;
}
