# Post-Hackathon Roadmap — From Cortex to CompanyOS

## Week 1 — Reality Event layer
- durable event store
- voice/image/video ingestion
- entity resolution
- source/evidence model
- GBrain canonical-memory adapter
- approval workflow

## Week 2 — Company graph
Typed domains:
- people
- customers
- opportunities
- projects
- decisions
- risks
- metrics
- artifacts

Keep graph derived from evidence + accepted events, not unconstrained model output.

## Week 3 — Action layer
- coding actions
- CRM actions
- research actions
- document generation
- bounded approval policies

## Week 4 — Mobile-native edge
Reintroduce the fuller CompanyOS mobile experience:
- voice
- image
- video
- doodle
- offline queue
- background upload
- push decisions

## Month 2 — Decision timelines
For material decisions, fork proposed company state into alternative timelines:
- pricing
- product launch
- roadmap
- customer response

Do not present simulated outcomes as predictions without calibrated models and real data.

## Month 3 — Learning loop
Collect:

```text
state_t
observation
action proposal
human choice
execution result
state_t+1
later outcome
```

Use River to improve narrow policies where rewards can be measured reliably:
- routing
- triage
- agent selection
- action sequencing
- evidence retrieval

## Defensibility
The long-term data moat is not stored company facts alone.

It is the longitudinal trajectory dataset:

```text
what the company knew
→ what happened
→ what it did
→ what humans accepted
→ what happened next
```

That dataset can support increasingly capable organizational agents while preserving explicit human control over important decisions.
