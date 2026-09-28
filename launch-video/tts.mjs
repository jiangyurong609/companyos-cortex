// ElevenLabs voiceover: node tts.mjs <voiceId> <outDir>  (reads vo.tsv: at<TAB>budget<TAB>text)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
const [voice, dir] = process.argv.slice(2);
mkdirSync(dir, { recursive: true });
const rows = readFileSync("vo.tsv", "utf8").trim().split("\n").map((l) => l.split("\t"));
await Promise.all(rows.map(async ([, , text], i) => {
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({ text, model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.25 } }),
  });
  if (!r.ok) throw new Error(`${i + 1}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  writeFileSync(`${dir}/${i + 1}.mp3`, Buffer.from(await r.arrayBuffer()));
}));
console.log("ok", dir);
