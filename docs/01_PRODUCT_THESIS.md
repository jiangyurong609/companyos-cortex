# Product Thesis — CompanyOS Cortex

## Category
**Company world model + action loop**

Enterprise software mostly knows what employees manually enter. CompanyOS Cortex closes the gap between **what people learn** and **what company software knows**.

The product thesis is:

> Every important human observation can become a structured, source-backed state transition for the company.

Once company state is live, agents can reason about it, propose actions, execute bounded work, and learn from outcomes.

## The primitive: Reality Events
A Reality Event is a machine-readable representation of something that changed in the real company.

Examples:
- Customer says SAML is a blocker.
- Competitor ships a feature.
- CEO changes ICP.
- Employee records a product bug.
- Sales rep reports procurement risk.
- PM photographs a whiteboard decision.

Raw media is evidence. The event is the compiled semantic state transition.

## The wedge
The hackathon wedge is **customer signal → company reaction**.

A 20-second voice note:

> "I just talked to Acme. Security won't approve us without SAML. Sarah says it blocks a $120K deal this quarter. They need an answer by Friday."

becomes:

```yaml
type: customer.blocker
customer: Acme
owner: Sarah
requirement: SAML
revenue_at_risk_usd: 120000
deadline: Friday
confidence: high
```

GBrain then contributes existing company memory:
- other SAML requests
- deal owners
- roadmap context
- related decisions

The system produces a Company Diff and agent actions.

## Why this is not “AI notes”
AI notes summarize content.

Cortex changes the organization's computational state:

```text
observation → entities → relationships → state change → implications → action
```

The durable asset is the trajectory:

```text
STATE_t + OBSERVATION + ACTION + HUMAN DECISION → STATE_t+1 + OUTCOME
```

That eventually becomes training data for learning how organizations respond.

## Long-term product ladder

1. **System of Record** — capture what happened.
2. **System of Understanding** — connect observations across the organization.
3. **System of Decision** — surface implications and decisions.
4. **System of Action** — dispatch agents and workflows.
5. **System of Learning** — improve behavior from real outcomes.

## Product language
Use these words in the demo:
- Reality Event
- Company State
- Company Diff
- Evidence
- Implication
- Action
- Learning

Avoid:
- generic “RAG”
- generic “multi-agent”
- “chatbot”
- “AI dashboard”
- fake “prediction” language

## Main tagline options
Primary:

> **Your company is now a model.**

Alternative:

> **Turn reality into company state.**

Technical closing line:

> **Observe → Understand → Act → Learn.**
