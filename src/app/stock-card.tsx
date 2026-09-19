"use client";

import { useEffect, useId, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";
import { chartColor, fmt, getJson, trendArrow, trendColor, trendPill, type Realtime } from "./lib";
import { VERDICT, type AiState } from "./use-ai-analysis";

type Props = {
  code: string;
  name: string;
  quote: Realtime | undefined;
  ai: AiState | undefined;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onAnalyze: () => void;
};

export default function StockCard({ code, name, quote, ai, selected, onSelect, onRemove, onAnalyze }: Props) {
  const [spark, setSpark] = useState<{ close: number }[] | null>(null);
  const gradId = useId();

  useEffect(() => {
    getJson<{ data: { close: number }[] }>(`/api/finmind/history?code=${code}&days=60`)
      .then((r) => setSpark(r.data))
      .catch(() => setSpark([]));
  }, [code]);

  const change = quote?.change ?? null;
  // 走勢圖顏色看這 60 天整體是漲還是跌
  const rangeChange =
    spark && spark.length > 1 ? spark[spark.length - 1].close - spark[0].close : null;
  const stroke = chartColor(rangeChange);

  const verdict = ai?.result ? VERDICT[ai.result.analysis.verdict] : null;

  return (
    <div
      className={`card group relative flex flex-col overflow-hidden transition duration-200 hover:-translate-y-0.5 ${
        selected ? "!border-accent ring-1 ring-accent" : "hover:!border-muted/40"
      }`}
    >
      <button onClick={onSelect} aria-pressed={selected} className="w-full p-4 pb-0 text-left">
        <div className="flex items-baseline gap-2 pr-6">
          <span className="truncate font-medium">{name}</span>
          <span className="num text-xs text-muted">{code}</span>
        </div>

        {quote ? (
          <>
            <div className={`num mt-3 text-[1.7rem] font-semibold leading-none ${trendColor(change)}`}>
              {fmt(quote.price)}
            </div>
            <span
              className={`num mt-2 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ${trendPill(change)}`}
            >
              {trendArrow(change)} {fmt(Math.abs(change ?? 0))}
              <span className="opacity-70">({fmt(Math.abs(quote.changePercent ?? 0))}%)</span>
            </span>
          </>
        ) : (
          <div className="mt-3 space-y-2">
            <div className="h-7 w-24 animate-pulse rounded bg-line" />
            <div className="h-5 w-20 animate-pulse rounded bg-line" />
          </div>
        )}

        <div className="-mx-4 mt-3 h-14">
          {spark && spark.length > 1 && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={spark} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={stroke} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <YAxis hide domain={["dataMin", "dataMax"]} />
                <Area
                  type="monotone"
                  dataKey="close"
                  stroke={stroke}
                  strokeWidth={1.5}
                  fill={`url(#${gradId})`}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </button>

      {/* 每張卡片下方的 AI 分析按鈕：點下去會呼叫我們的後端 API */}
      <div className="flex items-center gap-2 border-t border-line bg-surface-2/60 p-2.5">
        {verdict && (
          <span
            title={ai?.result?.analysis.summary}
            className={`shrink-0 rounded-md px-2 py-1 text-xs font-bold ${verdict.cls}`}
          >
            {verdict.label}
          </span>
        )}
        <button
          onClick={onAnalyze}
          disabled={ai?.loading}
          className="flex-1 rounded-lg border border-line bg-surface px-2 py-1.5 text-xs font-medium text-fg transition hover:border-accent hover:text-accent disabled:cursor-wait disabled:opacity-60"
        >
          {ai?.loading ? "分析中…" : `✦ ${ai?.result ? "重新分析" : "AI 分析"}`}
        </button>
      </div>

      <button
        onClick={onRemove}
        aria-label={`從追蹤清單移除 ${name}`}
        title="移除"
        className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full text-muted opacity-0 transition hover:bg-up-soft hover:text-up focus:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-60"
      >
        ×
      </button>
    </div>
  );
}
