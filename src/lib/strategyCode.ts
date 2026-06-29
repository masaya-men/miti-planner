// src/lib/strategyCode.ts
// FF14 ストラテジーボード共有コードを PS5 で貼りやすい長さに分割する純関数群。
// コードの中身は一切解釈しない（ただ刻むだけ）。

/** 1 断片あたりの既定文字数。PS5 の貼り付け上限(確認できた一次ソースで180)に対する安全マージン。 */
export const DEFAULT_CHUNK_SIZE = 170;
/** 調整スライダーの下限。 */
export const MIN_CHUNK_SIZE = 80;
/** 調整スライダーの上限。 */
export const MAX_CHUNK_SIZE = 180;

/**
 * 入力から全空白文字（スペース/改行/タブ等）を除去する。
 * フォーラム等からのコピペで改行が紛れ込むため。stgy コードは内部に空白を含まない
 * 連続トークンである前提（`+ - _ =` 等の記号は含み得るので除去しない）。
 */
export function normalizeStrategyCode(raw: string): string {
  return raw.replace(/\s/g, '');
}

/**
 * 正規化後の文字列を chunkSize 文字ごとに機械的に分割する。
 * 返り値を連結すると必ず正規化後文字列に一致する（区切り位置の特別配慮は不要）。
 */
export function splitStrategyCode(raw: string, chunkSize: number): string[] {
  const s = normalizeStrategyCode(raw);
  if (s.length === 0) return [];
  const size = Math.max(1, Math.floor(chunkSize));
  const chunks: string[] = [];
  for (let i = 0; i < s.length; i += size) {
    chunks.push(s.slice(i, i + size));
  }
  return chunks;
}
