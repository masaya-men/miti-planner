// 共同編集 seed: DO の onLoad がここを叩き、現在の軽減配置を取得する。
// ⑤: roomToken を受け取り collabRooms/{roomToken} → planId を解決(失効/不存在は seed させない)。
//     planId 直接指定は ②-a/③ レガシー経路として残す(非破壊)。緊急停止中は seed させない。
// 墓標/不存在は decideLoad が {deleted:true} を返し、DO は seed しない(破壊保存ガード)。
import { authorizeCollab, getDb } from './_handlerShared.js';
import { decideLoadFull, type PlanDocSnapshotFull } from './_logic.js';
import { resolveRoom, isCollabDisabled, type CollabRoomDoc } from './_roomLogic.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  if (!(await applyRateLimit(req, res, 60, 60_000, { scope: 'collab-load', globalMax: 3000 }))) return;
  if (!authorizeCollab(req.headers['x-collab-secret'])) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  // 緊急停止: 止血中は seed させない(部屋は空のまま=破壊保存ガードで保存もされない)。
  if (isCollabDisabled(process.env)) return res.status(200).json({ deleted: true });

  const db = getDb();
  const roomToken = (req.query?.roomToken as string) ?? '';
  let planId: string;
  let maxParticipants: number | undefined;
  let ownerLabel: string | undefined;

  if (roomToken) {
    const roomSnap = await db.collection('collabRooms').doc(roomToken).get();
    const room = resolveRoom(roomSnap.exists ? (roomSnap.data() as CollabRoomDoc) : null);
    if (!room.ok) return res.status(200).json({ deleted: true }); // 失効/不存在 → seed しない
    planId = room.planId;
    maxParticipants = room.maxParticipants;
    ownerLabel = room.label;
  } else {
    planId = (req.query?.planId as string) ?? ''; // ②-a/③ レガシー経路
    if (!planId) return res.status(400).json({ error: 'roomToken or planId required' });
  }

  const snap = await db.collection('plans').doc(planId).get();
  const plan = snap.exists ? (snap.data() as PlanDocSnapshotFull) : null;
  const result = decideLoadFull(plan);
  if ('deleted' in result) return res.status(200).json(result);
  // result は mitigations/timelineEvents/phases/labels/memos/currentLevel/aaSettings/schAetherflowPatterns を含む。
  // maxParticipants は roomToken 経路のみ付与(レガシーは undefined → JSON で省略・DO は無視可)。
  return res.status(200).json({ ...result, maxParticipants, ownerLabel });
}
