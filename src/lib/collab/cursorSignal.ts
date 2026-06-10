// ④-b-2: signaling を既存 WS awareness に相乗りさせる薄いラッパ(新 DO/依存ゼロ)。
// 自分宛の SignalMsg だけを購読コールバックし、confirm 後は clear で SDP を残さない(プライバシー)。
import type { AwarenessLike } from './presence';
import { isForMe, type SignalMsg } from './cursorTransport';

export interface SignalHandle {
  send(msg: SignalMsg): void;
  clear(): void;
  stop(): void;
}

export function wireSignal(
  awareness: AwarenessLike,
  onSignal: (msg: SignalMsg) => void,
): SignalHandle {
  const seen = new Set<string>(); // from:kind:nonce 重複発火を防ぐ(awareness は同 state を再ブロードキャストしうる)
  const handler = () => {
    const states = awareness.getStates();
    for (const [clientId, st] of states) {
      if (clientId === awareness.clientID) continue;
      const sig = (st as { signal?: SignalMsg } | undefined)?.signal;
      if (!sig || !isForMe(sig, awareness.clientID)) continue;
      const key = `${sig.from}:${sig.kind}:${sig.nonce}`;
      if (seen.has(key)) continue;
      seen.add(key);
      onSignal(sig);
    }
  };
  awareness.on('change', handler);
  return {
    send(msg) { awareness.setLocalStateField('signal', msg); },
    clear() { awareness.setLocalStateField('signal', null); },
    stop() { awareness.off('change', handler); },
  };
}
