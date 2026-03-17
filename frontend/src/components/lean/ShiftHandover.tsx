'use client';

import { useState, useEffect } from 'react';
import { useI18n } from '@/stores/useI18n';
import { adminApi } from '@/lib/api';
import { ArrowRightLeft, Zap, CheckCircle, AlertTriangle, Clock, Package, Percent, Wrench, ChevronDown, ChevronUp } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';

interface Handover {
  id: number;
  shift_date: string;
  shift_number: number;
  line_id: number;
  total_pieces: number;
  good_pieces: number;
  scrap_pieces: number;
  oee_percent: number | null;
  downtime_minutes: number | null;
  safety_issues: string | null;
  quality_issues: string | null;
  equipment_issues: string | null;
  material_issues: string | null;
  pending_actions: string | null;
  acknowledged: boolean;
  acknowledged_by: string | null;
  created_at: string;
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
    shift_number: 1, total_pieces: '', good_pieces: '', scrap_pieces: '',
    oee_percent: '', downtime_minutes: '', safety_issues: '', quality_issues: '',
    equipment_issues: '', material_issues: '', pending_actions: '',
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
      const { default: api } = await import('@/lib/api');
      const res = await api.get('/shift-handover', { params: { line_id: lineId, limit: 10 } });
      setHandovers(res.data);
    } catch { setHandovers([]); }
    setLoading(false);
  }

  async function autoGenerate() {
    setGenerating(true);
    try {
      const { default: api } = await import('@/lib/api');
      await api.post('/shift-handover/auto-generate', { line_id: lineId });
      fetchHandovers();
    } catch {}
    setGenerating(false);
  }

  async function saveHandover() {
    try {
      const { default: api } = await import('@/lib/api');
      await api.post('/shift-handover', {
        shift_date: new Date().toISOString().split('T')[0],
        shift_number: form.shift_number,
        line_id: lineId,
        total_pieces: form.total_pieces ? parseInt(form.total_pieces) : 0,
        good_pieces: form.good_pieces ? parseInt(form.good_pieces) : 0,
        scrap_pieces: form.scrap_pieces ? parseInt(form.scrap_pieces) : 0,
        oee_percent: form.oee_percent ? parseFloat(form.oee_percent) : null,
        downtime_minutes: form.downtime_minutes ? parseInt(form.downtime_minutes) : null,
        safety_issues: form.safety_issues || null,
        quality_issues: form.quality_issues || null,
        equipment_issues: form.equipment_issues || null,
        material_issues: form.material_issues || null,
        pending_actions: form.pending_actions || null,
      });
      setCreateMode(false);
      fetchHandovers();
    } catch {}
  }

  async function acknowledge(id: number) {
    try {
      const { default: api } = await import('@/lib/api');
      await api.patch(`/shift-handover/${id}/acknowledge`);
      fetchHandovers();
    } catch {}
  }

  const latest = handovers[0];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader titleKey="shiftHandover.title" subtitleKey="shiftHandover.subtitle" icon={ArrowRightLeft}
        actions={
          <div className="flex gap-2">
            <button onClick={autoGenerate} disabled={generating} className="flex items-center gap-2 px-3 py-1.5 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-500 transition disabled:opacity-50">
              <Zap size={14} /> {generating ? (t('common.generating') || 'Generating...') : (t('shiftHandover.autoGenerate') || 'Auto-Generate')}
            </button>
            <button onClick={() => setCreateMode(true)} className="flex items-center gap-2 px-3 py-1.5 border border-th-border text-th-text rounded-lg text-sm hover:bg-th-bg-hover transition">
              {t('shiftHandover.manual') || 'Manual Entry'}
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
            { label: t('shiftHandover.totalPieces') || 'Total Pieces', value: latest.total_pieces, icon: Package },
            { label: t('shiftHandover.goodPieces') || 'Good Pieces', value: latest.good_pieces, icon: CheckCircle },
            { label: t('shiftHandover.scrap') || 'Scrap', value: latest.scrap_pieces, icon: AlertTriangle },
            { label: 'OEE', value: latest.oee_percent != null ? `${latest.oee_percent}%` : '--', icon: Percent },
            { label: t('shiftHandover.downtime') || 'Downtime', value: latest.downtime_minutes != null ? `${latest.downtime_minutes}m` : '--', icon: Clock },
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
          <h3 className="text-sm font-semibold text-th-text">{t('shiftHandover.recent') || 'Recent Handovers'}</h3>
        </div>
        {loading && <div className="p-4 text-sm text-th-text-3">{t('common.loading') || 'Loading...'}</div>}
        {!loading && handovers.length === 0 && <div className="p-4 text-sm text-th-text-3 italic">{t('common.noData') || 'No handovers found'}</div>}
        {handovers.map(h => (
          <div key={h.id} className="px-4 py-3">
            <button onClick={() => setExpandedId(expandedId === h.id ? null : h.id)} className="w-full flex items-center justify-between text-left">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-th-text">{h.shift_date} - Shift {h.shift_number}</span>
                <span className="text-xs text-th-text-3">OEE: {h.oee_percent ?? '--'}%</span>
                {h.acknowledged && <span className="text-xs px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-full">ACK</span>}
              </div>
              {expandedId === h.id ? <ChevronUp size={14} className="text-th-text-3" /> : <ChevronDown size={14} className="text-th-text-3" />}
            </button>
            {expandedId === h.id && (
              <div className="mt-3 space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-th-text-3">Total:</span> <span className="text-th-text font-medium">{h.total_pieces}</span></div>
                  <div><span className="text-th-text-3">Good:</span> <span className="text-th-text font-medium">{h.good_pieces}</span></div>
                  <div><span className="text-th-text-3">Scrap:</span> <span className="text-th-text font-medium">{h.scrap_pieces}</span></div>
                  <div><span className="text-th-text-3">Downtime:</span> <span className="text-th-text font-medium">{h.downtime_minutes ?? '--'}m</span></div>
                </div>
                {h.safety_issues && <p className="text-xs"><span className="font-semibold text-rose-600">Safety:</span> <span className="text-th-text">{h.safety_issues}</span></p>}
                {h.quality_issues && <p className="text-xs"><span className="font-semibold text-blue-600">Quality:</span> <span className="text-th-text">{h.quality_issues}</span></p>}
                {h.equipment_issues && <p className="text-xs"><span className="font-semibold text-amber-600">Equipment:</span> <span className="text-th-text">{h.equipment_issues}</span></p>}
                {h.material_issues && <p className="text-xs"><span className="font-semibold text-purple-600">Material:</span> <span className="text-th-text">{h.material_issues}</span></p>}
                {h.pending_actions && <p className="text-xs"><span className="font-semibold text-th-text-2">Pending:</span> <span className="text-th-text">{h.pending_actions}</span></p>}
                {!h.acknowledged && (
                  <button onClick={() => acknowledge(h.id)} className="mt-2 px-3 py-1.5 bg-brand-600 text-white rounded-lg text-xs hover:bg-brand-500 transition">
                    {t('shiftHandover.acknowledge') || 'Acknowledge'}
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
            <h3 className="text-lg font-bold text-th-text">{t('shiftHandover.manual') || 'Manual Handover Entry'}</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-th-text-3 block mb-1">Shift</label>
                <select value={form.shift_number} onChange={e => setForm(p => ({ ...p, shift_number: parseInt(e.target.value) }))} className="w-full px-3 py-2 rounded-lg border border-th-border bg-th-background text-th-text text-sm">
                  <option value={1}>Shift 1</option><option value={2}>Shift 2</option><option value={3}>Shift 3</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-th-text-3 block mb-1">Total</label>
                <input type="number" value={form.total_pieces} onChange={e => setForm(p => ({ ...p, total_pieces: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-th-border bg-th-background text-th-text text-sm" />
              </div>
              <div>
                <label className="text-xs text-th-text-3 block mb-1">Good</label>
                <input type="number" value={form.good_pieces} onChange={e => setForm(p => ({ ...p, good_pieces: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-th-border bg-th-background text-th-text text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-th-text-3 block mb-1">Scrap</label>
                <input type="number" value={form.scrap_pieces} onChange={e => setForm(p => ({ ...p, scrap_pieces: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-th-border bg-th-background text-th-text text-sm" />
              </div>
              <div>
                <label className="text-xs text-th-text-3 block mb-1">OEE %</label>
                <input type="number" value={form.oee_percent} onChange={e => setForm(p => ({ ...p, oee_percent: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-th-border bg-th-background text-th-text text-sm" />
              </div>
              <div>
                <label className="text-xs text-th-text-3 block mb-1">Downtime (min)</label>
                <input type="number" value={form.downtime_minutes} onChange={e => setForm(p => ({ ...p, downtime_minutes: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-th-border bg-th-background text-th-text text-sm" />
              </div>
            </div>
            {['safety_issues', 'quality_issues', 'equipment_issues', 'material_issues', 'pending_actions'].map(field => (
              <div key={field}>
                <label className="text-xs text-th-text-3 block mb-1">{field.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</label>
                <textarea value={(form as any)[field]} onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))} rows={2} className="w-full px-3 py-2 rounded-lg border border-th-border bg-th-background text-th-text text-sm" />
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
