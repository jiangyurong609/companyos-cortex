import { rerouteEvent } from "@/lib/pipeline";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { route, by } = (await req.json().catch(() => ({}))) as { route?: string; by?: string };
  if ((route !== "ceo" && route !== "manager") || (by !== "ceo" && by !== "manager"))
    return Response.json({ error: "route and by must be ceo|manager" }, { status: 400 });
  try {
    return Response.json(rerouteEvent((await params).id, route, by));
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 409 });
  }
}
