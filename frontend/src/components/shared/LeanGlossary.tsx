"use client";
import { useState, useRef, useEffect, type ReactNode } from "react";
import { useI18n } from "@/stores/useI18n";

/* ------------------------------------------------------------------ */
/*  Glossary Entries                                                   */
/* ------------------------------------------------------------------ */

export const LEAN_GLOSSARY: Record<string, { fullNameKey: string; descriptionKey: string }> = {
  SMED: { fullNameKey: "glossary.smedFull", descriptionKey: "glossary.smedDesc" },
  TPM: { fullNameKey: "glossary.tpmFull", descriptionKey: "glossary.tpmDesc" },
  OEE: { fullNameKey: "glossary.oeeFull", descriptionKey: "glossary.oeeDesc" },
  SQCDP: { fullNameKey: "glossary.sqcdpFull", descriptionKey: "glossary.sqcdpDesc" },
  VSM: { fullNameKey: "glossary.vsmFull", descriptionKey: "glossary.vsmDesc" },
  CILT: { fullNameKey: "glossary.ciltFull", descriptionKey: "glossary.ciltDesc" },
  LSW: { fullNameKey: "glossary.lswFull", descriptionKey: "glossary.lswDesc" },
  NCR: { fullNameKey: "glossary.ncrFull", descriptionKey: "glossary.ncrDesc" },
  CAPA: { fullNameKey: "glossary.capaFull", descriptionKey: "glossary.capaDesc" },
  SPC: { fullNameKey: "glossary.spcFull", descriptionKey: "glossary.spcDesc" },
  DMAIC: { fullNameKey: "glossary.dmaicFull", descriptionKey: "glossary.dmaicDesc" },
  TIMWOODS: { fullNameKey: "glossary.timwoodsFull", descriptionKey: "glossary.timwoodsDesc" },
  "5S": { fullNameKey: "glossary.fivesFull", descriptionKey: "glossary.fivesDesc" },
  "6S": { fullNameKey: "glossary.sixsFull", descriptionKey: "glossary.sixsDesc" },
  BOM: { fullNameKey: "glossary.bomFull", descriptionKey: "glossary.bomDesc" },
  QC: { fullNameKey: "glossary.qcFull", descriptionKey: "glossary.qcDesc" },
  PDCA: { fullNameKey: "glossary.pdcaFull", descriptionKey: "glossary.pdcaDesc" },
  Gemba: { fullNameKey: "glossary.gembaFull", descriptionKey: "glossary.gembaDesc" },
  Andon: { fullNameKey: "glossary.andonFull", descriptionKey: "glossary.andonDesc" },
  Kaizen: { fullNameKey: "glossary.kaizenFull", descriptionKey: "glossary.kaizenDesc" },
  A3: { fullNameKey: "glossary.a3Full", descriptionKey: "glossary.a3Desc" },
  "5Why": { fullNameKey: "glossary.fiveWhyFull", descriptionKey: "glossary.fiveWhyDesc" },
  FiveWhy: { fullNameKey: "glossary.fiveWhyFull", descriptionKey: "glossary.fiveWhyDesc" },
  Ishikawa: { fullNameKey: "glossary.ishikawaFull", descriptionKey: "glossary.ishikawaDesc" },
  Pareto: { fullNameKey: "glossary.paretoFull", descriptionKey: "glossary.paretoDesc" },
  PokaYoke: { fullNameKey: "glossary.pokayokeFull", descriptionKey: "glossary.pokayokeDesc" },
  "Poka-Yoke": { fullNameKey: "glossary.pokayokeFull", descriptionKey: "glossary.pokayokeDesc" },
  Muda: { fullNameKey: "glossary.mudaFull", descriptionKey: "glossary.mudaDesc" },
  Mura: { fullNameKey: "glossary.muraFull", descriptionKey: "glossary.muraDesc" },
  Muri: { fullNameKey: "glossary.muriFull", descriptionKey: "glossary.muriDesc" },
  Heijunka: { fullNameKey: "glossary.heijunkaFull", descriptionKey: "glossary.heijunkaDesc" },
  Jidoka: { fullNameKey: "glossary.jidokaFull", descriptionKey: "glossary.jidokaDesc" },
  "Takt Time": { fullNameKey: "glossary.taktTimeFull", descriptionKey: "glossary.taktTimeDesc" },
  "Cycle Time": { fullNameKey: "glossary.cycleTimeFull", descriptionKey: "glossary.cycleTimeDesc" },
  "Lead Time": { fullNameKey: "glossary.leadTimeFull", descriptionKey: "glossary.leadTimeDesc" },
  Bottleneck: { fullNameKey: "glossary.bottleneckFull", descriptionKey: "glossary.bottleneckDesc" },
  Constraint: { fullNameKey: "glossary.constraintFull", descriptionKey: "glossary.constraintDesc" },
  WIP: { fullNameKey: "glossary.wipFull", descriptionKey: "glossary.wipDesc" },
};

/* ------------------------------------------------------------------ */
/*  LeanTooltip Component                                              */
/* ------------------------------------------------------------------ */

interface LeanTooltipProps {
  acronym: string;
  children: ReactNode;
  className?: string;
}

export function LeanTooltip({ acronym, children, className = "" }: LeanTooltipProps) {
  const { t } = useI18n();
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<"top" | "bottom">("top");
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const entry = LEAN_GLOSSARY[acronym];
  if (!entry) return <>{children}</>;

  const show = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      // Determine position based on viewport space
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setPosition(rect.top < 120 ? "bottom" : "top");
      }
      setIsVisible(true);
    }, 300);
  };

  const hide = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsVisible(false);
    }, 150);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <span
      ref={triggerRef}
      className={`relative inline-flex ${className}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {isVisible && (
        <div
          ref={tooltipRef}
          role="tooltip"
          onMouseEnter={show}
          onMouseLeave={hide}
          className={`absolute z-[200] w-64 px-3 py-2.5 rounded-lg bg-th-bg border border-th-border shadow-lg animate-in fade-in duration-150 ${
            position === "top"
              ? "bottom-full mb-2 left-1/2 -translate-x-1/2"
              : "top-full mt-2 left-1/2 -translate-x-1/2"
          }`}
        >
          <p className="text-xs font-bold text-brand-500 mb-0.5">
            {acronym}
          </p>
          <p className="text-xs font-semibold text-th-text mb-1">
            {t(entry.fullNameKey)}
          </p>
          <p className="text-[11px] text-th-text-2 leading-relaxed">
            {t(entry.descriptionKey)}
          </p>
          {/* Arrow */}
          <div
            className={`absolute w-2 h-2 bg-th-bg border-th-border rotate-45 left-1/2 -translate-x-1/2 ${
              position === "top"
                ? "bottom-[-5px] border-b border-r"
                : "top-[-5px] border-t border-l"
            }`}
          />
        </div>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Default export                                                     */
/* ------------------------------------------------------------------ */

export default LeanTooltip;
