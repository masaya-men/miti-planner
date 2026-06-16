// 共同編集 書き戻し: DO の onSave がここを叩き、軽減配置を Firestore に保存する。
// ⑤: roomToken → planId 解決(失効/不存在は skipped)。planId 直接は ②-a/③ レガシー経路。
//     緊急停止中は書かない。墓標ガード: deleted なら書かない(削除が勝つ)。
//     data.timelineMitigations だけ部分更新し version をインクリメント(既存の楽観ロックと整合)。
import { authorizeCollab, getDb } from './_handlerShared.js';
import { decideSave, emptyOverwriteSkips, type MitigationRecord, type PlanDocSnapshotFull } from './_logic.js';
import { resolveRoom, isCollabDisabled, type CollabRoomDoc } from './_roomLogic.js';
import { FieldValue, type Transaction } from 'firebase-admin/firestore';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  if (!authorizeCollab(req.headers['x-collab-secret'])) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  // 緊急停止: 止血中は書かない(skipped で DO の #saveEnabled を落とす)。
  if (isCollabDisabled(process.env)) return res.status(200).json({ skipped: 'disabled' });

  const { planId: bodyPlanId, roomToken, mitigations,
    timelineEvents, phases, labels, memos, currentLevel, aaSettings, schAetherflowPatterns, partyMembers } =
    (req.body ?? {}) as {
      planId?: string; roomToken?: string; mitigations?: MitigationRecord[];
      timelineEvents?: unknown[]; phases?: unknown[]; labels?: unknown[]; memos?: unknown[];
      currentLevel?: number; aaSettings?: unknown; schAetherflowPatterns?: unknown; partyMembers?: unknown[];
    };
  if (!Array.isArray(mitigations)) {
    return res.status(400).json({ error: 'mitigations[] required' });
  }

  const db = getDb();
  let planId: string;
  if (roomToken) {
    const roomSnap = await db.collection('collabRooms').doc(roomToken).get();
    const room = resolveRoom(roomSnap.exists ? (roomSnap.data() as CollabRoomDoc) : null);
    // 'reason' in room で失敗バリアントへ narrow(strict-off でも効く `in` 演算子。`!room.ok` は不可)。
    if ('reason' in room) return res.status(200).json({ skipped: room.reason }); // 失効/不存在 → 書かない
    planId = room.planId;
  } else {
    planId = bodyPlanId ?? ''; // ②-a/③ レガシー経路
    if (!planId) return res.status(400).json({ error: 'roomToken or planId required' });
  }

  const ref = db.collection('plans').doc(planId);
  const result = await db.runTransaction(async (tx: Transaction) => {
    const snap = await tx.get(ref);
    const planDoc = snap.exists ? (snap.data() as PlanDocSnapshotFull) : null;
    const decision = decideSave(planDoc);
    if ('skip' in decision) return decision;
    // 空上書きガード: collab desync で空配列が非空の既存を破壊するのを防ぐ(構造フィールドのみ)。
    // スキップしても下で ok を返す(DO へ 'skipped' を返すと墓標扱いでバイナリ破棄＝部屋破壊になるため)。
    const existing = planDoc?.data ?? {};
    const skip = emptyOverwriteSkips(
      { timelineMitigations: mitigations, timelineEvents, phases, partyMembers },
      existing,
    );
    // mitigations/version/updatedAt は現行どおり。②-b-1: 送られた data.* だけ部分更新
    // (Array.isArray/typeof ガードで「未送信フィールドは触らない」を保証。レガシー planId 経路でも安全)。
    const update: Record<string, unknown> = {
      version: decision.nextVersion,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (!skip.has('timelineMitigations')) update['data.timelineMitigations'] = mitigations;
    if (Array.isArray(timelineEvents) && !skip.has('timelineEvents')) update['data.timelineEvents'] = timelineEvents;
    if (Array.isArray(phases) && !skip.has('phases')) update['data.phases'] = phases;
    if (Array.isArray(labels)) update['data.labels'] = labels;
    if (Array.isArray(memos)) update['data.memos'] = memos;
    if (typeof currentLevel === 'number') update['data.currentLevel'] = currentLevel;
    if (aaSettings !== undefined) update['data.aaSettings'] = aaSettings;
    if (schAetherflowPatterns !== undefined) update['data.schAetherflowPatterns'] = schAetherflowPatterns;
    if (Array.isArray(partyMembers) && !skip.has('partyMembers')) update['data.partyMembers'] = partyMembers;
    tx.update(ref, update);
    if (skip.size > 0) {
      // 観測性: ガード発火を記録(どのフィールドを空上書きから守ったか)。
      console.warn(`collab save: empty-overwrite guard skipped [${[...skip].join(',')}] plan=${planId}`);
    }
    return decision;
  });

  if ('skip' in result) return res.status(200).json({ skipped: result.skip });
  return res.status(200).json({ ok: true, version: result.nextVersion });
}
