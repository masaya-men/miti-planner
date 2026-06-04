// 共同編集③ 書き戻し: DO の onSave がここを叩き、軽減配置を Firestore に保存する。
// 墓標ガード: deleted なら書かない(削除が勝つ)。data.timelineMitigations だけ部分更新し
// version をインクリメント(既存の楽観ロックと整合)。読んでから書くためトランザクション。
import { authorizeCollab, getDb } from './_handlerShared';
import { decideSave, type MitigationRecord, type PlanDocSnapshot } from './_logic';
import { FieldValue, type Transaction } from 'firebase-admin/firestore';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  if (!authorizeCollab(req.headers['x-collab-secret'])) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const { planId, mitigations } = (req.body ?? {}) as { planId?: string; mitigations?: MitigationRecord[] };
  if (!planId || !Array.isArray(mitigations)) {
    return res.status(400).json({ error: 'planId and mitigations[] required' });
  }

  const db = getDb();
  const ref = db.collection('plans').doc(planId);

  const result = await db.runTransaction(async (tx: Transaction) => {
    const snap = await tx.get(ref);
    const decision = decideSave(snap.exists ? (snap.data() as PlanDocSnapshot) : null);
    if ('skip' in decision) return decision;
    tx.update(ref, {
      'data.timelineMitigations': mitigations,
      version: decision.nextVersion,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return decision;
  });

  if ('skip' in result) return res.status(200).json({ skipped: result.skip });
  return res.status(200).json({ ok: true, version: result.nextVersion });
}
