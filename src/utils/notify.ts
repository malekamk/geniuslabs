import { supabase } from './supabase';

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

  console.log('[notify] sending to', ids.length, 'profiles:', ids);

  const { data: result, error } = await supabase.functions.invoke('send-push', {
    body: { profileIds: ids, title, body, type, data: data ?? {} },
  });

  if (error) console.error('[notify] invoke error:', error.message, error);
  else console.log('[notify] edge fn response:', JSON.stringify(result));
}
