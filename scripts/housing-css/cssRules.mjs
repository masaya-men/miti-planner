// CSS を「規則の並び」として読む共通部品。 ハウジング CSS の置き場所を移す道具と、 その前後比較・見張りテストが使う。
// 「順番頼りの組」= 同じ @media・同じ詳細度・対象 class が共通・同じ性質を宣言する 2 規則(後に書いた方が勝つので並びが結果を決める)。
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
function compounds(sel) {
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
    const { fns, rest } = stripPseudoFns(c);
    for (const fn of fns) {
      if (fn.name === 'where') continue;
      if (fn.name === 'is' || fn.name === 'not' || fn.name === 'has' || fn.name === 'matches') {
        const best = splitSelectorList(fn.args).map(specificity).sort(cmp).pop() ?? [0, 0, 0];
        total = add(total, best);
      } else if (['before', 'after', 'first-line', 'first-letter', 'slotted', 'part'].includes(fn.name)) {
        total = add(total, [0, 0, 1]);
      } else total = add(total, [0, 1, 0]); // :nth-child() など
    }
    const ids = (rest.match(/#[\w-]+/g) || []).length;
    const cls = (rest.match(/\.[\w-]+/g) || []).length + (rest.match(/\[\]/g) || []).length;
    const pseudoEls = (rest.match(/::[\w-]+/g) || []).length;
    const pseudoCls = (rest.replace(/::[\w-]+/g, '').match(/:[\w-]+/g) || []).length;
    const el = /^[a-zA-Z][\w-]*/.test(rest) ? 1 : 0;
    total = add(total, [ids, cls + pseudoCls, el + pseudoEls]);
  }
  return total;
}

const housingClassesOf = (text) => (stripPseudoFns(text).rest.match(/\.housing-[\w-]+/g) || []).map((s) => s.slice(1));

/** 規則が見た目を決める相手の housing class(右端の複合セレクタ。 無ければ全体で最後の 1 つ) */
export function subjectClasses(selector) {
  const cs = compounds(selector);
  const last = housingClassesOf(cs[cs.length - 1] ?? '');
  if (last.length) return [...new Set(last)];
  const all = cs.flatMap(housingClassesOf);
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

/** 並び順で A が先の「順番頼りの組」 [A, B, 性質] を返す */
export function findOrderPairs(rules) {
  const entries = [];
  rules.forEach((r, i) => {
    if (r.kind !== 'rule') return;
    const props = new Set(r.props);
    for (const sel of r.selectors) {
      const subj = subjectClasses(sel);
      if (!subj.length) continue;
      entries.push({ i, r, props, spec: specificity(sel).join(','), subj });
    }
  });
  // media+詳細度+対象 class で束ねてから組を探す(全組の総当たりを避ける)
  const buckets = new Map();
  for (const e of entries) {
    for (const c of e.subj) {
      const key = `${e.r.media}|${e.spec}|${c}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(e);
    }
  }
  const seen = new Set();
  const pairs = [];
  for (const list of buckets.values()) {
    for (let a = 0; a < list.length; a++) {
      for (let b = a + 1; b < list.length; b++) {
        const [x, y] = list[a].i < list[b].i ? [list[a], list[b]] : [list[b], list[a]];
        if (x.i === y.i) continue;
        const key = `${x.i}-${y.i}`;
        if (seen.has(key)) continue;
        const prop = [...x.props].find((p) => y.props.has(p));
        if (!prop) continue;
        seen.add(key);
        pairs.push([x.r, y.r, prop]);
      }
    }
  }
  return pairs;
}
