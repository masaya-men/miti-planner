// src/lib/collab/planUndoManager.ts
import * as Y from "yjs";

/**
 * 共同編集の CRDT 対応 Undo/Redo(②-c)。
 * Y.UndoManager を trackedOrigins=['local'] で生成し、**自分の操作だけ**を Undo スタックに積む。
 * リモート(origin=provider オブジェクト)の変更は捕捉しない＝他人の編集を巻き戻さない。
 * scope は solo 履歴と同じ 5 トップレベル Y 型を呼び出し側が渡す(memos/meta は対象外)。
 * captureTimeout=0 で 1 transaction=1 Undo 単位(solo の 1 操作=1 履歴と同等・連打でまとめ過ぎない)。
 */
export interface PlanUndoManager {
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  destroy(): void;
}

export function createPlanUndoManager(
  scope: Y.AbstractType<unknown>[],
  onChange: (canUndo: boolean, canRedo: boolean) => void,
): PlanUndoManager {
  const um = new Y.UndoManager(scope, {
    trackedOrigins: new Set(["local"]),
    captureTimeout: 0,
  });
  const notify = () => onChange(um.canUndo(), um.canRedo());
  um.on("stack-item-added", notify);
  um.on("stack-item-popped", notify);
  um.on("stack-cleared", notify);
  return {
    undo: () => { um.undo(); },
    redo: () => { um.redo(); },
    canUndo: () => um.canUndo(),
    canRedo: () => um.canRedo(),
    destroy: () => {
      um.off("stack-item-added", notify);
      um.off("stack-item-popped", notify);
      um.off("stack-cleared", notify);
      um.destroy();
    },
  };
}
