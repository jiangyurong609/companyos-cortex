/** Synthetic Northstar API seed memory (docs/04_GBRAIN_INTEGRATION.md). Fictional company. */
export interface SeedNote {
  path: string;
  title: string;
  body: string;
}

/** Org chart as GBrain pages: who reports to whom is company memory too. */
export const PEOPLE = [
  { slug: "sarah", name: "Sarah", role: "Account Executive", team: "Sales", reportsTo: "Maya", owns: "Acme, Ramp" },
  { slug: "priya", name: "Priya", role: "Customer Success Manager", team: "Customer Success", reportsTo: "Maya", owns: "Initech, Globex" },
  { slug: "leo", name: "Leo", role: "Staff Engineer", team: "Product", reportsTo: "Dana", owns: "Authentication" },
  { slug: "maya", name: "Maya", role: "VP Revenue", team: "Sales", reportsTo: "Yurong", owns: "Sales and Customer Success" },
  { slug: "dana", name: "Dana", role: "Head of Product", team: "Product", reportsTo: "Yurong", owns: "Roadmap" },
  { slug: "omar", name: "Omar", role: "Support Engineer", team: "Customer Success", reportsTo: "Maya", owns: "Support queue" },
  { slug: "jordan", name: "Jordan", role: "Product Marketing Manager", team: "Marketing", reportsTo: "Yurong", owns: "Competitive intelligence" },
  { slug: "kim", name: "Kim", role: "Finance Lead", team: "Finance", reportsTo: "Yurong", owns: "Forecast and bookings" },
];

export const SEED_NOTES: SeedNote[] = [
  ...PEOPLE.map((p) => ({
    path: `people/${p.slug}`,
    title: `${p.name} — ${p.role}`,
    body: `${p.name} is ${p.role} at Northstar API.\n\nRole: ${p.role}\nTeam: ${p.team}\nReports to: ${p.reportsTo}\nOwns: ${p.owns}`,
  })),
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
