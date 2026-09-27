import { events } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const rec = events.get((await params).id);
  return rec ? Response.json(rec) : Response.json({ error: "not found" }, { status: 404 });
}
