import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LeanPilot — Transform Your Factory with Digital Lean Tools",
  description:
    "17 digital lean manufacturing tools for SME factories. OEE dashboards, 5S audits, SMED tracking, AI-powered insights. Start your lean transformation today.",
  openGraph: {
    title: "LeanPilot — Digital Lean Manufacturing for Smart Factories",
    description:
      "The all-in-one platform that brings lean methodology to life. Built for factories with 10-500 employees.",
    type: "website",
  },
};

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
