import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { buildSeedDocFull } from "./yjsPlanData";

const SEED = {
  mitigations: [],
  partyMembers: ["MT", "ST", "H1", "H2", "D1", "D2", "D3", "D4"].map((id) => ({
    id, jobId: "pld", role: "tank",
  })),
};

describe("Yjs seed identity（列増殖の根本機序）", () => {
  it("JSON から組み直した seed は再起動のたび新 identity を生み、生存クライアントと合流して増殖する（バグ機序）", () => {
    const server1 = buildSeedDocFull(SEED);
    const client = new Y.Doc();
    Y.applyUpdate(client, Y.encodeStateAsUpdate(server1));
    expect(client.getArray("partyMembers").length).toBe(8);

    // ハイバネ復帰 = まっさら doc に JSON から再 seed（identity が変わる）
    const server2 = buildSeedDocFull(SEED);
    // 生きているクライアントが再同期 → 2 つの独立 doc が合流
    Y.applyUpdate(client, Y.encodeStateAsUpdate(server2));

    // content-blind 連結で同 id が二重化（= 列増殖の正体）
    expect(client.getArray("partyMembers").length).toBe(16);
  });

  it("バイナリを復元すれば identity が保たれ、再起動しても増えない（修正の原理）", () => {
    const server1 = buildSeedDocFull(SEED);
    const persisted = Y.encodeStateAsUpdate(server1); // onSave 相当
    const client = new Y.Doc();
    Y.applyUpdate(client, Y.encodeStateAsUpdate(server1));
    expect(client.getArray("partyMembers").length).toBe(8);

    // ハイバネ復帰 = バイナリから復元（identity 保持）
    const server2 = new Y.Doc();
    Y.applyUpdate(server2, persisted); // onLoad 相当（restore-from-binary）
    Y.applyUpdate(client, Y.encodeStateAsUpdate(server2));

    // 合流は no-op。増えない。
    expect(client.getArray("partyMembers").length).toBe(8);
  });
});
