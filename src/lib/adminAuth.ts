/**
 * 管理者認証ヘルパー
 * 全ての管理APIで共通して使うFirebase Admin SDK初期化とトークン検証
 */
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

/** Firebase Admin SDKを初期化（既に初期化済みならスキップ） */
export function initAdmin() {
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

/** リクエストからBearerトークンを抽出 */
function extractToken(req: any): string | null {
  const authHeader = req.headers?.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return null;
}

/**
 * リクエストの送信者が管理者かどうかを検証
 * @returns 管理者のUID（検証成功時）、null（失敗時）
 */
export async function verifyAdmin(req: any): Promise<string | null> {
  const token = extractToken(req);
  if (!token) return null;

  try {
    const decoded = await getAuth().verifyIdToken(token);
    if (decoded.role === 'admin') {
      return decoded.uid;
    }
    return null;
  } catch {
    return null;
  }
}

/** Firestore管理者用インスタンスを取得 */
export function getAdminFirestore() {
  return getFirestore();
}
