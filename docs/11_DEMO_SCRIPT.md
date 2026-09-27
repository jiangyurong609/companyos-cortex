# Judge Demo — 60 to 90 Seconds

## Opening — 8 seconds
> Companies have a memory gap. Your people know far more than your software knows. We built CompanyOS Cortex to turn what people experience into grounded company state.

## Capture — 12 seconds
On phone-sized `/capture`, submit:

> I just finished the Acme call. Their security team won't approve us without SAML. Sarah says it's blocking the $120K deal, and they need an answer Friday.

UI shows `Reality Event captured`.

## QM + GBrain — 20 seconds
Desktop shows:

```text
Running in QM project: cortex-demo
Grounding against GBrain...
```

Then reveal:

```text
OBSERVED
Acme -> blocked by SAML -> $120K

RECALLED FROM GBRAIN
Ramp -> SAML -> $140K
Globex -> SAML -> $80K

DERIVED
Related opportunities -> $340K
```

Narration:
> CompanyOS compiles the observation. QM runs the scoped agent turn, and GBrain gives that turn the company's durable memory. So this isn't a summary: it understands what changed relative to what the company already knew.

## Company Diff — 15 seconds
Reveal:

```diff
+ third enterprise SAML blocker
+ $120K newly connected opportunity
+ related opportunity context now totals $340K
◇ review SAML roadmap priority
```

Narration:
> Facts and recommendations are deliberately separated. The system can propose a state transition, but it doesn't silently rewrite company truth.

## Writeback — 15 seconds
Click **Accept into company memory**.

Show:

```text
QM -> GBrain remember
✓ persisted
```

Then fresh query:

> What do we know about Acme and SAML?

Show the newly persisted note.

## Close — 8 seconds
> CRM asks humans to maintain databases. CompanyOS observes what humans learn, QM turns it into scoped work, and GBrain makes the result durable. The company becomes observable, executable, and eventually learnable.

Final screen:

# COMPANYOS CORTEX
## Your company is now a model.
