'use client';

import { useState, useEffect } from 'react';
import { useI18n } from '@/stores/useI18n';
import { ClipboardList, Plus, Check, Filter, ChevronDown, ChevronUp, Trash2, ArrowUp, ArrowDown, BarChart3 } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';

type LSWFrequency = "daily" | "weekly" | "monthly";

interface LSWTemplate {
  id: number;
  title: string;
  role: string;
  frequency?: LSWFrequency;
  tasks: { order: number; description: string; duration_min: number }[];
  created_at: string;
}

// Recommended frequency per role level (lean best practice)
const ROLE_FREQUENCY_MAP: Record<string, LSWFrequency> = {
  operator: "daily",
  team_leader: "daily",
  supervisor: "weekly",
  manager: "monthly",
};

const FREQUENCY_OPTIONS: LSWFrequency[] = ["daily", "weekly", "monthly"];

const FREQUENCY_COLORS: Record<LSWFrequency, string> = {
  daily: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400",
  weekly: "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
  monthly: "bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400",
};

interface LSWCompletion {
  id: number;
  template_id: number;
  date: string;
  completed_tasks: number[];
  total_tasks: number;
  completion_pct: number;
  notes: string | null;
}

const ROLES = ['operator', 'team_leader', 'supervisor', 'manager'];

export default function LeaderStandardWork() {
  const { t } = useI18n();
  const [templates, setTemplates] = useState<LSWTemplate[]>([]);
  const [completions, setCompletions] = useState<LSWCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('all');
  const [view, setView] = useState<'today' | 'templates' | 'history'>('today');
  const [createMode, setCreateMode] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [checkedTasks, setCheckedTasks] = useState<number[]>([]);
  const [formTitle, setFormTitle] = useState('');
  const [formRole, setFormRole] = useState('operator');
  const [formFrequency, setFormFrequency] = useState<LSWFrequency>('daily');
  const [formTasks, setFormTasks] = useState<{ description: string; duration_min: number }[]>([{ description: '', duration_min: 5 }]);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const { default: api } = await import('@/lib/api');
      const [tRes, cRes] = await Promise.all([
        api.get('/lsw/templates'),
        api.get('/lsw/completions', { params: { date: new Date().toISOString().split('T')[0] } }),
      ]);
      setTemplates(tRes.data);
      setCompletions(cRes.data);
    } catch { setTemplates([]); setCompletions([]); }
    setLoading(false);
  }

  async function saveTemplate() {
    try {
      const { default: api } = await import('@/lib/api');
      await api.post('/lsw/templates', {
        title: formTitle,
        role: formRole,
        frequency: formFrequency,
        tasks: formTasks.filter(t => t.description).map((t, i) => ({ order: i + 1, description: t.description, duration_min: t.duration_min })),
      });
      setCreateMode(false);
      setFormTitle('');
      setFormFrequency('daily');
      setFormTasks([{ description: '', duration_min: 5 }]);
      fetchData();
    } catch {}
  }

  async function saveCompletion(templateId: number) {
    const tmpl = templates.find(t => t.id === templateId);
    if (!tmpl) return;
    try {
      const { default: api } = await import('@/lib/api');
      await api.post('/lsw/completions', {
        template_id: templateId,
        date: new Date().toISOString().split('T')[0],
        completed_tasks: checkedTasks,
        total_tasks: tmpl.tasks.length,
        completion_pct: Math.round((checkedTasks.length / tmpl.tasks.length) * 100),
      });
      setSelectedTemplate(null);
      setCheckedTasks([]);
      fetchData();
    } catch {}
  }

  async function deleteTemplate(id: number) {
    try {
      const { default: api } = await import('@/lib/api');
      await api.delete(`/lsw/templates/${id}`);
      fetchData();
    } catch {}
  }

  function moveTask(index: number, direction: -1 | 1) {
    const newTasks = [...formTasks];
    const target = index + direction;
    if (target < 0 || target >= newTasks.length) return;
    [newTasks[index], newTasks[target]] = [newTasks[target], newTasks[index]];
    setFormTasks(newTasks);
  }

  function toggleTask(order: number) {
    setCheckedTasks(prev => prev.includes(order) ? prev.filter(t => t !== order) : [...prev, order]);
  }

  const filteredTemplates = roleFilter === 'all' ? templates : templates.filter(t => t.role === roleFilter);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader titleKey="lsw.title" subtitleKey="lsw.subtitle" icon={ClipboardList}
        actions={
          <button onClick={() => setCreateMode(true)} className="flex items-center gap-2 px-3 py-1.5 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-500 transition">
            <Plus size={14} /> {t('lsw.newTemplate') || 'New Template'}
          </button>
        }
      />

      {/* View tabs */}
      <div className="flex gap-1 bg-th-card rounded-lg border border-th-border p-1 w-fit">
        {(['today', 'templates', 'history'] as const).map(v => (
          <button key={v} onClick={() => setView(v)} className={`px-4 py-1.5 rounded text-xs font-medium transition capitalize ${view === v ? 'bg-brand-600 text-white' : 'text-th-text-3 hover:bg-th-bg-hover'}`}>
            {t(`lsw.${v}`) || v}
          </button>
        ))}
      </div>

      {/* Role filter */}
      <div className="flex items-center gap-2">
        <Filter size={14} className="text-th-text-3" />
        <div className="flex gap-1">
          <button onClick={() => setRoleFilter('all')} className={`px-3 py-1 rounded-full text-xs transition ${roleFilter === 'all' ? 'bg-brand-600 text-white' : 'bg-th-bg-hover text-th-text-3'}`}>{t('lsw.allRoles') || 'All'}</button>
          {ROLES.map(r => (
            <button key={r} onClick={() => setRoleFilter(r)} className={`px-3 py-1 rounded-full text-xs capitalize transition ${roleFilter === r ? 'bg-brand-600 text-white' : 'bg-th-bg-hover text-th-text-3'}`}>{t(`lsw.${r}`) || r}</button>
          ))}
        </div>
      </div>

      {/* Today view - daily task tracking */}
      {view === 'today' && (
        <div className="space-y-4">
          {filteredTemplates.length === 0 && <p className="text-sm text-th-text-3 italic">{t('lsw.noTemplates') || 'No templates found. Create one to get started.'}</p>}
          {filteredTemplates.map(tmpl => {
            const comp = completions.find(c => c.template_id === tmpl.id);
            const pct = comp?.completion_pct ?? 0;
            return (
              <div key={tmpl.id} className="bg-th-card rounded-xl border border-th-border p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-th-text">{tmpl.title}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-th-text-3 capitalize">{t(`lsw.${tmpl.role}`) || tmpl.role}</span>
                      {tmpl.frequency && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${FREQUENCY_COLORS[tmpl.frequency] || FREQUENCY_COLORS.daily}`}>
                          {t(`lsw.${tmpl.frequency}`) || tmpl.frequency}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-th-bg-hover rounded-full overflow-hidden">
                        <div className="h-full bg-brand-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-bold text-th-text">{pct}%</span>
                    </div>
                    {!comp && (
                      <button onClick={() => { setSelectedTemplate(tmpl.id); setCheckedTasks([]); }} className="px-3 py-1 bg-brand-600 text-white rounded-lg text-xs hover:bg-brand-500">
                        {t('lsw.startChecklist') || 'Start'}
                      </button>
                    )}
                  </div>
                </div>
                {selectedTemplate === tmpl.id && (
                  <div className="space-y-2 mt-3 border-t border-th-border pt-3">
                    {tmpl.tasks.map(task => (
                      <label key={task.order} className="flex items-center gap-3 text-sm cursor-pointer hover:bg-th-bg-hover p-1.5 rounded-lg transition">
                        <input type="checkbox" checked={checkedTasks.includes(task.order)} onChange={() => toggleTask(task.order)} className="rounded" />
                        <span className={`flex-1 ${checkedTasks.includes(task.order) ? 'line-through text-th-text-3' : 'text-th-text'}`}>{task.description}</span>
                        <span className="text-xs text-th-text-3">{task.duration_min}m</span>
                      </label>
                    ))}
                    <button onClick={() => saveCompletion(tmpl.id)} className="mt-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-500 transition">
                      {t('lsw.saveCompletion') || 'Save Completion'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Templates view */}
      {view === 'templates' && (
        <div className="space-y-3">
          {filteredTemplates.map(tmpl => (
            <div key={tmpl.id} className="bg-th-card rounded-xl border border-th-border p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-sm font-semibold text-th-text">{tmpl.title}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-th-text-3 capitalize">{t(`lsw.${tmpl.role}`) || tmpl.role} - {tmpl.tasks.length} tasks</span>
                    {tmpl.frequency && (
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${FREQUENCY_COLORS[tmpl.frequency] || FREQUENCY_COLORS.daily}`}>
                        {t(`lsw.${tmpl.frequency}`) || tmpl.frequency}
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={() => deleteTemplate(tmpl.id)} className="p-1.5 text-th-text-3 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded transition">
                  <Trash2 size={14} />
                </button>
              </div>
              <ol className="space-y-1">
                {tmpl.tasks.map(task => (
                  <li key={task.order} className="text-xs text-th-text-2 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-th-bg-hover flex items-center justify-center text-th-text-3 font-medium">{task.order}</span>
                    {task.description} <span className="text-th-text-3">({task.duration_min}m)</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}

      {/* History view */}
      {view === 'history' && (
        <div className="bg-th-card rounded-xl border border-th-border divide-y divide-th-border">
          {completions.length === 0 && <div className="p-4 text-sm text-th-text-3 italic">{t('common.noData') || 'No completions recorded'}</div>}
          {completions.map(c => {
            const tmpl = templates.find(t => t.id === c.template_id);
            return (
              <div key={c.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-th-text">{tmpl?.title || `Template #${c.template_id}`}</span>
                  <span className="text-xs text-th-text-3 ml-2">{c.date}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-2 bg-th-bg-hover rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${c.completion_pct >= 80 ? 'bg-emerald-500' : c.completion_pct >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${c.completion_pct}%` }} />
                  </div>
                  <span className="text-xs font-bold text-th-text">{c.completion_pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Template Modal */}
      {createMode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setCreateMode(false)}>
          <div className="bg-th-card rounded-xl p-6 w-full max-w-lg space-y-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-th-text">{t('lsw.newTemplate') || 'New LSW Template'}</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-th-text-3 block mb-1">{t('common.title') || 'Title'}</label>
                <input value={formTitle} onChange={e => setFormTitle(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-th-border bg-th-background text-th-text text-sm" />
              </div>
              <div>
                <label className="text-xs text-th-text-3 block mb-1">{t('common.role') || 'Role'}</label>
                <select value={formRole} onChange={e => {
                  const newRole = e.target.value;
                  setFormRole(newRole);
                  // Auto-set recommended frequency for the role
                  const recommended = ROLE_FREQUENCY_MAP[newRole];
                  if (recommended) setFormFrequency(recommended);
                }} className="w-full px-3 py-2 rounded-lg border border-th-border bg-th-background text-th-text text-sm">
                  {ROLES.map(r => <option key={r} value={r}>{t(`lsw.${r}`) || r}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-th-text-3 block mb-1">{t('lsw.frequency') || 'Frequency'}</label>
                <select value={formFrequency} onChange={e => setFormFrequency(e.target.value as LSWFrequency)} className="w-full px-3 py-2 rounded-lg border border-th-border bg-th-background text-th-text text-sm">
                  {FREQUENCY_OPTIONS.map(f => <option key={f} value={f}>{t(`lsw.${f}`) || f}</option>)}
                </select>
                <p className="text-[10px] text-th-text-3 mt-1">
                  {t('lsw.recommendedFrequency') || 'Recommended'}: {t(`lsw.${ROLE_FREQUENCY_MAP[formRole] || 'daily'}`) || ROLE_FREQUENCY_MAP[formRole] || 'daily'}
                </p>
              </div>
            </div>
            <div>
              <label className="text-xs text-th-text-3 block mb-2">{t('lsw.tasks') || 'Tasks'}</label>
              <div className="space-y-2">
                {formTasks.map((task, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-th-text-3 w-5">{i + 1}.</span>
                    <input value={task.description} onChange={e => { const n = [...formTasks]; n[i].description = e.target.value; setFormTasks(n); }} placeholder="Task description" className="flex-1 px-3 py-1.5 rounded-lg border border-th-border bg-th-background text-th-text text-sm" />
                    <input type="number" value={task.duration_min} onChange={e => { const n = [...formTasks]; n[i].duration_min = parseInt(e.target.value) || 0; setFormTasks(n); }} className="w-16 px-2 py-1.5 rounded-lg border border-th-border bg-th-background text-th-text text-sm text-center" />
                    <button onClick={() => moveTask(i, -1)} className="p-1 text-th-text-3 hover:text-th-text"><ArrowUp size={12} /></button>
                    <button onClick={() => moveTask(i, 1)} className="p-1 text-th-text-3 hover:text-th-text"><ArrowDown size={12} /></button>
                    <button onClick={() => setFormTasks(formTasks.filter((_, j) => j !== i))} className="p-1 text-th-text-3 hover:text-rose-500"><Trash2 size={12} /></button>
                  </div>
                ))}
              </div>
              <button onClick={() => setFormTasks([...formTasks, { description: '', duration_min: 5 }])} className="mt-2 text-xs text-brand-600 hover:text-brand-500 flex items-center gap-1">
                <Plus size={12} /> {t('lsw.addTask') || 'Add Task'}
              </button>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setCreateMode(false)} className="flex-1 py-2 rounded-lg border border-th-border text-th-text text-sm hover:bg-th-bg-hover">{t('common.cancel') || 'Cancel'}</button>
              <button onClick={saveTemplate} className="flex-1 py-2 rounded-lg bg-brand-600 text-white text-sm hover:bg-brand-500">{t('common.save') || 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
