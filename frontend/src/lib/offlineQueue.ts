/**
 * Offline queue: stores failed API requests in IndexedDB and retries when online.
 */

interface QueuedRequest {
  id: string;
  url: string;
  method: string;
  data: unknown;
  timestamp: number;
  retryCount: number;
}

const DB_NAME = 'leanpilot_offline';
const STORE_NAME = 'pending_requests';
const MAX_RETRIES = 5;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function enqueueRequest(url: string, method: string, data: unknown): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const item: QueuedRequest = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
    url,
    method,
    data,
    timestamp: Date.now(),
    retryCount: 0,
  };
  store.add(item);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingRequests(): Promise<QueuedRequest[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const request = store.getAll();
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function removeRequest(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).delete(id);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function processQueue(
  sendFn: (url: string, method: string, data: unknown) => Promise<boolean>
): Promise<{ processed: number; failed: number }> {
  const pending = await getPendingRequests();
  let processed = 0;
  let failed = 0;

  for (const req of pending) {
    if (req.retryCount >= MAX_RETRIES) {
      await removeRequest(req.id);
      failed++;
      continue;
    }
    try {
      const success = await sendFn(req.url, req.method, req.data);
      if (success) {
        await removeRequest(req.id);
        processed++;
      } else {
        // Increment retry count
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        req.retryCount++;
        store.put(req);
        failed++;
      }
    } catch {
      failed++;
    }
  }

  return { processed, failed };
}
