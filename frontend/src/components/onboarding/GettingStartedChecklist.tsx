"use client";
import { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/stores/useI18n";
import { useAuth } from "@/hooks/useAuth";
import { adminApi, manufacturingApi, productionApi, leanApi } from "@/lib/api";
import {
  CheckCircle2,
  Circle,
  ChevronRight,
  X,
  Rocket,
  UserPlus,
  Factory,
  Package,
  ClipboardList,
  Compass,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Storage                                                            */
/* ------------------------------------------------------------------ */

const CHECKLIST_HIDDEN_KEY = "leanpilot_checklist_hidden";

function isChecklistHidden(userId?: number): boolean {
  try {
    return localStorage.getItem(`${CHECKLIST_HIDDEN_KEY}_${userId || "anon"}`) === "true";
  } catch {
    return false;
  }
}

function hideChecklist(userId?: number): void {
  try {
    localStorage.setItem(`${CHECKLIST_HIDDEN_KEY}_${userId || "anon"}`, "true");
  } catch { /* ignore */ }
}

export function showChecklistAgain(userId?: number): void {
  try {
    localStorage.removeItem(`${CHECKLIST_HIDDEN_KEY}_${userId || "anon"}`);
  } catch { /* ignore */ }
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ChecklistItem {
  id: string;
  labelKey: string;
  done: boolean;
  icon: typeof CheckCircle2;
  href: string;
}

interface GettingStartedChecklistProps {
  onNavigate: (view: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function GettingStartedChecklist({ onNavigate }: GettingStartedChecklistProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [hidden, setHidden] = useState(true);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ChecklistItem[]>([]);

  const checkCompletion = useCallback(async () => {
    if (!user) return;
    if (isChecklistHidden(user.id)) {
      setHidden(true);
      setLoading(false);
      return;
    }

    const checklist: ChecklistItem[] = [
      {
        id: "account",
        labelKey: "onboarding.checkAccount",
        done: true, // always done if user exists
        icon: UserPlus,
        href: "settings",
      },
      {
        id: "lines",
        labelKey: "onboarding.checkLines",
        done: false,
        icon: Factory,
        href: "admin",
      },
      {
        id: "products",
        labelKey: "onboarding.checkProducts",
        done: false,
        icon: Package,
        href: "products",
      },
      {
        id: "production",
        labelKey: "onboarding.checkProduction",
        done: false,
        icon: ClipboardList,
        href: "production",
      },
      {
        id: "assessment",
        labelKey: "onboarding.checkAssessment",
        done: false,
        icon: Compass,
        href: "assessment",
      },
      {
        id: "team",
        labelKey: "onboarding.checkTeam",
        done: false,
        icon: UserPlus,
        href: "admin",
      },
    ];

    // Check production lines
    try {
      const linesRes = await adminApi.listProductionLines();
      if (Array.isArray(linesRes.data) && linesRes.data.length > 0) {
        checklist[1].done = true;
      }
    } catch { /* skip */ }

    // Check products
    try {
      const productsRes = await manufacturingApi.listProducts();
      if (Array.isArray(productsRes.data) && productsRes.data.length > 0) {
        checklist[2].done = true;
      }
    } catch { /* skip */ }

    // Check production records
    try {
      const linesRes = await adminApi.listProductionLines();
      if (Array.isArray(linesRes.data) && linesRes.data.length > 0) {
        const recordsRes = await productionApi.listRecords(linesRes.data[0].id);
        if (Array.isArray(recordsRes.data) && recordsRes.data.length > 0) {
          checklist[3].done = true;
        }
      }
    } catch { /* skip */ }

    // Check lean assessment
    try {
      const assessmentRes = await leanApi.getAssessment();
      if (assessmentRes.data && (assessmentRes.data.id || assessmentRes.data.overall_score != null)) {
        checklist[4].done = true;
      }
    } catch { /* skip */ }

    // Check team (>1 user) — only admins can list users
    try {
      const usersRes = await adminApi.listUsers();
      if (Array.isArray(usersRes.data) && usersRes.data.length > 1) {
        checklist[5].done = true;
      }
    } catch { /* skip */ }

    setItems(checklist);
    const doneCount = checklist.filter((c) => c.done).length;
    // If all done, auto-hide
    if (doneCount >= checklist.length) {
      setHidden(true);
    } else {
      setHidden(false);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    checkCompletion();
  }, [checkCompletion]);

  const handleHide = useCallback(() => {
    hideChecklist(user?.id);
    setHidden(true);
  }, [user?.id]);

  if (hidden || loading) return null;

  const doneCount = items.filter((i) => i.done).length;
  const totalCount = items.length;
  const progressPct = Math.round((doneCount / totalCount) * 100);

  return (
    <div className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-th-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center">
            <Rocket size={16} className="text-brand-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-th-text">
              {t("onboarding.checklistTitle") || "Getting Started"}
            </h3>
            <p className="text-[10px] text-th-text-3">
              {t("onboarding.checklistProgress", { done: String(doneCount), total: String(totalCount) }) ||
                `${doneCount} of ${totalCount} complete`}
            </p>
          </div>
        </div>
        <button
          onClick={handleHide}
          className="text-th-text-3 hover:text-th-text-2 transition p-1"
          aria-label={t("onboarding.hideChecklist") || "Hide checklist"}
          title={t("onboarding.hideChecklist") || "Hide checklist"}
        >
          <X size={16} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="px-5 pt-3">
        <div className="w-full h-2 rounded-full bg-th-border overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-emerald-500 transition-all duration-700"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="text-[10px] text-th-text-3 mt-1 text-right font-medium">{progressPct}%</p>
      </div>

      {/* Items */}
      <div className="px-3 pb-3 pt-1 space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => !item.done && onNavigate(item.href)}
              disabled={item.done}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left group ${
                item.done
                  ? "opacity-60 cursor-default"
                  : "hover:bg-th-bg-hover cursor-pointer"
              }`}
            >
              {item.done ? (
                <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
              ) : (
                <Circle size={18} className="text-th-text-3 shrink-0 group-hover:text-brand-500 transition-colors" />
              )}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Icon size={14} className={`shrink-0 ${item.done ? "text-th-text-3" : "text-th-text-2"}`} />
                <span
                  className={`text-sm ${
                    item.done ? "line-through text-th-text-3" : "text-th-text group-hover:text-brand-500"
                  } transition-colors`}
                >
                  {t(item.labelKey)}
                </span>
              </div>
              {!item.done && (
                <ChevronRight
                  size={14}
                  className="text-th-text-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
