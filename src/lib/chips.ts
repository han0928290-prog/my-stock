import { finmind } from "@/lib/finmind";

type InstitutionalRow = { date: string; name: string; buy: number; sell: number };
type MarginRow = {
  date: string;
  MarginPurchaseTodayBalance: number;
  MarginPurchaseYesterdayBalance: number;
  ShortSaleTodayBalance: number;
  ShortSaleYesterdayBalance: number;
};
type ShareholdingRow = { date: string; ForeignInvestmentSharesRatio: number };
type DayTradingRow = { date: string; Volume: number };

export type ChipDay = {
  date: string;
  // 買賣超（股）＝ 買進 - 賣出
  foreign: number | null;
  investmentTrust: number | null;
  dealer: number | null;
  // 融資、融券餘額與增減（張）
  marginBalance: number | null;
  marginChange: number | null;
  shortBalance: number | null;
  shortChange: number | null;
  // 外資持股比例（%）
  foreignRatio: number | null;
  // 當沖成交量（股）
  dayTradingVolume: number | null;
};

// 抓 4 個 FinMind 資料集，依日期合併成每個交易日一筆
export async function getChips(code: string, days: number): Promise<ChipDay[]> {
  const [inst, margin, holding, dayTrade] = await Promise.all([
    finmind<InstitutionalRow>("TaiwanStockInstitutionalInvestorsBuySell", code, days),
    finmind<MarginRow>("TaiwanStockMarginPurchaseShortSale", code, days),
    finmind<ShareholdingRow>("TaiwanStockShareholding", code, days),
    finmind<DayTradingRow>("TaiwanStockDayTrading", code, days),
  ]);

  const byDate = new Map<string, ChipDay>();
  const day = (date: string) => {
    let d = byDate.get(date);
    if (!d) {
      d = {
        date,
        foreign: null,
        investmentTrust: null,
        dealer: null,
        marginBalance: null,
        marginChange: null,
        shortBalance: null,
        shortChange: null,
        foreignRatio: null,
        dayTradingVolume: null,
      };
      byDate.set(date, d);
    }
    return d;
  };

  for (const r of inst) {
    const d = day(r.date);
    const net = r.buy - r.sell;
    // 外資 = Foreign_Investor + Foreign_Dealer_Self；自營商 = Dealer_self + Dealer_Hedging
    const key = r.name.startsWith("Foreign")
      ? "foreign"
      : r.name === "Investment_Trust"
        ? "investmentTrust"
        : r.name.startsWith("Dealer")
          ? "dealer"
          : null;
    if (key) d[key] = (d[key] ?? 0) + net;
  }
  for (const r of margin) {
    const d = day(r.date);
    d.marginBalance = r.MarginPurchaseTodayBalance;
    d.marginChange = r.MarginPurchaseTodayBalance - r.MarginPurchaseYesterdayBalance;
    d.shortBalance = r.ShortSaleTodayBalance;
    d.shortChange = r.ShortSaleTodayBalance - r.ShortSaleYesterdayBalance;
  }
  for (const r of holding) day(r.date).foreignRatio = r.ForeignInvestmentSharesRatio;
  for (const r of dayTrade) day(r.date).dayTradingVolume = r.Volume;

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
