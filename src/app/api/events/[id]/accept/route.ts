import { acceptEvent } from "@/lib/pipeline";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const body = (await req.json().catch(() => ({}))) as { note?: string };
  try {
    return Response.json(await acceptEvent((await params).id, typeof body.note === "string" ? body.note : undefined));
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 409 });
  }
}
