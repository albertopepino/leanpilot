"use client";

import { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/stores/useI18n";
import { useAuth } from "@/hooks/useAuth";
import { adminApi, advancedLeanApi, oeeApi, handoverApi } from "@/lib/api";
import {
  Shield,
  Clock,
  Zap,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Package,
  Gauge,
  ArrowLeftRight,
  Lightbulb,
  Activity,
} from "lucide-react";

/* ─── Types ─── */
interface OperatorHomeProps {
  onNavigate: (view: string) => void;
}

interface ShiftInfo {
  name: string;
  startTime: string;
  endTime: string;
  minutesRemaining: number;
  progressPct: number;
}

interface LineStatus {
  id: number;
  name: string;
  status: "running" | "changeover" | "stopped" | "idle" | "breakdown";
  oee: number | null;
  activeAlerts: number;
}

/* ─── Helpers ─── */
function getCurrentShift(shifts: { name: string; start_time: string; end_time: string }[]): ShiftInfo | null {
  if (!shifts || shifts.length === 0) return null;
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  for (const s of shifts) {
    const start = s.start_time?.slice(0, 5) || "00:00";
    const end = s.end_time?.slice(0, 5) || "23:59";
    const crossesMidnight = end < start;
    const inShift = crossesMidnight ? (hhmm >= start || hhmm < end) : (hhmm >= start && hhmm < end);

    if (inShift) {
      const [sh, sm] = start.split(":").map(Number);
      const [eh, em] = end.split(":").map(Number);
      const startMin = sh * 60 + sm;
      let endMin = eh * 60 + em;
      if (crossesMidnight) endMin += 1440;
      let nowMin = now.getHours() * 60 + now.getMinutes();
      if (crossesMidnight && nowMin < startMin) nowMin += 1440;
      const totalMin = endMin - startMin;
      const elapsed = nowMin - startMin;
      const remaining = totalMin - elapsed;

      return {
        name: s.name,
        startTime: start,
        endTime: end,
        minutesRemaining: Math.max(0, remaining),
        progressPct: totalMin > 0 ? Math.min(100, Math.round((elapsed / totalMin) * 100)) : 0,
      };
    }
  }
  return null;
}

function getStatusColor(status: string) {
  switch (status) {
    case "running": return { bg: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400", light: "bg-emerald-500/10" };
    case "changeover": return { bg: "bg-amber-500", text: "text-amber-600 dark:text-amber-400", light: "bg-amber-500/10" };
    case "stopped": return { bg: "bg-rose-500", text: "text-rose-600 dark:text-rose-400", light: "bg-rose-500/10" };
    case "breakdown": return { bg: "bg-rose-600", text: "text-rose-600 dark:text-rose-400", light: "bg-rose-600/10" };
    default: return { bg: "bg-slate-400", text: "text-slate-500 dark:text-slate-400", light: "bg-slate-400/10" };
  }
}

// STATUS_LABELS removed — use t() keys instead (operatorHome.statusRunning, etc.)

/* ─── Component ─── */
export default function OperatorHome({ onNavigate }: OperatorHomeProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [shift, setShift] = useState<ShiftInfo | null>(null);
  const [lines, setLines] = useState<LineStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingHandover, setPendingHandover] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Get factory data for shifts and lines
      const factoryRes = await adminApi.getFactory();
      const factory = factoryRes.data ?? factoryRes;
      const prodLines = factory?.production_lines ?? [];
      const shifts = prodLines[0]?.shifts ?? [];

      // Determine current shift
      const currentShift = getCurrentShift(shifts);
      setShift(currentShift);

      // Get line statuses from andon
      const lineStatuses: LineStatus[] = [];
      try {
        const andonRes = await advancedLeanApi.getAndonStatus();
        const andonData = Array.isArray(andonRes.data) ? andonRes.data : [];
        const activeAlerts = andonData.filter((a: { resolved_at?: string | null }) => !a.resolved_at);

        for (const line of prodLines) {
          const lineAlerts = activeAlerts.filter((a: { production_line_id?: number }) => a.production_line_id === line.id);
          const hasBreakdown = lineAlerts.some((a: { alert_type?: string }) => a.alert_type === "breakdown");
          const hasStopped = lineAlerts.some((a: { alert_type?: string }) => a.alert_type === "stopped" || a.alert_type === "machine_stop");

          lineStatuses.push({
            id: line.id,
            name: line.name,
            status: hasBreakdown ? "breakdown" : hasStopped ? "stopped" : lineAlerts.length > 0 ? "changeover" : "running",
            oee: null,
            activeAlerts: lineAlerts.length,
          });
        }
      } catch {
        for (const line of prodLines) {
          lineStatuses.push({ id: line.id, name: line.name, status: "idle", oee: null, activeAlerts: 0 });
        }
      }

      // Try to get OEE for first line
      if (prodLines.length > 0) {
        try {
          const oeeRes = await oeeApi.getSummary(prodLines[0].id, 1);
          const oee = oeeRes.data;
          if (oee && lineStatuses.length > 0) {
            lineStatuses[0].oee = oee.avg_oee ?? null;
          }
        } catch { /* OEE unavailable */ }
      }

      setLines(lineStatuses);

      // Check for pending handover
      try {
        const handoverRes = await handoverApi.list({ line_id: prodLines[0]?.id, limit: 1 });
        const handovers = Array.isArray(handoverRes.data) ? handoverRes.data : [];
        setPendingHandover(handovers.length > 0 && handovers[0].status !== "acknowledged");
      } catch { /* ignore */ }
    } catch (err) {
      console.error("[OperatorHome] Data load error:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Refresh shift timer every minute
  useEffect(() => {
    const interval = setInterval(() => {
      if (shift) {
        setShift(prev => prev ? { ...prev, minutesRemaining: Math.max(0, prev.minutesRemaining - 1), progressPct: Math.min(100, prev.progressPct + 1) } : null);
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [shift]);

  const userName = user?.full_name?.split(" ")[0] || t("home.goodMorning");
  const totalAlerts = lines.reduce((sum, l) => sum + l.activeAlerts, 0);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
          <p className="text-sm text-th-text-3">{t("home.loadingData")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[800px] mx-auto">
      {/* ─── Shift Status Bar ─── */}
      <div className="rounded-2xl border border-th-border bg-th-bg-2 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-bold text-th-text">{t("operatorHome.myShift") || "My Shift"}</h1>
            <p className="text-xs text-th-text-3">{userName} — {new Date().toLocaleDateString()}</p>
          </div>
          {shift && (
            <div className="text-right">
              <p className="text-sm font-semibold text-th-text">{shift.name}</p>
              <p className="text-xs text-th-text-3">{shift.startTime} – {shift.endTime}</p>
            </div>
          )}
        </div>

        {shift ? (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-th-text-3">{t("operatorHome.shiftProgress") || "Shift progress"}</span>
              <span className="text-xs font-semibold text-th-text">
                {Math.floor(shift.minutesRemaining / 60)}h {shift.minutesRemaining % 60}m {t("operatorHome.remaining") || "remaining"}
              </span>
            </div>
            <div className="w-full h-3 rounded-full bg-th-border overflow-hidden">
              <div
                className="h-full rounded-full bg-brand-500 transition-all duration-1000"
                style={{ width: `${shift.progressPct}%` }}
              />
            </div>
          </div>
        ) : (
          <p className="text-sm text-th-text-3 italic">{t("operatorHome.noActiveShift") || "No active shift detected"}</p>
        )}
      </div>

      {/* ─── Line Status Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {lines.map((line) => {
          const sc = getStatusColor(line.status);
          return (
            <button
              key={line.id}
              onClick={() => onNavigate("shopfloor")}
              className="rounded-2xl border border-th-border bg-th-bg-2 p-4 text-left hover:shadow-md transition-all active:scale-[0.98]"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-th-text">{line.name}</span>
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${sc.bg} ${line.status === "running" ? "animate-pulse" : ""}`} />
                  <span className={`text-xs font-medium ${sc.text}`}>
                    {t(`operatorHome.status${line.status.charAt(0).toUpperCase() + line.status.slice(1)}`) || line.status}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {line.oee !== null && (
                  <div className="flex items-center gap-1.5">
                    <Gauge size={14} className="text-th-text-3" />
                    <span className="text-lg font-bold text-th-text">{line.oee.toFixed(1)}%</span>
                    <span className="text-[10px] text-th-text-3">OEE</span>
                  </div>
                )}
                {line.activeAlerts > 0 && (
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle size={14} className="text-amber-500" />
                    <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">{line.activeAlerts}</span>
                    <span className="text-[10px] text-th-text-3">{t("operatorHome.alerts") || "alerts"}</span>
                  </div>
                )}
              </div>
            </button>
          );
        })}
        {lines.length === 0 && (
          <div className="col-span-2 text-center py-8 text-sm text-th-text-3">
            {t("operatorHome.noLines") || "No production lines configured"}
          </div>
        )}
      </div>

      {/* ─── Quick Actions (big touch targets, 44px+ height) ─── */}
      <div>
        <h2 className="text-xs font-semibold text-th-text-3 uppercase tracking-wider mb-2">
          {t("operatorHome.quickActions") || "Quick Actions"}
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { id: "production", icon: Package, label: t("operatorHome.logOutput") || "Log Output", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400", border: "border-blue-200 dark:border-blue-500/20" },
            { id: "andon", icon: Zap, label: t("operatorHome.flagIssue") || "Flag Issue", color: "bg-rose-500/10 text-rose-600 dark:text-rose-400", border: "border-rose-200 dark:border-rose-500/20" },
            { id: "safety", icon: Shield, label: t("operatorHome.safetyCheck") || "Safety Check", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-500/20" },
            { id: "kaizen", icon: Lightbulb, label: t("operatorHome.suggestImprovement") || "Suggest Improvement", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400", border: "border-amber-200 dark:border-amber-500/20" },
          ].map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={() => onNavigate(action.id)}
                className={`flex items-center gap-3 rounded-2xl border ${action.border} ${action.color.split(" ")[0]} p-4 min-h-[56px] text-left hover:shadow-md transition-all active:scale-[0.98]`}
              >
                <Icon size={22} className={action.color.split(" ").slice(1).join(" ")} />
                <span className="text-sm font-semibold text-th-text">{action.label}</span>
                <ArrowRight size={16} className="ml-auto text-th-text-3" />
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Alerts & Notifications Strip ─── */}
      <div className="space-y-2">
        {totalAlerts > 0 && (
          <button
            onClick={() => onNavigate("andon")}
            className="w-full flex items-center gap-3 rounded-2xl border border-rose-200 dark:border-rose-500/20 bg-rose-500/10 p-4 text-left hover:shadow-md transition-all active:scale-[0.98]"
          >
            <div className="w-10 h-10 rounded-xl bg-rose-500 flex items-center justify-center shrink-0">
              <Zap size={20} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">
                {totalAlerts} {t("operatorHome.activeAlerts") || "active alerts"}
              </p>
              <p className="text-xs text-th-text-3">{t("operatorHome.tapToView") || "Tap to view Andon board"}</p>
            </div>
            <ArrowRight size={18} className="text-rose-400" />
          </button>
        )}

        {pendingHandover && (
          <button
            onClick={() => onNavigate("handover")}
            className="w-full flex items-center gap-3 rounded-2xl border border-amber-200 dark:border-amber-500/20 bg-amber-500/10 p-4 text-left hover:shadow-md transition-all active:scale-[0.98]"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center shrink-0">
              <ArrowLeftRight size={20} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                {t("operatorHome.handoverPending") || "Shift handover pending"}
              </p>
              <p className="text-xs text-th-text-3">{t("operatorHome.reviewAndAcknowledge") || "Review and acknowledge"}</p>
            </div>
            <ArrowRight size={18} className="text-amber-400" />
          </button>
        )}

        {totalAlerts === 0 && !pendingHandover && (
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-500/10 p-4">
            <CheckCircle2 size={20} className="text-emerald-500 shrink-0" />
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
              {t("operatorHome.allClear") || "All clear — no alerts or pending actions"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
