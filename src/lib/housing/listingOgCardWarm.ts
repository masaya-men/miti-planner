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
 * warm-up fetch の失敗は握りつぶす(初回クロールが og-cache 初回 MISS で生成するフォールバックがあるため非致命)。
 * @returns 生成対象の hash。photoUrl が空なら null。
 */
export async function warmListingOgCard(input: WarmListingOgCardInput): Promise<string | null> {
  const { origin, photoUrl, setMeta, fetchImpl = fetch } = input;
  if (!photoUrl) return null;

  const hash = computeListingOgCardHash(photoUrl);
  const now = Date.now();
  await setMeta(hash, { type: 'listing', imageUrl: photoUrl, createdAt: now, lastAccessedAt: now });

  try {
    await fetchImpl(`${origin}/og/${hash}.png`, { headers: { 'User-Agent': 'LoPo-ListingWarmup/1.0' } });
  } catch {
    /* warm-up 失敗は非致命(次アクセスで og-cache が生成) */
  }

  return hash;
}
