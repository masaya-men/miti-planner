import { FieldPath } from 'firebase-admin/firestore';
import { stripHashedPrefix, extractHousingerShortCode } from '../../src/lib/housing/housingerProfile.js';

const PROFILE_COLLECTION = 'housing_profiles';

/**
 * 短縮URL (/h/:slug) の入口から来た場合、rawUid が空で rawSlug だけが来る。
 * 新しいデータは一切持たず、既存の uid (housing_profiles の doc ID) の先頭一致検索だけで
 * 実際の uid を解決する (client 側 resolveHousingerUidByShortCode と対の実装。名前部分は
 * 判定に使わない飾りのため、slug からは識別コードだけを取り出す)。
 * rawUid があればそれを優先しそのまま返す (通常の /housing/housinger/:uid 経路は不変)。
 * 解決できなければ空文字 (呼び出し側は既存の「uidパラメータが無い」ケースと同じ404に倒す)。
 */
export async function resolveHousingerUid(
  db: Pick<FirebaseFirestore.Firestore, 'collection'>,
  rawUid: string,
  rawSlug: string,
): Promise<string> {
  if (rawUid) return rawUid;
  if (!rawSlug) return '';
  const code = extractHousingerShortCode(rawSlug);
  if (!code) return '';
  const prefixStart = `hashed:${code}`;
  const prefixEnd = `${prefixStart}\uf8ff`;
  const snap = await db.collection(PROFILE_COLLECTION)
    .where('isPublished', '==', true)
    .where('isModerationHidden', '==', false)
    .where(FieldPath.documentId(), '>=', prefixStart)
    .where(FieldPath.documentId(), '<', prefixEnd)
    .limit(1)
    .get();
  return snap.empty ? '' : stripHashedPrefix(snap.docs[0].id);
}
