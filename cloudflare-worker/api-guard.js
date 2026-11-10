// bargain-api-guard — api.bargainhuntrs.com edge worker
//
// Two jobs:
//  1. REVERSE-PROXY every request to the production API on the oracle box.
//     The origin CNAME (bargain-api-1o0n.onrender.com) is a stale Render
//     service. The live API runs on oracle behind cloudflared tunnel
//     e0a01d10 — but that tunnel lives in a different Cloudflare account, so
//     api.bargainhuntrs.com cannot CNAME to it directly (error 1033). The
//     same-account alias bargain-api.settleinpeace.com DOES reach it, so
//     this worker proxies through that hostname until a tunnel exists in
//     the bargain CF account (see .devin/NEEDS_HUMAN.md).
//  2. Guard auth endpoints against credential-stuffing from the
//     139.178.128.0/21 Verizon range. Requests carrying the native-app
//     headers (x-mobile-app / x-platform) or a native UA are passed through.

const UPSTREAM = "https://bargain-api.settleinpeace.com";
const PUBLIC_HOST = "api.bargainhuntrs.com";
const BLOCKED_BASE = [139, 178, 128]; // 139.178.128.0/21 covers .128-.135
const NATIVE_UA = /expo|okhttp|cfnetwork/i;

function inBlockedRange(ip) {
  const p = ip.split(".").map(Number);
  return p.length === 4 && p[0] === BLOCKED_BASE[0] && p[1] === BLOCKED_BASE[1] &&
    p[2] >= BLOCKED_BASE[2] && p[2] <= BLOCKED_BASE[2] + 7;
}

function proxy(request) {
  const url = new URL(request.url);
  const upstream = new URL(UPSTREAM);
  url.protocol = upstream.protocol;
  url.hostname = upstream.hostname;
  url.port = "";

  const headers = new Headers(request.headers);
  headers.delete("host");
  const ip = request.headers.get("cf-connecting-ip");
  if (ip) {
    const prior = headers.get("x-forwarded-for");
    headers.set("x-forwarded-for", prior ? `${prior}, ${ip}` : ip);
    headers.set("x-real-ip", ip);
  }
  headers.set("x-forwarded-host", PUBLIC_HOST);
  headers.set("x-forwarded-proto", "https");

  const init = {
    method: request.method,
    headers,
    redirect: "manual",
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
  }
  return fetch(url.toString(), init);
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname.includes("/api/v1/auth/")) {
      const ip = request.headers.get("cf-connecting-ip") || "";
      const ua = request.headers.get("user-agent") || "";
      const isApp = request.headers.has("x-mobile-app") ||
                    request.headers.has("x-platform") || NATIVE_UA.test(ua);
      if (inBlockedRange(ip) && !isApp) {
        return new Response(JSON.stringify({ detail: "Forbidden" }), {
          status: 403,
          headers: { "content-type": "application/json" },
        });
      }
    }
    return proxy(request);
  },
};
