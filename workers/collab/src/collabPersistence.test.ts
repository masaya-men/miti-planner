import { fetchMock } from "cloudflare:test";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { fetchSeed, postMitigations, type MitigationRecord } from "./collabPersistence";

const BASE = "https://lopoly.app";
const m = (id: string): MitigationRecord => ({ id, mitigationId: "rampart", time: 10, duration: 20, ownerId: "MT" });

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});
afterEach(() => fetchMock.assertNoPendingInterceptors());

describe("fetchSeed (seed 取得)", () => {
  it("live → mitigations と maxParticipants を返す", async () => {
    fetchMock.get(BASE)
      .intercept({ path: "/api/collab/load?roomToken=room-a", method: "GET" })
      .reply(200, { mitigations: [m("a")], maxParticipants: 4 });
    expect(await fetchSeed(BASE, "sec", "room-a")).toEqual({ mitigations: [m("a")], maxParticipants: 4 });
  });

  it("maxParticipants 欠落 → mitigations のみ(max は undefined)", async () => {
    fetchMock.get(BASE)
      .intercept({ path: "/api/collab/load?roomToken=room-a2", method: "GET" })
      .reply(200, { mitigations: [m("a")] });
    expect(await fetchSeed(BASE, "sec", "room-a2")).toEqual({ mitigations: [m("a")], maxParticipants: undefined });
  });

  it("墓標(deleted) → null(破壊保存ガードのため seed しない)", async () => {
    fetchMock.get(BASE)
      .intercept({ path: "/api/collab/load?roomToken=room-b", method: "GET" })
      .reply(200, { deleted: true });
    expect(await fetchSeed(BASE, "sec", "room-b")).toBeNull();
  });

  it("5xx(障害) → null", async () => {
    fetchMock.get(BASE)
      .intercept({ path: "/api/collab/load?roomToken=room-c", method: "GET" })
      .reply(500, "boom");
    expect(await fetchSeed(BASE, "sec", "room-c")).toBeNull();
  });

  it("roomToken を URL エンコードする", async () => {
    fetchMock.get(BASE)
      .intercept({ path: "/api/collab/load?roomToken=a%20b", method: "GET" })
      .reply(200, { mitigations: [], maxParticipants: 8 });
    expect(await fetchSeed(BASE, "sec", "a b")).toEqual({ mitigations: [], maxParticipants: 8 });
  });
});

describe("postMitigations (書き戻し)", () => {
  it("live → roomToken+mitigations を POST し 'ok'", async () => {
    let body: any = null;
    fetchMock.get(BASE)
      .intercept({ path: "/api/collab/save", method: "POST" })
      .reply(200, (opts) => { body = JSON.parse(opts.body as string); return { ok: true, version: 2 }; });
    expect(await postMitigations(BASE, "sec", "room-d", [m("x")])).toBe("ok");
    expect(body).toEqual({ roomToken: "room-d", mitigations: [m("x")] });
  });

  it("skipped(墓標応答) → 'skipped'", async () => {
    fetchMock.get(BASE)
      .intercept({ path: "/api/collab/save", method: "POST" })
      .reply(200, { skipped: "deleted" });
    expect(await postMitigations(BASE, "sec", "room-e", [])).toBe("skipped");
  });

  it("5xx → 'error'", async () => {
    fetchMock.get(BASE)
      .intercept({ path: "/api/collab/save", method: "POST" })
      .reply(503, "down");
    expect(await postMitigations(BASE, "sec", "room-f", [])).toBe("error");
  });
});
