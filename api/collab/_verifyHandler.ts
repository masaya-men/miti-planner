// ④-a: worker(onBeforeConnect) が接続者の Firebase ID トークンを検証するために叩く受付係。
// 認証は DO↔Vercel 共有シークレット(x-collab-secret)。Firestore は使わず ID トークン検証のみ。
// 先頭 `_` で Vercel 関数ルートにしない。worker 以外から叩けないよう secret 必須。
import { initAdmin } from '../../src/lib/adminAuth.js';
import { authorizeCollab } from './_handlerShared.js';
import { getAuth } from 'firebase-admin/auth';
import { applyRateLimit } from '../../src/lib/rateLimit.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  if (!(await applyRateLimit(req, res, 30, 60_000, { scope: 'collab-verify', globalMax: 1500 }))) return;
  if (!authorizeCollab(req.headers['x-collab-secret'])) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const token = typeof req.body?.token === 'string' ? req.body.token : '';
  if (!token) return res.status(200).json({ valid: false });
  try {
    initAdmin();
    const decoded = await getAuth().verifyIdToken(token);
    return res.status(200).json({ valid: true, uid: decoded.uid });
  } catch {
    // 不正/期限切れ/署名不一致 → valid:false(worker は fail-closed で viewer 扱い)。
    return res.status(200).json({ valid: false });
  }
}
