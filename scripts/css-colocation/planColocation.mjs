// CSS の規則を、 持ち主の部品(.tsx)の隣の <部品名>.css へ移す計画を立てる(対象に依らない部分)。
// 持ち主 = その規則が見た目を決める対象 class を JSX に書いている .tsx(判定の順は planColocation の説明)。
// 対象ごとの設定(フォルダ・接頭辞・overrides)は scopes/<名前>.mjs、 書き出しは colocate.mjs。
import path from 'node:path';
import postcss from 'postcss';
import { HOUSING_PREFIX, findOrderPairs, parseRules, splitSelectorList, subjectClasses } from './cssRules.mjs';
import { classGroups } from './classGroups.mjs';

/** 既定の対象 = ハウジング(テストと scopes/housing.mjs が使う) */
export const HOUSING_DIRS = { componentsDir: 'src/components/housing', sharedDir: 'src/styles/housing', unusedDir: 'src/styles/housing/unused' };

/** class の接頭辞を外した残りが 1 語(housing-register 等)= 汎用名 */
const isGenericName = (name, prefixRe) => !prefixRe.test(name) || !name.replace(prefixRe, '').includes('-');
/** 持ち主が「共有に残す」と決まった印(3 部品以上が使う class。 keepAt) */
const KEEP = 'keep';
/** セレクタの中の対象 class(. か # の後) */
const targetNames = (selector, mark, prefixRe) => [...selector.matchAll(new RegExp(`\\${mark}([\\w-]+)`, 'g'))].map((m) => m[1]).filter((c) => prefixRe.test(c));

/**
 * 持ち主の書き方 → 行き先。
 *  'shared:<名前>'        → <sharedDir>/<名前>.css(入口が読む共有)
 *  '<X.tsx>><Y.css>'      → X と同じフォルダの Y.css を X.tsx が読む(1 部品の見た目が 500 行を超える時の分け先)
 *  '<X.tsx>'              → X.css を X.tsx が読む
 */
export function destOfOwner(owner, sharedDir = HOUSING_DIRS.sharedDir) {
  if (owner.startsWith('shared:')) return { out: `${sharedDir}/${owner.slice(7)}.css` };
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
 * 共有ファイル(shared)は動かさない。 外枠ファイル(frame)は keepInFrame(持ち主) が真なら残す(既定 = shell/ の部品か持ち主なし)。
 * 対象を変える時は componentsDir / sharedDir / unusedDir / prefixRe を渡す(既定 = ハウジング)。
 * MIL-SPEC 用の追加(既定はどれも無効。 scopes/military.mjs の militaryPlanOptions が渡す):
 *  resolveHit(file)   → class を含むファイルを持ち主の部品に読み替える(.ts → それを import して描く .tsx)
 *  templatePrefixes   → `milspec-x-${…}` の接頭辞で始まる class も、 その文字列を含むファイルが使っている扱い
 *  tieOwner           → 3 つ以上の候補が同じ点数で割れた時の行き先(例 'shared:primitives')
 *  classify(owner)    → 決まった持ち主の読み替え(起動時の部品 → standard-table 等)。 overrides と shared: は読み替えない
 *  ruleOwner(sel)     → class より先にセレクタ全体で決まる持ち主(標準の部品を描き変える規則 → standard-table 等)。 null なら通常の判定
 * index.css 用の追加(scopes/index.mjs):
 *  keepAt             → class を書く部品がこの数以上なら動かさず元のファイルに残す(共通部品)。 既定は無効
 *  trimName           → false なら class が見つからない時に末尾の -xxx を削って探さない(対象を一覧で決める時は名前の切り詰めが意味を持たない)
 */
export function planColocation({
  sources,
  jsx,
  shared,
  frame,
  overrides,
  selectorOverrides = {},
  fileFallback = {},
  componentsDir = HOUSING_DIRS.componentsDir,
  sharedDir = HOUSING_DIRS.sharedDir,
  unusedDir = HOUSING_DIRS.unusedDir,
  prefixRe = HOUSING_PREFIX,
  keepInFrame = (owner) => !owner || owner.startsWith(`${componentsDir}/shell/`),
  resolveHit = (file) => [file],
  templatePrefixes = false,
  tieOwner = null,
  classify = (owner) => owner,
  ruleOwner = () => null,
  keepAt = Infinity,
  trimName = true,
}) {
  const isDev = (p) => p.startsWith(`${componentsDir}/dev/`);
  const prefixesOf = new Map(
    templatePrefixes ? jsx.map((j) => [j.file, [...j.text.matchAll(/([\w-]+-)\$\{/g)].map((m) => m[1]).filter((c) => prefixRe.test(c))]) : [],
  );
  const hitCache = new Map();
  const hitsOf = (cls) => {
    if (!hitCache.has(cls)) {
      const re = new RegExp(`${cls.replace(/-/g, '\\-')}(?![\\w-])`);
      let files = jsx.filter((j) => re.test(j.text)).map((j) => j.file);
      // .tsx が書いている class は .tsx だけを候補にする(.ts は class で要素を探すだけのことが多い=描いているのは .tsx)
      if (files.some((f) => f.endsWith('.tsx'))) files = files.filter((f) => f.endsWith('.tsx'));
      if (!files.length && templatePrefixes) files = jsx.filter((j) => prefixesOf.get(j.file).some((p) => cls.startsWith(p))).map((j) => j.file);
      let hits = [...new Set(files.flatMap(resolveHit))];
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
    for (const c of targetNames(u.rule.selector, '.', prefixRe)) fileClasses.get(u.src).add(c);
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
    while (!hits.length && trimName) {
      const cut = probe.replace(/(--|-)[a-z0-9]+$/, '');
      // 2 語の汎用名(housing-register 等)までは削らない。 ただし BEM の --修飾 を外した結果なら可
      const generic = isGenericName(cut, prefixRe);
      if (cut === probe || (generic && !probe.startsWith(`${cut}--`))) return null;
      probe = cut;
      if (overrides[probe]) return overrides[probe];
      hits = hitsOf(probe);
    }
    if (!hits.length) return null;
    if (hits.length >= keepAt) return KEEP;
    if (hits.length === 1) return hits[0];
    const mine = fileClasses.get(src) ?? new Set();
    const score = (f) => [...mine].filter((c) => hitsOf(c).includes(f)).length;
    const best = [...hits].sort((a, b) => score(b) - score(a) || a.localeCompare(b))[0];
    const tied = tieOwner && hits.filter((h) => score(h) === score(best)).length >= 3;
    ambiguous.set(probe, { cls: probe, candidates: hits, chosen: tied ? tieOwner : best });
    return tied ? tieOwner : best;
  };

  const ownerOfSelector = (sel, src) => {
    const byRule = ruleOwner(sel);
    if (byRule) return byRule;
    for (const c of subjectClasses(sel, prefixRe)) {
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
    if (u.rule?.kind !== 'rule' || u.owner || targetNames(u.rule.selector, '.', prefixRe).length) continue;
    for (const id of targetNames(u.rule.selector, '#', prefixRe)) {
      const hits = hitsOf(id);
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
    // @property は、 その変数を宣言か var() で使う規則の持ち主へ(keyframes は animation で名前を使う規則)
    const isProp = u.rule.name === 'property';
    const useRe = new RegExp(`${name.replace(/[-]/g, '\\-')}(?![\\w-])`);
    const uses = (v) =>
      v.rule?.kind === 'rule' && v.owner && v.owner !== KEEP &&
      v.node.nodes.some((d) => d.type === 'decl' && (isProp ? useRe.test(d.prop) || useRe.test(d.value) : /^(-webkit-)?animation(-name)?$/.test(d.prop) && re.test(d.value)));
    const user = units.find((v) => v.src === u.src && uses(v)) ?? units.find(uses);
    // overrides['@keyframes 名前'] = JSX/TS の文字列(Tailwind の animate-[名前_...])でだけ使う keyframes の持ち主
    u.owner = overrides[`@${u.rule.name} ${u.rule.params.trim()}`] ?? user?.owner ?? null;
    // 使う規則が無い(または使う規則が使われていない候補)の keyframes は、 ファイル単位の指定があればそこ・無ければ候補へ
    u.orphanKeyframes = !u.owner;
  }
  // 残り: 番号ファイルの主な持ち主
  const dominant = new Map();
  for (const src of sources) {
    const tally = new Map();
    for (const u of units) if (u.src === src.file && u.owner && u.owner !== KEEP) tally.set(u.owner, (tally.get(u.owner) ?? 0) + 1);
    const best = [...tally].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    dominant.set(src.file, best?.[0] ?? null);
  }
  const base = (f) => path.basename(f);
  const overrideValues = new Set([...Object.values(overrides), ...selOverrides.map(([, o]) => o)]);
  const classified = (o) => (!o || o.startsWith('shared:') || overrideValues.has(o) ? o : classify(o));
  for (const u of units) {
    if (u.owner === undefined || u.owner === null) {
      u.owner = null;
      u.fallback = true;
    }
    const b = base(u.src);
    if (shared.includes(b) || u.owner === KEEP) u.dest = { kept: u.src };
    else if (frame.includes(b) && keepInFrame(classified(u.owner))) u.dest = { kept: u.src };
    else {
      // class が JSX に見つからない規則は、 消さずに「使われていない候補」へ集める。
      // class の無い規則はファイル単位の指定(fileFallback)→ 番号ファイルの主な持ち主
      const owner = classified(u.owner ?? (u.classless ? (fileFallback[b] ?? dominant.get(u.src)) : u.orphanKeyframes ? (fileFallback[b] ?? null) : null));
      u.owner = owner;
      u.dest = owner ? destOfOwner(owner, sharedDir) : { out: `${unusedDir}/${b}` };
    }
  }
  // 末尾のコメントは直前の単位と同じ行き先
  units.forEach((u, i) => {
    if (u.trailing) u.dest = units[i - 1]?.src === u.src ? units[i - 1].dest : { kept: u.src };
  });

  const crossPairs = [];
  const sharedPairs = [];
  const destOf = new Map(units.filter((u) => u.rule).map((u) => [u.rule, u.dest]));
  for (const [a, b, prop] of findOrderPairs(units.filter((u) => u.rule).map((u) => u.rule), classGroups(jsx.map((j) => j.text), prefixRe), prefixRe)) {
    const da = destOf.get(a);
    const db = destOf.get(b);
    const ka = da.out ?? da.kept;
    const kb = db.out ?? db.kept;
    if (ka === kb) continue;
    // 部品同士の組だけを「またぐ順番頼り」とする。 共有フォルダ(下地・外枠・unused 等)が絡む組は並びをビルド比較で確かめる
    const isComponent = (k) => k.startsWith(`${componentsDir}/`);
    if (isComponent(ka) && isComponent(kb)) crossPairs.push([a, b, prop, ka, kb]);
    else sharedPairs.push([a, b, prop, ka, kb]);
  }

  return { units, outputs: render(units, (u) => u.dest.out), kept: render(units, (u) => u.dest.kept), ambiguous: [...ambiguous.values()], crossPairs, sharedPairs, dominant };
}

/** 行き先ごとに単位を元の並びで書き出す。 @media は元の条件で包み直し、 同じ条件が続けば 1 つにまとめる */
export function render(units, keyOf) {
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

/** import './<css>'; の行を消す(元の CSS が空になって消えた時) */
export function removeCssImport(source, cssName) {
  return source.split('\n').filter((l) => l.replace(/\r$/, '') !== `import './${cssName}';`).join('\n');
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
