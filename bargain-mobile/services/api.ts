// One data plane — the same FastAPI the site calls:
//
//   https://api.bargainhuntrs.com/api/v1/*
//
// Public reads (deals feed, retailers, affiliate click-out) need no auth.
// Auth = the self-issued JWT from POST /api/v1/auth/login (Bearer header);
// access tokens live 1h, refreshed via POST /api/v1/auth/refresh with the
// 14-day refresh token (see services/auth.ts).

export const API_BASE = 'https://api.bargainhuntrs.com';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function parse(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

const TIMEOUT_MS = 20000;

async function timedFetch(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new ApiError(0, 'Connection timed out — check your network.');
    throw e;
  } finally {
    clearTimeout(t);
  }
}

/** JSON call against api.bargainhuntrs.com. Throws ApiError with FastAPI's `detail`. */
export async function api<T = any>(
  path: string,
  opts: { method?: string; body?: unknown; token?: string | null } = {},
): Promise<T> {
  const res = await timedFetch(`${API_BASE}${path}`, {
    method: opts.method || (opts.body !== undefined ? 'POST' : 'GET'),
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const data = await parse(res);
  if (!res.ok) {
    // FastAPI detail can be a string or a list of {msg} validation objects.
    const detail = data?.detail;
    const msg =
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((d: any) => d?.msg).filter(Boolean).join(' ')
          : `Request failed (${res.status})`;
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

// ---- shared row shapes (mirror bargain-api's pydantic responses) ----------

export interface Deal {
  id: string;
  asin: string;
  title: string;
  image_url: string | null;
  buy_url: string | null;
  buy_price: number;
  sell_price: number;
  historical_avg: number | null;
  discrepancy: number | null;
  deal_tier: string;
  retailer: string | null;
  deal_source: string | null;
  net_profit: number | null;
  roi: number | null;
  total_costs: number | null;
  platform_fee: number | null;
  bsr: number | null;
  category: string | null;
  niche: string | null;
  is_profitable: boolean;
  status: string;
  detected_at: string;
  best_coupon: {
    code?: string;
    discount_type?: string;
    discount_value?: number;
    effective_price?: number;
    savings?: number;
  } | null;
}

export interface RetailerCount {
  retailer: string;
  deals: number;
}

export interface WatchlistItem {
  id: string;
  item_name: string;
  target_price: number | null;
  current_price: number | null;
  retailers: { url: string; price: number | null }[];
  created_at: string | null;
}

export interface Niche {
  key: string;
  name: string;
  emoji: string;
  description: string;
  typical_margin: string;
}

// ---- deals feed (public) ---------------------------------------------------

export async function fetchDeals(
  opts: { retailer?: string; source?: string; niche?: string; limit?: number; offset?: number } = {},
): Promise<Deal[]> {
  const qs = new URLSearchParams();
  if (opts.retailer) qs.set('retailer', opts.retailer);
  if (opts.source) qs.set('source', opts.source);
  if (opts.niche) qs.set('niche', opts.niche);
  qs.set('limit', String(opts.limit ?? 40));
  if (opts.offset) qs.set('offset', String(opts.offset));
  return api<Deal[]>(`/api/v1/arbitrage/deals/public?${qs.toString()}`, { method: 'GET' });
}

export async function fetchRetailers(): Promise<RetailerCount[]> {
  return api<RetailerCount[]>('/api/v1/arbitrage/deals/public-retailers', { method: 'GET' });
}

export async function fetchDeal(id: string): Promise<Deal> {
  return api<Deal>(`/api/v1/arbitrage/deals/public/${id}`, { method: 'GET' });
}

/**
 * Click-out — same flow as the site's deal cards. Returns the URL with the
 * affiliate tag attached; the click is logged server-side. Anonymous variant
 * works signed out (that's what the homepage uses).
 */
export async function trackClick(
  deal: Pick<Deal, 'id' | 'buy_url' | 'retailer' | 'asin'>,
  token?: string | null,
): Promise<string> {
  const path = token ? '/api/v1/affiliate/click' : '/api/v1/affiliate/click/public';
  const res = await api<{ affiliate_url: string }>(path, {
    token: token ?? undefined,
    body: {
      url: deal.buy_url || '',
      retailer: deal.retailer || '',
      asin: deal.asin || '',
      deal_id: deal.id,
    },
  });
  return res.affiliate_url || deal.buy_url || '';
}

// ---- watchlist (authed) ----------------------------------------------------

export async function listWatchlist(token: string): Promise<WatchlistItem[]> {
  return api<WatchlistItem[]>('/api/v1/watchlist', { method: 'GET', token });
}

export async function addWatchlistItem(
  token: string,
  body: { item_name: string; retailer_url: string; target_price?: number },
): Promise<WatchlistItem> {
  return api<WatchlistItem>('/api/v1/watchlist', { token, body });
}

export async function refreshWatchlistItem(token: string, id: string): Promise<any> {
  return api(`/api/v1/watchlist/${id}/refresh`, { token, body: {} });
}

export async function deleteWatchlistItem(token: string, id: string): Promise<void> {
  await api(`/api/v1/watchlist/${id}`, { method: 'DELETE', token });
}

// ---- profile (authed) ------------------------------------------------------

export interface MeProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  nickname: string | null;
  role: string;
  subscriptionTier: string;
  subscribedNiches: string[];
  phoneNumber: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
}

export async function fetchMe(token: string): Promise<MeProfile> {
  return api<MeProfile>('/api/v1/auth/me', { method: 'GET', token });
}

export async function updateMe(
  token: string,
  body: { firstName?: string; lastName?: string; nickname?: string | null },
): Promise<any> {
  return api('/api/v1/auth/me', { method: 'PUT', token, body });
}

export async function fetchNiches(
  token: string,
): Promise<{ subscribed_niches: string[]; available_niches: Niche[] }> {
  return api('/api/v1/auth/me/niches', { method: 'GET', token });
}

export async function updateNiches(token: string, keys: string[]): Promise<any> {
  return api('/api/v1/auth/me/niches', { method: 'PUT', token, body: { subscribed_niches: keys } });
}
