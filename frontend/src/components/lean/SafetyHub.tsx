'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Suspense, useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Shield, BarChart3, FileText, Upload, Trash2, Download, Loader2, AlertTriangle, ExternalLink } from 'lucide-react';
import { safetyApi } from '@/lib/api';
import { useI18n } from '@/stores/useI18n';
import DisplayModeWrapper from '@/components/ui/DisplayModeWrapper';
import ToolInfoCard from '@/components/ui/ToolInfoCard';
import { TOOL_INFO } from '@/lib/toolInfo';
import type { SafetyDocumentResponse, SafetyIncidentResponse } from '@/lib/types';

const SafetyTracker = dynamic(() => import('@/components/lean/SafetyTracker'), {
  loading: () => <TabLoader />,
});

type TabKey = 'safety-cross' | 'kpis' | 'documents' | 'corrective-actions';

const TAB_KEYS: { key: TabKey; labelKey: string; icon: React.ReactNode }[] = [
  { key: 'safety-cross', labelKey: 'common.safetyTabCross', icon: <Shield className="w-4 h-4" /> },
  { key: 'kpis', labelKey: 'common.safetyTabKPIs', icon: <BarChart3 className="w-4 h-4" /> },
  { key: 'documents', labelKey: 'common.safetyTabDocuments', icon: <FileText className="w-4 h-4" /> },
  { key: 'corrective-actions', labelKey: 'common.safetyTabCorrectiveActions', icon: <AlertTriangle className="w-4 h-4" /> },
];

function TabLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
    </div>
  );
}

interface SafetyStats {
  days_without_incident?: number;
  total_incidents?: number;
  open_count?: number;
}

function SafetyKPIs() {
  const [stats, setStats] = useState<SafetyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { t } = useI18n();

  const loadStats = useCallback(() => {
    safetyApi.getStats()
      .then((res) => setStats(res.data ?? null))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Listen for display-mode-refresh events to re-fetch data
  useEffect(() => {
    const handler = () => { loadStats(); };
    window.addEventListener("display-mode-refresh", handler);
    return () => window.removeEventListener("display-mode-refresh", handler);
  }, [loadStats]);

  if (loading) return <TabLoader />;
  if (error) return <p className="text-center py-8 text-th-text-3">{t('common.failedToLoadData')}</p>;

  const kpis = [
    { label: t('common.safetyDaysWithout'), value: stats?.days_without_incident ?? 0, color: 'text-emerald-500' },
    { label: t('common.safetyTotalYTD'), value: stats?.total_incidents ?? 0, color: 'text-red-500' },
    { label: t('common.safetyOpenIncidents'), value: stats?.open_count ?? 0, color: 'text-amber-500' },
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

const DOC_CATEGORIES = ['SOP', 'MSDS', 'Risk Assessment', 'Emergency Plan', 'Training Material', 'Inspection Checklist', 'Other'];

function SafetyDocumentsPanel() {
  const [docs, setDocs] = useState<SafetyDocumentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newDoc, setNewDoc] = useState({ name: '', category: 'SOP', description: '' });
  const { t } = useI18n();

  const loadDocs = useCallback(async () => {
    try {
      const res = await safetyApi.listDocuments();
      setDocs(Array.isArray(res.data) ? res.data : []);
    } catch {
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  // Listen for display-mode-refresh events to re-fetch data
  useEffect(() => {
    const handler = () => { loadDocs(); };
    window.addEventListener("display-mode-refresh", handler);
    return () => window.removeEventListener("display-mode-refresh", handler);
  }, [loadDocs]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await safetyApi.uploadDocument(
        file,
        newDoc.name || file.name,
        newDoc.description,
        newDoc.category,
      );
      setShowUpload(false);
      setNewDoc({ name: '', category: 'SOP', description: '' });
      await loadDocs();
    } catch {
      // Upload failed — silently handle
    } finally {
      setUploading(false);
      // Reset file input
      e.target.value = '';
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await safetyApi.deleteDocument(id);
      setDocs((prev) => prev.filter((d) => d.id !== id));
    } catch {
      // Delete failed
    }
  };

  const handleDownload = async (doc: SafetyDocumentResponse) => {
    try {
      const res = await safetyApi.downloadDocument(doc.id);
      const blob = new Blob([res.data], { type: doc.mime_type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Download failed
    }
  };

  const formatSize = (bytes: number) =>
    bytes > 1024 * 1024
      ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
      : `${(bytes / 1024).toFixed(0)} KB`;

  if (loading) return <TabLoader />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-th-text">{t('common.safetyDocuments')}</h3>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
        >
          <Upload className="w-4 h-4" />
          {t('common.safetyUploadDocument')}
        </button>
      </div>

      {showUpload && (
        <div className="p-4 rounded-xl border border-th-border bg-th-bg-2 space-y-3">
          <input
            type="text"
            placeholder={t('common.safetyDocNamePlaceholder')}
            value={newDoc.name}
            onChange={(e) => setNewDoc({ ...newDoc, name: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-th-border bg-th-bg text-th-text"
          />
          <select
            value={newDoc.category}
            onChange={(e) => setNewDoc({ ...newDoc, category: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-th-border bg-th-bg text-th-text"
          >
            {DOC_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.png,.txt"
            onChange={handleUpload}
            disabled={uploading}
            className="w-full text-sm text-th-text-2 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-brand-50 file:text-brand-600 hover:file:bg-brand-100"
          />
          {uploading && (
            <div className="flex items-center gap-2 text-sm text-th-text-3">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('common.saving')}
            </div>
          )}
        </div>
      )}

      {docs.length === 0 ? (
        <div className="text-center py-12 text-th-text-3">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">{t('common.safetyNoDocuments')}</p>
          <p className="text-sm">{t('common.safetyNoDocumentsHint')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => (
            <div key={doc.id} className="flex items-center gap-4 p-3 rounded-lg border border-th-border bg-th-bg-2 hover:shadow-sm transition-shadow">
              <FileText className="w-8 h-8 text-brand-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-th-text truncate">{doc.title}</p>
                <p className="text-xs text-th-text-3">
                  {doc.category} · {formatSize(doc.file_size)} · {new Date(doc.created_at).toLocaleDateString()}
                </p>
              </div>
              <button onClick={() => handleDownload(doc)} className="p-2 text-th-text-3 hover:text-brand-600">
                <Download className="w-4 h-4" />
              </button>
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


function CorrectiveActionsPanel() {
  const [incidents, setIncidents] = useState<SafetyIncidentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { t } = useI18n();

  useEffect(() => {
    safetyApi.listIncidents()
      .then((res) => {
        const all = Array.isArray(res.data) ? res.data : [];
        // Filter to incidents that have corrective actions defined
        setIncidents(all.filter((i: SafetyIncidentResponse) => i.corrective_action));
      })
      .catch(() => setIncidents([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <TabLoader />;

  if (incidents.length === 0) {
    return (
      <div className="text-center py-12 text-th-text-3">
        <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="text-lg font-medium">{t('common.safetyNoCorrActions')}</p>
        <p className="text-sm">{t('common.safetyNoCorrActionsHint')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-th-text">{t('common.safetyCorrectiveActions')}</h3>
      {incidents.map((inc) => (
        <div key={inc.id} className="rounded-xl border border-th-border bg-th-bg-2 shadow-sm p-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h4 className="font-semibold text-th-text">{inc.title}</h4>
              <p className="text-xs text-th-text-3">
                {inc.incident_type} · {inc.severity} · {new Date(inc.date).toLocaleDateString()}
              </p>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              inc.status === 'resolved' || inc.status === 'closed'
                ? 'bg-emerald-100 text-emerald-700'
                : inc.status === 'investigating'
                ? 'bg-amber-100 text-amber-700'
                : 'bg-red-100 text-red-700'
            }`}>
              {inc.status}
            </span>
          </div>
          <p className="text-sm text-th-text-2 mb-3">{inc.corrective_action}</p>
          <div className="flex gap-2">
            <button
              onClick={() => router.push(`/improvement/kaizen?source=safety&id=${inc.id}`)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              {t('common.safetyCreateKaizen')}
            </button>
            <button
              onClick={() => router.push(`/improvement/root-cause?source=safety&id=${inc.id}`)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-th-bg-3 text-th-text rounded-lg hover:bg-th-bg-hover border border-th-border transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              {t('common.safetyStart5Why')}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}


function SafetyHubInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();
  const activeTab = (searchParams.get('tab') as TabKey) || 'safety-cross';

  const setTab = useCallback((key: TabKey) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', key);
    router.replace(`${pathname}?${params.toString()}`);
  }, [searchParams, router, pathname]);

  return (
    <div className="space-y-6">
      {/* Tool info card */}
      <ToolInfoCard info={TOOL_INFO.safety} />

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto border-b border-th-border">
        {TAB_KEYS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all border-b-2 ${
              activeTab === tab.key
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-th-text-3 hover:text-th-text-2'
            }`}
          >
            {tab.icon}
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'safety-cross' && <SafetyTracker />}
      {activeTab === 'kpis' && <SafetyKPIs />}
      {activeTab === 'documents' && <SafetyDocumentsPanel />}
      {activeTab === 'corrective-actions' && <CorrectiveActionsPanel />}
    </div>
  );
}

export default function SafetyHub() {
  const { t } = useI18n();
  return (
    <Suspense fallback={<TabLoader />}>
      <DisplayModeWrapper title={t('common.titleSafety') || 'Safety Tracker'} refreshInterval={60}>
        <SafetyHubInner />
      </DisplayModeWrapper>
    </Suspense>
  );
}
