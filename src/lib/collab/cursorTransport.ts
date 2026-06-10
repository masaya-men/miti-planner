// ④-b-2: P2P mesh の純粋ロジック(WebRTC/yjs 非依存)。誰と繋ぐか・誰が offer を作るか・宛先判定。
import type { RosterEntry } from './presence';

/** awareness の専用 `signal` フィールドに載せる番号交換メッセージ(non-trickle: SDP に ICE 同梱)。 */
export interface SignalMsg {
  to: number;        // 宛先 clientID
  from: number;      // 送信元 clientID
  kind: 'offer' | 'answer';
  sdp: string;       // ICE candidate を含む完全 SDP
  nonce: number;     // 再接続時に古い offer/answer を区別
}

/**
 * 自分が P2P を張るべき相手の clientID 集合。
 * local が OFF なら空(誰とも繋がない=IP を一切共有しない)。local が ON のとき、
 * roster で cursorEnabled な他者のみ(自分自身は除外)。
 */
export function meshTargets(
  roster: RosterEntry[],
  localClientId: number,
  localCursorEnabled: boolean,
): number[] {
  if (!localCursorEnabled) return [];
  return roster
    .filter((e) => e.clientId !== localClientId && e.cursorEnabled)
    .map((e) => e.clientId);
}

/** ペアのうち clientID が小さい側だけが offer を作る(両者同時 offer=glare を防ぐ決定的ルール)。 */
export function isInitiator(localClientId: number, remoteClientId: number): boolean {
  return localClientId < remoteClientId;
}

/** signal が自分宛か。 */
export function isForMe(msg: SignalMsg, localClientId: number): boolean {
  return msg.to === localClientId;
}
