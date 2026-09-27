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

PROMPT = """You compile one raw human observation into a typed organizational event.
Use only the observation text. Never invent names, values, or dates; use null when missing.
"requirement" is the missing capability as a short noun phrase of at most 4 words, e.g. "SAML", "audit logs", "SOC 2" — never a sentence.
Money: "$120K" -> 120000. Deadline: copy the phrase as spoken (e.g. "Friday"); never convert to a date.
Return ONLY one JSON object, no prose, with exactly these keys:
{"type": one of "customer.blocker"|"customer.request"|"product.bug"|"decision.changed"|"competitor.signal"|"operational.risk",
 "summary": string, "organization": string|null, "requirement": string|null, "opportunity_value_usd": number|null,
 "owner": string|null, "deadline_text": string|null, "urgency": "low"|"medium"|"high", "entities": [string],
 "claims": [{"subject": string, "predicate": string, "object": string|number|boolean, "confidence": number}],
 "unresolved": [string], "suggested_memory_queries": [2-4 short search queries linking this event to company memory]}

Observation: %s
JSON:"""

client = river.Client(api_key=os.environ["RIVER_API_KEY"])


def compile_text(text: str) -> dict:
    out = client.sample(PROMPT % json.dumps(text), base_model=MODEL, max_tokens=1200)[0].text
    out = re.sub(r"<think>.*?</think>", "", out, flags=re.S)
    # Decode only the first JSON object; models sometimes append extra text or objects.
    obj, _ = json.JSONDecoder().raw_decode(out[out.find("{") :])
    return obj


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self._send(200, {"ok": True, "model": MODEL})

    def do_POST(self):
        try:
            body = json.loads(self.rfile.read(int(self.headers.get("content-length", 0))))
            t0 = time.time()
            event = compile_text(body["text"])
            self._send(200, {"event": event, "model": MODEL, "ms": int((time.time() - t0) * 1000)})
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
