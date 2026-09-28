#!/usr/bin/env python3
"""Record the /learn clip: proposed policy change → human merge → River company model. Appends to markers.json."""
import json, os, shutil, subprocess, time
from playwright.sync_api import sync_playwright

APP = os.environ.get("APP", "http://localhost:3100")
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "public", "clips")
RAW = os.path.join(HERE, "raw-learn")
LAG = float(os.environ.get("VIDEO_LAG", "5.5"))
shutil.rmtree(RAW, ignore_errors=True); os.makedirs(RAW)
marks = {}
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1920, "height": 1080}, record_video_dir=RAW, record_video_size={"width": 1920, "height": 1080})
    pg = ctx.new_page(); t0 = time.time(); vid = pg.video.path()
    mk = lambda n: marks.__setitem__(n, round(time.time() - t0, 2))
    pg.goto(APP + "/learn"); pg.wait_for_selector("text=PROPOSED CHANGE"); pg.wait_for_timeout(2500); mk("loaded")
    pg.mouse.move(900, 500, steps=30); pg.wait_for_timeout(1200)
    pg.mouse.wheel(0, 260); pg.wait_for_timeout(2500); mk("proposal")
    btn = pg.get_by_role("button", name="Merge into company policy")
    btn.scroll_into_view_if_needed(); pg.wait_for_timeout(1000)
    box = btn.bounding_box(); pg.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2, steps=25); pg.wait_for_timeout(700)
    btn.click(); mk("merge_click")
    pg.wait_for_selector("text=is live", timeout=60000); mk("merged"); pg.wait_for_timeout(2500)
    pg.get_by_text("RIVER LoRA").scroll_into_view_if_needed(); pg.wait_for_timeout(600); mk("river")
    rb = pg.get_by_text("Held-out routing accuracy").bounding_box()
    pg.mouse.move(rb["x"] + 200, rb["y"] + 10, steps=30); pg.wait_for_timeout(4500); mk("end")
    ctx.close(); b.close()
dst = os.path.join(OUT, "learn.mp4")
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", vid, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-an", dst], check=True)
dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", dst], capture_output=True, text=True).stdout)
m = json.load(open(os.path.join(OUT, "markers.json")))
m["learn"] = {"durationSec": round(dur, 2), "marks": {k: round(min(v + LAG, dur - 0.5), 2) for k, v in marks.items()}}
json.dump(m, open(os.path.join(OUT, "markers.json"), "w"), indent=1)
print("learn.mp4", round(dur, 1), "s", m["learn"]["marks"])
