import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase';
import { log } from '@/utils/logger';
import { useNetwork } from '@/context/network-context';

type QueryState<T> = {
  data: T[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

type QueryOptions = {
  select?: string;
  filter?: (query: any) => any;
};

export function useSupabaseQuery<T>(
  table: string,
  options?: QueryOptions
): QueryState<T> {
  const { isOnline } = useNetwork();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const fetch = useCallback(async () => {
    if (!isOnline) {
      // Don't attempt a call guaranteed to fail — surface a friendly,
      // recognizable state instead of Supabase's generic network error.
      // `isOnline` is itself a dependency below, so this effect re-runs
      // (and retries automatically) the instant connectivity returns.
      log.warn(table, 'Skipped fetch — offline');
      setError('No internet connection');
      setLoading(false);
      return;
    }

    log.info(table, 'Fetching…');
    setLoading(true);
    setError(null);

    let query = supabase.from(table).select(options?.select ?? '*');
    if (options?.filter) query = options.filter(query);

    const { data: rows, error: err } = await query;

    if (err) {
      log.error(table, 'Fetch failed', err);
      setError(err.message);
      setLoading(false);
      return;
    }
    log.ok(table, `Fetched ${rows?.length ?? 0} rows`);
    setData((rows as T[]) ?? []);
    setLoading(false);
  }, [table, tick, isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: () => setTick((n) => n + 1) };
}
