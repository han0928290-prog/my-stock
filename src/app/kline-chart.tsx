"use client";

import { useMemo, useState, type ReactElement, type ReactNode } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MA_LINES, withIndicators, type KBar, type Ohlc } from "./indicators";
import { fmt, tooltipStyle } from "./lib";

// 台股慣例：收盤 ≥ 開盤為紅 K，否則綠 K
export const candleColor = (p: Pick<Ohlc, "open" | "close">) => (p.close >= p.open ? "var(--up)" : "var(--down)");

const tick = { fill: "var(--muted)", fontSize: 11 };
const Y_WIDTH = 52; // 每張圖的 Y 軸同寬，K 棒、量、KD、MACD 才會上下對齊
const SYNC = "kline";

export type CandleProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: Pick<Ohlc, "open" | "high" | "low" | "close">;
};

// Bar 的值是 [最低, 最高]，所以 y～y+height 對應最高到最低價，再依比例換算開收盤位置
export function Candle({ x = 0, y = 0, width = 0, height = 0, payload }: CandleProps) {
  if (!payload) return null;
  const { open, high, low, close } = payload;
  const top = Math.min(y, y + height);
  const h = Math.abs(height);
  const toY = (v: number) => (high === low ? top : top + ((high - v) / (high - low)) * h);
  const color = candleColor(payload);
  const bodyTop = toY(Math.max(open, close));
  const bodyH = Math.max(toY(Math.min(open, close)) - bodyTop, 1);
  const cx = x + width / 2;
  const bodyW = Math.max(width * 0.7, 1);
  return (
    <g>
      <line x1={cx} x2={cx} y1={top} y2={top + h} stroke={color} strokeWidth={1} />
      <rect x={cx - bodyW / 2} y={bodyTop} width={bodyW} height={bodyH} fill={color} />
    </g>
  );
}

function CandleTooltip({ active, payload }: { active?: boolean; payload?: { payload: KBar }[] }) {
  const p = active ? payload?.[0]?.payload : undefined;
  if (!p) return null;
  const rows: [string, number][] = [
    ["開", p.open],
    ["高", p.high],
    ["低", p.low],
    ["收", p.close],
  ];
  return (
    <div style={tooltipStyle} className="px-3 py-2">
      <div className="mb-1 text-muted">{p.date}</div>
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4">
          <span className="text-muted">{k}</span>
          <span style={{ color: k === "收" ? candleColor(p) : undefined }}>{fmt(v)}</span>
        </div>
      ))}
    </div>
  );
}

const lots = (volume: number) => Math.round(volume / 1000);

// 每個副圖上方的數值列：滑鼠停在哪一天就顯示那天，否則顯示最新一天
function Legend({ items }: { items: { label: string; value: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-3 text-xs tabular-nums">
      {items.map((it) => (
        <span key={it.label} style={{ color: it.color }}>
          {it.label} {it.value}
        </span>
      ))}
    </div>
  );
}

function Panel({ legend, height, children }: { legend: ReactNode; height: number; children: ReactElement }) {
  return (
    <div>
      <div className="mb-1 pl-[52px]">{legend}</div>
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const num = (v: number | null, digits = 2) => (v === null ? "-" : fmt(v, digits));

type Props = { rows: Ohlc[]; fromDate: string };

export default function KlineChart({ rows, fromDate }: Props) {
  // 指標用完整資料計算（含暖機期），畫面只顯示 fromDate 之後
  const data = useMemo(() => withIndicators(rows).filter((r) => r.date >= fromDate), [rows, fromDate]);
  const [hover, setHover] = useState<number | null>(null);

  if (!data.length) return <p className="text-muted">沒有歷史資料</p>;

  const cur = data[hover !== null && hover < data.length ? hover : data.length - 1];
  const chartProps = {
    data,
    syncId: SYNC,
    onMouseMove: (s: { activeTooltipIndex?: number | string | null }) =>
      setHover(s.activeTooltipIndex == null ? null : Number(s.activeTooltipIndex)),
    onMouseLeave: () => setHover(null),
  };
  const grid = <CartesianGrid vertical={false} stroke="var(--line)" />;
  const hiddenX = <XAxis dataKey="date" hide />;
  const cursorOnly = <Tooltip content={() => null} cursor={{ stroke: "var(--muted)", strokeDasharray: "3 3" }} />;

  return (
    <div className="space-y-3">
      <Panel
        height={320}
        legend={
          <Legend
            items={[
              { label: cur.date, value: "", color: "var(--muted)" },
              ...MA_LINES.map((m) => ({ label: m.label, value: num(cur[m.key]), color: m.color })),
            ]}
          />
        }
      >
        <ComposedChart {...chartProps} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          {grid}
          {hiddenX}
          <YAxis
            domain={["auto", "auto"]}
            width={Y_WIDTH}
            tick={tick}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => v.toLocaleString("zh-TW")}
          />
          <Tooltip content={<CandleTooltip />} cursor={{ fill: "var(--line)", opacity: 0.5 }} />
          <Bar
            dataKey={(p: KBar) => [p.low, p.high]}
            shape={(props: CandleProps) => <Candle {...props} />}
            isAnimationActive={false}
          />
          {MA_LINES.map((m) => (
            <Line
              key={m.key}
              dataKey={m.key}
              stroke={m.color}
              strokeWidth={1.25}
              dot={false}
              activeDot={false}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </ComposedChart>
      </Panel>

      <Panel
        height={80}
        legend={<Legend items={[{ label: "成交量", value: `${lots(cur.volume).toLocaleString("zh-TW")} 張`, color: "var(--muted)" }]} />}
      >
        <ComposedChart {...chartProps} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          {grid}
          {hiddenX}
          <YAxis
            width={Y_WIDTH}
            tick={tick}
            axisLine={false}
            tickLine={false}
            tickCount={3}
            tickFormatter={(v: number) => (v >= 10000 ? `${Math.round(v / 1000)}k` : v.toLocaleString("zh-TW"))}
          />
          {cursorOnly}
          <Bar dataKey={(p: KBar) => lots(p.volume)} isAnimationActive={false}>
            {data.map((p) => (
              <Cell key={p.date} fill={candleColor(p)} fillOpacity={0.7} />
            ))}
          </Bar>
        </ComposedChart>
      </Panel>

      <Panel
        height={100}
        legend={
          <Legend
            items={[
              { label: "KD(9,3,3)　K", value: num(cur.k), color: "var(--accent)" },
              { label: "D", value: num(cur.d), color: "#3b82f6" },
            ]}
          />
        }
      >
        <ComposedChart {...chartProps} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          {grid}
          {hiddenX}
          <YAxis domain={[0, 100]} ticks={[20, 50, 80]} width={Y_WIDTH} tick={tick} axisLine={false} tickLine={false} />
          <ReferenceLine y={80} stroke="var(--up)" strokeDasharray="3 3" strokeOpacity={0.5} />
          <ReferenceLine y={20} stroke="var(--down)" strokeDasharray="3 3" strokeOpacity={0.5} />
          {cursorOnly}
          <Line dataKey="k" stroke="var(--accent)" strokeWidth={1.25} dot={false} activeDot={false} isAnimationActive={false} />
          <Line dataKey="d" stroke="#3b82f6" strokeWidth={1.25} dot={false} activeDot={false} isAnimationActive={false} />
        </ComposedChart>
      </Panel>

      <Panel
        height={130}
        legend={
          <Legend
            items={[
              { label: "MACD(12,26,9)　DIF", value: num(cur.dif), color: "var(--accent)" },
              { label: "MACD", value: num(cur.macd), color: "#3b82f6" },
              { label: "OSC", value: num(cur.osc), color: (cur.osc ?? 0) >= 0 ? "var(--up)" : "var(--down)" },
            ]}
          />
        }
      >
        <ComposedChart {...chartProps} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          {grid}
          <XAxis
            dataKey="date"
            tickFormatter={(d: string) => d.slice(5)}
            minTickGap={48}
            tick={tick}
            axisLine={false}
            tickLine={false}
          />
          <YAxis width={Y_WIDTH} tick={tick} axisLine={false} tickLine={false} tickCount={3} />
          <ReferenceLine y={0} stroke="var(--muted)" strokeOpacity={0.4} />
          {cursorOnly}
          <Bar dataKey="osc" isAnimationActive={false}>
            {data.map((p) => (
              <Cell key={p.date} fill={(p.osc ?? 0) >= 0 ? "var(--up)" : "var(--down)"} fillOpacity={0.7} />
            ))}
          </Bar>
          <Line dataKey="dif" stroke="var(--accent)" strokeWidth={1.25} dot={false} activeDot={false} isAnimationActive={false} />
          <Line dataKey="macd" stroke="#3b82f6" strokeWidth={1.25} dot={false} activeDot={false} isAnimationActive={false} />
        </ComposedChart>
      </Panel>
    </div>
  );
}
