/** PUT /api/share — 既存共有のロゴ更新 */

import { FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { createHash } from 'crypto';
import { getContentName, type OgpLang } from '../../src/lib/ogpContentMeta.js';
import { computeImageHash } from '../../src/lib/ogpImageHash.js';
import type { ApiRequest, ApiResponse } from '../_apiTypes.js';
import { composeBundleHashInput, upsertOgImageMeta } from './_ogImageMeta.js';

const COLLECTION = 'shared_plans';
const BLOCKED_LOGOS = 'blocked_logos';

export async function updateShareLogo(req: ApiRequest, res: ApiResponse, db: FirebaseFirestore.Firestore) {
        // レート制限（1分あたり15回）
        // 共有モーダルでロゴ追加・削除・トグルを連続で操作する正常な使い方を
        // カバーするため、5→15 に緩和。PUT は既存共有のロゴ差し替えのみで
        // 破壊的でなく、サーバー側コストも軽量なため安全。
        if (!(await applyRateLimit(req, res, 15, 60_000))) return;
    
        // ── 既存共有のロゴ更新 ──
        const { shareId, logoStoragePath } = req.body;
        if (!shareId || typeof shareId !== 'string') {
            return res.status(400).json({ error: 'shareId is required' });
        }
    
        // 既存ドキュメントの存在確認
        const existingRef = db.collection(COLLECTION).doc(shareId);
        const existingSnap = await existingRef.get();
        if (!existingSnap.exists) {
            return res.status(404).json({ error: 'share not found' });
        }
    
        // firebase-adminでロゴをダウンロードしてbase64に変換
        let logoBase64: string | null = null;
        let logoHashStr: string | null = null;
        let logoBlocked = false;
        // Storageパスの厳格な検証（users/{uid}/team-logo.jpg のみ許可）
        const putLogoPathRegex = /^users\/[a-zA-Z0-9:_-]+\/team-logo\.jpg$/;
        if (typeof logoStoragePath === 'string' && putLogoPathRegex.test(logoStoragePath)) {
            try {
                const bucket = getStorage().bucket('lopo-7793e.firebasestorage.app');
                const file = bucket.file(logoStoragePath);
                const [buffer] = await file.download();
                // ブロックリストチェック
                const hash = createHash('sha256').update(buffer).digest('hex');
                const blocked = await db.collection(BLOCKED_LOGOS).doc(hash).get();
                if (blocked.exists) {
                    logoBlocked = true;
                } else {
                    logoBase64 = `data:image/jpeg;base64,${buffer.toString('base64')}`;
                    logoHashStr = hash.slice(0, 16);
                }
            } catch (err) {
                console.error('Logo download failed:', err);
            }
        }
    
        // ロゴフィールドのみ更新（logoBase64／logoHash 共に削除 or 設定）
        if (logoBase64) {
            await existingRef.update({ logoBase64, logoHash: logoHashStr });
        } else {
            await existingRef.update({
                logoBase64: FieldValue.delete(),
                logoHash: FieldValue.delete(),
            });
        }
    
        // 更新後の状態で imageHash を再計算し、share doc と og_image_meta を更新
        const existingData = existingSnap.data() || {};
        const effectiveLang: OgpLang = existingData.lang === 'en' ? 'en' : 'ja';
    
        let hashInputContentName: string;
        let hashInputPlanTitle: string;
        if (existingData.type === 'bundle' && Array.isArray(existingData.plans)) {
            const planRefs = existingData.plans.map((p) => ({
                contentId: p.contentId || null,
                title: p.title || '',
            }));
            const bundleHashInput = composeBundleHashInput(planRefs);
            hashInputContentName = bundleHashInput.contentName;
            hashInputPlanTitle = bundleHashInput.planTitle;
        } else {
            hashInputContentName = getContentName(existingData.contentId || null, effectiveLang);
            hashInputPlanTitle = existingData.title || '';
        }
    
        const newImageHash = computeImageHash({
            contentName: hashInputContentName,
            planTitle: hashInputPlanTitle,
            showLogo: !!logoBase64,
            logoHash: logoHashStr,
            lang: effectiveLang,
        });
        await existingRef.update({ imageHash: newImageHash });
        await upsertOgImageMeta(db, newImageHash, {
            shareId,
            showLogo: !!logoBase64,
            logoHash: logoHashStr,
            lang: effectiveLang,
        });
    
        return res.status(200).json({
            shareId,
            imageHash: newImageHash,
            // logoHash は logo 削除時 null、設定時は新ハッシュ。
            // クライアントは null/undefined を「ロゴ無し状態」として処理する。
            logoHash: logoHashStr,
            ...(logoBlocked && { logoBlocked: true }),
        });
    
}
