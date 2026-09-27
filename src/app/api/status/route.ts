import { integrationStatus } from "@/lib/wiring";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(integrationStatus());
}
