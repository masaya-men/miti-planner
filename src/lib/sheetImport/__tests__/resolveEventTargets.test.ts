import { describe, it, expect } from 'vitest';
import { resolveEventTarget, applyResolvedTargets } from '../resolveEventTargets';
import type { TimelineEvent } from '../../../types';

const ev = (id: string, ja: string, time: number, target?: 'MT' | 'ST' | 'AoE'): TimelineEvent =>
  ({ id, name: { ja, en: ja }, time, damageType: 'magical', ...(target ? { target } : {}) } as TimelineEvent);

const TEMPLATE: TimelineEvent[] = [ev('t1', '波動砲', 43, 'AoE')];

describe('resolveEventTarget', () => {
  it('手動 override が最優先', () => {
    const r = resolveEventTarget(ev('e1', '波動砲', 43), TEMPLATE, { e1: 'MT' });
    expect(r).toEqual({ target: 'MT', source: 'manual' });
  });
  it('手動「なし」はテンプレに勝って null', () => {
    const r = resolveEventTarget(ev('e1', '波動砲', 43), TEMPLATE, { e1: 'none' });
    expect(r).toEqual({ target: null, source: 'manual' });
  });
  it('自作対象列(ev.target)はテンプレに勝つ', () => {
    const r = resolveEventTarget(ev('e1', '波動砲', 43, 'ST'), TEMPLATE, {});
    expect(r).toEqual({ target: 'ST', source: 'sheet' });
  });
  it('手動も自作も無ければテンプレ由来', () => {
    const r = resolveEventTarget(ev('e1', '波動砲', 43), TEMPLATE, {});
    expect(r).toEqual({ target: 'AoE', source: 'template' });
  });
  it('どれも無ければ none', () => {
    const r = resolveEventTarget(ev('e1', '謎技', 99), TEMPLATE, {});
    expect(r).toEqual({ target: null, source: 'none' });
  });
});

describe('applyResolvedTargets', () => {
  it('各 event に実効 target を確定(none は target を外す)', () => {
    const events = [ev('e1', '波動砲', 43), ev('e2', '波動砲', 50)];
    const out = applyResolvedTargets(events, TEMPLATE, { e2: 'none' });
    expect(out[0].target).toBe('AoE');     // テンプレ由来
    expect(out[1].target).toBeUndefined(); // 手動なし
  });
});
