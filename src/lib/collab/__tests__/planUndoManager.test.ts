// src/lib/collab/__tests__/planUndoManager.test.ts
import { describe, it, expect, vi } from "vitest";
import * as Y from "yjs";
import { appliedToYMap, readMitigations, YJS_MITIGATIONS_KEY } from "../yjsMitigations";
import { createPlanUndoManager } from "../planUndoManager";
import type { AppliedMitigation } from "../../../types";

// 2 ドキュメント同期。リモート適用は origin=ソース doc(オブジェクト)になる
// ＝本番の「リモート=provider オブジェクト」を再現する(yjsMitigations.test と同型)。
function bridge(a: Y.Doc, b: Y.Doc) {
  a.on("update", (u: Uint8Array, origin: unknown) => { if (origin !== b) Y.applyUpdate(b, u, a); });
  b.on("update", (u: Uint8Array, origin: unknown) => { if (origin !== a) Y.applyUpdate(a, u, b); });
}
const sample = (over: Partial<AppliedMitigation> = {}): AppliedMitigation => ({
  id: "m1", mitigationId: "rampart_pld", time: 30, duration: 20, ownerId: "MT", ...over,
});
const scopeOf = (doc: Y.Doc) => [doc.getArray(YJS_MITIGATIONS_KEY)];

describe("planUndoManager", () => {
  it("自分(origin='local')の add を undo で取り消し、redo で復元する", () => {
    const doc = new Y.Doc();
    const arr = doc.getArray<Y.Map<unknown>>(YJS_MITIGATIONS_KEY);
    const um = createPlanUndoManager(scopeOf(doc), () => {});
    doc.transact(() => arr.push([appliedToYMap(sample({ id: "a1" }))]), "local");
    expect(readMitigations(doc).map((m) => m.id)).toEqual(["a1"]);
    um.undo();
    expect(readMitigations(doc)).toEqual([]);
    um.redo();
    expect(readMitigations(doc).map((m) => m.id)).toEqual(["a1"]);
    um.destroy();
  });

  it("他人(リモート origin)の編集は undo で絶対に巻き戻さない【核心の安全保証】", () => {
    const a = new Y.Doc(), b = new Y.Doc(); bridge(a, b);
    const arrA = a.getArray<Y.Map<unknown>>(YJS_MITIGATIONS_KEY);
    const arrB = b.getArray<Y.Map<unknown>>(YJS_MITIGATIONS_KEY);
    const um = createPlanUndoManager(scopeOf(a), () => {}); // A 視点の UndoManager

    a.transact(() => arrA.push([appliedToYMap(sample({ id: "mine" }))]), "local"); // 自分
    b.transact(() => arrB.push([appliedToYMap(sample({ id: "theirs", ownerId: "H1" }))]), "local"); // 他人(A には origin=b で届く)

    expect(readMitigations(a).map((m) => m.id).sort()).toEqual(["mine", "theirs"]);
    um.undo(); // 自分の "mine" だけ取り消される
    expect(readMitigations(a).map((m) => m.id)).toEqual(["theirs"]);
    um.destroy();
  });

  it("transact なし(origin=null)の変更は track しない", () => {
    const doc = new Y.Doc();
    const arr = doc.getArray<Y.Map<unknown>>(YJS_MITIGATIONS_KEY);
    const um = createPlanUndoManager(scopeOf(doc), () => {});
    arr.push([appliedToYMap(sample({ id: "untracked" }))]); // origin=null
    expect(um.canUndo()).toBe(false);
    um.undo();
    expect(readMitigations(doc).map((m) => m.id)).toEqual(["untracked"]); // 変化なし
    um.destroy();
  });

  it("1 transaction 内の複数変更(カスケード)は 1 回の undo でまとまって戻る", () => {
    const doc = new Y.Doc();
    const arr = doc.getArray<Y.Map<unknown>>(YJS_MITIGATIONS_KEY);
    doc.transact(() => arr.push([appliedToYMap(sample({ id: "keep" }))]), "local");
    const um = createPlanUndoManager(scopeOf(doc), () => {});
    doc.transact(() => {
      const i = readMitigations(doc).findIndex((m) => m.id === "keep");
      arr.delete(i, 1);
      arr.push([appliedToYMap(sample({ id: "new" }))]);
    }, "local");
    expect(readMitigations(doc).map((m) => m.id)).toEqual(["new"]);
    um.undo();
    expect(readMitigations(doc).map((m) => m.id)).toEqual(["keep"]); // 削除+追加が 1 回で戻る
    um.destroy();
  });

  it("captureTimeout=0: 別 transaction の2操作は別々の undo ステップになる", () => {
    const doc = new Y.Doc();
    const arr = doc.getArray<Y.Map<unknown>>(YJS_MITIGATIONS_KEY);
    const um = createPlanUndoManager(scopeOf(doc), () => {});
    doc.transact(() => arr.push([appliedToYMap(sample({ id: "first" }))]), "local");
    doc.transact(() => arr.push([appliedToYMap(sample({ id: "second" }))]), "local");
    um.undo(); // 2回目(second)だけ戻る
    expect(readMitigations(doc).map((m) => m.id)).toEqual(["first"]);
    um.undo(); // 1回目(first)も戻る
    expect(readMitigations(doc)).toEqual([]);
    um.destroy();
  });

  it("onChange が undo 可否の変化で呼ばれる", () => {
    const doc = new Y.Doc();
    const arr = doc.getArray<Y.Map<unknown>>(YJS_MITIGATIONS_KEY);
    const onChange = vi.fn();
    const um = createPlanUndoManager(scopeOf(doc), onChange);
    doc.transact(() => arr.push([appliedToYMap(sample())]), "local");
    expect(onChange).toHaveBeenCalledWith(true, false); // canUndo=true, canRedo=false
    onChange.mockClear();
    um.undo();
    expect(onChange).toHaveBeenCalledWith(false, true); // canUndo=false, canRedo=true
    um.destroy();
  });

  it("clear() 後は reseed相当の local 変更を undo できない(復元データを消さない・データ安全)", () => {
    const doc = new Y.Doc();
    const arr = doc.getArray<Y.Map<unknown>>(YJS_MITIGATIONS_KEY);
    const onChange = vi.fn();
    const um = createPlanUndoManager(scopeOf(doc), onChange);
    // reseed 相当: 復元データを local origin で投入
    doc.transact(() => arr.push([appliedToYMap(sample({ id: "restored" }))]), "local");
    expect(um.canUndo()).toBe(true);
    onChange.mockClear();
    um.clear(); // 初期同期後に呼ぶ想定
    expect(onChange).toHaveBeenCalledWith(false, false); // stack-cleared 経由でフラグ false
    expect(um.canUndo()).toBe(false);
    um.undo(); // no-op であるべき
    expect(readMitigations(doc).map((m) => m.id)).toEqual(["restored"]); // 復元データは生存
    um.destroy();
  });
});
