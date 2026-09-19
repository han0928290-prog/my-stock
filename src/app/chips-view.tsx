"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmt, getJson, trendColor } from "./lib";

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

  if (error) return <p className="text-red-500">籌碼資料載入失敗：{error}</p>;
  if (!rows) return <p className="text-zinc-400">籌碼資料載入中…</p>;

  // 股 -> 張
  const chartData = rows.map((r) => ({
    date: r.date,
    外資: toLots(r.foreign),
    投信: toLots(r.investmentTrust),
    自營商: toLots(r.dealer),
  }));

  return (
    <section className="space-y-6">
      <div>
        <h2 className="mb-3 text-sm text-zinc-500">三大法人買賣超（張，近 {rows.length} 個交易日，FinMind）</h2>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#8884" />
              <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} minTickGap={20} />
              <YAxis width={64} tickFormatter={(v: number) => v.toLocaleString("zh-TW")} />
              <Tooltip formatter={(v) => Number(v).toLocaleString("zh-TW")} />
              <Legend />
              <Bar dataKey="外資" fill="#ef4444" />
              <Bar dataKey="投信" fill="#3b82f6" />
              <Bar dataKey="自營商" fill="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="overflow-x-auto">
        <h2 className="mb-3 text-sm text-zinc-500">融資融券、外資持股、當沖（單位：張，除非另註）</h2>
        <table className="w-full text-right text-sm tabular-nums">
          <thead className="text-zinc-500">
            <tr className="border-b border-zinc-500/30">
              <th className="py-2 text-left font-normal">日期</th>
              <th className="font-normal">融資餘額</th>
              <th className="font-normal">融資增減</th>
              <th className="font-normal">融券餘額</th>
              <th className="font-normal">融券增減</th>
              <th className="font-normal">外資持股%</th>
              <th className="font-normal">當沖量</th>
            </tr>
          </thead>
          <tbody>
            {[...rows].reverse().map((r) => (
              <tr key={r.date} className="border-b border-zinc-500/10">
                <td className="py-1.5 text-left">{r.date}</td>
                <td>{fmt(r.marginBalance, 0)}</td>
                <td className={trendColor(r.marginChange)}>{fmt(r.marginChange, 0)}</td>
                <td>{fmt(r.shortBalance, 0)}</td>
                <td className={trendColor(r.shortChange)}>{fmt(r.shortChange, 0)}</td>
                <td>{fmt(r.foreignRatio)}</td>
                <td>{fmt(toLots(r.dayTradingVolume), 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
