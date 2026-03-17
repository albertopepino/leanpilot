'use client';

import { useState, useEffect } from 'react';
import { useI18n } from '@/stores/useI18n';
import { Shield, CheckCircle, DollarSign, Truck, Users, Plus, Calendar, ChevronLeft, ChevronRight, MessageSquare, AlertTriangle } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';

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
  action_items: any[];
}

const CATEGORIES = [
  { key: 'safety', icon: Shield, color: 'red', label: 'Safety' },
  { key: 'quality', icon: CheckCircle, color: 'blue', label: 'Quality' },
  { key: 'cost', icon: DollarSign, color: 'green', label: 'Cost' },
  { key: 'delivery', icon: Truck, color: 'amber', label: 'Delivery' },
  { key: 'people', icon: Users, color: 'purple', label: 'People' },
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

export default function SQCDPBoard() {
  const { t } = useI18n();
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [tierLevel, setTierLevel] = useState(1);
  const [entries, setEntries] = useState<SQCDPEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState<string | null>(null);
  const [meetingModal, setMeetingModal] = useState(false);
  const [formData, setFormData] = useState({ status: 'green', metric_value: '', target_value: '', comment: '', action_required: false, action_owner: '', action_due_date: '' });

  useEffect(() => {
    fetchEntries();
  }, [date, tierLevel]);

  async function fetchEntries() {
    setLoading(true);
    try {
      const { default: api } = await import('@/lib/api');
      const res = await api.get('/sqcdp/entries', { params: { target_date: date, tier_level: tierLevel } });
      setEntries(res.data);
    } catch { setEntries([]); }
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
      const { default: api } = await import('@/lib/api');
      const existing = getEntry(category);
      if (existing) {
        await api.patch(`/sqcdp/entries/${existing.id}`, {
          status: formData.status,
          metric_value: formData.metric_value ? parseFloat(formData.metric_value) : null,
          target_value: formData.target_value ? parseFloat(formData.target_value) : null,
          comment: formData.comment || null,
          action_required: formData.action_required,
          action_owner: formData.action_owner || null,
          action_due_date: formData.action_due_date || null,
        });
      } else {
        await api.post('/sqcdp/entries', {
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
    } catch {}
  }

  async function saveMeeting(notes: string, attendees: string) {
    try {
      const { default: api } = await import('@/lib/api');
      await api.post('/sqcdp/meetings', {
        date,
        tier_level: tierLevel,
        duration_min: 15,
        attendee_count: attendees ? parseInt(attendees) : null,
        notes: notes || null,
      });
      setMeetingModal(false);
    } catch {}
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

  return (
    <div className="p-4 md:p-6 space-y-6">
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
      </div>

      {/* SQCDP Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {CATEGORIES.map(cat => {
          const entry = getEntry(cat.key);
          const status = entry?.status || 'green';
          const Icon = cat.icon;
          return (
            <button key={cat.key} onClick={() => openEdit(cat.key)} className={`relative p-4 rounded-xl border-2 text-left transition-all hover:shadow-md ${STATUS_BG[status]}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Icon size={18} className="text-th-text-2" />
                  <span className="text-sm font-bold uppercase tracking-wide text-th-text">{cat.label}</span>
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
          );
        })}
      </div>

      {/* Action Items */}
      {actionItems.length > 0 && (
        <div className="bg-th-card rounded-xl border border-th-border p-4">
          <h3 className="text-sm font-semibold text-th-text mb-3">{t('sqcdp.actionItems') || 'Action Items'}</h3>
          <div className="space-y-2">
            {actionItems.map(item => (
              <div key={item.id} className="flex items-center gap-3 text-sm">
                <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[item.status]}`} />
                <span className="uppercase text-xs font-bold text-th-text-3 w-16">{item.category}</span>
                <span className="flex-1 text-th-text">{item.comment}</span>
                <span className="text-th-text-3">{item.action_owner}</span>
                {item.action_due_date && <span className="text-xs text-th-text-3">{item.action_due_date}</span>}
              </div>
            ))}
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
                <label className="text-xs text-th-text-3 block mb-1">{t('common.actual') || 'Actual'}</label>
                <input type="number" value={formData.metric_value} onChange={e => setFormData(p => ({ ...p, metric_value: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-th-border bg-th-background text-th-text text-sm" />
              </div>
              <div>
                <label className="text-xs text-th-text-3 block mb-1">{t('common.target') || 'Target'}</label>
                <input type="number" value={formData.target_value} onChange={e => setFormData(p => ({ ...p, target_value: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-th-border bg-th-background text-th-text text-sm" />
              </div>
            </div>
            <div>
              <label className="text-xs text-th-text-3 block mb-1">{t('common.notes') || 'Comment'}</label>
              <textarea value={formData.comment} onChange={e => setFormData(p => ({ ...p, comment: e.target.value }))} rows={2} className="w-full px-3 py-2 rounded-lg border border-th-border bg-th-background text-th-text text-sm" />
            </div>
            <label className="flex items-center gap-2 text-sm text-th-text">
              <input type="checkbox" checked={formData.action_required} onChange={e => setFormData(p => ({ ...p, action_required: e.target.checked }))} className="rounded" />
              {t('sqcdp.actionRequired') || 'Action Required'}
            </label>
            {formData.action_required && (
              <div className="grid grid-cols-2 gap-3">
                <input placeholder={t('sqcdp.owner') || 'Owner'} value={formData.action_owner} onChange={e => setFormData(p => ({ ...p, action_owner: e.target.value }))} className="px-3 py-2 rounded-lg border border-th-border bg-th-background text-th-text text-sm" />
                <input type="date" value={formData.action_due_date} onChange={e => setFormData(p => ({ ...p, action_due_date: e.target.value }))} className="px-3 py-2 rounded-lg border border-th-border bg-th-background text-th-text text-sm" />
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

function MeetingModal({ onClose, onSave, t }: { onClose: () => void; onSave: (notes: string, attendees: string) => void; t: (k: string) => string }) {
  const [notes, setNotes] = useState('');
  const [attendees, setAttendees] = useState('');
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-th-card rounded-xl p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-th-text">{t('sqcdp.logMeeting') || 'Log Tier Meeting'}</h3>
        <div>
          <label className="text-xs text-th-text-3 block mb-1">{t('sqcdp.attendees') || 'Attendees'}</label>
          <input type="number" value={attendees} onChange={e => setAttendees(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-th-border bg-th-background text-th-text text-sm" />
        </div>
        <div>
          <label className="text-xs text-th-text-3 block mb-1">{t('common.notes') || 'Notes'}</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg border border-th-border bg-th-background text-th-text text-sm" />
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-th-border text-th-text text-sm hover:bg-th-bg-hover">{t('common.cancel') || 'Cancel'}</button>
          <button onClick={() => onSave(notes, attendees)} className="flex-1 py-2 rounded-lg bg-brand-600 text-white text-sm hover:bg-brand-500">{t('common.save') || 'Save'}</button>
        </div>
      </div>
    </div>
  );
}
