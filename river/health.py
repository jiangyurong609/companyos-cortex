"""River health check: list capabilities and take one sample. Usage: uv run river/health.py"""
# /// script
# dependencies = ["river-client"]
# ///
import os
from contextlib import closing

import river_client as river

with closing(river.Client(api_key=os.environ["RIVER_API_KEY"])) as client:
    models = list(client.get_capabilities())
    print(f"River connected — {len(models)} base models:")
    for name in models:
        print(" -", name)
    model = os.environ.get("RIVER_MODEL") or models[0]
    out = client.sample("Reply with exactly: river ok", base_model=model, max_tokens=16)
    print(f"sample from {model}: {out[0].text!r}")
