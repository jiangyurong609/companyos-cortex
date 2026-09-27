# Failure Fallbacks — Demo Insurance

## Venue internet is bad
- keep fixture observation locally
- keep last successful GBrain hits cached **but label them cached**
- attempt one fresh recall before demo
- have a 30–45s backup recording of a successful run

## Voice fails
Switch to text instantly.
Use a large “Use demo transcript” action.

## GBrain read fails during live demo
Do not fake it.
Say:
> “The live memory connection dropped; here is the last successful sourced response from this run.”
Then continue the state/diff UX only if it is clearly labeled cached.

## GBrain write fails
Show the exact proposed memory write and error state.
Do not show a fake “saved” toast.

## LLM extraction is unstable
- temperature low
- Zod schema
- retry once
- deterministic prevalidated transcript fallback

## Agent fan-out takes too long
Render workers independently as each completes.
At 12 seconds, allow “continue with available analyses.”

## Superset unavailable
Create the exact same bounded artifact locally through the main coding agent and label it `local action runner`.
The core hack remains GBrain-native.

## Memorable unavailable
Hide the Memorable panel entirely.
Do not mention it in the 60-second demo.

## River unavailable
Show trajectory export only and explain it is River-ready, not trained.

## Avoid demo-killing complexity
Never depend on:
- microphone permission being granted live
- native iOS signing
- external customer systems
- production OAuth integrations
- multiple sponsor APIs all being healthy
