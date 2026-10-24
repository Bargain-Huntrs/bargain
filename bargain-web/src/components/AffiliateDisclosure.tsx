import Link from "next/link";

/**
 * FTC 16 CFR Part 255 affiliate-disclosure line.
 *
 * Render this near any surface that carries affiliate links (deal grids,
 * coupon lists, retailer/store pages). One primitive, every surface — keep
 * the wording identical to the inline disclosures used elsewhere so the
 * disclosure is consistent site-wide.
 */
export default function AffiliateDisclosure({
  className = "",
}: {
  className?: string;
}) {
  return (
    <p className={`text-xs text-zinc-400 dark:text-zinc-500 ${className}`}>
      Deal links may be affiliate links — we may earn a commission at no extra
      cost to you.{" "}
      <Link
        href="/disclosure"
        className="underline hover:text-zinc-600 dark:hover:text-zinc-300"
      >
        Affiliate disclosure
      </Link>
    </p>
  );
}
