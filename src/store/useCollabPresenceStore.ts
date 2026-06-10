// ④-b-1: 部屋の参加者 roster を UI へ公開する store(非永続)。
// ④-b-2: 自分の cursorEnabled(既定 OFF オプトイン)/ jobId / フォールバック状態を追加。
import { create } from 'zustand';
import type { RosterEntry } from '../lib/collab/presence';

interface CollabPresenceState {
  roster: RosterEntry[];
  setRoster: (roster: RosterEntry[]) => void;
  // ④-b-2: 自分のカーソル設定(IP 露出を伴うため既定 OFF)。
  cursorEnabled: boolean;
  jobId: string | null;
  cursorFallback: boolean; // P2P が張れず自分のカーソルが相手に出ていない状態(静かに通知)
  setCursorEnabled: (v: boolean) => void;
  setJobId: (id: string | null) => void;
  setCursorFallback: (v: boolean) => void;
  clear: () => void;
}

export const useCollabPresenceStore = create<CollabPresenceState>((set) => ({
  roster: [],
  setRoster: (roster) => set({ roster }),
  cursorEnabled: false,
  jobId: null,
  cursorFallback: false,
  setCursorEnabled: (v) => set({ cursorEnabled: v }),
  setJobId: (id) => set({ jobId: id }),
  setCursorFallback: (v) => set({ cursorFallback: v }),
  clear: () => set({ roster: [], cursorEnabled: false, jobId: null, cursorFallback: false }),
}));
