import { describe, it, expect, vi, beforeEach } from "vitest";
import * as Y from "yjs";
import { useMitigationStore } from "../../../store/useMitigationStore";
import { applyRoomToStore } from "../collabProvider";
import { setMetaField, META_CONTENT_ID, META_OWNER_LABEL } from "../yjsPlanData";

describe("applyRoomToStore(読み取り専用 sync 反映)", () => {
  beforeEach(() => useMitigationStore.setState({ _collabActive: false, _collabHandlers: null, timelineMitigations: [] }));

  it("readOnly=true は enterCollabMode を呼ばない(編集を Y に流さない)", () => {
    const doc = new Y.Doc();
    const spy = vi.spyOn(useMitigationStore.getState(), "enterCollabMode");
    applyRoomToStore(doc, { readOnly: true, handlers: {} as any });
    expect(spy).not.toHaveBeenCalled();
    expect(useMitigationStore.getState()._collabActive).toBe(false);
    spy.mockRestore();
  });

  it("readOnly=false は enterCollabMode を呼ぶ(従来オーナー経路)", () => {
    const doc = new Y.Doc();
    const spy = vi.spyOn(useMitigationStore.getState(), "enterCollabMode");
    applyRoomToStore(doc, { readOnly: false, handlers: {} as any });
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("contentId を planMeta から読みコールバックに渡す", () => {
    const doc = new Y.Doc();
    setMetaField(doc, META_CONTENT_ID, "m4s");
    const onContentId = vi.fn();
    applyRoomToStore(doc, { readOnly: true, handlers: {} as any, onContentId });
    expect(onContentId).toHaveBeenCalledWith("m4s");
  });

  it("ownerLabel を planMeta から読みコールバックに渡す", () => {
    const doc = new Y.Doc();
    setMetaField(doc, META_OWNER_LABEL, "土曜固定P");
    const onOwnerLabel = vi.fn();
    applyRoomToStore(doc, { readOnly: true, handlers: {} as any, onOwnerLabel });
    expect(onOwnerLabel).toHaveBeenCalledWith("土曜固定P");
  });
});
