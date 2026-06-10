import { describe, it, expect } from 'vitest';
import { meshTargets, isInitiator, isForMe, type SignalMsg } from '../cursorTransport';
import type { RosterEntry } from '../presence';

const entry = (clientId: number, cursorEnabled: boolean, isLocal = false): RosterEntry => ({
  clientId, color: '#fff', jobId: null, isEditor: true, cursorEnabled, isLocal,
});

describe('meshTargets', () => {
  it('local が ON のとき、cursorEnabled な他者の clientId を返す', () => {
    const roster = [entry(7, true, true), entry(2, true), entry(9, false), entry(4, true)];
    expect(meshTargets(roster, 7, true).sort()).toEqual([2, 4]);
  });
  it('local が OFF のとき空(誰とも繋がない=IP 露出ゼロ)', () => {
    const roster = [entry(7, false, true), entry(2, true)];
    expect(meshTargets(roster, 7, false)).toEqual([]);
  });
  it('自分自身は含めない', () => {
    const roster = [entry(7, true, true)];
    expect(meshTargets(roster, 7, true)).toEqual([]);
  });
});

describe('isInitiator', () => {
  it('clientId が小さい側だけ initiator(glare 回避)', () => {
    expect(isInitiator(2, 9)).toBe(true);
    expect(isInitiator(9, 2)).toBe(false);
  });
});

describe('isForMe', () => {
  it('to が自分宛のときだけ true', () => {
    const msg: SignalMsg = { to: 5, from: 2, kind: 'offer', sdp: 'x', nonce: 1 };
    expect(isForMe(msg, 5)).toBe(true);
    expect(isForMe(msg, 9)).toBe(false);
  });
});
