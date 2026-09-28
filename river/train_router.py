"""Fine-tune the company's own routing model on River from human-labeled decisions.

  uv run river/train_router.py            (reads data/river_sft.jsonl from POST /api/learn/export)

LoRA SFT on River (docs.river.ai/guides/sft): train on the same split the policy learner trains on,
evaluate base vs fine-tuned on held-out decisions, write data/river_router.json. The candidate model
only replaces the live router if it beats it on held-out decisions (promotion is a human decision).
"""
# /// script
# dependencies = ["river-client", "transformers"]
# ///
import hashlib
import json
import os
import re
import time

import river_client as river
from transformers import AutoTokenizer

BASE = os.environ.get("RIVER_TRAIN_MODEL", "Qwen/Qwen3.5-9B")
STEPS = int(os.environ.get("RIVER_TRAIN_STEPS", "12"))
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data", "river_sft.jsonl")
OUT = os.path.join(ROOT, "data", "river_router.json")

rows = [json.loads(l) for l in open(DATA) if l.strip()]
is_test = lambda r: int(hashlib.sha1(r["eventId"].encode()).hexdigest()[:6], 16) % 10 < 3  # same split as policy.ts
train = [r for r in rows if not is_test(r)]
test = [r for r in rows if is_test(r)]
print(f"{len(train)} train / {len(test)} held-out decisions, base {BASE}", flush=True)

tok = AutoTokenizer.from_pretrained(BASE)
EOS = tok.eos_token_id


def datum(prompt, completion):
    p = tok(prompt, add_special_tokens=False)["input_ids"]
    c = tok(completion, add_special_tokens=False)["input_ids"] + [EOS]
    ids = p + c
    return {"input_ids": ids, "target_tokens": ids[1:] + [EOS], "weights": [0.0] * (len(p) - 1) + [1.0] * (len(c) + 1)}


def route_of(text):
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.S)
    m = re.search(r'"route"\s*:\s*"(ceo|manager)"', text) or re.search(r"\b(ceo|manager)\b", text, re.I)
    return m.group(1).lower() if m else None


def evaluate(sample_fn, max_tokens):
    ok = 0
    for r in test:
        want = route_of(r["completion"])
        got = route_of(sample_fn(r["prompt"], max_tokens))
        ok += got == want
    return ok / max(1, len(test))


client = river.Client(api_key=os.environ["RIVER_API_KEY"])
batch = [datum(r["prompt"], r["completion"]) for r in train]
t0 = time.time()
with client.session(project="cortex-router") as session:
    base_sample = lambda p, n: session.sample(p, base_model=BASE, max_tokens=n, temperature=0.0)[0][0].text
    base_acc = evaluate(base_sample, 400)
    print(f"base model held-out accuracy: {base_acc:.0%}", flush=True)
    model = session.create_model(base_model=BASE, lora=river.LoraConfig(rank=8))
    losses = []
    for _ in range(STEPS):
        fb = model.forward_backward(batch, loss_fn="cross_entropy")
        model.optim_step(lr=2e-4, grad_clip_norm=1.0)
        losses.append(round(float(fb.metrics["loss"]), 4))
        print(f"step {model.step} loss {losses[-1]}", flush=True)
    ckpt = model.save_weights("cortex-router", mode="inference")
    tuned_sample = lambda p, n: session.sample(p, base_model=BASE, checkpoint=ckpt, max_tokens=n, temperature=0.0, stop=["\n"])[0][0].text
    tuned_acc = evaluate(tuned_sample, 24)
    print(f"fine-tuned held-out accuracy: {tuned_acc:.0%}", flush=True)

result = {
    "base_model": BASE,
    "checkpoint": str(getattr(ckpt, "path", None) or getattr(ckpt, "id", None) or ckpt),
    "steps": STEPS,
    "losses": losses,
    "train": len(train),
    "heldout": {"n": len(test), "base": base_acc, "tuned": tuned_acc},
    "minutes": round((time.time() - t0) / 60, 1),
    "at": time.strftime("%Y-%m-%dT%H:%M:%S"),
}
json.dump(result, open(OUT, "w"), indent=1)
print(json.dumps(result), flush=True)
