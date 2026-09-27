# Mobile Capture Surface

## Goal
Make the demo feel like **reality entering the company**, not a desktop form.

## Rule constraint
Because no prebuilt project may be reused, create a new capture surface during the hackathon.

## Recommended implementation
Build a responsive PWA route:

```text
/capture
```

Open it from the user's phone using the local/tunnel URL.

This gives the visual power of “mobile CompanyOS” without spending the hackathon window on native build tooling.

## Screen

```text
┌───────────────────────────┐
│ CompanyOS        LIVE     │
│                           │
│ What just happened?       │
│                           │
│      (   ●   )            │
│       Hold to talk         │
│                           │
│ [Text] [Photo] [Voice]    │
│                           │
│            Send to Cortex │
└───────────────────────────┘
```

After send:

```text
Compiling reality…

✓ Acme
✓ SAML
✓ $120K opportunity
✓ deadline detected

Updating company understanding…
```

Do not show a wall of transcription.

## Desktop sync
The desktop command center should update immediately via:
- Server-Sent Events, or
- simple polling every 1 second if time is tight.

Reliability beats architectural purity.

## Voice strategy
P0: text entry that looks great on phone.
P1: browser speech recognition / recording + server transcription.

The demo script should work even if venue audio is noisy.

Always have a “Use demo transcript” button hidden behind a small overflow menu.
