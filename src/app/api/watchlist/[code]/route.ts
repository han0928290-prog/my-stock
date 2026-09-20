import type { NextRequest } from "next/server";
import { getSession, unauthorized } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { CODE_PATTERN } from "@/lib/mis";
import { withIndustry } from "@/lib/stock-info";
import { getWatchlist, Watchlist } from "@/models/watchlist";

type Ctx = { params: Promise<{ code: string }> };

const fail = (e: unknown) =>
  Response.json({ error: e instanceof Error ? e.message : "伺服器錯誤" }, { status: 500 });

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();

  const code = (await ctx.params).code.toUpperCase();
  if (!CODE_PATTERN.test(code)) {
    return Response.json({ error: "股票代號格式錯誤" }, { status: 400 });
  }

  try {
    await connectDB();
    await getWatchlist(session.id); // 確保清單文件存在
    await Watchlist.updateOne({ _id: session.id }, { $pull: { stocks: { code } } });
    return Response.json({ stocks: await withIndustry(await getWatchlist(session.id)) });
  } catch (e) {
    return fail(e);
  }
}

// body: { favorite: true | false }，加入或移出我的最愛
export async function PATCH(request: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();

  const code = (await ctx.params).code.toUpperCase();
  const body = await request.json().catch(() => null);
  if (!CODE_PATTERN.test(code) || typeof body?.favorite !== "boolean") {
    return Response.json({ error: "參數錯誤" }, { status: 400 });
  }

  try {
    await connectDB();
    await getWatchlist(session.id);
    await Watchlist.updateOne(
      { _id: session.id, "stocks.code": code },
      { $set: { "stocks.$.favorite": body.favorite } },
    );
    return Response.json({ stocks: await withIndustry(await getWatchlist(session.id)) });
  } catch (e) {
    return fail(e);
  }
}

// body: { note: "..." }，追蹤筆記（最多 2000 字，空字串代表清除）
export async function PUT(request: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();

  const code = (await ctx.params).code.toUpperCase();
  const body = await request.json().catch(() => null);
  if (!CODE_PATTERN.test(code) || typeof body?.note !== "string" || body.note.length > 2000) {
    return Response.json({ error: "參數錯誤（筆記最多 2000 字）" }, { status: 400 });
  }

  try {
    await connectDB();
    await getWatchlist(session.id);
    const note = body.note.trim();
    await Watchlist.updateOne(
      { _id: session.id, "stocks.code": code },
      { $set: { "stocks.$.note": note, "stocks.$.noteAt": note ? new Date() : null } },
    );
    return Response.json({ stocks: await withIndustry(await getWatchlist(session.id)) });
  } catch (e) {
    return fail(e);
  }
}
