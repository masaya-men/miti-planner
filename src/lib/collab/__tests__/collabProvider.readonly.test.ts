import { describe, it, expect, vi, beforeEach } from "vitest";
import * as Y from "yjs";
import { useMitigationStore } from "../../../store/useMitigationStore";
import { usePlanStore } from "../../../store/usePlanStore";
import { applyRoomToStore } from "../collabProvider";
import { setMetaField, META_CONTENT_ID, META_OWNER_LABEL, MITIGATIONS_KEY, PARTY_MEMBERS_KEY } from "../yjsPlanData";
import type { AppliedMitigation, PartyMember } from "../../../types";

const mit = (id: string): AppliedMitigation => ({ id, mitigationId: "rampart_pld", time: 30, duration: 20, ownerId: "MT" } as AppliedMitigation);
const member = (id: string): PartyMember => ({ id, jobId: "war", role: "tank", stats: {}, computedValues: {}, mode: "tank" } as unknown as PartyMember);

describe("applyRoomToStore(読み取り専用 sync 反映)", () => {
  beforeEach(() => {
    useMitigationStore.setState({
      _collabActive: false, _collabHandlers: null, _loadedPlanId: null,
      timelineMitigations: [], timelineEvents: [], phases: [], labels: [], memos: [], partyMembers: [],
    });
    usePlanStore.setState({ plans: [] } as any);
  });

  it("readOnly=true は enterCollabMode を呼ばない(編集を Y に流さない)", () => {
    const doc = new Y.Doc();
    const spy = vi.spyOn(useMitigationStore.getState(), "enterCollabMode");
    applyRoomToStore(doc, { readOnly: true, roomToken: "r1", handlers: {} as any });
    expect(spy).not.toHaveBeenCalled();
    expect(useMitigationStore.getState()._collabActive).toBe(false);
    spy.mockRestore();
  });

  it("readOnly=false は enterCollabMode を呼ぶ(従来オーナー経路)", () => {
    const doc = new Y.Doc();
    const spy = vi.spyOn(useMitigationStore.getState(), "enterCollabMode");
    applyRoomToStore(doc, { readOnly: false, roomToken: "r1", handlers: {} as any });
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("contentId を planMeta から読みコールバックに渡す", () => {
    const doc = new Y.Doc();
    setMetaField(doc, META_CONTENT_ID, "m4s");
    const onContentId = vi.fn();
    applyRoomToStore(doc, { readOnly: true, roomToken: "r1", handlers: {} as any, onContentId });
    expect(onContentId).toHaveBeenCalledWith("m4s");
  });

  it("ownerLabel を planMeta から読みコールバックに渡す", () => {
    const doc = new Y.Doc();
    setMetaField(doc, META_OWNER_LABEL, "土曜固定P");
    const onOwnerLabel = vi.fn();
    applyRoomToStore(doc, { readOnly: true, roomToken: "r1", handlers: {} as any, onOwnerLabel });
    expect(onOwnerLabel).toHaveBeenCalledWith("土曜固定P");
  });

  // #7 データ安全(絶対に破壊しない): 空の部屋で手元の中身が消えてはいけない。
  it("オーナー・空の部屋・手元に中身あり・持ち主が一致 → 手元を消さず、部屋を手元から再シードする", () => {
    useMitigationStore.setState({
      timelineMitigations: [mit("a1"), mit("a2")],
      partyMembers: [member("MT")],
      _loadedPlanId: "plan1",
    });
    usePlanStore.setState({ plans: [{ id: "plan1", activeCollabRoomToken: "room1" }] as any });
    const doc = new Y.Doc(); // 完全に空(seed 失敗/保存前再接続を模擬)
    applyRoomToStore(doc, { readOnly: false, roomToken: "room1", handlers: {} as any });
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
    applyRoomToStore(doc, { readOnly: false, roomToken: "r1", handlers: {} as any });
    // 部屋が真実 → 手元は部屋の内容で置き換わる(空でないので再シードしない)。
    expect(useMitigationStore.getState().timelineMitigations.map(m => m.id)).toEqual(["room1"]);
  });

  it("オーナー・空の部屋・手元も空 → 再シードせず空のまま(誤った復活をしない)", () => {
    const doc = new Y.Doc();
    applyRoomToStore(doc, { readOnly: false, roomToken: "r1", handlers: {} as any });
    expect(useMitigationStore.getState().timelineMitigations).toEqual([]);
    expect(doc.getArray(MITIGATIONS_KEY).length).toBe(0);
  });

  // データ安全(2026-08-07監査): 手元データの持ち主が接続先の部屋と一致しないときの新規ガード。
  it("オーナー・空の部屋・手元に中身あり・持ち主が不一致 → 部屋への再シードをスキップ(手元は部屋の真のデータで上書きされる)", () => {
    useMitigationStore.setState({
      timelineMitigations: [mit("a1"), mit("a2")],
      partyMembers: [member("MT")],
      _loadedPlanId: "plan1",
    });
    usePlanStore.setState({ plans: [{ id: "plan1", activeCollabRoomToken: "other-room" }] as any });
    const doc = new Y.Doc();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    applyRoomToStore(doc, { readOnly: false, roomToken: "room1", handlers: {} as any });
    // 部屋へは書き込まれない(誤った持ち主のデータを他人の部屋へ流さない)。
    expect(doc.getArray(MITIGATIONS_KEY).length).toBe(0);
    // 設計書(docs/superpowers/specs/2026-08-07-collab-reseed-trust-boundary-design.md:123,168)の通り、
    // ガードが止めるのは「手元→部屋への書き込み」だけ。直後の apply-all は無条件に走るため、
    // 手元は部屋の真のデータ(この場合は空)で上書きされる = plan1 の内容は画面から消える。
    // これは正しい安全側動作: room1 の編集画面に plan1 の中身を出したままにする方が、
    // 誤ってそれを編集→room1 へ送信してしまう新たな汚染経路になり危険。plan1 の実データ自体は
    // usePlanStore.plans に温存されており、ここで失われるのは表示上の一時状態のみ。
    expect(useMitigationStore.getState().timelineMitigations).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("持ち主が不一致でも enterCollabMode は呼ばれる(共同編集自体は始まる。部屋の真のデータで手元は直後に上書きされる)", () => {
    useMitigationStore.setState({
      timelineMitigations: [mit("a1")],
      _loadedPlanId: "plan1",
    });
    usePlanStore.setState({ plans: [{ id: "plan1", activeCollabRoomToken: "other-room" }] as any });
    const doc = new Y.Doc();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const spy = vi.spyOn(useMitigationStore.getState(), "enterCollabMode");
    // enterCollabMode 内部の set() は zustand のシャロー merge で state を丸ごと差し替えるため、
    // このプロパティを一度でも spy 化すると、その参照がこのテストファイルの残り全体の state に
    // 伝播し続ける(mockRestore は spy 作成時点の古い state オブジェクトにしか効かない)。
    // 前段のテスト(手元一致/不一致の各ケース)がすでに同じ関数を実 1 回ずつ呼んでいるため、
    // このスパイにも他テスト分の呼び出しが混入している。mockClear() でこのテスト自身の
    // 呼び出しだけに絞る(呼び出し「有無・回数」自体の検証意図は変えない)。
    spy.mockClear();
    applyRoomToStore(doc, { readOnly: false, roomToken: "room1", handlers: {} as any });
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
