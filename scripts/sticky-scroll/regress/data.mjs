import { EVENT_FIXTURE, PHASE_FIXTURE, PARTY_FIXTURE, MITIGATION_FIXTURE } from '../../milspec-sp2/_fixture.mjs';

// ───────────────────────────── 表のデータ(決定的) ─────────────────────────────
const ROLES = { MT: 'tank', ST: 'tank', H1: 'healer', H2: 'healer', D1: 'dps', D2: 'dps', D3: 'dps', D4: 'dps' };
const STATS = { hp: 186846, mainStat: 6217, det: 2410, crt: 420, ten: 420, ss: 420, wd: 154 };
const mkEvent = (id, time, target, i) => ({
  id, time, name: { ja: `攻撃 ${i}`, en: `Attack ${i}` }, damageType: 'magical', damageAmount: 120000, target,
});
/** チュートリアルの目印(4 秒の全体攻撃・10 秒のタンク強攻撃)を含む 32 イベント。 */
const EVENTS = [mkEvent('rg-ev-a', 4, 'AoE', 100), mkEvent('rg-ev-b', 10, 'MT', 101), ...EVENT_FIXTURE.map((e, i) => ({ ...e, id: `rg-ev${i}`, target: 'AoE' }))];
const PHASES = PHASE_FIXTURE.map((p, i) => ({ ...p, id: `rg-ph${i + 1}` }));
const MEMOS = [
  { id: 'rg-memo-1', text: 'メモ1', timeSec: 51, xRatio: 0.6, createdAt: 1, updatedAt: 1 },
  { id: 'rg-memo-2', text: 'メモ2', timeSec: 87, xRatio: 0.85, createdAt: 2, updatedAt: 2 },
  { id: 'rg-memo-3', text: 'メモ3', timeSec: 123, xRatio: 0.66, createdAt: 3, updatedAt: 3 }, // 右クリック削除の確認用(スプシでも画面内にある位置)
];

export function buildStorage(cond, over = {}) {
  // 4 人 = 「表示メンバー」のスイッチで 4 人(MT・H1・D1・D3)だけ見せる(ジョブ未設定の列も描かれるので、隠すのが実際の操作)
  const four = cond.party === 4;
  const members = PARTY_FIXTURE.map(([id, jobId]) => ({ id, jobId, role: ROLES[id], stats: STATS, computedValues: {} }));
  const mits = MITIGATION_FIXTURE.map((m) => ({ ...m }));
  return {
    'mitigation-storage': {
      state: {
        currentLevel: 100, timelineEvents: EVENTS, timelineMitigations: mits, phases: PHASES, labels: [],
        partyMembers: members, schAetherflowPatterns: {}, aaSettings: { damage: 0, type: 'magical', target: 'MT' },
        myMemberId: null, myJobHighlight: false, hideEmptyRows: true, showRowBorders: false, timelineSortOrder: 'light_party',
        hiddenPartyMemberIds: four ? ['ST', 'H2', 'D2', 'D4'] : [], memos: MEMOS.map((m) => ({ ...m })), progress: { points: [], cleared: false }, _loadedPlanId: null,
        ...over,
      },
      version: 4,
    },
    'plan-storage': {
      state: { plans: [], currentPlanId: 'rg-debug', lastActivePlanId: null, _dirtyPlanIds: [], _deletedPlanIds: [] },
      version: 2,
    },
  };
}
