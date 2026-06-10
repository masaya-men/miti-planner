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
});
