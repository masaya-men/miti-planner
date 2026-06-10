import { describe, it, expect } from 'vitest';
import { PALETTE, colorForClient, buildRoster, type PresenceState } from '../presence';

const p = (over: Partial<PresenceState> = {}): PresenceState => ({
  color: '#fff', jobId: null, isEditor: true, cursorEnabled: true, ...over,
});

describe('colorForClient', () => {
  it('PALETTE 内の色を返し、同じ clientId は毎回同じ', () => {
    const c = colorForClient(5);
    expect(PALETTE).toContain(c);
    expect(colorForClient(5)).toBe(c);
  });
  it('負の clientId でも範囲内', () => {
    expect(PALETTE).toContain(colorForClient(-3));
  });
});

describe('buildRoster', () => {
  it('presence 付き state を RosterEntry 化し、自分を先頭・他は clientId 昇順', () => {
    const states = new Map<number, { presence?: PresenceState }>([
      [10, { presence: p({ color: '#aaa', isEditor: false }) }],
      [2, { presence: p({ color: '#bbb', isEditor: true }) }],
      [7, { presence: p({ color: '#ccc', isEditor: true }) }], // self
    ]);
    const r = buildRoster(states, 7);
    expect(r.map(e => e.clientId)).toEqual([7, 2, 10]);
    expect(r[0].isLocal).toBe(true);
    expect(r.find(e => e.clientId === 10)!.isEditor).toBe(false);
  });
  it('presence 未設定の state は除外する', () => {
    const states = new Map<number, { presence?: PresenceState }>([
      [1, {}],            // 未設定
      [2, { presence: p() }],
    ]);
    const r = buildRoster(states, 99);
    expect(r.map(e => e.clientId)).toEqual([2]);
  });
});
