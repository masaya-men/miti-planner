import { describe, it, expect } from 'vitest';
import { PLAN_CORE, planCoreSVG } from '../pcb';

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
