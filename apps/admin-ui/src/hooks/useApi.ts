/**
 * React hooks for API interactions
 */

import { useState, useEffect, useCallback } from 'react';
import { api, ApiResponse, Module, Run, Approval } from '../lib/api';

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useModules(): UseApiState<Module[]> {
  const [data, setData] = useState<Module[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.getModules();
      if (response.success) {
        setData(response.data || []);
      } else {
        setError(response.error || 'Failed to fetch modules');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

export function useModule(moduleId: string): UseApiState<Module> {
  const [data, setData] = useState<Module | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!moduleId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await api.getModule(moduleId);
      if (response.success) {
        setData(response.data || null);
      } else {
        setError(response.error || 'Failed to fetch module');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [moduleId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

export function useRuns(moduleId?: string): UseApiState<Run[]> {
  const [data, setData] = useState<Run[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.getRuns(moduleId);
      if (response.success) {
        setData(response.data || []);
      } else {
        setError(response.error || 'Failed to fetch runs');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [moduleId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

export function useApprovals(status?: string): UseApiState<Approval[]> {
  const [data, setData] = useState<Approval[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.getApprovals(status);
      if (response.success) {
        setData(response.data || []);
      } else {
        setError(response.error || 'Failed to fetch approvals');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

interface UsePollingOptions {
  interval?: number;
  enabled?: boolean;
}

export function usePollingRuns(
  moduleId?: string,
  options: UsePollingOptions = {}
): UseApiState<Run[]> {
  const { interval = 5000, enabled = true } = options;
  const state = useRuns(moduleId);

  useEffect(() => {
    if (!enabled) return;

    const id = setInterval(() => {
      state.refetch();
    }, interval);

    return () => clearInterval(id);
  }, [enabled, interval, state.refetch]);

  return state;
}
