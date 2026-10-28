// CSS を「規則の並び」として読む共通部品。 CSS を部品の隣へ移す道具(ハウジング・MIL-SPEC)と、 その前後比較・見張りテストが使う。
// 「順番頼りの組」= 同時に効きうる @media・同じ詳細度・対象 class が共通・同じ性質を宣言する 2 規則(後に書いた方が勝つので並びが結果を決める)。
import postcss from 'postcss';

/** 括弧と引用符の外にある sep の位置で切る */
function splitTop(text, isSep) {
  const parts = [];
  let depth = 0;
  let quote = null;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    else if (depth === 0) {
      const len = isSep(text, i);
      if (len) {
        parts.push(text.slice(start, i));
        start = i + len;
        i += len - 1;
      }
    }
  }
  parts.push(text.slice(start));
  return parts;
}

export const splitSelectorList = (sel) => splitTop(sel, (t, i) => (t[i] === ',' ? 1 : 0)).map((s) => s.trim()).filter(Boolean);

/** 結合子(空白 > + ~)で複合セレクタに分ける */
export function compounds(sel) {
  const norm = sel.replace(/\s*([>+~])\s*/g, ' ').trim();
  return splitTop(norm, (t, i) => (/\s/.test(t[i]) ? 1 : 0)).filter(Boolean);
}

/** 複合セレクタを「(中身) を持つ疑似関数」と残りに分ける */
function stripPseudoFns(compound) {
  const fns = [];
  let rest = '';
  let i = 0;
  while (i < compound.length) {
    const m = /^::?([a-zA-Z-]+)\(/.exec(compound.slice(i));
    if (m) {
      let depth = 1;
      let j = i + m[0].length;
      for (; j < compound.length && depth; j++) {
        if (compound[j] === '(') depth++;
        else if (compound[j] === ')') depth--;
      }
      fns.push({ name: m[1].toLowerCase(), args: compound.slice(i + m[0].length, j - 1) });
      i = j;
      continue;
    }
    if (compound[i] === '[') {
      const end = compound.indexOf(']', i);
      rest += '[]';
      i = end < 0 ? compound.length : end + 1;
      continue;
    }
    rest += compound[i];
    i++;
  }
  return { fns, rest };
}

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const cmp = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/** 詳細度 [id, class・属性・疑似クラス, 要素・疑似要素] */
export function specificity(selector) {
  let total = [0, 0, 0];
  for (const c of compounds(selector)) {
    const { fns, rest: raw } = stripPseudoFns(c);
    for (const fn of fns) {
      if (fn.name === 'where') continue;
      if (fn.name === 'is' || fn.name === 'not' || fn.name === 'has' || fn.name === 'matches') {
        const best = splitSelectorList(fn.args).map(specificity).sort(cmp).pop() ?? [0, 0, 0];
        total = add(total, best);
      } else if (['before', 'after', 'first-line', 'first-letter', 'slotted', 'part'].includes(fn.name)) {
        total = add(total, [0, 0, 1]);
      } else total = add(total, [0, 1, 0]); // :nth-child() など
    }
    // 古い書き方の :before / :after 等(Tailwind の後処理を通った CSS はこちら)も擬似要素として数える
    const rest = raw.replace(/(^|[^:]):(before|after|first-line|first-letter)(?![\w-])/g, '$1::$2');
    const ids = (rest.match(/#[\w-]+/g) || []).length;
    const cls = (rest.match(/\.[\w-]+/g) || []).length + (rest.match(/\[\]/g) || []).length;
    const pseudoEls = (rest.match(/::[\w-]+/g) || []).length;
    const pseudoCls = (rest.replace(/::[\w-]+/g, '').match(/:[\w-]+/g) || []).length;
    const el = /^[a-zA-Z][\w-]*/.test(rest) ? 1 : 0;
    total = add(total, [ids, cls + pseudoCls, el + pseudoEls]);
  }
  return total;
}

/** 対象の class の接頭辞(既定はハウジング)。 MIL-SPEC などは scopes/<名前>.mjs の prefixRe を渡す */
export const HOUSING_PREFIX = /^housing(?:er)?-/;

const classesOf = (text, prefixRe) => (stripPseudoFns(text).rest.match(/\.[\w-]+/g) || []).map((s) => s.slice(1)).filter((c) => prefixRe.test(c));

/** 規則が見た目を決める相手の対象 class(右端の複合セレクタ。 無ければ全体で最後の 1 つ) */
export function subjectClasses(selector, prefixRe = HOUSING_PREFIX) {
  const cs = compounds(selector);
  const last = classesOf(cs[cs.length - 1] ?? '', prefixRe);
  if (last.length) return [...new Set(last)];
  const all = cs.flatMap((c) => classesOf(c, prefixRe));
  return all.length ? [all[all.length - 1]] : [];
}

function mediaOf(node) {
  const conds = [];
  for (let p = node.parent; p && p.type !== 'root'; p = p.parent) {
    if (p.type === 'atrule') conds.unshift(`@${p.name} ${p.params}`.replace(/\s+/g, ' ').trim());
  }
  return conds.map((c) => c.replace(/^@media /, '')).join(' && ');
}

/** CSS を規則の並びにする。 keyframes / font-face は中身を見ず 1 つの atrule として並べる */
export function parseRules(cssText, file) {
  const root = postcss.parse(cssText, { from: file });
  const out = [];
  root.walk((node) => {
    if (node.type === 'atrule' && /^(-webkit-)?keyframes$|^font-face$|^property$/.test(node.name)) {
      out.push({ kind: 'atrule', file, index: out.length, name: node.name, params: node.params, media: mediaOf(node), node });
      return;
    }
    if (node.type !== 'rule') return;
    for (let p = node.parent; p && p.type !== 'root'; p = p.parent) {
      if (p.type === 'atrule' && /keyframes$/.test(p.name)) return;
    }
    const decls = node.nodes.filter((n) => n.type === 'decl');
    const selector = node.selector.replace(/\s+/g, ' ').trim();
    out.push({
      kind: 'rule',
      file,
      index: out.length,
      media: mediaOf(node),
      selector,
      selectors: splitSelectorList(selector),
      props: decls.map((d) => d.prop.toLowerCase()),
      decls: decls.map((d) => `${d.prop.toLowerCase()}:${d.value.replace(/\s+/g, ' ').trim()}${d.important ? '!important' : ''}`).join(';'),
      node,
    });
  });
  return out;
}

/** @media の幅の範囲 [下限, 上限](px)。 幅以外の条件は「効きうる」とみなす */
function widthRange(media) {
  let lo = -Infinity;
  let hi = Infinity;
  for (const m of media.matchAll(/(min|max)-width:\s*([\d.]+)px/g)) {
    if (m[1] === 'min') lo = Math.max(lo, Number(m[2]));
    else hi = Math.min(hi, Number(m[2]));
  }
  return [lo, hi];
}

/** 2 つの @media 条件が同時に成り立ちうるか(幅の範囲が重ならない時だけ false) */
export function mediaCanOverlap(a, b) {
  const [alo, ahi] = widthRange(a);
  const [blo, bhi] = widthRange(b);
  return Math.max(alo, blo) <= Math.min(ahi, bhi);
}

// 名前の前半一致で分からない、 まとめ書き → 個別書き
const SHORTHAND_EXTRA = {
  inset: ['top', 'right', 'bottom', 'left'],
  gap: ['row-gap', 'column-gap'],
  font: ['line-height'],
  'border-radius': ['border-top-left-radius', 'border-top-right-radius', 'border-bottom-left-radius', 'border-bottom-right-radius'],
  'place-items': ['align-items', 'justify-items'],
  'place-content': ['align-content', 'justify-content'],
  'place-self': ['align-self', 'justify-self'],
  grid: ['grid-template', 'grid-template-rows', 'grid-template-columns', 'grid-template-areas', 'grid-auto-flow', 'grid-auto-rows', 'grid-auto-columns'],
  'grid-area': ['grid-row', 'grid-column', 'grid-row-start', 'grid-row-end', 'grid-column-start', 'grid-column-end'],
  'text-decoration': ['text-decoration-line', 'text-decoration-color', 'text-decoration-style', 'text-decoration-thickness'],
};

/** 同じ見た目の値を取り合う性質か(同名・まとめ書きと個別書き) */
export function propsOverlap(p, q) {
  if (p === q) return true;
  if (p.startsWith('--') || q.startsWith('--')) return false;
  if (q.startsWith(`${p}-`) || p.startsWith(`${q}-`)) return true;
  return (SHORTHAND_EXTRA[p] ?? []).some((x) => q === x || q.startsWith(`${x}-`)) || (SHORTHAND_EXTRA[q] ?? []).some((x) => p === x || p.startsWith(`${x}-`));
}

/** 右端の複合セレクタに対象 class が無い時の、 右端の名前(対象外の class・属性名) */
function rightNamesOf(selector, prefixRe) {
  const cs = compounds(selector);
  const rest = stripPseudoFns(cs[cs.length - 1] ?? '').rest;
  const classes = (rest.match(/\.[\w-]+/g) || []).map((c) => c.slice(1));
  if (classes.some((c) => prefixRe.test(c))) return [];
  const attrs = [...(cs[cs.length - 1] ?? '').matchAll(/\[([\w-]+)/g)].map((m) => m[1]);
  return [...classes, ...attrs];
}

/**
 * 並び順で A が先の「順番頼りの組」 [A, B, 性質] を返す。 related = 別名の class が同じ要素に付きうるか(classGroups.mjs)。
 * rightNames: 右端に対象 class が無い規則(.milspec-key:hover .sh 等)は、 祖先の class に加えて右端の名前が同じものも同じ対象とみなす
 * (別の祖先を経て同じ要素に効く組を拾う)。
 */
export function findOrderPairs(rules, related = (a, b) => a === b, prefixRe = HOUSING_PREFIX, { rightNames = false } = {}) {
  const entries = [];
  rules.forEach((r, i) => {
    if (r.kind !== 'rule') return;
    const props = new Set(r.props);
    for (const sel of r.selectors) {
      const subj = subjectClasses(sel, prefixRe);
      if (!subj.length) continue;
      entries.push({ i, r, props, spec: specificity(sel).join(','), subj, names: rightNames ? rightNamesOf(sel, prefixRe) : [] });
    }
  });
  // 詳細度で束ねてから組を探す。 @media は条件なし・スマホ用などが同時に効くので束ねる鍵にしない(幅が重ならない組だけ外す)
  const buckets = new Map();
  for (const e of entries) {
    if (!buckets.has(e.spec)) buckets.set(e.spec, []);
    buckets.get(e.spec).push(e);
  }
  const sameTarget = (x, y) => x.subj.some((a) => y.subj.some((b) => a === b || related(a, b))) || x.names.some((n) => y.names.includes(n));
  const seen = new Set();
  const pairs = [];
  for (const list of buckets.values()) {
    for (let a = 0; a < list.length; a++) {
      for (let b = a + 1; b < list.length; b++) {
        const [x, y] = list[a].i < list[b].i ? [list[a], list[b]] : [list[b], list[a]];
        if (x.i === y.i) continue;
        const key = `${x.i}-${y.i}`;
        if (seen.has(key)) continue;
        if (!sameTarget(x, y)) continue;
        if (!mediaCanOverlap(x.r.media, y.r.media)) continue;
        const prop = [...x.props].find((p) => [...y.props].some((q) => propsOverlap(p, q)));
        if (!prop) continue;
        seen.add(key);
        pairs.push([x.r, y.r, prop]);
      }
    }
  }
  return pairs;
}
