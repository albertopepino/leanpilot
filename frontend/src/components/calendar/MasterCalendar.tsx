"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useI18n } from "@/stores/useI18n";
import { calendarApi } from "@/lib/api";
import type { CalendarEvent, CalendarEventSource } from "@/lib/types";
import { AlertCircle, Lightbulb, Wrench, ClipboardList, CheckCircle, Footprints, Play, Square, ShieldCheck, type LucideIcon } from "lucide-react";

// ─── Constants ──────────────────────────────────────────────────────────────

type CalendarViewMode = "month" | "week" | "day";

const ALL_SOURCES: CalendarEventSource[] = [
  "capa", "kaizen", "tpm_maintenance", "tpm_equipment",
  "six_s", "gemba", "production_order_start", "production_order_end", "cilt",
];

const SOURCE_COLORS: Record<string, { bg: string; text: string }> = {
  capa: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-300" },
  kaizen: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300" },
  tpm_maintenance: { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-300" },
  tpm_equipment: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-300" },
  six_s: { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-300" },
  gemba: { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-300" },
  production_order_start: { bg: "bg-teal-100 dark:bg-teal-900/30", text: "text-teal-700 dark:text-teal-300" },
  production_order_end: { bg: "bg-cyan-100 dark:bg-cyan-900/30", text: "text-cyan-700 dark:text-cyan-300" },
  cilt: { bg: "bg-violet-100 dark:bg-violet-900/30", text: "text-violet-700 dark:text-violet-300" },
};

const SOURCE_ICONS: Record<string, LucideIcon> = {
  capa: AlertCircle,
  kaizen: Lightbulb,
  tpm_maintenance: Wrench,
  tpm_equipment: ClipboardList,
  six_s: CheckCircle,
  gemba: Footprints,
  production_order_start: Play,
  production_order_end: Square,
  cilt: ShieldCheck,
};

const SOURCE_LABELS: Record<string, { key: string }> = {
  capa: { key: "calendar.sourceCapa" },
  kaizen: { key: "calendar.sourceKaizen" },
  tpm_maintenance: { key: "calendar.sourceTpm" },
  tpm_equipment: { key: "calendar.sourceTpmScheduled" },
  six_s: { key: "calendar.sourceSixS" },
  gemba: { key: "calendar.sourceGemba" },
  production_order_start: { key: "calendar.sourcePoStart" },
  production_order_end: { key: "calendar.sourcePoEnd" },
  cilt: { key: "calendar.sourceCilt" },
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function startOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getMonthGrid(d: Date): Date[][] {
  const first = startOfMonth(d);
  const firstDay = first.getDay();
  const offset = firstDay === 0 ? -6 : 1 - firstDay; // Monday start
  const gridStart = addDays(first, offset);
  const weeks: Date[][] = [];
  let current = gridStart;
  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(current));
      current = addDays(current, 1);
    }
    weeks.push(week);
    // Stop if the next week is entirely in the next month
    if (current.getMonth() !== d.getMonth() && w >= 4) break;
  }
  return weeks;
}

function getWeekDays(d: Date): Date[] {
  const monday = startOfWeek(d);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

// ─── Props ──────────────────────────────────────────────────────────────────

interface MasterCalendarProps {
  onNavigate: (view: string) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

const LOCALE_MAP: Record<string, string> = {
  en: "en-GB", it: "it-IT", de: "de-DE", fr: "fr-FR", es: "es-ES", pl: "pl-PL", sr: "sr-Latn-RS",
};

export default function MasterCalendar({ onNavigate }: MasterCalendarProps) {
  const { t, locale } = useI18n();
  const dateLocale = LOCALE_MAP[locale] || "en-GB";

  // State
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeSources, setActiveSources] = useState<Set<CalendarEventSource>>(new Set(ALL_SOURCES));
  const [showFilters, setShowFilters] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // Compute date range for API
  const dateRange = useMemo(() => {
    if (viewMode === "month") {
      const grid = getMonthGrid(currentDate);
      const first = grid[0][0];
      const lastWeek = grid[grid.length - 1];
      const last = lastWeek[6];
      return { date_from: fmt(first), date_to: fmt(last) };
    } else if (viewMode === "week") {
      const days = getWeekDays(currentDate);
      return { date_from: fmt(days[0]), date_to: fmt(days[6]) };
    } else {
      return { date_from: fmt(currentDate), date_to: fmt(currentDate) };
    }
  }, [viewMode, currentDate]);

  // Fetch events
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const sources = activeSources.size < ALL_SOURCES.length
      ? Array.from(activeSources)
      : undefined;
    calendarApi
      .getEvents({ ...dateRange, sources })
      .then((data: CalendarEvent[]) => {
        if (!cancelled) setEvents(data);
      })
      .catch(() => {
        if (!cancelled) setEvents([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [dateRange, activeSources]);

  // Navigation
  const goToday = useCallback(() => setCurrentDate(new Date()), []);
  const goPrev = useCallback(() => {
    setCurrentDate((d) => {
      if (viewMode === "month") return new Date(d.getFullYear(), d.getMonth() - 1, 1);
      if (viewMode === "week") return addDays(d, -7);
      return addDays(d, -1);
    });
  }, [viewMode]);
  const goNext = useCallback(() => {
    setCurrentDate((d) => {
      if (viewMode === "month") return new Date(d.getFullYear(), d.getMonth() + 1, 1);
      if (viewMode === "week") return addDays(d, 7);
      return addDays(d, 1);
    });
  }, [viewMode]);

  // Group events by date string
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const ev of events) {
      const key = ev.date.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    }
    return map;
  }, [events]);

  // Source toggle
  const toggleSource = (s: CalendarEventSource) => {
    setActiveSources((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const toggleAllSources = () => {
    if (activeSources.size === ALL_SOURCES.length) {
      setActiveSources(new Set());
    } else {
      setActiveSources(new Set(ALL_SOURCES));
    }
  };

  // Today reference
  const today = new Date();

  // Day names (Monday-start)
  const dayNames = useMemo(() => {
    const names: string[] = [];
    const base = startOfWeek(new Date());
    for (let i = 0; i < 7; i++) {
      names.push(addDays(base, i).toLocaleDateString(dateLocale, { weekday: "short" }));
    }
    return names;
  }, [dateLocale]);

  // Title
  const headerTitle = useMemo(() => {
    if (viewMode === "month") {
      return currentDate.toLocaleDateString(dateLocale, { month: "long", year: "numeric" });
    } else if (viewMode === "week") {
      const days = getWeekDays(currentDate);
      const s = days[0].toLocaleDateString(dateLocale, { month: "short", day: "numeric" });
      const e = days[6].toLocaleDateString(dateLocale, { month: "short", day: "numeric", year: "numeric" });
      return `${s} - ${e}`;
    } else {
      return currentDate.toLocaleDateString(dateLocale, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    }
  }, [viewMode, currentDate]);

  // ─── Render helpers ─────────────────────────────────────────────────────

  const renderEventChip = (ev: CalendarEvent, compact = false) => {
    const colors = SOURCE_COLORS[ev.source] || { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-700 dark:text-gray-300" };
    const label = SOURCE_LABELS[ev.source];
    return (
      <button
        key={ev.id}
        onClick={(e) => { e.stopPropagation(); setSelectedEvent(ev); }}
        className={`w-full text-left truncate rounded px-1.5 py-0.5 text-[11px] font-medium transition-opacity hover:opacity-80 ${colors.bg} ${colors.text} ${compact ? "" : "mb-0.5"}`}
        title={ev.title}
      >
        {(() => { const SIcon = SOURCE_ICONS[ev.source]; return SIcon ? <SIcon size={10} className="mr-1 inline-block" /> : null; })()}
        {ev.title}
      </button>
    );
  };

  const renderDayCell = (date: Date, isCurrentMonth: boolean) => {
    const key = fmt(date);
    const dayEvents = eventsByDate[key] || [];
    const isToday = isSameDay(date, today);
    const maxVisible = 3;
    const overflow = dayEvents.length - maxVisible;

    return (
      <div
        key={key}
        className={`min-h-[100px] border border-th-border p-1 ${
          isCurrentMonth ? "bg-th-bg" : "bg-th-bg-2 opacity-60"
        } ${isToday ? "ring-2 ring-brand-500 ring-inset" : ""}`}
      >
        <div className={`text-xs font-medium mb-1 ${isToday ? "text-brand-600 dark:text-brand-400 font-bold" : "text-th-text-2"}`}>
          {date.getDate()}
        </div>
        <div className="space-y-0.5">
          {dayEvents.slice(0, maxVisible).map((ev) => renderEventChip(ev, true))}
          {overflow > 0 && (
            <div className="text-[10px] text-th-text-3 px-1 cursor-pointer hover:text-brand-500"
              onClick={() => { setCurrentDate(date); setViewMode("day"); }}
            >
              {t("calendar.moreEvents", { count: overflow })}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ─── Month View ─────────────────────────────────────────────────────────

  const renderMonthView = () => {
    const weeks = getMonthGrid(currentDate);
    return (
      <div>
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-0">
          {dayNames.map((name) => (
            <div key={name} className="text-center text-xs font-semibold text-th-text-2 py-2 border-b border-th-border bg-th-bg-2">
              {name}
            </div>
          ))}
        </div>
        {/* Weeks */}
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-0">
            {week.map((date) => renderDayCell(date, date.getMonth() === currentDate.getMonth()))}
          </div>
        ))}
      </div>
    );
  };

  // ─── Week View ──────────────────────────────────────────────────────────

  const renderWeekView = () => {
    const days = getWeekDays(currentDate);
    return (
      <div className="overflow-auto">
        {/* Day headers */}
        <div className="grid grid-cols-[60px_repeat(7,1fr)] gap-0 sticky top-0 z-10 bg-th-bg-2">
          <div className="border-b border-r border-th-border" />
          {days.map((d) => {
            const isToday = isSameDay(d, today);
            return (
              <div key={fmt(d)} className={`text-center text-xs font-medium py-2 border-b border-th-border ${isToday ? "text-brand-600 dark:text-brand-400 font-bold" : "text-th-text-2"}`}>
                <div>{d.toLocaleDateString(dateLocale, { weekday: "short" })}</div>
                <div className={`text-lg ${isToday ? "bg-brand-500 text-white rounded-full w-8 h-8 flex items-center justify-center mx-auto" : ""}`}>
                  {d.getDate()}
                </div>
              </div>
            );
          })}
        </div>
        {/* Hour rows */}
        {HOURS.map((hour) => (
          <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] gap-0">
            <div className="text-[10px] text-th-text-3 text-right pr-2 py-2 border-r border-th-border">
              {hour.toString().padStart(2, "0")}:00
            </div>
            {days.map((d) => {
              const key = fmt(d);
              const dayEvents = (eventsByDate[key] || []).filter((ev) => {
                const evHour = new Date(ev.date).getHours();
                return evHour === hour;
              });
              return (
                <div key={`${key}-${hour}`} className="min-h-[48px] border-b border-r border-th-border p-0.5">
                  {dayEvents.map((ev) => renderEventChip(ev))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  // ─── Day View ───────────────────────────────────────────────────────────

  const renderDayView = () => {
    const key = fmt(currentDate);
    const dayEvents = eventsByDate[key] || [];
    return (
      <div className="overflow-auto">
        <div className="text-center py-3 bg-th-bg-2 border-b border-th-border">
          <div className={`text-sm font-medium ${isSameDay(currentDate, today) ? "text-brand-600 dark:text-brand-400" : "text-th-text"}`}>
            {currentDate.toLocaleDateString(dateLocale, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </div>
        </div>
        {HOURS.map((hour) => {
          const hourEvents = dayEvents.filter((ev) => {
            const evHour = new Date(ev.date).getHours();
            return evHour === hour;
          });
          return (
            <div key={hour} className="grid grid-cols-[60px_1fr] gap-0">
              <div className="text-[10px] text-th-text-3 text-right pr-2 py-3 border-r border-th-border">
                {hour.toString().padStart(2, "0")}:00
              </div>
              <div className="min-h-[52px] border-b border-th-border p-1">
                {hourEvents.map((ev) => renderEventChip(ev))}
              </div>
            </div>
          );
        })}
        {/* All-day / dateless events at top */}
        {dayEvents.length === 0 && (
          <div className="text-center py-12 text-th-text-3 text-sm">
            {t("calendar.noEvents")}
          </div>
        )}
      </div>
    );
  };

  // ─── Event Detail Modal ─────────────────────────────────────────────────

  const renderModal = () => {
    if (!selectedEvent) return null;
    const ev = selectedEvent;
    const colors = SOURCE_COLORS[ev.source] || { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-700 dark:text-gray-300" };
    const label = SOURCE_LABELS[ev.source];

    return (
      <div className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center bg-black/40 p-0 md:p-4" onClick={() => setSelectedEvent(null)}>
        <div
          className="bg-th-bg-2 rounded-t-xl md:rounded-xl shadow-xl border border-th-border w-full md:max-w-md max-h-[85vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-10 h-1 bg-th-border rounded-full mx-auto mt-3 md:hidden" />
          {/* Header */}
          <div className={`px-5 py-4 ${colors.bg}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {(() => { const SIcon = SOURCE_ICONS[ev.source]; return SIcon ? <SIcon size={16} className={colors.text} /> : null; })()}
                <span className={`text-xs font-semibold uppercase tracking-wide ${colors.text}`}>
                  {t(label?.key || ev.source)}
                </span>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-th-text-3 hover:text-th-text text-xl leading-none"
              >
                &times;
              </button>
            </div>
            <h3 className="text-lg font-bold text-th-text mt-2">{ev.title}</h3>
          </div>

          {/* Body */}
          <div className="px-5 py-4 space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <span className="text-th-text-3 w-28 shrink-0">{t("calendar.date")}</span>
              <span className="text-th-text font-medium">
                {new Date(ev.date).toLocaleDateString(dateLocale, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                {ev.end_date && (
                  <> &mdash; {new Date(ev.end_date).toLocaleDateString(dateLocale, { weekday: "short", month: "short", day: "numeric" })}</>
                )}
              </span>
            </div>

            {ev.status && (
              <div className="flex items-center gap-3 text-sm">
                <span className="text-th-text-3 w-28 shrink-0">{t("calendar.status")}</span>
                <span className="text-th-text font-medium capitalize">{ev.status}</span>
              </div>
            )}

            {ev.priority && (
              <div className="flex items-center gap-3 text-sm">
                <span className="text-th-text-3 w-28 shrink-0">{t("calendar.priority")}</span>
                <span className="text-th-text font-medium capitalize">{ev.priority}</span>
              </div>
            )}

            {ev.production_line_name && (
              <div className="flex items-center gap-3 text-sm">
                <span className="text-th-text-3 w-28 shrink-0">{t("calendar.line")}</span>
                <span className="text-th-text font-medium">{ev.production_line_name}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-th-border flex justify-end gap-3">
            <button
              onClick={() => setSelectedEvent(null)}
              className="px-4 py-2 text-sm text-th-text-2 hover:text-th-text transition"
            >
              {t("common.close")}
            </button>
            <button
              onClick={() => {
                setSelectedEvent(null);
                onNavigate(ev.view_key);
              }}
              className="px-4 py-2 text-sm font-semibold bg-brand-600 text-white rounded-lg hover:bg-brand-500 transition"
            >
              {t("calendar.openTool")} &rarr;
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ─── Main Render ────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-th-bg-2 rounded-xl border border-th-border p-3 shadow-card">
        <div className="flex flex-wrap items-center gap-3">
          {/* Navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={goPrev}
              className="px-3 py-1.5 text-sm rounded-lg border border-th-border text-th-text hover:bg-th-bg-3 transition"
            >
              &larr;
            </button>
            <button
              onClick={goToday}
              className="px-3 py-1.5 text-sm rounded-lg border border-th-border text-th-text hover:bg-th-bg-3 transition font-medium"
            >
              {t("calendar.today")}
            </button>
            <button
              onClick={goNext}
              className="px-3 py-1.5 text-sm rounded-lg border border-th-border text-th-text hover:bg-th-bg-3 transition"
            >
              &rarr;
            </button>
          </div>

          {/* Title */}
          <h2 className="text-lg font-bold text-th-text flex-1 text-center capitalize">
            {headerTitle}
          </h2>

          {/* View mode toggle */}
          <div className="flex items-center gap-1 bg-th-bg rounded-lg p-0.5 border border-th-border">
            {(["month", "week", "day"] as CalendarViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                  viewMode === mode
                    ? "bg-brand-600 text-white shadow"
                    : "text-th-text-2 hover:text-th-text hover:bg-th-bg-2"
                }`}
              >
                {t(`calendar.${mode}`)}
              </button>
            ))}
          </div>

          {/* Filter button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-1.5 text-sm rounded-lg border transition ${
              showFilters
                ? "border-brand-500 bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400"
                : "border-th-border text-th-text-2 hover:bg-th-bg-3"
            }`}
          >
            {t("calendar.filters")}
            {activeSources.size < ALL_SOURCES.length && (
              <span className="ml-1.5 bg-brand-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                {activeSources.size}
              </span>
            )}
          </button>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="mt-3 pt-3 border-t border-th-border">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={toggleAllSources}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition ${
                  activeSources.size === ALL_SOURCES.length
                    ? "border-brand-500 bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400"
                    : "border-th-border text-th-text-2 hover:bg-th-bg-3"
                }`}
              >
                {t("calendar.allSources")}
              </button>
              {ALL_SOURCES.map((source) => {
                const label = SOURCE_LABELS[source];
                const colors = SOURCE_COLORS[source];
                const active = activeSources.has(source);
                return (
                  <button
                    key={source}
                    onClick={() => toggleSource(source)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition flex items-center gap-1.5 ${
                      active
                        ? `${colors.bg} ${colors.text} border-current`
                        : "border-th-border text-th-text-3 opacity-50 hover:opacity-75"
                    }`}
                  >
                    {(() => { const SIcon = SOURCE_ICONS[source]; return SIcon ? <SIcon size={12} /> : null; })()}
                    {t(label?.key || source)}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Loading indicator */}
      {loading && (
        <div className="flex justify-center py-2">
          <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Calendar grid */}
      <div className="bg-th-bg-2 rounded-xl border border-th-border shadow-card overflow-hidden">
        {viewMode === "month" && renderMonthView()}
        {viewMode === "week" && renderWeekView()}
        {viewMode === "day" && renderDayView()}
      </div>

      {/* Event detail modal */}
      {renderModal()}
    </div>
  );
}
