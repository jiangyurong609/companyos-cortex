import { merge } from "@/lib/learning/policy";

export async function POST(req: Request) {
  const { proposalId } = (await req.json().catch(() => ({}))) as { proposalId?: string };
  if (!proposalId) return Response.json({ error: "proposalId required" }, { status: 400 });
  try {
    return Response.json(await merge(proposalId, "CEO"));
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 409 });
  }
}
