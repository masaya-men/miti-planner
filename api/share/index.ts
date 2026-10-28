/**
 * 共有API統合エンドポイント
 *
 * POST /api/share        — プランをFirestoreに保存し、短縮IDを返す
 * GET  /api/share?id=xxx — 短縮IDからプランデータを取得
 * PUT  /api/share        — 既存共有のロゴ更新
 * GET  /api/share?type=page&id=xxx — 共有ページHTML返却（OGP対応）
 * GET  /api/share?type=housinger&uid=xxx — ハウジンガーページHTML返却（OGP対応）
 * GET  /api/share?type=tour&token=xxx — ツアー招待ページHTML返却（OGP対応）
 *
 * 既存の share + share-page を統合
 */
import { getFirestore } from 'firebase-admin/firestore';
import sharePageHandler from './_sharePageHandler.js';
import housingerPageHandler from './_housingerPageHandler.js';
import tourInvitePageHandler from './_tourInvitePageHandler.js';
import listingPageHandler from './_listingPageHandler.js';
import type { ApiRequest, ApiResponse } from '../_apiTypes.js';
import { initAdmin } from './_shareFirebaseAdmin.js';
import { createShare } from './_createShare.js';
import { updateShareLogo } from './_updateShareLogo.js';
import { getShare } from './_getShare.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
    // share-pageへのルーティング（?type=page）
    if (req.query?.type === 'page') {
        return sharePageHandler(req, res);
    }

    // ハウジンガーページへのルーティング（?type=housinger&uid=...）
    // type=page と同様、rate limit / App Check を課さない（GET html、匿名クローラーも通す）。
    if (req.query?.type === 'housinger') {
        return housingerPageHandler(req, res);
    }

    // ツアー招待ページへのルーティング（?type=tour&token=...）
    // type=page/housinger と同様、rate limit / App Check を課さない（GET html、匿名クローラーも通す）。
    if (req.query?.type === 'tour') {
        return tourInvitePageHandler(req, res);
    }

    // 物件詳細ページへのルーティング（?type=listing&id=...）
    // type=page/housinger/tour と同様、rate limit / App Check を課さない（GET html、匿名クローラーも通す）。
    if (req.query?.type === 'listing') {
        return listingPageHandler(req, res);
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

    // App Check は課さない（共有は匿名でも作成/更新できる公開機能）。
    // 匿名の App Check トークン交換は privacy 制限下（シークレットウィンドウ等）で 403 になり、
    // しかも一度失敗すると 1 日リトライ不可（initial-throttle）に入るため、依存しない。
    // DoW 防御は各分岐の rate limit（POST 10/分・PUT 15/分）+ body size 上限が担う。GET も従来から免除。

    try {
        initAdmin();
        const db = getFirestore();

        if (req.method === 'POST') {
            return await createShare(req, res, db);

        } else if (req.method === 'PUT') {
            return await updateShareLogo(req, res, db);

        } else if (req.method === 'GET') {
            return await getShare(req, res, db);

        } else {
            return res.status(405).json({ error: 'Method not allowed' });
        }
    } catch (err) {
        console.error('Share API error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}