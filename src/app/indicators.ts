// 日 K 技術指標：均線、KD(9,3,3)、MACD(12,26,9)，參數採台股看盤軟體常用設定

export type Ohlc = { date: string; open: number; high: number; low: number; close: number; volume: number };

export type KBar = Ohlc & {
  ma5: number | null;
  ma20: number | null;
  ma60: number | null;
  k: number | null;
  d: number | null;
  dif: number | null;
  macd: number | null;
  osc: number | null;
};

export const MA_LINES = [
  { key: "ma5", label: "MA5", color: "var(--accent)" },
  { key: "ma20", label: "MA20", color: "#3b82f6" },
  { key: "ma60", label: "MA60", color: "#a855f7" },
] as const;

function sma(values: number[], n: number) {
  let sum = 0;
  return values.map((v, i) => {
    sum += v;
    if (i >= n) sum -= values[i - n];
    return i >= n - 1 ? sum / n : null;
  });
}

function ema(values: number[], n: number) {
  const a = 2 / (n + 1);
  let prev = values[0];
  return values.map((v, i) => (prev = i === 0 ? v : prev + a * (v - prev)));
}

export function withIndicators(rows: Ohlc[]): KBar[] {
  const closes = rows.map((r) => r.close);
  const ma5 = sma(closes, 5);
  const ma20 = sma(closes, 20);
  const ma60 = sma(closes, 60);

  // MACD：DIF = EMA12 − EMA26，MACD = DIF 的 9 日 EMA，OSC = DIF − MACD
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const dif = closes.map((_, i) => ema12[i] - ema26[i]);
  const signal = ema(dif, 9);

  // KD：RSV = (收 − 9 日最低) ÷ (9 日最高 − 9 日最低)，K、D 各以 1/3 權重平滑，起始值 50
  let k = 50;
  let d = 50;
  return rows.map((r, i) => {
    let kd: { k: number | null; d: number | null } = { k: null, d: null };
    if (i >= 8) {
      const win = rows.slice(i - 8, i + 1);
      const hi = Math.max(...win.map((w) => w.high));
      const lo = Math.min(...win.map((w) => w.low));
      const rsv = hi === lo ? 50 : ((r.close - lo) / (hi - lo)) * 100;
      k = (2 / 3) * k + rsv / 3;
      d = (2 / 3) * d + k / 3;
      kd = { k, d };
    }
    return {
      ...r,
      ma5: ma5[i],
      ma20: ma20[i],
      ma60: ma60[i],
      ...kd,
      dif: dif[i],
      macd: signal[i],
      osc: dif[i] - signal[i],
    };
  });
}
