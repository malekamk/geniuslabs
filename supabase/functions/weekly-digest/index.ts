// @ts-nocheck
// Supabase Edge Function — weekly-digest
// Deploy: supabase functions deploy weekly-digest --no-verify-jwt
// (also set verify_jwt = false for this function in supabase/config.toml)
//
// This function is invoked once weekly (Monday mornings) by a pg_cron job
// via net.http_post, never by the app or a browser — there is no Supabase
// user JWT on these requests. Authenticity is instead verified via a static
// shared secret sent in the x-cron-secret header (see the check below).
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

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function quoteList(values: string[]): string {
  return values.map((v) => `"${v}"`).join(',');
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

    const now = new Date();
    const weekAgoIso = addDays(now, -7).toISOString();
    const weekAheadIso = addDays(now, 7).toISOString();
    const nowIso = now.toISOString();

    // Active guardians
    const guardiansRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?select=id&role=eq.guardian&is_active=eq.true`,
      { headers: restHeaders }
    );
    const guardians = guardiansRes.ok ? await guardiansRes.json() : [];
    console.log('weekly-digest: active guardians', guardians.length);

    const notifications: Record<string, unknown>[] = [];

    for (const guardian of guardians) {
      const guardianId = guardian.id;

      const learnersRes = await fetch(
        `${SUPABASE_URL}/rest/v1/learners?select=id,profile_id,grade&guardian_id=eq.${guardianId}`,
        { headers: restHeaders }
      );
      const learners = learnersRes.ok ? await learnersRes.json() : [];

      const learnerProfileIds: string[] = learners
        .map((l: any) => l.profile_id)
        .filter((id: unknown): id is string => Boolean(id));
      const grades: string[] = [...new Set(learners.map((l: any) => l.grade).filter(Boolean))];

      // Materials marked done in the last 7 days by this guardian's learners
      let materialsDone = 0;
      if (learnerProfileIds.length) {
        const progressRes = await fetch(
          `${SUPABASE_URL}/rest/v1/user_material_progress?select=id&status=eq.done&updated_at=gte.${weekAgoIso}&profile_id=in.(${quoteList(learnerProfileIds)})`,
          { headers: restHeaders }
        );
        const progress = progressRes.ok ? await progressRes.json() : [];
        materialsDone = progress.length;
      }

      // Upcoming classes in the next 7 days for the learners' grades
      let upcomingClasses = 0;
      if (grades.length) {
        const classesRes = await fetch(
          `${SUPABASE_URL}/rest/v1/classes?select=id&scheduled_at=gte.${nowIso}&scheduled_at=lte.${weekAheadIso}&grade=in.(${quoteList(grades)})`,
          { headers: restHeaders }
        );
        const classes = classesRes.ok ? await classesRes.json() : [];
        upcomingClasses = classes.length;
      }

      // Outstanding fees (pending or overdue)
      const paymentsRes = await fetch(
        `${SUPABASE_URL}/rest/v1/payments?select=amount&guardian_id=eq.${guardianId}&status=in.(pending,overdue)`,
        { headers: restHeaders }
      );
      const payments = paymentsRes.ok ? await paymentsRes.json() : [];
      const outstanding = payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);

      if (materialsDone === 0 && upcomingClasses === 0 && outstanding === 0) {
        continue; // nothing to report — skip to avoid noise
      }

      const body = `This week: ${materialsDone} material${materialsDone === 1 ? '' : 's'} completed, ${upcomingClasses} class${upcomingClasses === 1 ? '' : 'es'} coming up, R${outstanding.toFixed(2)} outstanding.`;

      notifications.push({
        profile_id: guardianId,
        title: 'Your weekly digest',
        body,
        type: 'general',
        read: false,
        data: { materials_done: materialsDone, upcoming_classes: upcomingClasses, outstanding },
      });
    }

    if (!notifications.length) {
      return new Response(JSON.stringify({ ok: true, notified: 0 }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
      method: 'POST',
      headers: { ...restHeaders, 'Prefer': 'return=minimal' },
      body: JSON.stringify(notifications),
    });
    if (!insertRes.ok) {
      console.error('weekly-digest: notification insert error', await insertRes.text());
    } else {
      console.log('weekly-digest: notifications inserted', notifications.length);
    }

    // Fetch push tokens for all guardians who received a digest this run
    const guardianIds = notifications.map((n) => n.profile_id as string);
    const tokenRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?select=id,push_token&id=in.(${quoteList(guardianIds)})&push_token=not.is.null`,
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
      console.log('weekly-digest: expo result', JSON.stringify(expoResult));
    }

    return new Response(
      JSON.stringify({ ok: true, notified: notifications.length, pushed: messages.length }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('weekly-digest error:', String(err));
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
//   'weekly-digest-mondays',
//   '0 7 * * 1',  -- 07:00 UTC every Monday
//   $$
//   select net.http_post(
//     url := 'https://<project-ref>.supabase.co/functions/v1/weekly-digest',
//     headers := jsonb_build_object(
//       'Content-Type', 'application/json',
//       'x-cron-secret', '<same value as the CRON_SECRET secret>'
//     ),
//     body := '{}'::jsonb
//   );
//   $$
// );
