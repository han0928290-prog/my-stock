import type { NextRequest } from "next/server";
import { getTokenSession, unauthorized } from "@/lib/auth";
import { CODE_PATTERN, fetchQuotes, MAX_CODES } from "@/lib/mis";

// ?codes=2330,2317 一次查多檔（只算 1 次請求）；?code=2330 查單檔
export async function GET(request: NextRequest) {
  if (!(await getTokenSession())) return unauthorized();

  const params = request.nextUrl.searchParams;
  const codes = (params.get("codes") ?? params.get("code") ?? "2330")
    .split(",")
    .map((c) => c.trim())
    .filter((c) => CODE_PATTERN.test(c))
    .slice(0, MAX_CODES);
  if (codes.length === 0) {
    return Response.json({ error: "缺少有效的股票代號" }, { status: 400 });
  }

  try {
    const quotes = await fetchQuotes(codes);

    if (params.has("codes")) {
      return Response.json({ source: "TWSE mis", quotes });
    }
    if (quotes.length === 0) {
      return Response.json({ error: `找不到股票代號 ${codes[0]}` }, { status: 404 });
    }
    return Response.json({ source: "TWSE mis", ...quotes[0] });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "TWSE mis request failed" },
      { status: 502 },
    );
  }
}
