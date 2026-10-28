/** POST /api/share — プランをFirestoreに保存し、短縮IDを返す */

import { getStorage } from 'firebase-admin/storage';
import { nanoid } from 'nanoid';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { createHash } from 'crypto';
import { getContentName, type OgpLang } from '../../src/lib/ogpHelpers.js';
import { computeImageHash } from '../../src/lib/ogpImageHash.js';
import { stripSharedPersonalData } from '../../src/lib/sharePrivacy.js';
import type { ApiRequest, ApiResponse } from '../_apiTypes.js';
import { composeBundleHashInput, upsertOgImageMeta } from './_ogImageMeta.js';

const COLLECTION = 'shared_plans';
// リクエストボディの最大サイズ（500KB）
const MAX_BODY_SIZE = 500 * 1024;
const BLOCKED_LOGOS = 'blocked_logos';

export async function createShare(req: ApiRequest, res: ApiResponse, db: FirebaseFirestore.Firestore) {
        // レート制限（1分あたり10回）
        if (!(await applyRateLimit(req, res, 10, 60_000))) return;
    
        // ボディサイズ制限
        const bodyStr = JSON.stringify(req.body || {});
        if (bodyStr.length > MAX_BODY_SIZE) {
            return res.status(413).json({ error: 'Request body too large' });
        }
    
        // ── 保存 ──
        const { planData, title, contentId, plans, logoStoragePath, lang } = req.body;
        const normalizedLang: OgpLang = lang === 'en' ? 'en' : 'ja';
    
        // firebase-adminでロゴをダウンロードしてbase64に変換
        let logoBase64: string | null = null;
        // logoHash: ロゴ内容の SHA-256 先頭16文字。CDN キャッシュキーとして OGP URL に含めることで、
        // 同じ shareId でロゴ内容のみ変わったケース（モーダル内で再アップロード等）でも
        // 古いキャッシュ画像が配信される問題を回避する。
        let logoHashStr: string | null = null;
        let logoBlocked = false;
        // Storageパスの厳格な検証（users/{uid}/team-logo.jpg のみ許可）
        const logoPathRegex = /^users\/[a-zA-Z0-9:_-]+\/team-logo\.jpg$/;
        if (typeof logoStoragePath === 'string' && logoPathRegex.test(logoStoragePath)) {
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
    
        // バンドル共有（複数プランまとめて）
        if (Array.isArray(plans) && plans.length > 0) {
            const shareId = nanoid(8);
            const planRefs = plans.map((p) => ({
                contentId: p.contentId || null,
                title: p.title || '',
            }));
            const bundleHashInput = composeBundleHashInput(planRefs);
            const imageHash = computeImageHash({
                contentName: bundleHashInput.contentName,
                planTitle: bundleHashInput.planTitle,
                showLogo: !!logoBase64,
                logoHash: logoHashStr,
                lang: normalizedLang,
            });
            const doc: FirebaseFirestore.DocumentData = {
                shareId,
                type: 'bundle',
                lang: normalizedLang,
                plans: plans.map((p) => ({
                    contentId: p.contentId || null,
                    title: p.title || '',
                    // 共有に個人状態(progress/memos)を載せない（Layer1: 保存時に除去）
                    planData: stripSharedPersonalData(p.planData),
                })),
                imageHash,
                viewCount: 0,
                createdAt: Date.now(),
            };
            if (logoBase64) {
                doc.logoBase64 = logoBase64;
                doc.logoHash = logoHashStr;
            }
            await db.collection(COLLECTION).doc(shareId).set(doc);
            await upsertOgImageMeta(db, imageHash, {
                shareId,
                showLogo: !!logoBase64,
                logoHash: logoHashStr,
                lang: normalizedLang,
            });
            return res.status(200).json({
                shareId,
                imageHash,
                ...(logoHashStr && { logoHash: logoHashStr }),
                ...(logoBlocked && { logoBlocked: true }),
            });
        }
    
        // 単一プラン共有
        if (!planData) {
            return res.status(400).json({ error: 'planData is required' });
        }
    
        const shareId = nanoid(8);
        const imageHash = computeImageHash({
            contentName: getContentName(contentId || null, normalizedLang),
            planTitle: title || '',
            showLogo: !!logoBase64,
            logoHash: logoHashStr,
            lang: normalizedLang,
        });
        const doc: FirebaseFirestore.DocumentData = {
            shareId,
            lang: normalizedLang,
            title: title || '',
            contentId: contentId || null,
            // 共有に個人状態(progress/memos)を載せない（Layer1: 保存時に除去）
            planData: stripSharedPersonalData(planData),
            imageHash,
            viewCount: 0,
            createdAt: Date.now(),
        };
        if (logoBase64) {
            doc.logoBase64 = logoBase64;
            doc.logoHash = logoHashStr;
        }
    
        await db.collection(COLLECTION).doc(shareId).set(doc);
        await upsertOgImageMeta(db, imageHash, {
            shareId,
            showLogo: !!logoBase64,
            logoHash: logoHashStr,
            lang: normalizedLang,
        });
    
        return res.status(200).json({
            shareId,
            imageHash,
            ...(logoHashStr && { logoHash: logoHashStr }),
            ...(logoBlocked && { logoBlocked: true }),
        });
}
