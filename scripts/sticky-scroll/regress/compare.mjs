import { ALLOW, PROBE_FILTER, TOL, TOL_PRECISE } from './config.mjs';

// ───────────────────────────── 実行 ─────────────────────────────
export function wantProbe(name) { return !PROBE_FILTER || PROBE_FILTER.has(name); }

// ───────────────────────────── 比較 ─────────────────────────────
export function isAllowed(p) { return ALLOW.some((a) => p.includes(a)); }
/** @returns {string[]} 差分(許容外) */
export function diffAny(a, b, p, acc, allowedAcc) {
  const rec = (msg) => (isAllowed(p) ? allowedAcc : acc).push(`${p}: ${msg}`);
  if (typeof a === 'number' && typeof b === 'number') {
    const tol = p.includes('/precise/') ? TOL_PRECISE : TOL;
    if (Math.abs(a - b) > tol) rec(`${a} -> ${b} (差 ${Math.round((b - a) * 1000) / 1000})`);
    return;
  }
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    if (a !== b) rec(`${JSON.stringify(a)} -> ${JSON.stringify(b)}`);
    return;
  }
  if (Array.isArray(a) !== Array.isArray(b)) { rec('配列とオブジェクトの違い'); return; }
  if (Array.isArray(a)) {
    if (a.length !== b.length) { rec(`長さ ${a.length} -> ${b.length}`); return; }
    a.forEach((_, i) => diffAny(a[i], b[i], `${p}[${i}]`, acc, allowedAcc));
    return;
  }
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (!(k in a)) rec(`キー追加 ${k}`);
    else if (!(k in b)) rec(`キー消失 ${k}`);
    else diffAny(a[k], b[k], `${p}/${k}`, acc, allowedAcc);
  }
}
