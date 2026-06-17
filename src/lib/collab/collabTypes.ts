import type { AppliedMitigation, TimelineEvent, Phase, Label } from "../../types";
import type { PlanArrayKey, AASettings, BatchOp } from "./yjsPlanData";

/**
 * 共同編集の操作を遅延チャンク(collabProvider)へ委譲する関数束。
 * store はこのインタフェース型のみ参照し yjs を実行時 import しない(遅延ロード境界)。
 */
export interface CollabHandlers {
  // ②-a(mitigations 専用・無改変)
  add: (m: AppliedMitigation) => void;
  remove: (id: string) => void;
  updateTime: (id: string, newTime: number) => void;
  // ②-b-1 汎用(events/phases/labels/memos の id 単位 delta)
  // generic: 完全な型付きオブジェクト(TimelineEvent 等)も部分フィールドのリテラル({id,endTime})も受ける。
  upsertItems: <T extends { id: string }>(key: PlanArrayKey, items: T[]) => void;
  removeItems: (key: PlanArrayKey, ids: string[]) => void;
  // planMeta スカラー
  setMeta: (
    field: "currentLevel" | "aaSettings" | "schAetherflowPatterns",
    value: number | AASettings | Record<string, 1 | 2>,
  ) => void;
  // バルク(FFLogs 取込: events/phases/labels 全置換 + mitigations クリア・1 transaction)
  importBulk: (events: TimelineEvent[], phases?: Phase[], labels?: Label[]) => void;
  // ②-b-2: 複数キー(partyMembers + timelineMitigations 等)を 1 transaction で原子的に反映。
  // ジョブ変更カスケード(メンバー更新 + その mitigations 入替)が途中状態で相手画面を壊さないため。
  batch: (ops: BatchOp[]) => void;
  // ②-c: CRDT undo/redo(per-user・collabProvider の Y.UndoManager に委譲)
  undo: () => void;
  redo: () => void;
}
