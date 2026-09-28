"""Mix a voiceover directory over the rendered video (music ducked). python3 mix.py <vo_dir> <out.mp4>"""
import subprocess, sys
vo, out = sys.argv[1:3]
rows = [l.rstrip("\n").split("\t") for l in open("vo.tsv") if l.strip()]
args = ["ffmpeg", "-loglevel", "error", "-y", "-i", "out/cortex-launch.mp4"]
f = ["[0:a]volume=0.30[m]"]; labels = ""
for i, (at, _budget, _text) in enumerate(rows, 1):
    args += ["-i", f"{vo}/{i}.mp3"]
    ms = int(float(at) * 1000)
    f.append(f"[{i}:a]adelay={ms}|{ms},volume=1.5[v{i}]"); labels += f"[v{i}]"
f.append(f"[m]{labels}amix=inputs={len(rows)+1}:normalize=0:duration=first,alimiter=limit=0.95[a]")
args += ["-filter_complex", ";".join(f), "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", out]
subprocess.run(args, check=True)
print("wrote", out)
