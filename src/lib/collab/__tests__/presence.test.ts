import { describe, it, expect } from 'vitest';
import { PALETTE, colorForClient, nameForClient, buildRoster, type PresenceState } from '../presence';
import { wirePresence, type AwarenessLike } from '../presence';

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

describe('nameForClient', () => {
  const ADJ = ['しずかな', 'ゆうかんな', 'きまぐれな'];
  const NOUN = ['モーグリ', 'チョコボ', 'トンベリ'];

  it('形容詞+名詞を区切りで連結(決定的)', () => {
    // clientId=0: adj[0]=しずかな, noun[floor(0/3)%3=0]=モーグリ
    expect(nameForClient(0, ADJ, NOUN, '')).toBe('しずかなモーグリ');
    expect(nameForClient(0, ADJ, NOUN, ' ')).toBe('しずかな モーグリ');
    // 同じ clientId は毎回同じ
    expect(nameForClient(5, ADJ, NOUN, '')).toBe(nameForClient(5, ADJ, NOUN, ''));
  });

  it('形容詞と名詞は独立に動く(組合せの多様性)', () => {
    expect(nameForClient(1, ADJ, NOUN, '')).toBe('ゆうかんなモーグリ'); // adj[1], noun[0]
    expect(nameForClient(3, ADJ, NOUN, '')).toBe('しずかなチョコボ');   // adj[0], noun[1]
  });

  it('負の clientId でも undefined を含まない', () => {
    expect(nameForClient(-1, ADJ, NOUN, '')).not.toContain('undefined');
  });

  it('空リストは #clientId フォールバック', () => {
    expect(nameForClient(42, [], NOUN)).toBe('#42');
    expect(nameForClient(42, ADJ, [])).toBe('#42');
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

class FakeAwareness implements AwarenessLike {
  clientID = 7;
  private local: Record<string, unknown> = {};
  private states = new Map<number, Record<string, unknown>>();
  private cbs: Array<() => void> = [];
  setLocalStateField(field: string, value: unknown) {
    this.local[field] = value;
    this.states.set(this.clientID, { ...this.local });
    this.fire();
  }
  getStates() { return this.states; }
  on(_e: 'change', cb: () => void) { this.cbs.push(cb); }
  off(_e: 'change', cb: () => void) { this.cbs = this.cbs.filter(c => c !== cb); }
  /** テスト用: 他者の参加をシミュレート。 */
  addPeer(id: number, state: Record<string, unknown>) { this.states.set(id, state); this.fire(); }
  private fire() { this.cbs.forEach(c => c()); }
}

describe('wirePresence', () => {
  it('local presence を載せ、変化のたびに roster を通知し、cleanup で購読解除', () => {
    const aw = new FakeAwareness();
    const seen: number[] = [];
    const handle = wirePresence(aw, p({ color: '#111' }), (r) => seen.push(r.length));
    // setLocalStateField(初期) で自分1人の roster が出る
    expect(seen.at(-1)).toBe(1);
    aw.addPeer(2, { presence: p({ color: '#222' }) });
    expect(seen.at(-1)).toBe(2);
    handle.stop();
    aw.addPeer(3, { presence: p({ color: '#333' }) });
    expect(seen.at(-1)).toBe(2); // 解除後は通知されない
  });
});

describe('wirePresence の実行時更新', () => {
  it('update で cursorEnabled を変えると awareness に再反映され roster に出る', () => {
    const aw = new FakeAwareness();
    let last: import('../presence').RosterEntry[] = [];
    const handle = wirePresence(aw, p({ cursorEnabled: false }), (r) => { last = r; });
    expect(last[0].cursorEnabled).toBe(false);
    handle.update({ cursorEnabled: true });
    expect(last[0].cursorEnabled).toBe(true);
    handle.stop();
  });
  it('stop で購読解除(後方互換: 戻り値は stop を持つ)', () => {
    const aw = new FakeAwareness();
    const handle = wirePresence(aw, p(), () => {});
    expect(typeof handle.stop).toBe('function');
    handle.stop();
  });
});
