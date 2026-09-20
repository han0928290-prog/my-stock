import type { NextRequest } from "next/server";
import { getSession, unauthorized } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { CODE_PATTERN } from "@/lib/mis";
import { withIndustry } from "@/lib/stock-info";
import { CATEGORIES, STATUSES } from "@/lib/timeline";
import { getWatchlist, Watchlist } from "@/models/watchlist";

const MAX_ENTRIES = 200;

// body: { date, category, text, status, dueDate? }，在時間軸新增一筆；dueDate 是選填的預計完成日
export async function POST(request: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();

  const code = (await ctx.params).code.toUpperCase();
  const body = await request.json().catch(() => null);
  const date = String(body?.date ?? "").trim();
  const category = String(body?.category ?? "");
  const status = String(body?.status ?? "待追蹤");
  const text = String(body?.text ?? "").trim();
  const dueDate = String(body?.dueDate ?? "").trim();

  if (!CODE_PATTERN.test(code)) return Response.json({ error: "股票代號格式錯誤" }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
    return Response.json({ error: "日期格式錯誤" }, { status: 400 });
  }
  if (!(CATEGORIES as readonly string[]).includes(category)) {
    return Response.json({ error: "分類錯誤" }, { status: 400 });
  }
  if (!(STATUSES as readonly string[]).includes(status)) {
    return Response.json({ error: "狀態錯誤" }, { status: 400 });
  }
  if (dueDate && (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || Number.isNaN(Date.parse(dueDate)))) {
    return Response.json({ error: "預計完成日格式錯誤" }, { status: 400 });
  }
  if (!text || text.length > 1000) {
    return Response.json({ error: "內容必填，最多 1000 字" }, { status: 400 });
  }

  try {
    await connectDB();
    const current = (await getWatchlist(session.id)).find((s) => s.code === code);
    if (!current) return Response.json({ error: "這檔不在追蹤清單中" }, { status: 404 });
    if (current.timeline.length >= MAX_ENTRIES) {
      return Response.json({ error: `每檔最多 ${MAX_ENTRIES} 筆時間軸紀錄` }, { status: 400 });
    }
    await Watchlist.updateOne(
      { _id: session.id, "stocks.code": code },
      { $push: { "stocks.$.timeline": { date, category, text, status, dueDate } } },
    );
    return Response.json({ stocks: await withIndustry(await getWatchlist(session.id)) }, { status: 201 });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "伺服器錯誤" }, { status: 500 });
  }
}
