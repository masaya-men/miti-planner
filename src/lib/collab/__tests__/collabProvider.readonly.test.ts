import { describe, it, expect, vi, beforeEach } from "vitest";
import * as Y from "yjs";
import { useMitigationStore } from "../../../store/useMitigationStore";
import { applyRoomToStore } from "../collabProvider";
import { setMetaField, META_CONTENT_ID, META_OWNER_LABEL, MITIGATIONS_KEY, PARTY_MEMBERS_KEY } from "../yjsPlanData";
import type { AppliedMitigation, PartyMember } from "../../../types";

const mit = (id: string): AppliedMitigation => ({ id, mitigationId: "rampart_pld", time: 30, duration: 20, ownerId: "MT" } as AppliedMitigation);
const member = (id: string): PartyMember => ({ id, jobId: "war", role: "tank", stats: {}, computedValues: {}, mode: "tank" } as unknown as PartyMember);

describe("applyRoomToStore(読み取り専用 sync 反映)", () => {
  beforeEach(() => useMitigationStore.setState({
    _collabActive: false, _collabHandlers: null,
    timelineMitigations: [], timelineEvents: [], phases: [], labels: [], memos: [], partyMembers: [],
  }));

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

  // #7 データ安全(絶対に破壊しない): 空の部屋で手元の中身が消えてはいけない。
  it("オーナー・空の部屋・手元に中身あり → 手元を消さず、部屋を手元から再シードする", () => {
    useMitigationStore.setState({ timelineMitigations: [mit("a1"), mit("a2")], partyMembers: [member("MT")] });
    const doc = new Y.Doc(); // 完全に空(seed 失敗/保存前再接続を模擬)
    applyRoomToStore(doc, { readOnly: false, handlers: {} as any });
    // 手元データは保持される(空で上書きされない)。
    expect(useMitigationStore.getState().timelineMitigations.map(m => m.id)).toEqual(["a1", "a2"]);
    // 部屋は手元から再シードされる(id 単位・増殖なし=2件)。
    expect(doc.getArray(MITIGATIONS_KEY).length).toBe(2);
    expect(doc.getArray(PARTY_MEMBERS_KEY).length).toBe(1);
  });

  it("オーナー・部屋に中身あり → 通常どおり部屋スナップショットを適用(手元を上書き)", () => {
    useMitigationStore.setState({ timelineMitigations: [mit("local-only")] });
    const doc = new Y.Doc();
    doc.getArray(MITIGATIONS_KEY).push([(() => { const y = new Y.Map(); y.set("id", "room1"); y.set("mitigationId", "rampart_pld"); y.set("time", 10); y.set("duration", 20); y.set("ownerId", "MT"); return y; })()]);
    applyRoomToStore(doc, { readOnly: false, handlers: {} as any });
    // 部屋が真実 → 手元は部屋の内容で置き換わる(空でないので再シードしない)。
    expect(useMitigationStore.getState().timelineMitigations.map(m => m.id)).toEqual(["room1"]);
  });

  it("オーナー・空の部屋・手元も空 → 再シードせず空のまま(誤った復活をしない)", () => {
    const doc = new Y.Doc();
    applyRoomToStore(doc, { readOnly: false, handlers: {} as any });
    expect(useMitigationStore.getState().timelineMitigations).toEqual([]);
    expect(doc.getArray(MITIGATIONS_KEY).length).toBe(0);
  });
});
