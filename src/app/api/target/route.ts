import type { NextRequest } from "next/server";
import { getSession, unauthorized } from "@/lib/auth";
import { CODE_PATTERN, MAX_CODES } from "@/lib/mis";
import { getAnalystStats } from "@/lib/target-price";

// ?codes=2330,2317 → { stats: { "2330": { target, high, low, median, count, pe }, "2317": null } }
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const codes = (request.nextUrl.searchParams.get("codes") ?? "")
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter((c) => CODE_PATTERN.test(c))
    .slice(0, MAX_CODES);
  return Response.json({ stats: await getAnalystStats(codes) });
}
