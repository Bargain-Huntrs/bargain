// Shared slug/display helpers for the /stores SEO section.

export function retailerSlug(retailer: string): string {
  return retailer
    .toLowerCase()
    .replace(/\.(com|net|org|co|io|us)$/, "")
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function retailerDisplayName(retailer: string): string {
  return retailer
    .replace(/\.(com|net|org|co|io|us)$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
