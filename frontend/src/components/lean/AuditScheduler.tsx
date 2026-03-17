'use client';

import { useState, useEffect } from 'react';
import { useI18n } from '@/stores/useI18n';
import { CalendarCheck, Plus, Filter, CheckCircle, AlertTriangle, Clock, User, Trash2 } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';

interface AuditSchedule {
  id: number;
  audit_type: string;
  title: string;
  frequency: string;
  next_due_date: string;
  assigned_to: string | null;
  last_completed: string | null;
  status: string;
  created_at: string;
}

const AUDIT_TYPES = ['six_s', 'tpm', 'qc', 'gemba', 'safety'];
const FREQUENCIES = ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly'];

const TYPE_COLORS: Record<string, string> = {
  six_s: 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400',
  tpm: 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400',
  qc: 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400',
  gemba: 'bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400',
  safety: 'bg-rose-100 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400',
};

export default function AuditScheduler() {
  const { t } = useI18n();
  const [schedules, setSchedules] = useState<AuditSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [createMode, setCreateMode] = useState(false);
  const [form, setForm] = useState({ audit_type: 'six_s', title: '', frequency: 'monthly', next_due_date: '', assigned_to: '' });

  useEffect(() => { fetchSchedules(); }, []);

  async function fetchSchedules() {
    setLoading(true);
    try {
      const { default: api } = await import('@/lib/api');
      const res = await api.get('/audit-scheduler/schedules');
      setSchedules(res.data);
    } catch { setSchedules([]); }
    setLoading(false);
  }

  async function saveSchedule() {
    try {
      const { default: api } = await import('@/lib/api');
      await api.post('/audit-scheduler/schedules', {
        audit_type: form.audit_type,
        title: form.title,
        frequency: form.frequency,
        next_due_date: form.next_due_date,
        assigned_to: form.assigned_to || null,
      });
      setCreateMode(false);
      setForm({ audit_type: 'six_s', title: '', frequency: 'monthly', next_due_date: '', assigned_to: '' });
      fetchSchedules();
    } catch {}
  }

  async function markComplete(id: number) {
    try {
      const { default: api } = await import('@/lib/api');
      await api.patch(`/audit-scheduler/schedules/${id}/complete`);
      fetchSchedules();
    } catch {}
  }

  async function deleteSchedule(id: number) {
    try {
      const { default: api } = await import('@/lib/api');
      await api.delete(`/audit-scheduler/schedules/${id}`);
      fetchSchedules();
    } catch {}
  }

  function isOverdue(dateStr: string) {
    return new Date(dateStr) < new Date(new Date().toISOString().split('T')[0]);
  }

  function isDueSoon(dateStr: string) {
    const due = new Date(dateStr);
    const today = new Date(new Date().toISOString().split('T')[0]);
    const diff = (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 3;
  }

  const filtered = typeFilter === 'all' ? schedules : schedules.filter(s => s.audit_type === typeFilter);
  const overdue = filtered.filter(s => isOverdue(s.next_due_date));
  const upcoming = filtered.filter(s => !isOverdue(s.next_due_date)).sort((a, b) => a.next_due_date.localeCompare(b.next_due_date));

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader titleKey="scheduling.title" subtitleKey="scheduling.subtitle" icon={CalendarCheck}
        actions={
          <button onClick={() => setCreateMode(true)} className="flex items-center gap-2 px-3 py-1.5 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-500 transition">
            <Plus size={14} /> {t('scheduling.newSchedule') || 'New Schedule'}
          </button>
        }
      />

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Filter size={14} className="text-th-text-3" />
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setTypeFilter('all')} className={`px-3 py-1 rounded-full text-xs transition ${typeFilter === 'all' ? 'bg-brand-600 text-white' : 'bg-th-bg-hover text-th-text-3'}`}>All</button>
          {AUDIT_TYPES.map(at => (
            <button key={at} onClick={() => setTypeFilter(at)} className={`px-3 py-1 rounded-full text-xs transition uppercase ${typeFilter === at ? 'bg-brand-600 text-white' : 'bg-th-bg-hover text-th-text-3'}`}>
              {at.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Overdue section */}
      {overdue.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-rose-600 flex items-center gap-2"><AlertTriangle size={14} /> {t('scheduling.overdue') || 'Overdue'} ({overdue.length})</h3>
          <div className="space-y-2">
            {overdue.map(s => (
              <AuditCard key={s.id} schedule={s} overdue onComplete={() => markComplete(s.id)} onDelete={() => deleteSchedule(s.id)} t={t} />
            ))}
          </div>
        </div>
      )}

      {/* Upcoming */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-th-text flex items-center gap-2"><Clock size={14} /> {t('scheduling.upcoming') || 'Upcoming'} ({upcoming.length})</h3>
        {upcoming.length === 0 && !loading && <p className="text-sm text-th-text-3 italic">{t('common.noData') || 'No scheduled audits'}</p>}
        <div className="space-y-2">
          {upcoming.map(s => (
            <AuditCard key={s.id} schedule={s} overdue={false} dueSoon={isDueSoon(s.next_due_date)} onComplete={() => markComplete(s.id)} onDelete={() => deleteSchedule(s.id)} t={t} />
          ))}
        </div>
      </div>

      {/* Create Modal */}
      {createMode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setCreateMode(false)}>
          <div className="bg-th-card rounded-xl p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-th-text">{t('scheduling.newSchedule') || 'New Audit Schedule'}</h3>
            <div>
              <label className="text-xs text-th-text-3 block mb-1">{t('scheduling.auditType') || 'Audit Type'}</label>
              <select value={form.audit_type} onChange={e => setForm(p => ({ ...p, audit_type: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-th-border bg-th-background text-th-text text-sm">
                {AUDIT_TYPES.map(at => <option key={at} value={at}>{at.replace('_', ' ').toUpperCase()}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-th-text-3 block mb-1">{t('common.title') || 'Title'}</label>
              <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-th-border bg-th-background text-th-text text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-th-text-3 block mb-1">{t('scheduling.frequency') || 'Frequency'}</label>
                <select value={form.frequency} onChange={e => setForm(p => ({ ...p, frequency: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-th-border bg-th-background text-th-text text-sm">
                  {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-th-text-3 block mb-1">{t('scheduling.nextDue') || 'Next Due Date'}</label>
                <input type="date" value={form.next_due_date} onChange={e => setForm(p => ({ ...p, next_due_date: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-th-border bg-th-background text-th-text text-sm" />
              </div>
            </div>
            <div>
              <label className="text-xs text-th-text-3 block mb-1">{t('scheduling.assignedTo') || 'Assigned To'}</label>
              <input value={form.assigned_to} onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-th-border bg-th-background text-th-text text-sm" />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setCreateMode(false)} className="flex-1 py-2 rounded-lg border border-th-border text-th-text text-sm hover:bg-th-bg-hover">{t('common.cancel') || 'Cancel'}</button>
              <button onClick={saveSchedule} className="flex-1 py-2 rounded-lg bg-brand-600 text-white text-sm hover:bg-brand-500">{t('common.save') || 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AuditCard({ schedule, overdue, dueSoon, onComplete, onDelete, t }: {
  schedule: AuditSchedule; overdue: boolean; dueSoon?: boolean;
  onComplete: () => void; onDelete: () => void; t: (k: string) => string;
}) {
  return (
    <div className={`bg-th-card rounded-xl border-2 p-4 flex items-center justify-between transition ${overdue ? 'border-rose-300 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-900/10' : dueSoon ? 'border-amber-300 dark:border-amber-800' : 'border-th-border'}`}>
      <div className="flex items-center gap-3">
        <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${TYPE_COLORS[schedule.audit_type] || 'bg-th-bg-hover text-th-text-3'}`}>
          {schedule.audit_type.replace('_', ' ')}
        </span>
        <div>
          <h4 className="text-sm font-medium text-th-text">{schedule.title}</h4>
          <div className="flex items-center gap-3 text-xs text-th-text-3 mt-0.5">
            <span className="capitalize">{schedule.frequency}</span>
            <span className={overdue ? 'text-rose-600 font-semibold' : ''}>{schedule.next_due_date}</span>
            {schedule.assigned_to && <span className="flex items-center gap-1"><User size={10} /> {schedule.assigned_to}</span>}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={onComplete} className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition" title={t('scheduling.markComplete') || 'Mark Complete'}>
          <CheckCircle size={16} />
        </button>
        <button onClick={onDelete} className="p-2 text-th-text-3 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition" title={t('common.delete') || 'Delete'}>
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
