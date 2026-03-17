import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LeanPilot — Live Demo",
  description:
    "Try LeanPilot's 17 digital lean tools: OEE dashboards, Kaizen boards, 5 Why analysis, Andon systems, and AI-powered factory copilot. No signup required.",
  openGraph: {
    title: "LeanPilot — Live Demo",
    description: "Try 17 lean manufacturing tools for free. No signup required.",
  },
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
