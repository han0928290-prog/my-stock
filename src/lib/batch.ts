// 多檔股票一起查外部 API：限制同時送出的請求數，單檔失敗回 null 不影響其他檔
export async function mapCodes<T>(
  codes: string[],
  fn: (code: string) => Promise<T>,
  concurrency = 4,
): Promise<Record<string, T | null>> {
  const out: Record<string, T | null> = {};
  const queue = [...codes];
  const worker = async () => {
    for (let code = queue.shift(); code !== undefined; code = queue.shift()) {
      out[code] = await fn(code).catch(() => null);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));
  return out;
}
