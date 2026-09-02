/**
 * 物件 OGP カードの事前生成(warm-up)共有ロジック。
 * api/share/_listingPageHandler.ts(hash のみ利用)と api/housing/_registerListingHandler.ts /
 * _updateListingHandler.ts(warm 全体)から使う。firebase-admin には依存させない(setMeta を注入)。
 */
import { buildListingOgCardParams } from '../ogpListingCard.js';
import { computeOgCardImageHash } from '../ogpImageHash.js';

/** 写真 URL から OG カードの内容ハッシュ(16 hex)。同じ URL は同じ hash。 */
export function computeListingOgCardHash(photoUrl: string): string {
  return computeOgCardImageHash(buildListingOgCardParams({ img: photoUrl }));
}

export interface WarmListingOgCardInput {
  origin: string;
  /** 代表写真の絶対 URL。空文字なら何もせず null を返す。 */
  photoUrl: string;
  /** og_image_meta/{hash} への書き込み(呼び出し側が firebase-admin を持つ)。 */
  setMeta: (hash: string, meta: Record<string, unknown>) => Promise<void>;
  /** テスト差し替え用。既定は global fetch。 */
  fetchImpl?: typeof fetch;
}

/**
 * meta を書き込み、`${origin}/og/{hash}.png` を叩いてカードを生成させる。
 * warm-up fetch の失敗・非 ok は握りつぶす(初回クロールが og-cache 初回 MISS で生成する
 * フォールバックがあるため非致命)。レスポンス body は一切使わない。
 * fetch には 5 秒の timeout を掛ける: これを await する register-listing が Vercel Hobby の
 * 10 秒 function 制限を超えて 504 を返すと「listing は commit 済みなのに 504」→ユーザーが
 * リトライ→重複登録、という事故になる。og-cache 側の生成 + Storage upload はクライアントが
 * abort してもサーバーで完走する。
 * @returns 生成対象の hash。photoUrl が空なら null。
 */
export async function warmListingOgCard(input: WarmListingOgCardInput): Promise<string | null> {
  const { origin, photoUrl, setMeta, fetchImpl = fetch } = input;
  if (!photoUrl) return null;

  const hash = computeListingOgCardHash(photoUrl);
  const now = Date.now();
  await setMeta(hash, { type: 'listing', imageUrl: photoUrl, createdAt: now, lastAccessedAt: now });

  try {
    const res = await fetchImpl(`${origin}/og/${hash}.png`, {
      headers: { 'User-Agent': 'LoPo-ListingWarmup/1.0' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.warn(`[og warm] non-ok ${res.status} for ${hash}`);
  } catch (e) {
    console.warn(`[og warm] fetch failed for ${hash}:`, e instanceof Error ? e.message : e);
  }

  return hash;
}
