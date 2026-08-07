import { describe, it, expect, vi } from "vitest";
import { joinerView, computeCanEdit, rehydrateThenClearReadonly, shouldRedirectToOwnerEditor, canOpenOwnerEditor } from "../CollabJoinerPage";

describe("joinerView(状態 → 表示種別)", () => {
  it("未同期は connecting", () => {
    expect(joinerView({ synced: false, invalid: false, full: false })).toBe("connecting");
  });
  it("invalid(失効/不存在)は invalid", () => {
    expect(joinerView({ synced: true, invalid: true, full: false })).toBe("invalid");
  });
  it("満員は full", () => {
    expect(joinerView({ synced: false, invalid: false, full: true })).toBe("full");
  });
  it("同期済みは sheet", () => {
    expect(joinerView({ synced: true, invalid: false, full: false })).toBe("sheet");
  });
  it("full は invalid/connecting より優先", () => {
    expect(joinerView({ synced: true, invalid: true, full: true })).toBe("full");
  });
  it("revoked は全てに優先(オーナーが失効=終了)", () => {
    expect(joinerView({ synced: true, invalid: true, full: true, revoked: true })).toBe("revoked");
    // revoked 未指定(従来呼び出し)は従来どおり
    expect(joinerView({ synced: true, invalid: false, full: false })).toBe("sheet");
  });
});

describe("computeCanEdit", () => {
  it("ログイン && 同意 で true", () => {
    expect(computeCanEdit(true, true)).toBe(true);
  });
  it("未ログイン or 未同意 は false", () => {
    expect(computeCanEdit(false, true)).toBe(false);
    expect(computeCanEdit(true, false)).toBe(false);
    expect(computeCanEdit(false, false)).toBe(false);
  });
});

// 退室 cleanup: rehydrate(自分のソロ state を store へ戻す)→ 完了後 readonly 解除。
// zustand persist は同期 storage のとき .finally を持たない最小 thenable を返すため、
// 素朴に `rehydrate()?.finally(...)` するとジョイナーページ離脱で crash する(本番/StrictMode)。
describe("rehydrateThenClearReadonly", () => {
  it("rehydrate が .finally を持たない最小 thenable(同期 storage)でも clearReadonly を呼ぶ", async () => {
    const minimalThenable = { then: (cb: () => void) => { cb(); } }; // .finally なし(zustand 同期版を模倣)
    const clear = vi.fn();
    await rehydrateThenClearReadonly(() => minimalThenable, clear);
    expect(clear).toHaveBeenCalledTimes(1);
  });
  it("rehydrate が undefined を返しても clearReadonly を呼ぶ", async () => {
    const clear = vi.fn();
    await rehydrateThenClearReadonly(() => undefined, clear);
    expect(clear).toHaveBeenCalledTimes(1);
  });
  it("rehydrate が本物の Promise でも clearReadonly を呼ぶ", async () => {
    const clear = vi.fn();
    await rehydrateThenClearReadonly(() => Promise.resolve(), clear);
    expect(clear).toHaveBeenCalledTimes(1);
  });
  it("順序: clearReadonly は rehydrate の後", async () => {
    const order: string[] = [];
    await rehydrateThenClearReadonly(
      () => { order.push("rehydrate"); return undefined; },
      () => order.push("clear"),
    );
    expect(order).toEqual(["rehydrate", "clear"]);
  });
});

describe("shouldRedirectToOwnerEditor(オーナー判別結果 → リダイレクト要否)", () => {
  it("isOwner:true かつ planId があれば redirect:true", () => {
    expect(shouldRedirectToOwnerEditor({ isOwner: true, planId: "plan1" }))
      .toEqual({ redirect: true, planId: "plan1" });
  });
  it("isOwner:false は redirect:false", () => {
    expect(shouldRedirectToOwnerEditor({ isOwner: false })).toEqual({ redirect: false });
  });
  it("isOwner:true でも planId が無ければ redirect:false(安全側)", () => {
    expect(shouldRedirectToOwnerEditor({ isOwner: true })).toEqual({ redirect: false });
  });
  it("result が null(判別未完了/失敗)は redirect:false", () => {
    expect(shouldRedirectToOwnerEditor(null)).toEqual({ redirect: false });
  });
});

// ⑤-4 データ安全ガード。オーナー本人と判別できても、編集画面へ送ってよいのは
// 「プラン切替もデータロードも不要 = 作業ストアが既にそのプランを載せている」かつ
// 「Layout の自動接続(reconcileCollabForPlan)がまさにこの部屋へ繋ぎ直せる」ときだけ。
// 緩めると、別プランの内容が対象プランや**部屋そのもの**へ流れ込む(空上書き防御の再シード)。
describe("canOpenOwnerEditor(編集画面へ送ってよいか)", () => {
  const base = {
    planId: "plan1",
    roomToken: "tok7Qk2",
    currentPlanId: "plan1",
    uid: "uid-me",
    plan: { ownerId: "uid-me", activeCollabRoomToken: "tok7Qk2" },
  };

  it("現在のプラン = その部屋のプランで、自分が持ち主なら true", () => {
    expect(canOpenOwnerEditor(base)).toBe(true);
  });

  it("ローカルにそのプランが無ければ false(作業ストアの中身が別プランのまま紐付く事故を防ぐ)", () => {
    expect(canOpenOwnerEditor({ ...base, plan: undefined })).toBe(false);
  });

  it("いま別のプランを開いている(プラン切替が必要)なら false", () => {
    expect(canOpenOwnerEditor({ ...base, currentPlanId: "plan2" })).toBe(false);
    expect(canOpenOwnerEditor({ ...base, currentPlanId: null })).toBe(false);
  });

  it("ローカル plan のルームトークンがこの部屋と違う(失効/再発行で古い)なら false", () => {
    expect(canOpenOwnerEditor({ ...base, plan: { ownerId: "uid-me", activeCollabRoomToken: "old" } })).toBe(false);
    expect(canOpenOwnerEditor({ ...base, plan: { ownerId: "uid-me" } })).toBe(false); // collab OFF
  });

  it("ローカル plan の持ち主が自分でない(=Layout の isOwner が立たない)なら false", () => {
    expect(canOpenOwnerEditor({ ...base, plan: { ownerId: "uid-other", activeCollabRoomToken: "tok7Qk2" } })).toBe(false);
    expect(canOpenOwnerEditor({ ...base, uid: null })).toBe(false);
  });
});
