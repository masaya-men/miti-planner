// colocate.mjs --scope=military の設定。 MIL-SPEC の CSS(src/styles/military/ の移す待ち+部品の隣にある古い名前の 10 本)を
// 持ち主の部品の隣の <部品名>.css へ移す(docs/superpowers/specs/2026-10-28-military-css-colocation-design.md)。
// テーマの土台(palette・semantic-tokens・standard-revert・backdrop)は動かさない。 primitives は後読みの部品 1 つに決まる規則だけ動かす。
import fs from 'node:fs';
import path from 'node:path';
import { listTsx } from '../srcFiles.mjs';
import { compounds } from '../cssRules.mjs';

export const prefixRe = /^milspec-/;
export const componentsDir = 'src/components/military';
export const sharedDir = 'src/styles/military';
export const unusedDir = 'src/styles/military/unused';
export const entry = 'src/styles/military.css';

// class → 持ち主(自動判定が違う所だけ。 理由を 1 行で添える)
export const overrides = {
  // 光の経路の複製(fx/engine.ts が MilspecFxLayer の svg の中に足す)
  'milspec-pz-g': `${componentsDir}/fx/MilspecFxLayer.tsx`,
  'milspec-pz-c': `${componentsDir}/fx/MilspecFxLayer.tsx`,
  'milspec-tdot-f': `${componentsDir}/fx/MilspecFxLayer.tsx`,
  // 電源 off の暗幕(power/power.ts が body に足す)は区画の暗幕と同じ電源の見た目
  'milspec-blackout': `${componentsDir}/power/MilspecDim.tsx`,
  // 基板の絵(MilspecPlanCore・MilspecRail・MilspecVent・MilspecJackBoard の 4 部品が描く)=共通部品
  'milspec-pcb': 'shared:primitives',
  'milspec-cu': 'shared:primitives',
  // 読み上げ専用の隠し文字(AuxPanel・Nameplate・PartyOps の 3 部品)=共通部品
  'milspec-sr': 'shared:primitives',
};
// [規則全体のセレクタ(文字列は完全一致・正規表現は一致), 持ち主]
export const selectorOverrides = [
  // 計画の核の基板のピン等は、 直後の基板の共通規則(.milspec-pcb .pin 等)が同じ詳細度で上書きする。 上書きされる側を同じ共通部品の前に並べる
  [/^\.theme-military \.milspec-plan-core \.(pin|smd-end|ic)$/, 'shared:primitives'],
  // 装甲板の汚れ・傷(armor/svg.ts・armor/weather.ts が組み立てる svg の中の class)
  [/^\.theme-military \.(wx-[\w-]+|wash)$/, `${componentsDir}/MilspecArmor.tsx`],
  // パタパタ文字(header/flapText.ts が銘板の文字に付ける)
  [/^\.theme-military \.flap i/, `${componentsDir}/header/Nameplate.tsx`],
];
// class の無い規則の行き先をファイル単位で決める
export const fileFallback = {};

const ROLE = { 'palette.css': 'shared', 'semantic-tokens.css': 'shared', 'standard-revert.css': 'shared', 'backdrop.css': 'shared', 'primitives.css': 'frame' };

const readLf = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

function walk(dir, keep, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) {
      if (e.name !== '__tests__') walk(p, keep, out);
    } else if (keep(e.name)) out.push(p);
  }
  return out;
}

/** 部品の隣の CSS → それを import している .tsx/.ts(import './x.css' / './sub/x.css') */
function componentCssImporters() {
  const map = new Map();
  for (const file of walk(componentsDir, (n) => /\.tsx?$/.test(n))) {
    for (const m of readLf(file).matchAll(/^import '(\.{1,2}\/[^']+\.css)';$/gm)) {
      const css = path.posix.join(path.posix.dirname(file), m[1]);
      if (!map.has(css)) map.set(css, []);
      map.get(css).push(file);
    }
  }
  return map;
}

// 部品の隣にあった古い名前の CSS の、 移行前のビルド(後読みの MilspecLayout の CSS)での並び。 同じ行き先に集まった時にこの順で並べる
// (パス順だと notif → ftr → vent の勝ち負けが逆になる)。 milspecDeck.css は別の後読み(MilspecControlDeck)なので並びは決まっていない
const BUILD_ORDER = ['milspecH4.css', 'milspecCrt.css', 'milspecNotifBeacon.css', 'milspecTable.css', 'milspecFooter.css', 'milspecVent.css', 'milspecRail.css', 'milspecPower.css', 'milspecDeck.css', 'milspecJack.css'];

/**
 * 入口の @import 順の共有ファイル → 部品の隣の CSS(移行前のビルドでの並び)。 部品の隣の CSS は今は後読みなので、 起動時に読む共有より後ろに並べる
 * (同じ行き先に集まった時、 元の勝ち負け「military.css が先」を保つ)。 importers = その CSS を読んでいる部品(空になったら import を消す)。
 */
export function sources() {
  const files = [...readLf(entry).matchAll(/@import\s+"\.\/(military\/[^"]+)";/g)].map((m) => `src/styles/${m[1]}`).filter((f) => !f.includes('/unused/'));
  if (!files.some((f) => /\/pending-\d\.css$/.test(f))) throw new Error('移す待ち(src/styles/military/pending-*.css)が入口に無い=移行済み');
  const importers = componentCssImporters();
  const shared = files.map((file) => ({ file, css: readLf(file), role: ROLE[path.posix.basename(file)] ?? 'pending' }));
  const rank = (f) => {
    const i = BUILD_ORDER.indexOf(path.posix.basename(f));
    return i < 0 ? BUILD_ORDER.length : i;
  };
  const comp = walk(componentsDir, (n) => n.endsWith('.css'))
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
    .map((file) => ({ file, css: readLf(file), role: 'pending', importers: importers.get(file) ?? [] }));
  return [...shared, ...comp];
}

/** 持ち主の候補 = 入口から import でたどれる部品(静的+遅延) */
export const candidates = ({ staticFiles, dynamicFiles }) => new Set([...staticFiles, ...dynamicFiles]);
/** 候補にするファイル = src の .tsx + MIL-SPEC の .ts(class を .ts が組み立てるため) */
export const listCandidates = () => [...listTsx('src'), ...walk(componentsDir, (n) => n.endsWith('.ts') && !n.endsWith('.d.ts'))];

/** .ts / .tsx の相対 import の行き先(型だけの import も含める=見落としより拾いすぎの方が安全) */
function importsOf(file, text, exists) {
  const out = [];
  for (const m of text.matchAll(/(?:from\s*|import\s*\(?\s*)['"](\.{1,2}\/[^'"]+)['"]/g)) {
    const base = path.posix.join(path.posix.dirname(file), m[1]);
    const hit = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'].map((e) => base + e).find((p) => /\.tsx?$/.test(p) && exists(p));
    if (hit) out.push(hit);
  }
  return out;
}

/** a が b を描いている(a の import が b を指す) */
const renders = (texts, a, b) => new RegExp(`['"]\\.{1,2}/(?:[^'"]*/)?${path.posix.basename(b, '.tsx')}['"]`).test(texts.get(a) ?? '');

/**
 * MIL-SPEC の持ち主判定の追加(planColocation の引数)。
 *  staticFiles = 起動時に読まれるファイル / importersOf(ts) = その .ts を(.ts 経由も含め)import している .tsx / jsx = 候補 { file, text }
 */
/**
 * 標準の部品を描き変える規則の行き先の既定。 旧 standard-parts.css は 10-28 に standard-job-chip / -recast / -scrollbar / -table / -effects の 5 本に分けた。
 * 移行は済んでいて、 道具が自動で選ぶのは一番広い standard-table だけ。 recast・ジョブチップ等は、 道具で動かした後に人が合う 1 本へ移す。
 */
const STANDARD_DEST = 'shared:standard-table';

export function militaryPlanOptions({ staticFiles, importersOf, jsx, reaches = undefined }) {
  const texts = new Map(jsx.map((j) => [j.file, j.text]));
  const draws = reaches ?? ((a, b) => renders(texts, a, b));
  const tsxOf = (owner) => owner.split('>')[0];
  return {
    // .ts の class は、 その .ts を使う部品の中で一番外側(他の候補を描いている方)。 決まらなければ全員を候補に(点数で選ぶ)
    resolveHit: (file) => {
      if (file.endsWith('.tsx')) return [file];
      const users = importersOf(file);
      const outer = users.filter((a) => users.every((b) => a === b || draws(a, b)));
      return outer.length === 1 ? outer : users;
    },
    templatePrefixes: true,
    tieOwner: 'shared:primitives',
    classify: (owner) => {
      if (staticFiles.has(tsxOf(owner))) return 'shared:boot-parts';
      if (!tsxOf(owner).startsWith(`${componentsDir}/`)) return STANDARD_DEST;
      return owner;
    },
    keepInFrame: (owner) => !owner || owner.startsWith('shared:'),
    // 右端から見て最初に「名前のある」複合セレクタ(class・id・data 属性)が、 MIL-SPEC の外の部品だけが書く名前なら
    // 標準の部品を描き変える規則(例 .milspec-app [data-time-row] > *)。 MIL-SPEC の class か MIL-SPEC の部品が書く名前なら通常の判定
    ruleOwner: (sel) => {
      for (const c of [...compounds(sel)].reverse()) {
        const own = c.replace(/:not\([^()]*\)/g, '');
        if (classesIn(own).some((n) => prefixRe.test(n))) return null;
        let standard = false;
        for (const name of namesIn(own)) {
          const files = jsx.filter((j) => writes(j.text, name)).map((j) => j.file);
          const mil = files.some((f) => f.startsWith(`${componentsDir}/`));
          const std = files.some((f) => !f.startsWith(`${componentsDir}/`));
          if (mil && !std) return null;
          if (std && !mil) standard = true;
          // 両方が書く名前(flex 等の汎用 class)・どこも書かない名前は決め手にしない
        }
        if (standard) return STANDARD_DEST;
      }
      return null;
    },
  };
}

const classesIn = (compound) => [...compound.matchAll(/\.([\w-]+)/g)].map((m) => m[1]);
/** 複合セレクタの中の名前(class・id・属性名。 class/style/id の属性名は名前でないので除く) */
const namesIn = (compound) => [
  ...classesIn(compound).map((n) => ({ kind: 'class', n })),
  ...[...compound.matchAll(/#([\w-]+)/g)].map((m) => ({ kind: 'id', n: m[1] })),
  ...[...compound.matchAll(/\[([\w-]+)/g)].map((m) => ({ kind: 'attr', n: m[1] })).filter((a) => !['class', 'style', 'id'].includes(a.n)),
];
const esc = (n) => n.replace(/-/g, '\\-');
/**
 * その名前を「書いて」いるか(要素に付けている)。 セレクタ文字列で探しているだけ(.closest('[data-x]') 等)は数えない。
 *  class = 前が . # [ でない単語 / id = id="x"・id: 'x' / 属性 = x= ・値なしの JSX 属性・setAttribute('x'
 */
function writes(text, { kind, n }) {
  if (kind === 'class') return new RegExp(`(?<![\\w.#\\[-])${esc(n)}(?![\\w-])`).test(text);
  if (kind === 'id') return new RegExp(`\\bid\\s*[=:]\\s*\\{?\\s*['"\`]${esc(n)}['"\`]`).test(text);
  // x= / 値なしの JSX 属性(後ろが改行・> ・次の属性)/ setAttribute('x'
  return new RegExp(`(?<![\\w\\[-])${esc(n)}(?=\\s*=|\\s*/?>|[ \\t]*\\r?\\n|[ \\t]+[\\w{])|(?:set|toggle)Attribute\\(\\s*['"]${esc(n)}['"]`).test(text);
}

/** CLI から: 入口からの到達と候補の中身で militaryPlanOptions を作る */
export function planOptions(reach, jsx) {
  const exists = (f) => fs.existsSync(f) && fs.statSync(f).isFile();
  const users = new Map();
  for (const j of jsx) {
    for (const dep of importsOf(j.file, j.text, exists)) {
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
  // a が b を(他の部品・.ts を経由してでも)import している = a の画面の中に b が描かれうる
  const deps = new Map();
  for (const [dep, us] of users) for (const u of us) deps.set(u, [...(deps.get(u) ?? []), dep]);
  const reachCache = new Map();
  const reachOf = (a) => {
    if (!reachCache.has(a)) {
      const seen = new Set();
      const queue = [a];
      while (queue.length) for (const d of deps.get(queue.pop()) ?? []) if (!seen.has(d)) seen.add(d) && queue.push(d);
      reachCache.set(a, seen);
    }
    return reachCache.get(a);
  };
  return militaryPlanOptions({ staticFiles: reach.staticFiles, importersOf, jsx, reaches: (a, b) => reachOf(a).has(b) });
}

export const sharedHeader = {
  'boot-parts': '/* 起動時から読まれる MIL-SPEC 部品(src/main.tsx から静的 import で届く部品)の見た目。 部品の隣(後読み)に置くと共有との勝ち負けが逆転しうるため共有に置く。 */',
  primitives: '/* 3 つ以上の MIL-SPEC 部品が使う共通部品(装甲板・押下フィードバック等)。 */',
  unused: '/* JSX/TS に見つからない規則(v11 移植で使われなくなった等)。 消さずに集めてある。 確かめてから削除する別タスク。 */',
};
export const header = (name) => `/* ${name} の見た目(MIL-SPEC)。 他の部品の見た目は同じ詳細度で上書きしない。 */\n`;
/** 入口から 1 本を読む @import 行 */
export const importLine = (file) => `@import "./${file.replace('src/styles/', '')}";`;
/** 新しい共有は背景の直後(移す待ちより前)に読む。 位置の正しさは compare-build で確かめる */
export const addSharedImports = (text, lines) => text.replace(/(@import "\.\/military\/backdrop\.css";\n)/, `$1${lines.join('\n')}\n`);
