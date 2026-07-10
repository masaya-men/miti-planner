/**
 * GET /api/housing?action=my-personal-tag
 *
 * ログイン中ユーザーが持つ個人タグを返す (未作成なら tag: null)。
 * TagPicker「個人」タブの「自分のタグ作成 (未作成時)」判定に使う。
 */
import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { getAuth } from 'firebase-admin/auth';
import type { PersonalTag } from '../../src/types/housing.js';

const COLLECTION = 'personal_tags';

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');
}

export default async function handler(req: any, res: any) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!(await verifyAppCheck(req, res))) return;
  if (!(await applyRateLimit(req, res, 30, 60_000))) return;

  try {
    initAdmin();
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'unauthenticated' });
    const decoded = await getAuth().verifyIdToken(token);
    const uid = decoded.uid;

    const adminDb = getAdminFirestore();
    const snap = await adminDb
      .collection(COLLECTION)
      .where('ownerUid', '==', uid)
      .limit(1)
      .get();

    const tag = snap.empty ? null : (snap.docs[0].data() as PersonalTag);
    return res.status(200).json({ tag });
  } catch (error: any) {
    console.error('[housing/my-personal-tag] error:', error);
    return res.status(500).json({ error: 'Internal error' });
  }
}
