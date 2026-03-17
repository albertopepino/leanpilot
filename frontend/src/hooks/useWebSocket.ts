'use client';
import { useEffect, useRef, useCallback, useState } from 'react';

type WSEvent = {
  type: string;
  data: Record<string, unknown>;
};

type EventHandler = (data: Record<string, unknown>) => void;

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Map<string, Set<EventHandler>>>(new Map());
  const [connected, setConnected] = useState(false);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    const token = localStorage.getItem('leanpilot_token');
    if (!token) return;

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const wsUrl = baseUrl.replace(/^http/, 'ws');
    const ws = new WebSocket(`${wsUrl}/ws?token=${token}`);

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      // Auto-reconnect after 3s
      reconnectTimer.current = setTimeout(connect, 3000);
    };
    ws.onmessage = (event) => {
      try {
        const msg: WSEvent = JSON.parse(event.data);
        const handlers = handlersRef.current.get(msg.type);
        if (handlers) {
          handlers.forEach(h => h(msg.data));
        }
      } catch { /* ignore non-JSON */ }
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const on = useCallback((eventType: string, handler: EventHandler) => {
    if (!handlersRef.current.has(eventType)) {
      handlersRef.current.set(eventType, new Set());
    }
    handlersRef.current.get(eventType)!.add(handler);
    return () => {
      handlersRef.current.get(eventType)?.delete(handler);
    };
  }, []);

  return { connected, on };
}
