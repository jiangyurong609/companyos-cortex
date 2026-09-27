# UX & Visual System

## Experience principle
The product should feel like a **live instrument panel for an organism**, not enterprise SaaS.

Avoid:
- left-nav-heavy dashboard
- CRM tables
- generic cards everywhere
- chat bubbles
- terminal spam

Use:
- large state transitions
- evidence chips
- animated relationship lines
- diff semantics
- strong typography
- restrained motion

## Primary desktop layout

### Header

```text
CompanyOS / CORTEX                         LIVE ●
Northstar API                            GBrain connected
```

### Center: Reality Stream
New observation appears as a vertical pulse:

```text
13:52:08
VOICE · YURONG

“Acme security won't approve us without SAML…”

        ↓ compiling
```

Then resolves visually into entities:

```text
ACME ──blocked by──> SAML
  │
  └── opportunity ──> $120K
```

### Right: Company Context
Show GBrain evidence:

```text
GBrain linked 3 memories

Ramp / SAML request       $140K
Globex / SAML request      $80K
Enterprise readiness      Q4 priority
```

### Bottom: Company Diff
This is the hero surface.

```text
COMPANY DIFF

+ New blocker       Acme ↔ SAML
+ Revenue context   $340K related opportunities
~ Roadmap signal    SAML deserves review
→ Action            engineering feasibility
```

Every row expands to evidence.

## Approval interaction
Use explicit controls:

```text
[Reject] [Edit] [Accept into company memory]
```

For action:

```text
[Dispatch investigation]
```

## Motion
Recommended transitions:
- capture pulse: 300–500ms
- entity assembly: 500–800ms
- GBrain links: staggered 100ms
- diff rows: slide/fade 150ms each

Do not animate fake agent typing.

## Color semantics
Let the design system choose theme defaults if coding quickly, but semantic roles should be distinct:
- new
- changed
- conflict
- action

Do not depend on color alone; use `+`, `~`, `!`, `→` symbols.

## Typography
Large mono or technical display type for event/diff labels, clean sans-serif for body.

Key phrases should fit on-screen:

> REALITY EVENT

> GBRAIN LINKED 3 MEMORIES

> COMPANY DIFF

> WRITTEN TO COMPANY MEMORY

## Demo end state
Full screen confirmation:

```text
COMPANY MEMORY UPDATED

Acme SAML blocker is now durable.

Observe → Understand → Act → Learn
```
