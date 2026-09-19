import type { NextRequest } from "next/server";
import { getTokenSession, unauthorized } from "@/lib/auth";
import { fetchNews } from "@/lib/news";

export async function GET(request: NextRequest) {
  if (!(await getTokenSession())) return unauthorized();

  const code = request.nextUrl.searchParams.get("code") ?? "2330";
  if (!/^[0-9A-Za-z]{1,8}$/.test(code)) {
    return Response.json({ error: "股票代號格式錯誤" }, { status: 400 });
  }

  try {
    const items = await fetchNews(code);
    return Response.json({ source: "Yahoo奇摩股市 RSS", code, items });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Yahoo RSS request failed" },
      { status: 502 },
    );
  }
}
