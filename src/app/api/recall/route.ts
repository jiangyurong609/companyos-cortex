import { getRuntime } from "@/lib/wiring";

export async function POST(req: Request) {
  const { query } = (await req.json().catch(() => ({}))) as { query?: string };
  if (!query) return Response.json({ error: "query required" }, { status: 400 });
  const runtime = getRuntime();
  try {
    const { hits, log } = await runtime.recall(query);
    return Response.json({ via: runtime.via, hits, log });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 502 });
  }
}
