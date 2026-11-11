/**
 * ハウジング「色の取り直し」(色で探す・2026-11-12)
 *
 * PATCH ?resource=housing_colors   body { items: [{ id, colorFamilies, colorRule }], final: boolean }
 *   - items: 管理者のブラウザで計算した色を、家ごとに書き込むだけ (Firestore の batch)。
 *     版は進めず差分にも積まない (1 件ごとに進めると、利用者の一覧が毎回取り直しになるため)。
 *     値が不正・家が無い・削除済みの物は書かずに rejected で返す。
 *   - final:true: 最後の「反映する」。公開データの版を 1 回だけ進め、全件ファイルの作り直しを 1 回だけ頼む。
 *     items が空でも使える。
 *
 * 認可: verifyAdmin のみ。クライアントから Firestore へ直接は書かない (Admin SDK 経由のみ)。
 */
import { initAdmin, verifyAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';
import { bumpPublicVersionDirect } from '../housing/_publicVersion.js';
import { requestGalleryRotation } from '../housing/_publicFeedStore.js';
import { validatedColorFields } from '../housing/_colorFields.js';
import type { ApiRequest, ApiResponse } from '../_apiTypes.js';
import { setCors } from '../_lib/setCors.js';

/** 1 回の PATCH で受ける件数の上限 (画面は 25 件ずつ送る)。Firestore の batch 上限 500 より十分小さく。 */
const MAX_ITEMS = 100;

interface Rejected {
  id: string;
  reason: 'invalid_colors' | 'not_found';
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  setCors(req, res, { methods: 'PATCH, OPTIONS' });
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' });

  if (!(await verifyAppCheck(req, res))) return;
  if (!(await applyRateLimit(req, res, 60, 60_000))) return;

  try {
    initAdmin();
    const adminUid = await verifyAdmin(req);
    if (!adminUid) return res.status(401).json({ error: 'Unauthorized' });

    const body = req.body as { items?: unknown; final?: unknown } | undefined;
    if (!body || !Array.isArray(body.items) || typeof body.final !== 'boolean') {
      return res.status(400).json({ error: 'invalid_body' });
    }
    if (body.items.length > MAX_ITEMS) return res.status(400).json({ error: 'too_many_items' });

    const db = getAdminFirestore();
    const rejected: Rejected[] = [];
    const valid: { id: string; colors: { colorFamilies: string[]; colorRule: number } }[] = [];
    for (const raw of body.items as { id?: unknown }[]) {
      const id = typeof raw?.id === 'string' ? raw.id : '';
      const colors = validatedColorFields(raw);
      if (!id || !colors) rejected.push({ id, reason: 'invalid_colors' });
      else valid.push({ id, colors });
    }

    let written = 0;
    if (valid.length > 0) {
      const col = db.collection('housing_listings');
      const refs = valid.map((v) => col.doc(v.id));
      const snaps = await db.getAll(...refs);
      const batch = db.batch();
      snaps.forEach((snap, i) => {
        const data = snap.exists ? snap.data() : undefined;
        if (!data || data.deletedAt) {
          rejected.push({ id: valid[i].id, reason: 'not_found' });
          return;
        }
        batch.update(refs[i], { ...valid[i].colors });
        written++;
      });
      if (written > 0) await batch.commit();
    }

    if (body.final) {
      await bumpPublicVersionDirect(db);
      await requestGalleryRotation(db);
    }

    return res.status(200).json({ success: true, written, rejected, published: body.final });
  } catch (error) {
    console.error('[admin/housing_colors] error:', error);
    return res.status(500).json({ error: 'Internal error' });
  }
}
