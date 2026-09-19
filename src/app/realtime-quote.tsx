import { fmt, trendArrow, trendColor, trendPill, type Level, type Realtime } from "./lib";

// 五檔：每列背後用長條表示相對掛單量
function Book({ title, levels, tone }: { title: string; levels: Level[]; tone: "up" | "down" }) {
  const max = Math.max(1, ...levels.map((l) => l.volume ?? 0));
  const bar = tone === "up" ? "bg-up-soft" : "bg-down-soft";
  const text = tone === "up" ? "text-up" : "text-down";

  return (
    <div>
      <h3 className="label mb-2">{title}</h3>
      <ul className="space-y-1 text-sm">
        {levels.map((l, i) => (
          <li key={i} className="relative flex justify-between overflow-hidden rounded-md px-2 py-1">
            <span
              aria-hidden
              className={`absolute inset-y-0 right-0 ${bar}`}
              style={{ width: `${((l.volume ?? 0) / max) * 100}%` }}
            />
            <span className={`num relative font-medium ${text}`}>{fmt(l.price)}</span>
            <span className="num relative text-muted">{fmt(l.volume, 0)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function RealtimeQuote({ quote }: { quote: Realtime }) {
  const d = quote.date;

  return (
    <section className="card p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-baseline gap-3">
            <h2 className="font-serif text-2xl font-bold">{quote.name}</h2>
            <span className="num text-sm text-muted">{quote.code}</span>
          </div>
          <p className="num mt-1 text-xs text-muted">
            {d.slice(0, 4)}-{d.slice(4, 6)}-{d.slice(6)} {quote.time}
          </p>
        </div>

        <div className="text-right">
          <div className={`num text-5xl font-semibold leading-none tracking-tight sm:text-6xl ${trendColor(quote.change)}`}>
            {fmt(quote.price)}
          </div>
          <span
            className={`num mt-3 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-medium ${trendPill(quote.change)}`}
          >
            {trendArrow(quote.change)} {fmt(Math.abs(quote.change ?? 0))}
            <span className="opacity-70">({fmt(Math.abs(quote.changePercent ?? 0))}%)</span>
          </span>
        </div>
      </div>

      <dl className="mt-7 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4 lg:grid-cols-7">
        {[
          ["昨收", fmt(quote.prevClose)],
          ["開盤", fmt(quote.open)],
          ["最高", fmt(quote.high)],
          ["最低", fmt(quote.low)],
          ["漲停", fmt(quote.limitUp)],
          ["跌停", fmt(quote.limitDown)],
          ["累積量（張）", fmt(quote.totalVolume, 0)],
        ].map(([label, value]) => (
          <div key={label} className="bg-surface px-4 py-3">
            <dt className="label">{label}</dt>
            <dd className="num mt-1 font-medium">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-7 grid gap-6 sm:grid-cols-2">
        <Book title="委買（五檔）" levels={quote.bids} tone="up" />
        <Book title="委賣（五檔）" levels={quote.asks} tone="down" />
      </div>
    </section>
  );
}
