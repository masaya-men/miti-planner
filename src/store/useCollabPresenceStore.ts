// ④-b-1: 部屋の参加者 roster を UI へ公開する store(非永続)。
// 遅延チャンク(collabProvider の wirePresence)が setRoster で更新し、
// ツールバーチップ/オーナーパネルが購読する。yjs 非依存(RosterEntry 型のみ参照)。
import { create } from 'zustand';
import type { RosterEntry } from '../lib/collab/presence';

interface CollabPresenceState {
  roster: RosterEntry[];
  setRoster: (roster: RosterEntry[]) => void;
  clear: () => void;
}

export const useCollabPresenceStore = create<CollabPresenceState>((set) => ({
  roster: [],
  setRoster: (roster) => set({ roster }),
  clear: () => set({ roster: [] }),
}));
