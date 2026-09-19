"use client";

import { useEffect, useState } from "react";
import { getJson } from "./lib";

type NewsItem = {
  title: string;
  link: string;
  summary: string;
  publishedAt: string | null;
};

function timeAgo(iso: string | null) {
  if (!iso) return "";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "剛剛";
  if (mins < 60) return `${mins} 分鐘前`;
  if (mins < 60 * 24) return `${Math.floor(mins / 60)} 小時前`;
  return `${Math.floor(mins / 60 / 24)} 天前`;
}

export default function NewsList({ code }: { code: string }) {
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getJson<{ items: NewsItem[] }>(`/api/news?code=${code}`)
      .then((r) => setItems(r.items))
      .catch((e: Error) => setError(e.message));
  }, [code]);

  return (
    <section className="card p-6 sm:p-8">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-serif text-lg font-bold">相關新聞</h2>
        <span className="label">Yahoo奇摩股市</span>
      </div>

      {error ? (
        <p className="text-up">新聞載入失敗：{error}</p>
      ) : !items ? (
        <div className="space-y-4 py-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-3/4 animate-pulse rounded bg-line" />
              <div className="h-3 w-full animate-pulse rounded bg-line" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="py-6 text-center text-muted">目前沒有相關新聞</p>
      ) : (
        <ul className="-mx-3 divide-y divide-line/70">
          {items.map((n) => (
            <li key={n.link}>
              <a
                href={n.link}
                target="_blank"
                rel="noopener noreferrer"
                className="group block rounded-xl px-3 py-4 transition hover:bg-surface-2"
              >
                <span className="font-medium leading-snug transition group-hover:text-accent">
                  {n.title}
                </span>
                {n.summary && (
                  <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted">{n.summary}</p>
                )}
                <span className="label mt-2 block">{timeAgo(n.publishedAt)}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
