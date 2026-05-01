/**
 * 管理者用: 野良主流ビュー（コンテンツ別 上位 N 件、hidden 含む）
 * GET /api/admin?resource=popular&contentId=X&limit=10
 */
import { initAdmin, verifyAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';
import { calculateScore7d, dayKeyDaysBefore, todayKey } from '../popular/popularFilters.js';

const COLLECTION = 'shared_plans';
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 30;

function setCors(req: any, res: any) {
    const origin = req.headers?.origin || '';
    const allowedOrigins = [
        'https://lopoly.app',
        'https://lopo-miti.vercel.app',
        'http://localhost:5173',
        'http://localhost:4173',
    ];
    const isAllowed = allowedOrigins.includes(origin) || /^https:\/\/.*\.vercel\.app$/.test(origin);
    res.setHeader('Access-Control-Allow-Origin', isAllowed ? origin : allowedOrigins[0]);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');
}

export default async function handler(req: any, res: any) {
    setCors(req, res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (!(await verifyAppCheck(req, res))) return;
    if (!(await applyRateLimit(req, res, 30, 60_000))) return;

    try {
        initAdmin();
        const adminUid = await verifyAdmin(req);
        if (!adminUid) return res.status(401).json({ error: 'Unauthorized' });

        if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

        // contentId は string[] で渡される可能性があるため defensive に処理
        const cidRaw = req.query?.contentId;
        const contentId = Array.isArray(cidRaw) ? (cidRaw[0] ?? '') : (cidRaw ?? '');
        if (!contentId) {
            return res.status(400).json({ error: 'contentId required' });
        }
        const limitRaw = parseInt((req.query?.limit as string) || `${DEFAULT_LIMIT}`, 10);
        const limit = Math.min(Math.max(1, isNaN(limitRaw) ? DEFAULT_LIMIT : limitRaw), MAX_LIMIT);

        const db = getAdminFirestore();
        const snap = await db.collection(COLLECTION)
            .where('contentId', '==', contentId)
            .get();

        const windowStart = dayKeyDaysBefore(6);
        const scored = snap.docs.map(doc => {
            const data = doc.data();
            return {
                doc,
                data,
                score7d: calculateScore7d(data.copyCountByDay, windowStart),
            };
        });

        // 並び順: featured 優先 → score7d 降順 → 生涯 copyCount 降順 → doc.id
        scored.sort((a, b) => {
            const af = a.data.featured === true ? 1 : 0;
            const bf = b.data.featured === true ? 1 : 0;
            if (af !== bf) return bf - af;
            if (a.score7d !== b.score7d) return b.score7d - a.score7d;
            const ac = a.data.copyCount ?? 0;
            const bc = b.data.copyCount ?? 0;
            if (ac !== bc) return bc - ac;
            return a.doc.id < b.doc.id ? -1 : a.doc.id > b.doc.id ? 1 : 0;
        });

        const top = scored.slice(0, limit);

        const plans = top.map(({ doc, data, score7d }) => {
            const partyMembers = data.planData?.partyMembers?.map((m: any) => ({
                id: m.id,
                jobId: m.jobId,
                role: m.role,
            })) ?? [];
            const ownerId: string = data.ownerId ?? '';
            const ownerUidSuffix = ownerId.length >= 4 ? ownerId.slice(-4) : ownerId;
            // 「自分（管理者本人）のプランか」だけ判定。他人の UID は ownerUidSuffix の 4 文字に切り詰められる。
            const isOwn = ownerId !== '' && ownerId === adminUid;
            return {
                shareId: doc.id,
                title: data.title ?? '',
                contentId: data.contentId,
                copyCount: data.copyCount ?? 0,
                score7d,
                featured: data.featured === true,
                hidden: data.hidden === true,
                hiddenAt: data.hiddenAt ?? null,
                createdAt: data.createdAt ?? null,
                ownerUidSuffix,
                isOwn,
                partyMembers,
                imageHash: data.imageHash ?? null,
            };
        });

        return res.status(200).json({ contentId, plans, todayKey: todayKey() });

    } catch (err: any) {
        console.error('Popular admin handler error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
