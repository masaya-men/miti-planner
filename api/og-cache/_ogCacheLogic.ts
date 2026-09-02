// og-cache の MISS 時、保存された og_image_meta から内部 /api/og URL を組み立てる純ロジック。
// Firestore I/O は呼び出し側(index.ts)が担う。type別に分岐: 'housinger'/'tour'/'listing' は新設カード、
// 無指定/'page' は既存の共有プランカード(後方互換)。
import { buildHousingerOgCardUrl } from '../../src/lib/ogpHousingerCard.js';
import { buildTourInviteOgCardUrl } from '../../src/lib/ogpTourInviteCard.js';
import { buildListingOgCardUrl } from '../../src/lib/ogpListingCard.js';

export interface OgImageMeta {
  type?: string;
  shareId?: string; showLogo?: boolean; logoHash?: string | null; lang?: string;
  pattern?: string; name?: string; bio?: string | null; avatarUrl?: string | null; imageUrls?: string[];
  /** type='listing' 用: 物件の代表写真 URL。 */
  imageUrl?: string;
}

/** page型(type無し/'page')はshareIdが必須。housinger/tour等その他は不要。 */
export function isValidOgImageMeta(meta: OgImageMeta | null | undefined): meta is OgImageMeta {
  if (!meta) return false;
  if (!meta.type || meta.type === 'page') return typeof meta.shareId === 'string';
  return true;
}

export async function buildInternalOgUrl(
  origin: string,
  meta: OgImageMeta,
  cronSecret: string | undefined,
): Promise<string> {
  if (meta.type === 'housinger') {
    if (!cronSecret) throw new Error('CRON_SECRET not configured');
    return buildHousingerOgCardUrl(origin, {
      pattern: meta.pattern === 'sidebar' ? 'sidebar' : 'grid',
      name: meta.name ?? '',
      bio: meta.bio ?? null,
      avatarUrl: meta.avatarUrl ?? null,
      imageUrls: meta.imageUrls ?? [],
    }, cronSecret);
  }
  if (meta.type === 'tour') {
    if (!cronSecret) throw new Error('CRON_SECRET not configured');
    return buildTourInviteOgCardUrl(origin, { name: meta.name ?? '' }, cronSecret);
  }
  if (meta.type === 'listing') {
    if (!cronSecret) throw new Error('CRON_SECRET not configured');
    return buildListingOgCardUrl(origin, { img: meta.imageUrl ?? '' }, cronSecret);
  }
  let url = `${origin}/api/og?id=${encodeURIComponent(meta.shareId ?? '')}`;
  if (meta.showLogo) {
    url += '&showLogo=true';
    if (meta.logoHash) url += `&lh=${encodeURIComponent(meta.logoHash)}`;
  }
  url += `&lang=${meta.lang === 'en' ? 'en' : 'ja'}`;
  return url;
}
