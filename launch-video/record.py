#!/usr/bin/env python3
"""Record real footage of the running Cortex app for the launch video.

One scripted live session (headless Chromium, isolated profile): Sarah captures on the phone,
the workday replays on /exec, the CEO approves on /brief, QM drafts the plan. Writes H.264 clips
and markers.json (timestamps of key moments) to public/clips/.

Requires: the app on :3100 (fresh state), QM, the River sidecar; playwright + ffmpeg.
"""
import json
import os
import shutil
import subprocess
import time
import urllib.request

from playwright.sync_api import sync_playwright

APP = os.environ.get("APP", "http://localhost:3100")
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "public", "clips")
RAW = os.path.join(HERE, "raw")
os.makedirs(OUT, exist_ok=True)
shutil.rmtree(RAW, ignore_errors=True)
os.makedirs(RAW, exist_ok=True)

SENTENCE = ("I just finished the Acme call. Their security team won't approve us without SAML. "
            "Sarah says it's blocking the $120K deal, and they need an answer Friday.")


def api(path):
    with urllib.request.urlopen(APP + path) as r:
        return json.loads(r.read())


def wait_for(pred, timeout, every=2.0):
    end = time.time() + timeout
    while time.time() < end:
        if pred():
            return True
        time.sleep(every)
    return False


def glide(pg, x, y, steps=25):
    pg.mouse.move(x, y, steps=steps)


def click_el(pg, loc, pause=600):
    box = loc.bounding_box()
    cx, cy = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
    glide(pg, cx, cy)
    pg.wait_for_timeout(pause)
    loc.click()
    return cx, cy


def to_mp4(src, dst, start=None, end=None, vf=None):
    args = ["ffmpeg", "-y", "-loglevel", "error"]
    if start is not None:
        args += ["-ss", f"{max(0, start):.2f}"]
    args += ["-i", src]
    if end is not None:
        args += ["-t", f"{end - max(0, start or 0):.2f}"]
    if vf:
        args += ["-vf", vf]
    args += ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "18", "-an", dst]
    subprocess.run(args, check=True)


marks = {}
T0 = {}


def mark(clip, name, t0):
    marks.setdefault(clip, {})[name] = round(time.time() - t0, 2)
    print(f"  mark {clip}.{name} = {marks[clip][name]}s", flush=True)


with sync_playwright() as p:
    browser = p.chromium.launch()
    desk = dict(viewport={"width": 1920, "height": 1080}, record_video_dir=RAW, record_video_size={"width": 1920, "height": 1080})

    # --- desktop contexts start recording now: exec + brief run for the whole session
    exec_ctx = browser.new_context(**desk)
    exec_pg = exec_ctx.new_page(); T0["exec"] = time.time(); VID = {"exec": exec_pg.video.path()}
    exec_pg.goto(APP + "/exec")
    brief_ctx = browser.new_context(**desk)
    brief_pg = brief_ctx.new_page(); T0["brief"] = time.time(); VID["brief"] = brief_pg.video.path()
    brief_pg.goto(APP + "/brief")
    exec_pg.wait_for_timeout(4000)

    # --- phone: Sarah says one sentence
    print("phone capture…", flush=True)
    phone_ctx = browser.new_context(viewport={"width": 430, "height": 932}, device_scale_factor=2, is_mobile=True, has_touch=True,
                                    record_video_dir=RAW, record_video_size={"width": 860, "height": 1864})
    phone = phone_ctx.new_page(); T0["phone"] = time.time(); VID["phone"] = phone.video.path()
    phone.goto(APP + "/capture")
    phone.wait_for_timeout(1500)
    phone.get_by_role("button", name="Sarah").first.tap()
    phone.wait_for_timeout(700)
    phone.locator("textarea").tap()
    phone.keyboard.type(SENTENCE, delay=28)
    phone.wait_for_timeout(800)
    phone.get_by_role("button", name="Send to Cortex").tap()
    mark("phone", "sent", T0["phone"])
    mark("exec", "phone_sent", T0["exec"])

    # --- start the workday from the dashboard (a real click)
    exec_pg.wait_for_timeout(2500)
    click_el(exec_pg, exec_pg.get_by_role("button", name="▶ Start the workday"))
    mark("exec", "workday_start", T0["exec"])

    def signals():
        return api("/api/events")["events"]

    wait_for(lambda: any(e.get("event") for e in signals()), 120)
    mark("exec", "first_signal", T0["exec"])
    phone_ok = wait_for(lambda: any(e.get("triage") and e["observation"].get("source") == "phone" for e in signals()), 240)
    mark("phone", "routed", T0["phone"])
    phone.wait_for_timeout(3000)
    phone_ctx.close()  # finalizes phone video

    def all_triaged():
        ev = signals()
        return len({e["observation"]["id"] for e in ev}) >= 7 and all(e.get("triage") or e["stage"] == "FAILED" for e in ev)

    wait_for(all_triaged, 600, 4)
    mark("exec", "all_triaged", T0["exec"])
    mark("brief", "digest_ready", T0["brief"])
    exec_pg.wait_for_timeout(4000)
    # gentle hover over the charts for life
    for x, y in ((600, 520), (1200, 560), (900, 800)):
        glide(exec_pg, x, y, 40); exec_pg.wait_for_timeout(900)
    mark("exec", "end", T0["exec"])

    # --- CEO briefing: read, then approve
    brief_pg.wait_for_timeout(3000)
    glide(brief_pg, 700, 300, 40); brief_pg.wait_for_timeout(1500)
    brief_pg.mouse.wheel(0, 380); brief_pg.wait_for_timeout(2500)
    approve = brief_pg.get_by_role("button", name="Approve:").first
    approve.scroll_into_view_if_needed(); brief_pg.wait_for_timeout(1200)
    cx, cy = click_el(brief_pg, approve, 900)
    mark("brief", "approve_click", T0["brief"])
    marks["brief"]["approve_xy"] = [round(cx), round(cy)]
    wait_for(lambda: any(e.get("decision") for e in signals()), 240)
    mark("brief", "decision_written", T0["brief"])
    wait_for(lambda: any((e.get("action") or {}).get("status") in ("ready", "failed") for e in signals()), 300)
    mark("brief", "plan_ready", T0["brief"])
    brief_pg.wait_for_timeout(1500)
    brief_pg.mouse.wheel(0, 500); brief_pg.wait_for_timeout(4000)
    mark("brief", "end", T0["brief"])
    exec_ctx.close(); brief_ctx.close()

    # --- manager view
    team_ctx = browser.new_context(**desk); tp = team_ctx.new_page(); T0["team"] = time.time(); VID["team"] = tp.video.path()
    tp.goto(APP + "/team/customer-success"); tp.wait_for_timeout(2500)
    glide(tp, 900, 400, 40); tp.mouse.wheel(0, 400); tp.wait_for_timeout(3500); tp.mouse.wheel(0, -400); tp.wait_for_timeout(2500)
    team_ctx.close()

    # --- evidence view: expand recalled facts to their GBrain quotes
    ev_ctx = browser.new_context(**desk); ep = ev_ctx.new_page(); T0["evidence"] = time.time(); VID["evidence"] = ep.video.path()
    ep.goto(APP + "/command"); ep.wait_for_timeout(2500)
    rows = ep.locator("li button[aria-expanded]")
    for i in range(min(3, rows.count())):
        try:
            rows.nth(i + 1).scroll_into_view_if_needed(); click_el(ep, rows.nth(i + 1), 500); ep.wait_for_timeout(1600)
        except Exception as err:  # keep recording even if a row is missing
            print("evidence row skipped:", err)
    ep.wait_for_timeout(2000)
    ev_ctx.close()
    browser.close()

# --- cut clips + markers.json (marks are seconds from each output clip's start)
def dur(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path], capture_output=True, text=True)
    return float(out.stdout.strip() or 0)

json.dump({"marks": marks, "videos": VID}, open(os.path.join(RAW, "session.json"), "w"), indent=1)
B = marks["brief"]
clips = {
    "phone-capture": (VID["phone"], None, None, marks["phone"]),
    "exec-workday": (VID["exec"], None, None, marks["exec"]),
    "brief-digest": (VID["brief"], B["digest_ready"], B["approve_click"] - 0.5, {"digest_ready": 0.0}),
    "brief-approve": (VID["brief"], B["approve_click"] - 3, None,
                      {k: round(v - (B["approve_click"] - 3), 2) for k, v in B.items() if isinstance(v, (int, float)) and v >= B["approve_click"] - 3}),
    "team": (VID["team"], None, None, {}),
    "evidence": (VID["evidence"], None, None, {}),
}
# Headless video frames trail wall-clock marks (~5.5s measured); the phone page renders into the
# top-left quarter of its 2x video frame, so crop + upscale it.
LAG = float(os.environ.get("VIDEO_LAG", "5.5"))
PHONE_VF = "crop=iw/2:ih/2:0:0,scale=860:1864:flags=lanczos"
manifest = {}
for name, (src, start, end, mk) in clips.items():
    dst = os.path.join(OUT, f"{name}.mp4")
    to_mp4(src, dst, start, end, PHONE_VF if name == "phone-capture" else None)
    d = round(dur(dst), 2)
    shifted = mk if name == "brief-digest" else {k: round(min(v + LAG, d - 0.5), 2) for k, v in mk.items()}
    manifest[name] = {"durationSec": d, "marks": shifted}
    print(f"{name}: {manifest[name]['durationSec']}s", flush=True)
manifest["brief-approve"]["approveXY"] = B.get("approve_xy")
json.dump(manifest, open(os.path.join(OUT, "markers.json"), "w"), indent=1)
print("wrote", os.path.join(OUT, "markers.json"))
