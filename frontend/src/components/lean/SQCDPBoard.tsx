'use client';

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useI18n } from '@/stores/useI18n';
import { Shield, CheckCircle, DollarSign, Truck, Users, Plus, Calendar, ChevronLeft, ChevronRight, MessageSquare, AlertTriangle, Grid3X3, LayoutList, ArrowUpCircle, FileWarning, Activity, Search, Lightbulb, Gauge } from 'lucide-react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/ui/PageHeader';
import { useToast } from '@/stores/useToast';
import { sqcdpApi } from '@/lib/api';
import DisplayModeWrapper from '@/components/ui/DisplayModeWrapper';
import ToolInfoCard from "@/components/ui/ToolInfoCard";
import { TOOL_INFO } from "@/lib/toolInfo";

interface SQCDPEntry {
  id: number;
  date: string;
  category: string;
  status: string;
  metric_value: number | null;
  target_value: number | null;
  comment: string | null;
  action_required: boolean;
  action_owner: string | null;
  action_due_date: string | null;
  tier_level: number;
  created_at: string;
}

interface Meeting {
  id: number;
  date: string;
  tier_level: number;
  duration_min: number | null;
  attendee_count: number | null;
  notes: string | null;
  action_items: { description: string; owner?: string; due_date?: string }[];
}

const CATEGORIES = [
  { key: 'safety', icon: Shield, color: 'red', labelKey: 'sqcdp.catSafety' },
  { key: 'quality', icon: CheckCircle, color: 'blue', labelKey: 'sqcdp.catQuality' },
  { key: 'cost', icon: DollarSign, color: 'green', labelKey: 'sqcdp.catCost' },
  { key: 'delivery', icon: Truck, color: 'amber', labelKey: 'sqcdp.catDelivery' },
  { key: 'people', icon: Users, color: 'purple', labelKey: 'sqcdp.catPeople' },
];

const STATUS_COLORS: Record<string, string> = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-rose-500',
};

const STATUS_BG: Record<string, string> = {
  green: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800',
  amber: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
  red: 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800',
};

function SQCDPBoardInner() {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [tierLevel, setTierLevel] = useState(1);
  const [entries, setEntries] = useState<SQCDPEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState<string | null>(null);
  const [meetingModal, setMeetingModal] = useState(false);
  const [formData, setFormData] = useState({ status: 'green', metric_value: '', target_value: '', comment: '', action_required: false, action_owner: '', action_due_date: '' });
  const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily');
  const [monthlyData, setMonthlyData] = useState<Record<string, SQCDPEntry[]>>({});
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ date: string; category: string } | null>(null);

  useEffect(() => {
    fetchEntries();
  }, [date, tierLevel]);

  // Listen for display-mode-refresh events to re-fetch data
  useEffect(() => {
    const handler = () => { fetchEntries(); };
    window.addEventListener("display-mode-refresh", handler);
    return () => window.removeEventListener("display-mode-refresh", handler);
  }, [date, tierLevel]);

  // Fetch 30-day data for monthly view
  useEffect(() => {
    if (viewMode !== 'monthly') return;
    let cancelled = false;
    (async () => {
      setMonthlyLoading(true);
      const result: Record<string, SQCDPEntry[]> = {};
      try {
        const dates: string[] = [];
        for (let i = 29; i >= 0; i--) {
          const d = new Date(date);
          d.setDate(d.getDate() - i);
          dates.push(d.toISOString().split('T')[0]);
        }
        const responses = await Promise.all(
          dates.map(dateStr =>
            sqcdpApi.listEntries({ target_date: dateStr, tier_level: tierLevel })
              .then(res => ({ dateStr, data: res.data || [] }))
              .catch(() => ({ dateStr, data: [] as SQCDPEntry[] }))
          )
        );
        if (!cancelled) {
          for (const { dateStr, data } of responses) {
            result[dateStr] = data;
          }
          setMonthlyData(result);
        }
      } catch {
        toast.error(t('sqcdp.loadFailed') || 'Failed to load monthly data');
      }
      if (!cancelled) setMonthlyLoading(false);
    })();
    return () => { cancelled = true; };
  }, [viewMode, date, tierLevel]);

  // Generate 30-day date range ending at selected date
  const thirtyDays = useMemo(() => {
    const days: string[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(date);
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().split('T')[0]);
    }
    return days;
  }, [date]);

  // Monthly summary: count green/amber/red per category
  const monthlySummary = useMemo(() => {
    const summary: Record<string, { green: number; amber: number; red: number; noData: number }> = {};
    for (const cat of CATEGORIES) {
      const counts = { green: 0, amber: 0, red: 0, noData: 0 };
      for (const d of thirtyDays) {
        const dayEntries = monthlyData[d] || [];
        const entry = dayEntries.find(e => e.category === cat.key);
        if (!entry) counts.noData++;
        else if (entry.status === 'green') counts.green++;
        else if (entry.status === 'amber') counts.amber++;
        else counts.red++;
      }
      summary[cat.key] = counts;
    }
    return summary;
  }, [monthlyData, thirtyDays]);

  async function fetchEntries() {
    setLoading(true);
    try {
      const res = await sqcdpApi.listEntries({ target_date: date, tier_level: tierLevel });
      setEntries(Array.isArray(res.data) ? res.data : []);
    } catch {
      setEntries([]);
      toast.error(t('sqcdp.loadFailed') || 'Failed to load SQCDP entries');
    }
    setLoading(false);
  }

  function getEntry(category: string) {
    return entries.find(e => e.category === category);
  }

  function changeDate(delta: number) {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    setDate(d.toISOString().split('T')[0]);
  }

  async function saveEntry(category: string) {
    try {
      const existing = getEntry(category);
      if (existing) {
        await sqcdpApi.updateEntry(existing.id, {
          status: formData.status,
          metric_value: formData.metric_value ? parseFloat(formData.metric_value) : null,
          target_value: formData.target_value ? parseFloat(formData.target_value) : null,
          comment: formData.comment || null,
          action_required: formData.action_required,
          action_owner: formData.action_owner || null,
          action_due_date: formData.action_due_date || null,
        });
      } else {
        await sqcdpApi.createEntry({
          date,
          category,
          tier_level: tierLevel,
          status: formData.status,
          metric_value: formData.metric_value ? parseFloat(formData.metric_value) : null,
          target_value: formData.target_value ? parseFloat(formData.target_value) : null,
          comment: formData.comment || null,
          action_required: formData.action_required,
          action_owner: formData.action_owner || null,
          action_due_date: formData.action_due_date || null,
        });
      }
      setEditModal(null);
      fetchEntries();
    } catch {
      toast.error(t('sqcdp.saveFailed') || 'Failed to save SQCDP entry');
    }
  }

  async function saveMeeting(notes: string, attendees: string) {
    try {
      await sqcdpApi.createMeeting({
        date,
        tier_level: tierLevel,
        duration_min: 15,
        attendee_count: attendees ? parseInt(attendees) : null,
        notes: notes || null,
      });
      setMeetingModal(false);
    } catch {
      toast.error(t('sqcdp.meetingSaveFailed') || 'Failed to log meeting');
    }
  }

  function openEdit(category: string) {
    const existing = getEntry(category);
    setFormData({
      status: existing?.status || 'green',
      metric_value: existing?.metric_value?.toString() || '',
      target_value: existing?.target_value?.toString() || '',
      comment: existing?.comment || '',
      action_required: existing?.action_required || false,
      action_owner: existing?.action_owner || '',
      action_due_date: existing?.action_due_date || '',
    });
    setEditModal(category);
  }

  const actionItems = entries.filter(e => e.action_required);

  /** Compute T1->T2 escalation status for an action item */
  function getEscalationBadge(item: SQCDPEntry): { label: string; style: string; autoT2: boolean } | null {
    if (item.tier_level !== 1 || !item.action_required) return null;
    const ageMs = Date.now() - new Date(item.created_at).getTime();
    const ageHours = ageMs / (1000 * 60 * 60);
    if (ageHours >= 48) {
      return {
        label: t('sqcdp.autoEscalatedT2'),
        style: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border border-red-300 dark:border-red-700',
        autoT2: true,
      };
    }
    if (ageHours >= 24) {
      return {
        label: t('sqcdp.suggestEscalateT2'),
        style: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300 dark:border-amber-700',
        autoT2: false,
      };
    }
    return null;
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <ToolInfoCard info={TOOL_INFO.sqcdp} />
      <PageHeader titleKey="sqcdp.title" subtitleKey="sqcdp.subtitle" icon={Shield} />

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 bg-th-card rounded-lg border border-th-border px-3 py-1.5">
          <button onClick={() => changeDate(-1)} className="p-1 hover:bg-th-bg-hover rounded"><ChevronLeft size={16} /></button>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-transparent text-sm text-th-text border-0 focus:outline-none" />
          <button onClick={() => changeDate(1)} className="p-1 hover:bg-th-bg-hover rounded"><ChevronRight size={16} /></button>
        </div>

        <div className="flex gap-1 bg-th-card rounded-lg border border-th-border p-1">
          {[1, 2, 3].map(tier => (
            <button key={tier} onClick={() => setTierLevel(tier)} className={`px-3 py-1 rounded text-xs font-medium transition ${tierLevel === tier ? 'bg-brand-600 text-white' : 'text-th-text-3 hover:bg-th-bg-hover'}`}>
              T{tier}
            </button>
          ))}
        </div>

        <button onClick={() => setMeetingModal(true)} className="flex items-center gap-2 px-3 py-1.5 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-500 transition">
          <MessageSquare size={14} /> {t('sqcdp.logMeeting') || 'Log Meeting'}
        </button>

        {/* View Mode Toggle */}
        <div className="flex gap-1 bg-th-card rounded-lg border border-th-border p-1 ml-auto">
          <button onClick={() => setViewMode('daily')} className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition ${viewMode === 'daily' ? 'bg-brand-600 text-white' : 'text-th-text-3 hover:bg-th-bg-hover'}`}>
            <LayoutList size={12} /> {t('sqcdp.dailyView') || 'Daily'}
          </button>
          <button onClick={() => setViewMode('monthly')} className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition ${viewMode === 'monthly' ? 'bg-brand-600 text-white' : 'text-th-text-3 hover:bg-th-bg-hover'}`}>
            <Grid3X3 size={12} /> {t('sqcdp.monthlyView') || 'Monthly'}
          </button>
        </div>
      </div>

      {/* ============ Monthly 30-Day Grid ============ */}
      {viewMode === 'monthly' && (
        <div className="space-y-4">
          {monthlyLoading ? (
            <div className="bg-th-card rounded-xl border border-th-border p-8 text-center">
              <p className="text-sm text-th-text-3 animate-pulse">{t('common.loading') || 'Loading...'}</p>
            </div>
          ) : (
            <>
              {/* Heatmap Grid */}
              <div className="bg-th-card rounded-xl border border-th-border p-4 overflow-x-auto">
                <div className="min-w-[700px]">
                  {/* Day number header */}
                  <div className="flex items-center gap-px mb-1">
                    <div className="w-16 shrink-0" />
                    {thirtyDays.map(d => {
                      const dayNum = new Date(d).getDate();
                      return (
                        <div key={d} className="flex-1 text-center text-[9px] text-th-text-3 font-mono">
                          {dayNum}
                        </div>
                      );
                    })}
                    <div className="w-32 shrink-0 text-[10px] text-th-text-3 text-center font-bold uppercase tracking-wider pl-2">
                      {t('sqcdp.summary') || 'Summary'}
                    </div>
                  </div>

                  {/* Category rows */}
                  {CATEGORIES.map(cat => {
                    const summary = monthlySummary[cat.key] || { green: 0, amber: 0, red: 0, noData: 0 };
                    return (
                      <div key={cat.key} className="flex items-center gap-px mb-px">
                        <div className="w-16 shrink-0 text-xs font-bold text-th-text uppercase tracking-wide flex items-center gap-1.5 pr-2">
                          {t(cat.labelKey).charAt(0)}
                        </div>
                        {thirtyDays.map(d => {
                          const dayEntries = monthlyData[d] || [];
                          const entry = dayEntries.find(e => e.category === cat.key);
                          const status = entry?.status;
                          let cellBg = 'bg-gray-200 dark:bg-gray-700/40';
                          if (status === 'green') cellBg = 'bg-emerald-500';
                          else if (status === 'amber') cellBg = 'bg-amber-500';
                          else if (status === 'red') cellBg = 'bg-rose-500';

                          const isSelected = selectedCell?.date === d && selectedCell?.category === cat.key;

                          return (
                            <button
                              key={d}
                              onClick={() => setSelectedCell(isSelected ? null : { date: d, category: cat.key })}
                              className={`flex-1 h-7 rounded-sm transition-all ${cellBg} ${isSelected ? 'ring-2 ring-brand-500 ring-offset-1 ring-offset-th-card scale-110 z-10' : 'hover:opacity-80'}`}
                              title={`${t(cat.labelKey)} - ${d}: ${status || t('sqcdp.noData')}${entry?.comment ? ` — ${entry.comment}` : ''}`}
                            />
                          );
                        })}
                        {/* Summary counts */}
                        <div className="w-32 shrink-0 flex items-center gap-1 pl-2">
                          <span className="flex items-center gap-0.5 text-[10px]">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                            <span className="text-th-text-2 font-bold">{summary.green}</span>
                          </span>
                          <span className="flex items-center gap-0.5 text-[10px]">
                            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                            <span className="text-th-text-2 font-bold">{summary.amber}</span>
                          </span>
                          <span className="flex items-center gap-0.5 text-[10px]">
                            <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                            <span className="text-th-text-2 font-bold">{summary.red}</span>
                          </span>
                          <span className="flex items-center gap-0.5 text-[10px]">
                            <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />
                            <span className="text-th-text-3">{summary.noData}</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {/* Legend */}
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-th-border text-[10px] text-th-text-3">
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />{t('sqcdp.good') || 'Good'}</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" />{t('sqcdp.warning') || 'Warning'}</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" />{t('sqcdp.critical') || 'Critical'}</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-gray-400 inline-block" />{t('sqcdp.noData') || 'No data'}</span>
                  </div>
                </div>
              </div>

              {/* Selected cell detail */}
              {selectedCell && (() => {
                const dayEntries = monthlyData[selectedCell.date] || [];
                const entry = dayEntries.find(e => e.category === selectedCell.category);
                const cat = CATEGORIES.find(c => c.key === selectedCell.category);
                return (
                  <div className="bg-th-card rounded-xl border border-th-border p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-bold text-th-text">{cat ? t(cat.labelKey) : ''} — {selectedCell.date}</h4>
                      <button onClick={() => setSelectedCell(null)} className="text-th-text-3 hover:text-th-text text-xs">
                        {t('common.close') || 'Close'}
                      </button>
                    </div>
                    {entry ? (
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-th-text-3">{t('common.status') || 'Status'}:</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${STATUS_COLORS[entry.status]} text-white`}>{entry.status}</span>
                        </div>
                        {entry.metric_value != null && (
                          <div><span className="text-th-text-3">{t('common.actual') || 'Value'}:</span> <span className="text-th-text font-semibold">{entry.metric_value}{entry.target_value ? ` / ${entry.target_value}` : ''}</span></div>
                        )}
                        {entry.comment && <div><span className="text-th-text-3">{t('common.notes') || 'Comment'}:</span> <span className="text-th-text">{entry.comment}</span></div>}
                        {entry.action_required && <div className="text-amber-500 text-xs font-medium">{t('sqcdp.actionRequired') || 'Action Required'}{entry.action_owner ? ` — ${entry.action_owner}` : ''}</div>}
                      </div>
                    ) : (
                      <p className="text-sm text-th-text-3 italic">{t('sqcdp.noEntryForDate') || 'No entry for this date'}</p>
                    )}
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}

      {/* SQCDP Cards */}
      {viewMode === 'daily' && (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {CATEGORIES.map(cat => {
          const entry = getEntry(cat.key);
          const status = entry?.status || 'green';
          const Icon = cat.icon;
          return (
            <div key={cat.key} className="space-y-1.5">
              <button onClick={() => openEdit(cat.key)} className={`relative w-full p-4 rounded-xl border-2 text-left transition-all hover:shadow-md ${STATUS_BG[status]}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Icon size={18} className="text-th-text-2" />
                    <span className="text-sm font-bold uppercase tracking-wide text-th-text">{t(cat.labelKey)}</span>
                  </div>
                  <div className={`w-4 h-4 rounded-full ${STATUS_COLORS[status]}`} />
                </div>
                {entry?.metric_value != null && (
                  <div className="text-2xl font-bold text-th-text">{entry.metric_value}{entry.target_value ? <span className="text-sm font-normal text-th-text-3"> / {entry.target_value}</span> : null}</div>
                )}
                {entry?.comment && <p className="text-xs text-th-text-3 mt-2 line-clamp-2">{entry.comment}</p>}
                {entry?.action_required && <AlertTriangle size={14} className="absolute top-3 right-8 text-amber-500" />}
                {!entry && <p className="text-xs text-th-text-3 italic mt-2">{t('sqcdp.clickToAdd') || 'Click to add entry'}</p>}
              </button>
              {/* Category-specific cross-tool navigation for RED/AMBER entries */}
              {entry && (status === 'red' || status === 'amber') && (
                <div className="flex flex-wrap gap-1 px-1">
                  {/* Safety → Safety Hub & Incidents */}
                  {cat.key === 'safety' && (
                    <button onClick={() => router.push('/operations/safety')}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 hover:bg-red-500/20 transition">
                      <Shield className="w-2.5 h-2.5" /> {t('sqcdp.openSafety')}
                    </button>
                  )}
                  {/* Quality → NCR & SPC */}
                  {cat.key === 'quality' && (
                    <>
                      <button onClick={() => router.push('/quality')}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 hover:bg-red-500/20 transition">
                        <FileWarning className="w-2.5 h-2.5" /> {t('sqcdp.openNCR')}
                      </button>
                      <button onClick={() => router.push('/quality/spc')}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition">
                        <Activity className="w-2.5 h-2.5" /> {t('sqcdp.viewSPC')}
                      </button>
                    </>
                  )}
                  {/* Cost → OEE & Waste Tracker */}
                  {cat.key === 'cost' && (
                    <>
                      <button onClick={() => router.push('/operations/oee')}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition">
                        <Gauge className="w-2.5 h-2.5" /> {t('sqcdp.viewOEE')}
                      </button>
                      <button onClick={() => router.push('/operations/waste')}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 transition">
                        <AlertTriangle className="w-2.5 h-2.5" /> {t('sqcdp.viewWaste')}
                      </button>
                    </>
                  )}
                  {/* Delivery → Production tracking */}
                  {cat.key === 'delivery' && (
                    <button onClick={() => router.push('/operations/production')}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition">
                      <Truck className="w-2.5 h-2.5" /> {t('sqcdp.viewProduction')}
                    </button>
                  )}
                  {/* People → Shift handover */}
                  {cat.key === 'people' && (
                    <button onClick={() => router.push('/operations/shift-handover')}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition">
                      <Users className="w-2.5 h-2.5" /> {t('sqcdp.viewHandover')}
                    </button>
                  )}
                  {/* Common: 5-Why and Kaizen always available */}
                  <button onClick={() => router.push('/improvement/root-cause')}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition">
                    <Search className="w-2.5 h-2.5" /> {t('sqcdp.startFiveWhy')}
                  </button>
                  <button onClick={() => router.push('/improvement/kaizen')}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition">
                    <Lightbulb className="w-2.5 h-2.5" /> {t('sqcdp.createKaizen')}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      )}

      {/* Action Items */}
      {actionItems.length > 0 && (
        <div className="bg-th-card rounded-xl border border-th-border p-4">
          <h3 className="text-sm font-semibold text-th-text mb-3">{t('sqcdp.actionItems') || 'Action Items'}</h3>
          <div className="space-y-2">
            {actionItems.map(item => {
              const esc = getEscalationBadge(item);
              return (
                <div key={item.id} className="flex items-center gap-3 text-sm">
                  <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[item.status]}`} />
                  <span className="uppercase text-xs font-bold text-th-text-3 w-16">{item.category}</span>
                  <span className="flex-1 text-th-text">{item.comment}</span>
                  {esc && (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${esc.style}`}>
                      <ArrowUpCircle className="w-3 h-3" />
                      {esc.label}
                    </span>
                  )}
                  <span className="text-th-text-3">{item.action_owner}</span>
                  {item.action_due_date && <span className="text-xs text-th-text-3">{item.action_due_date}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setEditModal(null)}>
          <div className="bg-th-card rounded-xl p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-th-text">{editModal.toUpperCase()}</h3>
            <div>
              <label className="text-xs text-th-text-3 block mb-1">{t('common.status') || 'Status'}</label>
              <div className="flex gap-2">
                {['green', 'amber', 'red'].map(s => (
                  <button key={s} onClick={() => setFormData(p => ({ ...p, status: s }))} className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${formData.status === s ? STATUS_COLORS[s] + ' text-white' : 'bg-th-bg-hover text-th-text-3'}`}>{s.toUpperCase()}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-th-text-3 block mb-1">{
                  editModal === 'safety' ? (t('sqcdp.incidentsToday') || 'Incidents today') :
                  editModal === 'quality' ? (t('sqcdp.defectRate') || 'Defect rate %') :
                  editModal === 'cost' ? (t('sqcdp.wasteScrap') || 'Waste / scrap (€)') :
                  editModal === 'delivery' ? (t('sqcdp.onTimePercent') || 'On-time delivery %') :
                  editModal === 'people' ? (t('sqcdp.absentToday') || 'Absent today') :
                  (t('common.actual') || 'Actual')
                }</label>
                <input type="number" value={formData.metric_value} onChange={e => setFormData(p => ({ ...p, metric_value: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-th-border bg-th-input text-th-text text-sm" placeholder={
                  editModal === 'safety' ? '0' :
                  editModal === 'quality' ? '0.5' :
                  editModal === 'cost' ? '0' :
                  editModal === 'delivery' ? '95' :
                  editModal === 'people' ? '0' : ''
                } />
              </div>
              <div>
                <label className="text-xs text-th-text-3 block mb-1">{
                  editModal === 'safety' ? (t('sqcdp.targetZero') || 'Target (0 = ideal)') :
                  editModal === 'quality' ? (t('sqcdp.targetRate') || 'Target rate %') :
                  editModal === 'cost' ? (t('sqcdp.budget') || 'Budget (€)') :
                  editModal === 'delivery' ? (t('sqcdp.targetPercent') || 'Target %') :
                  editModal === 'people' ? (t('sqcdp.plannedHeadcount') || 'Planned headcount') :
                  (t('common.target') || 'Target')
                }</label>
                <input type="number" value={formData.target_value} onChange={e => setFormData(p => ({ ...p, target_value: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-th-border bg-th-input text-th-text text-sm" placeholder={
                  editModal === 'safety' ? '0' :
                  editModal === 'quality' ? '0.5' :
                  editModal === 'cost' ? '1000' :
                  editModal === 'delivery' ? '95' :
                  editModal === 'people' ? '10' : ''
                } />
              </div>
            </div>
            <div>
              <label className="text-xs text-th-text-3 block mb-1">{t('common.notes') || 'Comment'}</label>
              <textarea value={formData.comment} onChange={e => setFormData(p => ({ ...p, comment: e.target.value }))} rows={2} className="w-full px-3 py-2 rounded-lg border border-th-border bg-th-input text-th-text text-sm" />
            </div>
            <label className="flex items-center gap-2 text-sm text-th-text">
              <input type="checkbox" checked={formData.action_required} onChange={e => setFormData(p => ({ ...p, action_required: e.target.checked }))} className="rounded" />
              {t('sqcdp.actionRequired') || 'Action Required'}
            </label>
            {formData.action_required && (
              <div className="grid grid-cols-2 gap-3">
                <input placeholder={t('sqcdp.owner') || 'Owner'} value={formData.action_owner} onChange={e => setFormData(p => ({ ...p, action_owner: e.target.value }))} className="px-3 py-2 rounded-lg border border-th-border bg-th-input text-th-text text-sm" />
                <input type="date" value={formData.action_due_date} onChange={e => setFormData(p => ({ ...p, action_due_date: e.target.value }))} className="px-3 py-2 rounded-lg border border-th-border bg-th-input text-th-text text-sm" />
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button onClick={() => setEditModal(null)} className="flex-1 py-2 rounded-lg border border-th-border text-th-text text-sm hover:bg-th-bg-hover">{t('common.cancel') || 'Cancel'}</button>
              <button onClick={() => saveEntry(editModal)} className="flex-1 py-2 rounded-lg bg-brand-600 text-white text-sm hover:bg-brand-500">{t('common.save') || 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Meeting Modal */}
      {meetingModal && (
        <MeetingModal onClose={() => setMeetingModal(false)} onSave={saveMeeting} t={t} />
      )}
    </div>
  );
}

export default function SQCDPBoard() {
  const { t } = useI18n();
  return (
    <Suspense fallback={null}>
      <DisplayModeWrapper title={t('common.titleSQCDP') || 'SQCDP Board'} refreshInterval={30}>
        <SQCDPBoardInner />
      </DisplayModeWrapper>
    </Suspense>
  );
}

function MeetingModal({ onClose, onSave, t }: { onClose: () => void; onSave: (notes: string, attendees: string) => void; t: (k: string) => string }) {
  const [notes, setNotes] = useState('');
  const [attendees, setAttendees] = useState('');
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-th-card rounded-xl p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-th-text">{t('sqcdp.logMeeting') || 'Log Tier Meeting'}</h3>
        <div>
          <label className="text-xs text-th-text-3 block mb-1">{t('sqcdp.attendees') || 'Attendees'}</label>
          <input type="number" value={attendees} onChange={e => setAttendees(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-th-border bg-th-input text-th-text text-sm" />
        </div>
        <div>
          <label className="text-xs text-th-text-3 block mb-1">{t('common.notes') || 'Notes'}</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg border border-th-border bg-th-input text-th-text text-sm" />
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-th-border text-th-text text-sm hover:bg-th-bg-hover">{t('common.cancel') || 'Cancel'}</button>
          <button onClick={() => onSave(notes, attendees)} className="flex-1 py-2 rounded-lg bg-brand-600 text-white text-sm hover:bg-brand-500">{t('common.save') || 'Save'}</button>
        </div>
      </div>
    </div>
  );
}
