# Test Plan & Exit Criteria

## P0 — must pass

### GBrain connectivity
- [ ] MCP client authenticates
- [ ] recall/search returns seeded data
- [ ] source/provenance displayed
- [ ] accepted memory can be written OR honest read-only fallback shown

### Capture
- [ ] phone-sized page loads
- [ ] observation submits
- [ ] desktop sees event without manual refresh, or with <2s polling

### Compiler
Run the canonical transcript 5 times:
- [ ] `Acme` always extracted
- [ ] `SAML` always extracted
- [ ] `$120K` always extracted as 120000
- [ ] deadline is captured without inventing an exact date
- [ ] malformed LLM output handled

### Resolution
- [ ] retrieves Ramp SAML memory
- [ ] retrieves Globex SAML memory
- [ ] retrieves enterprise/auth context
- [ ] arithmetic is deterministic and code-computed

### Company Diff
- [ ] no unsupported claim is presented as fact
- [ ] every row has evidence
- [ ] proposed priority change is clearly labeled proposal/review

### Writeback
- [ ] one click writes accepted learning to GBrain
- [ ] repeated click does not create uncontrolled duplicates
- [ ] final GBrain query can retrieve it

## P1 — valuable
- [ ] parallel agent calls finish under timeout
- [ ] Superset artifact created in isolated workspace
- [ ] Memorable stores/recalls one successful procedure

## P2 — stretch
- [ ] trajectory JSONL exported
- [ ] River client health check succeeds
- [ ] optional tiny River experiment demonstrated

## Failure behavior
Every external integration must surface one of:
- connected
- degraded
- unavailable

Never silently fake success.

## Demo readiness gate
Do not add features once all of the following are true:
- complete path succeeds 3 consecutive times
- cold refresh succeeds
- phone reconnect succeeds
- GBrain final retrieval succeeds
- backup video recorded

At that point, rehearse.
