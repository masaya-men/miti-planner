/**
 * POST /api/housing?action=delete-thumbnail
 *
 * 直接アップロード画像 (imageMode='thumbnail') の1枚を削除する。
 * 削除すると後続の画像が詰めて繰り上がる (2026-07-20 編集ページ画像管理設計)。
 * 最後の1枚は削除できない (登録時と同じく最低1枚を保証)。
 *
 * Body: { listingId: string, index: number }
 * 認可: Firebase ID token (Bearer) + listing.ownerUid === uid
 */
import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { computeArrayDeletion, parseStoragePathFromPublicUrl } from './_imageArrayLogic.js';
import { bumpPublicVersionTx } from './_publicVersion.js';

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
  if (!(await applyRateLimit(req, res, 10, 60_000, { scope: 'housing-delete-thumbnail' }))) return;

  try {
    initAdmin();
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'unauthenticated' });
    const decoded = await getAuth().verifyIdToken(token);
    const uid = decoded.uid;

    const { listingId, index } = req.body || {};
    if (!listingId || typeof listingId !== 'string') {
      return res.status(400).json({ error: 'invalid_listingId' });
    }
    if (typeof index !== 'number') {
      return res.status(400).json({ error: 'invalid_index' });
    }

    const adminDb = getAdminFirestore();
    const listingRef = adminDb.collection('housing_listings').doc(listingId);

    let removedUrl: string | null = null;
    let newPaths: string[] = [];

    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(listingRef);
      if (!snap.exists) throw new Error('not_found');
      const data = snap.data()!;
      if (data.ownerUid !== uid) throw new Error('forbidden');
      if (data.deletedAt) throw new Error('not_found');

      const current: string[] = Array.isArray(data.thumbnailPaths) ? data.thumbnailPaths : [];
      const result = computeArrayDeletion(current, index);
      if (!result.ok) throw new Error(result.error);

      removedUrl = result.removed;
      newPaths = result.next;

      tx.update(listingRef, {
        thumbnailPaths: newPaths,
        thumbnailPath: newPaths[0],
        updatedAt: Date.now(),
      });
      bumpPublicVersionTx(tx, adminDb);
    });

    // Storageファイルの実削除はトランザクション成功後 (Firestoreの一貫性を優先し、
    // Storage削除の失敗でトランザクション全体を巻き戻さない。削除できなくても
    // Firestore側の配列からは既に消えているため表示上の実害は無い)。
    if (removedUrl) {
      const path = parseStoragePathFromPublicUrl(removedUrl);
      if (path) {
        try {
          await getStorage().bucket().file(path).delete();
        } catch (e) {
          console.error('[housing/delete-thumbnail] storage delete failed (non-fatal):', e);
        }
      }
    }

    return res.status(200).json({ success: true, thumbnailPaths: newPaths });
  } catch (error: any) {
    if (error?.message === 'not_found') return res.status(404).json({ error: 'not_found' });
    if (error?.message === 'forbidden') return res.status(403).json({ error: 'forbidden' });
    if (error?.message === 'invalid_index') return res.status(400).json({ error: 'invalid_index' });
    if (error?.message === 'last_item') return res.status(400).json({ error: 'last_item' });
    console.error('[housing/delete-thumbnail] error:', error);
    return res.status(500).json({ error: error?.message || 'Internal error' });
  }
}
