// ④-b-2: P2P mesh の管理(接続の張り/閉じ・offer/answer・datachannel 送受信)。
// RTCPeerConnection は PeerConnectionLike 注入でテスト可能にする(実体は cursorPeer.ts)。
import { meshTargets, isInitiator, type SignalMsg } from './cursorTransport';
import type { RosterEntry } from './presence';

/** datachannel で流すカーソルパケット(色/ジョブは載せない=roster 側)。 */
export interface CursorPacket {
  clientId: number;
  pos: { timeSec: number; xRatio: number } | null;
  t: number;
}

/** RTCPeerConnection の最小抽象(テストで fake 可能に)。 */
export interface PeerConnectionLike {
  createOfferSDP(): Promise<string>;
  acceptOfferCreateAnswerSDP(remoteSdp: string): Promise<string>;
  acceptAnswer(remoteSdp: string): Promise<void>;
  send(packet: CursorPacket): void;
  close(): void;
  ondata: ((p: CursorPacket) => void) | null;
  onclosed: (() => void) | null;
}

export interface CursorMeshOptions {
  localClientId: number;
  makePeer: () => PeerConnectionLike;
  sendSignal: (msg: SignalMsg) => void;
  onPacket?: (p: CursorPacket) => void;
  /** peer 接続が失敗/切断したとき(P2P 不成立)。UI で静かにフォールバック通知する。 */
  onFallback?: (remoteId: number) => void;
}

export interface CursorMesh {
  reconcile(roster: RosterEntry[], localEnabled: boolean): Promise<void>;
  handleSignal(msg: SignalMsg): Promise<void>;
  broadcast(p: CursorPacket): void;
  destroy(): void;
}

export function createCursorMesh(opts: CursorMeshOptions): CursorMesh {
  const peers = new Map<number, PeerConnectionLike>();
  let nonce = 1;

  const drop = (id: number) => {
    const pc = peers.get(id);
    if (pc) { pc.close(); peers.delete(id); }
  };

  const ensurePeer = (remoteId: number): PeerConnectionLike => {
    let pc = peers.get(remoteId);
    if (pc) return pc;
    pc = opts.makePeer();
    pc.ondata = (p) => opts.onPacket?.(p);
    pc.onclosed = () => { peers.delete(remoteId); opts.onFallback?.(remoteId); };
    peers.set(remoteId, pc);
    return pc;
  };

  return {
    async reconcile(roster, localEnabled) {
      const targets = new Set(meshTargets(roster, opts.localClientId, localEnabled));
      // 不要になった接続を閉じる
      for (const id of [...peers.keys()]) if (!targets.has(id)) drop(id);
      // 新規 target を張る。initiator(小さい clientID)だけが offer を送る。answerer は offer を待つ。
      for (const remoteId of targets) {
        if (peers.has(remoteId)) continue;
        const pc = ensurePeer(remoteId);
        if (isInitiator(opts.localClientId, remoteId)) {
          const sdp = await pc.createOfferSDP();
          opts.sendSignal({ to: remoteId, from: opts.localClientId, kind: 'offer', sdp, nonce: nonce++ });
        }
      }
    },
    async handleSignal(msg) {
      if (msg.kind === 'offer') {
        // answerer 側: peer を用意して answer を返す。
        const pc = ensurePeer(msg.from);
        const sdp = await pc.acceptOfferCreateAnswerSDP(msg.sdp);
        opts.sendSignal({ to: msg.from, from: opts.localClientId, kind: 'answer', sdp, nonce: nonce++ });
      } else {
        // initiator 側: 自分が作った peer に answer を流し込む。
        const pc = peers.get(msg.from);
        if (pc) await pc.acceptAnswer(msg.sdp);
      }
    },
    broadcast(p) {
      for (const pc of peers.values()) pc.send(p);
    },
    destroy() {
      for (const id of [...peers.keys()]) drop(id);
    },
  };
}
