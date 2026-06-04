// 共同編集 書き戻し: DO の onSave がここを叩き、軽減配置を Firestore に保存する。
// ⑤: roomToken → planId 解決(失効/不存在は skipped)。planId 直接は ②-a/③ レガシー経路。
//     緊急停止中は書かない。墓標ガード: deleted なら書かない(削除が勝つ)。
//     data.timelineMitigations だけ部分更新し version をインクリメント(既存の楽観ロックと整合)。
import { authorizeCollab, getDb } from './_handlerShared.js';
import { decideSave, type MitigationRecord, type PlanDocSnapshot } from './_logic.js';
import { resolveRoom, isCollabDisabled, type CollabRoomDoc } from './_roomLogic.js';
import { FieldValue, type Transaction } from 'firebase-admin/firestore';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  if (!authorizeCollab(req.headers['x-collab-secret'])) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  // 緊急停止: 止血中は書かない(skipped で DO の #saveEnabled を落とす)。
  if (isCollabDisabled(process.env)) return res.status(200).json({ skipped: 'disabled' });

  const { planId: bodyPlanId, roomToken, mitigations } =
    (req.body ?? {}) as { planId?: string; roomToken?: string; mitigations?: MitigationRecord[] };
  if (!Array.isArray(mitigations)) {
    return res.status(400).json({ error: 'mitigations[] required' });
  }

  const db = getDb();
  let planId: string;
  if (roomToken) {
    const roomSnap = await db.collection('collabRooms').doc(roomToken).get();
    const room = resolveRoom(roomSnap.exists ? (roomSnap.data() as CollabRoomDoc) : null);
    if (!room.ok) return res.status(200).json({ skipped: room.reason }); // 失効/不存在 → 書かない
    planId = room.planId;
  } else {
    planId = bodyPlanId ?? ''; // ②-a/③ レガシー経路
    if (!planId) return res.status(400).json({ error: 'roomToken or planId required' });
  }

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
