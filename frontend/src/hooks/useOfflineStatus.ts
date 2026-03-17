'use client';
import { useState, useEffect, useCallback } from 'react';
import { processQueue, getPendingRequests } from '@/lib/offlineQueue';
import axios from 'axios';

export function useOfflineStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      syncPending();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check pending count
    getPendingRequests().then(r => setPendingCount(r.length)).catch(() => {});

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const syncPending = useCallback(async () => {
    setSyncing(true);
    try {
      const result = await processQueue(async (url, method, data) => {
        try {
          const token = localStorage.getItem('leanpilot_token');
          await axios({ url, method, data, headers: { Authorization: `Bearer ${token}` } });
          return true;
        } catch {
          return false;
        }
      });
      const remaining = await getPendingRequests();
      setPendingCount(remaining.length);
      return result;
    } finally {
      setSyncing(false);
    }
  }, []);

  return { isOnline, pendingCount, syncing, syncPending };
}
