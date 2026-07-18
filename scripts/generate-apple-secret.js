// One-off local script — generates the Apple "Secret Key (for OAuth)" JWT
// that Supabase needs for the Apple auth provider. Run locally; your .p8
// private key never has to leave this machine.
//
// Usage:
//   node scripts/generate-apple-secret.js
//
// Fill in the four values below first.

const fs = require('fs');
const crypto = require('crypto');

// ─── Fill these in ───────────────────────────────────────────────
const TEAM_ID = 'C7YKXX2S2V';                  // top-right of any Apple Developer page
const KEY_ID = 'U3G577AGFN';                   // from Certificates, Identifiers & Profiles → Keys
const CLIENT_ID = 'com.emkaey.geniuslabs.signin'; // your Services ID
const PRIVATE_KEY_PATH = 'C:/Apps/geniuslabs/AuthKey_U3G577AGFN.p8'; // the .p8 file you downloaded
// ─────────────────────────────────────────────────────────────────

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64urlFromBuffer(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const privateKey = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');

const now = Math.floor(Date.now() / 1000);
const header = { alg: 'ES256', kid: KEY_ID };
const payload = {
  iss: TEAM_ID,
  iat: now,
  exp: now + 60 * 60 * 24 * 30 * 5, // ~5 months (Apple's max is 6 months)
  aud: 'https://appleid.apple.com',
  sub: CLIENT_ID,
};

const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;

const signer = crypto.createSign('SHA256');
signer.update(signingInput);
signer.end();

// Apple requires the raw (r,s) signature format, not DER — dsaEncoding: 'ieee-p1363' does that.
const signature = signer.sign({ key: privateKey, dsaEncoding: 'ieee-p1363' });

const jwt = `${signingInput}.${base64urlFromBuffer(signature)}`;

// JWT goes to stdout ALONE (nothing else) so it can be piped straight into the
// clipboard without picking up terminal line-wrap artifacts. Everything else
// (label/expiry) goes to stderr, which still prints to the terminal but won't
// be captured by a `| Set-Clipboard` pipe.
console.error('\nSecret Key (for OAuth) — piping to clipboard…');
console.error('Expires:', new Date((now + 60 * 60 * 24 * 30 * 5) * 1000).toDateString());
process.stdout.write(jwt);
