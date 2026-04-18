/**
 * Vercel Cron — OGP 画像キャッシュの自動クリーンアップ
 *
 * 週次（日曜 03:00 UTC = 日本時間 12:00）に実行される。
 * Firebase Storage `og-images/` 配下で 30 日以上アクセスのないファイルを削除し、
 * 対応する Firestore `og_image_meta/{hash}` も削除する。
 *
 * lastAccessed の判定:
 *   1. カスタムメタデータ `lastAccessedAt`（/api/og-cache が HIT 時に更新）
 *   2. 無ければ Storage の updated タイムスタンプ
 *
 * 認証:
 *   Vercel Cron は `Authorization: Bearer <CRON_SECRET>` を自動付与する。
 *   CRON_SECRET は Vercel ダッシュボード → Settings → Environment Variables で
 *   設定する必要がある（未設定なら 401 になり cron が機能しない）。
 *
 * タイムアウト対策:
 *   1 回の実行で処理するファイル数に上限を設ける（MAX_PROCESS）。
 *   Hobby プランの関数タイムアウトは 10 秒 / Pro は 60 秒。
 *   残りは翌週の実行に持ち越す（削除対象なら次回判定も通るため問題なし）。
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const STORAGE_BUCKET = 'lopo-7793e.firebasestorage.app';
const OG_IMAGE_META_COLLECTION = 'og_image_meta';
const STALE_DAYS = 30;
// 1回の実行で処理するファイル数の上限（関数タイムアウト防止）
const MAX_PROCESS = 500;

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
    // Vercel Cron 認証（CRON_SECRET を Vercel ダッシュボードで設定済みであることが前提）
    const authHeader = req.headers?.authorization || '';
    const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : '';
    if (!expected || authHeader !== expected) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        initAdmin();
        const bucket = getStorage().bucket(STORAGE_BUCKET);
        const db = getFirestore();
        const cutoff = Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000;
        const [files] = await bucket.getFiles({ prefix: 'og-images/' });

        let checked = 0;
        let deletedCount = 0;
        const deletedHashes: string[] = [];

        for (const file of files) {
            if (checked >= MAX_PROCESS) break;
            checked++;
            try {
                const [metadata] = await file.getMetadata();
                const lastAccessedRaw = (metadata.metadata as any)?.lastAccessedAt;
                const lastAccessed = typeof lastAccessedRaw === 'string' && /^\d+$/.test(lastAccessedRaw)
                    ? Number(lastAccessedRaw)
                    : new Date(metadata.updated || metadata.timeCreated || 0).getTime();
                if (lastAccessed >= cutoff) continue;

                await file.delete();
                deletedCount++;

                // og_image_meta/{hash} も同時に削除
                const match = file.name.match(/^og-images\/([a-f0-9]{16})\.png$/);
                if (match) {
                    const hash = match[1];
                    try {
                        await db.collection(OG_IMAGE_META_COLLECTION).doc(hash).delete();
                    } catch { /* meta 削除失敗は致命的でない */ }
                    deletedHashes.push(hash);
                }
            } catch (err) {
                console.warn(`Cleanup skipped for ${file.name}:`, err);
            }
        }

        return res.status(200).json({
            total: files.length,
            checked,
            deleted: deletedCount,
            deletedHashes,
            cutoff: new Date(cutoff).toISOString(),
        });
    } catch (err: any) {
        console.error('Cleanup error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
