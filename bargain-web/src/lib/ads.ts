'use client';

/**
 * Ad-platform conversion events — Google Ads / GA4 (gtag.js or GTM
 * dataLayer) + Microsoft Ads (UET). Everything no-ops until the tag IDs
 * are configured, so this is safe to ship before the ad accounts exist.
 *
 * Env (all optional — render/emit nothing when unset):
 *   NEXT_PUBLIC_GTM_ID    GTM-XXXX container OR G-/AW- tag id
 *   NEXT_PUBLIC_GA4_ID    legacy alias for the Google tag id (existing deploys)
 *   NEXT_PUBLIC_MS_UET_ID Microsoft UET tag id
 */

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    uetq?: { push: (args: unknown) => void } & unknown[];
  }
}

export const GOOGLE_TAG_ID =
  process.env.NEXT_PUBLIC_GTM_ID || process.env.NEXT_PUBLIC_GA4_ID || '';
export const MS_UET_TAG_ID = process.env.NEXT_PUBLIC_MS_UET_ID || '';

/** GTM-XXX ids load gtm.js (container); G-/AW- ids load gtag.js directly. */
export const IS_GTM_CONTAINER = GOOGLE_TAG_ID.startsWith('GTM-');

export function trackEvent(name: string, params: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return;
  // GTM consumes {event: ...} pushes off dataLayer; gtag ignores them.
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: name, ...params });
  if (window.gtag) window.gtag('event', name, params);
  if (window.uetq) window.uetq.push({ ec: 'site', ea: name, el: 'bargain-web' });
}

/** Signup completed (account created). */
export function trackSignUp(method = 'password') {
  trackEvent('sign_up', { method });
}

/** Successful login (any method). */
export function trackLogin(method = 'password') {
  trackEvent('login', { method });
}

/** Hosted checkout session created — about to redirect to payment. */
export function trackBeginCheckout(params: Record<string, unknown> = {}) {
  trackEvent('begin_checkout', params);
}
