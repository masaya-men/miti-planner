// DO ストレージへ Yjs バイナリをチャンク保存/復元/破棄する。
// DO KV は値 128KiB 上限のため CHUNK_SIZE で分割。
// 最小依存（put/get/list/delete だけ）でテスト容易。

export interface KVLike {
  put(entries: Record<string, unknown>): Promise<void>;
  put(key: string, value: unknown): Promise<void>;
  get<T = unknown>(key: string): Promise<T | undefined>;
  list(opts: { prefix: string }): Promise<Map<string, unknown>>;
  delete(keys: string | string[]): Promise<unknown>;
}

const CHUNK_PREFIX = "ydoc:chunk:";
const META_KEY = "ydoc:meta";
const CHUNK_SIZE = 120 * 1024; // 120KiB < 128KiB 値上限

interface DocMeta {
  chunkCount: number;
  byteLength: number;
}

/** Yjs バイナリを 120KiB チャンクに分割して保存（古いチャンクは先に全削除）。 */
export async function saveDocBinary(storage: KVLike, update: Uint8Array): Promise<void> {
  await clearDocBinary(storage);
  const chunks: Record<string, unknown> = {};
  let n = 0;
  for (let off = 0; off < update.length; off += CHUNK_SIZE) {
    chunks[`${CHUNK_PREFIX}${n}`] = update.slice(off, off + CHUNK_SIZE);
    n++;
  }
  if (n > 0) await storage.put(chunks);
  const meta: DocMeta = { chunkCount: n, byteLength: update.length };
  await storage.put(META_KEY, meta);
}

/** チャンクを連結して Yjs バイナリを復元。保存が無い/壊れていれば null（初回 seed へフォールバック）。 */
export async function loadDocBinary(storage: KVLike): Promise<Uint8Array | null> {
  const meta = await storage.get<DocMeta>(META_KEY);
  if (!meta || meta.chunkCount === 0) return null;
  const out = new Uint8Array(meta.byteLength);
  let offset = 0;
  for (let i = 0; i < meta.chunkCount; i++) {
    const chunk = await storage.get<Uint8Array>(`${CHUNK_PREFIX}${i}`);
    if (!chunk) return null; // 欠損 → 復元不能 → JSON seed へ
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/** 保存済みバイナリを全消去（失効/墓標時の破棄）。 */
export async function clearDocBinary(storage: KVLike): Promise<void> {
  const existing = await storage.list({ prefix: CHUNK_PREFIX });
  const keys = [...existing.keys(), META_KEY];
  if (keys.length > 0) await storage.delete(keys);
}
