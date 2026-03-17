"use client";
import { useState, useRef, useEffect } from "react";
import { useI18n } from "@/stores/useI18n";
import { Bell, AlertCircle, AlertTriangle, Info } from "lucide-react";

interface Notification {
  id: string;
  type: "danger" | "warning" | "info";
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

interface NotificationBellProps {
  notifications?: Notification[];
}

export default function NotificationBell({ notifications = [] }: NotificationBellProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const typeIcons = {
    danger: <AlertCircle size={14} className="text-red-500" />,
    warning: <AlertTriangle size={14} className="text-amber-500" />,
    info: <Info size={14} className="text-blue-500" />,
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-th-bg-hover transition text-th-text-2 hover:text-th-text"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-th-card border border-th-card-border rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-th-border">
            <h3 className="text-sm font-semibold text-th-text">{t("common.notifications") || "Notifications"}</h3>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-th-text-3">
                {t("common.noNotifications") || "No notifications"}
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`px-4 py-3 border-b border-th-border last:border-0 ${!n.read ? "bg-brand-50/50 dark:bg-brand-900/10" : ""}`}
                >
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5">{typeIcons[n.type]}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!n.read ? "font-medium text-th-text" : "text-th-text-2"}`}>{n.title}</p>
                      <p className="text-xs text-th-text-3 mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-th-text-3 mt-1">{n.timestamp}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
