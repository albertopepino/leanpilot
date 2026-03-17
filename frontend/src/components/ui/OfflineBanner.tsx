'use client';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';
import { WifiOff, RefreshCw, CloudOff } from 'lucide-react';

export default function OfflineBanner() {
  const { isOnline, pendingCount, syncing, syncPending } = useOfflineStatus();

  if (isOnline && pendingCount === 0) return null;

  return (
    <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
      isOnline ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-red-100 text-red-800 border border-red-300'
    }`}>
      {!isOnline ? (
        <>
          <WifiOff className="w-4 h-4" />
          <span>You are offline. Changes will be saved locally.</span>
        </>
      ) : pendingCount > 0 ? (
        <>
          <CloudOff className="w-4 h-4" />
          <span>{pendingCount} pending change{pendingCount > 1 ? 's' : ''}</span>
          <button
            onClick={syncPending}
            disabled={syncing}
            className="ml-2 px-2 py-1 bg-amber-600 text-white rounded text-xs hover:bg-amber-700 disabled:opacity-50 flex items-center gap-1"
          >
            <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync now'}
          </button>
        </>
      ) : null}
    </div>
  );
}
