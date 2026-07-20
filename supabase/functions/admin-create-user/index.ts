// @ts-nocheck
// Supabase Edge Function — admin-create-user
// Deploy: supabase functions deploy admin-create-user
//
// Lets an authenticated ADMIN provision a new tutor or admin account.
// This is the ONLY path allowed to create tutor/admin profiles — guardian
// and learner accounts remain self-service via the public signup screens.
//
// No email link, no deep link, no redirect config: the account is created
// with a random temp password (returned once in this response for the admin
// to relay), the new user just signs in normally, and profiles.must_change_password
// forces them through src/app/auth/set-password.tsx before reaching the app.
import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
// Every JSON response (including errors) needs Content-Type set explicitly —
// without it, clients can't reliably parse the body as JSON.
const JSON_HEADERS = { ...CORS, 'Content-Type': 'application/json' };

// Hard allowlist — this function must NEVER create a guardian/learner row.
const ALLOWED_ROLES = ['tutor', 'admin'];

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

    // Identify the caller from their JWT — never trust a client-supplied "isAdmin" flag.
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

    // Server-side admin check — the ONLY thing that matters. Hiding the
    // "Add Tutor/Admin" button for non-admins in the UI is cosmetic and must
    // never be relied on for this.
    const { data: callerProfile, error: callerErr } = await admin
      .from('profiles').select('role, is_active').eq('id', callerId).maybeSingle();
    if (callerErr || !callerProfile || callerProfile.role !== 'admin' || !callerProfile.is_active) {
      return new Response(JSON.stringify({ error: 'forbidden — admin only' }), { status: 403, headers: JSON_HEADERS });
    }

    const body = await req.json();
    const email    = String(body.email ?? '').trim().toLowerCase();
    const fullName = String(body.fullName ?? '').trim();
    const role     = String(body.role ?? '');
    const phone    = body.phone ? String(body.phone).trim() : null;

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return new Response(JSON.stringify({ error: 'valid email required' }), { status: 400, headers: JSON_HEADERS });
    }
    if (!fullName) {
      return new Response(JSON.stringify({ error: 'fullName required' }), { status: 400, headers: JSON_HEADERS });
    }
    if (!ALLOWED_ROLES.includes(role)) {
      return new Response(JSON.stringify({ error: `role must be one of ${ALLOWED_ROLES.join(', ')}` }), { status: 400, headers: JSON_HEADERS });
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
      user_metadata: { full_name: fullName },
    });

    if (createErr || !created?.user) {
      const status = /already registered|already exists/i.test(createErr?.message ?? '') ? 409 : 500;
      return new Response(JSON.stringify({ error: createErr?.message ?? 'account creation failed' }), { status, headers: JSON_HEADERS });
    }

    // Explicitly (re)write the profiles row via the SERVICE ROLE client —
    // this bypasses RLS entirely, so it works regardless of whatever
    // on-signup trigger may or may not have already created a row, and it
    // is the ONLY place in the whole app allowed to set role to tutor/admin.
    const { error: profileErr } = await admin.from('profiles').upsert({
      id: created.user.id,
      role,
      full_name: fullName,
      phone,
      is_active: true,
      must_change_password: true,
    });

    if (profileErr) {
      return new Response(JSON.stringify({ error: 'user created but profile write failed', detail: profileErr.message }), { status: 500, headers: JSON_HEADERS });
    }

    return new Response(
      JSON.stringify({ ok: true, userId: created.user.id, email, tempPassword }),
      { headers: JSON_HEADERS }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: JSON_HEADERS });
  }
});
