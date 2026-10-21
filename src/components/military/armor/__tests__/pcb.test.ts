import { describe, it, expect } from 'vitest';
import { PLAN_CORE, planCoreSVG, ventChannelSVG, cu, via, silk, smd } from '../pcb';

describe('planCoreSVG', () => {
  it('見本の高さでは IC が見本の位置', () => {
    const s = planCoreSVG({ h: 451.2, id: 't' });
    expect(s).toContain('<rect x="111" y="359" width="26" height="26" class="ic"');
    expect(s).toContain('PLAN CORE');
  });
  it('高さが伸びると IC が下に付いてくる', () => {
    const s = planCoreSVG({ h: 852, id: 't' });
    expect(s).toContain('<rect x="111" y="759.8" width="26" height="26" class="ic"');
    // 幹線の始点(y=0)は不変
    const d = (h: number) => /data-trace="s2k0"/.test(planCoreSVG({ h, id: 't' }))
      ? planCoreSVG({ h, id: 't' }).match(/<path d="(M [\d.]+ 0) L[^"]*" class="milspec-cu" data-trace="s2k0"/)?.[1]
      : undefined;
    expect(d(852)).toBeDefined();
    expect(d(852)).toBe(d(451.2));
  });
  it('配線に経路名と端子位置が付く', () => {
    const s = planCoreSVG({ h: 451.2, id: 't' });
    expect(s).toContain('data-trace="s2k0"');
    expect(s).toContain('data-trace="s2B5"');
    expect(s).toContain('data-trace-end="');
    expect(s).toContain('class="milspec-core-glow"');
  });
  it('id 接頭辞が付く', () => {
    const s = planCoreSVG({ h: 451.2, id: 't' });
    expect(s).toContain('clip-path="url(#t)"');
    expect(s).toContain('id="tg"');
  });
  it('PLAN_CORE の定数', () => {
    expect(PLAN_CORE).toEqual({ w: 249.2, h0: 451.2, sy: 161.6 });
  });
});

describe('部品関数と ventChannelSVG', () => {
  it('cu / via / silk / smd は文字列を返す純関数', () => {
    expect(cu([[0, 0], [5, 5]], 'x')).toContain('data-trace="x"');
    expect(via(1, 2, 0.4)).toContain('class="via"');
    expect(silk(1, 2, 'A')).toContain('>A</text>');
    expect(smd(1, 2, 2.4, 1)).toContain('class="smd"');
  });
  it('左の通気口に ventL:0〜4 の経路が付き、光の経路は milspec-cu', () => {
    const s = ventChannelSVG({ w: 207, side: 'L', id: 'v' });
    for (let k = 0; k < 5; k++) expect(s).toContain(`data-trace="ventL:${k}"`);
    expect(s).toContain('class="brd"');
    expect((s.match(/class="milspec-cu"/g) ?? []).length).toBe(5);
  });
  it('右は ventR、左は x が反転(右は始点が x=0・左は始点が x=w)', () => {
    const r = ventChannelSVG({ w: 100, side: 'R', id: 'v' });
    const l = ventChannelSVG({ w: 100, side: 'L', id: 'v' });
    expect(r).toContain('data-trace="ventR:0"');
    expect(r).toMatch(/<path d="M 0 [\d.]+ L[^"]*" class="milspec-cu" data-trace="ventR:2"/);
    expect(l).toMatch(/<path d="M 100 [\d.]+ L[^"]*" class="milspec-cu" data-trace="ventL:2"/);
  });
  it('w が 30 未満なら空文字', () => {
    expect(ventChannelSVG({ w: 20, side: 'L', id: 'v' })).toBe('');
    expect(ventChannelSVG({ w: 29.9, side: 'R', id: 'v' })).toBe('');
  });
});

describe('qfp / silk 回転', () => {
  it('qfp は上下ピン + 本体 + 目印 + 刻印を返す', async () => {
    const { qfp } = await import('../pcb');
    const s = qfp(1.4, 251.2, 11.2, 18, [2, 4], 'tb', 'U7');
    expect(s.match(/class="pin"/g)).toHaveLength(4);
    expect(s).toContain('class="ic"');
    expect(s).toContain('class="ic-dot"');
    expect(s).toContain('>U7</text>');
  });
  it('silk は rot で回転する', async () => {
    const { silk } = await import('../pcb');
    expect(silk(7, 300, 'PULL', 'middle', undefined, (y) => y, 90)).toContain('rotate(90 7 300)');
  });
});
