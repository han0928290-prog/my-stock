import type { NextRequest } from "next/server";
import { getSession, unauthorized } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { CODE_PATTERN } from "@/lib/mis";
import { withIndustry } from "@/lib/stock-info";
import { getWatchlist, Watchlist } from "@/models/watchlist";

const MAX_BROKERS = 20;

// body: { institution: "摩根士丹利", target: 3000, date: "2026-09-01" }，手動新增一筆機構目標價
export async function POST(request: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();

  const code = (await ctx.params).code.toUpperCase();
  const body = await request.json().catch(() => null);
  const institution = String(body?.institution ?? "").trim();
  const target = Number(body?.target);
  const date = String(body?.date ?? "").trim();

  if (!CODE_PATTERN.test(code)) return Response.json({ error: "股票代號格式錯誤" }, { status: 400 });
  if (!institution || institution.length > 30) {
    return Response.json({ error: "請輸入機構名稱（30 字以內）" }, { status: 400 });
  }
  if (!Number.isFinite(target) || target <= 0 || target > 1_000_000) {
    return Response.json({ error: "目標價必須是大於 0 的數字" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
    return Response.json({ error: "日期格式錯誤" }, { status: 400 });
  }

  try {
    await connectDB();
    const current = (await getWatchlist(session.id)).find((s) => s.code === code);
    if (!current) return Response.json({ error: "這檔不在追蹤清單中" }, { status: 404 });
    if (current.brokers.length >= MAX_BROKERS) {
      return Response.json({ error: `每檔最多 ${MAX_BROKERS} 筆機構目標價` }, { status: 400 });
    }
    await Watchlist.updateOne(
      { _id: session.id, "stocks.code": code },
      { $push: { "stocks.$.brokers": { institution, target, date } } },
    );
    return Response.json({ stocks: await withIndustry(await getWatchlist(session.id)) }, { status: 201 });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "伺服器錯誤" }, { status: 500 });
  }
}
