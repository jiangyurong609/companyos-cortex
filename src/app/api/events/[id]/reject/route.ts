import { rejectEvent } from "@/lib/pipeline";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    return Response.json(rejectEvent((await params).id));
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 404 });
  }
}
