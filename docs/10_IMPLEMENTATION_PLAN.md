# Implementation Plan v2 — 3 Hour Prototype

## Goal
Ship one reliable, judgeable loop using **both QM and GBrain**.

Do not optimize for feature count. Optimize for a 60–90 second demo that works five times in a row.

## 0:00–0:15 — Repo + smoke test
- new repo created during hackathon
- Next.js app with `/capture` and `/command`
- `BUILD_LOG.md`
- fixture event can move from capture -> command

**Exit:** full fake loop visible before integrations.

## 0:15–0:35 — GBrain proof
- create/select hackathon workspace
- seed synthetic Northstar API facts
- attach memory to a Full-access GBrain client
- verify `search/recall`
- verify one disposable `remember` write

**Exit:** real read and write proven.

## 0:35–0:55 — QM proof
- use organizer-provided QM if available; otherwise initialize/deploy only if fast
- create/use project scope `cortex-demo`
- connect GBrain MCP to QM
- issue one QM turn that searches GBrain

**Exit:** QM -> GBrain round trip visible in logs/output.

**Kill rule:** if deployment infrastructure itself is consuming >20 minutes, ask organizers for the intended running environment or fastest supported path. Do not burn the event on infra.

## 0:55–1:20 — Reality Event compiler
- one structured extraction call
- strict schema
- canonical demo sentence must parse 5/5
- no image pipeline; voice optional

**Exit:** Acme / SAML / $120K / Sarah / Friday parse deterministically.

## 1:20–1:45 — Grounded QM resolution
- send typed event to QM `cortex-demo`
- QM calls GBrain for SAML/customer/roadmap context
- return strict JSON with provenance
- backend computes opportunity sum locally

**Exit:** Acme event discovers seeded related SAML requests through real QM + GBrain.

## 1:45–2:10 — Company Diff UX
Build the centerpiece:

```text
OBSERVED
+ Acme says SAML blocks deployment

RECALLED FROM GBRAIN
+ Ramp requested SAML — $140K
+ Globex requested SAML — $80K

DERIVED
+ Related opportunities: $340K

PROPOSED
◇ Review enterprise SAML priority
```

- evidence expanders
- Accept / Edit / Reject

**Exit:** state categories are visually unmistakable.

## 2:10–2:30 — Writeback + proof
- Accept creates second QM turn
- QM calls GBrain `remember`
- fresh QM recall asks for Acme SAML blocker
- show source note/reference

**Exit:** complete P0 loop works end-to-end.

## 2:30–2:45 — One QM action artifact (stretch)
Use QM scope sandbox to create only:

```text
docs/saml-feasibility.md
```

No Superset requirement. No production feature implementation.

**Exit:** artifact exists and UI can show it.

## 2:45–3:00 — Freeze and rehearse
- no new features
- run demo five times
- cold reload once
- verify repeated write deduplication
- capture backup screen recording
- rehearse 60-second and 90-second versions

## Explicitly deferred
- Superset
- Memorable
- River live training
- UFO
- native iOS
- multi-agent fan-out
- auth
- graph visualization

These can be described as the expansion path, not demo dependencies.

## Hard go/no-go gates
1. Real GBrain recall works.
2. Real GBrain write works.
3. QM can invoke GBrain in `cortex-demo`.
4. Mobile/phone capture submits event.
5. Compiler parses canonical observation.
6. Grounded cross-link appears with provenance.
7. Company Diff separates observed/recalled/derived/proposed.
8. Approval writes through QM to GBrain.
9. Fresh recall proves persistence.
