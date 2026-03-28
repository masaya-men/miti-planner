// src/lib/appCheckVerify.ts
import { getAppCheck } from 'firebase-admin/app-check';
import { initAdmin } from './adminAuth';

/**
 * App Checkトークンを検証するミドルウェア関数
 * @returns true=検証OK、false=検証失敗（既に403を返却済み）
 */
export async function verifyAppCheck(req: any, res: any): Promise<boolean> {
  const enforced = process.env.ENFORCE_APP_CHECK === 'true';

  const token = req.headers['x-firebase-appcheck'] as string | undefined;
  if (!token) {
    if (enforced) {
      res.status(403).json({ error: 'App Check token missing' });
      return false;
    }
    return true;
  }

  try {
    initAdmin();
    await getAppCheck().verifyToken(token);
    return true;
  } catch (err) {
    console.warn('[AppCheck] トークン検証失敗:', err);
    if (enforced) {
      res.status(403).json({ error: 'App Check token invalid' });
      return false;
    }
    return true;
  }
}
