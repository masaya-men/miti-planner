// ───────────────────────────── 条件 ─────────────────────────────
const VPS = [
  { id: '1489', w: 1489, h: 679, dsf: 2.58, label: '本人' },
  { id: '1920', w: 1920, h: 1080, dsf: 2, label: '多数派' },
  { id: '2560', w: 2560, h: 1440, dsf: 1, label: '大画面' },
];
const THEMES = [
  { id: 'standard-dark', style: 'standard', mode: 'dark' },
  { id: 'standard-light', style: 'standard', mode: 'light' },
  { id: 'military-dark', style: 'military', mode: 'dark' },
  { id: 'military-light', style: 'military', mode: 'light' },
];
const VIEWS = ['lanes', 'sheet'];
const PARTIES = [8, 4];

/** @type {{id:string, vp:any, theme:any, view:string, party:number}[]} */
export const ALL_CONDS = [];
for (const vp of VPS) for (const theme of THEMES) for (const view of VIEWS) for (const party of PARTIES) {
  ALL_CONDS.push({ id: `${vp.id}-${theme.id}-${view}-${party}p`, vp, theme, view, party });
}
export const condById = (id) => ALL_CONDS.find((c) => c.id === id);

/** 動作の確認(クリック・ドラッグ等)を行う代表条件。どの項目をどの条件で取るかは README に表で書く。 */
export const BEH = {
  place: ['1489-standard-dark-lanes-8p', '1489-standard-dark-sheet-8p', '1489-military-dark-lanes-8p', '1489-military-dark-sheet-8p', '1920-standard-light-lanes-8p'],
  drag: ['1489-standard-dark-lanes-8p', '1489-standard-dark-sheet-8p', '1489-military-dark-lanes-8p'],
  memo: ['1489-standard-dark-lanes-8p', '1489-standard-dark-sheet-8p', '1489-military-dark-sheet-8p', '1920-standard-light-lanes-8p'],
  cursor: ['1489-standard-dark-lanes-8p', '1489-standard-dark-sheet-8p', '1920-standard-light-lanes-8p'],
  hover: ['1489-standard-dark-lanes-8p', '1489-standard-dark-sheet-8p', '1489-military-dark-lanes-8p', '1489-military-dark-sheet-8p', '1920-standard-light-lanes-8p'],
  select: ['1489-standard-dark-lanes-8p', '1489-military-dark-lanes-8p'],
  rows: ['1489-standard-dark-lanes-8p', '1489-military-dark-lanes-8p'],
  view: ['1489-standard-dark-lanes-8p', '1489-military-dark-lanes-8p'],
  misc: ['1489-standard-dark-lanes-8p', '1489-standard-dark-sheet-8p'],
  milspec: ['1489-military-dark-lanes-8p', '1489-military-dark-sheet-8p'],
};
export const MOBILE_THEMES = THEMES;
