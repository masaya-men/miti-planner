import type { SavedPlan } from '../types';

/**
 * 手元の版を「競合コピー」(別の新しい表)にする。同期の競合コピー(usePlanStore の syncToFirestore /
 * manualSync)と同じ形。読み直しの最中の本当の競合で、手元の編集を消さずに残すために使う。
 */
export function makeConflictCopy(plan: SavedPlan): SavedPlan {
  const now = Date.now();
  return {
    ...structuredClone(plan),
    id: `plan_${now}_${Math.random().toString(36).slice(2, 8)}_conflict`,
    ownerId: 'local',
    ownerDisplayName: 'Guest',
    title: `${plan.title} (競合コピー)`,
    createdAt: now,
    updatedAt: now,
    // 競合コピーは独立した新しい表。元の表の共同編集の部屋の「持ち主」を名乗らせない。
    activeCollabRoomToken: undefined,
    collabMaxParticipants: undefined,
  };
}

/** 手元の版を競合コピーとして表一覧へ足し、知らせる(同期の競合コピーと同じ知らせ)。 */
export function addConflictCopies(conflicts: SavedPlan[], addPlan: (plan: SavedPlan) => void): void {
  if (conflicts.length === 0) return;
  for (const plan of conflicts) addPlan(makeConflictCopy(plan));
  void Promise.all([import('../components/Toast'), import('i18next')])
    .then(([{ showToast }, i18n]) => showToast(i18n.default.t('app.plan_conflict_detected')))
    .catch(() => { /* 知らせられなくても表は残っている */ });
}
