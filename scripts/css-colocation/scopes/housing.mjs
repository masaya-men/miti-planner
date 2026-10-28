// colocate.mjs --scope=housing の設定。 ハウジングの番号ファイル(src/styles/housing/NN-*.css)の規則を部品の隣へ移した時のもの。
// 2026-10-28 に移行済み(番号ファイルは残っていない)。 sources() は移行後の共有ファイルを誤って動かさないよう止まる。
import fs from 'node:fs';
import { HOUSING_PREFIX } from '../cssRules.mjs';
import { HOUSING_DIRS } from '../planColocation.mjs';

const H = HOUSING_DIRS.componentsDir;
export const overrides = {
  // class → 持ち主(自動判定が違う所だけ。 理由を 1 行で添える)
  // 下地 = 3 つ以上の機能で使うボタン・入力欄・項目・スピナー・窓の背景・出現の動き
  ...Object.fromEntries(
    [
      'housing-btn-primary', 'housing-btn-danger', 'housing-action-btn', 'housing-input', 'housing-label',
      'housing-field', 'housing-field-full', 'housing-field-error', 'housing-error-text', 'housing-error-block',
      'housing-address-note', 'housing-spinner', 'housing-fetch-indicator', 'housing-modal-backdrop',
      'housing-reveal', 'housing-reveal-kids', 'housing-empty-hint',
    ].map((c) => [c, 'shared:primitives']),
  ),
  // 全画面ページ(詳細・編集・ハウジンガー・短縮リンク)の共通の外枠
  ...Object.fromEntries(
    ['housing-detail-panel', 'housing-detail-shell', 'housing-detail-fullpage-header', 'housing-detail-back', 'housing-detail-fullpage-main'].map((c) => [c, 'shared:page-frame']),
  ),
  // 地図の土台(ツアー案内・区画地図・開発用の作図ページが共有)
  ...Object.fromEntries(['housing-map-svg-host', 'housing-floor-grid', 'housing-map-img', 'housing-map-overlay', 'housing-hud'].map((c) => [c, 'shared:ward-map'])),
  'housing-shell': `${H}/shell/HousingShell.tsx`, // 自動では引っ張って更新の部品になる
  'housing-tour-tray-start': `${H}/browse/TourTray.tsx`, // トレイの開始ボタン(計画・再計画は流用)
  'housing-listing-grid-toolbar': `${H}/browse/ListingGrid.tsx`, // 一覧の上の道具列(各ページは流用)
  'housing-register-section': `${H}/pages/RegisterPage.tsx`, // 登録の各節の共通の見出しと枠
  'housing-register-section-title': `${H}/pages/RegisterPage.tsx`,
  'housing-card-add-btn': `${H}/browse/ListingCard.tsx`, // カードの「ツアーに追加」。 詳細の操作列は同じ詳細度で上書きするのでここに並べる
  // 確定ボタン(今は読まれない部品だけが描く)は、 項目の札と一緒に書かれた規則と並びを保つため住所の節へ
  'housing-confirm-button': `${H}/register/RegisterSectionAddress.tsx`,
  // 以下は「別の部品が同じ要素の見た目を同じ詳細度で上書きする」規則。 上書きされる側の部品のファイルへ寄せて並びを保つ
  'housing-skel': 'shared:primitives', // 骨組み表示の土台(各骨組み部品・ハウジンガーのボタンの骨組みが上書き)
  'housing-conditional-field': 'shared:primitives', // 条件で出る項目(項目の下地の変形)
  'housinger-page-login-shell': 'shared:page-frame', // 未ログイン時のマイページ(外枠の変形)
  'housinger-page-login-main': 'shared:page-frame',
  'housing-mobile-settings-legal': `${H}/workspace/StatusBar.tsx`, // 設定シートでの状態欄の並べ方
  'housinger-page-kebab-trigger': `${H}/listing/HousingDetailKebab.tsx`, // ハウジンガーページの「…」の大きさ
  'housing-register-col-left': `${H}/pages/RegisterPage.tsx`, // 登録の左右の列
  'housing-register-col-right': `${H}/pages/RegisterPage.tsx`,
  'housing-listing-card-admin-hidden': `${H}/browse/ListingCard.tsx`, // 管理者向けの非公開カード
  'housing-empty-result': `${H}/workspace/EmptyResult.tsx`, // 地図の表示は流用
  'housing-panel-head': `${H}/HousingPanelModal.tsx`, // パネルの見出し一式は窓の部品
  'housing-panel-meta': `${H}/HousingPanelModal.tsx`,
  'housing-kebab-trigger': `${H}/listing/HousingDetailKebab.tsx`, // 「…」メニュー一式をまとめる
  'housing-listing-grid-heading': `${H}/browse/ListingGrid.tsx`, // 一覧の見出し(お気に入りは流用)
  'housing-listing-grid-count': `${H}/browse/ListingGrid.tsx`,
  'housing-center-error': `${H}/pages/BrowsePage.tsx`,
  'housing-tour-plan': `${H}/tour/TourPlanningView.tsx`, // 再計画は流用
  'housing-tour-invite': `${H}/tour/TourInvitePanel.tsx`,
  ...Object.fromEntries(
    ['housing-tour-complete-title', 'housing-tour-complete-lead', 'housing-tour-complete-actions', 'housing-tour-complete-btn', 'housing-tour-complete-overlay', 'housing-tour-complete-card'].map((c) => [c, `${H}/tour/TourCompleteOverlay.tsx`]),
  ),
  // ツアーのページの枠(案内・参加・計画・再計画が流用)
  ...Object.fromEntries(['housing-tour-page', 'housing-tour-page-panel', 'housing-tour-page-panel-solo', 'housing-tour-page-col'].map((c) => [c, `${H}/pages/TourNavPage.tsx`])),
};
// [規則全体のセレクタ(文字列は完全一致・正規表現は一致), 持ち主]。 規則を分けずに丸ごと行き先を決める
export const selectorOverrides = [
  // 多くの部品のフォーカス枠をまとめた 1 規則 → 下地
  [/^\.housing-card-fav:focus-visible, \.housing-card-add-btn:focus-visible,/, 'shared:primitives'],
  // 浮かぶカード・メニュー 4 種の共通の面(枠・影)→ 下地
  [/^\.housing-tour-expose-card, \.housing-notif-dropdown, \.housing-card-visibility-menu, \.housing-bottomnav-account-menu/, 'shared:primitives'],
  // 引っ張って更新の戻りの動き(殻と表示の両方に付く class)は更新部品の見た目
  [/housing-ptr-snap/, `${H}/shell/HousingPullToRefresh.tsx`],
  // 出現の動きの「待機」状態(属性だけの規則)
  ['[data-reveal="hold"]', 'shared:primitives'],
];
// class の無い規則(:root・html[...] 等)の行き先をファイル単位で決める
export const fileFallback = {
  '54-theme-reveal.css': 'shared:theme-reveal', // 昼夜切替の画面全体の動き(部品でなくページ全体)
};
export const sharedHeader = {
  'theme-reveal': '/* ハウジングの昼夜切替で画面全体を塗り替える動き(View Transition)。 */',
  primitives: '/* ハウジングの下地: 3 つ以上の機能で使うボタン・入力欄・項目・スピナー・窓の背景・出現の動き・フォーカス枠。 */',
  'page-frame': '/* ハウジングの全画面ページ(詳細・編集・ハウジンガー・短縮リンク)に共通の外枠。 */',
  'ward-map': '/* ハウジングの地図の土台(ツアー案内・区画地図・開発用の作図ページが共有)。 */',
  unused: '/* JSX に見つからない規則(部品が消えた等)。 消さずに集めてある。 確かめてから削除する別タスク。 */',
};
const SHARED = ['00-tokens.css', '68-scale-pc.css', '69-scale-svg-icons.css', '70-center-tokens.css'];
const FRAME = ['01-shell-frame.css', '27-rebuild-shell.css'];
export const header = (name) => `/* ${name} の見た目(ハウジング)。 他の部品の見た目は同じ詳細度で上書きしない。 */\n`;

export const prefixRe = HOUSING_PREFIX;
export const { componentsDir, sharedDir, unusedDir } = HOUSING_DIRS;
export const entry = 'src/styles/housing.css';

/** 入口の @import 順の番号ファイル。 role = shared(動かさない)/ frame(shell の部品と持ち主なしは残す)/ pending(全部動かす) */
export function sources() {
  // 作業コピーが CRLF でも LF にそろえる(入口の @import 行の置き換えが改行 LF 前提のため)
  const text = fs.readFileSync(entry, 'utf8').replace(/\r\n/g, '\n');
  const files = [...text.matchAll(/@import\s+"\.\/(housing\/[^"]+)";/g)].map((m) => `src/styles/${m[1]}`);
  if (!files.some((f) => /^src\/styles\/housing\/\d\d-[^/]+\.css$/.test(f))) {
    throw new Error('番号ファイル(src/styles/housing/NN-*.css)が入口に無い=移行済み。 他の CSS に使う時は SHARED/FRAME/overrides を作り直す');
  }
  const base = (f) => f.split('/').pop();
  return files.map((file) => ({
    file,
    css: fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n'),
    role: SHARED.includes(base(file)) ? 'shared' : FRAME.includes(base(file)) ? 'frame' : 'pending',
  }));
}

/** 持ち主の候補 = 入口(src/main.tsx)から静的 import でたどれる .tsx(読まれない部品の隣の CSS は画面に届かない) */
export const candidates = ({ staticFiles }) => staticFiles;
/** 入口から 1 本を読む @import 行 */
export const importLine = (file) => `@import "./${file.replace('src/styles/', '')}";`;
/** 新しい共有は外枠の直後に読む(部品より前)。 位置の正しさは compare-build で確かめる */
export const addSharedImports = (text, lines) => text.replace(/(@import "\.\/housing\/01-shell-frame\.css";\n)/, `$1${lines.join('\n')}\n`);
