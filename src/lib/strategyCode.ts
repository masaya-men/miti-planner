// src/lib/strategyCode.ts
// FF14 ストラテジーボード共有コードを PS5 で貼りやすい長さに分割する純関数群。
// コードの中身は一切解釈しない（ただ刻むだけ）。

// PS Remote Play(スマホ)→PS5 への共有コード貼り付けは「90文字以内での分割が必須」
// (一次情報: コミュニティ攻略記事で明記。90 超は実機リモプのキーボードが弾き
//  「無効な文字があります」になる)。旧既定170/上限180は長すぎて貼れなかった。
/** 1 断片あたりの既定文字数。90字制限に安全マージンを取った値。 */
export const DEFAULT_CHUNK_SIZE = 88;
/** 調整スライダーの下限(さらに細かく刻みたい人向け)。 */
export const MIN_CHUNK_SIZE = 40;
/** 調整スライダーの上限。PS Remote Play の貼り付け上限(90字)を超えない。 */
export const MAX_CHUNK_SIZE = 90;

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
