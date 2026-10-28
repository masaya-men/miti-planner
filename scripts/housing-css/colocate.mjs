// ハウジングの番号ファイル(src/styles/housing/NN-*.css)の規則を、 持ち主の部品(.tsx)の隣の <部品名>.css へ移す道具。
// 持ち主 = その規則が見た目を決める housing class を JSX に書いている .tsx(判定の順は planColocation の説明)。
// 使い方: node scripts/housing-css/colocate.mjs --dry-run                 → .out/plan.md に移し先の一覧
//         node scripts/housing-css/colocate.mjs --write [--only=a,b]       → 書き出し+import 追加+番号ファイルから削除
//         (--only は src/components/housing 以下のフォルダ名。 "." は直下の部品)
import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';
import { fileURLToPath } from 'node:url';
import { findOrderPairs, parseRules, splitSelectorList, subjectClasses } from './cssRules.mjs';
import { reachable } from './reachable.mjs';
import { classGroups } from './classGroups.mjs';

const HOUSING = 'src/components/housing';
const isShell = (p) => p.startsWith(`${HOUSING}/shell/`);
const isDev = (p) => p.startsWith(`${HOUSING}/dev/`);
// JSX に見つからない規則は元のファイル名のまま unused/ へ(どこから来たか分かるように)
export const UNUSED_DIR = 'src/styles/housing/unused';
const SHARED_DIR = 'src/styles/housing';

/**
 * 持ち主の書き方 → 行き先。
 *  'shared:<名前>'        → src/styles/housing/<名前>.css(入口 housing.css が読む共有)
 *  '<X.tsx>><Y.css>'      → X と同じフォルダの Y.css を X.tsx が読む(1 部品の見た目が 500 行を超える時の分け先)
 *  '<X.tsx>'              → X.css を X.tsx が読む
 */
export function destOfOwner(owner) {
  if (owner.startsWith('shared:')) return { out: `${SHARED_DIR}/${owner.slice(7)}.css` };
  const [tsx, css] = owner.split('>');
  return { out: css ? `${path.posix.dirname(tsx)}/${css}` : tsx.replace(/\.tsx$/, '.css'), importer: tsx };
}

/**
 * 持ち主の決め方(この順):
 *  1. 対象 class の overrides
 *  2. その class を文字列で含む .tsx が 1 本 → それ(dev ページは他に候補があれば外す)
 *  3. 複数 → 同じ番号ファイルの class を最も多く含む .tsx(同数はパス順)。 ambiguous に記録
 *  4. 見つからない class → 末尾の -xxx / --xxx を削って一致する class の持ち主
 *  5. それでも無い → 「使われていない候補」(class の無い規則は fileFallback → 番号ファイルの主な持ち主)
 * 共有ファイル(shared)は動かさない。 外枠ファイル(frame)は持ち主が shell/ の部品か持ち主なしなら残す。
 */
export function planColocation({ sources, jsx, shared, frame, overrides, selectorOverrides = {}, fileFallback = {} }) {
  const hitCache = new Map();
  const hitsOf = (cls) => {
    if (!hitCache.has(cls)) {
      const re = new RegExp(`${cls.replace(/-/g, '\\-')}(?![\\w-])`);
      let hits = jsx.filter((j) => re.test(j.text)).map((j) => j.file);
      if (hits.length > 1 && hits.some((h) => !isDev(h))) hits = hits.filter((h) => !isDev(h));
      hitCache.set(cls, hits);
    }
    return hitCache.get(cls);
  };
  const ambiguous = new Map();

  // 規則と直前のコメントを「単位」にまとめる(keyframes の中身と規則の中のコメントは規則側に含まれる)
  const units = [];
  for (const src of sources) {
    const rules = parseRules(src.css, src.file);
    const root = rules.length ? rules[0].node.root() : postcss.parse(src.css);
    const byNode = new Map(rules.map((r) => [r.node, r]));
    let pending = [];
    root.walk((node) => {
      if (node.type === 'comment') {
        if (node.parent.type === 'root' || node.parent.type === 'atrule') pending.push(node);
        return;
      }
      const rule = byNode.get(node);
      if (!rule) return;
      units.push({ src: src.file, rule, node, comments: pending });
      pending = [];
    });
    if (pending.length) units.push({ src: src.file, rule: null, node: null, comments: pending, trailing: true });
  }

  // keyframes の名前の重複は止める(置き場所が分かれると勝ち負けが並び次第になる)
  const kfNames = new Map();
  for (const u of units) {
    if (u.rule?.kind === 'atrule' && /keyframes$/.test(u.rule.name)) {
      const key = `${u.rule.name} ${u.rule.params}`;
      if (kfNames.has(key)) throw new Error(`同名の @${key} が ${kfNames.get(key)} と ${u.src} にある`);
      kfNames.set(key, u.src);
    }
  }

  const fileClasses = new Map();
  for (const u of units) {
    if (u.rule?.kind !== 'rule') continue;
    if (!fileClasses.has(u.src)) fileClasses.set(u.src, new Set());
    for (const c of u.rule.selector.match(/\bhousing(?:er)?-[\w-]+/g) || []) fileClasses.get(u.src).add(c);
  }

  // 同じ class の持ち主は 1 つに固定する(最初に決まった持ち主を使う。 番号ファイルごとに変わると並びが割れる)
  const classOwner = new Map();
  const ownerOfClass = (cls, src) => {
    if (!classOwner.has(cls)) classOwner.set(cls, decideOwner(cls, src));
    return classOwner.get(cls);
  };
  const decideOwner = (cls, src) => {
    if (overrides[cls]) return overrides[cls];
    // X--修飾 は X と同じ要素に付くので、 X に持ち主があればそれに合わせる
    const bem = cls.replace(/--[\w-]*$/, '');
    if (bem !== cls) {
      const o = ownerOfClass(bem, src);
      if (o) return o;
    }
    let hits = hitsOf(cls);
    let probe = cls;
    while (!hits.length) {
      const cut = probe.replace(/(--|-)[a-z0-9]+$/, '');
      // 2 語の汎用名(housing-register 等)までは削らない。 ただし BEM の --修飾 を外した結果なら可
      const generic = /^housing(?:er)?(-[a-z0-9]+)?$/.test(cut);
      if (cut === probe || (generic && !probe.startsWith(`${cut}--`))) return null;
      probe = cut;
      if (overrides[probe]) return overrides[probe];
      hits = hitsOf(probe);
    }
    if (hits.length === 1) return hits[0];
    const mine = fileClasses.get(src) ?? new Set();
    const score = (f) => [...mine].filter((c) => hitsOf(c).includes(f)).length;
    const best = [...hits].sort((a, b) => score(b) - score(a) || a.localeCompare(b))[0];
    ambiguous.set(probe, { cls: probe, candidates: hits, chosen: best });
    return best;
  };

  const ownerOfSelector = (sel, src) => {
    for (const c of subjectClasses(sel)) {
      const o = ownerOfClass(c, src);
      if (o) return o;
    }
    return null;
  };

  // 1 周目: class から決まる持ち主。 セレクタごとに持ち主が違う規則は、 持ち主ごとの規則に分ける
  // (「A, B { 宣言 }」は「A { 宣言 } B { 宣言 }」と同じ意味。 分けた規則は元と同じ位置に並ぶ)
  const selOverrides = (Array.isArray(selectorOverrides) ? selectorOverrides : Object.entries(selectorOverrides));
  const overrideOf = (sel) => selOverrides.find(([pat]) => (pat instanceof RegExp ? pat.test(sel) : pat === sel))?.[1];
  const expanded = [];
  for (const u of units) {
    if (u.rule?.kind !== 'rule') {
      expanded.push(u);
      continue;
    }
    const whole = overrideOf(u.rule.selector);
    if (whole) {
      u.owner = whole;
      expanded.push(u);
      continue;
    }
    const sels = splitSelectorList(u.rule.selector);
    const owners = sels.map((s) => overrideOf(s) ?? ownerOfSelector(s, u.src));
    const first = owners.find(Boolean) ?? null;
    const groups = new Map();
    sels.forEach((s, i) => {
      const o = owners[i] ?? first;
      if (!groups.has(o)) groups.set(o, []);
      groups.get(o).push(s);
    });
    if (groups.size === 1) {
      u.owner = first;
      expanded.push(u);
      continue;
    }
    ambiguous.set(`selector:${u.rule.selector}`, { cls: u.rule.selector, candidates: [...groups.keys()], chosen: '(持ち主ごとに分割)' });
    let isFirst = true;
    for (const [o, list] of groups) {
      const node = u.node.clone({ selector: list.join(',\n') });
      // 元の位置の親(@media)を辿れるよう、 元の親に仮置きしてから外す
      u.node.parent.insertBefore(u.node, node);
      const rule = { ...u.rule, selector: list.join(', '), selectors: list, node };
      expanded.push({ src: u.src, rule, node, comments: isFirst ? u.comments : [], owner: o });
      isFirst = false;
    }
    u.node.remove();
  }
  units.length = 0;
  units.push(...expanded);
  // class の無い規則(:root・html[...]・#id 等): id が JSX にあればその持ち主
  for (const u of units) {
    if (u.rule?.kind !== 'rule' || u.owner || /\.housing(?:er)?-/.test(u.rule.selector)) continue;
    for (const id of u.rule.selector.match(/#(housing(?:er)?-[\w-]+)/g) || []) {
      const hits = hitsOf(id.slice(1));
      if (hits.length) {
        u.owner = hits[0];
        break;
      }
    }
    u.classless = !u.owner;
  }
  // keyframes: その名前を使う規則の持ち主(同じファイルを優先し、 無ければ全ファイル)
  for (const u of units) {
    if (u.rule?.kind !== 'atrule') continue;
    const name = u.rule.params.trim();
    const re = new RegExp(`(^|[\\s,])${name.replace(/[-]/g, '\\-')}([\\s,]|$)`);
    const uses = (v) => v.rule?.kind === 'rule' && v.owner && v.node.nodes.some((d) => d.type === 'decl' && /^(-webkit-)?animation(-name)?$/.test(d.prop) && re.test(d.value));
    const user = units.find((v) => v.src === u.src && uses(v)) ?? units.find(uses);
    u.owner = user?.owner ?? null;
    // 使う規則が無い(または使う規則が使われていない候補)の keyframes は、 ファイル単位の指定があればそこ・無ければ候補へ
    u.orphanKeyframes = !u.owner;
  }
  // 残り: 番号ファイルの主な持ち主
  const dominant = new Map();
  for (const src of sources) {
    const tally = new Map();
    for (const u of units) if (u.src === src.file && u.owner) tally.set(u.owner, (tally.get(u.owner) ?? 0) + 1);
    const best = [...tally].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    dominant.set(src.file, best?.[0] ?? null);
  }
  const base = (f) => path.basename(f);
  for (const u of units) {
    if (u.owner === undefined || u.owner === null) {
      u.owner = null;
      u.fallback = true;
    }
    const b = base(u.src);
    if (shared.includes(b)) u.dest = { kept: u.src };
    else if (frame.includes(b) && (!u.owner || isShell(u.owner))) u.dest = { kept: u.src };
    else {
      // class が JSX に見つからない規則は、 消さずに「使われていない候補」へ集める。
      // class の無い規則はファイル単位の指定(fileFallback)→ 番号ファイルの主な持ち主
      const owner = u.owner ?? (u.classless ? (fileFallback[b] ?? dominant.get(u.src)) : u.orphanKeyframes ? (fileFallback[b] ?? null) : null);
      u.owner = owner;
      u.dest = owner ? destOfOwner(owner) : { out: `${UNUSED_DIR}/${b}` };
    }
  }
  // 末尾のコメントは直前の単位と同じ行き先
  units.forEach((u, i) => {
    if (u.trailing) u.dest = units[i - 1]?.src === u.src ? units[i - 1].dest : { kept: u.src };
  });

  const crossPairs = [];
  const sharedPairs = [];
  const destOf = new Map(units.filter((u) => u.rule).map((u) => [u.rule, u.dest]));
  for (const [a, b, prop] of findOrderPairs(units.filter((u) => u.rule).map((u) => u.rule), classGroups(jsx.map((j) => j.text)))) {
    const da = destOf.get(a);
    const db = destOf.get(b);
    const ka = da.out ?? da.kept;
    const kb = db.out ?? db.kept;
    if (ka === kb) continue;
    // 部品同士の組だけを「またぐ順番頼り」とする。 共有フォルダ(下地・外枠・unused 等)が絡む組は並びをビルド比較で確かめる
    const isComponent = (k) => k.startsWith(`${HOUSING}/`);
    if (isComponent(ka) && isComponent(kb)) crossPairs.push([a, b, prop, ka, kb]);
    else sharedPairs.push([a, b, prop, ka, kb]);
  }

  return { units, outputs: render(units, (u) => u.dest.out), kept: render(units, (u) => u.dest.kept), ambiguous: [...ambiguous.values()], crossPairs, sharedPairs, dominant };
}

/** 行き先ごとに単位を元の並びで書き出す。 @media は元の条件で包み直し、 同じ条件が続けば 1 つにまとめる */
function render(units, keyOf) {
  const roots = new Map();
  for (const u of units) {
    const key = keyOf(u);
    if (!key) continue;
    if (!roots.has(key)) roots.set(key, postcss.root());
    const root = roots.get(key);
    const chain = [];
    for (let p = (u.node ?? u.comments[0])?.parent; p && p.type !== 'root'; p = p.parent) chain.unshift(p);
    let container = root;
    for (const at of chain) {
      const last = container.last;
      if (last && last.type === 'atrule' && last.name === at.name && last.params === at.params) container = last;
      else {
        const fresh = at.clone({ nodes: [] });
        container.append(fresh);
        container = fresh;
      }
    }
    for (const c of u.comments) container.append(c.clone());
    if (u.node) container.append(u.node.clone());
  }
  const out = new Map();
  for (const [k, root] of roots) {
    root.each((n, i) => {
      if (i === 0) n.raws.before = '';
      else if (!/\n/.test(n.raws.before ?? '')) n.raws.before = '\n\n';
    });
    out.set(k, `${root.toString().trim()}\n`);
  }
  return out;
}

/** 最後の import 文の後ろに import './<css>'; を足す(既にあれば何もしない) */
export function addCssImport(source, cssName) {
  const line = `import './${cssName}';`;
  if (source.includes(line)) return source;
  const lines = source.split('\n');
  let lastEnd = -1;
  let inImport = false;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i];
    if (!inImport && /^import\s/.test(t)) {
      if (/;\s*$/.test(t)) lastEnd = i;
      else inImport = true;
    } else if (inImport && /;\s*$/.test(t)) {
      inImport = false;
      lastEnd = i;
    } else if (!inImport && lastEnd >= 0 && t.trim() && !/^\/\//.test(t.trim()) && !/^import\s/.test(t)) break;
  }
  lines.splice(lastEnd + 1, 0, line);
  return lines.join('\n');
}

// ---- CLI ----
const H = HOUSING;
const OVERRIDES = {
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
const SELECTOR_OVERRIDES = [
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
const FILE_FALLBACK = {
  '54-theme-reveal.css': 'shared:theme-reveal', // 昼夜切替の画面全体の動き(部品でなくページ全体)
};
const SHARED_HEADER = {
  'theme-reveal': '/* ハウジングの昼夜切替で画面全体を塗り替える動き(View Transition)。 */',
  primitives: '/* ハウジングの下地: 3 つ以上の機能で使うボタン・入力欄・項目・スピナー・窓の背景・出現の動き・フォーカス枠。 */',
  'page-frame': '/* ハウジングの全画面ページ(詳細・編集・ハウジンガー・短縮リンク)に共通の外枠。 */',
  'ward-map': '/* ハウジングの地図の土台(ツアー案内・区画地図・開発用の作図ページが共有)。 */',
  unused: '/* JSX に見つからない規則(部品が消えた等)。 消さずに集めてある。 確かめてから削除する別タスク。 */',
};
const SHARED = ['00-tokens.css', '68-scale-pc.css', '69-scale-svg-icons.css', '70-center-tokens.css'];
const FRAME = ['01-shell-frame.css', '27-rebuild-shell.css'];
const HEADER = (name) => `/* ${name} の見た目(ハウジング)。 他の部品の見た目は同じ詳細度で上書きしない。 */\n`;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) {
      if (e.name !== '__tests__' && e.name !== 'node_modules') walk(p, out);
    } else if (e.name.endsWith('.tsx')) out.push(p);
  }
  return out;
}

function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const only = args.find((a) => a.startsWith('--only='))?.slice(7).split(',');
  // 作業コピーが CRLF でも LF にそろえる(下の @import 行の置き換えが改行 LF 前提のため)
  const entry = fs.readFileSync('src/styles/housing.css', 'utf8').replace(/\r\n/g, '\n');
  const files = [...entry.matchAll(/@import\s+"\.\/(housing\/[^"]+)";/g)].map((m) => `src/styles/${m[1]}`);
  // 2026-10-28 に移行済み(番号ファイルは残っていない)。 移行後の共有ファイルを誤って動かさないよう止める
  if (!files.some((f) => /^src\/styles\/housing\/\d\d-[^/]+\.css$/.test(f))) {
    throw new Error('番号ファイル(src/styles/housing/NN-*.css)が入口に無い=移行済み。 他の CSS に使う時は SHARED/FRAME/OVERRIDES を作り直す');
  }
  const sources = files.map((file) => ({ file, css: fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') }));
  // 持ち主の候補は、 入口(src/main.tsx)から import でたどれる部品だけ(読まれない部品の隣の CSS は画面に届かない)
  const { staticFiles } = reachable('src/main.tsx', (f) => fs.readFileSync(f, 'utf8'), (f) => fs.existsSync(f) && fs.statSync(f).isFile());
  const jsx = walk('src').filter((file) => staticFiles.has(file)).map((file) => ({ file, text: fs.readFileSync(file, 'utf8') }));
  const p = planColocation({ sources, jsx, shared: SHARED, frame: FRAME, overrides: OVERRIDES, selectorOverrides: SELECTOR_OVERRIDES, fileFallback: FILE_FALLBACK });

  const inScope = (out) => {
    if (!only) return true;
    const rel = out.startsWith(`${SHARED_DIR}/`) ? '_shared' : path.posix.dirname(out).slice(HOUSING.length + 1) || '.';
    return only.some((o) => (o === '.' ? rel === '.' : rel === o || rel.startsWith(`${o}/`)));
  };

  // 一覧
  const lines = ['# 移し先の一覧(colocate.mjs --dry-run)', ''];
  for (const s of sources) {
    const tally = new Map();
    for (const u of p.units) if (u.src === s.file && u.rule) {
      const k = u.dest.out ?? '(残す)';
      tally.set(k, (tally.get(k) ?? 0) + 1);
    }
    lines.push(`- ${path.basename(s.file)} → ${[...tally].map(([k, n]) => `${k.replace(`${HOUSING}/`, '')}(${n})`).join(' / ')}`);
  }
  lines.push('', `## 出力 ${p.outputs.size} 本(500 行超は ⚠)`);
  for (const [k, css] of [...p.outputs].sort()) {
    const n = css.split('\n').length + 1;
    lines.push(`- ${n > 500 ? '⚠ ' : ''}${k.replace(`${HOUSING}/`, '')} ${n} 行`);
  }
  lines.push('', `## 部品をまたぐ順番頼り ${p.crossPairs.length}`);
  for (const [a, b, prop, ka, kb] of p.crossPairs) lines.push(`- [${prop}] ${a.media ? `@media ${a.media} ` : ''}${a.selector} (${ka.replace(`${HOUSING}/`, '')})  →  ${b.selector} (${kb.replace(`${HOUSING}/`, '')})`);
  lines.push('', `## 共有と部品の順番頼り ${p.sharedPairs.length}(ビルドの前後比較で確認)`);
  for (const [a, b, prop, ka, kb] of p.sharedPairs) lines.push(`- [${prop}] ${a.selector} (${ka.replace(`${HOUSING}/`, '')})  →  ${b.selector} (${kb.replace(`${HOUSING}/`, '')})`);
  lines.push('', `## 持ち主が割れた class ${p.ambiguous.length}`);
  for (const a of p.ambiguous) lines.push(`- ${a.cls} → ${a.chosen.replace(`${HOUSING}/`, '')}  (候補: ${a.candidates.map((c) => c.replace(`${HOUSING}/`, '')).join(', ')})`);
  lines.push('', '## JSX に見つからず番号ファイルの主な持ち主へ寄せた規則');
  for (const u of p.units) if (u.fallback && u.rule && u.dest.out) lines.push(`- ${path.basename(u.src)}: ${u.rule.kind === 'rule' ? u.rule.selector : `@${u.rule.name} ${u.rule.params}`} → ${u.dest.out.replace(`${HOUSING}/`, '')}`);
  const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '.out');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'plan.md'), `${lines.join('\n')}\n`);
  console.log(`出力 ${p.outputs.size} 本 / またぐ順番頼り ${p.crossPairs.length} / 共有との順番頼り ${p.sharedPairs.length} / 割れ ${p.ambiguous.length} → scripts/housing-css/.out/plan.md`);
  if (!write) return;
  if (p.crossPairs.length) throw new Error('部品をまたぐ順番頼りが残っている(overrides で解消してから --write)');

  // 書き出し: 対象の単位だけ移し、 番号ファイルからは消す
  const moving = p.units.filter((u) => u.dest.out && inScope(u.dest.out));
  const importerOf = new Map(moving.map((u) => [u.dest.out, u.dest.importer]));
  const outputs = render(p.units, (u) => (u.dest.out && inScope(u.dest.out) ? u.dest.out : null));
  let entryText = entry;
  const sharedImports = [];
  for (const [out, css] of outputs) {
    const name = path.basename(out, '.css');
    if (fs.existsSync(out)) throw new Error(`${out} が既にある(部品の隣の CSS への追記はこの道具ではしない)`);
    if (out.startsWith(`${SHARED_DIR}/`)) {
      const isUnused = out.startsWith(`${UNUSED_DIR}/`);
      const head = isUnused ? SHARED_HEADER.unused : (SHARED_HEADER[name] ?? `/* ハウジングの共有: ${name} */`);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, `${head}\n${css}`);
      sharedImports.push(`@import "./housing/${isUnused ? 'unused/' : ''}${name}.css";`);
      continue;
    }
    fs.writeFileSync(out, HEADER(name) + css);
    const tsx = importerOf.get(out);
    fs.writeFileSync(tsx, addCssImport(fs.readFileSync(tsx, 'utf8'), `${name}.css`));
  }
  // 新しい共有は外枠の直後に読む(部品より前)。 位置の正しさは compare-build で確かめる
  if (sharedImports.length) entryText = entryText.replace(/(@import "\.\/housing\/01-shell-frame\.css";\n)/, `$1${sharedImports.join('\n')}\n`);
  const remaining = render(p.units, (u) => (u.dest.out && inScope(u.dest.out) ? null : u.src));
  const touched = new Set(moving.map((u) => u.src));
  for (const s of sources) {
    if (!touched.has(s.file)) continue;
    const css = remaining.get(s.file);
    if (css) fs.writeFileSync(s.file, css);
    else {
      fs.rmSync(s.file);
      entryText = entryText.replace(`@import "./housing/${path.basename(s.file)}";\n`, '');
    }
  }
  fs.writeFileSync('src/styles/housing.css', entryText);
  console.log(`書き出し ${outputs.size} 本(${moving.length} 単位)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
