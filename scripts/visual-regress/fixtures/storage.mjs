// @ts-check
/**
 * localStorage の見本(visual-regress 共通部品)。
 * 返り値は { キー: 値 }。値が文字列ならそのまま、それ以外は JSON.stringify して書く
 * (serializeStorage を使うとその規則どおりに文字列化できる)。
 */
import { EVENT_FIXTURE, PHASE_FIXTURE, PARTY_FIXTURE, MITIGATION_FIXTURE } from '../../milspec-sp2/_fixture.mjs';

/** 値の文字列化規則: 文字列はそのまま、それ以外は JSON.stringify */
export function serializeStorage(entries) {
  return Object.fromEntries(Object.entries(entries).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]));
}

/** 初回の案内窓(チュートリアル・モバイルガイド・ハウジング初回案内)を出さない 3 キー */
export function baseStorage() {
  return {
    'tutorial-storage': { state: { hasCompleted: true, hasVisitedShare: true, isActive: false }, version: 0 },
    'lopo_mobile_guide_completed': 'true',
    'housing-onboarding-seen': '1',
  };
}

// ───────────────────────────── 軽減表の見本(shots.mjs の buildStorage を移したもの) ─────────────────────────────
const ROLES = { MT: 'tank', ST: 'tank', H1: 'healer', H2: 'healer', D1: 'dps', D2: 'dps', D3: 'dps', D4: 'dps' };
const STATS = { hp: 186846, mainStat: 6217, det: 2410, crt: 420, ten: 420, ss: 420, wd: 154 };
const mkEvent = (id, time, target, i) => ({ id, time, name: { ja: `攻撃 ${i}`, en: `Attack ${i}` }, damageType: 'magical', damageAmount: 120000, target });
const EVENTS = [mkEvent('rg-ev-a', 4, 'AoE', 100), mkEvent('rg-ev-b', 10, 'MT', 101), ...EVENT_FIXTURE.map((e, i) => ({ ...e, id: `rg-ev${i}`, target: 'AoE' }))];
const PHASES = PHASE_FIXTURE.map((p, i) => ({ ...p, id: `rg-ph${i + 1}` }));
const MEMOS = [
  { id: 'rg-memo-1', text: 'メモ1', timeSec: 51, xRatio: 0.6, createdAt: 1, updatedAt: 1 },
  { id: 'rg-memo-2', text: 'メモ2', timeSec: 87, xRatio: 0.85, createdAt: 2, updatedAt: 2 },
  { id: 'rg-memo-3', text: 'メモ3', timeSec: 123, xRatio: 0.66, createdAt: 3, updatedAt: 3 },
];

/**
 * 軽減表(/miti)の localStorage。
 * @param {{ view: string, party: 4|8, theme: { mode: string, style: string }, lang?: string, over?: Record<string, unknown> }} o
 *   over: mitigation-storage.state を上書きしたいキー(省略可)
 */
export function mitiStorage({ view, party, theme, lang = 'ja', over = {} }) {
  const four = party === 4;
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
    'plan-storage': { state: { plans: [], currentPlanId: 'rg-debug', lastActivePlanId: null, _dirtyPlanIds: [], _deletedPlanIds: [] }, version: 2 },
    'theme-storage': {
      state: { theme: theme.mode, themeStyle: theme.style, contentLanguage: lang, mobileEffectBarMode: 'icon', timelineView: view }, version: 3,
    },
  };
}

/**
 * ハウジング(/housing)の localStorage。baseStorage() と合わせて使う。
 * @param {{ theme: { mode: string, style: string }, favorites?: string[], lang?: string }} o
 */
export function housingStorage({ theme, favorites = [], lang = 'ja' }) {
  return {
    'theme-storage': {
      state: { theme: theme.mode, themeStyle: theme.style, contentLanguage: lang, mobileEffectBarMode: 'icon', timelineView: 'lanes' }, version: 3,
    },
    'housing-favorites': { state: { ids: favorites }, version: 0 },
  };
}
