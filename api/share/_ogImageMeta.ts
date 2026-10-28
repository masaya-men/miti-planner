import type { OgpLang } from '../../src/lib/ogpHelpers.js';

const OG_IMAGE_META_COLLECTION = 'og_image_meta';

/**
 * バンドル共有の contentName / planTitle を hash 入力用に合成する。
 * contentId とタイトルを決定的な順序で連結し、
 * 同じ構成のバンドルが同じ hash になるようにする。
 */
export function composeBundleHashInput(plans: { contentId: string | null; title: string }[]): { contentName: string; planTitle: string } {
    const contentName = 'bundle:' + plans.map(p => p.contentId || '').join(',');
    const planTitle = plans.map(p => p.title || '').join('|');
    return { contentName, planTitle };
}

/**
 * og_image_meta/{hash} に生成パラメータを保存する。
 * /api/og-cache が MISS 時にこのパラメータで /api/og を叩いて画像を生成する。
 * 同じ hash のドキュメントが既にある場合は set で上書き（最新の代表 shareId に更新）。
 */
export async function upsertOgImageMeta(
    db: FirebaseFirestore.Firestore,
    imageHash: string,
    params: { shareId: string; showLogo: boolean; logoHash: string | null; lang: OgpLang },
): Promise<void> {
    try {
        await db.collection(OG_IMAGE_META_COLLECTION).doc(imageHash).set({
            ...params,
            createdAt: Date.now(),
            lastAccessedAt: Date.now(),
        });
    } catch (err) {
        // og_image_meta 保存失敗は致命的でない（画像生成にはならないが、共有自体は成功させる）。
        // /api/og-cache は 404 を返すことになり、旧 /api/og?id=... URL へのフォールバックが効く。
        console.warn('og_image_meta upsert failed (non-critical):', err);
    }
}
