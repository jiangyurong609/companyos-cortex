import { currentDigest } from "@/lib/digest";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(currentDigest());
}
