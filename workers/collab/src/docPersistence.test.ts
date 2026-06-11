import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { saveDocBinary, loadDocBinary, clearDocBinary } from "./docPersistence";

describe("docPersistence（チャンク永続化）", () => {
  it("小さいバイナリを保存→復元できる", async () => {
    const storage = makeFakeStorage();
    const doc = new Y.Doc();
    doc.getArray("partyMembers").push([newMember("MT")]);
    const bin = Y.encodeStateAsUpdate(doc);
    await saveDocBinary(storage, bin);
    const back = await loadDocBinary(storage);
    expect(back).not.toBeNull();
    expect([...back!]).toEqual([...bin]);
  });

  it("128KiB を超えるバイナリも複数チャンクで往復できる", async () => {
    const storage = makeFakeStorage();
    const big = new Uint8Array(300 * 1024).map((_, i) => i % 251);
    await saveDocBinary(storage, big);
    const back = await loadDocBinary(storage);
    expect(back).not.toBeNull();
    expect(back!.length).toBe(big.length);
    expect([...back!.slice(0, 10)]).toEqual([...big.slice(0, 10)]);
    expect([...back!.slice(-10)]).toEqual([...big.slice(-10)]);
  });

  it("保存が無ければ null（初回ロード判定に使う）", async () => {
    const storage = makeFakeStorage();
    expect(await loadDocBinary(storage)).toBeNull();
  });

  it("clear 後は null（失効時の破棄）", async () => {
    const storage = makeFakeStorage();
    await saveDocBinary(storage, new Uint8Array([1, 2, 3]));
    await clearDocBinary(storage);
    expect(await loadDocBinary(storage)).toBeNull();
  });

  it("再保存で古いチャンクが残らない（大→小で末尾が混ざらない）", async () => {
    const storage = makeFakeStorage();
    await saveDocBinary(storage, new Uint8Array(250 * 1024).fill(7));
    await saveDocBinary(storage, new Uint8Array([9, 9, 9]));
    const back = await loadDocBinary(storage);
    expect([...back!]).toEqual([9, 9, 9]);
  });
});

function newMember(id: string) {
  const m = new Y.Map();
  m.set("id", id);
  return m;
}

// DurableObjectStorage の put(batch)/get/list/delete の最小フェイク。
function makeFakeStorage() {
  const map = new Map<string, unknown>();
  return {
    async put(a: any, b?: any) {
      if (typeof a === "string") map.set(a, b);
      else for (const [k, v] of Object.entries(a)) map.set(k, v);
    },
    async get(key: string) {
      return map.has(key) ? (map.get(key) as any) : undefined;
    },
    async list({ prefix }: { prefix: string }) {
      const out = new Map<string, unknown>();
      for (const [k, v] of map) if (k.startsWith(prefix)) out.set(k, v);
      return out;
    },
    async delete(keys: string | string[]) {
      for (const k of Array.isArray(keys) ? keys : [keys]) map.delete(k);
    },
  } as any;
}
