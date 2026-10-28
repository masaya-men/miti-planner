/** GET /api/share?id=xxx — 短縮IDからプランデータを取得 */

import { FieldValue } from 'firebase-admin/firestore';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { rejectIfPublicApiDisabled } from '../../src/lib/publicApiGuard.js';
import { createHash } from 'crypto';
import { stripSharedPersonalData } from '../../src/lib/sharePrivacy.js';
import type { ApiRequest, ApiResponse } from '../_apiTypes.js';

const COLLECTION = 'shared_plans';

export async function getShare(req: ApiRequest, res: ApiResponse, db: FirebaseFirestore.Firestore) {
        // ── 取得 ──
        if (rejectIfPublicApiDisabled(res)) return;
        if (!(await applyRateLimit(req, res, 60, 60_000, { scope: 'share-get', globalMax: 600 }))) return;
        const { id } = req.query;
        if (!id) {
            return res.status(400).json({ error: 'id is required' });
        }
    
        const docRef = db.collection(COLLECTION).doc(id as string);
        const snap = await docRef.get();
        if (!snap.exists) {
            return res.status(404).json({ error: 'not found' });
        }
    
        // 閲覧数を+1（IPベースの簡易重複排除、fire-and-forget）
        // ただし preview=true のクエリ時はスキップ（ボトムシート/人気ページのプレビュー取得で自己強化ループを起こさないため）
        const isPreview = req.query.preview === 'true';
        const fwd = req.headers['x-forwarded-for'];
        const fwdStr = Array.isArray(fwd) ? fwd[0] : (fwd || '');
        const viewerIp = (fwdStr || req.socket?.remoteAddress || '').split(',')[0].trim();
        if (!isPreview && viewerIp) {
            const ipHash = createHash('sha256').update(viewerIp + id).digest('hex').slice(0, 16);
            const viewRef = db.collection(COLLECTION).doc(id as string).collection('viewers').doc(ipHash);
            viewRef.get().then((s) => {
                if (!s.exists) {
                    const batch = db.batch();
                    batch.set(viewRef, { at: Date.now() });
                    batch.update(docRef, { viewCount: FieldValue.increment(1) });
                    batch.commit().catch(() => {});
                }
            }).catch(() => {});
        }
    
        // 個人状態(progress/memos)を返さない（Layer2: 取得/コピー/プレビューを単一箇所で網羅。
        // 既に進捗/メモ入りで保存済みの古い共有にも効く）。保存データ自体は変更しない。
        const out: FirebaseFirestore.DocumentData = { ...snap.data() };
        if (out.planData) out.planData = stripSharedPersonalData(out.planData);
        if (Array.isArray(out.plans)) {
            out.plans = out.plans.map((p) => ({ ...p, planData: stripSharedPersonalData(p.planData) }));
        }
        return res.status(200).json(out);
    
}
