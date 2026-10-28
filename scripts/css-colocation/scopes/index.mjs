// colocate.mjs --scope=index の設定。 index.css から切り出した移す待ち(src/styles/base/to-move-*.css)の規則を
// 持ち主の部品の隣の <部品名>.css へ移す(docs/superpowers/specs/2026-10-28-index-css-colocation-design.md)。
// 土台(tokens-*・global・glass・shared-parts)は動かさない。 対象は接頭辞でなく class の一覧(CLASSES)で決める。
import fs from 'node:fs';
import path from 'node:path';
import { listTsx } from '../srcFiles.mjs';

export const componentsDir = 'src/components';
export const sharedDir = 'src/styles/base';
export const unusedDir = 'src/styles/base/unused';
export const entry = 'src/index.css';

// 移す対象の class(設計書 §3 の 0〜2 部品の class)。 ここに無い class(glass-*・sidebar-item 等の共通部品)の規則は動かさない
export const CLASSES = [
  'progress-detail', 'progress-detail-inner', 'progress-detail-content',
  'animate-conflict-arrow-pulse', 'conflict-chevron',
  'lopo-capsule-path', 'lopo-scan-fill', 'lopo-scan-clip', 'lopo-scan-line',
  'empty-liquid-glass', 'empty-glass-corner', 'empty-glass-corner-tl', 'empty-glass-corner-tr', 'empty-glass-corner-bl', 'empty-glass-corner-br',
  'empty-glass-sheen', 'empty-glow-left', 'empty-glow-left-spread', 'empty-glow-bl-h', 'empty-glow-bl-v', 'empty-glow-bl-spread',
  'empty-burger-left-1', 'empty-burger-left-2', 'empty-burger-left-3', 'empty-burger-top-1', 'empty-burger-top-2', 'empty-burger-top-3',
  'empty-text-in', 'no-plan',
  'btn-tactile', 'animate-toast-in',
  'mobile-effect-bar-item', 'mobile-effect-bar-fill', 'mobile-effect-bar-icon', 'mobile-effect-bar-icon-slot',
  'mobile-miti-icons', 'mobile-row-dim-text', 'mobile-undo-redo-wrap',
  'phase-select-preview', 'label-select-preview', 'preview-highlight',
  'recast-cell', 'recast-tooltip-wrap', 'recast-icon', 'recast-num', 'recast-row',
  'system-notif-marquee', 'lopo-name-clip', 'lopo-name-text', 'collab-joiner-shell',
  'water-drop', 'glass-tier1',
];
export const prefixRe = new RegExp(`^(?:${CLASSES.map((c) => c.replace(/-/g, '\-')).join('|')})$`);

// class → 持ち主(自動判定が違う所だけ。 理由を 1 行で添える)
export const overrides = {
  // 本文に名前が出るだけで要素に付けていない部品(コメント)は持ち主にしない。 要素に付けているのは MobileTimelineRow だけ
  'mobile-miti-icons': `${componentsDir}/MobileTimelineRow.tsx`,
  'mobile-row-dim-text': `${componentsDir}/MobileTimelineRow.tsx`,
  // Tailwind の任意値のアニメーション class(角かっこで名前を書く形)でだけ使う keyframes は、 その class を書く部品へ。
  // (ここに class の文字をそのまま書くと Tailwind が scripts/ も読んで余計な規則を作るので書かない)
  '@keyframes floatingCountBounce': `${componentsDir}/sidebar/SidebarFloatingBar.tsx`,
  // @property は Tailwind の後処理を通る所に置くと、 未対応ブラウザ向けの初期値(@layer properties)も作られる。 部品の隣へ移すと消えるので共有に残す
  '@property --mobile-effect-bar-progress': 'shared:properties',
  // 兄弟の 2 部品(LocalDataSafetyBar・SystemNotificationBar)が使う流れる文字は、 2 つを並べて描く外側の部品へ(片方を消しても他方の見た目が残る)
  'system-notif-marquee': `${componentsDir}/sidebar/SidebarFooterBars.tsx`,
};
// [規則全体のセレクタ(文字列は完全一致・正規表現は一致), 持ち主]
export const selectorOverrides = [
  // 行ホバーの下線(PC 専用)。 [data-time-row] を付けるのは TimelineRow(PC)と MobileTimelineRow(モバイル)で、 この規則は min-width:768px だけ=PC の行
  [/^\[data-time-row\](:hover)?::after$/, `${componentsDir}/TimelineRow.tsx`],
  // 親コンテナの属性(data-myjob-highlight・data-record-mode)を立てるのは Timeline.tsx。 規則は子孫の行・帯を描き変えるが、 切り替えの持ち主に集める
  [/^\.timeline-scroll-container\[data-(myjob-highlight|record-mode)="1"\] /, `${componentsDir}/Timeline.tsx`],
  // 縦スクロールバーを消す対象 .timeline-scroll-container は Timeline.tsx が描く
  [/^\.timeline-scroll-container::-webkit-scrollbar:vertical$/, `${componentsDir}/Timeline.tsx`],
];
export const fileFallback = {};

const SOURCES = ['src/styles/base/to-move-1.css', 'src/styles/base/to-move-2.css'];
const readLf = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

/** 移す待ち(入口が読む to-move-*.css)だけを返す。 土台は返さない=動かさない */
export function sources() {
  const entryText = readLf(entry);
  const files = SOURCES.filter((f) => entryText.includes(`@import "./${f.replace('src/', '')}";`) && fs.existsSync(f));
  if (!files.length) throw new Error('移す待ち(src/styles/base/to-move-*.css)が入口に無い=移行済み');
  return files.map((file) => ({ file, css: readLf(file), role: 'pending' }));
}

// 持ち主にしない場所(housing・military は別の移行で済み。 dev ページ・テスト・lib は部品ではない)
const EXCLUDED = [/^src\/components\/(housing|military)\//, /^src\/dev\//, /^src\/lib\//, /(^|\/)__tests__\//, /\.(test|spec)\.tsx?$/];
const eligible = (f) => !EXCLUDED.some((re) => re.test(f));

function walkTs(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) {
      if (e.name !== '__tests__' && e.name !== 'node_modules') walkTs(p, out);
    } else if (/\.ts$/.test(e.name) && !e.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

/** 持ち主の候補 = 入口から import でたどれる部品(静的+遅延)から、 候補にしない場所を除く */
export const candidates = ({ staticFiles, dynamicFiles }) => new Set([...staticFiles, ...dynamicFiles].filter(eligible));
/** 候補にするファイル = src の .tsx + 部品フォルダの .ts(class を .ts が組み立てるため) */
export const listCandidates = () => [...listTsx('src'), ...walkTs(componentsDir)].filter(eligible);

/** a が b を描いている(a の import が b を指す) */
const renders = (texts, a, b) => new RegExp(`['"]\.{1,2}/(?:[^'"]*/)?${path.posix.basename(b).replace(/\.tsx?$/, '')}['"]`).test(texts.get(a) ?? '');

/** .ts / .tsx の相対 import の行き先 */
function importsOf(file, text, exists) {
  const out = [];
  for (const m of text.matchAll(/(?:from\s*|import\s*\(?\s*)['"](\.{1,2}\/[^'"]+)['"]/g)) {
    const base = path.posix.join(path.posix.dirname(file), m[1]);
    const hit = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'].map((e) => base + e).find((p) => /\.tsx?$/.test(p) && exists(p));
    if (hit) out.push(hit);
  }
  return out;
}

/**
 * 持ち主判定の追加(planColocation の引数)。 jsx = 候補 { file, text }
 *  .ts が組み立てる class は、 その .ts を(.ts 経由も含め)使う .tsx のうち一番外側(他を描いている方)。 決まらなければ全員を候補に(点数で選ぶ)
 *  3 部品以上が書く class は共有(元のファイル)に残す / 一覧にない名前は切り詰めて探さない
 */
export function indexPlanOptions({ jsx }) {
  const texts = new Map(jsx.map((j) => [j.file, j.text]));
  const known = new Set(texts.keys());
  const users = new Map();
  for (const j of jsx) {
    for (const dep of importsOf(j.file, j.text, (f) => known.has(f))) {
      if (!users.has(dep)) users.set(dep, new Set());
      users.get(dep).add(j.file);
    }
  }
  const importersOf = (ts) => {
    const found = new Set();
    const seen = new Set([ts]);
    const queue = [ts];
    while (queue.length) {
      for (const u of users.get(queue.pop()) ?? []) {
        if (seen.has(u)) continue;
        seen.add(u);
        if (u.endsWith('.tsx')) found.add(u);
        else queue.push(u);
      }
    }
    return [...found].sort();
  };
  return {
    resolveHit: (file) => {
      if (file.endsWith('.tsx')) return [file];
      const us = importersOf(file);
      const outer = us.filter((a) => us.every((b) => a === b || renders(texts, a, b)));
      return outer.length === 1 ? outer : us;
    },
    keepAt: 3,
    trimName: false,
  };
}

/** CLI から: 候補の中身で indexPlanOptions を作る */
export const planOptions = (_reach, jsx) => indexPlanOptions({ jsx });

export const sharedHeader = {
  unused: '/* JSX/TS に見つからない規則(使われなくなった等)。 消さずに集めてある。 確かめてから削除する別タスク。 */',
};
export const header = (name) => `/* ${name} の見た目。 他の部品の見た目は同じ詳細度で上書きしない。 */\n`;
/** 入口から 1 本を読む @import 行 */
export const importLine = (file) => `@import "./${file.replace('src/', '')}";`;
/** 新しい共有(unused)は共有の部品の直後(移す待ちより前)に読む。 位置の正しさは compare-build で確かめる */
export const addSharedImports = (text, lines) => text.replace(/(@import "\.\/styles\/base\/shared-parts\.css";\n)/, `$1${lines.join('\n')}\n`);
