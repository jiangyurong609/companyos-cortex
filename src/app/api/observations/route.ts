import { createObservation } from "@/lib/pipeline";
import { ObservationInput } from "@/lib/schemas";

export async function POST(req: Request) {
  const parsed = ObservationInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues }, { status: 400 });
  const rec = createObservation(parsed.data);
  return Response.json({ observationId: rec.id, status: "accepted" }, { status: 202 });
}
