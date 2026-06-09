import { create } from "zustand";

/** ⑤-3b: ジョイナー読み取り専用ビューの一時状態(SavedPlan に紐づかない)。localStorage 非永続。 */
interface CollabJoinerSession {
  roomToken: string | null;
  contentId: string | null;
  enter: (roomToken: string) => void;
  setContentId: (contentId: string | undefined) => void;
  clear: () => void;
}

export const useCollabJoinerSession = create<CollabJoinerSession>((set) => ({
  roomToken: null,
  contentId: null,
  enter: (roomToken) => set({ roomToken, contentId: null }),
  setContentId: (contentId) => set({ contentId: contentId ?? null }),
  clear: () => set({ roomToken: null, contentId: null }),
}));
