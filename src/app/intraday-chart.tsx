"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { axisTick } from "./chart-utils";
import { fmt, getJson, tooltipStyle } from "./lib";

type Point = { time: string; price: number; volume: number | null };
type Intraday = { prevClose: number | null; points: Point[] };

// 當日走勢：以昨收為基準線，收在昨收之上為紅、之下為綠（台股慣例），盤中每 30 秒更新
export default function IntradayChart({ code }: { code: string }) {
  const [data, setData] = useState<Intraday | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      getJson<Intraday>(`/api/twse/intraday?code=${code}`)
        .then((r) => alive && (setData(r), setError(null)))
        .catch((e: Error) => alive && setError(e.message));
    load();
    const id = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [code]);

  const shell = (body: React.ReactNode) => (
    <div className="card p-5 sm:p-6">
      <div className="mb-3 font-bold">當日走勢</div>
      {body}
    </div>
  );

  if (error && !data) return shell(<p className="text-sm text-muted">當日走勢載入失敗：{error}</p>);
  if (!data) return <div className="card h-64 animate-pulse" />;
  if (data.points.length === 0) return shell(<p className="text-sm text-muted">今日尚無成交資料。</p>);

  const { prevClose, points } = data;
  const prices = points.map((p) => p.price);
  const last = prices[prices.length - 1];
  const base = prevClose ?? prices[0];
  const color = last >= base ? "var(--up)" : "var(--down)";
  // Y 軸以昨收為中心對稱，看得出今天偏離昨收多少
  const span = Math.max(Math.abs(Math.max(...prices) - base), Math.abs(Math.min(...prices) - base), base * 0.005);
  const domain: [number, number] = [base - span * 1.1, base + span * 1.1];
  const pct = ((last - base) / base) * 100;

  return (
    <div className="card p-5 sm:p-6">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="font-bold">
          當日走勢 <span className="ml-1 text-xs font-normal text-muted">5 分鐘・每 30 秒更新</span>
        </div>
        <div className="num text-sm font-semibold" style={{ color }}>
          {fmt(last)} ({pct > 0 ? "+" : ""}
          {fmt(pct, 2)}%)
        </div>
      </div>

      <div className="h-56" role="img" aria-label={`當日走勢圖，最新 ${fmt(last)}，較昨收 ${fmt(pct, 2)}%`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <defs>
              <linearGradient id={`intraday-${code}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.18} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="time" tick={axisTick} axisLine={false} tickLine={false} minTickGap={48} />
            <YAxis
              width={48}
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              domain={domain}
              tickCount={5}
              tickFormatter={(v: number) => fmt(v, v >= 100 ? 0 : 2)}
            />
            <ReferenceLine
              y={base}
              stroke="var(--muted)"
              strokeWidth={1.5}
              label={{ value: `昨收 ${fmt(base)}`, position: "insideTopLeft", fill: "var(--muted)", fontSize: 11 }}
            />
            <Tooltip
              cursor={{ stroke: "var(--muted)", strokeWidth: 1 }}
              content={({ active, payload }) => {
                const p = (payload?.[0]?.payload ?? null) as Point | null;
                if (!active || !p) return null;
                return (
                  <div style={tooltipStyle} className="px-3 py-2">
                    <div className="label mb-1">{p.time}</div>
                    <div className="num font-semibold">{fmt(p.price)}</div>
                    <div className="num text-xs text-muted">量 {fmt(p.volume === null ? null : p.volume / 1000, 0)} 張</div>
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="price"
              stroke={color}
              strokeWidth={2}
              fill={`url(#intraday-${code})`}
              dot={false}
              activeDot={{ r: 4, fill: color, stroke: "var(--surface)", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-muted">灰色實線為昨收 {fmt(base)}。</p>
    </div>
  );
}
