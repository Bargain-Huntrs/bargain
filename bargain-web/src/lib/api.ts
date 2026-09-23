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

export async function getPublicDeals(limit = 20, offset = 0, source?: string) {
  const qs = new URLSearchParams();
  qs.set("limit", String(limit));
  qs.set("offset", String(offset));
  if (source) qs.set("source", source);
  return fetchPublic(`/api/v1/arbitrage/deals/public?${qs.toString()}`, {
    method: "GET",
  }) as Promise<ArbitrageDeal[]>;
}

export async function getPublicDeal(dealId: string) {
  const res = await fetch(`${API_URL}/api/v1/arbitrage/deals/public/${dealId}`);
  if (!res.ok) throw new Error(`Failed to fetch deal: ${res.status}`);
  return res.json() as Promise<ArbitrageDeal>;
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
  return fetchPublic("/api/v1/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  }) as Promise<{ success: boolean; message: string }>;
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
