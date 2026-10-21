// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { readPalette } from '../palette';

describe('readPalette', () => {
  it('--ma-* を読む', () => {
    const el = document.createElement('div');
    el.style.setProperty('--ma-pri-top', '#555b61');
    el.style.setProperty('--ma-pri-bot', '#000000');
    el.style.setProperty('--ma-key-dish', '0.25');
    el.style.setProperty('--ma-seam', ' rgba(0,0,0,.5) ');
    document.body.appendChild(el);
    const p = readPalette(el);
    expect(p.pri.top).toEqual([0x55, 0x5b, 0x61]);
    expect(p.dish).toBe(0.25);
    expect(p.seam).toBe('rgba(0,0,0,.5)');
  });
});
