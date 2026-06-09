import { fetchMock } from "cloudflare:test";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { verifyToken, authorizeConnection, isEditorState, EDITOR_UID_HEADER, TOKEN_PARAM } from "./collabAuth";

const BASE = "https://lopoly.app";

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});
afterEach(() => fetchMock.assertNoPendingInterceptors());

describe("verifyToken (受付係 verify 委譲)", () => {
  it("valid:true → uid を返す", async () => {
    fetchMock.get(BASE)
      .intercept({ path: "/api/collab/verify", method: "POST" })
      .reply(200, { valid: true, uid: "user-1" });
    expect(await verifyToken(BASE, "sec", "tok")).toBe("user-1");
  });

  it("valid:false → null", async () => {
    fetchMock.get(BASE)
      .intercept({ path: "/api/collab/verify", method: "POST" })
      .reply(200, { valid: false });
    expect(await verifyToken(BASE, "sec", "tok")).toBeNull();
  });

  it("5xx(障害) → null(fail-closed)", async () => {
    fetchMock.get(BASE)
      .intercept({ path: "/api/collab/verify", method: "POST" })
      .reply(500, "boom");
    expect(await verifyToken(BASE, "sec", "tok")).toBeNull();
  });

  it("空トークン → fetch せず null", async () => {
    // インターセプタを登録しない = fetch が走れば assertNoPendingInterceptors 前に例外。
    expect(await verifyToken(BASE, "sec", "")).toBeNull();
  });
});

describe("authorizeConnection (接続認可・信頼ヘッダ)", () => {
  const reqWith = (token: string | null, extra: Record<string, string> = {}) => {
    const url = token === null
      ? "https://w.dev/parties/room/r1"
      : `https://w.dev/parties/room/r1?${TOKEN_PARAM}=${encodeURIComponent(token)}`;
    return new Request(url, { headers: extra });
  };

  it("正トークン → 信頼ヘッダに uid を付ける", async () => {
    const req = reqWith("good");
    await authorizeConnection(req, async () => "user-9");
    expect(req.headers.get(EDITOR_UID_HEADER)).toBe("user-9");
  });

  it("トークン無し(viewer) → 信頼ヘッダ無し", async () => {
    const req = reqWith(null);
    await authorizeConnection(req, async () => "should-not-call");
    expect(req.headers.get(EDITOR_UID_HEADER)).toBeNull();
  });

  it("検証失敗(null) → fail-closed で信頼ヘッダ無し", async () => {
    const req = reqWith("bad");
    await authorizeConnection(req, async () => null);
    expect(req.headers.get(EDITOR_UID_HEADER)).toBeNull();
  });

  it("クライアント由来の x-collab-uid を必ず除去(詐称防止)", async () => {
    // 偽ヘッダを付けて未トークンで接続 → 除去されて viewer のまま。
    const req = reqWith(null, { [EDITOR_UID_HEADER]: "spoofed" });
    await authorizeConnection(req, async () => null);
    expect(req.headers.get(EDITOR_UID_HEADER)).toBeNull();
  });
});

describe("isEditorState", () => {
  it("collabEditor があれば true", () => {
    expect(isEditorState({ collabEditor: "u1" })).toBe(true);
  });
  it("無ければ false", () => {
    expect(isEditorState(undefined)).toBe(false);
    expect(isEditorState({})).toBe(false);
  });
});
