/**
 * テンプレート管理API — 共通部品(CORS・バックアップ作成・dataVersion 加算)
 */
import { FieldValue } from 'firebase-admin/firestore';
import type { ApiRequest, ApiResponse } from '../_apiTypes.js';

/** CORS設定 */
export function setCors(req: ApiRequest, res: ApiResponse) {
  const origin = req.headers?.origin || '';
  const allowedOrigins = [
    'https://lopoly.app',
    'https://lopo-miti.vercel.app',
    'http://localhost:5173',
    'http://localhost:4173',
  ];
  const isAllowed = allowedOrigins.includes(origin) || /^https:\/\/lopo-miti(-[a-z0-9]+)?\.vercel\.app$/.test(origin);
  res.setHeader('Access-Control-Allow-Origin', isAllowed ? origin : allowedOrigins[0]);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');
}

/** テンプレートのバックアップを作成 */
export async function createBackup(db: FirebaseFirestore.Firestore, contentId: string, data: unknown) {
  const backupRef = db.collection('template_backups').doc(`template_${contentId}_${Date.now()}`);
  await backupRef.set({
    type: 'template',
    contentId,
    data,
    createdAt: FieldValue.serverTimestamp(),
  });
}

/** /master/config の dataVersion を+1する */
export async function bumpDataVersion(db: FirebaseFirestore.Firestore) {
  const configRef = db.doc('master/config');
  await configRef.set({ dataVersion: FieldValue.increment(1) }, { merge: true });
}
