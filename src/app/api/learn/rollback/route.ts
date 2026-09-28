import { rollback } from "@/lib/learning/policy";

export async function POST() {
  try {
    return Response.json(await rollback("CEO"));
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 409 });
  }
}
