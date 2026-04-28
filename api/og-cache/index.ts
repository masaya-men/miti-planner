/**
 * Vercel Function — OGP画像の永続キャッシュ配信
 *
 * GET /api/og-cache?h=<hash>
 *   rewrite: /og/{hash}.png → /api/og-cache?h={hash}
 *
 * 仕組み:
 *   - Firebase Storage `og-images/{hash}.png` に既に画像があれば即配信（HIT）
 *   - 無ければ Firestore `og_image_meta/{hash}` に保存された生成パラメータで /api/og を叩いて
 *     バイナリ取得 → Storage に upload → 配信（MISS）
 *
 * セキュリティ:
 *   - hash は ^[a-f0-9]{16}$ で厳格バリデーション（SSRF 類縁攻撃防止）
 *   - Storage への書き込みは firebase-admin（サーバー）のみ。Storage rule でクライアント書き込みは禁止
 *
 * 注意: このエンドポイントは Node runtime（firebase-admin が必要）。/api/og は edge runtime で別。
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const STORAGE_BUCKET = 'lopo-7793e.firebasestorage.app';
const OG_IMAGE_META_COLLECTION = 'og_image_meta';
const HASH_PATTERN = /^[a-f0-9]{16}$/;

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

/**
 * ホストを req から算出して OGP オリジンを返す。
 * allowlist 外は lopoly.app にフォールバック（Host ヘッダ偽装対策）。
 * 開発時（localhost / preview）はそのまま使う。
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

/**
 * og_image_meta のパラメータから /api/og の URL を組み立てる。
 * buildOgImageUrl と同じパラメータ順序で生成（buildOgImageUrl は id → showLogo → lh → lang）。
 */
function buildInternalOgUrl(
    origin: string,
    meta: { shareId: string; showLogo: boolean; logoHash: string | null; lang: 'ja' | 'en' },
): string {
    let url = `${origin}/api/og?id=${encodeURIComponent(meta.shareId)}`;
    if (meta.showLogo) {
        url += '&showLogo=true';
        if (meta.logoHash) url += `&lh=${encodeURIComponent(meta.logoHash)}`;
    }
    url += `&lang=${meta.lang}`;
    return url;
}

export default async function handler(req: any, res: any) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const hash = typeof req.query?.h === 'string' ? req.query.h : '';
    if (!HASH_PATTERN.test(hash)) {
        return res.status(400).json({ error: 'Invalid hash' });
    }

    try {
        initAdmin();
        const bucket = getStorage().bucket(STORAGE_BUCKET);
        const filePath = `og-images/${hash}.png`;
        const file = bucket.file(filePath);
        const [exists] = await file.exists();

        // HIT: Storage から直接配信
        if (exists) {
            const [buffer] = await file.download();
            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            res.setHeader('X-OG-Cache', 'HIT');
            // Storage の updated タイムスタンプを更新して LRU 的に使えるようにする
            // （クリーンアップ cron が `updated` を基準に判定するため）
            try {
                await file.setMetadata({ metadata: { lastAccessedAt: String(Date.now()) } });
            } catch { /* 参照時刻更新の失敗は致命的でないため握りつぶす */ }
            return res.status(200).send(buffer);
        }

        // MISS: Firestore からパラメータを取得して /api/og を叩く
        const db = getFirestore();
        const metaSnap = await db.collection(OG_IMAGE_META_COLLECTION).doc(hash).get();
        if (!metaSnap.exists) {
            return res.status(404).json({ error: 'not found' });
        }
        const meta = metaSnap.data() as any;
        if (!meta || typeof meta.shareId !== 'string') {
            return res.status(500).json({ error: 'invalid meta' });
        }

        const origin = resolveOgOrigin(req);
        const ogUrl = buildInternalOgUrl(origin, {
            shareId: meta.shareId,
            showLogo: !!meta.showLogo,
            logoHash: meta.logoHash || null,
            lang: meta.lang === 'en' ? 'en' : 'ja',
        });

        const ogRes = await fetch(ogUrl, {
            headers: { 'User-Agent': 'LoPo-OGCache/1.0' },
        });
        if (!ogRes.ok) {
            console.error('Upstream /api/og failed:', ogRes.status);
            return res.status(502).json({ error: 'upstream failed' });
        }
        const imageBuffer = Buffer.from(await ogRes.arrayBuffer());

        // Storage に保存（次回以降 HIT）
        // resumable: false で単発アップロード（軽量画像のためリジューム不要）
        try {
            await file.save(imageBuffer, {
                contentType: 'image/png',
                resumable: false,
                metadata: {
                    cacheControl: 'public, max-age=31536000, immutable',
                    metadata: { lastAccessedAt: String(Date.now()) },
                },
            });
        } catch (err) {
            // Storage への書き込み失敗は致命的でない（画像は生成できているので今回は返す）。
            // 次回リクエストで再度アップロードを試みる。
            console.warn('Storage upload failed (non-critical):', err);
        }

        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('X-OG-Cache', 'MISS');
        return res.status(200).send(imageBuffer);

    } catch (err: any) {
        console.error('OG cache error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
