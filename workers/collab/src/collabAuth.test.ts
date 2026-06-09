import { fetchMock } from "cloudflare:test";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { verifyToken } from "./collabAuth";

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
