/**
 * Two-phase smoke test for bargainhuntrs.com.
 *
 *   pnpm smoke                 # tests https://bargainhuntrs.com
 *   SMOKE_BASE=http://localhost:3000 pnpm smoke   # local dev server
 *
 * Phase 1 — Node fetch: HTTP status for every public route (cheap, can't
 *           trip Cloudflare's per-client request budget).
 * Phase 2 — Playwright (system Chrome): real browser loads the core routes
 *           and reports pageerrors + console errors. Kept to a small route
 *           set on purpose — the edge rate-limits ~100+ requests/client and
 *           each page pulls ~15 JS chunks.
 *
 * Writes bargain-web/.errors/smoke.json for agent self-diagnosis.
 * Uses playwright-core + system Chrome — no browser download needed.
 */

import { chromium } from 'playwright-core';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const ERRORS_DIR = join(ROOT, 'bargain-web', '.errors');
mkdirSync(ERRORS_DIR, { recursive: true });

const BASE = process.env.SMOKE_BASE || 'https://bargainhuntrs.com';
const TIMEOUT = 30000;

// Every public route gets an HTTP status check
const STATUS_ROUTES = [
  '/',
  '/deals',
  '/coupons',
  '/auctions',
  '/community',
  '/community/leaderboard',
  '/seller',
  '/pricing',
  '/referrals',
  '/contact',
  '/waitlist',
  '/real-estate/deals',
  '/tools/profit-calculator',
  '/tools/listing-generator',
  '/login',
  '/signup',
];

// Browser JS-error check — small set to stay under edge rate limits
const BROWSER_ROUTES = ['/', '/deals', '/auctions', '/pricing', '/login'];

let failures = 0;

// ---------- Phase 1: status checks via fetch ----------
console.log('Phase 1 — HTTP status checks');
const statusResults = [];
for (const route of STATUS_ROUTES) {
  let status = null;
  let error = null;
  try {
    const res = await fetch(BASE + route, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT),
    });
    status = res.status;
  } catch (e) {
    error = e.message;
  }
  const ok = status >= 200 && status < 400;
  if (!ok) failures++;
  statusResults.push({ route, status, ok, error });
  console.log(`${ok ? '✓' : '✗'} ${route} [${status ?? error}]`);
  await new Promise((r) => setTimeout(r, 300));
}

// ---------- Phase 2: browser JS-error check ----------
console.log('\nPhase 2 — browser console/pageerror check (system Chrome)');
const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--disable-blink-features=AutomationControlled'],
});
const browserResults = [];
try {
  // serviceWorkers: 'block' — the PWA precache SW can hang navigations and
  // serve stale bundles, defeating the purpose of a smoke test.
  const ctx = await browser.newContext({
    serviceWorkers: 'block',
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  });
  // Hide automation fingerprint — edge bot detection 503s headless clients
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  // Abort heavy sub-resources to keep request volume low
  await ctx.route(/\.(png|jpe?g|gif|webp|svg|ico|woff2?|ttf|mp4|webm|css)(\?|$)/i, (r) => r.abort());

  for (const route of BROWSER_ROUTES) {
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => {
      // next-pwa's generated registration script crashes when SWs are
      // blocked ("Cannot read properties of undefined (reading 'waiting')").
      // That's an artifact of serviceWorkers:'block', not a site defect.
      if (e.message.includes("'waiting'")) return;
      errors.push(`pageerror: ${e.message}`);
    });
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      const text = m.text();
      // Ignore failed sub-resource loads (we abort images/fonts ourselves)
      if (/Failed to load resource|net::ERR_/.test(text)) return;
      errors.push(`console: ${text}`);
    });
    let status = null;
    let loadError = null;
    try {
      const res = await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
      status = res?.status();
      await page.waitForTimeout(1500);
    } catch (e) {
      loadError = e.message.split('\n')[0];
    }
    // One retry for transient bot-detection/rate-limit responses
    if (status === 503 || (loadError && status === null)) {
      await page.waitForTimeout(10000);
      errors.length = 0;
      loadError = null;
      try {
        const res = await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
        status = res?.status();
        await page.waitForTimeout(1500);
      } catch (e) {
        loadError = e.message.split('\n')[0];
      }
    }
    const ok = status >= 200 && status < 400 && !loadError;
    if (!ok || errors.length) failures++;
    browserResults.push({ route, status, ok, loadError, errors });
    console.log(`${ok ? '✓' : '✗'} ${route} [${status ?? loadError}]${errors.length ? ` — ${errors.length} js error(s)` : ''}`);
    await page.close();
    await new Promise((r) => setTimeout(r, 2500));
  }
} finally {
  await browser.close();
}

const report = {
  base: BASE,
  timestamp: new Date().toISOString(),
  failures,
  statusResults,
  browserResults,
};
writeFileSync(join(ERRORS_DIR, 'smoke.json'), JSON.stringify(report, null, 2));
console.log(
  `\n${failures === 0 ? '✅' : '❌'} ${failures} issue(s) — ${ERRORS_DIR}/smoke.json`
);
process.exit(failures === 0 ? 0 : 1);
