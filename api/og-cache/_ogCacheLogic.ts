// og-cache の MISS 時、保存された og_image_meta から内部 /api/og URL を組み立てる純ロジック。
// Firestore I/O は呼び出し側(index.ts)が担う。type別に分岐: 'housinger' は新設カード、
// 無指定/'page' は既存の共有プランカード(後方互換)。'tour' 分岐は Task 5 で追加する
// (src/lib/ogpTourInviteCard.ts がまだ存在しないため、このタスク単体では import しない)。
import { buildHousingerOgCardUrl } from '../../src/lib/ogpHousingerCard.js';

export interface OgImageMeta {
  type?: string;
  shareId?: string; showLogo?: boolean; logoHash?: string | null; lang?: string;
  name?: string; avatarUrl?: string | null; imageUrls?: string[];
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
      name: meta.name ?? '',
      avatarUrl: meta.avatarUrl ?? null,
      imageUrls: meta.imageUrls ?? [],
    }, cronSecret);
  }
  let url = `${origin}/api/og?id=${encodeURIComponent(meta.shareId ?? '')}`;
  if (meta.showLogo) {
    url += '&showLogo=true';
    if (meta.logoHash) url += `&lh=${encodeURIComponent(meta.logoHash)}`;
  }
  url += `&lang=${meta.lang === 'en' ? 'en' : 'ja'}`;
  return url;
}
