/**
 * 共有API統合エンドポイント
 *
 * POST /api/share        — プランをFirestoreに保存し、短縮IDを返す
 * GET  /api/share?id=xxx — 短縮IDからプランデータを取得
 * PUT  /api/share        — 既存共有のロゴ更新
 * GET  /api/share?type=page&id=xxx — 共有ページHTML返却（OGP対応）
 *
 * 既存の share + share-page を統合
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { nanoid } from 'nanoid';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { createHash } from 'crypto';
import sharePageHandler from './_sharePageHandler.js';
import { buildOgImageUrl, type OgpLang } from '../../src/lib/ogpHelpers.js';

/**
 * OGP画像の同期プリウォーム。
 *
 * Firestore 保存直後にエッジキャッシュを温める。
 * ユーザーが X にリンクを貼った瞬間、クローラーが直ちにキャッシュヒットできるよう、
 * 共有作成／更新の応答を返す前にここで待つ。
 *
 * タイムアウト 5秒 / 失敗は握りつぶす（クリティカルでないため共有作成自体は成功させる）。
 */
async function prewarmOgImage(ogUrl: string): Promise<void> {
    try {
        await Promise.race([
            fetch(ogUrl, { headers: { 'User-Agent': 'LoPo-Prewarm/1.0' } }),
            new Promise((resolve) => setTimeout(resolve, 5000)),
        ]);
    } catch (err) {
        console.warn('OGP prewarm failed (non-critical):', err);
    }
}

/**
 * ホストを req から算出して OGP オリジンを返す。
 * allowlist 外は lopoly.app にフォールバックすることで
 * Host ヘッダ偽装対策と開発環境の両立を図る。
 */
function resolveOgOrigin(req: any): string {
    const allowed = ['lopoly.app', 'lopo-miti.vercel.app', 'localhost:5173', 'localhost:4173'];
    const previewPattern = /^lopo-miti(-[a-z0-9]+)?\.vercel\.app$/;
    const raw = req.headers?.host || 'lopoly.app';
    const host = allowed.find(h => raw.includes(h))
        || (previewPattern.test(raw) ? raw : null)
        || 'lopoly.app';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    return `${protocol}://${host}`;
}

const COLLECTION = 'shared_plans';
// リクエストボディの最大サイズ（500KB）
const MAX_BODY_SIZE = 500 * 1024;
const BLOCKED_LOGOS = 'blocked_logos';

function initAdmin() {
    if (!getApps().length) {
        let pk = process.env.FIREBASE_PRIVATE_KEY ?? '';
        if (pk.startsWith('"')) { try { pk = JSON.parse(pk); } catch {} }
        pk = pk.replace(/\\n/g, '\n');
        initializeApp({
            credential: cert({
                projectId: process.env.FIREBASE_PROJECT_ID!,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
                privateKey: pk,
            }),
        });
    }
}

export default async function handler(req: any, res: any) {
    // share-pageへのルーティング（?type=page）
    if (req.query?.type === 'page') {
        return sharePageHandler(req, res);
    }

    // CORS
    // CORSを自サイトのみに制限（Vercelプレビュー・本番の両方に対応）
    const origin = req.headers?.origin || '';
    const allowedOrigins = [
        'https://lopoly.app',
        'https://lopo-miti.vercel.app',
        'http://localhost:5173',
        'http://localhost:4173',
    ];
    // Vercelのプレビューデプロイ（自プロジェクトのみ許可）
    const isAllowed = allowedOrigins.includes(origin) || /^https:\/\/lopo-miti(-[a-z0-9]+)?\.vercel\.app$/.test(origin);
    res.setHeader('Access-Control-Allow-Origin', isAllowed ? origin : allowedOrigins[0]);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Firebase-AppCheck');
    if (req.method === 'OPTIONS') return res.status(200).end();

    // App Check検証（POST/PUTのみ。GETは共有リンク閲覧・OGP画像生成の内部fetchで使うためスキップ）
    if (req.method !== 'GET') {
        if (!(await verifyAppCheck(req, res))) return;
    }

    try {
        initAdmin();
        const db = getFirestore();

        if (req.method === 'POST') {
            // レート制限（1分あたり10回）
            if (!(await applyRateLimit(req, res, 10, 60_000))) return;

            // ボディサイズ制限
            const bodyStr = JSON.stringify(req.body || {});
            if (bodyStr.length > MAX_BODY_SIZE) {
                return res.status(413).json({ error: 'Request body too large' });
            }

            // ── 保存 ──
            const { planData, title, contentId, plans, logoStoragePath, lang, showTitle } = req.body;
            const normalizedLang: OgpLang = lang === 'en' ? 'en' : 'ja';
            // showTitle の正規化（boolean 以外 / 未指定はデフォルト true）
            const normalizedShowTitle = typeof showTitle === 'boolean' ? showTitle : true;

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
                const doc: any = {
                    shareId,
                    type: 'bundle',
                    lang: normalizedLang,
                    showTitle: normalizedShowTitle,
                    plans: plans.map((p: any) => ({
                        contentId: p.contentId || null,
                        title: p.title || '',
                        planData: p.planData,
                    })),
                    copyCount: 0,
                    viewCount: 0,
                    createdAt: Date.now(),
                };
                if (logoBase64) {
                    doc.logoBase64 = logoBase64;
                    doc.logoHash = logoHashStr;
                }
                await db.collection(COLLECTION).doc(shareId).set(doc);
                // OGP 画像のエッジキャッシュを同期プリウォーム
                const ogUrl = buildOgImageUrl(resolveOgOrigin(req), shareId, {
                    showTitle: normalizedShowTitle,
                    showLogo: !!logoBase64,
                    logoHash: logoHashStr || undefined,
                    lang: normalizedLang,
                });
                await prewarmOgImage(ogUrl);
                return res.status(200).json({
                    shareId,
                    ...(logoHashStr && { logoHash: logoHashStr }),
                    ...(logoBlocked && { logoBlocked: true }),
                });
            }

            // 単一プラン共有
            if (!planData) {
                return res.status(400).json({ error: 'planData is required' });
            }

            const shareId = nanoid(8);
            const doc: any = {
                shareId,
                lang: normalizedLang,
                showTitle: normalizedShowTitle,
                title: title || '',
                contentId: contentId || null,
                planData,
                copyCount: 0,
                viewCount: 0,
                createdAt: Date.now(),
            };
            if (logoBase64) {
                doc.logoBase64 = logoBase64;
                doc.logoHash = logoHashStr;
            }

            await db.collection(COLLECTION).doc(shareId).set(doc);
            // OGP 画像のエッジキャッシュを同期プリウォーム
            const ogUrl = buildOgImageUrl(resolveOgOrigin(req), shareId, {
                showTitle: normalizedShowTitle,
                showLogo: !!logoBase64,
                logoHash: logoHashStr || undefined,
                lang: normalizedLang,
            });
            await prewarmOgImage(ogUrl);

            return res.status(200).json({
                shareId,
                ...(logoHashStr && { logoHash: logoHashStr }),
                ...(logoBlocked && { logoBlocked: true }),
            });

        } else if (req.method === 'PUT') {
            // レート制限（1分あたり5回）
            if (!(await applyRateLimit(req, res, 5, 60_000))) return;

            // ── 既存共有のロゴ／showTitle 更新 ──
            const { shareId, logoStoragePath, showTitle: putShowTitle } = req.body;
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

            // showTitle が送られてきたら更新
            if (typeof putShowTitle === 'boolean') {
                await existingRef.update({ showTitle: putShowTitle });
            }

            // 更新後の状態で OGP URL を組み立て直してプリウォーム
            const existingData = existingSnap.data() || {};
            const effectiveShowTitle = typeof putShowTitle === 'boolean'
                ? putShowTitle
                : (typeof existingData.showTitle === 'boolean' ? existingData.showTitle : true);
            const effectiveLang: OgpLang = existingData.lang === 'en' ? 'en' : 'ja';
            const ogUrl = buildOgImageUrl(resolveOgOrigin(req), shareId, {
                showTitle: effectiveShowTitle,
                showLogo: !!logoBase64,
                logoHash: logoHashStr || undefined,
                lang: effectiveLang,
            });
            await prewarmOgImage(ogUrl);

            return res.status(200).json({
                shareId,
                // logoHash は logo 削除時 null、設定時は新ハッシュ。
                // クライアントは null/undefined を「ロゴ無し状態」として処理する。
                logoHash: logoHashStr,
                ...(logoBlocked && { logoBlocked: true }),
            });

        } else if (req.method === 'GET') {
            // ── 取得 ──
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
                viewRef.get().then((s: any) => {
                    if (!s.exists) {
                        const batch = db.batch();
                        batch.set(viewRef, { at: Date.now() });
                        batch.update(docRef, { viewCount: FieldValue.increment(1) });
                        batch.commit().catch(() => {});
                    }
                }).catch(() => {});
            }

            return res.status(200).json(snap.data());

        } else {
            return res.status(405).json({ error: 'Method not allowed' });
        }
    } catch (err: any) {
        console.error('Share API error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
