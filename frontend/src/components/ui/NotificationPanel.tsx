'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/stores/useI18n';
import { Bell, Check, CheckCheck, X, AlertTriangle, Shield, Wrench, Zap, FileText, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Notification {
  id: number;
  notification_type: string;
  priority: string;
  title: string;
  message: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

const TYPE_ICONS: Record<string, any> = {
  qc_fail: AlertTriangle,
  andon_triggered: Zap,
  ncr_created: FileText,
  capa_overdue: Clock,
  kaizen_assigned: Check,
  tpm_due: Wrench,
  shift_handover: FileText,
  escalation: AlertTriangle,
  audit_due: Shield,
  oee_drop: AlertTriangle,
  general: Bell,
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'border-l-rose-500 bg-rose-50 dark:bg-rose-900/10',
  high: 'border-l-amber-500 bg-amber-50 dark:bg-amber-900/10',
  medium: 'border-l-blue-500',
  low: 'border-l-slate-300',
};

export default function NotificationPanel() {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    try {
      const { default: api } = await import('@/lib/api');
      const [listRes, countRes] = await Promise.all([
        api.get('/notifications/', { params: { limit: 20 } }),
        api.get('/notifications/count'),
      ]);
      setNotifications(listRes.data);
      setUnreadCount(countRes.data.unread);
    } catch {}
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  async function markRead(id: number) {
    try {
      const { default: api } = await import('@/lib/api');
      await api.post(`/notifications/${id}/read`);
      fetchNotifications();
    } catch {}
  }

  async function markAllRead() {
    try {
      const { default: api } = await import('@/lib/api');
      await api.post('/notifications/read-all');
      fetchNotifications();
    } catch {}
  }

  function handleClick(notif: Notification) {
    if (!notif.is_read) markRead(notif.id);
    if (notif.link) router.push(notif.link);
    setOpen(false);
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 60) return `${min}m`;
    const hrs = Math.floor(min / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="relative p-2 rounded-lg hover:bg-th-bg-hover transition" aria-label={t('common.notifications') || 'Notifications'}>
        <Bell size={18} className="text-th-text-2" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 md:w-96 bg-th-card border border-th-border rounded-xl shadow-xl z-50 max-h-[70vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-th-border">
              <h3 className="text-sm font-semibold text-th-text">{t('common.notifications') || 'Notifications'}</h3>
              <div className="flex gap-2">
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-xs text-brand-600 hover:underline flex items-center gap-1">
                    <CheckCheck size={12} /> {t('notifications.markAllRead') || 'Mark all read'}
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="text-th-text-3 hover:text-th-text"><X size={14} /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="py-12 text-center text-th-text-3 text-sm">{t('common.noNotifications') || 'No notifications'}</div>
              ) : (
                notifications.map(notif => {
                  const Icon = TYPE_ICONS[notif.notification_type] || Bell;
                  return (
                    <button key={notif.id} onClick={() => handleClick(notif)} className={`w-full text-left px-4 py-3 border-l-4 border-b border-th-border hover:bg-th-bg-hover transition ${PRIORITY_COLORS[notif.priority] || ''} ${!notif.is_read ? 'bg-brand-500/5' : ''}`}>
                      <div className="flex gap-3">
                        <Icon size={16} className={`shrink-0 mt-0.5 ${notif.priority === 'critical' ? 'text-rose-500' : notif.priority === 'high' ? 'text-amber-500' : 'text-th-text-3'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className={`text-sm truncate ${!notif.is_read ? 'font-semibold text-th-text' : 'text-th-text-2'}`}>{notif.title}</p>
                            <span className="text-[10px] text-th-text-3 shrink-0">{timeAgo(notif.created_at)}</span>
                          </div>
                          {notif.message && <p className="text-xs text-th-text-3 mt-0.5 line-clamp-2">{notif.message}</p>}
                        </div>
                        {!notif.is_read && <div className="w-2 h-2 rounded-full bg-brand-600 shrink-0 mt-1.5" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
