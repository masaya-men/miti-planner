/**
 * housing_profiles コレクションのクライアント取得/キャッシュ + upsert API 呼び出し
 * (spec: docs/superpowers/specs/2026-07-10-housinger-profile-design.md §3.2/§3.3/§4)
 *
 * - getHousingerProfile: ハウジンガープロフィールを取得する。firestore.rules 上、
 *   公開条件 (isPublished===true && isModerationHidden===false) を満たさないドキュメントの
 *   read は本人以外だと permission-denied で拒否される (本人は無条件で読める)。
 *   isSelf=true (自分のマイページ表示時) は、rules が既に本人読み取りを許可している前提で
 *   isPublished/isModerationHidden によるクライアント側フィルタをスキップし、下書き
 *   (未公開) 状態のプロフィールもそのまま返す。isSelf=false (既定・他人のページ表示) は
 *   従来どおりフィルタを適用する。「非公開」も「取得エラー」も呼び出し側からは区別する意味が
 *   ないため、例外・不存在・公開条件不成立のいずれも null に丸めて返す。
 *   結果 (null 含む) はモジュール内 Map でセッションキャッシュし、invalidate されるまで
 *   2 回目以降は Firestore を叩かない (self/public は別キーでキャッシュする)。
 * - getHousingerListings: housingListingsService.ts の getGalleryListings と同形。
 *   ownerUid で絞り込み、公開中のみ createdAt 降順で返す。
 * - upsertHousingerProfile: POST /api/housing?action=upsert-housinger-profile。
 *   成功時はログイン中 uid のプロフィールキャッシュを invalidate する。
 * - syncHousingerProfileBestEffort: 表示名/アイコン変更直後の追従用 (空 body 呼び出し = 転記のみ)。
 *   未ログイン時は何もせず、失敗は console.warn のみ (呼び出し元の成功フローを止めない)。
 */
import { collection, doc, documentId, getDoc, getDocs, limit, query, where } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { buildHousingHeaders } from '../housingAuthHeaders';
import type { HousingerProfile, HousingListing } from '../../types/housing';

const PROFILE_COLLECTION = 'housing_profiles';

/** uid → 取得結果 (null = 非公開/不存在/取得不可) のセッションキャッシュ */
const profileCache = new Map<string, HousingerProfile | null>();

export async function getHousingerProfile(uid: string, options?: { isSelf?: boolean }): Promise<HousingerProfile | null> {
  const isSelf = options?.isSelf === true;
  const cacheKey = isSelf ? `${uid}::self` : uid;
  if (profileCache.has(cacheKey)) {
    return profileCache.get(cacheKey) ?? null;
  }
  let result: HousingerProfile | null = null;
  try {
    const snap = await getDoc(doc(db, PROFILE_COLLECTION, uid));
    if (snap.exists()) {
      const data = snap.data() as HousingerProfile;
      if (isSelf || (data.isPublished === true && data.isModerationHidden !== true)) {
        result = data;
      }
    }
  } catch {
    // rules 上、公開条件を満たさないドキュメントの read は permission-denied で例外になる。
    result = null;
  }
  profileCache.set(cacheKey, result);
  return result;
}

export function invalidateHousingerProfileCache(uid: string): void {
  profileCache.delete(uid);
  profileCache.delete(`${uid}::self`);
}

/**
 * 短縮URL (`/h/<name>-<code>`) の識別コードから、実際の housing_profiles doc ID (uid) を解決する。
 * 新しいデータは持たず、既存の uid (doc ID) の先頭一致検索だけで済ませる (getHousingerShortCode と対)。
 * 公開プロフィールのみが対象 (firestore.rules と同じ isPublished/isModerationHidden 条件を
 * クエリ自身にも明示しないと list が拒否される。publishedHousingers.ts と同じ理由)。
 * 見つからない/複数該当いずれも先頭1件を採用するか null (呼び出し側は not-found 扱い)。
 */
export async function resolveHousingerUidByShortCode(code: string): Promise<string | null> {
  const start = `hashed:${code}`;
  const end = `${start}\uf8ff`;
  try {
    const qref = query(
      collection(db, PROFILE_COLLECTION),
      where('isPublished', '==', true),
      where('isModerationHidden', '==', false),
      where(documentId(), '>=', start),
      where(documentId(), '<', end),
      limit(1),
    );
    const snap = await getDocs(qref);
    return snap.empty ? null : snap.docs[0].id;
  } catch {
    return null;
  }
}

export async function getHousingerListings(uid: string): Promise<HousingListing[]> {
  const { fetchPublicHousinger } = await import('./publicHousingWindow');
  return fetchPublicHousinger(uid);
}

export async function upsertHousingerProfile(input: {
  isPublished?: boolean;
  bio?: string | null;
  snsUrl?: string | null;
  ogRepresentativeListingIds?: string[] | null;
  ogBackgroundListingId?: string | null;
}): Promise<{ ok: boolean; error?: string; profile?: HousingerProfile }> {
  try {
    const headers = await buildHousingHeaders(true);
    const res = await fetch('/api/housing?action=upsert-housinger-profile', {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: data?.error ?? `http_${res.status}` };
    }
    const data = await res.json();
    // 成功時は自分のプロフィールが変わっているため、セッションキャッシュを invalidate する
    // (詳細の登録者行 / ハウジンガーページ等、別画面で同一 uid を getHousingerProfile 経由で
    // 見ている場合に、次回表示で最新値へ反映させるため)。
    const uid = auth.currentUser?.uid;
    if (uid) invalidateHousingerProfileCache(uid);
    return { ok: true, profile: data.profile };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown_error';
    return { ok: false, error: message };
  }
}

export function syncHousingerProfileBestEffort(): void {
  if (!auth.currentUser) return;
  void upsertHousingerProfile({})
    .then((result) => {
      if (!result.ok) {
        console.warn('[housingerProfile] sync failed:', result.error);
      }
    })
    .catch((e) => {
      console.warn('[housingerProfile] sync failed:', e);
    });
}
