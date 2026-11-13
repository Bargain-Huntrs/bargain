#!/usr/bin/env node
/**
 * Zero-dep Google Play upload — androidpublisher v3 via service-account JWT.
 *
 * Usage:  node scripts/play-submit.mjs <aab-path>
 * Env:    PACKAGE=com.bargainhuntrs.mobile (default)
 *         PLAY_SA_KEY — path to service-account JSON (default: first of
 *           ./credentials/android/play-store-service-account.json,
 *           ./credentials/google-play-service-account.json)
 *         TRACK=internal (default) · RELEASE_STATUS=completed|draft (default completed)
 *         RELEASE_NOTES — override the en-US release note text
 *         SKIP_LISTING=1 — upload + track only, don't touch the listing
 *
 * Requires the app record to already exist in Play Console (the API cannot
 * create apps) and the SA to hold dev-account permissions.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';

const PKG = process.env.PACKAGE || 'com.bargainhuntrs.mobile';
const AAB = process.argv[2];
const SA_CANDIDATES = [
  process.env.PLAY_SA_KEY,
  './credentials/android/play-store-service-account.json',
  './credentials/google-play-service-account.json',
].filter(Boolean);
const TRACK = process.env.TRACK || 'internal';
const RELEASE_STATUS = process.env.RELEASE_STATUS || 'completed';

if (!AAB || !fs.existsSync(AAB)) { console.error('missing AAB:', AAB); process.exit(1); }
const saPath = SA_CANDIDATES.find((p) => fs.existsSync(p));
if (!saPath) {
  console.error('no service-account key found — set PLAY_SA_KEY or drop the key at',
    SA_CANDIDATES.slice(1).join(' / '));
  process.exit(1);
}
const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));
console.log('SA:', sa.client_email, '· pkg', PKG, '· track', TRACK);

// ---- auth: SA JWT -> access_token ----
const now = Math.floor(Date.now() / 1000);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
  iss: sa.client_email,
  scope: 'https://www.googleapis.com/auth/androidpublisher',
  aud: 'https://oauth2.googleapis.com/token',
  iat: now, exp: now + 3600,
})}`;
const sig = crypto.sign('RSA-SHA256', Buffer.from(unsigned), sa.private_key).toString('base64url');

const tok = await (await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${unsigned}.${sig}`,
})).json();
if (!tok.access_token) { console.error('auth failed', tok); process.exit(1); }
const H = { authorization: `Bearer ${tok.access_token}` };
const API = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PKG}`;
const UPL = `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${PKG}`;
const j = async (r) => { const t = await r.text(); try { return JSON.parse(t); } catch { return t; } };

// ---- edit ----
const edit = await j(await fetch(`${API}/edits`, { method: 'POST', headers: H }));
if (!edit.id) { console.error('edit failed', edit); process.exit(1); }
console.log('edit', edit.id);

// ---- bundle upload ----
const up = await new Promise((resolve, reject) => {
  const u = new URL(`${UPL}/edits/${edit.id}/bundles?uploadType=media`);
  const body = fs.readFileSync(AAB);
  const req = https.request({ method: 'POST', hostname: u.hostname, path: u.pathname + u.search,
    headers: { ...H, 'content-type': 'application/octet-stream', 'content-length': body.length } },
    (res) => { let d = ''; res.on('data', (c) => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(d); } }); });
  req.on('error', reject); req.end(body);
});
if (!up.versionCode) { console.error('bundle upload failed', up); process.exit(1); }
console.log('uploaded versionCode', up.versionCode);

// ---- track release ----
const releaseNotes = process.env.RELEASE_NOTES || 'Initial BargainHuntrs release — arbitrage deal feed.';
const track = await j(await fetch(`${API}/edits/${edit.id}/tracks/${TRACK}`, {
  method: 'PUT', headers: { ...H, 'content-type': 'application/json' },
  body: JSON.stringify({
    track: TRACK,
    releases: [{
      name: `${up.versionCode} (1.0.0)`,
      status: RELEASE_STATUS,
      versionCodes: [String(up.versionCode)],
      releaseNotes: [{ language: 'en-US', text: releaseNotes }],
    }],
  }),
}));
console.log('track:', JSON.stringify(track).slice(0, 300));

// ---- listing (en-US) ----
if (process.env.SKIP_LISTING !== '1') {
const listing = {
  language: 'en-US',
  title: 'BargainHuntrs',
  shortDescription: 'Find it, flip it, profit — arbitrage deals from top retailers.',
  fullDescription: `BargainHuntrs surfaces resale-worthy deals so you can buy low and flip for profit.

A live feed of arbitrage opportunities from major retailers, with the math done for you.

• Deals feed — fresh arbitrage finds with buy price, sell price, and margin
• Watchlist — save deals and refresh pricing on demand
• Alerts — get notified when deals matching your niches drop
• Profit math — ROI and margin calculated per deal
• Aura points — earn for streaks, referrals, and community wins

Free to join. Affiliate links fund the feed — you never pay a commission.`,
};
const lres = await j(await fetch(`${API}/edits/${edit.id}/listings/en-US`, {
  method: 'PUT', headers: { ...H, 'content-type': 'application/json' },
  body: JSON.stringify(listing),
}));
console.log('listing:', lres.title || lres);

// ---- contact details ----
const det = await j(await fetch(`${API}/edits/${edit.id}/details`, {
  method: 'PUT', headers: { ...H, 'content-type': 'application/json' },
  body: JSON.stringify({
    contactEmail: 'hello@bargainhuntrs.com',
    contactWebsite: 'https://bargainhuntrs.com',
    defaultLanguage: 'en-US',
  }),
}));
console.log('details:', det.contactEmail || det);

// ---- images: icon 512 + feature graphic 1024x500 (skipped if missing) ----
const root = path.dirname(new URL(import.meta.url).pathname);
for (const [type, file] of [
  ['icon', path.join(root, '../assets/play-icon-512.png')],
  ['featureGraphic', path.join(root, '../assets/play-feature-1024x500.png')],
]) {
  if (!fs.existsSync(file)) { console.log('skip', type, '(missing)'); continue; }
  const img = await j(await fetch(
    `${UPL}/edits/${edit.id}/listings/en-US/${type}?uploadType=media`, {
      method: 'POST', headers: { ...H, 'content-type': 'image/png' },
      body: fs.readFileSync(file),
    }));
  console.log('image', type, img.image?.id ? 'ok' : JSON.stringify(img).slice(0, 200));
}
}

// ---- commit ----
const done = await j(await fetch(`${API}/edits/${edit.id}:commit`, { method: 'POST', headers: H }));
console.log('COMMITTED', done.id || JSON.stringify(done).slice(0, 300));
