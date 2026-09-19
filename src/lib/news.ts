// Yahoo奇摩股市個股新聞 RSS：?s=股票代號
const RSS_URL = "https://tw.stock.yahoo.com/rss";
const MAX_ITEMS = 20;

export type NewsItem = {
  title: string;
  link: string;
  summary: string;
  publishedAt: string | null;
};

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
};

// 取出標籤內文字，並處理 CDATA 與 HTML 實體
function tagText(xml: string, tag: string) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  if (!m) return "";
  const raw = m[1].trim();
  const cdata = raw.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  if (cdata) return cdata[1].trim();
  return raw.replace(/&(amp|lt|gt|quot|#39|apos);/g, (e) => ENTITIES[e]);
}

export async function fetchNews(code: string): Promise<NewsItem[]> {
  const res = await fetch(`${RSS_URL}?s=${code}`, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Yahoo RSS responded ${res.status}`);
  const xml = await res.text();

  return (xml.match(/<item>[\s\S]*?<\/item>/g) ?? [])
    .slice(0, MAX_ITEMS)
    .map((item) => {
      const pubDate = new Date(tagText(item, "pubDate"));
      return {
        title: tagText(item, "title"),
        link: tagText(item, "link"),
        summary: tagText(item, "description"),
        publishedAt: Number.isNaN(pubDate.getTime()) ? null : pubDate.toISOString(),
      };
    })
    // 只保留 http(s) 連結，避免 RSS 內容夾帶 javascript: 等惡意連結
    .filter((n) => n.title && /^https?:\/\//.test(n.link));
}
