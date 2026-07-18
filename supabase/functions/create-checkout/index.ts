// @ts-nocheck
// Supabase Edge Function — create-checkout
// Deploy: supabase functions deploy create-checkout
// Secrets required: YOCO_SECRET_KEY (supabase secrets set YOCO_SECRET_KEY=sk_live_xxx)
//
// Creates a real Yoco hosted-checkout session for a guardian paying a fee for
// one of their learners, and records a matching `payments` row up front
// (status: pending). The webhook (see ../payment-webhook) is the ONLY thing
// allowed to flip that row to paid/failed — this function never does.
import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_FEE_TYPES = ['tuition', 'assessment', 'registration', 'material', 'other'];

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

    // Identify the caller from their JWT — never trust a client-supplied guardianId.
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    if (!jwt) return new Response(JSON.stringify({ error: 'unauthenticated' }), { status: 401, headers: CORS });

    const authClient = createClient(SUPABASE_URL, ANON_KEY);
    const { data: userData, error: userErr } = await authClient.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'invalid session' }), { status: 401, headers: CORS });
    }
    const guardianId = userData.user.id;

    const body = await req.json();
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    let payment: { id: string; amount: number };

    if (body.paymentId) {
      // Resuming an existing pending payment (e.g. "Pay Now" on a stuck row) —
      // pull the amount/learner from OUR row, never trust client-supplied values here.
      const { data: existing, error: existingErr } = await admin
        .from('payments').select('id, amount, status')
        .eq('id', body.paymentId).eq('guardian_id', guardianId).maybeSingle();
      if (existingErr || !existing) {
        return new Response(JSON.stringify({ error: 'payment not found' }), { status: 404, headers: CORS });
      }
      if (existing.status !== 'pending') {
        return new Response(JSON.stringify({ error: 'payment is not pending' }), { status: 409, headers: CORS });
      }
      payment = existing;
    } else {
      const { learnerId, feeType, title, amount } = body;
      const amountRand = Number(amount);
      if (!learnerId || !ALLOWED_FEE_TYPES.includes(feeType) || !title || !Number.isFinite(amountRand) || amountRand <= 0) {
        return new Response(JSON.stringify({ error: 'invalid request' }), { status: 400, headers: CORS });
      }

      // Confirm this learner actually belongs to the caller — prevents paying against someone else's learner id.
      const { data: learner, error: learnerErr } = await admin
        .from('learners').select('id').eq('id', learnerId).eq('guardian_id', guardianId).maybeSingle();
      if (learnerErr || !learner) {
        return new Response(JSON.stringify({ error: 'learner not found for this account' }), { status: 403, headers: CORS });
      }

      // Record the payment as pending BEFORE redirecting to checkout.
      const { data: inserted, error: payErr } = await admin.from('payments').insert({
        learner_id:  learnerId,
        guardian_id: guardianId,
        amount:      amountRand,
        currency:    'ZAR',
        type:        feeType,
        status:      'pending',
        description: title,
      }).select('id, amount').single();
      if (payErr || !inserted) {
        return new Response(JSON.stringify({ error: 'could not create payment record' }), { status: 500, headers: CORS });
      }
      payment = inserted;
    }

    const checkoutRes = await fetch('https://payments.yoco.com/api/checkouts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${YOCO_SECRET_KEY}`,
        'Content-Type': 'application/json',
        // Unique per attempt (not just per payment row) so resuming after an
        // expired/abandoned checkout gets a genuinely fresh session from Yoco.
        'Idempotency-Key': `${payment.id}-${Date.now()}`,
      },
      body: JSON.stringify({
        amount: Math.round(Number(payment.amount) * 100), // Yoco expects cents
        currency: 'ZAR',
        successUrl: 'geniuslabs://payment-return?status=success',
        cancelUrl:  'geniuslabs://payment-return?status=cancel',
        failureUrl: 'geniuslabs://payment-return?status=failure',
        metadata: { payment_id: payment.id },
      }),
    });

    if (!checkoutRes.ok) {
      const errText = await checkoutRes.text();
      return new Response(JSON.stringify({ error: 'yoco checkout failed', detail: errText }), { status: 502, headers: CORS });
    }

    const checkout = await checkoutRes.json();
    await admin.from('payments').update({ gateway_reference: checkout.id }).eq('id', payment.id);

    return new Response(
      JSON.stringify({ checkoutUrl: checkout.redirectUrl, paymentId: payment.id }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS });
  }
});
