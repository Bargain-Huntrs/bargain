#!/usr/bin/env node
// Revenue KPI snapshot — reads Stripe secret key from the project's .env,
// pulls live subscription MRR + account health, appends to docs/KPI_WEEKLY.md.
// Usage: node scripts/revenue-kpi.mjs [--env path/to/.env] [--write]
import { readFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const envIdx = args.indexOf('--env');
const envPath = envIdx >= 0 ? args[envIdx + 1] : null;
const write = args.includes('--write');

const candidates = envPath ? [envPath] : [
  join(root, '.env'),
  ...['prime-api','bargain-api','settle-api','notyced-api','reid-api','favestate-api','dexana-api','api'].map(d => join(root, d, '.env')),
];
let key = null, usedEnv = null;
for (const p of candidates) {
  try {
    const m = readFileSync(p, 'utf8').match(/sk_(live|test)_[A-Za-z0-9]+/);
    if (m) { key = m[0]; usedEnv = p; break; }
  } catch {}
}
if (!key) { console.log('SKIP — no Stripe key found in .env files'); process.exit(0); }
const test = key.startsWith('sk_test');
const auth = { Authorization: `Bearer ${key}` };

const acct = await (await fetch('https://api.stripe.com/v1/account', { headers: auth })).json();
if (acct.error) { console.log('STRIPE ERROR:', acct.error.message); process.exit(1); }

// active subs
let subs = [], url = 'https://api.stripe.com/v1/subscriptions?status=active&limit=100&expand[]=data.items.data.price';
while (url) {
  const j = await (await fetch(url, { headers: auth })).json();
  subs.push(...(j.data || []));
  url = j.has_more ? `${url}&starting_after=${subs[subs.length - 1].id}` : null;
}
let mrr = 0;
for (const s of subs) for (const it of s.items?.data || []) {
  const p = it.price, q = it.quantity || 1;
  if (!p?.recurring) continue;
  const amt = (p.unit_amount || 0) * q / 100;
  mrr += p.recurring.interval === 'year' ? amt / 12
       : p.recurring.interval === 'week' ? amt * 52 / 12
       : p.recurring.interval === 'day' ? amt * 365 / 12
       : amt;
}
// trailing-30d collected revenue (charges succeeded)
const since = Math.floor(Date.now() / 1000) - 30 * 86400;
const ch = await (await fetch(`https://api.stripe.com/v1/charges?limit=100&created[gte]=${since}`, { headers: auth })).json();
const collected = (ch.data || []).filter(c => c.paid && !c.refunded).reduce((a, c) => a + c.amount - (c.amount_refunded || 0), 0) / 100;

const line = `| ${new Date().toISOString().slice(0, 10)} | $${mrr.toFixed(0)} | ${subs.length} | $${collected.toFixed(0)} | ${acct.charges_enabled ? 'yes' : 'NO'} | ${acct.payouts_enabled ? 'yes' : 'NO'} |`;
console.log(`\n${acct.business_profile?.name || acct.id} (${test ? 'TEST' : 'LIVE'})`);
console.log(`  MRR: $${mrr.toFixed(2)} across ${subs.length} active subs`);
console.log(`  Collected (30d): $${collected.toFixed(2)}`);
console.log(`  charges_enabled=${acct.charges_enabled} payouts_enabled=${acct.payouts_enabled}`);
console.log(`  website=${acct.business_profile?.url} descriptor=${acct.settings?.payments?.statement_descriptor}`);

if (write) {
  const doc = join(root, 'docs', 'KPI_WEEKLY.md');
  mkdirSync(dirname(doc), { recursive: true });
  if (!existsSync(doc)) appendFileSync(doc, '# Weekly Revenue KPI Snapshot\n\n| Date | MRR | Active subs | Collected 30d | Charges | Payouts |\n|---|---:|---:|---:|---|---|\n');
  appendFileSync(doc, line + '\n');
  console.log(`  -> appended to ${doc}`);
}
