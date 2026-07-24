// @ts-nocheck
// Supabase Edge Function — delete-account
// Deploy: supabase functions deploy delete-account
//
// Lets an authenticated user delete their own account, in-app — required by
// Apple (Guideline 5.1.1(v)) and Google Play's account deletion policy for
// any app that supports account creation.
//
// What this does NOT do: hard-delete rows in shared/legal-record tables
// (payments, classes, chat messages, quiz attempts). Those stay — deleting
// them would corrupt other users' chat history/class rosters and destroy
// financial records that POPIA/tax law expect to be retained. Instead we
// anonymize the profiles row (remove all PII) and delete the actual auth
// user, so the account can never be signed into again and no longer
// identifies a real person — this is the same "anonymize, don't cascade"
// pattern Slack/Discord use for exactly this reason.
import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const JSON_HEADERS = { ...CORS, 'Content-Type': 'application/json' };

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const ANON_KEY     = Deno.env.get('SUPABASE_ANON_KEY');

    if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
      return new Response(JSON.stringify({ error: 'missing env vars' }), { status: 500, headers: JSON_HEADERS });
    }

    // Identify the caller from their own JWT — a user may only ever delete
    // their own account, never one supplied via the request body.
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    if (!jwt) return new Response(JSON.stringify({ error: 'unauthenticated' }), { status: 401, headers: JSON_HEADERS });

    const authClient = createClient(SUPABASE_URL, ANON_KEY);
    const { data: userData, error: userErr } = await authClient.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'invalid session' }), { status: 401, headers: JSON_HEADERS });
    }
    const callerId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: profile } = await admin
      .from('profiles').select('role').eq('id', callerId).maybeSingle();

    // Guardian's own dependent learner records with no independent login of
    // their own (profile_id null) are solely guardian-owned data — anonymize
    // those too. A learner who already has their own account is left alone;
    // that's now their account to request deletion for separately.
    if (profile?.role === 'guardian') {
      const { error: learnersErr } = await admin
        .from('learners')
        .update({
          full_name: 'Deleted Learner',
          school_name: null,
          id_number: null,
          medical_notes: null,
          date_of_birth: null,
          is_active: false,
        })
        .eq('guardian_id', callerId)
        .is('profile_id', null);
      if (learnersErr) {
        return new Response(JSON.stringify({ error: 'failed to clean up learner records', detail: learnersErr.message }), { status: 500, headers: JSON_HEADERS });
      }
    }

    const { error: profileErr } = await admin
      .from('profiles')
      .update({
        full_name: 'Deleted User',
        phone: null,
        avatar_url: null,
        bio: null,
        subjects: null,
        grades: null,
        is_active: false,
      })
      .eq('id', callerId);
    if (profileErr) {
      return new Response(JSON.stringify({ error: 'failed to anonymize profile', detail: profileErr.message }), { status: 500, headers: JSON_HEADERS });
    }

    // Remove the actual auth account last — once this succeeds the user can
    // never sign in again, so everything above must have already succeeded.
    const { error: deleteErr } = await admin.auth.admin.deleteUser(callerId);
    if (deleteErr) {
      return new Response(JSON.stringify({ error: 'failed to delete auth user', detail: deleteErr.message }), { status: 500, headers: JSON_HEADERS });
    }

    return new Response(JSON.stringify({ ok: true }), { headers: JSON_HEADERS });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: JSON_HEADERS });
  }
});
