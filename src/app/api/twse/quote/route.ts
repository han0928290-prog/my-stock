import type { NextRequest } from "next/server";
import { getTokenSession, unauthorized } from "@/lib/auth";

const TWSE_URL = "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL";

type TwseDayRow = {
  Date: string;
  Code: string;
  Name: string;
  TradeVolume: string;
  OpeningPrice: string;
  HighestPrice: string;
  LowestPrice: string;
  ClosingPrice: string;
  Change: string;
};

// 民國年 1150918 -> 2026-09-18
function rocToIso(roc: string) {
  const year = Number(roc.slice(0, roc.length - 4)) + 1911;
  return `${year}-${roc.slice(-4, -2)}-${roc.slice(-2)}`;
}

const num = (s: string) => {
  const n = parseFloat(s.replace(/,/g, ""));
  return Number.isNaN(n) ? null : n;
};

export async function GET(request: NextRequest) {
  if (!(await getTokenSession())) return unauthorized();

  const code = request.nextUrl.searchParams.get("code") ?? "2330";

  try {
    const res = await fetch(TWSE_URL, { next: { revalidate: 60 } });
    if (!res.ok) {
      return Response.json({ error: `TWSE responded ${res.status}` }, { status: 502 });
    }
    const rows: TwseDayRow[] = await res.json();
    const row = rows.find((r) => r.Code === code);
    if (!row) {
      return Response.json({ error: `找不到股票代號 ${code}` }, { status: 404 });
    }

    const close = num(row.ClosingPrice);
    const change = num(row.Change);
    const prevClose = close !== null && change !== null ? close - change : null;

    return Response.json({
      source: "TWSE OpenAPI",
      code: row.Code,
      name: row.Name,
      date: rocToIso(row.Date),
      open: num(row.OpeningPrice),
      high: num(row.HighestPrice),
      low: num(row.LowestPrice),
      close,
      change,
      changePercent:
        change !== null && prevClose ? (change / prevClose) * 100 : null,
      volume: num(row.TradeVolume),
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "TWSE request failed" },
      { status: 502 },
    );
  }
}
