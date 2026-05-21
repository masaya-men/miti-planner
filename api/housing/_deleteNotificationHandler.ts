/**
 * POST /api/housing?action=delete-notification
 *
 * Body: { notificationId } または { listingId }
 *  - 認証: Bearer (Firebase Web SDK の現在ユーザー idToken)
 *  - notificationId 指定なら 1 件削除
 *  - listingId 指定なら、 その物件に紐づく自分の通知をまとめて削除 (最大 100 件)
 *
 * 通報通知は「解決 = リストから消える」 方針 (read で残さない)。
 * 家主が詳細バナーで対処 (却下 / 異議 / 編集 / 削除) したら、 その物件の通知を消す。
 * 操作対象は常に呼び出し元 (uid) 自身の subcollection なので、 ownerUid 認可は不要。
 */
import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { getAuth } from 'firebase-admin/auth';

function setCors(req: any, res: any) {
  const origin = req.headers?.origin || '';
  const allowed = [
    'https://lopoly.app',
    'https://lopo-miti.vercel.app',
    'http://localhost:5173',
    'http://localhost:4173',
  ];
  const ok = allowed.includes(origin) || /^https:\/\/.*\.vercel\.app$/.test(origin);
  res.setHeader('Access-Control-Allow-Origin', ok ? origin : allowed[0]);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');
}

export default async function handler(req: any, res: any) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!(await verifyAppCheck(req, res))) return;
  if (!(await applyRateLimit(req, res, 60, 60_000))) return;

  try {
    initAdmin();
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'unauthenticated' });
    const decoded = await getAuth().verifyIdToken(token);
    const uid = decoded.uid;

    const { notificationId, listingId } = req.body || {};
    const adminDb = getAdminFirestore();
    const colRef = adminDb.collection('users').doc(uid).collection('notifications');

    if (typeof listingId === 'string' && listingId) {
      // その物件に紐づく自分の通知をまとめて削除 (解決時にパイルを一掃)
      const snap = await colRef.where('listingId', '==', listingId).limit(100).get();
      const batch = adminDb.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      return res.status(200).json({ success: true, deleted: snap.size });
    }

    if (typeof notificationId === 'string' && notificationId) {
      await colRef.doc(notificationId).delete();
      return res.status(200).json({ success: true, deleted: 1 });
    }

    return res.status(400).json({ error: 'invalid_request' });
  } catch (error: any) {
    console.error('[housing/delete-notification] error:', error);
    return res.status(500).json({ error: 'Internal error' });
  }
}
