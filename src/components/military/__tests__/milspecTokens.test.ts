import { describe, it, expect } from 'vitest';
import { militaryCssText } from '../../../styles/__tests__/militaryCssText';

const css = militaryCssText();

// ブロックを「セレクタ { から次の }」まで簡易に切り出す(先頭の定義ブロック)
const block = (selector: string): string => {
  const start = css.indexOf(`${selector} {`);
  expect(start).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf('}', start));
};

describe('MIL-SPEC v11 材質トークン', () => {
  it('装甲の 4 トーンがダーク・ライト両方にある', () => {
    for (const sel of ['.theme-military.theme-dark', '.theme-military.theme-light']) {
      const b = block(sel);
      for (const k of ['pri', 'sec', 'chs', 'key']) {
        for (const s of ['top', 'bot', 'hi', 'lo']) {
          expect(b, `${sel} に --ma-${k}-${s}`).toContain(`--ma-${k}-${s}:`);
        }
      }
    }
  });

  it('意味色が定義されている', () => {
    for (const n of ['--ma-on:', '--ma-warn:', '--ma-dng:', '--ma-sig:']) {
      expect(css).toContain(n);
    }
  });

  it('見本の短い名前を直接使っていない', () => {
    expect(css).not.toMatch(/\s--(pri|sec|chs|key)-(top|bot|hi|lo):/);
  });
  it('--ma-drw-* が dark / light の両方に定義されている', () => {
    for (const sel of ['.theme-military.theme-dark', '.theme-military.theme-light']) {
      const b = block(sel);
      for (const k of ['lit', 'dark', 'knot', 'edge-hi', 'frame', 'zinc', 'rust', 'soot']) {
        expect(b, `${sel} に --ma-drw-${k}`).toContain(`--ma-drw-${k}:`);
      }
    }
  });
});
