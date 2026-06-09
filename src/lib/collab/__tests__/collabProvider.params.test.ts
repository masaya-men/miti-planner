import { describe, it, expect } from "vitest";
import { buildCollabParams } from "../collabProvider";

describe("buildCollabParams (provider params)", () => {
  it("ログイン時 → token を含む", async () => {
    expect(await buildCollabParams(async () => "id-tok")).toEqual({ token: "id-tok" });
  });
  it("未ログイン(null) → 空(viewer)", async () => {
    expect(await buildCollabParams(async () => null)).toEqual({});
  });
  it("取得失敗 → 空(viewer・例外を飲む)", async () => {
    expect(await buildCollabParams(async () => { throw new Error("no auth"); })).toEqual({});
  });
});
