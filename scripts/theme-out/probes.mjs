// @ts-check
/**
 * 「テーマ指定を部品から抜く」リファクタの見た目確認用 probe 一覧(データだけ)。
 * mount(HTML)を body に差し込み、target の selector に当たる最初の要素の計算後スタイル(props)を読む。
 * selector / mount は文字列、または { base, head } で両側別の名前にできる(head が無ければ base と同じ)。
 * テーマ: route '/miti' は THEMES の 4 列、'/housing' は .housing-workspace の data-theme の 2 列(mount 内の __THEME__)。
 */

/** 標準・MIL-SPEC の 4 テーマ(html に付けるクラス)。military は MIL-SPEC 状態で開いて測る */
export const THEMES = [['theme-light'], ['theme-dark'], ['theme-military', 'theme-dark'], ['theme-military', 'theme-light']];
export const HOUSING_THEMES = ['light', 'dark'];

const edge = (side) => ['color', 'width', 'style'].map((k) => `border-${side}-${k}`);
const BORDERS = ['top', 'right', 'bottom', 'left'].flatMap(edge);
const RADII = ['border-top-left-radius', 'border-top-right-radius', 'border-bottom-left-radius', 'border-bottom-right-radius'];
const BG = ['background-color', 'background-image', 'background-size', 'background-position'];
const BOX = ['display', 'position', 'z-index', 'opacity'];
const FX = ['box-shadow', 'filter', 'backdrop-filter', 'mix-blend-mode'];
const MASK = ['mask-image', 'mask-composite', 'mask-clip', 'mask-size'];

/** 空プランのガラス(Timeline.css 50〜115 行)。DOM は TimelineEmptyGlass.tsx + Layout.tsx の .no-plan */
const emptyGlass = {
  id: 'empty-plan-glass',
  route: '/miti',
  mount: '<div class="no-plan" style="position:relative;width:300px;height:200px"><div class="empty-plan-scrim"><div class="empty-glass-corner empty-glass-corner-tl"></div><div class="empty-glass-corner empty-glass-corner-tr"></div><div class="empty-glass-corner empty-glass-corner-bl"></div><div class="empty-glass-corner empty-glass-corner-br"></div><div class="empty-glass-sheen"></div></div></div>',
  targets: [
    { name: 'scrim', selector: '.empty-plan-scrim', props: [...BG, ...BOX, ...FX, ...BORDERS, ...RADII, 'overflow-x', 'pointer-events'] },
    { name: 'scrim', selector: '.empty-plan-scrim', pseudo: '::before', props: [...BG, ...MASK, ...BOX, 'padding-top', 'content'] },
    { name: 'scrim', selector: '.empty-plan-scrim', pseudo: '::after', props: [...BG, ...MASK, ...BOX, 'padding-top', 'content'] },
    ...['tl', 'tr', 'bl', 'br'].map((c) => ({ name: `corner-${c}`, selector: `.empty-glass-corner-${c}`, props: [...BG, ...BOX, 'width', 'height', 'pointer-events'] })),
    { name: 'sheen', selector: '.empty-glass-sheen', props: [...BG, ...BOX, 'height', 'pointer-events'] },
  ],
};

const planMemo = {
  id: 'plan-memo',
  route: '/miti',
  mount: '<div class="plan-memo" style="left:100px;top:50px">メモ</div>',
  targets: [{ name: 'memo', selector: '.plan-memo', props: ['color', 'text-shadow', 'opacity', 'font-size', 'font-weight', 'line-height', 'max-width', 'white-space', 'pointer-events', 'z-index', 'cursor', 'transform', 'position'] }],
};

const conflictChevron = {
  id: 'conflict-chevron',
  route: '/miti',
  mount: '<svg class="conflict-chevron" width="20" height="20" viewBox="0 0 20 20"><path d="M2 14 L10 4 L18 14" stroke="currentColor" fill="none"/></svg>',
  targets: [{ name: 'chevron', selector: '.conflict-chevron', props: ['filter', 'color', 'opacity'] }],
};

const sheetPreview = {
  id: 'miti-sheet-preview',
  route: '/miti',
  mount: '<div class="miti-table-wrap"><table class="miti-table"><thead><tr><th>P</th><th>T</th></tr></thead><tbody><tr><td>a</td><td>b</td></tr><tr><td>c</td><td>d</td></tr></tbody></table><div class="miti-spinner"></div></div>',
  targets: [
    { name: 'wrap', selector: '.miti-table-wrap', props: [...BG, ...BORDERS, ...RADII, 'overflow-x', 'overflow-y', 'flex-grow'] },
    { name: 'thead', selector: '.miti-table thead', props: [...BG, 'position', 'top', 'z-index'] },
    { name: 'td', selector: '.miti-table td', props: [...BORDERS, 'padding-top', 'padding-left', 'height', 'vertical-align', 'overflow-x', 'background-color'] },
    { name: 'td-last-row', selector: '.miti-table tr:last-child td', props: [...BORDERS] },
    { name: 'spinner', selector: '.miti-spinner', props: [...BORDERS, ...RADII, 'width', 'height', 'margin-top', 'animation-name', 'animation-duration', 'animation-timing-function', 'animation-iteration-count'] },
  ],
};

/** glass-tier3 / glass-frame(AppFooter・CollabJoinerPage の className 参照)。2026-10-29 に head 側は .frame-surface へ改名済み(base=改名前の版で測る) */
const glassTier3 = {
  id: 'glass-tier3',
  route: '/miti',
  mount: { base: '<div class="glass-tier3 glass-frame" style="width:200px;height:100px"></div>', head: '<div class="frame-surface glass-frame" style="width:200px;height:100px"></div>' },
  targets: [
    { name: 'tier3', selector: { base: '.glass-tier3', head: '.frame-surface' }, props: [...BG, ...BORDERS, ...FX, '--tw-backdrop-blur'] },
    { name: 'tier3', selector: { base: '.glass-tier3', head: '.frame-surface' }, pseudo: '::before', props: ['backdrop-filter', 'content'] },
    { name: 'tier3', selector: { base: '.glass-tier3', head: '.frame-surface' }, pseudo: '::after', props: ['backdrop-filter', 'content'] },
  ],
};

/** sheet.css 30〜80 行の .theme-military .milspec-app 規則。要素は .milspec-app の中に作る */
const sheetMilspec = {
  id: 'sheet-milspec',
  route: '/miti',
  mount: '<div class="milspec-app"><div data-time-row><div data-sheet-cols="3" data-member-id="m1" style="--sheet-col-w:28px;width:120px;height:20px"><div data-sheet-col><img alt="" width="14" height="14"></div></div></div><div data-sheet-member><div data-sheet-col>x</div><div data-sheet-col>y</div></div><div data-member-id="m2" data-sheet-cols="3"><span class="text-app-text">JOB</span></div><div data-sheet-cols="0"><div class="milspec-jack"></div></div><div data-sheet-cols="1"><div class="milspec-jack"></div></div><div data-mit-cd></div><div data-mit-cd-end></div></div>',
  targets: [
    { name: 'time-row-cols', selector: '[data-time-row] > [data-sheet-cols]', props: [...BG, 'box-shadow', 'background-repeat'] },
    { name: 'member-cols', selector: '[data-member-id="m2"][data-sheet-cols]', props: [...BG, 'box-shadow'] },
    { name: 'member', selector: '[data-sheet-member]', props: [...BG, 'border-right-color', 'border-right-width'] },
    { name: 'member-lastcol', selector: '[data-sheet-member] > [data-sheet-col]:last-child', props: ['border-right-color', 'border-right-width'] },
    { name: 'col', selector: '[data-sheet-member] > [data-sheet-col]:first-child', props: ['border-right-color', 'border-right-width', 'border-right-style'] },
    { name: 'col-img', selector: '[data-sheet-col] img', props: [...BORDERS, 'background-color', 'background-image', ...RADII, 'box-shadow'] },
    { name: 'job-text', selector: '[data-member-id="m2"] [class*="text-app-"]', props: ['color'] },
    { name: 'jack-0', selector: '[data-sheet-cols="0"] .milspec-jack', props: ['scale'] },
    { name: 'jack-1', selector: '[data-sheet-cols="1"] .milspec-jack', props: ['scale'] },
    { name: 'cd', selector: '[data-mit-cd]', props: ['background-color', 'clip-path'] },
    { name: 'cd-end', selector: '[data-mit-cd-end]', props: ['background-color', 'left', 'bottom', 'width', 'height'] },
  ],
};

/** ハウジング(route /housing)。.housing-workspace の data-theme を __THEME__ に置く */
const hw = (inner) => `<div class="housing-workspace" data-theme="__THEME__" style="position:relative;width:400px;height:300px">${inner}</div>`;
const housingScenery = {
  id: 'housing-scenery',
  route: '/housing',
  mount: hw('<div class="housing-scenery"></div>'),
  targets: [
    { name: 'scenery', selector: '.housing-scenery', props: [...BG, ...BOX, 'overflow-x', 'pointer-events'] },
    { name: 'scenery', selector: '.housing-scenery', pseudo: '::before', props: [...BG, ...BOX, 'mix-blend-mode', 'content'] },
    { name: 'scenery', selector: '.housing-scenery', pseudo: '::after', props: [...BG, ...BOX, 'mix-blend-mode', 'content'] },
  ],
};
const housingMap = {
  id: 'housing-map',
  route: '/housing',
  mount: hw('<div class="housing-floor-grid"></div><img class="housing-map-img" alt="">'),
  targets: [
    { name: 'floor-grid', selector: '.housing-floor-grid', props: [...BG, 'mask-image', ...BOX, 'top', 'left', 'pointer-events'] },
    { name: 'map-img', selector: '.housing-map-img', props: ['filter', 'mix-blend-mode', 'opacity', 'object-fit', 'width', 'height'] },
  ],
};

/** PartySettingsModal.css の @layer components 内の規則(後で層を外すかもしれない) */
const partyLayer = {
  id: 'party-settings-layer',
  route: '/miti',
  mount: '<button class="btn-tactile">x</button>',
  targets: [{ name: 'btn-tactile', selector: '.btn-tactile', props: ['transition-property', 'transition-duration', 'transition-timing-function', 'transform'] }],
};

export const PROBES = [emptyGlass, planMemo, conflictChevron, sheetPreview, glassTier3, sheetMilspec, housingScenery, housingMap, partyLayer];
