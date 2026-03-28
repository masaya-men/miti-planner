/**
 * 監査ログ書き込みヘルパー
 * 管理操作をFirestoreの /admin_logs コレクションに記録する
 * サーバーサイド（Vercel API）からのみ使用
 */
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

export type AuditAction = 'create' | 'update' | 'delete' | 'set_role';

interface AuditLogEntry {
  action: AuditAction;
  target: string;
  adminUid: string;
  changes?: { before?: unknown; after?: unknown };
}

/**
 * 監査ログを1件書き込む
 * Admin SDKが初期化済みであること（initAdmin()呼び出し後）
 */
export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  const db = getFirestore();
  await db.collection('admin_logs').add({
    ...entry,
    timestamp: FieldValue.serverTimestamp(),
  });
}
