import type { AppliedMitigation } from "../../types";

/**
 * 共同編集の操作を遅延チャンク(collabProvider)へ委譲するための関数束。
 * store はこのインタフェース型のみ参照し、yjs を実行時 import しない(遅延ロード境界)。
 */
export interface CollabHandlers {
  add: (m: AppliedMitigation) => void;
  remove: (id: string) => void;
  updateTime: (id: string, newTime: number) => void;
}
