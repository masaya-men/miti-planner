import type { PlanData, SavedPlan } from '../../types';
import type { SheetImportResult } from './buildPlanFromSheets';
import { buildImportedPartyMembers } from './buildImportedPartyMembers';
import { generateUniqueTitle } from '../../utils/planTitle';
import { commitNewPlan } from '../commitNewPlan';
import { usePlanStore } from '../../store/usePlanStore';
import { useMitigationStore } from '../../store/useMitigationStore';
import { useCollabSessionStore } from '../../store/useCollabSessionStore';

/**
 * スプレッドシート取り込み結果から「新規・非共同編集プラン」を安全に確定する。
 *
 * 取り込みは必ず新規プランを作る操作なので、NewPlanModal と同じ安全作法を踏む:
 * 1. **先に共同編集を切断**（root cause 対策）。共同編集 ON のまま取り込むと
 *    `loadSnapshot` が `_collabActive` ガードで no-op になり、新プランが「取込データ」では
 *    なく「直前に開いていた表」の中身で作られてしまう（1回目だけ壊れ2回目で直る現象）。
 *    collab-ON の表はオーナーが開いた瞬間に自動接続されるため、この経路は容易に踏まれる。
 * 2. 直前プランを保存（破壊しない）。
 * 3. 取込データを作業ストアへ反映（切断後なので `loadSnapshot` が確実に効く）。
 * 4. 作業ストアのスナップショットで新規プランを確定。
 */
export function commitImportedPlan(
  result: SheetImportResult,
  meta: { contentId: string | null; title: string },
): string {
  const planData: PlanData = {
    currentLevel: 100,
    timelineEvents: result.timelineEvents,
    timelineMitigations: result.timelineMitigations,
    phases: result.phases,
    labels: result.labels,
    partyMembers: buildImportedPartyMembers(result.party),
    aaSettings: { damage: 10000, type: 'physical', target: 'MT' },
    schAetherflowPatterns: {},
  };

  const plansState = usePlanStore.getState();
  const miti = useMitigationStore.getState();

  // 1. 取り込みは新規・非collabプランを作る。共同編集ON中なら先に切断して
  //    loadSnapshot が no-op にならないようにする（NewPlanModal と同作法・C-1/根治2 系）。
  useCollabSessionStore.getState().disconnect();
  // 防御(defense-in-depth): 通常 disconnect() がセッション経由で同期的に
  //   exitCollabMode()(_collabActive=false) を呼ぶが、セッション欠落等でフラグが
  //   残る異常系でも loadSnapshot を確実に効かせる。データ正確性を session teardown の
  //   成否に依存させない（この保険は通常経路では発火しない＝既に false のため）。
  //   ※ disconnect 後は state が差し替わるため fresh に getState() で読む（miti は古い参照）。
  if (useMitigationStore.getState()._collabActive) {
    useMitigationStore.getState().exitCollabMode();
  }

  // 2. 直前プランの編集を保存（破壊しない）
  if (plansState.currentPlanId) {
    plansState.updatePlan(plansState.currentPlanId, { data: miti.getSnapshot() });
  }
  // 取り込みデータを作業ストアへ反映
  miti.loadSnapshot(planData);

  const newPlanId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? `plan_${crypto.randomUUID()}` : `plan_${Date.now()}`;
  const newPlan: SavedPlan = {
    id: newPlanId,
    ownerId: 'local',
    ownerDisplayName: 'Guest',
    title: generateUniqueTitle(meta.title, plansState.plans, meta.contentId),
    contentId: meta.contentId,
    isPublic: false,
    copyCount: 0,
    useCount: 0,
    data: miti.getSnapshot(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  commitNewPlan(newPlan);
  return newPlanId;
}
