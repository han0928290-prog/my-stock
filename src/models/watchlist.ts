import mongoose, { type InferSchemaType } from "mongoose";

// 第一次建立清單時的預設股票
export const DEFAULT_STOCKS = [
  { code: "2330", name: "台積電" },
  { code: "2317", name: "鴻海" },
  { code: "2454", name: "聯發科" },
  { code: "2881", name: "富邦金" },
  { code: "2412", name: "中華電" },
];

// 每位使用者一份清單（單一文件），_id 直接用使用者 id，天然保證一人一份
const watchlistSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    stocks: [
      {
        _id: false,
        code: { type: String, required: true },
        name: { type: String, required: true },
        favorite: { type: Boolean, default: false },
        note: { type: String, default: "" },
        noteAt: { type: Date },
        // 追蹤筆記時間軸：每筆有日期、分類、內容與進度狀態
        timeline: [
          {
            date: { type: String, required: true },
            category: { type: String, required: true },
            text: { type: String, required: true },
            status: { type: String, default: "待追蹤" },
            dueDate: { type: String, default: "" }, // 預計完成日 YYYY-MM-DD，選填
          },
        ],
        // 手動輸入的機構目標價
        brokers: [{ institution: { type: String, required: true }, target: { type: Number, required: true }, date: { type: String, required: true } }],
      },
    ],
  },
  { timestamps: true },
);

export type WatchlistDoc = InferSchemaType<typeof watchlistSchema>;

// 開發模式熱重載會保留舊的 model（schema 改了也不會更新），所以每次都重建；正式環境沿用快取
if (process.env.NODE_ENV !== "production" && mongoose.models.Watchlist) {
  mongoose.deleteModel("Watchlist");
}

export const Watchlist: mongoose.Model<WatchlistDoc> =
  mongoose.models.Watchlist ?? mongoose.model("Watchlist", watchlistSchema);

// 取得使用者的清單；第一次使用時用預設五檔建立（之後使用者刪光也不會再被補回）
export async function getWatchlist(userId: string) {
  const doc = await Watchlist.findOneAndUpdate(
    { _id: userId },
    { $setOnInsert: { stocks: DEFAULT_STOCKS } },
    { upsert: true, returnDocument: "after" },
  ).lean();
  return doc.stocks.map((s) => ({ code: s.code, name: s.name, favorite: !!s.favorite,
    note: s.note ?? "",
    noteAt: s.noteAt ? s.noteAt.toISOString().slice(0, 10) : null,
    timeline: (s.timeline ?? []).map((t) => ({
      id: String(t._id),
      date: t.date,
      category: t.category,
      text: t.text,
      status: t.status ?? "待追蹤",
      dueDate: t.dueDate ?? "",
    })),
    brokers: (s.brokers ?? []).map((b) => ({
      id: String(b._id),
      institution: b.institution,
      target: b.target,
      date: b.date,
    })),
  }));
}
