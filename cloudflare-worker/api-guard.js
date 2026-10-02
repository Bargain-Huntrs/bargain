// Guards api.bargainhuntrs.com auth endpoints against credential-stuffing
// from the 139.178.128.0/21 Verizon range. Requests carrying the native-app
// headers (x-mobile-app / x-platform) or a native UA are passed through.

const BLOCKED_BASE = [139, 178, 128]; // 139.178.128.0/21 covers .128-.135
const NATIVE_UA = /expo|okhttp|cfnetwork/i;

function inBlockedRange(ip) {
  const p = ip.split(".").map(Number);
  return p.length === 4 && p[0] === BLOCKED_BASE[0] && p[1] === BLOCKED_BASE[1] &&
    p[2] >= BLOCKED_BASE[2] && p[2] <= BLOCKED_BASE[2] + 7;
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
    return fetch(request);
  },
};
