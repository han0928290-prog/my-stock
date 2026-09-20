"use client";

import { fmt, trendColor, type Realtime } from "./lib";

type Props = {
  code: string;
  name: string;
  favorite: boolean;
  quote: Realtime | undefined;
  target: number | null | undefined; // undefined = 還在載入，null = 查無目標價
  onOpen: () => void;
  onToggleFavorite: () => void;
  onRemove: () => void;
};

export default function StockRow({ code, name, favorite, quote, target, onOpen, onToggleFavorite, onRemove }: Props) {
  const price = quote?.price ?? null;
  const growth = price && target ? ((target - price) / price) * 100 : null;

  return (
    <div className="card flex items-center gap-2 pr-2 transition hover:!border-muted/40">
      <button onClick={onOpen} className="min-w-0 flex-1 px-4 py-3 text-left">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-base font-bold">{name}</span>
          <span className="num text-sm text-muted">{code}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-sm text-muted">
          <span>
            現價 <span className="num">{price === null ? "—" : fmt(price, price >= 100 ? 0 : 2)}</span>
          </span>
          <span className="h-3.5 w-px bg-line" />
          <span>
            預期成長{" "}
            {growth === null ? (
              <span className="num">{target === undefined ? "…" : "—"}</span>
            ) : (
              <span className={`num ${trendColor(growth)}`}>{fmt(growth, 1)}%</span>
            )}
          </span>
        </div>
      </button>

      <button
        onClick={onToggleFavorite}
        aria-label={favorite ? `將 ${name} 移出我的最愛` : `將 ${name} 加入我的最愛`}
        aria-pressed={favorite}
        title={favorite ? "移出我的最愛" : "加入我的最愛"}
        className={`flex h-9 w-9 items-center justify-center rounded-full text-xl transition hover:bg-line ${
          favorite ? "text-amber-500" : "text-muted/40 hover:text-amber-500"
        }`}
      >
        {favorite ? "★" : "☆"}
      </button>
      <button
        onClick={onRemove}
        aria-label={`從追蹤清單刪除 ${name}`}
        title="從追蹤清單刪除"
        className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-muted transition hover:bg-up-soft hover:text-up"
      >
        ×
      </button>
    </div>
  );
}
