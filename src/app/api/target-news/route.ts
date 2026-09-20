import type { NextRequest } from "next/server";
import { getSession, unauthorized } from "@/lib/auth";
import { CODE_PATTERN } from "@/lib/mis";
import { getBrokerTargets } from "@/lib/target-news";

// ?code=2330 → { brokers: [{ institution, target, date, title, link }] }
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const code = (request.nextUrl.searchParams.get("code") ?? "").trim().toUpperCase();
  if (!CODE_PATTERN.test(code)) {
    return Response.json({ error: "股票代號格式錯誤" }, { status: 400 });
  }
  return Response.json({ brokers: await getBrokerTargets(code) });
}
