import type { NextRequest } from "next/server";
import { getTokenSession, unauthorized } from "@/lib/auth";
import { finmind } from "@/lib/finmind";

type FinMindRow = {
  date: string;
  Trading_Volume: number;
  open: number;
  max: number;
  min: number;
  close: number;
};

export async function GET(request: NextRequest) {
  if (!(await getTokenSession())) return unauthorized();

  const params = request.nextUrl.searchParams;
  const code = params.get("code") ?? "2330";
  const days = Math.min(Math.max(Number(params.get("days")) || 180, 1), 3650);

  try {
    const rows = await finmind<FinMindRow>("TaiwanStockPrice", code, days);
    const data = rows.map((r) => ({
      date: r.date,
      open: r.open,
      high: r.max,
      low: r.min,
      close: r.close,
      volume: r.Trading_Volume,
    }));
    return Response.json({ source: "FinMind", code, data });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "FinMind request failed" },
      { status: 502 },
    );
  }
}
