import { authService } from "@/lib/authService";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.bargainhuntrs.com";

/** Clears the stale session and sends the user back to login.
 *
 * A 401 here always means the access token itself is invalid/expired or
 * points at a user that no longer exists (e.g. "User not found" from
 * get_current_user) -- never that a specific resource was denied. Without
 * this, every authenticated page just threw and displayed the raw backend
 * error text forever, since nothing ever cleared the broken localStorage
 * session or redirected away from it.
 */
function handleUnauthorized() {
  if (typeof window === "undefined") return;
  authService.logout();
  if (!window.location.pathname.startsWith("/login")) {
    window.location.href = "/login";
  }
}

async function fetchWithAuth(endpoint: string, token: string | null, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Unknown error" }));
    if (response.status === 401) {
      handleUnauthorized();
      throw new Error("Your session has expired. Please log in again.");
    }
    throw new Error(error.detail || `Request failed with ${response.status}`);
  }

  if (response.status === 204) return null;

  return response.json();
}

async function fetchPublic(endpoint: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(error.detail || `Request failed with ${response.status}`);
  }

  return response.json();
}

export async function getCurrentUser(token: string) {
  return fetchWithAuth("/api/v1/auth/me", token, {
    method: "GET",
  });
}

export async function getWatchlist(token: string) {
  return fetchWithAuth("/api/v1/watchlist", token, {
    method: "GET",
  });
}

export async function addWatchlistItem(
  token: string,
  item_name: string,
  retailer_url: string,
  target_price?: number
) {
  return fetchWithAuth("/api/v1/watchlist", token, {
    method: "POST",
    body: JSON.stringify({ item_name, retailer_url, target_price }),
  });
}

export async function refreshWatchlistItem(token: string, itemId: string) {
  return fetchWithAuth(`/api/v1/watchlist/${itemId}/refresh`, token, {
    method: "POST",
  });
}

export async function deleteWatchlistItem(token: string, itemId: string) {
  return fetchWithAuth(`/api/v1/watchlist/${itemId}`, token, {
    method: "DELETE",
  });
}

// ─── Coupons ────────────────────────────────────────────────────────────────

export interface Coupon {
  id: string;
  code: string;
  retailer: string;
  title: string;
  description?: string;
  discount_type: string;
  discount_value: number;
  min_purchase?: number;
  max_discount?: number;
  category?: string;
  product_url?: string;
  source: string;
  source_url?: string;
  expires_at?: string;
  verified: boolean;
  times_used: number;
  success_count: number;
  status: string;
  scraped_at: string;
  submitted_by?: string;
  submitted_at?: string;
}

export async function getCoupons(
  token: string,
  params?: { retailer?: string; category?: string; verified_only?: boolean; limit?: number }
) {
  const qs = new URLSearchParams();
  if (params?.retailer) qs.set("retailer", params.retailer);
  if (params?.category) qs.set("category", params.category);
  if (params?.verified_only) qs.set("verified_only", "true");
  if (params?.limit) qs.set("limit", String(params.limit));
  const query = qs.toString();
  return fetchWithAuth(`/api/v1/coupons${query ? `?${query}` : ""}`, token, { method: "GET" }) as Promise<Coupon[]>;
}

export async function getPublicCoupons(
  limit = 50,
  offset = 0,
  params?: { retailer?: string; verified_only?: boolean }
) {
  const qs = new URLSearchParams();
  qs.set("limit", String(limit));
  qs.set("offset", String(offset));
  if (params?.retailer) qs.set("retailer", params.retailer);
  if (params?.verified_only) qs.set("verified_only", "true");
  const res = await fetch(`${API_URL}/api/v1/coupons/public?${qs.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch coupons: ${res.status}`);
  return res.json() as Promise<Coupon[]>;
}

export async function submitCouponFeedback(couponId: string, worked: boolean) {
  const res = await fetch(`${API_URL}/api/v1/coupons/public/${couponId}/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ worked }),
  });
  if (!res.ok) throw new Error(`Failed to submit feedback: ${res.status}`);
  return res.json() as Promise<{ success_rate: number | null; votes: number; status: string }>;
}

export async function reportDeadDeal(dealId: string) {
  const res = await fetch(`${API_URL}/api/v1/arbitrage/deals/public/${dealId}/report-dead`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Failed to report deal: ${res.status}`);
  return res.json() as Promise<{ archived: boolean; reports: number }>;
}

export async function getPublicCouponRetailers() {
  const res = await fetch(`${API_URL}/api/v1/coupons/public/retailers`);
  if (!res.ok) return [];
  return res.json() as Promise<string[]>;
}

export async function searchCoupons(token: string, q: string, retailer?: string) {
  const qs = new URLSearchParams({ q });
  if (retailer) qs.set("retailer", retailer);
  return fetchWithAuth(`/api/v1/coupons/search?${qs.toString()}`, token, { method: "GET" }) as Promise<Coupon[]>;
}

export async function getCouponRetailers(token: string) {
  return fetchWithAuth("/api/v1/coupons/retailers", token, { method: "GET" }) as Promise<string[]>;
}

export async function getCouponStatus(token: string) {
  return fetchWithAuth("/api/v1/coupons/status", token, { method: "GET" }) as Promise<{
    configured: boolean;
    source: string | null;
    message: string;
  }>;
}

export async function scrapeCoupons(token: string, retailers?: string[]) {
  return fetchWithAuth("/api/v1/coupons/scrape", token, {
    method: "POST",
    body: JSON.stringify({ retailers: retailers || null }),
  }) as Promise<{ scraped: number; saved: number; errors: number }>;
}

export async function applyCouponToDeal(token: string, dealId: string, couponId: string) {
  return fetchWithAuth("/api/v1/coupons/apply", token, {
    method: "POST",
    body: JSON.stringify({ deal_id: dealId, coupon_id: couponId }),
  }) as Promise<{
    deal_id: string;
    original_buy_price: number;
    effective_buy_price: number;
    coupon_code: string;
    coupon_discount: number;
    original_net_profit?: number;
    new_net_profit?: number;
    original_roi?: number;
    new_roi?: number;
  }>;
}

export async function getBestCouponsForDeal(token: string, dealId: string) {
  return fetchWithAuth(`/api/v1/coupons/deal/${dealId}/best`, token, { method: "GET" }) as Promise<Coupon[]>;
}

export async function getBestCouponsForDealPublic(dealId: string) {
  const res = await fetch(`${API_URL}/api/v1/coupons/deal/${dealId}/best/public`);
  if (!res.ok) return [];
  return res.json() as Promise<Coupon[]>;
}

export async function submitCoupon(
  token: string,
  data: {
    code: string;
    retailer: string;
    title: string;
    description?: string;
    discount_type?: string;
    discount_value?: number;
    category?: string;
    product_url?: string;
    expires_at?: string;
  }
) {
  return fetchWithAuth("/api/v1/coupons/submit", token, {
    method: "POST",
    body: JSON.stringify(data),
  }) as Promise<Coupon>;
}

// ─── Arbitrage Deals ────────────────────────────────────────────────────────

export interface ArbitrageDeal {
  id: string;
  asin: string;
  title: string;
  image_url?: string;
  buy_url?: string;
  buy_price: number;
  sell_price: number;
  historical_avg?: number;
  discrepancy?: number;
  deal_tier: string;
  retailer?: string;
  deal_source?: string;
  net_profit?: number;
  roi?: number;
  total_costs?: number;
  platform_fee?: number;
  bsr?: number;
  category?: string;
  niche?: string;
  is_profitable: boolean;
  status: string;
  detected_at: string;
  applied_coupon_code?: string;
  coupon_discount?: number;
  original_buy_price?: number;
  best_coupon?: {
    id: string;
    code: string;
    discount_type: string;
    discount_value: number;
    effective_price: number;
    savings: number;
    title: string;
  };
}

export interface Niche {
  key: string;
  name: string;
  emoji: string;
  description: string;
  typical_margin: string;
}

export async function getDeals(
  token: string,
  params?: { tier?: string; niche?: string; min_profit?: number; limit?: number; offset?: number }
) {
  const qs = new URLSearchParams();
  if (params?.tier) qs.set("tier", params.tier);
  if (params?.niche) qs.set("niche", params.niche);
  if (params?.min_profit) qs.set("min_profit", String(params.min_profit));
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.offset) qs.set("offset", String(params.offset));
  const query = qs.toString();
  return fetchWithAuth(`/api/v1/arbitrage/deals${query ? `?${query}` : ""}`, token, { method: "GET" }) as Promise<ArbitrageDeal[]>;
}

export async function getNiches(token: string) {
  return fetchWithAuth("/api/v1/arbitrage/niches", token, { method: "GET" }) as Promise<Niche[]>;
}

export async function scanNiche(token: string, niche: string, maxProducts = 20) {
  const qs = new URLSearchParams({ max_products: String(maxProducts) });
  return fetchWithAuth(`/api/v1/arbitrage/scan/${niche}?${qs.toString()}`, token, {
    method: "POST",
  }) as Promise<{
    scan_id: string;
    niche: string;
    products_scanned: number;
    deals_found: number;
    deals: ArbitrageDeal[];
  }>;
}

export async function getDealStats(token: string) {
  return fetchWithAuth("/api/v1/arbitrage/stats", token, { method: "GET" });
}

// ─── Niche Preferences ──────────────────────────────────────────────────────

export async function getMyNiches(token: string) {
  return fetchWithAuth("/api/v1/auth/me/niches", token, { method: "GET" }) as Promise<{
    subscribed_niches: string[];
    available_niches: Niche[];
  }>;
}

export async function updateMyNiches(token: string, subscribed_niches: string[]) {
  return fetchWithAuth("/api/v1/auth/me/niches", token, {
    method: "PUT",
    body: JSON.stringify({ subscribed_niches }),
  }) as Promise<{ success: boolean; subscribed_niches: string[] }>;
}

export async function updateMyPhone(token: string, phone_number: string) {
  return fetchWithAuth("/api/v1/auth/me/phone", token, {
    method: "PUT",
    body: JSON.stringify({ phone_number }),
  }) as Promise<{ success: boolean; phoneNumber: string | null }>;
}

// ─── Affiliate Click Tracking ───────────────────────────────────────────────

export async function trackAffiliateClick(
  token: string,
  data: { url: string; retailer?: string; asin?: string; deal_id?: string }
) {
  return fetchWithAuth("/api/v1/affiliate/click", token, {
    method: "POST",
    body: JSON.stringify(data),
  }) as Promise<{
    affiliate_url: string;
    original_url: string;
    retailer: string;
    tracked: boolean;
  }>;
}

// ─── Price Prediction ───────────────────────────────────────────────────────

export interface PriceTrend {
  recommendation: "buy_now" | "wait" | "monitor";
  confidence: number;
  predicted_low: number | null;
  current_vs_predicted: number;
  trend: "decreasing" | "stable" | "increasing";
  volatility: number;
  days_to_lowest: number;
  message?: string;
}

export interface DealQuality {
  score: number;
  method: string;
  percentile_rank?: number;
  z_score?: number;
  recent_trend_pct?: number;
}

export interface PricePrediction {
  deal_id: string;
  asin: string;
  current_price: number;
  trend?: PriceTrend;
  deal_quality?: DealQuality;
  recommendation?: string;
  tier: string;
  message?: string;
}

export async function getPricePrediction(token: string, dealId: string) {
  return fetchWithAuth(`/api/v1/arbitrage/deals/${dealId}/prediction`, token, {
    method: "GET",
  }) as Promise<PricePrediction>;
}

// ─── Notifications ──────────────────────────────────────────────────────────

export interface ChannelStatus {
  channel: string;
  configured: boolean;
}

export interface NotificationLogEntry {
  id: string;
  asin?: string;
  channel: string;
  recipient?: string;
  status: string;
  error?: string;
  sent_at?: string;
  created_at: string;
}

export async function getNotificationChannels(token: string) {
  return fetchWithAuth("/api/v1/notifications/channels", token, { method: "GET" }) as Promise<ChannelStatus[]>;
}

export async function getNotificationHistory(token: string, channel?: string, limit?: number) {
  const qs = new URLSearchParams();
  if (channel) qs.set("channel", channel);
  if (limit) qs.set("limit", String(limit));
  const query = qs.toString();
  return fetchWithAuth(`/api/v1/notifications/history${query ? `?${query}` : ""}`, token, { method: "GET" }) as Promise<NotificationLogEntry[]>;
}

export async function testNotifications(token: string) {
  return fetchWithAuth("/api/v1/notifications/test", token, { method: "POST" }) as Promise<{ results: Record<string, boolean> }>;
}

export async function distributeDeal(token: string, dealId: string) {
  return fetchWithAuth(`/api/v1/notifications/deal/${dealId}/distribute`, token, { method: "POST" }) as Promise<{ results: Record<string, boolean> }>;
}

export interface NotificationPreferences {
  email_deal_alerts: boolean;
  sms_deal_alerts: boolean;
  discord_alerts: boolean;
  telegram_alerts: boolean;
  push_notifications: boolean;
  weekly_digest: boolean;
  glitch_alerts: boolean;
  alert_max_per_day?: number;
  quiet_start_hour?: number | null;
  quiet_end_hour?: number | null;
  alert_timezone?: string | null;
}

export async function getNotificationPreferences(token: string) {
  return fetchWithAuth("/api/v1/notifications/preferences", token, { method: "GET" }) as Promise<NotificationPreferences>;
}

export async function updateNotificationPreferences(token: string, preferences: NotificationPreferences) {
  return fetchWithAuth("/api/v1/notifications/preferences", token, {
    method: "PUT",
    body: JSON.stringify(preferences),
  }) as Promise<NotificationPreferences>;
}

export interface NicheSubscriptionResponse {
  available_niches: Niche[];
  subscribed_niches: string[];
}

export async function getNicheSubscriptions(token: string) {
  return fetchWithAuth("/api/v1/notifications/niches", token, { method: "GET" }) as Promise<NicheSubscriptionResponse>;
}

export async function subscribeToNiche(token: string, niche: string) {
  return fetchWithAuth(`/api/v1/notifications/niches/${encodeURIComponent(niche)}/subscribe`, token, { method: "POST" });
}

export async function unsubscribeFromNiche(token: string, niche: string) {
  return fetchWithAuth(`/api/v1/notifications/niches/${encodeURIComponent(niche)}/unsubscribe`, token, { method: "DELETE" });
}

// ─── Public Deals (no auth required) ────────────────────────────────────────

export async function getPublicDeals(limit = 20, offset = 0, source?: string, retailer?: string) {
  const qs = new URLSearchParams();
  qs.set("limit", String(limit));
  qs.set("offset", String(offset));
  if (source) qs.set("source", source);
  if (retailer) qs.set("retailer", retailer);
  return fetchPublic(`/api/v1/arbitrage/deals/public?${qs.toString()}`, {
    method: "GET",
  }) as Promise<ArbitrageDeal[]>;
}

export interface PublicRetailer {
  retailer: string;
  deals: number;
}

export async function getPublicDealRetailers() {
  const res = await fetch(`${API_URL}/api/v1/arbitrage/deals/public-retailers`);
  if (!res.ok) throw new Error(`Failed to fetch retailers: ${res.status}`);
  return res.json() as Promise<PublicRetailer[]>;
}

export async function getPublicDeal(dealId: string) {
  const res = await fetch(`${API_URL}/api/v1/arbitrage/deals/public/${dealId}`);
  if (!res.ok) throw new Error(`Failed to fetch deal: ${res.status}`);
  return res.json() as Promise<ArbitrageDeal>;
}

export interface PriceHistoryPoint {
  t: string | null;
  price: number;
}

export interface DealPriceHistory {
  deal_id: string;
  item_id: string;
  retailer: string;
  current_price: number | null;
  historical_avg: number | null;
  detected_at: string | null;
  points: PriceHistoryPoint[];
}

export async function getPublicDealPriceHistory(dealId: string) {
  const res = await fetch(`${API_URL}/api/v1/arbitrage/deals/public/${dealId}/price-history`);
  if (!res.ok) throw new Error(`Failed to fetch price history: ${res.status}`);
  return res.json() as Promise<DealPriceHistory>;
}

export function addUtmParameters(
  url: string,
  source: string,
  medium: string,
  campaign: string
): string {
  if (!url) return url;
  try {
    const base = typeof window !== "undefined" ? window.location.origin : "https://www.bargainhuntrs.com";
    const urlObj = new URL(url, base);
    const params = urlObj.searchParams;
    if (!params.has("utm_source")) params.set("utm_source", source);
    if (!params.has("utm_medium")) params.set("utm_medium", medium);
    params.set("utm_campaign", campaign);
    return urlObj.toString();
  } catch {
    return url;
  }
}

export async function clickAffiliatePublic(data: {
  url: string;
  retailer?: string;
  asin?: string;
  deal_id?: string;
}) {
  return fetchPublic("/api/v1/affiliate/click/public", {
    method: "POST",
    body: JSON.stringify(data),
  }) as Promise<{
    affiliate_url: string;
    original_url: string;
    retailer: string;
    tracked: boolean;
  }>;
}

// ─── Community Deals (User-Submitted) ─────────────────────────────────────────

export interface CommunityDeal {
  id: string;
  title: string;
  url: string;
  image_url: string | null;
  retailer: string;
  original_price: number | null;
  sale_price: number | null;
  discount_percent: number | null;
  category: string | null;
  description: string | null;
  status: string;
  upvotes: number;
  downvotes: number;
  score: number;
  user_aura: number;
  user_tier: string;
  created_at: string;
  user_vote: number | null;
}

export async function submitCommunityDeal(
  token: string,
  data: {
    title: string;
    url: string;
    retailer: string;
    original_price?: number;
    sale_price?: number;
    image_url?: string;
    category?: string;
    description?: string;
  }
) {
  return fetchWithAuth("/api/v1/community/deals/submit", token, {
    method: "POST",
    body: JSON.stringify(data),
  }) as Promise<{ success: boolean; deal: CommunityDeal; aura_points: number; aura_tier: string }>;
}

export async function getCommunityDeals(
  token: string,
  params?: { status?: string; sort?: string; limit?: number; offset?: number }
) {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.sort) qs.set("sort", params.sort);
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.offset) qs.set("offset", String(params.offset));
  const query = qs.toString();
  return fetchWithAuth(`/api/v1/community/deals${query ? `?${query}` : ""}`, token) as Promise<CommunityDeal[]>;
}

export async function getPublicCommunityDeals(
  params?: { sort?: string; limit?: number; offset?: number }
) {
  const qs = new URLSearchParams();
  if (params?.sort) qs.set("sort", params.sort);
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.offset) qs.set("offset", String(params.offset));
  const query = qs.toString();
  return fetchPublic(`/api/v1/community/deals/public${query ? `?${query}` : ""}`) as Promise<CommunityDeal[]>;
}

export async function voteCommunityDeal(token: string, dealId: string, vote: 1 | -1) {
  return fetchWithAuth(`/api/v1/community/deals/${dealId}/vote`, token, {
    method: "POST",
    body: JSON.stringify({ vote }),
  }) as Promise<{
    success: boolean;
    action: string;
    upvotes: number;
    downvotes: number;
    score: number;
    aura_points?: number;
    aura_tier?: string;
  }>;
}

export async function getLeaderboard(token: string, limit = 50) {
  return fetchWithAuth(`/api/v1/community/leaderboard?limit=${limit}`, token) as Promise<
    Array<{
      rank: number;
      user_id: string;
      name: string;
      email: string;
      aura_points: number;
      aura_tier: string;
      deals_submitted: number;
      is_you: boolean;
    }>
  >;
}

export async function getPublicLeaderboard(limit = 50) {
  return fetchPublic(`/api/v1/community/leaderboard/public?limit=${limit}`) as Promise<
    Array<{
      rank: number;
      user_id: string;
      name: string;
      aura_points: number;
      aura_tier: string;
      deals_submitted: number;
      is_you: boolean;
    }>
  >;
}

export async function getMyAura(token: string) {
  return fetchWithAuth("/api/v1/community/aura", token) as Promise<{
    aura_points: number;
    aura_tier: string;
    next_tier: string | null;
    points_to_next: number;
    deals_submitted: number;
    deals_approved: number;
    total_upvotes_received: number;
  }>;
}

export interface MyDeal {
  id: string;
  title: string;
  retailer: string;
  url: string;
  sale_price: number | null;
  original_price: number | null;
  discount_percent: number | null;
  status: string;
  upvotes: number;
  downvotes: number;
  score: number;
  created_at: string;
}

export async function getMyDeals(token: string) {
  return fetchWithAuth("/api/v1/community/my-deals", token) as Promise<MyDeal[]>;
}

// ─── Referrals ───────────────────────────────────────────────────────────────

export interface ReferralStats {
  success: boolean;
  referral_code: string;
  referral_link: string;
  referral_count: number;
  total_aura_earned: number;
}

export interface ReferralLeaderboardEntry {
  rank: number;
  user_id: string;
  name: string;
  email: string;
  referral_count: number;
  aura_points: number;
  aura_tier: string;
}

export async function getReferralStats(token: string) {
  return fetchWithAuth("/api/v1/referrals/me", token) as Promise<ReferralStats>;
}

export async function claimReferral(token: string, referral_code: string) {
  return fetchWithAuth("/api/v1/referrals/claim", token, {
    method: "POST",
    body: JSON.stringify({ referral_code }),
  }) as Promise<{
    success: boolean;
    referrer_id: string;
    referral_code: string;
    referrer_aura_bonus: number;
    referee_aura_bonus: number;
    referral_count: number;
  }>;
}

export async function getReferralLeaderboard(limit = 50) {
  return fetchPublic(`/api/v1/referrals/leaderboard?limit=${limit}`) as Promise<ReferralLeaderboardEntry[]>;
}

export async function getMySubmittedDeals(token: string) {
  return fetchWithAuth("/api/v1/community/my-deals", token) as Promise<CommunityDeal[]>;
}

export async function moderateCommunityDeal(
  token: string,
  dealId: string,
  status: "approved" | "rejected",
  rejection_reason?: string
) {
  return fetchWithAuth(`/api/v1/community/deals/${dealId}/moderate`, token, {
    method: "PUT",
    body: JSON.stringify({ status, rejection_reason }),
  }) as Promise<{ success: boolean; deal_id: string; status: string }>;
}

// ─── Password Reset ───────────────────────────────────────────────────────────

export async function requestPasswordReset(email: string) {
  // Same-origin worker route: proxies to the API and falls back to sending
  // the reset email directly via Resend if the backend mailer fails.
  const res = await fetch("/api/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Failed to send reset email");
  }
  return data as { success: boolean; message: string };
}

export async function resetPassword(token: string, new_password: string) {
  return fetchPublic("/api/v1/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, new_password }),
  }) as Promise<{ success: boolean; message: string }>;
}

// ─── Gamification ─────────────────────────────────────────────────────────────

export interface CommunityStats {
  total_members: number;
  deals_posted: number;
  deals_today: number;
  votes_today: number;
  top_hunter: { name: string; aura_points: number } | null;
  last_voucher_winner: { month: string; user_name: string; aura_points_at_draw: number } | null;
}

export async function getCommunityStats(token: string) {
  return fetchWithAuth("/api/v1/gamification/stats", token) as Promise<CommunityStats>;
}

export async function getVoucherWinners(token: string) {
  return fetchWithAuth("/api/v1/gamification/voucher/winners", token) as Promise<
    Array<{ id: string; month: string; user_name: string; aura_points_at_draw: number; drawn_at: string; status: string }>
  >;
}

export async function runVoucherDraw(token: string) {
  return fetchWithAuth("/api/v1/gamification/voucher/draw", token, {
    method: "POST",
  }) as Promise<{
    success: boolean;
    winner: { month: string; user_name: string; aura_points_at_draw: number; drawn_at: string; status: string };
    winner_id: string;
  }>;
}

export async function markVoucherPaid(token: string, winnerId: string) {
  return fetchWithAuth(`/api/v1/gamification/voucher/${winnerId}/paid`, token, {
    method: "PUT",
  }) as Promise<{
    success: boolean;
    winner: { month: string; user_name: string; aura_points_at_draw: number; drawn_at: string; status: string };
  }>;
}

export async function getLoginStreak(token: string) {
  return fetchWithAuth("/api/v1/gamification/streak", token) as Promise<{
    login_streak: number;
    last_login_at: string;
    aura_points: number;
    aura_tier: string;
  }>;
}

// ─── Seller Portal ────────────────────────────────────────────────────────────

export interface SellerProfile {
  is_verified_seller: boolean;
  seller_store_name: string | null;
  seller_website: string | null;
  submission_count: number;
}

export async function applyAsSeller(token: string, store_name: string, website: string) {
  return fetchWithAuth("/api/v1/seller/apply", token, {
    method: "POST",
    body: JSON.stringify({ store_name, website }),
  }) as Promise<{ success: boolean; profile: SellerProfile }>;
}

export async function getSellerProfile(token: string) {
  return fetchWithAuth("/api/v1/seller/profile", token) as Promise<SellerProfile>;
}

export async function submitSellerCoupon(
  token: string,
  data: {
    title: string;
    url: string;
    retailer: string;
    coupon_code: string;
    discount_type: string;
    discount_value: number;
    expires_at?: string;
    category?: string;
    description?: string;
  }
) {
  return fetchWithAuth("/api/v1/seller/submit/coupon", token, {
    method: "POST",
    body: JSON.stringify(data),
  }) as Promise<{ success: boolean; submission: any; coupon: any }>;
}

export async function submitSellerPriceDrop(
  token: string,
  data: {
    title: string;
    url: string;
    retailer: string;
    original_price: number;
    sale_price: number;
    image_url?: string;
    category?: string;
    description?: string;
  }
) {
  return fetchWithAuth("/api/v1/seller/submit/price-drop", token, {
    method: "POST",
    body: JSON.stringify(data),
  }) as Promise<{ success: boolean; submission: any; deal: any }>;
}

export async function bulkSubmitSellerDeals(
  token: string,
  deals: Array<{
    title: string;
    url: string;
    retailer: string;
    original_price: number;
    sale_price: number;
    image_url?: string;
    category?: string;
    description?: string;
  }>
) {
  return fetchWithAuth("/api/v1/seller/submit/bulk", token, {
    method: "POST",
    body: JSON.stringify({ deals }),
  }) as Promise<{ success: boolean; created: number; errors: string[] }>;
}

export async function getSellerSubmissions(token: string) {
  return fetchWithAuth("/api/v1/seller/submissions", token) as Promise<any[]>;
}
// ─── Real-estate properties (aggregated public listings) ────────────────────

export interface Property {
  id: string;
  source: string;
  source_id: string;
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  county: string | null;
  list_price: string | null;
  bedrooms: string | null;
  bathrooms: string | null;
  sqft: number | null;
  year_built: number | null;
  property_type: string | null;
  status: string | null;
  listing_period: string | null;
  fha_financing: string | null;
  eligible_bidders: string | null;
  list_date: string | null;
  bid_open_date: string | null;
  period_deadline: string | null;
  latitude: number | null;
  longitude: number | null;
  image_url: string | null;
  detail_url: string;
  first_seen_at: string | null;
  last_seen_at: string | null;
}

export interface PropertyListResponse {
  items: Property[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface PropertyFilters {
  state?: string;
  city?: string;
  zip?: string;
  q?: string;
  source?: string;
  property_type?: string;
  min_price?: number;
  max_price?: number;
  min_beds?: number;
  sort?: "newest" | "price_asc" | "price_desc" | "sqft_desc";
  page?: number;
  per_page?: number;
}

export async function getProperties(filters: PropertyFilters = {}): Promise<PropertyListResponse> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  }
  const res = await fetch(`${API_URL}/api/v1/properties?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch properties: ${res.status}`);
  return res.json();
}

export async function getPropertyStates(): Promise<{
  states: { state: string; count: number }[];
  supported: string[];
}> {
  const res = await fetch(`${API_URL}/api/v1/properties/states`);
  if (!res.ok) throw new Error(`Failed to fetch property states: ${res.status}`);
  return res.json();
}

// ─── Auction / surplus listings (aggregated public feeds) ───────────────────

export interface AuctionListing {
  id: string;
  source: string;
  source_id: string;
  category: string;
  title: string;
  description: string | null;
  source_category: string | null;
  current_bid: string | null;
  min_bid: string | null;
  num_bids: number | null;
  sale_method: string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  image_url: string | null;
  detail_url: string;
  first_seen_at: string | null;
  last_seen_at: string | null;
}

export interface ListingListResponse {
  items: AuctionListing[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface ListingFilters {
  category?: string;
  source?: string;
  state?: string;
  city?: string;
  q?: string;
  min_bid?: number;
  max_bid?: number;
  sort?: "ending_soon" | "newest" | "bid_asc" | "bid_desc";
  page?: number;
  per_page?: number;
}

export async function getListings(filters: ListingFilters = {}): Promise<ListingListResponse> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  }
  const res = await fetch(`${API_URL}/api/v1/listings?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch listings: ${res.status}`);
  return res.json();
}

export async function getListingCategories(): Promise<{
  categories: { category: string; count: number }[];
}> {
  const res = await fetch(`${API_URL}/api/v1/listings/categories`);
  if (!res.ok) throw new Error(`Failed to fetch listing categories: ${res.status}`);
  return res.json();
}

export async function getListingStates(): Promise<{
  states: { state: string; count: number }[];
}> {
  const res = await fetch(`${API_URL}/api/v1/listings/states`);
  if (!res.ok) throw new Error(`Failed to fetch listing states: ${res.status}`);
  return res.json();
}

// ─── Dashboard: haul (deal claims) + user lists ─────────────────────────────

export interface DealClaim {
  id: string;
  deal_id: string | null;
  title: string;
  image_url: string | null;
  buy_url: string | null;
  buy_platform: string | null;
  sell_platform: string | null;
  quantity: number;
  buy_price: string;
  est_sell_price: string | null;
  est_net_profit: string | null;
  status: "bought" | "listed" | "sold";
  listing_url: string | null;
  sold_price: string | null;
  purchased_at: string | null;
  listed_at: string | null;
  sold_at: string | null;
  notes: string | null;
  created_at: string | null;
}

export interface UserListItem {
  id: string;
  list_type: "shopping" | "wishlist" | "bolo";
  title: string;
  url: string | null;
  target_price: string | null;
  notes: string | null;
  matched_deal_id: string | null;
  matched_at: string | null;
  is_active: boolean;
  created_at: string | null;
}

export interface ProfitSummary {
  total_spent: number;
  realized_profit: number;
  potential_profit: number;
  realized_roi: number;
  items_bought: number;
  items_listed: number;
  items_sold: number;
  series: { date: string; realized: number; potential: number }[];
}

export interface SavedDeal {
  deal_id: string;
  saved_at: string | null;
  title: string;
  image_url: string | null;
  buy_url: string | null;
  buy_price: number | null;
  historical_avg: number | null;
  retailer: string | null;
  deal_status: string;
}

export async function getSavedDeals(token: string): Promise<SavedDeal[]> {
  return fetchWithAuth("/api/v1/dashboard/saved", token) as Promise<SavedDeal[]>;
}

export async function getSavedDealIds(token: string): Promise<string[]> {
  return fetchWithAuth("/api/v1/dashboard/saved/ids", token) as Promise<string[]>;
}

export async function saveDeal(token: string, dealId: string): Promise<void> {
  await fetchWithAuth(`/api/v1/dashboard/saved/${dealId}`, token, { method: "POST" });
}

export async function unsaveDeal(token: string, dealId: string): Promise<void> {
  await fetchWithAuth(`/api/v1/dashboard/saved/${dealId}`, token, { method: "DELETE" });
}

export async function getHaul(token: string, status?: string): Promise<DealClaim[]> {
  const qs = status ? `?status=${status}` : "";
  return fetchWithAuth(`/api/v1/dashboard/haul${qs}`, token) as Promise<DealClaim[]>;
}

export async function createClaim(
  token: string,
  body: { deal_id?: string; title?: string; buy_price?: number; quantity?: number; notes?: string }
): Promise<DealClaim> {
  return fetchWithAuth("/api/v1/dashboard/haul", token, {
    method: "POST",
    body: JSON.stringify(body),
  }) as Promise<DealClaim>;
}

export async function updateClaim(
  token: string,
  claimId: string,
  body: {
    status?: string;
    sold_price?: number;
    listing_url?: string;
    buy_price?: number;
    quantity?: number;
    notes?: string;
  }
): Promise<DealClaim> {
  return fetchWithAuth(`/api/v1/dashboard/haul/${claimId}`, token, {
    method: "PATCH",
    body: JSON.stringify(body),
  }) as Promise<DealClaim>;
}

export async function deleteClaim(token: string, claimId: string): Promise<void> {
  await fetchWithAuth(`/api/v1/dashboard/haul/${claimId}`, token, { method: "DELETE" });
}

export async function getListItems(token: string, listType?: string): Promise<UserListItem[]> {
  const qs = listType ? `?list_type=${listType}` : "";
  return fetchWithAuth(`/api/v1/dashboard/lists${qs}`, token) as Promise<UserListItem[]>;
}

export async function createListItem(
  token: string,
  body: { list_type: string; title: string; url?: string; target_price?: number; notes?: string }
): Promise<UserListItem> {
  return fetchWithAuth("/api/v1/dashboard/lists", token, {
    method: "POST",
    body: JSON.stringify(body),
  }) as Promise<UserListItem>;
}

export async function updateListItem(
  token: string,
  itemId: string,
  body: { title?: string; url?: string; target_price?: number; notes?: string; is_active?: boolean }
): Promise<UserListItem> {
  return fetchWithAuth(`/api/v1/dashboard/lists/${itemId}`, token, {
    method: "PATCH",
    body: JSON.stringify(body),
  }) as Promise<UserListItem>;
}

export async function deleteListItem(token: string, itemId: string): Promise<void> {
  await fetchWithAuth(`/api/v1/dashboard/lists/${itemId}`, token, { method: "DELETE" });
}

export async function getProfitSummary(token: string): Promise<ProfitSummary> {
  return fetchWithAuth("/api/v1/dashboard/profit-summary", token) as Promise<ProfitSummary>;
}

// ─── AI / LLM features ──────────────────────────────────────────────────────
// All endpoints live under /api/v1/ai on the backend. They return 503 when
// AI_API_KEY isn't configured server-side — callers should check getAiStatus()
// first and/or catch errors and degrade gracefully.

export interface AiStatus {
  configured: boolean;
  model: string | null;
}

export async function getAiStatus(): Promise<AiStatus> {
  const res = await fetch(`${API_URL}/api/v1/ai/status`);
  if (!res.ok) return { configured: false, model: null };
  return res.json();
}

export interface CopilotDealRef {
  id: string;
  title: string;
  retailer: string | null;
  buy_price: number | null;
  historical_avg: number | null;
  discount_pct: number | null;
  deal_tier: string;
  net_profit: number | null;
  image_url: string | null;
  url: string;
}

export interface CopilotResponse {
  source: "ai" | "rules";
  answer: string;
  deals: CopilotDealRef[];
  query: { max_price: number | null; keywords: string[] };
}

export interface CopilotHistoryItem {
  role: "user" | "assistant";
  content: string;
}

export async function postAiCopilot(
  token: string,
  message: string,
  history: CopilotHistoryItem[] = []
): Promise<CopilotResponse> {
  return fetchWithAuth("/api/v1/ai/copilot", token, {
    method: "POST",
    body: JSON.stringify({ message, history }),
  });
}

export interface AiDealVerdict {
  source: "ai" | "rules";
  deal_id: string;
  verdict: "buy" | "wait" | "monitor" | "skip";
  confidence: number;
  summary: string;
  fair_price: string;
  resale_margin: string;
  risks: string[];
  prediction?: Record<string, unknown>;
  quality?: Record<string, unknown>;
}

export async function getAiDealVerdict(token: string, dealId: string): Promise<AiDealVerdict> {
  return fetchWithAuth(`/api/v1/ai/deal-verdict/${dealId}`, token, { method: "GET" });
}

export interface AiArbitrageAdviceRequest {
  title: string;
  buy_price: number;
  sell_price?: number;
  buy_platform?: string;
  sell_platform?: string;
  category?: string;
  estimate_resale?: boolean;
}

export interface AiArbitrageAdvice {
  source: "ai" | "rules";
  recommendation: "worth_it" | "marginal" | "skip";
  summary: string;
  margin_analysis: string;
  risks: string[];
  tips: string[];
  sell_price_used: number | null;
  resale_estimate: number | null;
  resale_estimate_source: string | null;
  profit: Record<string, unknown> | null;
}

export async function postAiArbitrageAdvice(
  token: string,
  body: AiArbitrageAdviceRequest
): Promise<AiArbitrageAdvice> {
  return fetchWithAuth("/api/v1/ai/arbitrage-advice", token, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export interface AiDescribeRequest {
  product: string;
  retailer?: string;
  condition?: string;
  price?: number;
  original_price?: number;
  category?: string;
  features?: string[];
  tone?: string;
}

export interface AiDescribeResponse {
  source: "ai" | "rules";
  title: string;
  description: string;
  keywords: string[];
}

export async function postAiDescribe(
  token: string,
  body: AiDescribeRequest
): Promise<AiDescribeResponse> {
  return fetchWithAuth("/api/v1/ai/describe", token, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ── Admin CRM ──────────────────────────────────────────────────────────

export interface CrmStats {
  totalUsers: number;
  paidUsers: number;
  newsletterSubscribers: number;
  liveDeals: number;
  activeAlerts: number;
  affiliateClicks: number;
  conversions: number;
  commissionEarned: number;
  conversionRate: number;
  pendingSellerSubmissions: number;
  pendingCommunityDeals: number;
  waitlistEntries: number;
  referralClaims: number;
  signupsThisMonth: number;
  monthlyGrowth: number;
  tasksDue: number;
}

export interface CrmActivityItem {
  id: string;
  type: string;
  title: string;
  description?: string;
  status?: string;
  timestamp?: string;
}

export interface CrmMember {
  id: string;
  email: string;
  name: string;
  tier: string;
  role: string;
  emailVerified: boolean;
  emailAlerts: boolean;
  smsAlerts: boolean;
  createdAt?: string;
}

export interface CrmLead {
  id: string;
  kind: "seller" | "community";
  title: string;
  retailer?: string;
  type?: string;
  status: string;
  url?: string;
  score?: number;
  createdAt?: string;
}

export interface CrmTask {
  id: string;
  body: string;
  subjectUserId?: string;
  dueAt?: string;
  doneAt?: string;
  createdAt?: string;
}

export interface CrmPipeline {
  sellerSubmissions: Record<string, number>;
  communityDeals: Record<string, number>;
  membersByTier: Record<string, number>;
  dealsByStatus: Record<string, number>;
  clicksByRetailer: { retailer: string; clicks: number; commission: number }[];
}

export async function getCrmStats(token: string): Promise<CrmStats> {
  return fetchWithAuth("/api/v1/crm/dashboard/stats", token);
}

export async function getCrmActivity(token: string): Promise<{ recentActivity: CrmActivityItem[] }> {
  return fetchWithAuth("/api/v1/crm/dashboard/activity", token);
}

export async function getCrmMembers(
  token: string,
  params: { tier?: string; search?: string } = {}
): Promise<CrmMember[]> {
  const qs = new URLSearchParams();
  if (params.tier) qs.set("tier", params.tier);
  if (params.search) qs.set("search", params.search);
  return fetchWithAuth(`/api/v1/crm/members?${qs.toString()}`, token);
}

export async function getCrmLeads(
  token: string,
  params: { status?: string; kind?: string } = {}
): Promise<CrmLead[]> {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.kind) qs.set("kind", params.kind);
  return fetchWithAuth(`/api/v1/crm/leads?${qs.toString()}`, token);
}

export async function reviewCrmLead(
  token: string,
  kind: "seller" | "community",
  id: string,
  action: "approve" | "reject",
  reason?: string
) {
  return fetchWithAuth(`/api/v1/crm/leads/${kind}/${id}/review`, token, {
    method: "POST",
    body: JSON.stringify({ action, reason }),
  });
}

export async function getCrmTasks(token: string): Promise<CrmTask[]> {
  return fetchWithAuth("/api/v1/crm/tasks", token);
}

export async function createCrmActivity(
  token: string,
  body: { body: string; type?: string; due_at?: string; subject_user_id?: string }
) {
  return fetchWithAuth("/api/v1/crm/activities", token, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function completeCrmTask(token: string, taskId: string) {
  return fetchWithAuth(`/api/v1/crm/tasks/${taskId}/complete`, token, {
    method: "POST",
  });
}

export async function getCrmPipeline(token: string): Promise<CrmPipeline> {
  return fetchWithAuth("/api/v1/crm/analytics/pipeline", token);
}

// ─── Feature Request Board (/roadmap) ───────────────────────────────────────

export interface FeatureRequest {
  id: string;
  title: string;
  body: string | null;
  category: string;
  status: "under_review" | "planned" | "in_progress" | "shipped" | "declined";
  votes: number;
  author_name: string | null;
  created_at: string | null;
  updated_at: string | null;
  voted: boolean;
}

export async function getFeatureRequests(
  params?: { status?: string; category?: string; include_declined?: boolean }
) {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.category) qs.set("category", params.category);
  if (params?.include_declined) qs.set("include_declined", "true");
  const query = qs.toString();
  return fetchPublic(`/api/v1/feedback${query ? `?${query}` : ""}`) as Promise<FeatureRequest[]>;
}

export async function submitFeatureRequest(
  token: string | null,
  data: {
    title: string;
    body?: string;
    category?: string;
    author_name?: string;
    author_email?: string;
  }
) {
  return fetchWithAuth("/api/v1/feedback", token, {
    method: "POST",
    body: JSON.stringify(data),
  }) as Promise<FeatureRequest>;
}

export async function voteFeatureRequest(
  token: string | null,
  requestId: string,
  voterId?: string
) {
  return fetchWithAuth(`/api/v1/feedback/${requestId}/vote`, token, {
    method: "POST",
    body: JSON.stringify({ voter_id: voterId }),
  }) as Promise<{ voted: boolean; votes: number }>;
}

// ─── Community Deal Threads (Slickdeals-style feed) ─────────────────────────

export interface DealThread {
  id: string;
  title: string;
  body: string | null;
  url: string | null;
  retailer: string | null;
  price_cents: number | null;
  original_price_cents: number | null;
  status: string;
  upvotes: number;
  comments_count: number;
  author_name: string;
  author_user_id: string | null;
  is_member: boolean;
  created_at: string | null;
  voted: boolean;
  comments?: DealThreadComment[];
}

export interface DealThreadComment {
  id: string;
  author_name: string;
  is_member: boolean;
  body: string;
  created_at: string | null;
}

export async function getCommunityThreads(
  params?: { sort?: "hot" | "new"; limit?: number; offset?: number }
) {
  const qs = new URLSearchParams();
  if (params?.sort) qs.set("sort", params.sort);
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.offset) qs.set("offset", String(params.offset));
  const query = qs.toString();
  return fetchPublic(`/api/v1/community/threads${query ? `?${query}` : ""}`) as Promise<DealThread[]>;
}

export async function getCommunityThread(threadId: string) {
  return fetchPublic(`/api/v1/community/threads/${threadId}`) as Promise<DealThread>;
}

export async function createCommunityThread(
  token: string | null,
  data: {
    title: string;
    body?: string;
    url?: string;
    retailer?: string;
    price_cents?: number;
    original_price_cents?: number;
    author_name?: string;
    author_email?: string;
  }
) {
  return fetchWithAuth("/api/v1/community/threads", token, {
    method: "POST",
    body: JSON.stringify(data),
  }) as Promise<DealThread>;
}

export async function createThreadComment(
  token: string | null,
  threadId: string,
  data: { body: string; author_name?: string; author_email?: string }
) {
  return fetchWithAuth(`/api/v1/community/threads/${threadId}/comments`, token, {
    method: "POST",
    body: JSON.stringify(data),
  }) as Promise<DealThreadComment>;
}

export async function voteCommunityThread(
  token: string | null,
  threadId: string,
  voterId?: string
) {
  return fetchWithAuth(`/api/v1/community/threads/${threadId}/vote`, token, {
    method: "POST",
    body: JSON.stringify({ voter_id: voterId }),
  }) as Promise<{ voted: boolean; upvotes: number }>;
}

export async function deleteCommunityThread(token: string, threadId: string) {
  return fetchWithAuth(`/api/v1/community/threads/${threadId}`, token, {
    method: "DELETE",
  }) as Promise<{ deleted: boolean }>;
}

// ─── Anonymous voter identity (localStorage) ────────────────────────────────
//
// bargain_voter_id — stable client-generated id sent as voter_id so anonymous
// votes stay one-per-person. bargain_voted — map of request/thread ids the
// visitor has already voted on, for instant UI state without a login.

export function getOrCreateVoterId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem("bargain_voter_id");
  if (!id) {
    id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem("bargain_voter_id", id);
  }
  return id;
}

export function getVotedIds(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem("bargain_voted") || "{}");
  } catch {
    return {};
  }
}

export function setVotedFlag(id: string, voted: boolean) {
  if (typeof window === "undefined") return;
  const map = getVotedIds();
  if (voted) {
    map[id] = true;
  } else {
    delete map[id];
  }
  window.localStorage.setItem("bargain_voted", JSON.stringify(map));
}

// ─── Dropship Pools — group-buy wholesale events ────────────────────────────
// Hunters commit units to hit an MOQ at a pooled wholesale rate, then resell
// their own units on their own stores. All-or-nothing: commits confirm on
// fill, auto-cancel on expiry.

export interface DropshipProduct {
  id: string;
  sku: string;
  title: string;
  description: string | null;
  niche: string;
  supplier: string;
  warehouse_state: string | null;
  cost: number;
  suggested_price: number;
  est_margin_pct: number | null;
  shipping_days_min: number | null;
  shipping_days_max: number | null;
  image_url: string | null;
  trending_score: number | null;
  watching: boolean;
  saved: boolean;
  why?: string;
}

export interface DropshipPool {
  id: string;
  status: "open" | "filled" | "expired" | "settled";
  product: DropshipProduct | null;
  moq_units: number;
  units_committed: number;
  units_remaining: number;
  fill_pct: number;
  unit_cost: number;
  target_price: number;
  min_price: number | null;
  est_margin_pct: number | null;
  max_units_per_hunter: number;
  channel: "amazon_fba" | "walmart_wfs" | "own_store";
  origin: "us" | "china";
  freight_mode: "us_stock" | "air" | "ocean";
  delivery_days_max: number;
  deal_notes: string | null;
  opens_at: string | null;
  closes_at: string | null;
  filled_at: string | null;
  hunters?: number;
  my_commit: { units: number; unit_price: number; status: string } | null;
  commit_id?: string;
}

export interface DropshipNiche {
  key: string;
  display_name: string;
  emoji: string;
  count: number;
}

export interface DropshipChannel {
  key: "amazon_fba" | "walmart_wfs" | "own_store";
  label: string;
  live: boolean;
  desc: string;
  votes: number;
  voted: boolean;
}

export async function getDropshipChannels(token: string) {
  return fetchWithAuth("/api/v1/dropship/channels", token) as Promise<DropshipChannel[]>;
}

export async function voteDropshipChannel(token: string, channel: string) {
  return fetchWithAuth("/api/v1/dropship/channels/vote", token, {
    method: "POST",
    body: JSON.stringify({ channel }),
  }) as Promise<{ voted: boolean; channel: string; votes: number }>;
}

export async function getDropshipProducts(
  token: string,
  params?: { niche?: string; sort?: "trending" | "margin" | "new" }
) {
  const qs = new URLSearchParams();
  if (params?.niche) qs.set("niche", params.niche);
  if (params?.sort) qs.set("sort", params.sort);
  const query = qs.toString();
  return fetchWithAuth(`/api/v1/dropship/products${query ? `?${query}` : ""}`, token) as Promise<
    DropshipProduct[]
  >;
}

export async function getDropshipCurated(token: string) {
  return fetchWithAuth("/api/v1/dropship/curated", token) as Promise<{
    ai: boolean;
    niches: string[] | null;
    items: DropshipProduct[];
  }>;
}

export async function toggleDropshipWatch(token: string, productId: string) {
  return fetchWithAuth(`/api/v1/dropship/products/${productId}/watch`, token, {
    method: "POST",
  }) as Promise<{ watching: boolean; watchers: number }>;
}

export async function saveDropshipProduct(token: string, productId: string) {
  return fetchWithAuth(`/api/v1/dropship/products/${productId}/save`, token, {
    method: "POST",
  }) as Promise<{ saved: boolean }>;
}

export async function unsaveDropshipProduct(token: string, productId: string) {
  return fetchWithAuth(`/api/v1/dropship/products/${productId}/save`, token, {
    method: "DELETE",
  }) as Promise<{ saved: boolean }>;
}

export async function getDropshipSaved(token: string) {
  return fetchWithAuth("/api/v1/dropship/saved", token) as Promise<DropshipProduct[]>;
}

export async function getDropshipPools(token: string, status?: string) {
  const qs = status ? `?status=${status}` : "";
  return fetchWithAuth(`/api/v1/dropship/pools${qs}`, token) as Promise<DropshipPool[]>;
}

export async function getDropshipPool(token: string, poolId: string) {
  return fetchWithAuth(`/api/v1/dropship/pools/${poolId}`, token) as Promise<DropshipPool>;
}

export async function commitToDropshipPool(token: string, poolId: string, units: number) {
  return fetchWithAuth(`/api/v1/dropship/pools/${poolId}/commit`, token, {
    method: "POST",
    body: JSON.stringify({ units }),
  }) as Promise<{
    commit: { units: number; unit_price: number; status: string };
    pool_status: string;
    units_committed: number;
  }>;
}

export async function getMyDropshipCommits(token: string) {
  return fetchWithAuth("/api/v1/dropship/commits", token) as Promise<DropshipPool[]>;
}

export async function getDropshipNiches(token: string) {
  return fetchWithAuth("/api/v1/dropship/niches", token) as Promise<DropshipNiche[]>;
}
