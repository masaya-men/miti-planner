import { describe, it, expect } from 'vitest';
import { loadSharp } from '../_lib/loadSharp.js';

describe('loadSharp', () => {
  it('2 回呼んでも同じものを返す', async () => {
    const a = await loadSharp();
    const b = await loadSharp();
    expect(a).toBe(b);
  });

  it('SVG は読めない (GHSA-wq5f-xc86-pv6w)', async () => {
    const sharp = await loadSharp();
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"/>');
    await expect(sharp(svg).png().toBuffer()).rejects.toThrow();
  });
});
