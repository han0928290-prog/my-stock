import type { NextRequest } from "next/server";
import { getTokenSession, unauthorized } from "@/lib/auth";
import { getChips } from "@/lib/chips";

export async function GET(request: NextRequest) {
  if (!(await getTokenSession())) return unauthorized();

  const params = request.nextUrl.searchParams;
  const code = params.get("code") ?? "2330";
  const days = Math.min(Math.max(Number(params.get("days")) || 45, 1), 365);

  try {
    const data = await getChips(code, days);
    return Response.json({ source: "FinMind", code, data });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "FinMind request failed" },
      { status: 502 },
    );
  }
}
