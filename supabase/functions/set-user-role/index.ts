// @ts-nocheck
// Supabase Edge Function — set-user-role
// Deploy: supabase functions deploy set-user-role
//
// Lets an authenticated ADMIN change another user's role in one call — e.g.
// promoting a guardian to admin from the Users screen. profiles.role can
// only ever be changed by the service_role key (see
// prevent_role_self_escalation in supabase-rls-notes.sql), so a plain
// client-side update silently gets reverted — this function is the only
// path that can actually change an existing user's role.
import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const JSON_HEADERS = { ...CORS, 'Content-Type': 'application/json' };
const VALID_ROLES = ['learner', 'tutor', 'guardian', 'admin'];

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const ANON_KEY     = Deno.env.get('SUPABASE_ANON_KEY');

    if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
      return new Response(JSON.stringify({ error: 'missing env vars' }), { status: 500, headers: JSON_HEADERS });
    }

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

    // Server-side admin check — the only thing that matters, never trust a
    // client-supplied flag.
    const { data: callerProfile, error: callerErr } = await admin
      .from('profiles').select('role, is_active').eq('id', callerId).maybeSingle();
    if (callerErr || !callerProfile || callerProfile.role !== 'admin' || !callerProfile.is_active) {
      return new Response(JSON.stringify({ error: 'forbidden — admin only' }), { status: 403, headers: JSON_HEADERS });
    }

    const body = await req.json();
    const targetUserId = String(body.userId ?? '');
    const newRole = String(body.role ?? '');

    if (!targetUserId) return new Response(JSON.stringify({ error: 'userId required' }), { status: 400, headers: JSON_HEADERS });
    if (!VALID_ROLES.includes(newRole)) {
      return new Response(JSON.stringify({ error: `role must be one of: ${VALID_ROLES.join(', ')}` }), { status: 400, headers: JSON_HEADERS });
    }
    if (targetUserId === callerId) {
      return new Response(JSON.stringify({ error: "you can't change your own role" }), { status: 400, headers: JSON_HEADERS });
    }

    const { data: target, error: targetErr } = await admin
      .from('profiles').select('id, role, full_name').eq('id', targetUserId).maybeSingle();
    if (targetErr || !target) {
      return new Response(JSON.stringify({ error: 'user not found' }), { status: 404, headers: JSON_HEADERS });
    }

    const { error: updateErr } = await admin
      .from('profiles').update({ role: newRole }).eq('id', targetUserId);
    if (updateErr) {
      return new Response(JSON.stringify({ error: updateErr.message }), { status: 500, headers: JSON_HEADERS });
    }

    return new Response(JSON.stringify({ ok: true, userId: targetUserId, role: newRole }), { headers: JSON_HEADERS });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: JSON_HEADERS });
  }
});
