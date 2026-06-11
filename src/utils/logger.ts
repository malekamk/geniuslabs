// Debug logger — only runs in dev builds (__DEV__ is false in production)

type SupabaseError = {
  message?: string;
  code?: string;
  hint?: string;
  details?: string;
} | null;

function fmt(error: SupabaseError): string {
  if (!error) return 'unknown error';
  const parts = [`msg: ${error.message ?? '?'}`];
  if (error.code)    parts.push(`code: ${error.code}`);
  if (error.hint)    parts.push(`hint: ${error.hint}`);
  if (error.details) parts.push(`details: ${error.details}`);
  return parts.join(' · ');
}

export const log = {
  info:  (tag: string, msg: string, data?: object) => {
    if (__DEV__) console.log(`[${tag}] ${msg}`, data ?? '');
  },
  ok:    (tag: string, msg: string, data?: object) => {
    if (__DEV__) console.log(`✅ [${tag}] ${msg}`, data ?? '');
  },
  error: (tag: string, msg: string, error: SupabaseError) => {
    if (__DEV__) console.error(`❌ [${tag}] ${msg} → ${fmt(error)}`);
  },
  warn:  (tag: string, msg: string, data?: object) => {
    if (__DEV__) console.warn(`⚠️  [${tag}] ${msg}`, data ?? '');
  },
};
