// @ts-nocheck
// Supabase Edge Function — payment-reminders
// Deploy: supabase functions deploy payment-reminders --no-verify-jwt
// (also set verify_jwt = false for this function in supabase/config.toml)
//
// This function is invoked once daily by a pg_cron job via net.http_post,
// never by the app or a browser — there is no Supabase user JWT on these
// requests. Authenticity is instead verified via a static shared secret sent
// in the x-cron-secret header (see the check below).
//
// Secrets required: CRON_SECRET (supabase secrets set CRON_SECRET=<random-string>)
// A human must also register the pg_cron job — see the commented SQL block
// at the bottom of this file for the exact statement to run in the
// Supabase SQL editor once, after deploying this function.
import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function money(p: any): string {
  return `R${Number(p.amount).toFixed(2)}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const CRON_SECRET = Deno.env.get('CRON_SECRET');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!CRON_SECRET || !SUPABASE_URL || !SERVICE_KEY) {
      return new Response(JSON.stringify({ error: 'missing env vars' }), { status: 500, headers: CORS });
    }

    const provided = req.headers.get('x-cron-secret') ?? '';
    if (provided !== CRON_SECRET) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: CORS });
    }

    const restHeaders = {
      'Content-Type': 'application/json',
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
    };

    const today = new Date();
    const in3Str = fmtDate(addDays(today, 3));
    const yesterdayStr = fmtDate(addDays(today, -1));

    // 1. Payments coming due in exactly 3 days
    const upcomingRes = await fetch(
      `${SUPABASE_URL}/rest/v1/payments?select=*&status=eq.pending&due_date=eq.${in3Str}`,
      { headers: restHeaders }
    );
    const upcoming = upcomingRes.ok ? await upcomingRes.json() : [];

    // 2. Payments that became overdue exactly yesterday
    const overdueRes = await fetch(
      `${SUPABASE_URL}/rest/v1/payments?select=*&status=eq.pending&due_date=eq.${yesterdayStr}`,
      { headers: restHeaders }
    );
    const overdue = overdueRes.ok ? await overdueRes.json() : [];

    console.log('payment-reminders: upcoming=', upcoming.length, 'overdue=', overdue.length);

    // Flip newly-overdue payments to status=overdue before notifying
    if (overdue.length) {
      const overdueIds = overdue.map((p: any) => `"${p.id}"`).join(',');
      const patchRes = await fetch(
        `${SUPABASE_URL}/rest/v1/payments?id=in.(${overdueIds})&status=eq.pending`,
        {
          method: 'PATCH',
          headers: { ...restHeaders, 'Prefer': 'return=minimal' },
          body: JSON.stringify({ status: 'overdue' }),
        }
      );
      if (!patchRes.ok) {
        console.error('payment-reminders: failed to flip overdue status', await patchRes.text());
      }
    }

    // Group both buckets by guardian_id so a guardian with several payments
    // due gets a single combined notification/push instead of several.
    const byGuardian = new Map<string, { upcoming: any[]; overdue: any[] }>();
    for (const p of upcoming) {
      const g = byGuardian.get(p.guardian_id) ?? { upcoming: [], overdue: [] };
      g.upcoming.push(p);
      byGuardian.set(p.guardian_id, g);
    }
    for (const p of overdue) {
      const g = byGuardian.get(p.guardian_id) ?? { upcoming: [], overdue: [] };
      g.overdue.push(p);
      byGuardian.set(p.guardian_id, g);
    }

    if (!byGuardian.size) {
      return new Response(JSON.stringify({ ok: true, notified: 0 }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Build one notification row per guardian
    const notifications: Record<string, unknown>[] = [];
    for (const [guardianId, group] of byGuardian) {
      const parts: string[] = [];
      for (const p of group.upcoming) {
        parts.push(`${money(p)} ${p.type} due ${p.due_date}`);
      }
      for (const p of group.overdue) {
        parts.push(`${money(p)} ${p.type} is now overdue (was due ${p.due_date})`);
      }
      const title = group.overdue.length ? 'Payment overdue' : 'Payment due soon';
      const body = parts.join('; ') + '.';
      notifications.push({
        profile_id: guardianId,
        title,
        body,
        type: 'payment_due',
        read: false,
        data: {
          upcoming_payment_ids: group.upcoming.map((p: any) => p.id),
          overdue_payment_ids: group.overdue.map((p: any) => p.id),
        },
      });
    }

    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
      method: 'POST',
      headers: { ...restHeaders, 'Prefer': 'return=minimal' },
      body: JSON.stringify(notifications),
    });
    if (!insertRes.ok) {
      console.error('payment-reminders: notification insert error', await insertRes.text());
    } else {
      console.log('payment-reminders: notifications inserted', notifications.length);
    }

    // Fetch push tokens for all guardians involved in this run
    const guardianIds = [...byGuardian.keys()];
    const idList = guardianIds.map((id) => `"${id}"`).join(',');
    const tokenRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?select=id,push_token&id=in.(${idList})&push_token=not.is.null`,
      { headers: restHeaders }
    );
    const profiles = tokenRes.ok ? await tokenRes.json() : [];

    const notifByGuardian = new Map(notifications.map((n) => [n.profile_id as string, n]));
    const messages = profiles
      .map((p: any) => {
        const n = notifByGuardian.get(p.id);
        if (!n) return null;
        return { to: p.push_token, title: n.title, body: n.body, sound: 'default', data: n.data };
      })
      .filter(Boolean);

    if (messages.length) {
      const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(messages),
      });
      const expoResult = await expoRes.json();
      console.log('payment-reminders: expo result', JSON.stringify(expoResult));
    }

    return new Response(
      JSON.stringify({ ok: true, notified: notifications.length, pushed: messages.length }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('payment-reminders error:', String(err));
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});

// ============================================================
// pg_cron wiring — run ONCE in the Supabase SQL editor after
// deploying this function and setting the CRON_SECRET secret.
// Requires the pg_cron and pg_net extensions to be enabled
// (Database → Extensions in the Supabase dashboard).
// ============================================================
//
// select cron.schedule(
//   'payment-reminders-daily',
//   '0 7 * * *',  -- 07:00 UTC every day
//   $$
//   select net.http_post(
//     url := 'https://<project-ref>.supabase.co/functions/v1/payment-reminders',
//     headers := jsonb_build_object(
//       'Content-Type', 'application/json',
//       'x-cron-secret', '<same value as the CRON_SECRET secret>'
//     ),
//     body := '{}'::jsonb
//   );
//   $$
// );
