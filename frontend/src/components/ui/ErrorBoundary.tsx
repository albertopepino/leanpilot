"use client";
import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { useI18n } from "@/stores/useI18n";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

function ErrorFallback({ error, onRetry }: { error: Error | null; onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] p-8 text-center" role="alert">
      <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center justify-center mb-4">
        <AlertTriangle size={28} className="text-red-500" />
      </div>
      <h2 className="text-lg font-semibold text-th-text mb-2">{t("common.errorBoundaryTitle")}</h2>
      <p className="text-sm text-th-text-2 mb-4 max-w-md">
        {error?.message || t("common.errorBoundaryMessage")}
      </p>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
      >
        {t("common.errorBoundaryRetry")}
      </button>
    </div>
  );
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <ErrorFallback
          error={this.state.error}
          onRetry={() => this.setState({ hasError: false, error: null })}
        />
      );
    }
    return this.props.children;
  }
}
