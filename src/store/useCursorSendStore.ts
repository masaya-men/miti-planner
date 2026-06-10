// ④-b-2: Timeline(yjs 非依存)→ collabProvider(遅延チャンク)へカーソル送信をブリッジ。
// collabProvider が setBroadcaster で送信関数を登録し、Timeline は broadcast を呼ぶだけ。
// これで Timeline は yjs/WebRTC を静的 import せずに済む(遅延境界を保つ)。
import { create } from 'zustand';
import type { CursorPacket } from '../lib/collab/cursorMesh';

interface CursorSendState {
  broadcaster: ((p: CursorPacket) => void) | null;
  localClientId: number | null;
  setBroadcaster: (fn: ((p: CursorPacket) => void) | null, clientId: number | null) => void;
  broadcast: (p: CursorPacket) => void;
}

export const useCursorSendStore = create<CursorSendState>((set, get) => ({
  broadcaster: null,
  localClientId: null,
  setBroadcaster: (fn, clientId) => set({ broadcaster: fn, localClientId: clientId }),
  broadcast: (p) => get().broadcaster?.(p),
}));
