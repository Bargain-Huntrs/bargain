/**
 * LeadOps central-store mirror — mirrors /Volumes/Os_Sites/LeadOps/consent/leadCapture.ts.
 */

export const LEADOPS_URL = "https://leadops-capture.rideprimetransit.workers.dev";

/** Bump when consent wording changes; stored per-lead for compliance receipts. */
export const CONSENT_VERSION = "v1-2026-10-17";

export interface LeadCaptureInput {
  email: string;
  vertical: string;
  source_page?: string;
  name?: string;
  phone?: string;
  meta?: Record<string, unknown>;
}

export function consentText(brandName = "BargainHuntrs") {
  return `By submitting, you agree that ${brandName} may contact you about this request and may share your information with service partners relevant to your request. You can unsubscribe at any time. Consent ${CONSENT_VERSION}.`;
}

export async function captureLead(
  input: LeadCaptureInput,
): Promise<{ ok: boolean; suppressed?: boolean; error?: string }> {
  try {
    const res = await fetch(`${LEADOPS_URL}/capture`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: input.email,
        name: input.name,
        phone: input.phone,
        vertical: input.vertical,
        source_project: "bargain",
        source_page:
          input.source_page ??
          (typeof window !== "undefined" ? window.location.pathname : undefined),
        consent: true,
        consent_version: CONSENT_VERSION,
        consent_text: consentText(),
        meta: input.meta ?? {},
      }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok && data.ok === true, suppressed: data.suppressed, error: data.error };
  } catch {
    return { ok: false, error: "network" };
  }
}
