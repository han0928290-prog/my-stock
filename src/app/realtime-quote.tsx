import { fmt, trendColor, type Level, type Realtime } from "./lib";

export default function RealtimeQuote({ quote }: { quote: Realtime }) {
  const color = trendColor(quote.change);
  const sign = (quote.change ?? 0) > 0 ? "+" : "";
  const d = quote.date;

  return (
    <section>
      <p className="text-sm text-zinc-500">
        {quote.code} {quote.name}
        <span className="ml-2">
          {d.slice(0, 4)}-{d.slice(4, 6)}-{d.slice(6)} {quote.time}（TWSE 即時）
        </span>
      </p>

      <div className="mt-1 flex items-end gap-4">
        <span className={`text-5xl font-semibold ${color}`}>{fmt(quote.price)}</span>
        <span className={`pb-1 text-lg ${color}`}>
          {sign}
          {fmt(quote.change)}（{sign}
          {fmt(quote.changePercent)}%）
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm sm:grid-cols-6">
        {[
          ["昨收", fmt(quote.prevClose)],
          ["開盤", fmt(quote.open)],
          ["最高", fmt(quote.high)],
          ["最低", fmt(quote.low)],
          ["漲跌停", `${fmt(quote.limitDown)} / ${fmt(quote.limitUp)}`],
          ["累積量(張)", fmt(quote.totalVolume, 0)],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-zinc-500">{label}</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 grid grid-cols-2 gap-6 text-sm">
        {(
          [
            ["委買（五檔）", quote.bids, "text-red-500"],
            ["委賣（五檔）", quote.asks, "text-green-600"],
          ] as [string, Level[], string][]
        ).map(([title, levels, cls]) => (
          <div key={title}>
            <h3 className="mb-1 text-zinc-500">{title}</h3>
            <ul className="space-y-0.5 tabular-nums">
              {levels.map((l, i) => (
                <li key={i} className="flex justify-between">
                  <span className={cls}>{fmt(l.price)}</span>
                  <span>{fmt(l.volume, 0)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
