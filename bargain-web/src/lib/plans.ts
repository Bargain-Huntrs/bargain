/**
 * Canonical subscription-tier helpers.
 *
 * Prod plan IDs: free | hunter | pro | agency. ("enterprise" never existed —
 * earlier code gated on it and silently matched nothing; hunter, the $9.99
 * flagship, is a PAID tier and must be included in every paid gate.)
 */
export const PAID_TIERS = ["hunter", "pro", "agency"] as const;

/** True when the stored/API tier string is any paid plan. */
export function isPaidTier(tier?: string | null): boolean {
  const t = (tier || "").toLowerCase();
  return (PAID_TIERS as readonly string[]).includes(t);
}
