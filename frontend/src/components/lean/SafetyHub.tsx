'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Suspense, useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Shield, BarChart3, FileText, Upload, Trash2, Download, Loader2 } from 'lucide-react';
import { safetyApi } from '@/lib/api';

const SafetyTracker = dynamic(() => import('@/components/lean/SafetyTracker'), {
  loading: () => <TabLoader />,
});

type TabKey = 'safety-cross' | 'kpis' | 'documents';

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'safety-cross', label: 'Safety Cross', icon: <Shield className="w-4 h-4" /> },
  { key: 'kpis', label: 'KPIs', icon: <BarChart3 className="w-4 h-4" /> },
  { key: 'documents', label: 'Documents', icon: <FileText className="w-4 h-4" /> },
];

function TabLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
    </div>
  );
}

function SafetyKPIs() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    safetyApi.getStats()
      .then((res) => setStats(res.data ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <TabLoader />;

  const kpis = [
    { label: 'Days Without Incident', value: stats?.days_without_incident ?? 0, color: 'text-emerald-500' },
    { label: 'Total Incidents (YTD)', value: stats?.total_incidents ?? 0, color: 'text-red-500' },
    { label: 'Near Misses (YTD)', value: stats?.near_misses ?? 0, color: 'text-amber-500' },
    { label: 'Open Actions', value: stats?.open_actions ?? 0, color: 'text-blue-500' },
    { label: 'LTIR', value: stats?.ltir != null ? stats.ltir.toFixed(2) : '--', color: 'text-purple-500' },
    { label: 'Severity Rate', value: stats?.severity_rate != null ? stats.severity_rate.toFixed(2) : '--', color: 'text-orange-500' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {kpis.map((kpi) => (
        <div key={kpi.label} className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-6 text-center">
          <p className="text-xs font-medium text-th-text-3 uppercase tracking-wide mb-2">{kpi.label}</p>
          <p className={`text-3xl font-black ${kpi.color}`}>{kpi.value}</p>
        </div>
      ))}
    </div>
  );
}

interface SafetyDoc {
  id: string;
  name: string;
  category: string;
  uploadedAt: string;
  size: string;
  url: string;
}

const DOC_CATEGORIES = ['SOP', 'MSDS', 'Risk Assessment', 'Emergency Plan', 'Training Material', 'Inspection Checklist', 'Other'];

function SafetyDocuments() {
  const [docs, setDocs] = useState<SafetyDoc[]>(() => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem('leanpilot_safety_docs') || '[]'); } catch { return []; }
  });
  const [showUpload, setShowUpload] = useState(false);
  const [newDoc, setNewDoc] = useState({ name: '', category: 'SOP' });
  const fileInputRef = useState<HTMLInputElement | null>(null);

  const saveToStorage = (updated: SafetyDoc[]) => {
    setDocs(updated);
    localStorage.setItem('leanpilot_safety_docs', JSON.stringify(updated));
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const doc: SafetyDoc = {
      id: Date.now().toString(),
      name: newDoc.name || file.name,
      category: newDoc.category,
      uploadedAt: new Date().toISOString(),
      size: file.size > 1024 * 1024 ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : `${(file.size / 1024).toFixed(0)} KB`,
      url: URL.createObjectURL(file),
    };
    saveToStorage([doc, ...docs]);
    setShowUpload(false);
    setNewDoc({ name: '', category: 'SOP' });
  };

  const handleDelete = (id: string) => {
    saveToStorage(docs.filter(d => d.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-th-text-1">Safety Documents</h3>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
        >
          <Upload className="w-4 h-4" />
          Upload Document
        </button>
      </div>

      {showUpload && (
        <div className="p-4 rounded-xl border border-th-border bg-th-bg-2 space-y-3">
          <input
            type="text"
            placeholder="Document name (optional)"
            value={newDoc.name}
            onChange={(e) => setNewDoc({ ...newDoc, name: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-th-border bg-th-bg-1 text-th-text-1"
          />
          <select
            value={newDoc.category}
            onChange={(e) => setNewDoc({ ...newDoc, category: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-th-border bg-th-bg-1 text-th-text-1"
          >
            {DOC_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.png,.txt"
            onChange={handleUpload}
            className="w-full text-sm text-th-text-2 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-brand-50 file:text-brand-600 hover:file:bg-brand-100"
          />
        </div>
      )}

      {docs.length === 0 ? (
        <div className="text-center py-12 text-th-text-3">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">No documents uploaded yet</p>
          <p className="text-sm">Upload SOPs, MSDS sheets, risk assessments, and other safety documents</p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => (
            <div key={doc.id} className="flex items-center gap-4 p-3 rounded-lg border border-th-border bg-th-bg-2 hover:shadow-sm transition-shadow">
              <FileText className="w-8 h-8 text-brand-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-th-text-1 truncate">{doc.name}</p>
                <p className="text-xs text-th-text-3">{doc.category} · {doc.size} · {new Date(doc.uploadedAt).toLocaleDateString()}</p>
              </div>
              <a href={doc.url} download={doc.name} className="p-2 text-th-text-3 hover:text-brand-600">
                <Download className="w-4 h-4" />
              </a>
              <button onClick={() => handleDelete(doc.id)} className="p-2 text-th-text-3 hover:text-red-500">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SafetyHubInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const activeTab = (searchParams.get('tab') as TabKey) || 'safety-cross';

  const setTab = useCallback((key: TabKey) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', key);
    router.replace(`${pathname}?${params.toString()}`);
  }, [searchParams, router, pathname]);

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto border-b border-th-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all border-b-2 ${
              activeTab === t.key
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'safety-cross' && <SafetyTracker />}
      {activeTab === 'kpis' && <SafetyKPIs />}
      {activeTab === 'documents' && <SafetyDocuments />}
    </div>
  );
}

export default function SafetyHub() {
  return (
    <Suspense fallback={<TabLoader />}>
      <SafetyHubInner />
    </Suspense>
  );
}
