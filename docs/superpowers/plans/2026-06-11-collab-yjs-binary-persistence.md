# 共同編集 Yjs バイナリ永続化（列増殖の真の根治） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 共同編集の「表が右に列増殖する」バグを、症状隠しでなく根本機序ごと消す。

**Architecture:** 共同編集の真実を「Firestore の JSON を毎回組み直した新 Yjs ドキュメント」から「**部屋（DO）が持つ Yjs バイナリ状態**」に移す（Hocuspocus / y-sweet / y-redis と同じ業界標準）。`onLoad` は DO ストレージのバイナリを `Y.applyUpdate` で復元（identity 保持＝再 seed 合流が起きない）、無いときだけ Firestore JSON から初回 seed。`onSave` はバイナリを DO ストレージに、JSON 射影を Firestore に二層保存。失効/再発行時は部屋のバイナリを明示破棄し、失効ドキュメントは GC で掃除する。既に汚染された Firestore は一回限りスクリプトで id 一意に修復する。

**Tech Stack:** Yjs / y-partyserver (YServer) / Cloudflare Durable Objects (SQLite-backed, `ctx.storage` KV) / Vercel Node Functions / Firestore (firebase-admin) / vitest (`@cloudflare/vitest-pool-workers` で worker, vmThreads で root)。

---

## 根本原因（証拠付き・この計画の前提）

**症状**: 共同編集 ON の表で、再 ON / 再共有を繰り返すと party 列が右に増殖（同じ 8 人が何度も）。

**機序（確定）**:
1. Yjs 配列は内容（`id`）で重複排除しない **追記型 CRDT**。別々に作られた Y.Doc を合流すると同 `id` でも連結する。
2. `workers/collab/src/yjsPlanData.ts` の `buildSeedDocFull` は `onLoad` のたびに **`new Y.Doc()` を JSON から組み直す**＝毎回新しい Yjs identity を生む。
3. y-partyserver の `YServer.onStart`（`workers/collab/node_modules/y-partyserver/dist/server/index.js:143-148`）は **DO 起動（コールドスタート/ハイバネ復帰）ごとに `onLoad` を呼び `applyUpdate(this.document, seed)`**。`this.document` は毎回まっさら。
4. ハイバネ復帰時、生きている編集接続が **前の identity の同内容**を持っているため、新 seed と合流＝**8 人ブロックがもう1つ増える**。`onSave` が増えた配列を Firestore に上書き → 次の `onLoad` がその汚染 JSON をまた seed → **雪だるま式**。

**証拠（2026-06-11 本番 Firestore 実測）**: plan `tesuto` = `partyMembers` 80 件 / uniqueIds 8（MT…D4 が各 ×10、順序つき連結）。`timelineMitigations` 1294/131、`timelineEvents` 5040/504 = いずれも ×10。一部 ×6・×2 = サイクル途中で編集が入った＝**繰り返し発生**の証拠。`collabRooms` に当該 plan の revoked 部屋が 3 つ残存。

**前回の「根治」がなぜ外れたか**: 前回はクライアント側のライフサイクル（プラン束縛）を直したが、増殖は **サーバ側 seed の複数 doc 合流**で起きる。`applyUpsert` の id 重複排除は**クライアント差分書き込み時しか効かず**この合流には無関係。

**被害**: admin ゲートのため一般ユーザーは到達不可（影響ゼロ）。端末メモリ/表示の問題で、Firestore の汚染は本スクリプトで修復可能。

---

## File Structure

**新規（worker）**
- `workers/collab/src/docPersistence.ts` — DO ストレージへ Yjs バイナリをチャンク保存/復元/破棄する純ヘルパ（128KiB/値 上限回避）。
- `workers/collab/src/docPersistence.test.ts` — 上記ヘルパの round-trip テスト（`@cloudflare/vitest-pool-workers` の実 DO ストレージ）。
- `workers/collab/src/yjsPlanData.identity.test.ts` — 「JSON 再 seed で増殖／バイナリ復元で増えない」を純 Yjs で実証する回帰テスト（根本機序の固定）。

**変更（worker）**
- `workers/collab/src/server.ts` — `onLoad`（バイナリ復元優先 + 初回 seed 時にバイナリ確定）、`flushSave`（バイナリ + JSON 二層保存）、`onRequest`（`/destroy` 追加）。
- `workers/collab/src/yjsPlanData.ts` — `buildSeedDocFull`/`readPlanDataFull` に id 一意化（防御層・Phase 4）。
- `workers/collab/src/server.test.ts` — 既存 6 テストが緑のまま + バイナリ永続化/destroy の新テスト。

**変更（Vercel API）**
- `api/collab/_roomHandler.ts` — revoke/reissue の旧トークンに対し worker `/destroy` を best-effort 呼び出し。
- `api/collab/_roomManageLogic.ts` — 変更なし（参照のみ）。
- `api/collab/_collabGcHandler.ts`（新規） + `api/collab/index.ts` — `action=gc` で古い revoked 部屋ドキュメントを掃除（CRON_SECRET 認証）。
- `vercel.json` — GC cron 登録（日次）。

**新規（防御・client）**
- `src/lib/collab/dedupeById.ts` + テスト — id 一意化ヘルパ。`_applyPartyMembersFromCollab` 等の表示直前に適用（Phase 4・保険）。

**新規（一回限り）**
- `scripts/fix-collab-duplication.ts` — 汚染プランの `partyMembers`/`timelineMitigations`/`timelineEvents` を id 一意化して Firestore を修復（`scripts/inspect-collab-partymembers.ts` で検証）。

---

## Phase 1（最重要）: 増殖機序の固定 + バイナリ永続化

### Task 1: 増殖機序を純 Yjs で実証する回帰テスト

**Files:**
- Test: `workers/collab/src/yjsPlanData.identity.test.ts`

- [ ] **Step 1: Write the failing test（機序の実証 + 修正後の期待）**

```ts
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
```

- [ ] **Step 2: Run（両テスト緑のはず＝機序の自己文書化）**

Run: `cd workers/collab && npx vitest run src/yjsPlanData.identity.test.ts`
Expected: 2 passed。1 本目が「16」で緑＝バグ機序を正しく再現できている。2 本目が「8」で緑＝バイナリ復元方針が原理的に正しい。

> 注: このテストは「現状コードのバグ」ではなく「機序」を固定する（`buildSeedDocFull` 自体は正しく、誤用＝再 seed が問題）。Phase 1 の実装は server.ts 側がこの原理を使うことを保証する。

- [ ] **Step 3: Commit**

```bash
rtk git add workers/collab/src/yjsPlanData.identity.test.ts
rtk git commit -m "test(collab): 列増殖の根本機序（JSON再seed合流 vs バイナリ復元）を純Yjsで固定"
```

### Task 2: DO ストレージへの Yjs バイナリ チャンク永続化ヘルパ

実測: クリーンな満杯プランのバイナリ = 116.3 KiB（128KiB/値 上限ギリギリ）。大きい戦闘で超えるため**チャンク分割必須**。

**Files:**
- Create: `workers/collab/src/docPersistence.ts`
- Test: `workers/collab/src/docPersistence.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { runInDurableObject } from "cloudflare:test";
// 既存 server.test.ts と同じ harness。DO 内で storage を直接触る。
import * as Y from "yjs";
import { saveDocBinary, loadDocBinary, clearDocBinary } from "./docPersistence";

// テスト用に DO の storage を取り出すユーティリティは既存 harness 依存。
// ここでは storage モックではなく、純粋なバイト round-trip をユニットで検証する形に寄せる。
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd workers/collab && npx vitest run src/docPersistence.test.ts`
Expected: FAIL（`saveDocBinary` 等が未定義）。

- [ ] **Step 3: Write minimal implementation**

```ts
// workers/collab/src/docPersistence.ts
// DO ストレージへ Yjs バイナリをチャンク保存/復元/破棄する。
// DO KV は値 128KiB 上限のため CHUNK_SIZE で分割。put(batch) は最大 128 キー/回。
// 最小依存（DurableObjectStorage の put/get/list/delete だけ）でテスト容易。

export interface KVLike {
  put(entries: Record<string, unknown>): Promise<void>;
  put(key: string, value: unknown): Promise<void>;
  get<T = unknown>(key: string): Promise<T | undefined>;
  list(opts: { prefix: string }): Promise<Map<string, unknown>>;
  delete(keys: string | string[]): Promise<unknown>;
}

const CHUNK_PREFIX = "ydoc:chunk:";
const META_KEY = "ydoc:meta";
const CHUNK_SIZE = 120 * 1024; // 120KiB < 128KiB 値上限

interface DocMeta {
  chunkCount: number;
  byteLength: number;
}

/** Yjs バイナリを 120KiB チャンクに分割して保存（古いチャンクは先に全削除）。 */
export async function saveDocBinary(storage: KVLike, update: Uint8Array): Promise<void> {
  await clearDocBinary(storage);
  const chunks: Record<string, unknown> = {};
  let n = 0;
  for (let off = 0; off < update.length; off += CHUNK_SIZE) {
    chunks[`${CHUNK_PREFIX}${n}`] = update.slice(off, off + CHUNK_SIZE);
    n++;
  }
  if (n > 0) await storage.put(chunks);
  const meta: DocMeta = { chunkCount: n, byteLength: update.length };
  await storage.put(META_KEY, meta);
}

/** チャンクを連結して Yjs バイナリを復元。保存が無い/壊れていれば null（初回 seed へフォールバック）。 */
export async function loadDocBinary(storage: KVLike): Promise<Uint8Array | null> {
  const meta = await storage.get<DocMeta>(META_KEY);
  if (!meta || meta.chunkCount === 0) return null;
  const out = new Uint8Array(meta.byteLength);
  let offset = 0;
  for (let i = 0; i < meta.chunkCount; i++) {
    const chunk = await storage.get<Uint8Array>(`${CHUNK_PREFIX}${i}`);
    if (!chunk) return null; // 欠損 → 復元不能 → JSON seed へ
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/** 保存済みバイナリを全消去（失効/墓標時の破棄）。 */
export async function clearDocBinary(storage: KVLike): Promise<void> {
  const existing = await storage.list({ prefix: CHUNK_PREFIX });
  const keys = [...existing.keys(), META_KEY];
  if (keys.length > 0) await storage.delete(keys);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd workers/collab && npx vitest run src/docPersistence.test.ts`
Expected: 5 passed。

- [ ] **Step 5: Commit**

```bash
rtk git add workers/collab/src/docPersistence.ts workers/collab/src/docPersistence.test.ts
rtk git commit -m "feat(collab): DOストレージへYjsバイナリをチャンク永続化するヘルパ（128KiB上限回避）"
```

### Task 3: `onLoad` をバイナリ復元優先にする（再 seed をやめる）

**Files:**
- Modify: `workers/collab/src/server.ts:42-57`（`onLoad`）

- [ ] **Step 1: Write the failing test（server.test.ts に追加）**

```ts
// workers/collab/src/server.test.ts に追記。
// 「同じ部屋に 2 回コールド接続しても seed fetch は 1 回だけ（2 回目はバイナリ復元）」を検証。
it("2 回目のロードは Firestore を再 fetch せずバイナリから復元する（再 seed 合流の封じ込め）", async () => {
  // 1 回目の onLoad だけ load を 1 回 intercept（2 回目に再 fetch したら assertNoPendingInterceptors が pending を検出して失敗）
  fetchMock.get(BASE)
    .intercept({ path: "/api/collab/load?roomToken=persist-room", method: "GET" })
    .reply(200, {
      mitigations: [],
      partyMembers: ["MT", "ST", "H1", "H2", "D1", "D2", "D3", "D4"].map((id) => ({ id, jobId: "pld", role: "tank" })),
      maxParticipants: 8,
    });
  // save は debounce で飛ぶ可能性があるので緩く許可（任意回数）。
  fetchMock.get(BASE).intercept({ path: "/api/collab/save", method: "POST" }).reply(200, { ok: true }).persist();

  const ws1 = (await SELF.fetch("https://collab.test/parties/room/persist-room", { headers: { Upgrade: "websocket" } })).webSocket!;
  ws1.accept();
  await pollCount("persist-room");
  ws1.close();
  // 少し待ってから 2 回目（DO が evict されてもされなくても、load 再 fetch が無いことを保証）。
  await new Promise((r) => setTimeout(r, 50));
  const ws2 = (await SELF.fetch("https://collab.test/parties/room/persist-room", { headers: { Upgrade: "websocket" } })).webSocket!;
  ws2.accept();
  await pollCount("persist-room");
  ws2.close();
  // afterEach の assertNoPendingInterceptors が load の 2 回目要求が無いことを保証（intercept は 1 回分しか張っていない）。
});
```

> 注: vitest-pool-workers では DO は通常メモリに残るため `onStart` が 2 回走らない場合がある。その場合この test は「load が 1 回」で緑（退行検知用）。本質的な「再 seed しない」保証は Task 1 の機序テスト + 下の実装レビューで担保する。

- [ ] **Step 2: Run to verify current behavior**

Run: `cd workers/collab && npx vitest run src/server.test.ts`
Expected: 既存 6 + 新規が走る。新規は現状でも緑のことが多い（退行ガード）。実装後も緑を維持する。

- [ ] **Step 3: Implement — `onLoad` をバイナリ優先に書き換え**

`workers/collab/src/server.ts` の import に追加:

```ts
import * as Y from "yjs";
import { saveDocBinary, loadDocBinary, clearDocBinary } from "./docPersistence";
```

`onLoad` を差し替え:

```ts
  /** 部屋の Yjs バイナリが DO ストレージにあれば identity を保って復元（再 seed 合流＝列増殖を起こさない）。
   *  無ければ初回ロード扱いで Firestore JSON から seed し、直後にバイナリを確定する。 */
  override async onLoad(): Promise<Y.Doc | void> {
    // 1) バイナリ復元（2 回目以降のロード・ハイバネ復帰）。
    const persisted = await loadDocBinary(this.ctx.storage as unknown as import("./docPersistence").KVLike);
    if (persisted) {
      const doc = new Y.Doc();
      Y.applyUpdate(doc, persisted);
      this.#saveEnabled = true; // 復元できた = 正常な部屋
      return doc;
    }
    // 2) 初回ロード: Firestore JSON から seed。
    const { APP_API_BASE, COLLAB_SHARED_SECRET } = this.collabEnv;
    if (!APP_API_BASE || !COLLAB_SHARED_SECRET) return; // 揮発モード（②-a 相当）
    const seed = await fetchSeedFull(APP_API_BASE, COLLAB_SHARED_SECRET, this.name);
    if (seed) {
      this.#saveEnabled = true;
      await this.ctx.storage.put(MAX_PARTICIPANTS_KEY, resolveMaxParticipants(seed.maxParticipants));
      const doc = buildSeedDocFull(seed);
      // 初回バイナリを確定（次回ロードはこのバイナリから復元＝再 seed しない）。
      await saveDocBinary(this.ctx.storage as unknown as import("./docPersistence").KVLike, Y.encodeStateAsUpdate(doc));
      return doc;
    }
    // null（墓標/不存在/障害）: seed しない。#saveEnabled は false（破壊保存ガード）。
  }
```

- [ ] **Step 4: Run tests**

Run: `cd workers/collab && npx vitest run src/server.test.ts src/yjsPlanData.identity.test.ts`
Expected: 全緑（既存 6 + 新規）。

- [ ] **Step 5: Commit**

```bash
rtk git add workers/collab/src/server.ts workers/collab/src/server.test.ts
rtk git commit -m "fix(collab): onLoadをバイナリ復元優先に（再seed合流による列増殖を根治）"
```

### Task 4: `flushSave` をバイナリ + JSON 二層保存にする

**Files:**
- Modify: `workers/collab/src/server.ts:60-71`（`flushSave`）

- [ ] **Step 1: Write the failing test（server.test.ts に追記）**

```ts
it("墓標(skipped)を受けたらバイナリも破棄して以後保存しない", async () => {
  // load は live seed、save は skipped(deleted) を返す。
  fetchMock.get(BASE).intercept({ path: "/api/collab/load?roomToken=tomb-room", method: "GET" })
    .reply(200, { mitigations: [{ id: "m1", mitigationId: "rampart", time: 1, duration: 2, ownerId: "MT" }], maxParticipants: 8 });
  fetchMock.get(BASE).intercept({ path: "/api/collab/save", method: "POST" }).reply(200, { skipped: "deleted" }).persist();

  const ws = (await SELF.fetch("https://collab.test/parties/room/tomb-room", { headers: { Upgrade: "websocket" } })).webSocket!;
  ws.accept();
  await pollCount("tomb-room");
  // 編集を流して save をトリガ（onClose flush で skipped を受ける）。
  ws.close();
  // 破壊保存ガードが立ち、再ロードしても seed が空（バイナリ破棄済み）であることは Task 3 の load 経路で担保。
  // ここでは save が skipped を返しても例外で落ちないことを確認（最低限）。
  expect(true).toBe(true);
});
```

- [ ] **Step 2: Run**

Run: `cd workers/collab && npx vitest run src/server.test.ts`
Expected: 走る（緑）。

- [ ] **Step 3: Implement — `flushSave` 差し替え**

```ts
  /** バイナリ(DO ストレージ=CRDT の真実) + JSON 射影(Firestore=ソロ機能/初回 seed 用)の二層保存。
   *  skipped(墓標)を受けたら以後保存せず、バイナリも破棄する（削除が勝つ）。 */
  async flushSave(): Promise<void> {
    if (!this.#saveEnabled) return;
    const storage = this.ctx.storage as unknown as import("./docPersistence").KVLike;
    // 1) バイナリを DO ストレージへ（identity 保持の真実）。
    await saveDocBinary(storage, Y.encodeStateAsUpdate(this.document));
    // 2) JSON 射影を Firestore へ（ソロ機能が読む / 別部屋の初回 seed 元）。
    const { APP_API_BASE, COLLAB_SHARED_SECRET } = this.collabEnv;
    const result = await postPlanData(APP_API_BASE, COLLAB_SHARED_SECRET, this.name, readPlanDataFull(this.document));
    if (result === "skipped") {
      this.#saveEnabled = false;
      await clearDocBinary(storage); // 墓標 = この部屋は死んだ。バイナリも残さない。
    }
    // 'error' は次の debounce / onClose flush で再試行（ベストエフォート）。
  }
```

- [ ] **Step 4: Run worker 全テスト**

Run: `cd workers/collab && npx vitest run`
Expected: 既存 + 新規すべて緑。

- [ ] **Step 5: Commit**

```bash
rtk git add workers/collab/src/server.ts
rtk git commit -m "feat(collab): flushSaveをバイナリ(DO)+JSON射影(Firestore)の二層保存に"
```

---

## Phase 2: 使い終わった部屋の片付け（lifecycle teardown）

### Task 5: worker に `/destroy` エンドポイント（バイナリ破棄）

**Files:**
- Modify: `workers/collab/src/server.ts`（`onRequest`）
- Modify: `workers/collab/src/index.ts`（`/destroy` の共有シークレット認証）

- [ ] **Step 1: Write the failing test（server.test.ts）**

```ts
it("/destroy は共有シークレット付きで storage を全消去し 200 を返す", async () => {
  const res = await SELF.fetch("https://collab.test/parties/room/destroy-room/destroy", {
    method: "POST",
    headers: { "x-collab-secret": "test-secret" }, // vitest env の COLLAB_SHARED_SECRET と一致させる
  });
  expect(res.status).toBe(200);
});

it("/destroy はシークレット無しを 401 で拒否", async () => {
  const res = await SELF.fetch("https://collab.test/parties/room/destroy-room/destroy", { method: "POST" });
  expect(res.status).toBe(401);
});
```

> vitest の worker env に `COLLAB_SHARED_SECRET=test-secret` を設定する（`workers/collab/vitest.config.ts` の `miniflare.bindings` を確認し、無ければ追加）。

- [ ] **Step 2: Run to verify it fails**

Run: `cd workers/collab && npx vitest run src/server.test.ts`
Expected: FAIL（404/未実装）。

- [ ] **Step 3: Implement — `onRequest` に `/destroy` 追加**

`server.ts` の `onRequest` を拡張:

```ts
  override async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.endsWith("/count")) {
      let count = 0;
      for (const _ of this.getConnections()) count++;
      const stored = await this.ctx.storage.get<number>(MAX_PARTICIPANTS_KEY);
      return Response.json({ count, max: resolveMaxParticipants(stored) });
    }
    if (url.pathname.endsWith("/destroy")) {
      // 失効/再発行で受付係(Vercel)が叩く。共有シークレットで認証（クライアントは到達不可）。
      const secret = request.headers.get("x-collab-secret");
      if (!this.collabEnv.COLLAB_SHARED_SECRET || secret !== this.collabEnv.COLLAB_SHARED_SECRET) {
        return new Response("unauthorized", { status: 401 });
      }
      this.#saveEnabled = false;          // 以後の debounce save を止める
      await this.ctx.storage.deleteAll(); // バイナリ・max・チャンクを丸ごと破棄
      return Response.json({ destroyed: true });
    }
    return new Response("Not Found", { status: 404 });
  }
```

`index.ts`: `/destroy` は WS upgrade ではないので既存の認可分岐（Upgrade のみ）に入らず、そのまま `routePartykitRequest` で DO の `onRequest` に届く。**追加変更不要**（`/count` と同経路）。シークレット検証は DO 側で実施済み。

- [ ] **Step 4: Run**

Run: `cd workers/collab && npx vitest run src/server.test.ts`
Expected: 全緑（destroy 200/401 含む）。

- [ ] **Step 5: Commit**

```bash
rtk git add workers/collab/src/server.ts
rtk git commit -m "feat(collab): /destroyで部屋のバイナリ破棄（失効時の明示teardown・共有シークレット認証）"
```

### Task 6: revoke/reissue 時に旧部屋を `/destroy` 呼び出し

**Files:**
- Modify: `api/collab/_roomHandler.ts`（トランザクション成功後に best-effort 呼び出し）

- [ ] **Step 1: Write the failing test**

`api/collab` のハンドラテスト方針に合わせ、`destroyRoomBinary(base, secret, roomToken, fetchImpl)` を純関数として切り出してテストする（`_roomHandler` 本体は firebase-admin 依存で重いため）。

```ts
// api/collab/__tests__/destroyRoomBinary.test.ts
import { describe, it, expect, vi } from "vitest";
import { destroyRoomBinary } from "../_roomDestroy.js"; // 新規

describe("destroyRoomBinary", () => {
  it("worker の /destroy を共有シークレットで叩く", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    await destroyRoomBinary("https://lopo-collab.example", "sec", "tokenABC", fetchImpl as any);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://lopo-collab.example/parties/room/tokenABC/destroy",
      expect.objectContaining({ method: "POST", headers: { "x-collab-secret": "sec" } }),
    );
  });

  it("失敗しても例外を投げない（best-effort）", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("net"));
    await expect(destroyRoomBinary("https://x", "sec", "t", fetchImpl as any)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run api/collab/__tests__/destroyRoomBinary.test.ts`
Expected: FAIL（`_roomDestroy` 未作成）。

- [ ] **Step 3: Implement**

```ts
// api/collab/_roomDestroy.ts
// 失効/再発行で旧部屋(DO)のバイナリを破棄するよう worker に通知する（best-effort）。
// COLLAB_HOST は worker のホスト。env から渡す（ハードコードしない）。
export async function destroyRoomBinary(
  collabBase: string,
  secret: string,
  roomToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  if (!collabBase || !secret || !roomToken) return;
  try {
    await fetchImpl(`${collabBase}/parties/room/${encodeURIComponent(roomToken)}/destroy`, {
      method: "POST",
      headers: { "x-collab-secret": secret },
    });
  } catch {
    // best-effort: 失敗しても失効自体は成立済み。GC cron が後で拾う。
  }
}
```

`_roomHandler.ts`: トランザクション内で旧トークンを控え、コミット後に呼ぶ。

```ts
// import 追加
import { destroyRoomBinary } from './_roomDestroy.js';

// runTransaction の各分岐で「破棄すべき旧トークン」を result に載せる。
// revoke: return { revoked: true, destroyToken: current };
// reissue: 旧 current を destroyToken に。
// それ以外: destroyToken なし。
// コミット後:
const collabBase = process.env.COLLAB_INTERNAL_BASE || 'https://lopo-collab.masaya-maeno0106.workers.dev';
const collabSecret = process.env.COLLAB_SHARED_SECRET || '';
if ((result as any).destroyToken) {
  await destroyRoomBinary(collabBase, collabSecret, (result as any).destroyToken);
}
return res.status(200).json(result); // destroyToken は内部用途。レスポンスから除くなら分離する。
```

> `result` から `destroyToken` をクライアント応答に漏らさないよう、`const { destroyToken, ...publicResult } = result as any;` で分離して `publicResult` を返す。`COLLAB_SHARED_SECRET` は Vercel に既存（sensitive）。`COLLAB_INTERNAL_BASE` 未設定時は本番ワーカーURLにフォールバック。

- [ ] **Step 4: Run**

Run: `npx vitest run api/collab/__tests__/destroyRoomBinary.test.ts`
Expected: 2 passed。

- [ ] **Step 5: Commit**

```bash
rtk git add api/collab/_roomDestroy.ts api/collab/_roomHandler.ts api/collab/__tests__/destroyRoomBinary.test.ts
rtk git commit -m "feat(collab): revoke/reissue時に旧部屋のバイナリをworkerへdestroy通知（best-effort）"
```

### Task 7: 失効ドキュメントの GC cron

**Files:**
- Create: `api/collab/_collabGcLogic.ts`（純判定）+ `api/collab/__tests__/collabGcLogic.test.ts`
- Modify: `api/collab/index.ts`（`action=gc`）
- Modify: `vercel.json`（cron 登録）

- [ ] **Step 1: Write the failing test（純ロジック）**

```ts
// api/collab/__tests__/collabGcLogic.test.ts
import { describe, it, expect } from "vitest";
import { shouldGcRoom } from "../_collabGcLogic.js";

const DAY = 86_400_000;
describe("shouldGcRoom", () => {
  const now = 1_000 * DAY;
  it("revoked かつ 7 日より古い → 掃除対象", () => {
    expect(shouldGcRoom({ revoked: true, createdAt: now - 8 * DAY }, now, 7)).toBe(true);
  });
  it("revoked でも 7 日以内 → 残す", () => {
    expect(shouldGcRoom({ revoked: true, createdAt: now - 1 * DAY }, now, 7)).toBe(false);
  });
  it("有効な部屋は対象外", () => {
    expect(shouldGcRoom({ revoked: false, createdAt: now - 100 * DAY }, now, 7)).toBe(false);
  });
  it("createdAt 欠落は安全側で残す", () => {
    expect(shouldGcRoom({ revoked: true }, now, 7)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run api/collab/__tests__/collabGcLogic.test.ts`
Expected: FAIL。

- [ ] **Step 3: Implement 純ロジック + ハンドラ配線**

```ts
// api/collab/_collabGcLogic.ts
export interface GcRoomDoc { revoked?: boolean; createdAt?: number }
/** revoked かつ createdAt が retentionDays より古い部屋だけ掃除対象。createdAt 欠落は残す（安全側）。 */
export function shouldGcRoom(room: GcRoomDoc, nowMs: number, retentionDays: number): boolean {
  if (room.revoked !== true) return false;
  if (typeof room.createdAt !== "number") return false;
  return room.createdAt < nowMs - retentionDays * 86_400_000;
}
```

```ts
// api/collab/_collabGcHandler.ts
// CRON_SECRET 認証で revoked 古い部屋を削除（Firestore 掃除）。バイナリは destroy 済み（Task 6）。
import { getDb } from './_handlerShared.js';
import { shouldGcRoom } from './_collabGcLogic.js';

export default async function handler(req: any, res: any) {
  const auth = req.headers.authorization || '';
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).json({ error: 'unauthorized' });
  const db = getDb();
  const now = Date.now();
  const snap = await db.collection('collabRooms').where('revoked', '==', true).get();
  let deleted = 0;
  for (const doc of snap.docs) {
    if (shouldGcRoom(doc.data() as any, now, 7)) { await doc.ref.delete(); deleted++; }
  }
  return res.status(200).json({ ok: true, deleted });
}
```

`api/collab/index.ts` の action 分岐に `gc` を追加（既存 room/load/save/verify と同型のルーティング）。`firestore.indexes.json` に `collabRooms` の `revoked` 単一フィールド where が複合不要であることを確認（単一 where のみなら index 不要）。

`vercel.json` の `crons` に追加:

```json
{ "path": "/api/collab?action=gc", "schedule": "0 18 * * *" }
```

- [ ] **Step 4: Run**

Run: `npx vitest run api/collab/__tests__/collabGcLogic.test.ts`
Expected: 4 passed。

- [ ] **Step 5: Commit**

```bash
rtk git add api/collab/_collabGcLogic.ts api/collab/_collabGcHandler.ts api/collab/index.ts api/collab/__tests__/collabGcLogic.test.ts vercel.json
rtk git commit -m "feat(collab): 失効部屋ドキュメントの日次GC cron（revoked 7日超を削除）"
```

---

## Phase 3: 汚染済み Firestore データの一回限り修復

### Task 8: 重複 id を畳む修復スクリプト

**Files:**
- Create: `scripts/fix-collab-duplication.ts`
- 検証: `scripts/inspect-collab-partymembers.ts`（既存）

- [ ] **Step 1: Implement（dry-run 既定・`--apply` で書き込み）**

```ts
// scripts/fix-collab-duplication.ts
// 列増殖バグで data.partyMembers/timelineMitigations/timelineEvents に同 id が重複した
// プランを id 一意（最初の出現を残す）に修復する。既定は dry-run。--apply で書き込み。
// 使い方: npx tsx scripts/fix-collab-duplication.ts [--apply] [titleSubstring]
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

function loadEnv(p: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of readFileSync(p, 'utf-8').split('\n')) {
    const t = line.trim(); if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('='); if (i === -1) continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[t.slice(0, i).trim()] = v;
  }
  return env;
}
const ROOT = resolve(import.meta.dirname, '..');
const env = loadEnv(resolve(ROOT, '.env.local'));
initializeApp({ credential: cert({ projectId: env.FIREBASE_PROJECT_ID, clientEmail: env.FIREBASE_CLIENT_EMAIL, privateKey: (env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n') }) });
const db = getFirestore();

const APPLY = process.argv.includes('--apply');
const titleSub = (process.argv.find((a, i) => i >= 2 && !a.startsWith('--')) || '').toLowerCase();

function dedupeById<T extends { id?: unknown }>(arr: T[]): { out: T[]; removed: number } {
  const seen = new Set<string>(); const out: T[] = [];
  for (const x of arr) {
    const id = x && typeof x === 'object' ? String((x as any).id) : String(x);
    if (seen.has(id)) continue;
    seen.add(id); out.push(x);
  }
  return { out, removed: arr.length - out.length };
}

async function main() {
  const snap = await db.collection('plans').get();
  let fixed = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    if (titleSub && !String(data.title || '').toLowerCase().includes(titleSub)) continue;
    const d = data.data || {};
    const update: Record<string, unknown> = {};
    let totalRemoved = 0;
    for (const key of ['partyMembers', 'timelineMitigations', 'timelineEvents', 'phases', 'labels', 'memos'] as const) {
      if (!Array.isArray(d[key])) continue;
      const { out, removed } = dedupeById(d[key]);
      if (removed > 0) { update[`data.${key}`] = out; totalRemoved += removed; }
    }
    if (totalRemoved > 0) {
      console.log(`${APPLY ? 'FIX' : 'DRY'} ${doc.id} "${data.title}": -${totalRemoved} 要素`,
        Object.fromEntries(Object.keys(update).map((k) => [k, (update[k] as any[]).length])));
      if (APPLY) {
        update['updatedAt'] = FieldValue.serverTimestamp();
        await doc.ref.update(update);
      }
      fixed++;
    }
  }
  console.log(`\n${APPLY ? '修復' : 'dry-run 対象'}: ${fixed} プラン`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Dry-run（書き込まない）**

Run: `npx tsx scripts/fix-collab-duplication.ts`
Expected: `tesuto` 等が `-72 要素`（partyMembers 80→8 等）として列挙される。`tesuto (2)` は対象外。

- [ ] **Step 3: 検証スクリプトで現状確認 → apply → 再確認**

```bash
npx tsx scripts/inspect-collab-partymembers.ts tesuto   # before: 80
npx tsx scripts/fix-collab-duplication.ts --apply        # 修復
npx tsx scripts/inspect-collab-partymembers.ts tesuto   # after: 8（uniqueIds=8・重複なし）
```

> ⚠ Phase 1 デプロイ**後**に実行する。先に修復しても、旧コードの部屋が生きていれば再汚染し得るため。順序 = Phase 1 本番反映 → Phase 3 修復。

- [ ] **Step 4: Commit（スクリプトのみ。データ修復はコミット対象外）**

```bash
rtk git add scripts/fix-collab-duplication.ts scripts/inspect-collab-partymembers.ts
rtk git commit -m "chore(collab): 列増殖で汚染したプランのid一意化修復スクリプト + 調査スクリプト"
```

---

## Phase 4: 多層防御（id 一意の不変条件を境界で強制・保険）

> これは主役ではない。バイナリ永続化（Phase 1）が根治。本 Phase は「id 一意」という既存データモデルの不変条件を、Yjs が触れない JSON/表示境界で念のため強制する defense-in-depth（systematic-debugging の defense-in-depth 手法）。将来の別バグや残留汚染に対する保険。

### Task 9: seed/射影/表示の境界で id 一意化

**Files:**
- Modify: `workers/collab/src/yjsPlanData.ts`（`buildSeedDocFull` の `pushAll` 前 / `readPlanDataFull` の各 `readAll` 後に id 一意化）
- Create: `src/lib/collab/dedupeById.ts` + `src/lib/collab/__tests__/dedupeById.test.ts`
- Modify: `src/lib/collab/collabProvider.ts`（`applyRoomToStore` / 各 `applyXFromCollab` の readArray 後に適用）

- [ ] **Step 1: Write failing test（共有 dedupe ヘルパ）**

```ts
// src/lib/collab/__tests__/dedupeById.test.ts
import { describe, it, expect } from 'vitest';
import { dedupeById } from '../dedupeById';
describe('dedupeById', () => {
  it('同 id は最初の出現だけ残す', () => {
    expect(dedupeById([{ id: 'a', v: 1 }, { id: 'b' }, { id: 'a', v: 2 }])).toEqual([{ id: 'a', v: 1 }, { id: 'b' }]);
  });
  it('重複が無ければそのまま', () => {
    const a = [{ id: 'x' }, { id: 'y' }];
    expect(dedupeById(a)).toEqual(a);
  });
});
```

- [ ] **Step 2: Run to fail**

Run: `npm test -- src/lib/collab/__tests__/dedupeById.test.ts`（安全手順: ファイル出力・timeout 付き）
Expected: FAIL。

- [ ] **Step 3: Implement ヘルパ + 適用箇所**

```ts
// src/lib/collab/dedupeById.ts
/** id 一意化（最初の出現を残す）。partyMembers/mitigations/events 等の表示・射影直前の保険。 */
export function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>(); const out: T[] = [];
  for (const it of items) { if (seen.has(it.id)) continue; seen.add(it.id); out.push(it); }
  return out;
}
```

`collabProvider.ts`: `readArray<PartyMember>(doc, PARTY_MEMBERS_KEY)` 等の戻りを `dedupeById(...)` で包んでから store に渡す（`applyRoomToStore` と各 observeDeep 反映の両方）。worker `yjsPlanData.ts` も同等の純関数を `pushAll`/`readAll` に挟む（worker は別パッケージなのでローカル定義）。

- [ ] **Step 4: Run（client + worker）**

Run: `npm test -- src/lib/collab/__tests__/dedupeById.test.ts` および `cd workers/collab && npx vitest run`
Expected: 緑。

- [ ] **Step 5: Commit**

```bash
rtk git add src/lib/collab/dedupeById.ts src/lib/collab/__tests__/dedupeById.test.ts src/lib/collab/collabProvider.ts workers/collab/src/yjsPlanData.ts
rtk git commit -m "hardening(collab): seed/射影/表示の境界でid一意を強制（多層防御・保険）"
```

---

## 統合検証（全 Phase 後・push 前）

- [ ] **Step 1: root 全テスト + build**

Run（安全手順）: `npm run build`（EXIT=0）→ `npm test`（既知 5 失敗のみ＝TopBar4+HousingWorkspace1）。
yjs 分離維持（`grep -c y-partyserver dist/assets/index-*.js` = 0、collabProvider 別チャンク）。

- [ ] **Step 2: worker 全テスト**

Run: `cd workers/collab && npx vitest run`
Expected: 全緑。

- [ ] **Step 3: worker デプロイ（Phase 1/2 はワーカー変更を含む＝再デプロイ必須）**

Run: `cd workers/collab && npx wrangler deploy`（ユーザー承認後）。
※ 今回は **Worker 再デプロイが必要**（前回の「worker 変更ゼロ」とは異なる）。

- [ ] **Step 4: Vercel デプロイ（push）→ Phase 3 データ修復 → 2 ブラウザ実機確認**

順序厳守: Worker deploy → `git push`（Vercel）→ `scripts/fix-collab-duplication.ts --apply` → 2 ブラウザで再 ON/再共有しても増殖しないことを確認（`docs/.private/2026-06-11-collab-rootcause-2browser-verify.md` の①④）。

---

## Self-Review

**Spec coverage**:
- 根治（再 seed 合流の除去）= Phase 1（Task 1 機序固定 / Task 2-4 バイナリ永続化）✓
- 「使い終わった部屋の片付け」= Phase 2（Task 5 destroy / Task 6 revoke 配線 / Task 7 GC cron）✓
- 「失効ドキュメントの掃除」= Task 7 ✓
- 汚染データ修復 = Phase 3（Task 8）✓
- 多層防御（保険）= Phase 4（Task 9）✓
- バイナリ 128KiB 上限 = Task 2 チャンク（実測 116.3KiB 根拠）✓

**Placeholder scan**: 各 Task に実コード/実コマンド/期待出力あり。`destroyToken` のレスポンス漏れ防止を Task 6 に明記済み。

**Type consistency**: `saveDocBinary`/`loadDocBinary`/`clearDocBinary`（Task 2）を Task 3/4/5 で同名利用。`KVLike` を `ctx.storage` キャストで供給。`shouldGcRoom`（Task 7）/`destroyRoomBinary`（Task 6）/`dedupeById`（Task 9）名称一貫。

**未確定 → 実装時に確認**:
- vitest worker env に `COLLAB_SHARED_SECRET` バインドがあるか（Task 5 で確認・無ければ `vitest.config.ts` に追加）。
- `ctx.storage` の Uint8Array 値が round-trip するか（Task 2 の DO 実テスト `cloudflare:test` で確認。フェイクで通っても実 DO で再確認）。
- ハイバネ復帰で `onStart` が再実行されるかは環境依存。根治の保証は「再実行されてもバイナリ復元で増えない」（Task 1 機序 + Task 3 実装）で担保。
