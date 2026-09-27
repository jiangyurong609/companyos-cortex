import { createObservation } from "./pipeline";
import type { ObservationInput } from "./schemas";

/**
 * A replayed workday: what connectors (call recorder, Slack, Zendesk, GitHub) would capture from six
 * people on five teams. Each item enters through the same path as a real connector would.
 */
export const WORKDAY: ObservationInput[] = [
  {
    actor: "Sarah",
    source: "call",
    modality: "voice",
    text: "Call recording, Acme QBR. Acme's security lead: we can't approve Northstar without SAML. Sarah: this is blocking the $120K deal, and they need an answer Friday.",
  },
  {
    actor: "Priya",
    source: "ticket",
    modality: "text",
    text: "Zendesk ticket from Globex: still no SAML. Their IT team says the $80K renewal next month is at risk if SAML isn't on the roadmap.",
  },
  {
    actor: "Leo",
    source: "github",
    modality: "text",
    text: "GitHub incident: rate limiter p99 latency spiked to 4 seconds; Acme's data team hit 429 errors twice this month. We need a per-tenant rate limit tier.",
  },
  {
    actor: "Omar",
    source: "slack",
    modality: "text",
    text: "#support: third ticket this week asking for audit logs. Initech says no audit logs means no renewal on their $60K contract, decision by end of month.",
  },
  {
    actor: "Jordan",
    source: "email",
    modality: "text",
    text: "Competitive alert: Stytch launched an SSO bundle this morning, and Hooli picked them over us in their evaluation because we lack SAML.",
  },
  {
    actor: "Kim",
    source: "slack",
    modality: "text",
    text: "#finance: the Q4 bookings forecast assumes the Acme deal closes this quarter; if it slips we miss plan by $120K.",
  },
];

const g = globalThis as unknown as { __cortexReplay?: boolean };

export function startWorkday(gapMs = 8000): { scheduled: number; running: boolean } {
  if (g.__cortexReplay) return { scheduled: 0, running: true };
  g.__cortexReplay = true;
  WORKDAY.forEach((item, i) =>
    setTimeout(() => {
      createObservation(item);
      if (i === WORKDAY.length - 1) g.__cortexReplay = false;
    }, i * gapMs),
  );
  return { scheduled: WORKDAY.length, running: true };
}
