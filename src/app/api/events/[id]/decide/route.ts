import { decideEvent } from "@/lib/pipeline";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { proposal } = (await req.json().catch(() => ({}))) as { proposal?: string };
  if (!proposal) return Response.json({ error: "proposal required" }, { status: 400 });
  try {
    return Response.json(await decideEvent((await params).id, proposal));
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 409 });
  }
}
