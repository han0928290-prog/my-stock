"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmt, getJson, tooltipStyle, trendColor } from "./lib";

type ChipDay = {
  date: string;
  foreign: number | null;
  investmentTrust: number | null;
  dealer: number | null;
  marginBalance: number | null;
  marginChange: number | null;
  shortBalance: number | null;
  shortChange: number | null;
  foreignRatio: number | null;
  dayTradingVolume: number | null;
};

const SHOW_DAYS = 20;
const toLots = (shares: number | null) => (shares === null ? null : Math.round(shares / 1000));

export default function ChipsView({ code }: { code: string }) {
  const [rows, setRows] = useState<ChipDay[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getJson<{ data: ChipDay[] }>(`/api/finmind/chips?code=${code}&days=45`)
      .then((r) => setRows(r.data.slice(-SHOW_DAYS)))
      .catch((e: Error) => setError(e.message));
  }, [code]);

  if (error) {
    return (
      <section className="card p-6 sm:p-8">
        <p className="text-up">籌碼資料載入失敗：{error}</p>
      </section>
    );
  }
  if (!rows) return <div className="card h-96 animate-pulse" />;

  // 股 -> 張
  const chartData = rows.map((r) => ({
    date: r.date,
    外資: toLots(r.foreign),
    投信: toLots(r.investmentTrust),
    自營商: toLots(r.dealer),
  }));

  const th = "label whitespace-nowrap px-3 py-2.5 text-right font-medium first:pl-0 first:text-left last:pr-0";
  const td = "num whitespace-nowrap px-3 py-2 text-right first:pl-0 first:text-left last:pr-0";

  return (
    <section className="card p-6 sm:p-8">
      <div className="mb-5 flex items-baseline justify-between">
        <h2 className="font-serif text-lg font-bold">籌碼面</h2>
        <span className="label">近 {rows.length} 個交易日・FinMind</span>
      </div>

      <h3 className="label mb-3">三大法人買賣超（張）</h3>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) => d.slice(5)}
              minTickGap={36}
              tick={{ fill: "var(--muted)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              width={60}
              tick={{ fill: "var(--muted)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => v.toLocaleString("zh-TW")}
            />
            <ReferenceLine y={0} stroke="var(--muted)" strokeOpacity={0.5} />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ fill: "var(--line)" }}
              formatter={(v) => Number(v).toLocaleString("zh-TW")}
            />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "var(--muted)" }} />
            <Bar dataKey="外資" fill="var(--accent)" radius={[3, 3, 0, 0]} />
            <Bar dataKey="投信" fill="#5b8def" radius={[3, 3, 0, 0]} />
            <Bar dataKey="自營商" fill="#a78bfa" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <h3 className="label mb-2 mt-8">融資融券・外資持股・當沖（單位：張，除非另註）</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className={th}>日期</th>
              <th className={th}>融資餘額</th>
              <th className={th}>融資增減</th>
              <th className={th}>融券餘額</th>
              <th className={th}>融券增減</th>
              <th className={th}>外資持股%</th>
              <th className={th}>當沖量</th>
            </tr>
          </thead>
          <tbody>
            {[...rows].reverse().map((r) => (
              <tr key={r.date} className="border-b border-line/60 transition hover:bg-surface-2">
                <td className={`${td} text-muted`}>{r.date}</td>
                <td className={td}>{fmt(r.marginBalance, 0)}</td>
                <td className={`${td} ${trendColor(r.marginChange)}`}>{fmt(r.marginChange, 0)}</td>
                <td className={td}>{fmt(r.shortBalance, 0)}</td>
                <td className={`${td} ${trendColor(r.shortChange)}`}>{fmt(r.shortChange, 0)}</td>
                <td className={td}>{fmt(r.foreignRatio)}</td>
                <td className={td}>{fmt(toLots(r.dayTradingVolume), 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
