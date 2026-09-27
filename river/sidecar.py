"""River sidecar: compiles an observation into RealityEvent JSON with a River-hosted model.

Usage: uv run river/sidecar.py   (listens on 127.0.0.1:8765, POST /compile {"text": ...})
"""
# /// script
# dependencies = ["river-client"]
# ///
import json
import os
import re
import time
from contextlib import closing
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import river_client as river

MODEL = os.environ.get("RIVER_MODEL", "Qwen/Qwen3.6-35B-A3B-FP8")
PORT = int(os.environ.get("RIVER_SIDECAR_PORT", "8765"))

PROMPT = """You compile raw human input (a sentence, call notes, a pasted Slack thread or transcript) into typed organizational events.
Extract EVERY distinct business signal (1 to 5): customer blockers, requests, churn risks, bugs, competitor mentions, decisions. One event per signal; do not merge different customers or different issues.
Use only the observation text. Never invent names, values, or dates; use null when missing.
"requirement" is the missing capability as a short noun phrase of at most 4 words, e.g. "SAML", "audit logs", "SOC 2" — never a sentence.
Money: "$120K" -> 120000. Deadline: copy the phrase as spoken (e.g. "Friday"); never convert to a date.
Return ONLY one JSON object, no prose: {"events": [EVENT, ...]} where each EVENT has exactly these keys:
{"type": one of "customer.blocker"|"customer.request"|"product.bug"|"decision.changed"|"competitor.signal"|"operational.risk",
 "summary": string, "organization": string|null, "requirement": string|null, "opportunity_value_usd": number|null,
 "owner": string|null, "deadline_text": string|null, "urgency": "low"|"medium"|"high", "entities": [string],
 "claims": [{"subject": string, "predicate": string, "object": string|number|boolean, "confidence": number}],
 "unresolved": [string], "suggested_memory_queries": [2-4 short search queries linking this event to company memory]}

Input: %s
JSON:"""

client = river.Client(api_key=os.environ["RIVER_API_KEY"])


def compile_text(text: str) -> dict:
    out = client.sample(PROMPT % json.dumps(text), base_model=MODEL, max_tokens=3000)[0].text
    out = re.sub(r"<think>.*?</think>", "", out, flags=re.S)
    # Decode only the first JSON object; models sometimes append extra text or objects.
    obj, _ = json.JSONDecoder().raw_decode(out[out.find("{") :])
    return obj if "events" in obj else {"events": [obj]}


TRIAGE = """You route information inside a company so nobody has to write status reports.
Decide who must see this item: "ceo" (strategic: cross-customer patterns, roadmap/priority questions, large revenue at stake)
or "manager" (the reporter's manager can handle it: single account, operational follow-up).
Learn this CEO's judgment from their past decisions below; weigh them heavily when they apply.

Past CEO decisions (most recent first):
%s

Item:
%s

Return ONLY one JSON object: {"route": "ceo"|"manager", "priority": "high"|"medium"|"low", "why": "<one sentence, cite the evidence or past decision you relied on>"}
JSON:"""


def triage(item: dict, past: list) -> dict:
    history = "\n".join(f"- {p.get('decision')}: {p.get('summary')}" for p in past[:12]) or "- (none yet)"
    out = client.sample(TRIAGE % (history, json.dumps(item)), base_model=MODEL, max_tokens=600)[0].text
    out = re.sub(r"<think>.*?</think>", "", out, flags=re.S)
    obj, _ = json.JSONDecoder().raw_decode(out[out.find("{") :])
    return obj


DIGEST = """You are the chief of staff writing the CEO's morning briefing. Nobody wrote a status report; you digest what people observed.
Items are already grounded against company memory ("evidence" = memory pages).

Write EXACTLY three sentences, plain executive English, no jargon, no page names or ids inside the text:
1. WHAT CHANGED: the most important new pattern, connecting related items and customers, with the dollar total if given.
2. WHAT NEEDS YOU: the one decision only the CEO can make, and the deadline if any.
3. ALREADY HANDLED: what was routed to managers, in one short clause each.
Use ONLY facts and dollar amounts present in the items. Put ids / evidence refs ONLY in "cites".

Example of the style (different company):
{"headline": "Audit logs now block three renewals", "sentences": [
 {"text": "Initech became the third customer this quarter to block on audit logs, joining Hooli and Umbrella — $260K of renewals now depend on it.", "cites": ["evt_1", "sales/hooli", "sales/umbrella"]},
 {"text": "You need to decide by end of month whether audit logs move into Q4.", "cites": ["evt_1"]},
 {"text": "Customer success is handling Initech's invoice issue and a pricing question from Hooli.", "cites": ["evt_2", "evt_3"]}]}

Items:
%s

Return ONLY one JSON object in that shape.
JSON:"""


DIGEST_MODEL = os.environ.get("RIVER_DIGEST_MODEL", MODEL)


def digest(items: list, model: str | None = None) -> dict:
    out = client.sample(DIGEST % json.dumps(items, indent=1), base_model=model or DIGEST_MODEL, max_tokens=4000)[0].text
    out = re.sub(r"<think>.*?</think>", "", out, flags=re.S)
    obj, _ = json.JSONDecoder().raw_decode(out[out.find("{") :])
    return obj


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self._send(200, {"ok": True, "model": MODEL})

    def do_POST(self):
        try:
            body = json.loads(self.rfile.read(int(self.headers.get("content-length", 0))))
            t0 = time.time()
            if self.path == "/digest":
                model = body.get("model") or DIGEST_MODEL
                self._send(200, {"digest": digest(body["items"], model), "model": model, "ms": int((time.time() - t0) * 1000)})
                return
            if self.path == "/triage":
                result = triage(body["item"], body.get("past", []))
                self._send(200, {"triage": result, "model": MODEL, "ms": int((time.time() - t0) * 1000)})
                return
            events = compile_text(body["text"])["events"]
            self._send(200, {"events": events, "model": MODEL, "ms": int((time.time() - t0) * 1000)})
        except Exception as err:  # surfaced to the caller, which falls back honestly
            self._send(502, {"error": str(err)[:500]})

    def _send(self, code, payload):
        data = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    print(f"River sidecar on 127.0.0.1:{PORT} using {MODEL}", flush=True)
    with closing(client):
        ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
