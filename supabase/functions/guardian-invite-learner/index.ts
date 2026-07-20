// @ts-nocheck
// Supabase Edge Function — guardian-invite-learner
// Deploy: supabase functions deploy guardian-invite-learner
//
// Lets an authenticated GUARDIAN invite one of their own enrolled learners
// to set up their own independent login. Deterministic linking by
// learners.id (ownership-checked server-side) — no name/email matching of
// any kind, replacing the old link_learner_account RPC. A guardian never
// needs to do this at all — "Login as {name}" in profile.tsx already gives
// full access without the learner having a separate account.
//
// No email link, no deep link, no redirect config: the account is created
// with a random temp password (returned once in this response for the
// guardian to relay), the learner just signs in normally, and
// profiles.must_change_password forces them through
// src/app/auth/set-password.tsx before reaching the app.
import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
// Every JSON response (including errors) needs Content-Type set explicitly —
// without it, clients can't reliably parse the body as JSON.
const JSON_HEADERS = { ...CORS, 'Content-Type': 'application/json' };

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const ANON_KEY     = Deno.env.get('SUPABASE_ANON_KEY');

    if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
      return new Response(JSON.stringify({ error: 'missing env vars' }), { status: 500, headers: JSON_HEADERS });
    }

    // Identify the caller from their JWT — never trust a client-supplied guardianId.
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

    const body = await req.json();
    const learnerId = String(body.learnerId ?? '');
    const email      = String(body.email ?? '').trim().toLowerCase();

    if (!learnerId) return new Response(JSON.stringify({ error: 'learnerId required' }), { status: 400, headers: JSON_HEADERS });
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return new Response(JSON.stringify({ error: 'valid email required' }), { status: 400, headers: JSON_HEADERS });
    }

    // Ownership check — the ONLY thing that matters. A guardian may only
    // invite a login for a learner that is actually theirs.
    const { data: learner, error: learnerErr } = await admin
      .from('learners').select('id, guardian_id, full_name, grade, profile_id, is_active').eq('id', learnerId).maybeSingle();
    if (learnerErr || !learner) {
      return new Response(JSON.stringify({ error: 'learner not found' }), { status: 404, headers: JSON_HEADERS });
    }
    if (learner.guardian_id !== callerId) {
      return new Response(JSON.stringify({ error: 'forbidden — not your learner' }), { status: 403, headers: JSON_HEADERS });
    }
    if (!learner.is_active) {
      return new Response(JSON.stringify({ error: 'learner is not active' }), { status: 400, headers: JSON_HEADERS });
    }

    const tempPassword = generateTempPassword();

    // Create the auth user directly with the temp password, email pre-confirmed
    // (no confirmation link needed — the temp password itself is the credential).
    // Deliberately NOT passing role in metadata — the live on-signup DB trigger
    // reads it to auto-create a bare profiles row, and that insert doesn't run
    // as service_role, so our own role-escalation trigger would block anything
    // but 'guardian'. We set the real role explicitly below, via a service-role
    // client call that IS correctly exempted.
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: learner.full_name },
    });

    if (createErr || !created?.user) {
      const status = /already registered|already exists/i.test(createErr?.message ?? '') ? 409 : 500;
      return new Response(JSON.stringify({ error: createErr?.message ?? 'account creation failed' }), { status, headers: JSON_HEADERS });
    }

    // Explicitly write the profiles row via the SERVICE ROLE client, then
    // link the learner row by ID — deterministic, no matching involved.
    const { error: profileErr } = await admin.from('profiles').upsert({
      id: created.user.id,
      role: 'learner',
      full_name: learner.full_name,
      grades: [learner.grade],
      is_active: true,
      must_change_password: true,
    });
    if (profileErr) {
      return new Response(JSON.stringify({ error: 'user created but profile write failed', detail: profileErr.message }), { status: 500, headers: JSON_HEADERS });
    }

    const { error: linkErr } = await admin.from('learners').update({ profile_id: created.user.id }).eq('id', learner.id);
    if (linkErr) {
      return new Response(JSON.stringify({ error: 'user created but learner link failed', detail: linkErr.message }), { status: 500, headers: JSON_HEADERS });
    }

    return new Response(
      JSON.stringify({ ok: true, userId: created.user.id, email, tempPassword }),
      { headers: JSON_HEADERS }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: JSON_HEADERS });
  }
});
