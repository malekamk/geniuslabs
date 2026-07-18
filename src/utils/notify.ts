import { supabase } from './supabase';
import { log } from './logger';

type NotifyType = 'general' | 'announcement' | 'new_material' | 'class_reminder' | 'payment_due' | 'quiz_available';

/**
 * Send in-app + push notifications via the send-push edge function.
 * The edge function uses the service role key to bypass RLS on the notifications table.
 */
export async function sendNotifications(
  profileIds: string | string[],
  title: string,
  body: string,
  type: NotifyType = 'general',
  data?: Record<string, unknown>,
) {
  const ids = Array.isArray(profileIds) ? profileIds : [profileIds];
  if (!ids.length) return;

  log.info('Notify', `Sending to ${ids.length} profile(s)`, ids);

  const { data: result, error } = await supabase.functions.invoke('send-push', {
    body: { profileIds: ids, title, body, type, data: data ?? {} },
  });

  if (error) log.error('Notify', 'Edge function invoke failed', error);
  else log.ok('Notify', 'Edge function responded', result);
}
