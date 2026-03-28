"use client";
import { useScrollReveal } from "@/hooks/useScrollReveal";

interface Props { t: (key: string) => string; }

const badges = [
  { key: "iso", icon: "shield" }, { key: "iatf", icon: "award" },
  { key: "gdpr", icon: "lock" }, { key: "cloud", icon: "cloud" },
] as const;

function BadgeIcon({ type }: { type: string }) {
  const cls = "w-5 h-5";
  switch (type) {
    case "shield": return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2l8 4v6c0 5.25-3.5 9.74-8 11-4.5-1.26-8-5.75-8-11V6l8-4z" /><path d="M9 12l2 2 4-4" /></svg>;
    case "award": return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="9" r="6" /><path d="M8.5 14.5L7 22l5-3 5 3-1.5-7.5" /></svg>;
    case "lock": return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></svg>;
    case "cloud": return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6.5 19a4.5 4.5 0 01-.42-8.98 7 7 0 0113.84 0A4.5 4.5 0 0119.5 19H6.5z" /></svg>;
    default: return null;
  }
}

export default function TrustedBy({ t }: Props) {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.3 });
  return (
    <section ref={ref} className="relative py-8 border-y border-gray-100 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <div className={`flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-14 transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <span className="text-[11px] text-gray-400 uppercase tracking-[0.2em] font-semibold whitespace-nowrap">{t("trusted.title")}</span>
          <div className="h-5 w-px bg-gray-200 hidden sm:block" />
          <div className="flex flex-wrap items-center justify-center gap-10 sm:gap-14">
            {badges.map((badge, i) => (
              <div
                key={badge.key}
                className={`flex items-center gap-2.5 text-gray-400 hover:text-gray-600 transition-all duration-500 hover:scale-105 cursor-default ${isVisible ? "opacity-100" : "opacity-0"}`}
                style={{ transitionDelay: `${300 + i * 120}ms` }}
              >
                <div className="text-indigo-400"><BadgeIcon type={badge.icon} /></div>
                <span className="text-sm font-medium">{t(`trusted.${badge.key}`)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
