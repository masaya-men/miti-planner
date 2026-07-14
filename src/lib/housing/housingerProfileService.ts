/**
 * housing_profiles コレクションのクライアント取得/キャッシュ + upsert API 呼び出し
 * (spec: docs/superpowers/specs/2026-07-10-housinger-profile-design.md §3.2/§3.3/§4)
 *
 * - getHousingerProfile: 他人のハウジンガー公開プロフィールを取得する。firestore.rules 上、
 *   公開条件 (isPublished===true && isModerationHidden===false) を満たさないドキュメントの
 *   read は本人以外だと permission-denied で拒否される。「非公開」も「取得エラー」も呼び出し側
 *   からは区別する意味がないため、例外・不存在・公開条件不成立のいずれも null に丸めて返す。
 *   結果 (null 含む) はモジュール内 Map でセッションキャッシュし、invalidate されるまで
 *   2 回目以降は Firestore を叩かない。
 * - getHousingerListings: housingListingsService.ts の getGalleryListings と同形。
 *   ownerUid で絞り込み、公開中のみ createdAt 降順で返す。
 * - upsertHousingerProfile: POST /api/housing?action=upsert-housinger-profile。
 *   成功時はログイン中 uid のプロフィールキャッシュを invalidate する。
 * - syncHousingerProfileBestEffort: 表示名/アイコン変更直後の追従用 (空 body 呼び出し = 転記のみ)。
 *   未ログイン時は何もせず、失敗は console.warn のみ (呼び出し元の成功フローを止めない)。
 */
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { buildHousingHeaders } from '../housingAuthHeaders';
import type { HousingerProfile, HousingListing } from '../../types/housing';

const PROFILE_COLLECTION = 'housing_profiles';

/** uid → 取得結果 (null = 非公開/不存在/取得不可) のセッションキャッシュ */
const profileCache = new Map<string, HousingerProfile | null>();

export async function getHousingerProfile(uid: string): Promise<HousingerProfile | null> {
  if (profileCache.has(uid)) {
    return profileCache.get(uid) ?? null;
  }
  let result: HousingerProfile | null = null;
  try {
    const snap = await getDoc(doc(db, PROFILE_COLLECTION, uid));
    if (snap.exists()) {
      const data = snap.data() as HousingerProfile;
      if (data.isPublished === true && data.isModerationHidden !== true) {
        result = data;
      }
    }
  } catch {
    // rules 上、公開条件を満たさないドキュメントの read は permission-denied で例外になる。
    result = null;
  }
  profileCache.set(uid, result);
  return result;
}

export function invalidateHousingerProfileCache(uid: string): void {
  profileCache.delete(uid);
}

export async function getHousingerListings(uid: string): Promise<HousingListing[]> {
  const { fetchPublicHousinger } = await import('./publicHousingWindow');
  return fetchPublicHousinger(uid);
}

export async function upsertHousingerProfile(input: {
  isPublished?: boolean;
  bio?: string | null;
  snsUrl?: string | null;
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
