/** GET /api/share?id=xxx — 短縮IDからプランデータを取得 */

import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { rejectIfPublicApiDisabled } from '../../src/lib/publicApiGuard.js';
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
    
        // 閲覧数の加算(viewers + viewCount)は撤去(読む所が無いため・11-05)。既に保存された値は消さない。
    
        // 個人状態(progress/memos)を返さない（Layer2: 取得/コピー/プレビューを単一箇所で網羅。
        // 既に進捗/メモ入りで保存済みの古い共有にも効く）。保存データ自体は変更しない。
        const out: FirebaseFirestore.DocumentData = { ...snap.data() };
        if (out.planData) out.planData = stripSharedPersonalData(out.planData);
        if (Array.isArray(out.plans)) {
            out.plans = out.plans.map((p) => ({ ...p, planData: stripSharedPersonalData(p.planData) }));
        }
        return res.status(200).json(out);
    
}
