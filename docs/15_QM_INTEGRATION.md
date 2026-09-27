# QM Integration — P0 Requirement

## Product role
QM is the **execution harness** for CompanyOS Cortex. The custom UI senses reality; QM turns a Reality Event into scoped agent work; GBrain is the memory provider/tool exposed to that work.

QM's documented model maps well to the demo:
- project scopes provide a durable shared work context
- each scope has its own identity/data/permissions/computer
- MCP connectors can be registered as shared service integrations
- sandboxes give scoped command/file execution
- Codex / Claude Code / OpenCode / Pi can drive the same core

## P0 target
Use **one QM project scope** named `cortex-demo`.

The minimum proof is:
1. a Reality Event reaches a QM turn in `cortex-demo`
2. that QM turn can call GBrain MCP tools
3. structured grounded output is returned to CompanyOS
4. a follow-up approved turn can call GBrain `remember`

Everything else is optional.

## Setup fast path
If no event-provided QM instance is available, use the documented deployment path from a fresh repo:

```bash
npm exec --yes --package=@yc-software/qm@latest -- \
  qm init . --org cortex-demo --target <fly-or-aws>
npm install
npm exec qm -- check
npm exec qm -- doctor
npm exec qm -- plan
npm exec qm -- up --yes
npm exec qm -- check --live
```

Do not spend the whole hackathon deploying QM if hosts/credentials block progress. If organizers provide a running QM environment, use it.

## GBrain through QM
Register the GBrain MCP server for the scope/deployment:

```text
https://gbrain.io/mcp
```

Give the QM agent only the GBrain permissions needed for the demo. Prefer Full memory permission only if writeback is required.

## Turn contract: ground event
System instruction for the QM agent:

```text
You are CompanyOS Cortex's grounded resolver.
You are operating in project scope cortex-demo.
Use GBrain memory tools to verify and contextualize the supplied RealityEvent.
Do not invent company facts.
Return only the requested GroundedResolution JSON.
Separate observed, recalled, derived-candidate, and proposed claims.
For every recalled fact include its GBrain source/provenance reference.
Never write to memory in this turn.
```

Input payload:

```json
{
  "event": {
    "type": "customer_blocker",
    "organization": "Acme",
    "requirement": "SAML",
    "opportunity_value": 120000,
    "owner": "Sarah",
    "deadline_text": "Friday"
  },
  "queries": [
    "SAML enterprise customer requests",
    "Acme opportunity value owner",
    "enterprise authentication roadmap"
  ]
}
```

Expected output:

```json
{
  "recalled": [],
  "contradictions": [],
  "missing": [],
  "proposals": [],
  "source_refs": []
}
```

The backend computes totals such as `$340K` itself from grounded values.

## Turn contract: accepted write
Second QM turn occurs only after user approval:

```text
The user has approved this CompanyOS state transition.
Write exactly the approved factual note to GBrain memory.
Preserve source event id and timestamp.
Do not write proposed roadmap recommendations as facts.
Return the GBrain write result/reference.
```

## Optional QM sandbox action
Only after the memory loop is reliable:

```text
Create docs/saml-feasibility.md in this project scope.
Do not implement SAML.
Summarize likely integration boundaries, open questions, and a verification checklist.
Ground any company-specific statements in supplied GBrain evidence.
```

The artifact makes QM's durable computer tangible without risking the core demo.

## Failure budget
- QM deployment/setup: 20 minutes max if environment is not already ready
- GBrain connector to QM: 15 minutes max
- structured turn: 20 minutes max

If the provided QM environment is unavailable, be transparent in the demo and retain the real GBrain loop; do not fabricate QM calls. But the intended submission path has both live.
