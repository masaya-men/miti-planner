// housing.css の長さ(px)を calc(Npx * var(--housing-scale)) に一括変換するスクリプト。
// 使い方: node scripts/housing-scale/convert.mjs [--dry]   (冪等: 既に変換済みの px は触らない)
// 規則:
//  (a) @media の max-width 条件(スマホ専用)ブロックの中は変換しない
//  (b) @media の条件式 / コメント / 文字列 / url() は変換しない
//  (c) border/outline 等の 1px 以下の線の太さは変換しない
//  (d) 0px は変換しない / 既に var(--housing-scale) を掛けた px は二重変換しない
//  (e) それ以外(トークン定義・calc/clamp/min/max 内・transform・keyframes 内)は全て変換
import fs from 'node:fs';

// housing.css は入口。変換するのは入口の @import に並ぶ分割ファイル (src/styles/housing/*.css) を 1 本ずつ。
// (center-tokens は center-tokens.mjs が生成するファイルなので対象外。分割の切れ目はルールの外なので 1 本ずつでも結果は同じ)
const DIR = new URL('../../src/styles/', import.meta.url);
const entry = fs.readFileSync(new URL('housing.css', DIR), 'utf8');
const FILES = [...entry.matchAll(/@import\s+"\.\/(housing\/[^"]+)";/g)]
  .map((m) => m[1])
  .filter((f) => !f.endsWith('-center-tokens.css'))
  .map((f) => new URL(f, DIR));
const dry = process.argv.includes('--dry');
for (const FILE of FILES) {
const src = fs.readFileSync(FILE, 'utf8');

const stats = { converted: 0, skipMobile: 0, skipHairline: 0, skipZero: 0, skipOther: 0 };
const HAIRLINE_PROPS = /^(border|outline|column-rule|stroke-width|text-decoration-thickness|border-[a-z-]*width)/;

function convertValue(prop, value, inSkip) {
  // 文字列 / url() / 既に変換済みの calc(Npx * var(--housing-scale)) を退避
  const keep = [];
  let v = value.replace(/"[^"]*"|'[^']*'|url\([^)]*\)|calc\(-?[\d.]+px \* var\(--housing-scale\)\)/g, (m) => {
    keep.push(m);
    return `\u0000${keep.length - 1}\u0000`;
  });
  v = v.replace(/(?<![\w.-])(-?(?:\d+\.?\d*|\.\d+))px\b/g, (m, num) => {
    const n = parseFloat(num);
    if (inSkip) { stats.skipMobile++; return m; }
    if (n === 0) { stats.skipZero++; return m; }
    if (Math.abs(n) <= 1 && HAIRLINE_PROPS.test(prop)) { stats.skipHairline++; return m; }
    stats.converted++;
    return `calc(${num}px * var(--housing-scale))`;
  });
  return v.replace(/\u0000(\d+)\u0000/g, (_, i) => keep[+i]);
}

let out = '';
let i = 0;
const n = src.length;
const stack = []; // {kind:'container'|'rule', skip:boolean}
let seg = ''; // 現在の宣言/前置き文字列
const curSkip = () => (stack.length ? stack[stack.length - 1].skip : false);
const inRule = () => stack.length && stack[stack.length - 1].kind === 'rule';

function flushDecl(text) {
  // 宣言 "prop: value" を変換して out に出す
  const m = /^((?:\s|\/\*[\s\S]*?\*\/)*)([\w-]+)(\s*:\s*)([\s\S]*)$/.exec(text);
  if (!m) return text;
  const [, ws, prop, colon, val] = m;
  return ws + prop + colon + convertValue(prop, val, curSkip());
}

while (i < n) {
  const c = src[i];
  if (c === '/' && src[i + 1] === '*') {
    const e = src.indexOf('*/', i + 2);
    const end = e < 0 ? n : e + 2;
    seg += src.slice(i, end); // コメントは seg に保持(宣言の途中コメントも触らない)
    i = end;
    continue;
  }
  if (c === '"' || c === "'") {
    let j = i + 1;
    while (j < n && src[j] !== c) j += src[j] === String.fromCharCode(92) ? 2 : 1;
    seg += src.slice(i, j + 1);
    i = j + 1;
    continue;
  }
  if (c === '(') {
    // 括弧内は丸ごと seg に (中の ; { } は無い前提。url(data:...;) 対策で対応括弧まで読む)
    let depth = 0, j = i;
    while (j < n) {
      if (src[j] === '(') depth++;
      else if (src[j] === ')') { depth--; if (depth === 0) break; }
      else if (src[j] === '/' && src[j + 1] === '*') { j = src.indexOf('*/', j + 2) + 1; }
      j++;
    }
    seg += src.slice(i, j + 1);
    i = j + 1;
    continue;
  }
  if (c === '{') {
    // コメントを除いた前置き
    const prelude = seg.replace(/\/\*[\s\S]*?\*\//g, '').trim();
    out += seg + '{';
    seg = '';
    if (prelude.startsWith('@media') || prelude.startsWith('@keyframes') || prelude.startsWith('@supports')) {
      const mobileOnly = prelude.startsWith('@media') && /max-width/.test(prelude);
      stack.push({ kind: 'container', skip: curSkip() || mobileOnly });
    } else {
      stack.push({ kind: 'rule', skip: curSkip() });
    }
    i++;
    continue;
  }
  if (c === ';') {
    out += (inRule() ? flushDecl(seg) : seg) + ';';
    seg = '';
    i++;
    continue;
  }
  if (c === '}') {
    out += (inRule() ? flushDecl(seg) : seg) + '}';
    seg = '';
    stack.pop();
    i++;
    continue;
  }
  seg += c;
  i++;
}
out += seg;

console.log(JSON.stringify(stats));
if (!dry) fs.writeFileSync(FILE, out);
}
