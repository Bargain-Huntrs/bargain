/**
 * Serialize JSON-LD for inline <script> embedding. JSON.stringify alone is
 * not enough: a string containing '</script>' (e.g. a scraped deal title
 * from an affiliate/API feed) would break out of the script tag into live
 * HTML. Escaping '<' as < is valid JSON and closes that hole.
 */
export function stringifyJsonLd(data: object): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
