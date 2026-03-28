/**
 * Vercel Serverless Function — 人気プランAPI
 *
 * GET  /api/popular?contentIds=m9s,m10s,...  — コンテンツごとに上位2プラン + featured を取得（viewCount降順）
 * POST /api/popular  { shareId }             — copyCount を1増加
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';

const COLLECTION = 'shared_plans';

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

/** 人気プラン昇格候補チェック */
async function checkPromotionCandidate(
    db: FirebaseFirestore.Firestore,
    shareId: string,
    shareData: any,
): Promise<void> {
    const contentId = shareData.contentId;
    if (!contentId) return;

    // 最新のcopyCountを取得
    const freshSnap = await db.collection(COLLECTION).doc(shareId).get();
    if (!freshSnap.exists) return;
    const freshData = freshSnap.data()!;
    const copyCount = freshData.copyCount || 0;

    // configから閾値を取得（デフォルト: 20回、2倍）
    const configSnap = await db.doc('master/config').get();
    const config = configSnap.exists ? configSnap.data()! : {};
    const threshold = config.promotionThreshold || 20;
    const multiplier = config.promotionMultiplier || 2;

    if (copyCount < threshold) return;

    // 既に通知済みならスキップ
    if (freshData.promotionNotified) return;

    // 既存テンプレートとの比較
    const templateSnap = await db.doc(`templates/${contentId}`).get();
    if (templateSnap.exists) {
        const existing = templateSnap.data()!;
        const existingEvents = Array.isArray(existing.timelineEvents) ? existing.timelineEvents.length : 0;
        if (existingEvents > 0 && copyCount < existingEvents * multiplier) return;
    }

    // 昇格候補としてマーク
    await db.collection(COLLECTION).doc(shareId).update({
        promotionCandidate: true,
        promotionNotified: true,
        promotionNotifiedAt: FieldValue.serverTimestamp(),
    });

    // Discord通知
    try {
        const { sendDiscordNotification } = await import('../../src/lib/discordWebhook.js');
        await sendDiscordNotification({
            title: '⭐ テンプレート昇格候補',
            description: `共有プランのコピー数が閾値（${threshold}）に達しました`,
            color: 0xfbbf24,
            fields: [
                { name: 'コンテンツ', value: contentId, inline: true },
                { name: 'コピー数', value: `${copyCount}`, inline: true },
                { name: '共有ID', value: shareId, inline: true },
            ],
        });
    } catch {
        // Discord通知失敗は無視
    }
}

export default async function handler(req: any, res: any) {
    // CORS
    const origin = req.headers?.origin || '';
    const allowedOrigins = [
        'https://lopoly.app',
        'https://lopo-miti.vercel.app',
        'http://localhost:5173',
        'http://localhost:4173',
    ];
    const isAllowed = allowedOrigins.includes(origin) || /^https:\/\/.*\.vercel\.app$/.test(origin);
    res.setHeader('Access-Control-Allow-Origin', isAllowed ? origin : allowedOrigins[0]);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');
    if (req.method === 'OPTIONS') return res.status(200).end();

    // App Check検証
    if (!(await verifyAppCheck(req, res))) return;

    try {
        initAdmin();
        const db = getFirestore();

        if (req.method === 'GET') {
            // ── 人気プラン取得 ──
            const { contentIds } = req.query;
            if (!contentIds) {
                return res.status(400).json({ error: 'contentIds is required' });
            }

            const ids: string[] = (contentIds as string).split(',').map(s => s.trim()).filter(Boolean);
            if (ids.length === 0) {
                return res.status(400).json({ error: 'contentIds is empty' });
            }

            const mapDoc = (doc: any) => {
                const data = doc.data();
                const partyMembers = data.planData?.partyMembers?.map((m: any) => ({
                    id: m.id,
                    jobId: m.jobId,
                    role: m.role,
                })) ?? [];
                return {
                    shareId: data.shareId,
                    title: data.title ?? '',
                    contentId: data.contentId,
                    copyCount: data.copyCount ?? 0,
                    viewCount: data.viewCount ?? 0,
                    featured: data.featured === true,
                    createdAt: data.createdAt,
                    partyMembers,
                };
            };

            // 各コンテンツIDについて上位2件 + featured を並列取得
            const results = await Promise.all(
                ids.map(async (id) => {
                    // featured プランを取得
                    const featuredSnap = await db
                        .collection(COLLECTION)
                        .where('contentId', '==', id)
                        .where('featured', '==', true)
                        .limit(1)
                        .get();

                    // viewCount降順で上位3件を取得
                    const popularSnap = await db
                        .collection(COLLECTION)
                        .where('contentId', '==', id)
                        .orderBy('viewCount', 'desc')
                        .limit(3)
                        .get();

                    // ランキング: viewCount順の上位2件（featuredかどうかに関係なく純粋な人気順）
                    const plans: any[] = [];
                    for (const doc of popularSnap.docs) {
                        if (plans.length < 2) {
                            plans.push(mapDoc(doc));
                        }
                    }

                    // featured: 存在すればそのまま返す（フロントで重複判定する）
                    const featured = featuredSnap.docs.length > 0
                        ? mapDoc(featuredSnap.docs[0])
                        : null;

                    return { contentId: id, plans, featured };
                })
            );

            // キャッシュヘッダー設定
            res.setHeader('Cache-Control', 'public, s-maxage=900, max-age=300');
            return res.status(200).json({ results });

        } else if (req.method === 'POST') {
            // ── コピーカウント増加（重複排除付き）──
            const { shareId, uid } = req.body;
            if (!shareId) {
                return res.status(400).json({ error: 'shareId is required' });
            }

            const docRef = db.collection(COLLECTION).doc(shareId as string);
            const snap = await docRef.get();
            if (!snap.exists) {
                return res.status(404).json({ error: 'not found' });
            }

            // uidがある場合: 重複チェック（1ユーザー1共有プランあたり1回のみ）
            let alreadyCounted = false;
            if (uid) {
                const copiedByRef = db.doc(`${COLLECTION}/${shareId}/copiedBy/${uid}`);
                const existing = await copiedByRef.get();
                if (existing.exists) {
                    alreadyCounted = true;
                } else {
                    // バッチ書き込み: copiedBy記録 + copyCount増加
                    const batch = db.batch();
                    batch.set(copiedByRef, { copiedAt: FieldValue.serverTimestamp() });
                    batch.update(docRef, { copyCount: FieldValue.increment(1) });
                    await batch.commit();
                }
            } else {
                // uid未提供（未ログイン）: カウントしない
                alreadyCounted = true;
            }

            if (!alreadyCounted) {
                // 昇格候補チェック（fire-and-forget）
                checkPromotionCandidate(db, shareId as string, snap.data()!).catch(() => {});
            }

            return res.status(200).json({ ok: true, alreadyCounted });

        } else {
            return res.status(405).json({ error: 'Method not allowed' });
        }
    } catch (err: any) {
        console.error('Popular API error:', err);
        return res.status(500).json({ error: 'Internal server error', details: String(err) });
    }
}
