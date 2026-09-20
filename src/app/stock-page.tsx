"use client";

import { useEffect, useState } from "react";
import { CATEGORIES, STATUSES } from "@/lib/timeline";
import {
  fmt,
  getJson,
  trendColor,
  type Analyst,
  type ManualBroker,
  type Realtime,
  type TimelineEntry,
  type WatchItem,
} from "./lib";
import type { Estimates } from "@/lib/estimates";
import EpsChart, { type EpsChartRow } from "./eps-chart";
import EstimatesCard from "./estimates-card";
import PerChart from "./per-chart";
import RevenueChart from "./revenue-chart";
import StockDetail from "./stock-detail";
import type { AiState } from "./use-ai-analysis";

const TABS = ["總覽", "獲利與 EPS", "目標價", "行情與籌碼", "產能與擴廠", "追蹤筆記"] as const;
type Tab = (typeof TABS)[number];

type Props = {
  item: WatchItem;
  quote: Realtime | undefined;
  analyst: Analyst | null | undefined; // undefined = 載入中，null = 查無資料
  ai: AiState | undefined;
  hasKey: boolean;
  onBack: () => void;
  onToggleFavorite: () => void;
  onSaveNote: (note: string) => Promise<void>;
  onAddEntry: (e: { date: string; category: string; text: string; status: string; dueDate?: string }) => Promise<void>;
  onSetEntryStatus: (id: string, status: string) => Promise<void>;
  onSetEntryDue: (id: string, dueDate: string) => Promise<void>;
  onRemoveEntry: (id: string) => Promise<void>;
  onAddBroker: (b: { institution: string; target: number; date: string }) => Promise<void>;
  onRemoveBroker: (id: string) => Promise<void>;
  onAnalyze: () => void;
  onOpenSettings: () => void;
};

const price0 = (n: number | null | undefined) => (n == null ? "—" : fmt(n, n >= 100 ? 0 : 2));
const signed = (n: number | null) => (n === null ? "—" : `${n > 0 ? "+" : ""}${fmt(n, 1)}%`);

export default function StockPage({
  item,
  quote,
  analyst,
  ai,
  hasKey,
  onBack,
  onToggleFavorite,
  onSaveNote,
  onAddEntry,
  onSetEntryStatus,
  onSetEntryDue,
  onRemoveEntry,
  onAddBroker,
  onRemoveBroker,
  onAnalyze,
  onOpenSettings,
}: Props) {
  const [tab, setTab] = useState<Tab>("總覽");
  const price = quote?.price ?? null;
  const target = analyst?.target ?? null;
  const growth = price && target ? ((target - price) / price) * 100 : null;
  const recent = [...(item.timeline ?? [])].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted transition hover:text-fg">
        ← 返回清單
      </button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-muted">{item.industry}</div>
          <div className="mt-0.5 flex items-baseline gap-2">
            <h2 className="font-serif text-3xl font-bold">{item.name}</h2>
            <span className="num text-muted">{item.code}</span>
          </div>
        </div>
        <button
          onClick={onToggleFavorite}
          aria-pressed={item.favorite}
          className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition ${
            item.favorite
              ? "border-amber-400 bg-amber-500/10 text-amber-600"
              : "border-line text-muted hover:border-amber-400 hover:text-amber-600"
          }`}
        >
          {item.favorite ? "★ 已加入最愛" : "☆ 加入最愛"}
        </button>
      </div>

      <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              tab === t ? "border-fg text-fg" : "border-transparent text-muted hover:text-fg"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "總覽" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="現價" value={price0(price)} />
            <Stat
              label="預期成長"
              value={growth === null ? "—" : `${fmt(growth, 1)}%`}
              cls={growth === null ? "" : trendColor(growth)}
            />
            <Stat label="目標價" value={price0(target)} />
            <Stat label="本益比 (P/E)" value={analyst?.pe == null ? "—" : fmt(analyst.pe, 1)} />
          </div>
          {analyst === undefined && <p className="text-sm text-muted">分析師資料載入中…</p>}
          {analyst === null && <p className="text-sm text-muted">查不到這檔的分析師目標價與本益比。</p>}

          <div className="card px-5 py-4 text-sm">
            <span className="text-muted">目標價潛在漲跌幅：</span>
            <span className={`num font-bold ${trendColor(growth)}`}>{signed(growth)}</span>
          </div>

          <PerChart code={item.code} />

          <div className="card px-5 py-4">
            <div className="flex items-center justify-between">
              <span className="font-bold">備註</span>
              {(item.timeline ?? []).length > 3 && (
                <button onClick={() => setTab("追蹤筆記")} className="text-xs text-muted hover:text-fg">
                  查看全部 {(item.timeline ?? []).length} 筆 →
                </button>
              )}
            </div>
            {recent.length > 0 ? (
              <ul className="mt-2 space-y-2.5">
                {recent.map((t) => (
                  <li key={t.id} className="text-sm leading-relaxed">
                    <span className="mr-2 rounded bg-line px-1.5 py-0.5 text-[0.65rem] text-muted">{t.category}</span>
                    <span className="whitespace-pre-wrap">{t.text}</span>
                    <div className="mt-0.5 text-xs text-muted">
                      {t.date}・<span className={statusCls(t.status)}>{t.status}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1.5 text-sm text-muted">尚無備註，到「追蹤筆記」分頁記下 EPS、產能、擴廠等進度。</p>
            )}
          </div>
        </div>
      )}

      {tab === "獲利與 EPS" && (
        <EpsTab
          code={item.code}
          timeline={item.timeline ?? []}
          onAdd={onAddEntry}
          onSetStatus={onSetEntryStatus}
          onSetDue={onSetEntryDue}
          onRemove={onRemoveEntry}
        />
      )}
      {tab === "產能與擴廠" && (
        <CapacityTab
          timeline={item.timeline ?? []}
          onAdd={onAddEntry}
          onSetStatus={onSetEntryStatus}
          onSetDue={onSetEntryDue}
          onRemove={onRemoveEntry}
        />
      )}
      {tab === "目標價" && <TargetTab
          code={item.code}
          analyst={analyst}
          price={price}
          growth={growth}
          manual={item.brokers ?? []}
          onAddBroker={onAddBroker}
          onRemoveBroker={onRemoveBroker}
        />}
      {tab === "追蹤筆記" && (
        <TimelineTab
          item={item}
          onAdd={onAddEntry}
          onSetStatus={onSetEntryStatus}
          onSetDue={onSetEntryDue}
          onRemove={onRemoveEntry}
          onClearLegacy={() => onSaveNote("")}
        />
      )}
      {tab === "行情與籌碼" && (
        <StockDetail
          code={item.code}
          quote={quote}
          ai={ai}
          hasKey={hasKey}
          onAnalyze={onAnalyze}
          onOpenSettings={onOpenSettings}
        />
      )}
    </div>
  );
}

function Stat({ label, value, cls = "" }: { label: string; value: string; cls?: string }) {
  return (
    <div className="card px-4 py-3.5">
      <div className="text-xs text-muted">{label}</div>
      <div className={`num mt-1.5 text-xl font-bold ${cls}`}>{value}</div>
    </div>
  );
}

type EpsRow = {
  date: string;
  eps: number | null;
  revenue: number | null;
  grossMargin: number | null;
  operatingMargin: number | null;
  netIncome: number | null;
};

const quarter = (d: string) => `${d.slice(0, 4)} Q${Math.ceil(Number(d.slice(5, 7)) / 3)}`;
const yi = (n: number | null) => (n === null ? "—" : fmt(n / 1e8, 1));
const pct = (n: number | null) => (n === null ? "—" : `${fmt(n, 1)}%`);

function EpsTab({ code, timeline, onAdd, onSetStatus, onSetDue, onRemove }: EntryHandlers & { code: string; timeline: TimelineEntry[] }) {
  const [rows, setRows] = useState<EpsRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // undefined = 載入中，null = 查無分析師預估
  const [est, setEst] = useState<Estimates | null | undefined>(undefined);

  useEffect(() => {
    getJson<{ data: EpsRow[] }>(`/api/finmind/eps?code=${code}`)
      .then((r) => setRows(r.data))
      .catch((e: Error) => setError(e.message));
    getJson<{ estimates: Estimates | null }>(`/api/estimates?code=${code}`)
      .then((r) => setEst(r.estimates))
      .catch(() => setEst(null)); // 預估載入失敗不影響實際財報的顯示
  }, [code]);

  if (error) return <p className="text-up">獲利資料載入失敗：{error}</p>;
  if (!rows) return <div className="card h-64 animate-pulse" />;
  if (rows.length === 0) {
    return (
      <div className="space-y-6">
        <div className="card p-8 text-center text-muted">查無財報資料（ETF 或新上市股票可能沒有）。</div>
        <EpsTimeline rows={[]} timeline={timeline} onAdd={onAdd} onSetStatus={onSetStatus} onSetDue={onSetDue} onRemove={onRemove} />
      </div>
    );
  }

  const latest = rows[rows.length - 1];
  const last4 = rows.slice(-4);
  const ttm = last4.length === 4 && last4.every((r) => r.eps !== null) ? last4.reduce((a, r) => a + (r.eps ?? 0), 0) : null;
  const max = Math.max(...rows.map((r) => Math.abs(r.eps ?? 0)), 0.01);

  // 圖表資料：實際財報 + 分析師預估的「未來季度」（結束日晚於最新已公布季；已公布的季度不當預估）
  const estRows: EpsChartRow[] = (est?.periods ?? [])
    .filter((p) => p.key.endsWith("q") && p.eps !== null && p.endDate !== null && p.endDate > latest.date)
    .map((p) => ({
      date: p.endDate as string,
      eps: p.eps,
      grossMargin: null,
      estimate: true,
      epsLow: p.epsLow,
      epsHigh: p.epsHigh,
      analysts: p.analysts,
    }));
  const chartRows: EpsChartRow[] = [
    ...rows.map((r) => ({ date: r.date, eps: r.eps, grossMargin: r.grossMargin })),
    ...estRows,
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="近四季 EPS 合計" value={ttm === null ? "—" : fmt(ttm, 2)} />
        <Stat label="最新一季 EPS" value={latest.eps === null ? "—" : fmt(latest.eps, 2)} />
        <Stat label="最新毛利率" value={pct(latest.grossMargin)} />
        <Stat label="最新營業利益率" value={pct(latest.operatingMargin)} />
      </div>

      <EpsChart rows={chartRows} code={code} />

      {est === undefined ? (
        <div className="card h-48 animate-pulse" />
      ) : est === null ? (
        <div className="card px-5 py-4 text-sm text-muted">查無分析師預估資料（追蹤這檔的分析師太少，或 Yahoo 沒有收錄）。</div>
      ) : (
        <EstimatesCard est={est} latestActualDate={latest.date} />
      )}

      <RevenueChart code={code} />

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="px-4 py-3 font-medium">季度</th>
              <th className="px-4 py-3 font-medium">EPS（元）</th>
              <th className="px-4 py-3 text-right font-medium">營收（億）</th>
              <th className="px-4 py-3 text-right font-medium">毛利率</th>
              <th className="px-4 py-3 text-right font-medium">營業利益率</th>
              <th className="px-4 py-3 text-right font-medium">稅後淨利（億）</th>
            </tr>
          </thead>
          <tbody>
            {[...rows].reverse().map((r) => (
              <tr key={r.date} className="border-b border-line last:border-0">
                <td className="num px-4 py-2.5">{quarter(r.date)}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className={`num w-12 font-medium ${trendColor(r.eps)}`}>
                      {r.eps === null ? "—" : fmt(r.eps, 2)}
                    </span>
                    <span
                      className={`h-1.5 rounded-full ${(r.eps ?? 0) >= 0 ? "bg-up/60" : "bg-down/60"}`}
                      style={{ width: `${(Math.abs(r.eps ?? 0) / max) * 80}px` }}
                    />
                  </div>
                </td>
                <td className="num px-4 py-2.5 text-right">{yi(r.revenue)}</td>
                <td className="num px-4 py-2.5 text-right">{pct(r.grossMargin)}</td>
                <td className="num px-4 py-2.5 text-right">{pct(r.operatingMargin)}</td>
                <td className="num px-4 py-2.5 text-right">{yi(r.netIncome)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">資料來源：FinMind 綜合損益表，為單季數字。</p>

      <EpsTimeline rows={rows} timeline={timeline} onAdd={onAdd} onSetStatus={onSetStatus} onSetDue={onSetDue} onRemove={onRemove} />
    </div>
  );
}

function TargetTab({
  code,
  analyst,
  price,
  growth,
  manual,
  onAddBroker,
  onRemoveBroker,
}: {
  code: string;
  manual: ManualBroker[];
  onAddBroker: Props["onAddBroker"];
  onRemoveBroker: Props["onRemoveBroker"];
  analyst: Analyst | null | undefined;
  price: number | null;
  growth: number | null;
}) {
  return (
    <div className="space-y-6">
      <TargetSummary analyst={analyst} price={price} growth={growth} />
      <BrokerList code={code} price={price} manual={manual} onAdd={onAddBroker} onRemove={onRemoveBroker} />
    </div>
  );
}

function TargetSummary({
  analyst,
  price,
  growth,
}: {
  analyst: Analyst | null | undefined;
  price: number | null;
  growth: number | null;
}) {
  if (analyst === undefined) return <div className="card h-40 animate-pulse" />;
  if (analyst === null || analyst.target === null) {
    return <div className="card p-8 text-center text-muted">查不到這檔的分析師目標價彙總。</div>;
  }
  const { low, high } = analyst;
  const span = low !== null && high !== null && high > low ? high - low : null;
  const pos = (v: number | null) =>
    span && v !== null && low !== null ? Math.min(Math.max(((v - low) / span) * 100, 0), 100) : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="平均目標價" value={price0(analyst.target)} />
        <Stat label="最高目標價" value={price0(high)} />
        <Stat label="最低目標價" value={price0(low)} />
        <Stat label="分析師人數" value={analyst.count === null ? "—" : String(analyst.count)} />
      </div>

      {span && (
        <div className="card px-5 py-5">
          <div className="mb-8 text-sm font-bold">目標價區間</div>
          <div className="relative mx-2 h-1.5 rounded-full bg-line">
            {[
              { v: analyst.target, label: "平均", cls: "bg-accent" },
              { v: price, label: "現價", cls: "bg-fg" },
            ].map((m) => {
              const p = pos(m.v);
              return p === null ? null : (
                <div key={m.label} className="absolute -top-1" style={{ left: `${p}%` }}>
                  <div className={`h-3.5 w-3.5 -translate-x-1/2 rounded-full ${m.cls}`} />
                  <div className="num absolute left-1/2 top-5 -translate-x-1/2 whitespace-nowrap text-xs text-muted">
                    {m.label} {price0(m.v)}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="num mt-12 flex justify-between text-xs text-muted">
            <span>最低 {price0(low)}</span>
            <span>最高 {price0(high)}</span>
          </div>
        </div>
      )}

      <div className="card px-5 py-4 text-sm">
        <span className="text-muted">平均目標價潛在漲跌幅：</span>
        <span className={`num font-bold ${trendColor(growth)}`}>{signed(growth)}</span>
        {analyst.median !== null && <span className="ml-4 text-muted">中位數 {price0(analyst.median)}</span>}
      </div>
      <p className="text-xs text-muted">資料來源：Yahoo Finance 分析師預估，僅供參考，不構成投資建議。</p>
    </div>
  );
}

const statusCls = (st: string) =>
  st === "符合預期" ? "text-down" : st === "落後" ? "text-up" : st === "超前" ? "text-accent" : "text-muted";
const statusDot = (st: string) =>
  st === "符合預期" ? "bg-down" : st === "落後" ? "bg-up" : st === "超前" ? "bg-accent" : "bg-muted/50";

// 這些分類才有「預計完成日」
const DUE_CATEGORIES: string[] = ["產能", "擴廠"];

type EntryHandlers = {
  onAdd: Props["onAddEntry"];
  onSetStatus: Props["onSetEntryStatus"];
  onSetDue: Props["onSetEntryDue"];
  onRemove: Props["onRemoveEntry"];
};

// 新增紀錄的表單；categories 決定可選的分類（EPS 分頁只給 EPS／財測）
function EntryForm({
  categories,
  placeholder,
  onAdd,
}: {
  categories: readonly string[];
  placeholder: string;
  onAdd: Props["onAddEntry"];
}) {
  const [date, setDate] = useState(today);
  const [category, setCategory] = useState<string>(categories[0]);
  const [status, setStatus] = useState<string>(STATUSES[0]);
  const [dueDate, setDueDate] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasDue = DUE_CATEGORIES.includes(category);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onAdd({ date, category, text: text.trim(), status, dueDate: hasDue ? dueDate : "" });
      setText("");
      setDueDate("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-3 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex w-40 flex-col gap-1 text-xs text-muted">
          日期
          <input value={date} onChange={(e) => setDate(e.target.value)} type="date" className="field" />
        </label>
        <label className="flex w-28 flex-col gap-1 text-xs text-muted">
          分類
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="field">
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="flex w-32 flex-col gap-1 text-xs text-muted">
          進度
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="field">
            {STATUSES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        {hasDue && (
          <label className="flex w-44 flex-col gap-1 text-xs text-muted">
            預計完成日（選填）
            <input
              value={dueDate}
              min={date}
              onChange={(e) => setDueDate(e.target.value)}
              type="date"
              className="field"
            />
          </label>
        )}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={1000}
        rows={3}
        placeholder={placeholder}
        className="field w-full resize-y leading-relaxed"
      />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy || !text.trim() || !date} className="btn-primary">
          {busy ? "新增中…" : "新增到時間軸"}
        </button>
        <span className="text-xs text-muted">{text.length} / 1000</span>
      </div>
      {error && (
        <p role="alert" className="text-sm text-up">
          {error}
        </p>
      )}
    </form>
  );
}

type Entry = TimelineEntry & { legacy?: boolean };

// 時間軸上的一筆紀錄：日期、分類、可改的進度狀態、刪除
function EntryCard({
  t,
  onSetStatus,
  onSetDue,
  onRemove,
  onError,
}: {
  t: Entry;
  onSetStatus: EntryHandlers["onSetStatus"];
  onSetDue: EntryHandlers["onSetDue"];
  onRemove: () => Promise<void>;
  onError: (msg: string | null) => void;
}) {
  const run = async (fn: () => Promise<void>) => {
    onError(null);
    try {
      await fn();
    } catch (e) {
      onError((e as Error).message);
    }
  };
  const overdue = !!t.dueDate && t.dueDate < today() && t.status === "待追蹤";
  return (
    <div className="card px-4 py-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="num font-medium">{t.date || "未註明日期"}</span>
        <span className="rounded bg-line px-1.5 py-0.5 text-muted">{t.category}</span>
        {t.legacy ? (
          <span className="text-muted">舊版筆記</span>
        ) : (
          <select
            value={t.status}
            onChange={(e) => run(() => onSetStatus(t.id, e.target.value))}
            aria-label="進度狀態"
            className={`cursor-pointer rounded border border-line bg-transparent px-1.5 py-0.5 font-medium ${statusCls(t.status)}`}
          >
            {STATUSES.map((st) => (
              <option key={st}>{st}</option>
            ))}
          </select>
        )}
        <button
          onClick={() => run(onRemove)}
          aria-label="刪除這筆紀錄"
          title="刪除"
          className="ml-auto flex h-6 w-6 items-center justify-center rounded-full text-base text-muted transition hover:bg-up-soft hover:text-up"
        >
          ×
        </button>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{t.text}</p>
      {!t.legacy && (DUE_CATEGORIES.includes(t.category) || t.dueDate) && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <label className="flex items-center gap-2">
            <span className="text-muted">預計完成</span>
            <input
              type="date"
              value={t.dueDate}
              onChange={(e) => run(() => onSetDue(t.id, e.target.value))}
              aria-label="預計完成日"
              className={`num cursor-pointer rounded border border-line bg-transparent px-1.5 py-0.5 font-medium ${
                t.dueDate ? "" : "text-muted"
              }`}
            />
          </label>
          {t.dueDate && (
            <button
              onClick={() => run(() => onSetDue(t.id, ""))}
              className="text-muted transition hover:text-up"
              aria-label="清除預計完成日"
              title="清除預計完成日"
            >
              清除
            </button>
          )}
          {overdue && (
            <span className="rounded bg-up-soft px-1.5 py-0.5 font-medium text-up">已逾期，請確認進度</span>
          )}
        </div>
      )}
    </div>
  );
}

function TimelineTab({
  item,
  onAdd,
  onSetStatus,
  onSetDue,
  onRemove,
  onClearLegacy,
}: EntryHandlers & { item: WatchItem; onClearLegacy: () => Promise<void> }) {
  const [filter, setFilter] = useState<string>("全部");
  const [error, setError] = useState<string | null>(null);

  // 舊版的單一筆記：還留著的話當作一筆「其他」紀錄顯示，可以刪除
  const entries: Entry[] = [
    ...(item.timeline ?? []),
    ...(item.note ? [{ id: "legacy", date: item.noteAt ?? "", category: "其他", text: item.note, status: "待追蹤", dueDate: "", legacy: true }] : []),
  ].sort((a, b) => b.date.localeCompare(a.date));
  const shown = filter === "全部" ? entries : entries.filter((t) => t.category === filter);

  return (
    <div className="space-y-5">
      <EntryForm
        categories={CATEGORIES}
        onAdd={onAdd}
        placeholder="記下這個時間點的事實或預期，例如：法說會預期 Q4 EPS 15 元、新廠 2027 Q2 量產、月產能目標 10 萬片…"
      />

      <div className="flex flex-wrap gap-2">
        {["全部", ...CATEGORIES].map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            aria-pressed={filter === c}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              filter === c ? "border-fg bg-fg text-bg" : "border-line text-muted hover:text-fg"
            }`}
          >
            {c}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm text-up">
          {error}
        </p>
      )}

      {shown.length === 0 ? (
        <div className="card p-8 text-center text-sm text-muted">
          {entries.length === 0
            ? "時間軸是空的。定期記下公司的 EPS、產能、擴廠進度與你的預期，之後就能回頭對照有沒有照著走。"
            : "這個分類還沒有紀錄。"}
        </div>
      ) : (
        <ol className="relative ml-2 border-l border-line pl-6">
          {shown.map((t) => (
            <li key={t.id} className="relative pb-6 last:pb-0">
              <span className={`absolute -left-[1.85rem] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-bg ${statusDot(t.status)}`} />
              <EntryCard
                t={t}
                onSetStatus={onSetStatus} onSetDue={onSetDue}
                onRemove={() => (t.legacy ? onClearLegacy() : onRemove(t.id))}
                onError={setError}
              />
            </li>
          ))}
        </ol>
      )}
      <p className="text-xs text-muted">
        由新到舊排列。進度可以之後回來改：待追蹤 → 符合預期／超前／落後，用來對照公司實際有沒有照你記下的預期走。
      </p>
    </div>
  );
}

// EPS 分頁的對照時間軸：把財報公布的實際 EPS 和你記下的 EPS／財測預期放在同一條時間軸上
function EpsTimeline({
  rows,
  timeline,
  onAdd,
  onSetStatus,
  onSetDue,
  onRemove,
}: EntryHandlers & { rows: EpsRow[]; timeline: TimelineEntry[] }) {
  const [error, setError] = useState<string | null>(null);

  type Item =
    | { kind: "actual"; key: string; date: string; row: EpsRow; prev: EpsRow | undefined }
    | { kind: "note"; key: string; date: string; entry: TimelineEntry };
  const items: Item[] = [
    ...rows.map((r, i): Item => ({ kind: "actual", key: "a" + r.date, date: r.date, row: r, prev: rows[i - 1] })),
    ...timeline
      .filter((t) => t.category === "EPS" || t.category === "財測")
      .map((t): Item => ({ kind: "note", key: "n" + t.id, date: t.date, entry: t })),
  ].sort((a, b) => b.date.localeCompare(a.date) || (a.kind === "actual" ? 1 : -1));

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-sm font-bold">預期 vs 實際</h3>
        <p className="mt-0.5 text-xs text-muted">
          在財報公布前記下你的 EPS／財測預期，公布後對照下面的實際數字，回頭把進度改成符合預期、超前或落後。
        </p>
      </div>

      <EntryForm
        categories={["EPS", "財測"]}
        onAdd={onAdd}
        placeholder="例如：法說會預期 Q4 EPS 15 元、全年 EPS 上看 58 元…"
      />
      {error && (
        <p role="alert" className="text-sm text-up">
          {error}
        </p>
      )}

      <ol className="relative ml-2 border-l border-line pl-6">
        {items.map((it) => (
          <li key={it.key} className="relative pb-5 last:pb-0">
            {it.kind === "actual" ? (
              <>
                <span className="absolute -left-[1.85rem] top-2.5 h-2.5 w-2.5 rounded-full border-2 border-fg bg-bg ring-4 ring-bg" />
                <div className="rounded-xl border border-dashed border-line px-4 py-2.5 text-sm">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="num text-xs text-muted">{it.date}</span>
                    <span className="rounded bg-fg px-1.5 py-0.5 text-[0.65rem] font-medium text-bg">財報實際</span>
                    <span className="font-medium">{quarter(it.date)}</span>
                    <span className={`num font-bold ${trendColor(it.row.eps)}`}>
                      EPS {it.row.eps === null ? "—" : fmt(it.row.eps, 2)}
                    </span>
                    {it.row.eps !== null && it.prev?.eps != null && it.prev.eps !== 0 && (
                      <span className="num text-xs text-muted">
                        較上季 {signed(((it.row.eps - it.prev.eps) / Math.abs(it.prev.eps)) * 100)}
                      </span>
                    )}
                    <span className="num text-xs text-muted">毛利率 {pct(it.row.grossMargin)}</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <span className={`absolute -left-[1.85rem] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-bg ${statusDot(it.entry.status)}`} />
                <EntryCard
                  t={it.entry}
                  onSetStatus={onSetStatus} onSetDue={onSetDue}
                  onRemove={() => onRemove(it.entry.id)}
                  onError={setError}
                />
              </>
            )}
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted">
        空心圓是財報公布的單季實際數字（日期為該季季末），實心圓是你記下的預期。這裡只列 EPS、財測兩類紀錄，其他類別在「追蹤筆記」。
      </p>
    </section>
  );
}

// 產能與擴廠分頁：記下公司宣布的產能、擴廠計畫與時程，之後回頭對照實際進度
const CAPACITY_CATEGORIES = ["產能", "擴廠"] as const;

function CapacityTab({ timeline, onAdd, onSetStatus, onSetDue, onRemove }: EntryHandlers & { timeline: TimelineEntry[] }) {
  const [filter, setFilter] = useState<string>("全部");
  const [error, setError] = useState<string | null>(null);

  const all = timeline.filter((t) => (CAPACITY_CATEGORIES as readonly string[]).includes(t.category));
  const shown = (filter === "全部" ? all : all.filter((t) => t.category === filter)).sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  const count = (st: string) => all.filter((t) => t.status === st).length;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-bold">產能與擴廠進度對照</h3>
        <p className="mt-0.5 text-xs text-muted">
          把法說會或新聞裡的產能、擴廠計畫與時程記下來（例如「新廠 2027 Q2 量產、月產能 10 萬片」），
          之後回來對照實際有沒有照著走，並更新進度。
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STATUSES.map((st) => (
          <div key={st} className="card flex items-center gap-3 px-4 py-3">
            <span className={`h-2.5 w-2.5 rounded-full ${statusDot(st)}`} />
            <div>
              <div className="text-xs text-muted">{st}</div>
              <div className={`num text-xl font-bold ${statusCls(st)}`}>{count(st)}</div>
            </div>
          </div>
        ))}
      </div>

      <EntryForm
        categories={CAPACITY_CATEGORIES}
        onAdd={onAdd}
        placeholder="例如：董事長表示高雄新廠預計 2027 Q2 量產，月產能 10 萬片；擴廠資本支出 800 億元…"
      />

      <div className="flex flex-wrap gap-2">
        {["全部", ...CAPACITY_CATEGORIES].map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            aria-pressed={filter === c}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              filter === c ? "border-fg bg-fg text-bg" : "border-line text-muted hover:text-fg"
            }`}
          >
            {c}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm text-up">
          {error}
        </p>
      )}

      {shown.length === 0 ? (
        <div className="card p-8 text-center text-sm text-muted">
          {all.length === 0 ? "還沒有產能或擴廠紀錄。" : "這個分類還沒有紀錄。"}
        </div>
      ) : (
        <ol className="relative ml-2 border-l border-line pl-6">
          {shown.map((t) => (
            <li key={t.id} className="relative pb-6 last:pb-0">
              <span className={`absolute -left-[1.85rem] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-bg ${statusDot(t.status)}`} />
              <EntryCard t={t} onSetStatus={onSetStatus} onSetDue={onSetDue} onRemove={() => onRemove(t.id)} onError={setError} />
            </li>
          ))}
        </ol>
      )}
      <p className="text-xs text-muted">
        由新到舊排列，只列產能、擴廠兩類紀錄，其他類別在「追蹤筆記」。上面的數字是各進度狀態的筆數。
      </p>
    </div>
  );
}

type Broker = { institution: string; target: number; date: string; title: string; link: string };

type Row = {
  key: string;
  institution: string;
  target: number;
  date: string;
  sub: string;
  link?: string;
  manualId?: string;
};

const today = () => new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD（本地時區）

function BrokerList({
  code,
  price,
  manual,
  onAdd,
  onRemove,
}: {
  code: string;
  price: number | null;
  manual: ManualBroker[];
  onAdd: Props["onAddBroker"];
  onRemove: Props["onRemoveBroker"];
}) {
  const [news, setNews] = useState<Broker[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [institution, setInstitution] = useState("");
  const [target, setTarget] = useState("");
  const [date, setDate] = useState(today);

  useEffect(() => {
    getJson<{ brokers: Broker[] }>(`/api/target-news?code=${code}`)
      .then((r) => setNews(r.brokers))
      .catch((e: Error) => setError(e.message));
  }, [code]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      await onAdd({ institution: institution.trim(), target: Number(target), date });
      setInstitution("");
      setTarget("");
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setFormError(null);
    try {
      await onRemove(id);
    } catch (err) {
      setFormError((err as Error).message);
    }
  }

  // 手動輸入優先：同一機構已手動輸入時，隱藏新聞擷取的那筆
  const manualNames = new Set(manual.map((m) => m.institution));
  const rows: Row[] = [
    ...manual.map((m) => ({
      key: "m" + m.id,
      institution: m.institution,
      target: m.target,
      date: m.date,
      sub: "手動輸入",
      manualId: m.id,
    })),
    ...(news ?? [])
      .filter((b) => !manualNames.has(b.institution))
      .map((b) => ({
        key: "n" + b.institution,
        institution: b.institution,
        target: b.target,
        date: b.date,
        sub: b.title,
        link: b.link,
      })),
  ].sort((a, b) => b.date.localeCompare(a.date) || b.target - a.target);

  return (
    <section>
      <h3 className="mb-3 text-sm font-bold">各機構目標價</h3>

      {error && <p className="mb-2 text-sm text-muted">新聞擷取失敗（{error}），仍可手動輸入。</p>}

      {rows.length === 0 ? (
        news === null && !error ? (
          <div className="card h-28 animate-pulse" />
        ) : (
          <div className="card p-6 text-center text-sm text-muted">
            還沒有機構目標價。近半年新聞沒有擷取到，你可以在下面手動新增。
          </div>
        )
      ) : (
        <div className="card divide-y divide-line">
          {rows.map((b) => {
            const up = price ? ((b.target - price) / price) * 100 : null;
            const body = (
              <>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 font-medium">
                    {b.institution}
                    {b.manualId && (
                      <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[0.65rem] font-medium text-accent">手動</span>
                    )}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted">
                    {b.date}・{b.sub}
                  </div>
                </div>
                <div className="text-right">
                  <div className="num text-lg font-bold">{price0(b.target)}</div>
                  {up !== null && <div className={`num text-xs ${trendColor(up)}`}>{signed(up)}</div>}
                </div>
              </>
            );
            return (
              <div key={b.key} className="flex items-center gap-2 pr-2 transition hover:bg-surface-2">
                {b.link ? (
                  <a href={b.link} target="_blank" rel="noopener noreferrer" className="flex flex-1 items-center gap-4 px-5 py-3.5">
                    {body}
                  </a>
                ) : (
                  <div className="flex flex-1 items-center gap-4 px-5 py-3.5">{body}</div>
                )}
                {b.manualId && (
                  <button
                    onClick={() => remove(b.manualId!)}
                    aria-label={`刪除 ${b.institution} 的目標價`}
                    title="刪除"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg text-muted transition hover:bg-up-soft hover:text-up"
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <form onSubmit={submit} className="card mt-3 flex flex-wrap items-end gap-3 p-4">
        <label className="flex min-w-[9rem] flex-1 flex-col gap-1 text-xs text-muted">
          機構
          <input
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
            maxLength={30}
            placeholder="例如 摩根士丹利"
            className="field"
          />
        </label>
        <label className="flex w-28 flex-col gap-1 text-xs text-muted">
          目標價
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            inputMode="decimal"
            type="number"
            min="0"
            step="any"
            placeholder="3000"
            className="field"
          />
        </label>
        <label className="flex w-40 flex-col gap-1 text-xs text-muted">
          日期
          <input value={date} onChange={(e) => setDate(e.target.value)} type="date" className="field" />
        </label>
        <button type="submit" disabled={busy || !institution.trim() || !target || !date} className="btn-primary whitespace-nowrap">
          {busy ? "新增中…" : "新增"}
        </button>
        {formError && (
          <p role="alert" className="w-full text-sm text-up">
            {formError}
          </p>
        )}
      </form>

      <p className="mt-2 text-xs text-muted">
        「手動」是你自己輸入的；其餘由鉅亨網新聞自動比對擷取，可能漏抓或誤判，可點進原文核對。同一機構只列最新一筆，手動輸入優先，依日期由新到舊排列。
      </p>
    </section>
  );
}
