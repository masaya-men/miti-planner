import { describe, it, expect } from 'vitest';
import { militaryCssText } from './militaryCssText';

// 案 B(2026-10-22): MIL-SPEC の意味トークン差し替えは .milspec-app の中だけ。ボードの中に直接描かれる
// 上に出る窓(.glass-tier3)は --std-* で標準に掛け戻す。差し替える名前と掛け戻す名前がずれると、
// 窓の一部だけ MIL-SPEC 色が残る(masaya 指摘の「中途半端に残る」)ので、名前の集合を突き合わせる。
const css = militaryCssText();

// 選択子の並び(「A,\nB {」)のどこかに selector がある節を取る(2026-10-28: 掛け戻しの節に .float-surface を並べた)
const blockOf = (selector: string) => {
  const i = css.split('\n').findIndex((line) => line === `${selector} {` || line === `${selector},`);
  expect(i, `${selector} の節が無い`).toBeGreaterThanOrEqual(0);
  const start = css.split('\n').slice(0, i).join('\n').length;
  return css.slice(start, css.indexOf('\n}', start));
};
const names = (block: string) => new Set([...block.matchAll(/^\s*(--[a-z0-9-]+):/gm)].map((m) => m[1]));

describe('上に出る窓の標準への掛け戻し', () => {
  const remapped = new Set([
    ...names(blockOf('.theme-military.theme-dark .milspec-app')),
    ...names(blockOf('.theme-military.theme-light .milspec-app')),
  ]);
  const island = names(blockOf('.theme-military .milspec-app .glass-tier3'));
  const stdCopies = names(blockOf('.theme-military:root'));

  it('差し替えた意味トークンは全部、窓の中で掛け戻している', () => {
    expect(remapped.size).toBeGreaterThan(30);
    const missing = [...remapped].filter((n) => !island.has(n));
    expect(missing).toEqual([]);
  });
  it('掛け戻しに使う標準値の写し(--std-*)が全部ある', () => {
    const missing = [...remapped].filter((n) => !stdCopies.has(`--std${n.slice(1)}`));
    expect(missing).toEqual([]);
  });
  it('@theme の参照トークン(--color-app-* / --color-glass-*)も窓の中で掛け直している', () => {
    const app = [...island].filter((n) => n.startsWith('--color-app-') || n.startsWith('--color-glass-'));
    expect(app.length).toBe(32);
  });
});
