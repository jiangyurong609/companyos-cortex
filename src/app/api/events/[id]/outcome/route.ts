import { recordEventOutcome } from "@/lib/pipeline";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { result, note, source } = (await req.json().catch(() => ({}))) as { result?: string; note?: string; source?: string };
  if (result !== "worked" && result !== "didnt") return Response.json({ error: "result must be worked|didnt" }, { status: 400 });
  try {
    return Response.json(await recordEventOutcome((await params).id, result, note, source ?? "CEO"));
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 409 });
  }
}
