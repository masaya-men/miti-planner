import { create } from "zustand";

/** ⑤-3b/⑤-3c: ジョイナー一時状態（SavedPlan に紐づかない）。localStorage 非永続。 */
interface CollabJoinerSession {
  roomToken: string | null;
  contentId: string | null;
  /** ⑤-3c: オーナー設定の部屋ラベル（バナー表示用）。seed 由来。 */
  ownerLabel: string | null;
  /** ⑤-3c: 編集可否（ログイン && 部屋ごと同意）。Timeline の readOnly 判定が参照。 */
  canEdit: boolean;
  enter: (roomToken: string) => void;
  setContentId: (contentId: string | undefined) => void;
  setOwnerLabel: (label: string | undefined) => void;
  setCanEdit: (v: boolean) => void;
  clear: () => void;
}

export const useCollabJoinerSession = create<CollabJoinerSession>((set) => ({
  roomToken: null,
  contentId: null,
  ownerLabel: null,
  canEdit: false,
  enter: (roomToken) => set({ roomToken, contentId: null, ownerLabel: null, canEdit: false }),
  setContentId: (contentId) => set({ contentId: contentId ?? null }),
  setOwnerLabel: (label) => set({ ownerLabel: label ?? null }),
  setCanEdit: (v) => set({ canEdit: v }),
  clear: () => set({ roomToken: null, contentId: null, ownerLabel: null, canEdit: false }),
}));
