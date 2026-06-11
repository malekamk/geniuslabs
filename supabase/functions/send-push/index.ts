// @ts-nocheck
// Supabase Edge Function — send-push
// Deploy: supabase functions deploy send-push
import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return new Response(JSON.stringify({ error: 'missing env vars' }), { status: 500, headers: CORS });
    }

    const payload = await req.json();
    const { profileIds, title, body, type = 'general', data = {} } = payload;

    console.log('send-push called, profileIds:', JSON.stringify(profileIds));

    if (!Array.isArray(profileIds) || !profileIds.length) {
      return new Response(JSON.stringify({ error: 'profileIds required' }), { status: 400, headers: CORS });
    }

    // 1. Insert notification rows via REST API (service role bypasses RLS)
    const rows = profileIds.map((id) => ({ profile_id: id, title, body, type, read: false, data }));
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(rows),
    });
    if (!insertRes.ok) {
      const err = await insertRes.text();
      console.error('Insert error:', err);
    } else {
      console.log('Notifications inserted:', profileIds.length);
    }

    // 2. Fetch push tokens via REST API
    const idList = profileIds.map((id) => `"${id}"`).join(',');
    const tokenRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?select=push_token&id=in.(${idList})&push_token=not.is.null`,
      {
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
        },
      }
    );
    const profiles = tokenRes.ok ? await tokenRes.json() : [];
    const tokens = profiles.map((p) => p.push_token).filter(Boolean);
    console.log('Push tokens found:', tokens.length);

    // 3. Send push via Expo
    if (tokens.length) {
      const messages = tokens.map((t) => ({ to: t, title, body, sound: 'default', data }));
      const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(messages),
      });
      const expoResult = await expoRes.json();
      console.log('Expo result:', JSON.stringify(expoResult));
    }

    return new Response(
      JSON.stringify({ ok: true, notified: profileIds.length, pushed: tokens.length }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('send-push error:', String(err));
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
