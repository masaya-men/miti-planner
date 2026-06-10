// ④-b-2: 受信カーソル(高頻度)。roster(低頻度)とは別 store。
import { create } from 'zustand';
import type { CursorPacket } from '../lib/collab/cursorMesh';

interface RemoteCursorsState {
  byClient: Record<number, { pos: CursorPacket['pos']; t: number }>;
  apply: (p: CursorPacket) => void;
  remove: (clientId: number) => void;
  clear: () => void;
}

export const useRemoteCursorsStore = create<RemoteCursorsState>((set, get) => ({
  byClient: {},
  apply: (p) => {
    const prev = get().byClient[p.clientId];
    if (prev && p.t <= prev.t) return; // 古い/同時刻パケットは破棄(isFresher と同義)
    set((s) => ({ byClient: { ...s.byClient, [p.clientId]: { pos: p.pos, t: p.t } } }));
  },
  remove: (clientId) => set((s) => {
    const next = { ...s.byClient }; delete next[clientId]; return { byClient: next };
  }),
  clear: () => set({ byClient: {} }),
}));
