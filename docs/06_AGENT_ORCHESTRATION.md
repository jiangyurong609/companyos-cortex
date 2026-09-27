# Agent Orchestration — QM First

## Principle
**QM is the orchestration harness for the P0 demo.** Do not build a second agent framework inside CompanyOS. The minimum path uses one bounded QM project-scoped resolver turn plus one approval/write turn. Specialized parallel workers are a post-P0 stretch, not a requirement.

Each receives:
- the Reality Event
- only the GBrain evidence relevant to its mandate
- an explicit output schema
- a hard tool/time budget

## Recommended workers

### Revenue Agent
Question:
> What customer/revenue context is relevant, based only on provided evidence?

Output:
- impacted opportunities
- owners
- deadlines
- direct evidence
- unknowns

### Product Agent
Question:
> What product/roadmap implications should be proposed, not asserted?

Output:
- related requests
- current roadmap facts
- proposed decision to review
- contradictions

### Engineering Agent
Question:
> What concrete bounded artifact would reduce uncertainty fastest?

Output:
- feasibility task
- files/areas to inspect
- acceptance criteria
- optional Superset dispatch request

## Superset integration
Superset's documented model is isolated git worktrees and parallel coding-agent workspaces. Its orchestration skill can create a workspace per worker, launch agents, monitor them, and return structured completion/blocked results.

Use it only for **real artifact work**. Example:

> Inspect a tiny demo auth repo and produce `docs/saml-feasibility.md` containing architecture options, touched areas, and verification commands. Do not implement production SAML.

This gives the audience a concrete action artifact without overreaching.

## Memorable integration
Memorable is procedural memory. Keep the semantic distinction clean:

- **GBrain:** what the company knows
- **Memorable:** how a successful task was performed

After a successful engineering feasibility task, store/extract a procedure like:

```text
Procedure: Investigate enterprise auth requirement
1. recall customer evidence
2. inspect current auth architecture
3. identify integration boundaries
4. produce bounded feasibility artifact
5. verify artifact references evidence
```

Do not spend >15 minutes debugging Memorable. If it works, show the stored procedure after the demo loop.

## River integration
River supports SFT/RL/distillation and allows your code to control the training loop while River handles sampling/training.

Today, the highest-value River work is to create a **training-ready trajectory schema**:

```json
{
  "state": {...},
  "observation": {...},
  "context_refs": [...],
  "agent_outputs": [...],
  "human_decision": "accept|edit|reject|dispatch",
  "verification": {...},
  "reward": null
}
```

Future reward signals:
- did human accept the proposed implication?
- did generated artifact pass verification?
- did action resolve the blocker?
- did later company state confirm or contradict the hypothesis?

Stretch goal: use River for a tiny judgeable classifier/ranker only if the full GBrain loop is already stable.

## QM / UFO
QM is a **P0 dependency**. Use the `cortex-demo` project scope for grounding and accepted writes to GBrain. See `15_QM_INTEGRATION.md`.

UFO remains optional and should not be attempted until the complete QM + GBrain loop is stable.
