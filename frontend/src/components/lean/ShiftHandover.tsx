'use client';

import { useState, useEffect } from 'react';
import { useI18n } from '@/stores/useI18n';
import { adminApi, handoverApi } from '@/lib/api';
import { ArrowRightLeft, Zap, CheckCircle, AlertTriangle, Clock, Package, Percent, Wrench, ChevronDown, ChevronUp } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import ToolInfoCard from "@/components/ui/ToolInfoCard";
import { TOOL_INFO } from "@/lib/toolInfo";

interface Handover {
  id: number;
  factory_id: number;
  production_line_id: number;
  outgoing_shift_id: number | null;
  incoming_shift_id: number | null;
  created_by_id: number;
  acknowledged_by_id: number | null;
  date: string;
  status: string;
  total_pieces: number | null;
  good_pieces: number | null;
  scrap_pieces: number | null;
  oee_pct: number | null;
  downtime_min: number | null;
  safety_issues: string | null;
  quality_issues: string | null;
  equipment_issues: string | null;
  material_issues: string | null;
  pending_actions: { description?: string; priority?: string; owner?: string; status?: string; due_date?: string }[];
  notes: string | null;
  acknowledged_at: string | null;
  created_at: string;
  updated_at: string;
}

export default function ShiftHandover() {
  const { t } = useI18n();
  const [handovers, setHandovers] = useState<Handover[]>([]);
  const [loading, setLoading] = useState(true);
  const [productionLines, setProductionLines] = useState<{id: number; name: string}[]>([]);
  const [lineId, setLineId] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [createMode, setCreateMode] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [form, setForm] = useState({
    safety_issues: '', quality_issues: '',
    equipment_issues: '', material_issues: '', notes: '',
  });

  // Fetch production lines from API
  useEffect(() => {
    (async () => {
      try {
        const res = await adminApi.getFactory();
        const factory = res.data ?? res;
        const lines = factory?.production_lines ?? [];
        setProductionLines(lines);
        if (lines.length > 0) setLineId(lines[0].id);
      } catch { /* ignore */ }
    })();
  }, []);

  useEffect(() => { if (lineId) fetchHandovers(); }, [lineId]);

  async function fetchHandovers() {
    setLoading(true);
    try {
      const res = await handoverApi.list({ line_id: lineId, limit: 10 });
      setHandovers(Array.isArray(res.data) ? res.data : []);
    } catch { setHandovers([]); }
    setLoading(false);
  }

  async function autoGenerate() {
    setGenerating(true);
    try {
      await handoverApi.autoGenerate(lineId);
      fetchHandovers();
    } catch {}
    setGenerating(false);
  }

  async function saveHandover() {
    try {
      await handoverApi.create({
        production_line_id: lineId,
        date: new Date().toISOString().split('T')[0],
        safety_issues: form.safety_issues || null,
        quality_issues: form.quality_issues || null,
        equipment_issues: form.equipment_issues || null,
        material_issues: form.material_issues || null,
        pending_actions: [],
        notes: form.notes || null,
      });
      setCreateMode(false);
      fetchHandovers();
    } catch {}
  }

  async function acknowledge(id: number) {
    try {
      await handoverApi.acknowledge(id);
      fetchHandovers();
    } catch {}
  }

  async function toggleActionStatus(handoverId: number, actionIdx: number, action: Handover['pending_actions'][0]) {
    const newStatus = (action.status === 'done' || action.status === 'closed') ? 'open' : 'done';
    // Optimistic update
    setHandovers(prev => prev.map(h => {
      if (h.id !== handoverId) return h;
      const updated = [...h.pending_actions];
      updated[actionIdx] = { ...updated[actionIdx], status: newStatus };
      return { ...h, pending_actions: updated };
    }));
    try {
      const target = handovers.find(h => h.id === handoverId);
      if (!target) return;
      const updatedActions = [...target.pending_actions];
      updatedActions[actionIdx] = { ...updatedActions[actionIdx], status: newStatus };
      await handoverApi.update(handoverId, { pending_actions: updatedActions });
    } catch {
      fetchHandovers(); // revert on error
    }
  }

  const latest = handovers[0];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <ToolInfoCard info={TOOL_INFO.handover} />
      <PageHeader titleKey="handover.title" subtitleKey="handover.subtitle" icon={ArrowRightLeft}
        actions={
          <div className="flex gap-2">
            <button onClick={autoGenerate} disabled={generating} className="flex items-center gap-2 px-3 py-1.5 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-500 transition disabled:opacity-50">
              <Zap size={14} /> {generating ? (t('common.generating') || 'Generating...') : (t('handover.autoGenerate') || 'Auto-Generate')}
            </button>
            <button onClick={() => setCreateMode(true)} className="flex items-center gap-2 px-3 py-1.5 border border-th-border text-th-text rounded-lg text-sm hover:bg-th-bg-hover transition">
              {t('handover.manual') || 'Manual Entry'}
            </button>
          </div>
        }
      />

      {/* Line selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm text-th-text-3">{t('common.line') || 'Line'}:</label>
        <select value={lineId} onChange={e => setLineId(parseInt(e.target.value))} className="px-3 py-1.5 rounded-lg border border-th-border bg-th-card text-th-text text-sm">
          {productionLines.length === 0 && <option value={0}>{t('common.loading') || 'Loading...'}</option>}
          {productionLines.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>

      {/* Latest summary cards */}
      {latest && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: t('handover.totalPieces') || 'Total Pieces', value: latest.total_pieces ?? '--', icon: Package },
            { label: t('handover.goodPieces') || 'Good Pieces', value: latest.good_pieces ?? '--', icon: CheckCircle },
            { label: t('handover.scrap') || 'Scrap', value: latest.scrap_pieces ?? '--', icon: AlertTriangle },
            { label: 'OEE', value: latest.oee_pct != null ? `${latest.oee_pct}%` : '--', icon: Percent },
            { label: t('handover.downtime') || 'Downtime', value: latest.downtime_min != null ? `${latest.downtime_min}m` : '--', icon: Clock },
          ].map((card, i) => (
            <div key={i} className="bg-th-card rounded-xl border border-th-border p-3">
              <div className="flex items-center gap-2 mb-1">
                <card.icon size={14} className="text-th-text-3" />
                <span className="text-xs text-th-text-3">{card.label}</span>
              </div>
              <div className="text-xl font-bold text-th-text">{card.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Recent handovers list */}
      <div className="bg-th-card rounded-xl border border-th-border divide-y divide-th-border">
        <div className="px-4 py-3">
          <h3 className="text-sm font-semibold text-th-text">{t('handover.recent') || 'Recent Handovers'}</h3>
        </div>
        {loading && <div className="p-4 text-sm text-th-text-3">{t('common.loading') || 'Loading...'}</div>}
        {!loading && handovers.length === 0 && <div className="p-4 text-sm text-th-text-3 italic">{t('common.noData') || 'No handovers found'}</div>}
        {handovers.map(h => (
          <div key={h.id} className="px-4 py-3">
            <button onClick={() => setExpandedId(expandedId === h.id ? null : h.id)} className="w-full flex items-center justify-between text-left">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-th-text">{h.date}</span>
                <span className="text-xs text-th-text-3">OEE: {h.oee_pct ?? '--'}%</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium uppercase tracking-wide ${h.status === 'acknowledged' ? 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : h.status === 'submitted' ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' : 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'}`}>
                  {t(`handover.status_${h.status}`) || h.status}
                </span>
              </div>
              {expandedId === h.id ? <ChevronUp size={14} className="text-th-text-3" /> : <ChevronDown size={14} className="text-th-text-3" />}
            </button>
            {expandedId === h.id && (
              <div className="mt-3 space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-th-text-3">Total:</span> <span className="text-th-text font-medium">{h.total_pieces ?? '--'}</span></div>
                  <div><span className="text-th-text-3">{t('handover.good') || 'Good'}:</span> <span className="text-th-text font-medium">{h.good_pieces ?? '--'}</span></div>
                  <div><span className="text-th-text-3">{t('handover.scrap') || 'Scrap'}:</span> <span className="text-th-text font-medium">{h.scrap_pieces ?? '--'}</span></div>
                  <div><span className="text-th-text-3">{t('handover.downtime') || 'Downtime'}:</span> <span className="text-th-text font-medium">{h.downtime_min ?? '--'}m</span></div>
                </div>
                {h.safety_issues && <p className="text-xs"><span className="font-semibold text-rose-600">{t('handover.safety') || 'Safety'}:</span> <span className="text-th-text">{h.safety_issues}</span></p>}
                {h.quality_issues && <p className="text-xs"><span className="font-semibold text-blue-600">{t('handover.quality') || 'Quality'}:</span> <span className="text-th-text">{h.quality_issues}</span></p>}
                {h.equipment_issues && <p className="text-xs"><span className="font-semibold text-amber-600">{t('handover.equipment') || 'Equipment'}:</span> <span className="text-th-text">{h.equipment_issues}</span></p>}
                {h.material_issues && <p className="text-xs"><span className="font-semibold text-purple-600">{t('handover.material') || 'Material'}:</span> <span className="text-th-text">{h.material_issues}</span></p>}
                {h.notes && <p className="text-xs"><span className="font-semibold text-th-text-2">{t('common.notes') || 'Notes'}:</span> <span className="text-th-text">{h.notes}</span></p>}

                {/* Pending Actions Follow-up */}
                {h.pending_actions && h.pending_actions.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-th-border">
                    <h4 className="text-xs font-semibold text-th-text-2 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3 text-amber-500" />
                      {t('handover.pendingActions') || 'Pending Actions'} ({h.pending_actions.length})
                    </h4>
                    <div className="space-y-1.5">
                      {h.pending_actions.map((action, i) => {
                        const st = action.status || 'open';
                        const isDone = st === 'done' || st === 'closed';
                        return (
                          <div key={i} className={`flex items-start gap-2 px-2.5 py-2 rounded-lg border text-xs ${isDone ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800' : 'bg-th-bg-2 border-th-border'}`}>
                            <button
                              onClick={() => toggleActionStatus(h.id, i, action)}
                              className={`mt-0.5 shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition ${isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-th-text-3 hover:border-brand-500'}`}
                            >
                              {isDone && <CheckCircle className="w-3 h-3" />}
                            </button>
                            <div className="flex-1 min-w-0">
                              <span className={`text-th-text ${isDone ? 'line-through opacity-60' : ''}`}>{action.description || '--'}</span>
                              <div className="flex gap-2 mt-0.5">
                                {action.owner && <span className="text-th-text-3">{action.owner}</span>}
                                {action.priority && (
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${action.priority === 'high' ? 'bg-rose-100 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400' : action.priority === 'medium' ? 'bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                                    {t(`handover.priority_${action.priority}`) || action.priority}
                                  </span>
                                )}
                                {action.due_date && <span className="text-th-text-3">{t('handover.dueBy') || 'Due'}: {action.due_date}</span>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {!h.acknowledged_at && (
                  <button onClick={() => acknowledge(h.id)} className="mt-2 px-3 py-1.5 bg-brand-600 text-white rounded-lg text-xs hover:bg-brand-500 transition">
                    {t('handover.acknowledge') || 'Acknowledge'}
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Create Modal */}
      {createMode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setCreateMode(false)}>
          <div className="bg-th-card rounded-xl p-6 w-full max-w-lg space-y-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-th-text">{t('handover.manual') || 'Manual Handover Entry'}</h3>
            {(['safety_issues', 'quality_issues', 'equipment_issues', 'material_issues', 'notes'] as const).map(field => (
              <div key={field}>
                <label className="text-xs text-th-text-3 block mb-1">{field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</label>
                <textarea value={form[field]} onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))} rows={2} className="w-full px-3 py-2 rounded-lg border border-th-border bg-th-bg text-th-text text-sm" />
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <button onClick={() => setCreateMode(false)} className="flex-1 py-2 rounded-lg border border-th-border text-th-text text-sm hover:bg-th-bg-hover">{t('common.cancel') || 'Cancel'}</button>
              <button onClick={saveHandover} className="flex-1 py-2 rounded-lg bg-brand-600 text-white text-sm hover:bg-brand-500">{t('common.save') || 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
