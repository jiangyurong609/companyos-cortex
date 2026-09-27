# API & Data Contracts

## Endpoints

### POST `/api/observations`
Create raw observation.

Request:

```json
{
  "modality": "text",
  "text": "I just talked to Acme...",
  "actor": "Yurong"
}
```

Response:

```json
{
  "observationId": "obs_...",
  "status": "accepted"
}
```

### GET `/api/events/:id`
Return compilation/resolution state.

### POST `/api/events/:id/compile`
Runs event compiler.

### POST `/api/events/:id/resolve`
Queries GBrain and creates resolved signal.

### POST `/api/events/:id/analyze`
Runs bounded parallel agents.

### GET `/api/events/:id/diff`
Returns Company Diff.

### POST `/api/diff/:rowId/accept`
Writes accepted fact/learning to GBrain.

### POST `/api/actions/:id/dispatch`
Optional Superset dispatch.

### GET `/api/stream`
SSE stream for mobile → desktop state updates.

## State machine

```text
CAPTURED
  ↓
COMPILED
  ↓
RESOLVING_MEMORY
  ↓
RESOLVED
  ↓
ANALYZING
  ↓
DIFF_READY
  ↓
PARTIALLY_ACCEPTED / ACCEPTED
  ↓
ACTION_DISPATCHED
  ↓
VERIFIED
```

Every state can fail explicitly:

```text
FAILED { stage, message, retryable }
```

## Core schemas

```ts
interface MemoryHit {
  id: string;
  title: string;
  snippet: string;
  source?: string;
  score?: number;
}

interface ProposedImplication {
  id: string;
  domain: 'sales' | 'product' | 'engineering' | 'company';
  statement: string;
  evidenceRefs: string[];
  confidence: number;
  requiresHumanApproval: true;
}

interface AgentResult {
  agent: 'revenue' | 'product' | 'engineering';
  findings: ProposedImplication[];
  unknowns: string[];
  requestedActions: ActionRequest[];
  evidenceRefs: string[];
}

interface ActionRequest {
  type: 'superset_task' | 'create_spec' | 'none';
  title: string;
  prompt: string;
  acceptanceCriteria: string[];
}
```

## Determinism requirements
For demo stability:
- temperature low for extraction
- strict JSON schemas
- validate all LLM responses with Zod
- retry malformed response once
- have a deterministic fixture path

## Trajectory log
Append each transition to:

```text
data/trajectories.jsonl
```

One line per event, updated by adding a new version rather than mutating old lines if convenient.
