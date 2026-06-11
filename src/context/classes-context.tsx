import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { Alert } from 'react-native';

import { supabase } from '@/utils/supabase';
import { log } from '@/utils/logger';
import { ClassItem } from '@/data/classes';

const TAG = 'Classes';

/** Class is "live" if now is within [scheduled_at - 30min, scheduled_at + 90min] */
function isLiveNow(iso: string | null): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  const now = Date.now();
  return now >= t - 60_000 && now <= t + 90 * 60_000;
}

/** Class is "past" if scheduled_at + 2 hours has elapsed */
function isPastClass(iso: string | null): boolean {
  if (!iso) return false;
  return Date.now() > new Date(iso).getTime() + 2 * 60 * 60_000;
}

/** Format ISO datetime to readable string like "Mon 14 Jun · 14:00" */
export function fmtClassTime(iso: string | null): string {
  if (!iso) return 'TBA';
  return new Date(iso).toLocaleString('en-ZA', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

type ClassesContextType = {
  classes: ClassItem[];
  loading: boolean;
  error: string | null;
  addClass: (item: { title: string; tutor: string; grade: string; subject: string; scheduled_at: string }) => Promise<void>;
  deleteClass: (id: string) => Promise<void>;
  refetch: () => void;
};

const ClassesContext = createContext<ClassesContextType | null>(null);

export function ClassesProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClasses = useCallback(async () => {
    log.info(TAG, 'Fetching classes…');
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('classes')
      .select('*')
      .order('scheduled_at', { ascending: true });
    if (err) {
      log.error(TAG, 'Fetch failed', err);
      setError(err.message);
      setLoading(false);
      return;
    }
    const mapped: ClassItem[] = (data ?? []).map((c: any) => ({
      ...c,
      time: fmtClassTime(c.scheduled_at),
      live: isLiveNow(c.scheduled_at),
      isPast: isPastClass(c.scheduled_at),
    }));
    log.ok(TAG, `Fetched ${mapped.length} classes`);
    setItems(mapped);
    setLoading(false);
  }, []);

  useEffect(() => { fetchClasses(); }, [fetchClasses]);

  async function addClass(input: { title: string; tutor: string; grade: string; subject: string; scheduled_at: string }) {
    const slug = input.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 28);
    const rand = Math.random().toString(36).slice(2, 8);
    const room = `gl-${slug}-${rand}`;
    log.info(TAG, 'Creating class…', { title: input.title, room });

    const { data: { user } } = await supabase.auth.getUser();

    // Fetch full_name fresh in case profile context hasn't loaded yet
    const { data: profileRow } = await supabase
      .from('profiles').select('full_name').eq('id', user?.id ?? '').single();
    const tutorName = profileRow?.full_name ?? input.tutor;

    const { error: err } = await supabase.from('classes').insert({
      title:        input.title,
      tutor:        tutorName,
      grade:        input.grade,
      subject:      input.subject,
      scheduled_at: input.scheduled_at,
      room,
      live:         false,
      tutor_id:     user?.id ?? null,
      created_by:   user?.id ?? null,
    });
    if (err) {
      log.error(TAG, 'Class insert failed', err);
      Alert.alert('Error', 'Could not create class. Please try again.');
      return;
    }
    log.ok(TAG, 'Class created', { room });
    await fetchClasses();
  }

  async function deleteClass(id: string) {
    const { error: err } = await supabase.from('classes').delete().eq('id', id);
    if (err) {
      log.error(TAG, 'Delete failed', err);
      Alert.alert('Delete Failed', err.message);
      return;
    }
    log.ok(TAG, 'Class deleted', { id });
    setItems(prev => prev.filter(c => c.id !== id));
  }

  return (
    <ClassesContext.Provider value={{ classes: items, loading, error, addClass, deleteClass, refetch: fetchClasses }}>
      {children}
    </ClassesContext.Provider>
  );
}

export function useClasses() {
  const ctx = useContext(ClassesContext);
  if (!ctx) throw new Error('useClasses must be used inside ClassesProvider');
  return ctx;
}
