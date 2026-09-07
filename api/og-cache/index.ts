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
import sharp from 'sharp';
import { isValidOgImageMeta, buildInternalOgUrl } from './_ogCacheLogic.js';

const STORAGE_BUCKET = 'lopo-7793e.firebasestorage.app';
const OG_IMAGE_META_COLLECTION = 'og_image_meta';
const HASH_PATTERN = /^[a-f0-9]{16}$/;

/**
 * 先頭バイトから画像 MIME を判定する。og-images/{hash}.png に保存されるバイトは
 * 新カード = JPEG / 旧カード(このコミット以前に生成済み)= PNG が混在するため、
 * 拡張子ではなく実バイトで Content-Type を決める。
 */
function sniffImageContentType(buf: Buffer): 'image/jpeg' | 'image/png' {
    return (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)
        ? 'image/jpeg'
        : 'image/png';
}

/**
 * @vercel/og が返す 1200x630 PNG(写真カードで ~1MB)を JPEG に変換して ~5 分の 1 に落とす。
 * OGP カードは SNS タイムライン内で小さく表示されるだけなので JPEG で十分。
 * 転送量 = X / Discord / 訪問者 / 再スクレイプ 全員の毎回の DL に効く(帯域コスト削減)。
 * 変換失敗時は PNG のまま返す(致命的にしない)。text/edge の劣化を避けるため
 * chromaSubsampling は 4:4:4、品質 85。
 */
async function toJpegOgCard(pngBuffer: Buffer): Promise<{ buffer: Buffer; contentType: 'image/jpeg' | 'image/png' }> {
    try {
        const jpeg = await sharp(pngBuffer)
            .flatten({ background: '#0e1116' })
            .jpeg({ quality: 85, mozjpeg: true, chromaSubsampling: '4:4:4' })
            .toBuffer();
        return { buffer: jpeg, contentType: 'image/jpeg' };
    } catch (err) {
        console.warn('OG card JPEG conversion failed (serving PNG):', err);
        return { buffer: pngBuffer, contentType: 'image/png' };
    }
}

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
            res.setHeader('Content-Type', sniffImageContentType(buffer));
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
        if (!isValidOgImageMeta(meta)) {
            return res.status(500).json({ error: 'invalid meta' });
        }

        const origin = resolveOgOrigin(req);
        const ogUrl = await buildInternalOgUrl(origin, meta, process.env.CRON_SECRET);

        const ogRes = await fetch(ogUrl, {
            headers: { 'User-Agent': 'LoPo-OGCache/1.0' },
        });
        if (!ogRes.ok) {
            console.error('Upstream /api/og failed:', ogRes.status);
            return res.status(502).json({ error: 'upstream failed' });
        }
        const pngBuffer = Buffer.from(await ogRes.arrayBuffer());
        // @vercel/og は PNG しか出せないため、ここ(Node runtime)で JPEG に落として容量を ~5 分の 1 に。
        const { buffer: imageBuffer, contentType } = await toJpegOgCard(pngBuffer);

        // Storage に保存（次回以降 HIT）
        // resumable: false で単発アップロード（軽量画像のためリジューム不要）
        try {
            await file.save(imageBuffer, {
                contentType,
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

        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('X-OG-Cache', 'MISS');
        return res.status(200).send(imageBuffer);

    } catch (err: any) {
        console.error('OG cache error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
