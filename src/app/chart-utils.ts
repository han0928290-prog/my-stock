// 財報類圖表共用的小工具

export const axisTick = { fill: "var(--muted)", fontSize: 11 };

// recharts 傳給 label 的座標可能是字串或未定義，統一轉成數字
export type LabelProps = {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  value?: unknown;
  index?: number;
};
export const toNum = (v: unknown) => (typeof v === "number" ? v : Number(v));

export const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// 依資料範圍挑一個整齊的刻度間距（1、2、5、10、20、50…），讓 Y 軸是 40、60、80 這種整數
export function niceTicks(lo: number, hi: number, count = 5) {
  const raw = Math.max((hi - lo) / (count - 1), 1e-9);
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 5, 10].find((m) => m * pow >= raw) ?? 10) * pow;
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}
