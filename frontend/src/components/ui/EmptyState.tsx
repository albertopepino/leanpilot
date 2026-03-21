"use client";

interface EmptyStateProps {
  variant: "kaizen" | "production" | "safety" | "quality" | "general";
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/* ── SVG illustrations per variant ── */

function KaizenSVG() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" className="empty-state-illustration">
      {/* Lightbulb body */}
      <path
        d="M60 20c-14.36 0-26 11.64-26 26 0 9.6 5.2 18 12.96 22.56V78a4 4 0 004 4h18.08a4 4 0 004-4v-9.44C80.8 64 86 55.6 86 46c0-14.36-11.64-26-26-26z"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-brand-400"
      />
      {/* Filament */}
      <path d="M52 82h16M54 88h12M56 94h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-brand-400" />
      {/* Sparkle rays */}
      <line x1="60" y1="6" x2="60" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-amber-400" />
      <line x1="28" y1="18" x2="32" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-amber-400" />
      <line x1="92" y1="18" x2="88" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-amber-400" />
      <line x1="18" y1="46" x2="24" y2="46" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-amber-400" />
      <line x1="96" y1="46" x2="102" y2="46" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-amber-400" />
      {/* Small sparkle dots */}
      <circle cx="38" cy="10" r="2" className="fill-amber-300" />
      <circle cx="86" cy="12" r="1.5" className="fill-amber-300" />
      <circle cx="100" cy="32" r="2" className="fill-amber-300" />
    </svg>
  );
}

function ProductionSVG() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" className="empty-state-illustration">
      {/* Factory building */}
      <rect x="14" y="50" width="28" height="50" rx="2" stroke="currentColor" strokeWidth="2.5" className="text-brand-400" />
      <rect x="50" y="36" width="28" height="64" rx="2" stroke="currentColor" strokeWidth="2.5" className="text-brand-400" />
      {/* Chimney */}
      <rect x="86" y="22" width="14" height="78" rx="2" stroke="currentColor" strokeWidth="2.5" className="text-brand-400" />
      {/* Smoke */}
      <path d="M93 22c0-6 4-10 8-8s2 8-2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-th-text-3" />
      {/* Conveyor belt */}
      <line x1="10" y1="100" x2="110" y2="100" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-th-text-3" />
      <circle cx="24" cy="100" r="4" stroke="currentColor" strokeWidth="2" className="text-th-text-3" />
      <circle cx="96" cy="100" r="4" stroke="currentColor" strokeWidth="2" className="text-th-text-3" />
      {/* Windows */}
      <rect x="22" y="62" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" className="text-brand-300" />
      <rect x="58" y="48" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" className="text-brand-300" />
      <rect x="66" y="48" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" className="text-brand-300" />
    </svg>
  );
}

function SafetySVG() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" className="empty-state-illustration">
      {/* Shield */}
      <path
        d="M60 14L24 30v24c0 22 15.36 42.56 36 48 20.64-5.44 36-26 36-48V30L60 14z"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-emerald-400"
      />
      {/* Checkmark */}
      <path
        d="M44 58l10 10 22-22"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-emerald-500"
      />
    </svg>
  );
}

function QualitySVG() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" className="empty-state-illustration">
      {/* Magnifying glass */}
      <circle cx="52" cy="52" r="26" stroke="currentColor" strokeWidth="2.5" className="text-brand-400" />
      <line x1="72" y1="72" x2="100" y2="100" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-brand-400" />
      {/* Checkmark inside */}
      <path
        d="M40 52l8 8 16-16"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-emerald-500"
      />
    </svg>
  );
}

function GeneralSVG() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" className="empty-state-illustration">
      {/* Clipboard */}
      <rect x="28" y="20" width="64" height="84" rx="6" stroke="currentColor" strokeWidth="2.5" className="text-brand-400" />
      {/* Clipboard top clip */}
      <rect x="44" y="12" width="32" height="16" rx="4" stroke="currentColor" strokeWidth="2" className="text-brand-400" />
      {/* Plus sign */}
      <line x1="60" y1="52" x2="60" y2="80" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-brand-300" />
      <line x1="46" y1="66" x2="74" y2="66" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-brand-300" />
    </svg>
  );
}

const ILLUSTRATIONS: Record<EmptyStateProps["variant"], () => React.JSX.Element> = {
  kaizen: KaizenSVG,
  production: ProductionSVG,
  safety: SafetySVG,
  quality: QualitySVG,
  general: GeneralSVG,
};

export default function EmptyState({ variant, title, description, actionLabel, onAction }: EmptyStateProps) {
  const Illustration = ILLUSTRATIONS[variant];

  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      {/* Animated SVG illustration */}
      <div className="mb-6 empty-state-float">
        <Illustration />
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold text-th-text mb-1">{title}</h3>

      {/* Description */}
      {description && (
        <p className="text-sm text-th-text-3 max-w-sm mb-4">{description}</p>
      )}

      {/* CTA button */}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-2 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors shadow-sm"
        >
          {actionLabel}
        </button>
      )}

      {/* Float animation */}
      <style>{`
        @keyframes emptyStateFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        .empty-state-float {
          animation: emptyStateFloat 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
