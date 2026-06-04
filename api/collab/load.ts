// 共同編集③ seed: DO の onLoad がここを叩き、現在の軽減配置を取得する。
// 墓標/不存在は decideLoad が {deleted:true} を返し、DO は seed しない(破壊保存ガード)。
import { authorizeCollab, getDb } from './_handlerShared.js';
import { decideLoad, type PlanDocSnapshot } from './_logic.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  if (!authorizeCollab(req.headers['x-collab-secret'])) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const planId = (req.query?.planId as string) ?? '';
  if (!planId) return res.status(400).json({ error: 'planId required' });

  const snap = await getDb().collection('plans').doc(planId).get();
  const plan = snap.exists ? (snap.data() as PlanDocSnapshot) : null;
  return res.status(200).json(decideLoad(plan));
}
