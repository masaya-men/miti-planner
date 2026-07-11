/**
 * POST /api/housing?action=upsert-housinger-profile
 *
 * ハウジンガー公開プロフィールの公開/更新/非公開/同期を 1 本で扱うハンドラ
 * (spec: docs/superpowers/specs/2026-07-10-housinger-profile-design.md §3.2/§3.3)。
 *
 * 常に「users/{uid} の現在値を読んで housing_profiles/{uid} へ転記 +
 * personal_tags を同一トランザクションで upsert」する。
 * 名前・アイコンは body で受け取らない (サーバーが users/{uid} から読む = 改ざん不可)。
 * body の isPublished/bio/snsUrl は差分指定 (undefined = 現状維持) のため、
 * 空 body での呼び出しは「名前・アイコン変更後の同期」として機能する (冪等)。
 *
 * 個人タグ (personal_tags) の作成・更新はこのハンドラのみが行う (タグ刷新 Phase B 統合契約1。
 * 旧 create-personal-tag action は削除済み)。 tagId は resolvePersonalTagId で決定する:
 * 既存ドキュメント (ownerUid==uid、旧経路の legacy slug ID を含む) があればそれを再利用し、
 * 無ければ uid 決定的な canonical id (personalTagIdForUid) で新規作成する。
 */
import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { getAuth } from 'firebase-admin/auth';
import {
  HOUSINGER_BIO_MAX_LENGTH,
  validateHousingerSnsUrl,
  resolvePersonalTagId,
} from '../../src/lib/housing/housingerProfile.js';
import { normalizeDisplayNameForSearch } from '../../src/data/personalTags.js';

export function validateUpsertBody(body: any):
  | { ok: true; isPublished?: boolean; bio?: string | null; snsUrl?: string | null }
  | { ok: false; error: 'invalid_bio' | 'invalid_sns_url' | 'invalid_body' } {
  const { isPublished, bio, snsUrl } = body || {};
  if (isPublished !== undefined && typeof isPublished !== 'boolean') {
    return { ok: false, error: 'invalid_body' };
  }
  if (bio !== undefined && bio !== null) {
    if (typeof bio !== 'string' || bio.length > HOUSINGER_BIO_MAX_LENGTH) {
      return { ok: false, error: 'invalid_bio' };
    }
  }
  if (snsUrl !== undefined && snsUrl !== null) {
    if (typeof snsUrl !== 'string' || !validateHousingerSnsUrl(snsUrl).ok) {
      return { ok: false, error: 'invalid_sns_url' };
    }
  }
  return { ok: true, isPublished, bio, snsUrl };
}

function setCors(req: any, res: any) {
  const origin = req.headers?.origin || '';
  const allowed = [
    'https://lopoly.app',
    'https://lopo-miti.vercel.app',
    'http://localhost:5173',
    'http://localhost:4173',
  ];
  const ok = allowed.includes(origin) || /^https:\/\/.*\.vercel\.app$/.test(origin);
  res.setHeader('Access-Control-Allow-Origin', ok ? origin : allowed[0]);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');
}

export default async function handler(req: any, res: any) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!(await verifyAppCheck(req, res))) return;
  if (!(await applyRateLimit(req, res, 20, 60_000))) return;

  try {
    initAdmin();
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'unauthenticated' });

    const decoded = await getAuth().verifyIdToken(token);
    const uid = decoded.uid;

    const v = validateUpsertBody(req.body);
    // 'error' in v で失敗バリアントへ narrow する(`!v.ok` の boolean discriminant narrow は
    // @vercel/node の strictNullChecks-off ビルドでは効かないため。api/collab/_roomHandler.ts と同じ対処)。
    if ('error' in v) return res.status(400).json({ error: v.error });

    const adminDb = getAdminFirestore();
    const userRef = adminDb.collection('users').doc(uid);
    const profileRef = adminDb.collection('housing_profiles').doc(uid);
    const tagsCol = adminDb.collection('personal_tags');

    let resultProfile: any = null;
    await adminDb.runTransaction(async (tx) => {
      const [userSnap, profileSnap, existingTagsSnap] = await Promise.all([
        tx.get(userRef), tx.get(profileRef), tx.get(tagsCol.where('ownerUid', '==', uid).limit(5)),
      ]);
      if (!userSnap.exists) throw new Error('user_not_found');
      const userData = userSnap.data()!;
      const prev = profileSnap.exists ? profileSnap.data()! : null;

      const displayName = (userData.displayName || '').trim();
      const nextPublished = v.isPublished ?? prev?.isPublished ?? false;
      if (nextPublished && !displayName) throw new Error('name_required');

      const now = Date.now();
      const next = {
        displayName,
        avatarUrl: userData.avatarUrl ?? null,
        bio: v.bio !== undefined ? v.bio : prev?.bio ?? null,
        snsUrl: v.snsUrl !== undefined ? v.snsUrl : prev?.snsUrl ?? null,
        isPublished: nextPublished,
        isModerationHidden: prev?.isModerationHidden ?? false,
        reportCount: prev?.reportCount ?? 0,
        createdAt: prev?.createdAt ?? now,
        updatedAt: now,
      };
      tx.set(profileRef, next);

      // 個人タグは同一 tx で一括転記 (spec §3.3: 名前の源泉はプロフィール 1 箇所)。
      // tagId は既存ドキュメント (旧 create-personal-tag 経路の legacy slug ID を含む) があれば
      // 再利用する (resolvePersonalTagId、 統合契約1 + Task 3 レビューの carry-over)。
      // これにより同一ユーザーに 2 つ目の personal_tags ドキュメントが生まれるのを防ぐ。
      const tagId = resolvePersonalTagId(uid, existingTagsSnap.docs.map((d) => d.id));
      const tagRef = tagsCol.doc(tagId);
      const prevTag = existingTagsSnap.docs.find((d) => d.id === tagId)?.data() ?? null;
      // ⚠ reportCount は既存値を必ず保持する (0 で上書きすると通報を握りつぶす)
      tx.set(tagRef, {
        id: tagId,
        displayName,
        displayNameLower: normalizeDisplayNameForSearch(displayName),
        ownerUid: uid,
        createdAt: prevTag?.createdAt ?? now,
        reportCount: prevTag?.reportCount ?? 0,
        isHidden: !(next.isPublished && !next.isModerationHidden),
      }, { merge: true });
      resultProfile = next;
    });

    return res.status(200).json({ success: true, profile: resultProfile });
  } catch (error: any) {
    if (error?.message === 'user_not_found') return res.status(404).json({ error: 'user_not_found' });
    if (error?.message === 'name_required') return res.status(400).json({ error: 'name_required' });
    console.error('[housing/upsert-housinger-profile] error:', error);
    return res.status(500).json({ error: 'Internal error' });
  }
}
