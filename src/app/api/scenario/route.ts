import { startWorkday } from "@/lib/scenario";

export async function POST(req: Request) {
  const { gapMs } = (await req.json().catch(() => ({}))) as { gapMs?: number };
  return Response.json(startWorkday(typeof gapMs === "number" ? Math.max(1000, gapMs) : undefined));
}
