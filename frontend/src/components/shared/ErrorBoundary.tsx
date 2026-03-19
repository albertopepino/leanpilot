"use client";
import { Component, type ReactNode } from "react";
import { useI18n } from "@/stores/useI18n";
import { AlertTriangle, RefreshCw } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Inner presentational component (uses hooks)                        */
/* ------------------------------------------------------------------ */

function ErrorFallback({ onReset }: { onReset: () => void }) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] p-8 text-center" role="alert">
      <div className="w-14 h-14 rounded-full bg-rose-500/10 flex items-center justify-center mb-4">
        <AlertTriangle size={24} className="text-rose-500" />
      </div>
      <h2 className="text-lg font-bold text-th-text mb-2">
        {t("common.errorBoundaryTitle")}
      </h2>
      <p className="text-sm text-th-text-2 mb-4 max-w-md">
        {t("common.errorBoundaryMessage")}
      </p>
      <button
        onClick={onReset}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-brand-500 to-purple-500 text-white text-sm font-semibold hover:shadow-md transition"
      >
        <RefreshCw size={14} />
        {t("common.errorBoundaryRetry")}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ErrorBoundary class component                                      */
/* ------------------------------------------------------------------ */

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return <ErrorFallback onReset={this.handleReset} />;
    }
    return this.props.children;
  }
}
