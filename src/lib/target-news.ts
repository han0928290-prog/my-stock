// 從鉅亨網新聞擷取「各機構目標價」。沒有結構化資料來源，所以是用文字比對，結果只供參考，
// 每筆都附上原文連結讓使用者核對。任何一步失敗都只是少一筆，不會讓整體失敗。
import { fetchQuotes } from "@/lib/mis";

export type BrokerTarget = {
  institution: string;
  target: number;
  date: string; // YYYY-MM-DD（新聞日期）
  title: string;
  link: string;
};

const UA = { "User-Agent": "Mozilla/5.0" };
const TTL = 6 * 60 * 60 * 1000;
const MAX_ARTICLES = 12;
const MAX_AGE_DAYS = 180;

// 別名 → 顯示名稱。長的放前面，避免「摩根」先吃掉「摩根士丹利」
const INSTITUTIONS: [RegExp, string][] = [
  [/摩根士丹利|大摩/, "摩根士丹利"],
  [/摩根大通|小摩|JP\s?Morgan/i, "摩根大通"],
  [/高盛|Goldman/i, "高盛"],
  [/美林|美銀|Bank of America/i, "美銀美林"],
  [/瑞銀|UBS/, "瑞銀"],
  [/花旗|Citi/i, "花旗"],
  [/摩根史丹利/, "摩根士丹利"],
  [/大和/, "大和"],
  [/野村/, "野村"],
  [/麥格理/, "麥格理"],
  [/里昂/, "里昂"],
  [/匯豐|HSBC/i, "匯豐"],
  [/德意志|Deutsche/i, "德意志"],
  [/瑞穗/, "瑞穗"],
  [/星展|DBS/, "星展"],
  [/杰富瑞|Jefferies/i, "杰富瑞"],
  [/富達/, "富達"],
  [/巴克萊|Barclays/i, "巴克萊"],
  [/法巴|BNP/, "法巴"],
  [/瑞信|Credit Suisse/i, "瑞信"],
  [/元大/, "元大投顧"],
  [/凱基/, "凱基"],
  [/富邦投顧|富邦證券|富邦/, "富邦"],
  [/群益/, "群益"],
  [/統一投顧|統一證券/, "統一"],
  [/國泰證券|國泰/, "國泰"],
  [/中信投顧|中信證券|中信/, "中信"],
  [/永豐/, "永豐"],
  [/兆豐/, "兆豐"],
  [/新光/, "新光"],
  [/日盛/, "日盛"],
  [/華南永昌|華南/, "華南永昌"],
  [/玉山/, "玉山"],
  [/康和/, "康和"],
  [/國票/, "國票"],
  [/第一金/, "第一金"],
  [/台新/, "台新"],
  [/宏遠/, "宏遠"],
  [/港商|外資/, "外資（未具名）"],
];

const cache = new Map<string, { at: number; value: BrokerTarget[] }>();

const num = (s: string) => Number(s.replace(/,/g, ""));

async function searchNews(keyword: string) {
  const u = new URL("https://ess.api.cnyes.com/ess/api/v1/news/keyword");
  u.searchParams.set("q", keyword);
  u.searchParams.set("limit", "30");
  const res = await fetch(u, { headers: UA, cache: "no-store" });
  if (!res.ok) return [];
  const j = await res.json().catch(() => null);
  const items: { newsId: number; title: string; publishAt: number }[] = j?.data?.items ?? j?.items?.data ?? [];
  return items;
}

async function articleText(id: number) {
  const res = await fetch(`https://news.cnyes.com/news/id/${id}`, { headers: UA, cache: "no-store" });
  if (!res.ok) return "";
  const html = await res.text();
  // 內文在 ld+json 的 articleBody；沒有就退回整頁去標籤
  const m = html.match(/"articleBody"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (m) {
    try {
      return JSON.parse(`"${m[1]}"`) as string;
    } catch {
      /* 落到下面 */
    }
  }
  return html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/g, " ");
}

// 在內文中找「某機構 … 目標價 … N 元」，回傳 [機構, 目標價]。價格要落在現價的 0.4~4 倍，過濾掉誤判
function extract(text: string, price: number | null): [string, number] | null {
  const sentences = text.replace(/\s+/g, " ").split(/[。！？\n]/);
  for (const s of sentences) {
    const at = s.search(/目標(?:股)?價/);
    if (at < 0) continue;
    const inst = INSTITUTIONS.find(([re]) => re.test(s));
    if (!inst) continue;
    // 「目標價」之後的所有「數字 + 元」，取最後一個（「由 2888 元上調至 2988 元」→ 2988）
    const after = s.slice(at);
    const nums = [...after.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*(?:新臺幣|新台幣|美元|元)/g)].map((m) => num(m[1]));
    const v = nums[nums.length - 1];
    if (v === undefined || !Number.isFinite(v)) continue;
    if (price && (v < price * 0.4 || v > price * 4)) continue;
    return [inst[1], v];
  }
  return null;
}

export async function getBrokerTargets(code: string): Promise<BrokerTarget[]> {
  const hit = cache.get(code);
  if (hit && Date.now() - hit.at < TTL) return hit.value;

  const [quote] = await fetchQuotes([code]).catch(() => []);
  const name = quote?.name as string | undefined;
  if (!name) return [];
  const price = (quote?.price as number | null) ?? null;

  const since = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  // 關鍵字搜尋是模糊比對，換幾種說法各查一次再合併去重
  const batches = await Promise.all(
    [`${name}目標價`, `${name}調升目標價`, `${name}調降目標價`, `${name}外資 目標價`].map((q) => searchNews(q).catch(() => [])),
  );
  const seen = new Set<number>();
  const news = batches
    .flat()
    .filter((n) => !seen.has(n.newsId) && seen.add(n.newsId))
    .filter((n) => n.publishAt * 1000 >= since && String(n.title).includes("目標價") && String(n.title).includes(name))
    .sort((a, b) => b.publishAt - a.publishAt)
    .slice(0, MAX_ARTICLES);

  const found = await Promise.all(
    news.map(async (n): Promise<BrokerTarget | null> => {
      try {
        const r = extract(await articleText(n.newsId), price);
        if (!r) return null;
        return {
          institution: r[0],
          target: r[1],
          date: new Date(n.publishAt * 1000).toISOString().slice(0, 10),
          title: String(n.title).replace(/<[^>]+>/g, ""),
          link: `https://news.cnyes.com/news/id/${n.newsId}`,
        };
      } catch {
        return null;
      }
    }),
  );

  // 同一機構只留最新一筆
  const byInst = new Map<string, BrokerTarget>();
  for (const f of found.filter((x): x is BrokerTarget => x !== null).sort((a, b) => b.date.localeCompare(a.date))) {
    if (!byInst.has(f.institution)) byInst.set(f.institution, f);
  }
  const value = [...byInst.values()];
  cache.set(code, { at: Date.now(), value });
  return value;
}
