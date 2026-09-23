/**
 * E2E check of the new auth flow on production:
 *  - /signup renders name/phone/email/password + Firebase OTP widget
 *  - /verify-email handles bogus token gracefully
 *  - /login renders and links to signup
 * Uses playwright-core + system Chrome — no browser download needed.
 * Run: node scripts/auth-e2e.mjs
 */
import { chromium } from 'playwright-core';

const BASE = process.env.BASE_URL || 'https://bargainhuntrs.com';
const results = [];
const ok = (name) => { results.push({ name, ok: true }); console.log(`✓ ${name}`); };
const fail = (name, why) => { results.push({ name, ok: false, why }); console.log(`✗ ${name} — ${why}`); };

const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--disable-blink-features=AutomationControlled'],
});
const ctx = await browser.newContext({
  serviceWorkers: 'block',
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
});
await ctx.addInitScript(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
});
const page = await ctx.newPage();
const consoleErrors = [];
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

try {
  // ── Signup page ────────────────────────────────────────────────
  await page.goto(`${BASE}/signup`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForSelector('#email', { timeout: 60000 });

  for (const [id, label] of [['#firstName', 'first name'], ['#lastName', 'last name'], ['#phone', 'phone'], ['#email', 'email'], ['#password', 'password']]) {
    const el = await page.$(id);
    el ? ok(`signup has ${label} input`) : fail(`signup ${label} input`, 'element missing');
  }

  // HTML required validation should block empty submit
  await page.click('button[type="submit"]');
  const firstInvalid = await page.$eval('#firstName', (el) => !el.checkValidity());
  firstInvalid ? ok('empty submit blocked by required fields') : fail('required validation', 'form submitted empty');

  // Fill the form — phone verify button should appear once phone entered
  await page.fill('#firstName', 'E2E');
  await page.fill('#lastName', 'Check');
  await page.fill('#phone', '+15550105555');
  await page.fill('#email', `e2e-${Date.now()}@test.dev`);
  await page.fill('#password', 'Passw0rd123');

  const verifyBtn = await page.waitForSelector('text=Verify via SMS', { timeout: 5000 }).catch(() => null);
  verifyBtn ? ok('Firebase "Verify via SMS" appears after phone entry') : fail('phone verify button', 'never appeared');

  // Submit without phone verification — account should still register
  // (phone_verified=false server-side), or show a clear error.
  const regPromise = page.waitForResponse((r) => r.url().includes('/api/v1/auth/register'), { timeout: 90000 });
  await page.click('button[type="submit"]');
  const regResp = await regPromise;
  const regBody = await regResp.json().catch(() => ({}));
  if (regResp.status() === 200 && regBody.user?.firstName === 'E2E' && regBody.user?.phoneNumber === '+15550105555') {
    ok(`register stores name+phone (emailVerified=${regBody.user.emailVerified}, phoneVerified=${regBody.user.phoneVerified})`);
  } else {
    fail('register response', `status=${regResp.status()} body=${JSON.stringify(regBody).slice(0, 200)}`);
  }

  // ── Verify-email page with bogus token ─────────────────────────
  await page.goto(`${BASE}/verify-email?token=bogus`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForSelector('text=Verification failed', { timeout: 90000 })
    .then(() => ok('verify-email rejects bogus token gracefully'))
    .catch(() => fail('verify-email page', 'no failure state shown'));

  // ── Login page ─────────────────────────────────────────────────
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForSelector('#email', { timeout: 60000 });
  const signupLink = await page.$('a[href="/signup"]');
  signupLink ? ok('login links to signup') : fail('login → signup link', 'missing');
} finally {
  const realErrors = consoleErrors.filter(
    // 'waiting' — PWA registration code crashes because we block serviceWorkers in tests;
    // the 400 is the expected bogus-token rejection from /verify-email.
    (e) => !/favicon|gtm|googletag|recaptcha|firebase.*(auth|installations)|net::ERR_BLOCKED|'waiting'|status of 400/i.test(e),
  );
  if (realErrors.length) {
    fail('console clean', realErrors.slice(0, 3).join(' | '));
  } else {
    ok('no unexpected console errors');
  }
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${failed.length === 0 ? '✅' : '❌'} ${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
