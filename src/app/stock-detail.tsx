"use client";

import { useEffect, useId, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import AiAnalysis from "./ai-analysis";
import ChipsView from "./chips-view";
import { chartColor, fmt, getJson, tooltipStyle, type Realtime } from "./lib";
import NewsList from "./news-list";
import RealtimeQuote from "./realtime-quote";
import type { AiState } from "./use-ai-analysis";

type HistoryPoint = { date: string; close: number };

type Props = {
  code: string;
  quote: Realtime | undefined;
  ai: AiState | undefined;
  hasKey: boolean;
  onAnalyze: () => void;
  onOpenSettings: () => void;
};

export default function StockDetail({ code, quote, ai, hasKey, onAnalyze, onOpenSettings }: Props) {
  const [history, setHistory] = useState<HistoryPoint[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const gradId = useId();

  useEffect(() => {
    getJson<{ data: HistoryPoint[] }>(`/api/finmind/history?code=${code}&days=180`)
      .then((r) => setHistory(r.data))
      .catch((e: Error) => setHistoryError(e.message));
  }, [code]);

  const rangeChange = history && history.length > 1 ? history[history.length - 1].close - history[0].close : null;
  const stroke = chartColor(rangeChange);

  return (
    <div className="space-y-6">
      {quote ? (
        <RealtimeQuote quote={quote} />
      ) : (
        <div className="card h-72 animate-pulse" />
      )}

      <AiAnalysis state={ai} hasKey={hasKey} onRun={onAnalyze} onOpenSettings={onOpenSettings} />

      <section className="card p-6 sm:p-8">
        <div className="mb-5 flex items-baseline justify-between">
          <h2 className="font-serif text-lg font-bold">近 180 天走勢</h2>
          <span className="label">收盤價・FinMind</span>
        </div>
        {historyError ? (
          <p className="text-up">歷史線圖載入失敗：{historyError}</p>
        ) : !history ? (
          <div className="h-80 animate-pulse rounded-xl bg-line" />
        ) : (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={stroke} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--line)" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d: string) => d.slice(5)}
                  minTickGap={48}
                  tick={{ fill: "var(--muted)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={["auto", "auto"]}
                  width={52}
                  tick={{ fill: "var(--muted)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => v.toLocaleString("zh-TW")}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ stroke: "var(--muted)", strokeDasharray: "3 3" }}
                  formatter={(v) => [fmt(Number(v)), "收盤價"]}
                />
                <Area
                  type="monotone"
                  dataKey="close"
                  stroke={stroke}
                  strokeWidth={2}
                  fill={`url(#${gradId})`}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <ChipsView code={code} />

      <NewsList code={code} />
    </div>
  );
}
