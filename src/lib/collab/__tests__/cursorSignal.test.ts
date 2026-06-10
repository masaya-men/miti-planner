import { describe, it, expect } from 'vitest';
import { wireSignal } from '../cursorSignal';
import type { AwarenessLike } from '../presence';
import type { SignalMsg } from '../cursorTransport';

class FakeAwareness implements AwarenessLike {
  clientID = 5;
  local: Record<string, unknown> = {};
  states = new Map<number, Record<string, unknown>>();
  cbs: Array<() => void> = [];
  setLocalStateField(f: string, v: unknown) { this.local[f] = v; this.states.set(this.clientID, { ...this.local }); this.fire(); }
  getStates() { return this.states; }
  on(_e: 'change', cb: () => void) { this.cbs.push(cb); }
  off(_e: 'change', cb: () => void) { this.cbs = this.cbs.filter(c => c !== cb); }
  peer(id: number, signal: SignalMsg) { this.states.set(id, { signal }); this.fire(); }
  fire() { this.cbs.forEach(c => c()); }
}

const msg = (over: Partial<SignalMsg> = {}): SignalMsg => ({ to: 5, from: 2, kind: 'offer', sdp: 'sdp', nonce: 1, ...over });

describe('wireSignal', () => {
  it('自分宛の signal だけをコールバックする', () => {
    const aw = new FakeAwareness();
    const got: SignalMsg[] = [];
    const h = wireSignal(aw, (m) => got.push(m));
    aw.peer(2, msg({ to: 5 }));       // 自分宛
    aw.peer(9, msg({ to: 8, from: 9 })); // 他人宛
    expect(got.map(m => m.from)).toEqual([2]);
    h.stop();
  });
  it('send で awareness の signal フィールドに載る', () => {
    const aw = new FakeAwareness();
    const h = wireSignal(aw, () => {});
    h.send(msg({ to: 2, from: 5 }));
    expect((aw.local.signal as SignalMsg).to).toBe(2);
    h.stop();
  });
  it('clear で signal フィールドを空にする(SDP=IP を残さない)', () => {
    const aw = new FakeAwareness();
    const h = wireSignal(aw, () => {});
    h.send(msg());
    h.clear();
    expect(aw.local.signal).toBeNull();
    h.stop();
  });
});
