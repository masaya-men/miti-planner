// ④-b-2: PeerConnectionLike をブラウザ標準 RTCPeerConnection で実装する薄いアダプタ。
// non-trickle: ICE gathering 完了まで待ち、candidate 込みの完全 SDP を返す(signaling 回数を最小化)。
// datachannel は unreliable/unordered(カーソルは最新位置のみ意味があり取りこぼし無害)。
import type { PeerConnectionLike, CursorPacket } from './cursorMesh';

// STUN は NAT 越え用の公開サーバ(Google・無料・中継しないので IP は STUN に渡るが媒体は流れない)。
const ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];

/** ICE gathering 完了を待って完全な SDP を得る(non-trickle)。 */
function waitGatheringComplete(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const check = () => {
      if (pc.iceGatheringState === 'complete') {
        pc.removeEventListener('icegatheringstatechange', check);
        resolve();
      }
    };
    pc.addEventListener('icegatheringstatechange', check);
  });
}

export function createRealPeer(): PeerConnectionLike {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  let channel: RTCDataChannel | null = null;

  const self: PeerConnectionLike = {
    ondata: null,
    onclosed: null,
    async createOfferSDP() {
      const ch = pc.createDataChannel('cursor', { ordered: false, maxRetransmits: 0 });
      bindChannel(ch);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitGatheringComplete(pc);
      return pc.localDescription!.sdp;
    },
    async acceptOfferCreateAnswerSDP(remoteSdp) {
      pc.ondatachannel = (e) => bindChannel(e.channel);
      await pc.setRemoteDescription({ type: 'offer', sdp: remoteSdp });
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await waitGatheringComplete(pc);
      return pc.localDescription!.sdp;
    },
    async acceptAnswer(remoteSdp) {
      await pc.setRemoteDescription({ type: 'answer', sdp: remoteSdp });
    },
    send(packet) {
      if (channel && channel.readyState === 'open') channel.send(JSON.stringify(packet));
    },
    close() {
      try { channel?.close(); } catch { /* noop */ }
      try { pc.close(); } catch { /* noop */ }
    },
  };

  function bindChannel(ch: RTCDataChannel) {
    channel = ch;
    ch.onmessage = (e) => {
      try { self.ondata?.(JSON.parse(e.data as string) as CursorPacket); } catch { /* 壊れたパケットは無視 */ }
    };
    ch.onclose = () => self.onclosed?.();
  }

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'failed' || pc.connectionState === 'closed') self.onclosed?.();
  };

  return self;
}
