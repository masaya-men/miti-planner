import { describe, it, expect, vi } from 'vitest';
import { createCursorMesh, type PeerConnectionLike, type CursorPacket } from '../cursorMesh';
import type { RosterEntry } from '../presence';

const entry = (clientId: number, cursorEnabled = true, isLocal = false): RosterEntry => ({
  clientId, color: '#fff', jobId: null, isEditor: true, cursorEnabled, isLocal,
});

// 最小 fake PC: datachannel は即 open 扱い、SDP は固定文字列。
function fakePCFactory() {
  const created: FakePC[] = [];
  class FakePC implements PeerConnectionLike {
    ondata: ((p: CursorPacket) => void) | null = null;
    onclosed: (() => void) | null = null;
    sent: CursorPacket[] = [];
    closed = false;
    constructor() { created.push(this); }
    async createOfferSDP() { return 'offer-sdp'; }
    async acceptOfferCreateAnswerSDP(_sdp: string) { return 'answer-sdp'; }
    async acceptAnswer(_sdp: string) {}
    send(p: CursorPacket) { this.sent.push(p); }
    close() { this.closed = true; }
  }
  return { factory: () => new FakePC(), created };
}

describe('createCursorMesh', () => {
  it('local=7 が ON のとき、cursorEnabled な他者(2)に対し initiator(7>2 なので answerer)挙動を選ぶ', async () => {
    const { factory, created } = fakePCFactory();
    const send = vi.fn();
    const mesh = createCursorMesh({ localClientId: 7, makePeer: factory, sendSignal: send });
    await mesh.reconcile([entry(7, true, true), entry(2, true)], true);
    // 7 > 2 なので 7 は answerer = 自分から offer を送らない(2 からの offer を待つ)
    expect(send).not.toHaveBeenCalled();
    expect(created.length).toBe(1); // peer は作る(受け入れ準備)
    mesh.destroy();
  });

  it('local=2 が ON のとき、相手(9)に initiator として offer を送る', async () => {
    const { factory } = fakePCFactory();
    const send = vi.fn();
    const mesh = createCursorMesh({ localClientId: 2, makePeer: factory, sendSignal: send });
    await mesh.reconcile([entry(2, true, true), entry(9, true)], true);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: 9, from: 2, kind: 'offer' }));
    mesh.destroy();
  });

  it('local が OFF なら peer を作らない(IP 露出ゼロ)', async () => {
    const { factory, created } = fakePCFactory();
    const mesh = createCursorMesh({ localClientId: 2, makePeer: factory, sendSignal: vi.fn() });
    await mesh.reconcile([entry(2, false, true), entry(9, true)], false);
    expect(created.length).toBe(0);
    mesh.destroy();
  });

  it('roster から消えた peer の接続は閉じる', async () => {
    const { factory, created } = fakePCFactory();
    const mesh = createCursorMesh({ localClientId: 2, makePeer: factory, sendSignal: vi.fn() });
    await mesh.reconcile([entry(2, true, true), entry(9, true)], true);
    await mesh.reconcile([entry(2, true, true)], true); // 9 が退室
    expect(created[0].closed).toBe(true);
    mesh.destroy();
  });

  it('broadcast は全 open peer に CursorPacket を送る', async () => {
    const { factory, created } = fakePCFactory();
    const mesh = createCursorMesh({ localClientId: 2, makePeer: factory, sendSignal: vi.fn() });
    await mesh.reconcile([entry(2, true, true), entry(9, true)], true);
    const pkt: CursorPacket = { clientId: 2, pos: { timeSec: 10, xRatio: 0.5 }, t: 1 };
    mesh.broadcast(pkt);
    expect(created[0].sent).toContainEqual(pkt);
    mesh.destroy();
  });

  it('peer が onclosed(失敗)を発火したら onFallback が呼ばれる', async () => {
    const { factory, created } = fakePCFactory();
    const onFallback = vi.fn();
    const mesh = createCursorMesh({ localClientId: 2, makePeer: factory, sendSignal: vi.fn(), onFallback });
    await mesh.reconcile([entry(2, true, true), entry(9, true)], true);
    created[0].onclosed?.();
    expect(onFallback).toHaveBeenCalledWith(9);
    mesh.destroy();
  });

  it('意図的に閉じた peer(相手の OFF/退室)は onFallback を発火しない', async () => {
    const { factory, created } = fakePCFactory();
    const onFallback = vi.fn();
    const mesh = createCursorMesh({ localClientId: 2, makePeer: factory, sendSignal: vi.fn(), onFallback });
    await mesh.reconcile([entry(2, true, true), entry(9, true)], true);
    await mesh.reconcile([entry(2, true, true)], true); // 9 が退室 → 意図的 drop
    created[0].onclosed?.(); // drop で onclosed が外されているので呼んでも無反応
    expect(onFallback).not.toHaveBeenCalled();
    mesh.destroy();
  });

  it('MAX_ATTEMPTS(3)回失敗したら諦めて再接続しない(設計§6.3)', async () => {
    const { factory, created } = fakePCFactory();
    const mesh = createCursorMesh({ localClientId: 2, makePeer: factory, sendSignal: vi.fn() });
    const roster = [entry(2, true, true), entry(9, true)];
    for (let i = 0; i < 5; i++) {
      await mesh.reconcile(roster, true);
      created[created.length - 1]?.onclosed?.(); // 接続失敗をシミュレート
    }
    expect(created.length).toBe(3); // 3 回試行 → 以後は諦めて peer を作らない
    mesh.destroy();
  });
});
