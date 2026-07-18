// @ts-nocheck
// Supabase Edge Function — verify-payment
// Deploy: supabase functions deploy verify-payment
// Secrets required: YOCO_SECRET_KEY (already set for create-checkout)
//
// Called by the app right after the WebView returns from Yoco checkout.
// Does NOT trust the client's claim of success — it looks up the checkout's
// real status directly from Yoco's API (same pattern proven in the
// sabooksonline PaymentHelper::verifyYocoPayment) and only then updates the
// payments row. A user who fakes the redirect gets nothing, because Yoco's
// own API still reports the true (unpaid) status for that checkout id.
import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUCCESS_STATUSES = ['successful', 'completed', 'paid', 'succeeded'];
const FAILED_STATUSES  = ['failed', 'cancelled', 'canceled', 'expired'];

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const ANON_KEY     = Deno.env.get('SUPABASE_ANON_KEY');
    const YOCO_SECRET_KEY = Deno.env.get('YOCO_SECRET_KEY');
    if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY || !YOCO_SECRET_KEY) {
      return new Response(JSON.stringify({ error: 'missing env vars' }), { status: 500, headers: CORS });
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    if (!jwt) return new Response(JSON.stringify({ error: 'unauthenticated' }), { status: 401, headers: CORS });

    const authClient = createClient(SUPABASE_URL, ANON_KEY);
    const { data: userData, error: userErr } = await authClient.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'invalid session' }), { status: 401, headers: CORS });
    }
    const guardianId = userData.user.id;

    const { paymentId } = await req.json();
    if (!paymentId) return new Response(JSON.stringify({ error: 'paymentId required' }), { status: 400, headers: CORS });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: payment, error: payErr } = await admin
      .from('payments').select('id, status, gateway_reference, guardian_id')
      .eq('id', paymentId).eq('guardian_id', guardianId).maybeSingle();
    if (payErr || !payment) {
      return new Response(JSON.stringify({ error: 'payment not found' }), { status: 404, headers: CORS });
    }

    // Already settled (by a previous call, or the webhook if that's also wired up) — just report it.
    if (payment.status !== 'pending') {
      return new Response(JSON.stringify({ status: payment.status }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
    }
    if (!payment.gateway_reference) {
      return new Response(JSON.stringify({ status: 'pending' }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    const checkRes = await fetch(`https://payments.yoco.com/api/checkouts/${payment.gateway_reference}`, {
      headers: { 'Authorization': `Bearer ${YOCO_SECRET_KEY}` },
    });
    if (!checkRes.ok) {
      return new Response(JSON.stringify({ status: 'pending', error: 'could not reach yoco' }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
    }
    const checkout = await checkRes.json();
    const yocoStatus = String(checkout.status ?? '').toLowerCase();

    let nextStatus: 'paid' | 'failed' | null = null;
    if (SUCCESS_STATUSES.includes(yocoStatus)) nextStatus = 'paid';
    else if (FAILED_STATUSES.includes(yocoStatus)) nextStatus = 'failed';

    if (nextStatus) {
      const update: Record<string, unknown> = { status: nextStatus, gateway_payload: checkout };
      if (nextStatus === 'paid') update.paid_at = new Date().toISOString();
      await admin.from('payments').update(update).eq('id', paymentId).eq('status', 'pending');
    }

    return new Response(
      JSON.stringify({ status: nextStatus ?? 'pending', yocoStatus }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS });
  }
});
