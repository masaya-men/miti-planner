import type { AppliedMitigation, TimelineEvent, Phase, Label } from "../../types";
import type { PlanArrayKey, AASettings } from "./yjsPlanData";

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
  upsertItems: (key: PlanArrayKey, items: Array<{ id: string }>) => void;
  removeItems: (key: PlanArrayKey, ids: string[]) => void;
  // planMeta スカラー
  setMeta: (
    field: "currentLevel" | "aaSettings" | "schAetherflowPatterns",
    value: number | AASettings | Record<string, 1 | 2>,
  ) => void;
  // バルク(FFLogs 取込: events/phases/labels 全置換 + mitigations クリア・1 transaction)
  importBulk: (events: TimelineEvent[], phases?: Phase[], labels?: Label[]) => void;
}
