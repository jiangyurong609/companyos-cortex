# Hackathon Rules & Compliance

## Rules visible at the event
- Build something using **GBrain**.
- **No prebuilt projects / forks of existing projects**.
- Must build during **hackathon hours**.
- Goal: extend QM/GBrain and push further with River AI, Memorable, Superset, UFO.
- “This isn't a pitch competition.”

## Compliance strategy

### New repo only
Create a completely new repository during hackathon hours.

Suggested repo:

```text
companyos-cortex-hack
```

Record the first commit timestamp.

### Do not copy prior CompanyOS source
Prior CompanyOS work may inform architecture, product intuition, language, and demo domain. Do **not** copy:
- source files
- components
- assets
- backend code
- schemas
- prompts
- tests

Reimplement only the minimal new surface required for this demo.

### GBrain must be structurally required
The build should fail to deliver its core value without GBrain.

GBrain responsibilities:
1. canonical accepted company memory
2. recall/search of related historical facts
3. provenance-bearing context
4. durable persistence of approved new learnings

Do not use GBrain only as a decorative sponsor check-box.

### Sponsor usage priority

**P0 — GBrain:** mandatory and demo-visible.

**P1 — Superset:** useful if ready; real parallel code/artifact execution is highly visual.

**P1 — Memorable:** valuable if setup works; use for procedural memory, not factual memory.

**P2 — River:** record training-ready traces now; actual RL update only if core demo is stable.

**P2 — QM:** use if it provides orchestration primitives immediately; do not lose the build window integrating it deeply.

**P2 — UFO:** only if computer-use action adds a visible payoff.

## Judging-safe claim boundaries
Do not claim:
- guaranteed revenue impact
- accurate simulation of business outcomes
- autonomous replacement of executives
- production-ready security

Do claim, if demonstrated:
- live GBrain grounding
- durable memory writeback
- traceable evidence
- parallel agent analysis
- bounded artifact creation
- human-approved state transition

## Required evidence before submission
Capture screenshots/video of:
1. new repo first commit
2. working GBrain client connection
3. GBrain recall result
4. GBrain remember/write result
5. complete demo loop

Keep a `BUILD_LOG.md` in the repo with timestamps and integration notes.

## v2 stack compliance decision
Although the visible guidance requires GBrain and encourages extending both QM and GBrain, this package intentionally makes **both QM and GBrain live P0 dependencies**. This produces a stronger submission than simply satisfying the minimum GBrain requirement:

- CompanyOS does not reimplement agent orchestration; QM is the scoped execution harness.
- CompanyOS does not reimplement durable organizational memory; GBrain is the canonical memory system.
- The net-new work is the Reality Event compiler, grounded state-transition model, Company Diff, and mobile-to-company interaction design.
