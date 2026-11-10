// Shared display helpers — currency, percent-off, relative time, URL hosts.

/** USD display for a dollar amount (the API returns dollars, not cents). */
export function usd(dollars: number | null | undefined): string {
  if (dollars === null || dollars === undefined || Number.isNaN(dollars)) return '—';
  return `$${dollars.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Percent-off between a typical/historical price and the buy price. */
export function pctOff(was: number | null | undefined, now: number | null | undefined): number | null {
  if (!was || !now || was <= 0 || now <= 0 || now >= was) return null;
  return Math.round((1 - now / was) * 100);
}

/** "3h ago" / "2d ago" — when the scanner spotted the deal. */
export function ago(iso: string | null | undefined): string {
  if (!iso) return '';
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** "walmart.com" from a full URL — for watchlist rows + deal links. */
export function hostOf(url: string | null | undefined): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** Pretty retailer label — "best_buy" → "Best Buy", "sams_club" → "Sams Club". */
export function retailerLabel(slug: string | null | undefined): string {
  if (!slug) return 'Store';
  return slug
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}
