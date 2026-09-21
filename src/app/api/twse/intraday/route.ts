import type { NextRequest } from "next/server";
import { getTokenSession, unauthorized } from "@/lib/auth";

type YahooChart = {
  chart: {
    result:
      | {
          meta: { chartPreviousClose?: number; previousClose?: number; gmtoffset?: number };
          timestamp?: number[];
          indicators: { quote: { close: (number | null)[]; volume: (number | null)[] }[] };
        }[]
      | null;
  };
};

// 當日 5 分 K 走勢（Yahoo Finance chart API，非官方）。上市 .TW、上櫃 .TWO 都試，取有資料的那個
async function fetchIntraday(code: string) {
  for (const suffix of ["TW", "TWO"]) {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${code}.${suffix}?interval=5m&range=1d`,
      { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 30 } },
    );
    if (!res.ok) continue;
    const body: YahooChart = await res.json();
    const r = body.chart.result?.[0];
    if (!r?.timestamp) continue;

    const offset = r.meta.gmtoffset ?? 28800;
    const close = r.indicators.quote[0]?.close ?? [];
    const volume = r.indicators.quote[0]?.volume ?? [];
    const points = r.timestamp
      .map((t, i) => {
        // 換成台灣當地時間 HH:mm
        const d = new Date((t + offset) * 1000);
        const time = `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
        return { time, price: close[i] ?? null, volume: volume[i] ?? null };
      })
      .filter((p) => p.price !== null);
    return { prevClose: r.meta.chartPreviousClose ?? r.meta.previousClose ?? null, points };
  }
  return null;
}

export async function GET(request: NextRequest) {
  if (!(await getTokenSession())) return unauthorized();

  const code = request.nextUrl.searchParams.get("code") ?? "";
  if (!/^[0-9A-Za-z]{1,8}$/.test(code)) {
    return Response.json({ error: "股票代號格式錯誤" }, { status: 400 });
  }

  try {
    const data = await fetchIntraday(code);
    if (!data) return Response.json({ error: `查無 ${code} 的當日走勢` }, { status: 404 });
    return Response.json({ source: "Yahoo Finance", code, ...data });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "intraday request failed" }, { status: 502 });
  }
}
