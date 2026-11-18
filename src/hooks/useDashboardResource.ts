/**
 * WURK UP — Dashboard data hook.
 *
 * Wraps a single loader in consistent loading / refreshing / error / offline
 * state. Refs (not stale closures) keep the newest loader without retriggering
 * the effect, and results from an outdated request are discarded so a slow
 * refresh can never overwrite a newer one.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { DashboardError, classifyDataError } from '../services/dashboardData';

export interface DashboardResource<T> {
  data: T | null;
  error: DashboardError | null;
  loading: boolean;
  refreshing: boolean;
  online: boolean;
  lastLoadedAt: string | null;
  refresh: () => void;
}

function toDashboardError(error: unknown): DashboardError {
  if (error instanceof DashboardError) return error;
  if (error instanceof Error) return classifyDataError({ message: error.message });
  return classifyDataError({ message: String(error) });
}

export function useDashboardResource<T>(loader: () => Promise<T>): DashboardResource<T> {
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<DashboardError | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [online, setOnline] = useState(typeof navigator === 'undefined' || navigator.onLine !== false);

  const requestId = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async (mode: 'initial' | 'refresh') => {
    const ticket = ++requestId.current;
    if (mode === 'initial') setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const result = await loaderRef.current();
      if (!mounted.current || ticket !== requestId.current) return;
      setData(result);
      setLastLoadedAt(new Date().toISOString());
    } catch (caught) {
      if (!mounted.current || ticket !== requestId.current) return;
      setError(toDashboardError(caught));
    } finally {
      if (mounted.current && ticket === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void run('initial');
  }, [run]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const goOnline = () => {
      setOnline(true);
      void run('refresh');
    };
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [run]);

  const refresh = useCallback(() => {
    void run('refresh');
  }, [run]);

  return { data, error, loading, refreshing, online, lastLoadedAt, refresh };
}
