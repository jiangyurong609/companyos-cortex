# Reality Event Compiler

## Purpose
Compile messy human input into a typed, evidence-backed organizational event.

## Input

```ts
interface RawObservation {
  id: string;
  createdAt: string;
  actor?: string;
  modality: 'text' | 'voice' | 'image';
  text?: string;
  mediaRef?: string;
}
```

For the hackathon, voice may be transcribed by browser/platform service or a simple speech-to-text API. The architecture must not depend on voice; text fallback is mandatory.

## Output

```ts
type RealityEventType =
  | 'customer.blocker'
  | 'customer.request'
  | 'product.bug'
  | 'decision.changed'
  | 'competitor.signal'
  | 'operational.risk';

interface RealityEvent {
  id: string;
  type: RealityEventType;
  summary: string;
  entities: EntityRef[];
  claims: Claim[];
  evidence: EvidenceRef[];
  urgency?: 'low' | 'medium' | 'high';
  confidence: number;
  unresolved: string[];
  suggestedMemoryQueries: string[];
}

interface Claim {
  subject: string;
  predicate: string;
  object: string | number | boolean;
  confidence: number;
  evidenceRef: string;
}
```

## Compiler prompt contract
The compiler must:
1. use only the observation text for extraction
2. never invent missing names/values
3. mark ambiguity in `unresolved`
4. emit 2–4 GBrain queries likely to link the event to existing company memory
5. distinguish direct statements from inferred implications

### Example
Input:

> I just talked to Acme. Security won't approve us without SAML. Sarah says it blocks the $120K deal this quarter. They need an answer by Friday.

Output shape:

```json
{
  "type": "customer.blocker",
  "summary": "Acme reports SAML as a security approval blocker for a $120K opportunity.",
  "entities": ["Acme", "Sarah", "SAML"],
  "claims": [
    {"subject":"Acme","predicate":"blocked_by","object":"SAML"},
    {"subject":"Acme opportunity","predicate":"value_usd","object":120000},
    {"subject":"Acme","predicate":"response_deadline","object":"Friday"}
  ],
  "unresolved": ["Exact calendar date for Friday"],
  "suggestedMemoryQueries": [
    "Acme opportunity Sarah $120K",
    "SAML enterprise requests",
    "enterprise authentication roadmap"
  ]
}
```

## Resolver logic
Merge event claims with GBrain hits into:

```ts
interface ResolvedSignal {
  event: RealityEvent;
  corroboration: MemoryHit[];
  contradictions: Conflict[];
  linkedEntities: LinkedEntity[];
  implications: ProposedImplication[];
}
```

No implication becomes canonical memory without approval.

## Company Diff generation
Generate diff rows:

```ts
interface CompanyDiffRow {
  kind: 'add' | 'update' | 'conflict' | 'action';
  domain: 'sales' | 'product' | 'engineering' | 'company';
  title: string;
  before?: string;
  after?: string;
  evidenceRefs: string[];
  confidence: number;
}
```

Example:

```text
ADD       sales        Acme SAML blocker — $120K
ADD       sales        Related SAML opportunities total $340K
UPDATE    product      SAML priority: review recommended
ACTION    engineering  Estimate SAML implementation path
```

Avoid claiming “P1” unless the user explicitly accepts the priority change.
