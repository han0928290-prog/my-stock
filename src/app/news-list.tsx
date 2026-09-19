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
    <section>
      <h2 className="mb-3 text-sm text-zinc-500">相關新聞（Yahoo奇摩股市）</h2>
      {error ? (
        <p className="text-red-500">新聞載入失敗：{error}</p>
      ) : !items ? (
        <p className="text-zinc-400">載入中…</p>
      ) : items.length === 0 ? (
        <p className="text-zinc-400">目前沒有相關新聞</p>
      ) : (
        <ul className="divide-y divide-zinc-500/20">
          {items.map((n) => (
            <li key={n.link} className="py-3">
              <a href={n.link} target="_blank" rel="noopener noreferrer" className="group block">
                <span className="font-medium group-hover:underline">{n.title}</span>
                {n.summary && (
                  <p className="mt-1 line-clamp-2 text-sm text-zinc-500">{n.summary}</p>
                )}
                <span className="mt-1 block text-xs text-zinc-400">{timeAgo(n.publishedAt)}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
