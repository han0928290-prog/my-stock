"use client";

import { useEffect, useState } from "react";
import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";
import { fmt, getJson, trendColor, type Realtime } from "./lib";

type Props = {
  code: string;
  name: string;
  quote: Realtime | undefined;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
};

export default function StockCard({ code, name, quote, selected, onSelect, onRemove }: Props) {
  const [spark, setSpark] = useState<{ close: number }[] | null>(null);

  useEffect(() => {
    getJson<{ data: { close: number }[] }>(`/api/finmind/history?code=${code}&days=60`)
      .then((r) => setSpark(r.data))
      .catch(() => setSpark([]));
  }, [code]);

  const change = quote?.change ?? null;
  const sign = (change ?? 0) > 0 ? "+" : "";
  const color = trendColor(change);
  const stroke =
    spark && spark.length > 1 && spark[spark.length - 1].close < spark[0].close
      ? "#16a34a"
      : "#ef4444";

  return (
    <div className="group relative">
    <button
      onClick={onSelect}
      aria-pressed={selected}
      className={`w-full rounded-xl border p-4 text-left transition hover:shadow-md ${
        selected
          ? "border-red-500 ring-2 ring-red-500/30"
          : "border-zinc-500/30 hover:border-zinc-500/60"
      }`}
    >
      <div className="flex items-baseline justify-between">
        <span className="font-medium">{name}</span>
        <span className="text-xs text-zinc-500">{code}</span>
      </div>

      {quote ? (
        <>
          <div className={`mt-2 text-2xl font-semibold tabular-nums ${color}`}>
            {fmt(quote.price)}
          </div>
          <div className={`text-sm tabular-nums ${color}`}>
            {sign}
            {fmt(change)}（{sign}
            {fmt(quote.changePercent)}%）
          </div>
        </>
      ) : (
        <div className="mt-2 text-zinc-400">載入中…</div>
      )}

      <div className="mt-3 h-12">
        {spark && spark.length > 1 && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={spark}>
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <Line type="monotone" dataKey="close" stroke={stroke} dot={false} strokeWidth={1.5} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="text-xs text-zinc-500">近 60 天</div>
    </button>
    <button
      onClick={onRemove}
      aria-label={`從追蹤清單移除 ${name}`}
      title="移除"
      className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-zinc-400 opacity-50 hover:bg-zinc-500/20 hover:text-red-500 hover:opacity-100 focus:opacity-100 group-hover:opacity-100"
    >
      ×
    </button>
    </div>
  );
}
