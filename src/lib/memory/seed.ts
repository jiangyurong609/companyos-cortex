/** Synthetic Northstar API seed memory (docs/04_GBRAIN_INTEGRATION.md). Fictional company. */
export interface SeedNote {
  path: string;
  title: string;
  body: string;
}

export const SEED_NOTES: SeedNote[] = [
  {
    path: "company/overview",
    title: "Northstar API — company overview",
    body: "Northstar API is a developer infrastructure API. Primary buyer: engineering teams. The enterprise sales motion is new.",
  },
  {
    path: "sales/acme",
    title: "Acme — opportunity",
    body: "Acme opportunity: $120K annual contract. Owner: Sarah. Stage: technical evaluation.",
  },
  {
    path: "sales/ramp",
    title: "Ramp — enterprise SSO request",
    body: "Ramp requested enterprise SSO (SAML) in a prior evaluation. Opportunity value: $140K.",
  },
  {
    path: "sales/globex",
    title: "Globex — SAML request",
    body: "Globex requested SAML support. Opportunity value: $80K.",
  },
  {
    path: "product/auth",
    title: "Product — current authentication",
    body: "Current authentication: email/password + Google OAuth. SAML is not currently supported.",
  },
  {
    path: "decisions/enterprise",
    title: "Decision — enterprise readiness",
    body: "Enterprise readiness is a Q4 priority.",
  },
];
