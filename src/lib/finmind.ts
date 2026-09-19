const FINMIND_URL = "https://api.finmindtrade.com/api/v4/data";

// token 選填：有設定 FINMIND_TOKEN 就帶上，額度較高
export async function finmind<T>(
  dataset: string,
  code: string,
  days: number,
  revalidate = 300,
): Promise<T[]> {
  const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const url = new URL(FINMIND_URL);
  url.searchParams.set("dataset", dataset);
  url.searchParams.set("data_id", code);
  url.searchParams.set("start_date", start);

  const headers: HeadersInit = {};
  if (process.env.FINMIND_TOKEN) {
    headers.Authorization = `Bearer ${process.env.FINMIND_TOKEN}`;
  }

  const res = await fetch(url, { headers, next: { revalidate } });
  const body = await res.json();
  if (!res.ok || body.status !== 200) {
    throw new Error(body.msg ?? `FinMind responded ${res.status}`);
  }
  return body.data as T[];
}
