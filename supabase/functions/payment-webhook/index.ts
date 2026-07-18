// @ts-nocheck
// Supabase Edge Function — payment-webhook
// Deploy: supabase functions deploy payment-webhook --no-verify-jwt
// (also set verify_jwt = false for this function in supabase/config.toml —
// Yoco calls this with its own signature, never a Supabase JWT)
// Secrets required: YOCO_WEBHOOK_SECRET (supabase secrets set YOCO_WEBHOOK_SECRET=whsec_xxx)
//
// This is the ONLY place a payment is ever marked paid/failed. The signature
// check below is what stops a spoofed "success" from the client — do not
// relax it. Register this function's URL as the webhook endpoint in the
// Yoco dashboard.
import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TOLERANCE_SECONDS = 5 * 60;

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifySignature(secret: string, id: string, timestamp: string, rawBody: string, signatureHeader: string): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > TOLERANCE_SECONDS) return false;

  const secretBytes = base64ToBytes(secret.replace(/^whsec_/, ''));
  const key = await crypto.subtle.importKey('raw', secretBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signedContent = `${id}.${timestamp}.${rawBody}`;
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedContent));
  const expected = bytesToBase64(new Uint8Array(mac));

  // Header is space-separated "v1,<base64sig>" entries — any match is valid.
  return signatureHeader
    .split(' ')
    .map(part => part.split(',')[1])
    .filter(Boolean)
    .some(sig => timingSafeEqual(sig, expected));
}

// Yoco's exact payload shape hasn't been confirmed against a live test event —
// check a few plausible locations for our own metadata.payment_id round-trip.
function extractPaymentId(body: any): string | null {
  return body?.payload?.metadata?.payment_id
    ?? body?.metadata?.payment_id
    ?? body?.data?.metadata?.payment_id
    ?? null;
}

function extractEventType(body: any): string {
  return body?.type ?? body?.event ?? '';
}

serve(async (req) => {
  try {
    const WEBHOOK_SECRET = Deno.env.get('YOCO_WEBHOOK_SECRET');
    const SUPABASE_URL   = Deno.env.get('SUPABASE_URL');
    const SERVICE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!WEBHOOK_SECRET || !SUPABASE_URL || !SERVICE_KEY) {
      return new Response('missing env vars', { status: 500 });
    }

    const id        = req.headers.get('webhook-id') ?? '';
    const timestamp = req.headers.get('webhook-timestamp') ?? '';
    const signature = req.headers.get('webhook-signature') ?? '';
    const rawBody   = await req.text();

    if (!id || !timestamp || !signature) {
      return new Response('missing signature headers', { status: 401 });
    }
    const valid = await verifySignature(WEBHOOK_SECRET, id, timestamp, rawBody, signature);
    if (!valid) {
      console.error('[payment-webhook] signature verification failed');
      return new Response('invalid signature', { status: 401 });
    }

    const body = JSON.parse(rawBody);
    const eventType = extractEventType(body);
    const paymentId = extractPaymentId(body);
    if (!paymentId) {
      console.error('[payment-webhook] no payment_id in payload metadata', rawBody);
      return new Response('ok', { status: 200 }); // acknowledge — nothing we can do with it
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    let nextStatus: 'paid' | 'failed' | null = null;
    if (eventType.includes('succeeded')) nextStatus = 'paid';
    else if (eventType.includes('failed')) nextStatus = 'failed';

    if (nextStatus) {
      // Only move OUT of pending — never overwrite an already-settled/waived/refunded row.
      const update: Record<string, unknown> = { status: nextStatus, gateway_payload: body };
      if (nextStatus === 'paid') update.paid_at = new Date().toISOString();
      const { error } = await admin.from('payments').update(update).eq('id', paymentId).eq('status', 'pending');
      if (error) {
        console.error('[payment-webhook] DB update failed', error);
        return new Response('db update failed', { status: 500 }); // triggers Yoco retry
      }
    }

    return new Response('ok', { status: 200 });
  } catch (err) {
    console.error('[payment-webhook] error', String(err));
    return new Response('error', { status: 500 });
  }
});
