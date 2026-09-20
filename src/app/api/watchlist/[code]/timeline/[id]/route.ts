import type { NextRequest } from "next/server";
import { getSession, unauthorized } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { CODE_PATTERN } from "@/lib/mis";
import { withIndustry } from "@/lib/stock-info";
import { STATUSES } from "@/lib/timeline";
import { getWatchlist, Watchlist } from "@/models/watchlist";

type Ctx = { params: Promise<{ code: string; id: string }> };

const fail = (e: unknown) =>
  Response.json({ error: e instanceof Error ? e.message : "伺服器錯誤" }, { status: 500 });

async function parse(ctx: Ctx) {
  const { code, id } = await ctx.params;
  if (!CODE_PATTERN.test(code) || !/^[0-9a-f]{24}$/i.test(id)) return null;
  return { code: code.toUpperCase(), id };
}

// body: { status?: "符合預期", dueDate?: "2027-06-30" | "" }，更新進度狀態或預計完成日（空字串代表清除）
export async function PATCH(request: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();

  const p = await parse(ctx);
  const body = await request.json().catch(() => null);
  if (!p) return Response.json({ error: "參數錯誤" }, { status: 400 });

  const set: Record<string, string> = {};
  if (body?.status !== undefined) {
    if (!(STATUSES as readonly string[]).includes(body.status)) {
      return Response.json({ error: "狀態錯誤" }, { status: 400 });
    }
    set["stocks.$[s].timeline.$[t].status"] = body.status;
  }
  if (body?.dueDate !== undefined) {
    const d = String(body.dueDate).trim();
    if (d && (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d)))) {
      return Response.json({ error: "預計完成日格式錯誤" }, { status: 400 });
    }
    set["stocks.$[s].timeline.$[t].dueDate"] = d;
  }
  if (Object.keys(set).length === 0) return Response.json({ error: "沒有要更新的欄位" }, { status: 400 });

  try {
    await connectDB();
    await getWatchlist(session.id);
    await Watchlist.updateOne(
      { _id: session.id },
      { $set: set },
      { arrayFilters: [{ "s.code": p.code }, { "t._id": p.id }] },
    );
    return Response.json({ stocks: await withIndustry(await getWatchlist(session.id)) });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();

  const p = await parse(ctx);
  if (!p) return Response.json({ error: "參數錯誤" }, { status: 400 });

  try {
    await connectDB();
    await getWatchlist(session.id);
    await Watchlist.updateOne(
      { _id: session.id, "stocks.code": p.code },
      { $pull: { "stocks.$.timeline": { _id: p.id } } },
    );
    return Response.json({ stocks: await withIndustry(await getWatchlist(session.id)) });
  } catch (e) {
    return fail(e);
  }
}
