import { describe, it, expect, beforeEach } from "vitest";
import { useCollabJoinerSession } from "../useCollabJoinerSession";

describe("useCollabJoinerSession", () => {
  beforeEach(() => useCollabJoinerSession.getState().clear());
  it("enter で roomToken をセット・contentId は後から", () => {
    useCollabJoinerSession.getState().enter("tok123");
    expect(useCollabJoinerSession.getState().roomToken).toBe("tok123");
    expect(useCollabJoinerSession.getState().contentId).toBeNull();
    useCollabJoinerSession.getState().setContentId("m4s");
    expect(useCollabJoinerSession.getState().contentId).toBe("m4s");
  });
  it("setContentId(undefined) は null に正規化", () => {
    useCollabJoinerSession.getState().enter("tok");
    useCollabJoinerSession.getState().setContentId(undefined);
    expect(useCollabJoinerSession.getState().contentId).toBeNull();
  });
  it("clear で全リセット", () => {
    useCollabJoinerSession.getState().enter("tok");
    useCollabJoinerSession.getState().setContentId("x");
    useCollabJoinerSession.getState().clear();
    expect(useCollabJoinerSession.getState().roomToken).toBeNull();
    expect(useCollabJoinerSession.getState().contentId).toBeNull();
  });
});
