/**
 * 物件の代表画像が変わりうる全ミューテーション後に呼ぶ OGカード事前生成ラッパー。
 * register / update / thumbnail・source の upload・reorder・delete ハンドラから使う。
 * warm 失敗は元の操作の成否に一切影響させない(全体 try/catch)。
 *
 * このファイルが api/housing → api/share (_listingImages) への import を集約する唯一の場所。
 */
import { listingRepresentativeImages } from '../share/_listingImages.js';
import { warmListingOgCard } from '../../src/lib/housing/listingOgCardWarm.js';
import { resolveSiteOrigin } from '../../src/lib/housing/resolveSiteOrigin.js';

export async function warmListingCard(
  adminDb: any,
  rawHost: string | undefined,
  listing: Record<string, unknown> | undefined | null,
): Promise<void> {
  try {
    if (!listing) return;
    // private 物件はシェア用途が無いのでカードを materialize しない。
    if (listing.visibility === 'private') return;
    const origin = resolveSiteOrigin(rawHost);
    const rawPhoto = listingRepresentativeImages(listing)[0];
    if (!rawPhoto) return;
    const photoUrl = /^https?:\/\//.test(rawPhoto) ? rawPhoto : `${origin}${rawPhoto}`;
    await warmListingOgCard({
      origin,
      photoUrl,
      setMeta: async (hash, meta) => {
        await adminDb.collection('og_image_meta').doc(hash).set(meta);
      },
    });
  } catch (e) {
    console.error('[housing] OG card warm failed (non-fatal):', e instanceof Error ? e.message : e);
  }
}

/** listingRef から doc を読み直してから warm する版。read 失敗も含め全体を握りつぶす
 * (ミューテーション commit 済みの後で 500 を返さないため)。register 以外の全ハンドラはこちらを使う。 */
export async function warmListingCardByRef(
  adminDb: any,
  rawHost: string | undefined,
  listingRef: any,
): Promise<void> {
  try {
    const data = (await listingRef.get()).data();
    await warmListingCard(adminDb, rawHost, data);
  } catch (e) {
    console.error('[housing] OG card warm (by ref) failed (non-fatal):', e instanceof Error ? e.message : e);
  }
}
