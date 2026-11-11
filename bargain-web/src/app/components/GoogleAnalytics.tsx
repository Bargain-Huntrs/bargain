import Script from "next/script";
import { GOOGLE_TAG_ID, IS_GTM_CONTAINER, MS_UET_TAG_ID } from "@/lib/ads";

/**
 * Analytics + ad-measurement tag loader.
 *
 * Renders nothing when no tag ids are configured, so dev and unconfigured
 * environments stay tracker-free. NEXT_PUBLIC_GTM_ID takes a GTM-XXXX
 * container id (gtm.js) or a G-/AW- tag id (gtag.js); NEXT_PUBLIC_GA4_ID is
 * the legacy alias for the Google tag. NEXT_PUBLIC_MS_UET_ID loads
 * Microsoft Advertising UET. Mounted once in the root layout.
 */
export default function GoogleAnalytics() {
  if (!GOOGLE_TAG_ID && !MS_UET_TAG_ID) return null;

  return (
    <>
      {GOOGLE_TAG_ID ? (
        IS_GTM_CONTAINER ? (
          <Script
            id="gtm-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GOOGLE_TAG_ID}');`,
            }}
          />
        ) : (
          <>
            <Script
              id="ga4-gtag-src"
              strategy="afterInteractive"
              src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_TAG_ID}`}
            />
            <Script
              id="ga4-gtag-init"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GOOGLE_TAG_ID}', { page_path: window.location.pathname });`,
              }}
            />
          </>
        )
      ) : null}
      {MS_UET_TAG_ID ? (
        <Script
          id="uet-init"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,t,r,u){var f,n,i;w[u]=w[u]||[];f=function(){var o={ti:"${MS_UET_TAG_ID}",enableAutoSpaTracking:true};o.q=w[u];w[u]=new UET(o);w[u].push("pageLoad")};n=d.createElement(t);n.src=r;n.async=1;n.onload=n.onreadystatechange=function(){var s=this.readyState;s&&s!=="loaded"&&s!=="complete"||(f(),n.onload=n.onreadystatechange=null)};i=d.getElementsByTagName(t)[0];i.parentNode.insertBefore(n,i)})(window,document,"script","//bat.bing.com/bat.js","uetq");`,
          }}
        />
      ) : null}
    </>
  );
}
