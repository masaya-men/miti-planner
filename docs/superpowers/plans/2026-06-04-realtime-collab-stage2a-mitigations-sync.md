# リアルタイム共同編集 段取り②-a 実装計画 — 軽減配置の最小同時編集

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 2人が同じ軽減表を開き、軽減の配置(`timelineMitigations`)だけをリアルタイムに同時編集できる(CRDT で衝突なしマージ・両方残る)。1人で使う既存ユーザーへの影響はゼロ。Firestore への恒久保存は段取り③に送る。

**Architecture:** 共同編集中だけ Yjs を挟む。サーバ(別 Worker `lopo-collab`)の `Room` を `partyserver` の `Server` 継承から **`y-partyserver` の `YServer` 継承**へ変更し、hibernation を ON にして Y.Doc を握る。クライアントは `YProvider` で `/parties/room/<plan-id>` に接続し、`Y.Doc` の `timelineMitigations`(`Y.Array<Y.Map>`)を `useMitigationStore` にバインド。共同編集中は3 action(add/remove/updateMitigationTime)を `Y.Array` 操作へ振り替え、`observeDeep` で store を再構築する。共同編集中は Firestore 自動保存を抑制する(localStorage は継続)。

**Tech Stack:** Yjs (`yjs`), `y-partyserver`(client `YProvider` + server `YServer`), Cloudflare Durable Objects + WebSocket Hibernation, Zustand, Vitest。

**設計書(正典):** [../specs/2026-06-04-realtime-collab-stage2a-mitigations-sync-design.md](../specs/2026-06-04-realtime-collab-stage2a-mitigations-sync-design.md)(§9「改訂」が YServer 化の根拠)。親設計書 [../specs/2026-06-03-realtime-collab-design.md](../specs/2026-06-03-realtime-collab-design.md)。

---

## File Structure(作成・変更するファイルと責務)

**サーバ(別 Worker、本体非干渉):**
- `workers/collab/package.json` — 変更: `yjs` / `y-partyserver` を deps 追加。`@cloudflare/vitest-pool-workers` 更新判断(Task 1)。
- `workers/collab/src/server.ts` — 変更: `Room` を `YServer` 継承へ。hibernate ON、在室数を `getConnections()` 化、`/count` 温存。素のリレー廃止。
- `workers/collab/src/server.test.ts` — 変更: 素リレーのブロードキャストテストを削除し、101 upgrade + `/count`(hibernation 安全)のテストへ。
- `workers/collab/scripts/verify-yjs-sync.mjs` — 作成: 本番 YServer に node 2クライアントを繋ぎ Yjs 同期を実機検証するスクリプト。

**クライアント(本体アプリ):**
- `src/lib/collab/yjsMitigations.ts` — 作成: `AppliedMitigation` ⇄ `Y.Map` 変換、`Y.Array` ↔ 配列の純粋ロジック。ネットワーク非依存でユニットテスト可能。
- `src/lib/collab/yjsMitigations.test.ts` — 作成: 2つの `Y.Doc` をローカルで繋ぎ CRDT 同期(add 伝播 / 同時 add 両方残る / updateTime / remove)を検証。
- `src/lib/collab/collabProvider.ts` — 作成: `YProvider` 生成/接続/`destroy`、`synced` 後の seed、`observeDeep` 配線。
- `src/store/useMitigationStore.ts` — 変更: `_ydoc`/`_collabActive` 状態、3 action の Yjs 分岐、`_applyMitigationsFromYjs` / `enterCollabMode` / `exitCollabMode` action 追加。
- `src/components/Layout.tsx` — 変更: 共同編集中は `syncToCloud()` を抑制するガード追加。
- `src/components/CollabToggle.tsx` — 作成: ②-a 検証用の最小「一緒に編集」トグル(完全な UI は段取り⑤)。

---

## Phase 1 — サーバを YServer 化する(`workers/collab`)

### Task 1: サーバ依存の追加と workerd 追随判断

**Files:**
- Modify: `workers/collab/package.json`

- [ ] **Step 1: yjs / y-partyserver を deps 追加**

```bash
cd workers/collab
npm install yjs@^13 y-partyserver@^2
```

Expected: `package.json` の `dependencies` に `yjs` と `y-partyserver` が入る(`y-partyserver` が `y-protocols` / `lib0` を連れてくる)。

- [ ] **Step 2: 既存テストが現状の workerd で緑か確認(ベースライン)**

```bash
npm run test
```
Expected: 既存5テスト PASS。`[mf:warn] ... compatibility date ... "2025-10-11"` の警告が出る(テスト用 workerd が古い既知事象)。

- [ ] **Step 3: vitest-pool-workers の更新を試す(workerd 追随)**

`@cloudflare/vitest-pool-workers` を最新へ上げ、テスト用 workerd を本番 compatibility_date(2026-05-29)に追随させる。

```bash
npm install -D @cloudflare/vitest-pool-workers@latest
npm run test
```
Expected(成功時): 警告が消え、テスト用 workerd が 2026 系になる。5テスト PASS のまま。
**判断**: もし `defineWorkersConfig` の API 変更等でテストが落ちる場合は、`package.json` の当該変更を `git checkout` で戻し(`@cloudflare/vitest-pool-workers` は据え置き)、Yjs 同期検証は Task 4 の本番 node 結線(本番 workerd = 最新)を正典とする。落ちた事実と据え置き判断を本ファイル末尾「進捗メモ」に記録する。

- [ ] **Step 4: コミット**

```bash
rtk git add workers/collab/package.json workers/collab/package-lock.json
rtk git commit -m "chore(collab): add yjs/y-partyserver deps for stage2a (+workerd追随判断)"
```

---

### Task 2: `Room` を `YServer` 継承へ + hibernation + 在室数を getConnections 化

**Files:**
- Modify: `workers/collab/src/server.ts`(全面差し替え)

現状([workers/collab/src/server.ts](../../../workers/collab/src/server.ts))は `Room extends Server` + 手動 `_connectionCount` + `onMessage` 素ブロードキャスト。これを YServer ベースへ。`onMessage` の素リレーは **削除**(YServer が内部で sync protocol を処理)。

- [ ] **Step 1: server.ts を YServer ベースへ書き換え**

```ts
import { YServer } from "y-partyserver";
import type { Connection, ConnectionContext } from "partyserver";

/**
 * ライブ部屋 = 1 Durable Object。段取り②-a で YServer 化。
 * - YServer が Y.Doc を握り Yjs sync protocol を話す(素のリレーは廃止)。
 * - hibernation ON: idle 時 duration 非課金($0 前提)。起床時は生存接続から再同期。
 * - 在室数は getConnections() ベース(hibernation でインスタンス変数は揮発するため)。
 * - onLoad/onSave は未実装 = 全員退室で Y.Doc 揮発(設計書 §5 の許容範囲)。恒久保存は段取り③。
 */
export class Room extends YServer {
  // hibernation を明示 ON(デフォルト OFF)。これが無いと WebSocket 接続中ずっと duration 課金。
  static options = { hibernate: true };

  // 在室数 HTTP。WebSocket 接続中に GET /count で現在の接続数を返す。
  // getConnections() は ctx.getWebSockets() ベースで hibernation 安全。
  override onRequest(request: Request): Response | Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.endsWith("/count")) {
      let count = 0;
      for (const _ of this.getConnections()) count++;
      return new Response(JSON.stringify({ count }), {
        headers: { "content-type": "application/json" },
      });
    }
    return super.onRequest(request);
  }

  override onConnect(_connection: Connection, _ctx: ConnectionContext): void {
    // 段取り①の _connectionCount++ は撤去(getConnections() で代替)。
    // 接続ライフサイクルのフックは hibernation 起床後も呼ばれる(partyserver 仕様)。
  }

  override onClose(): void {
    // TODO(段取り③): 強制切断は onClose でなく onError だけ来るケースがある。
    //   「最後の1人が抜けたら Firestore 保存」を実装する際は onError でも整合させる。
  }
}
```

- [ ] **Step 2: index.ts が `Room` を export していることを確認(変更不要のはず)**

Read: [workers/collab/src/index.ts](../../../workers/collab/src/index.ts)
Expected: `export { Room } from "./server";` と `routePartykitRequest` が既にある。`Env.Room` の DO binding 名 `Room` は wrangler.jsonc と一致(変更不要)。

- [ ] **Step 3: 型チェック**

```bash
cd workers/collab
npm run typecheck
```
Expected: PASS。`getConnections` / `onRequest` / `onConnect` の override シグネチャが partyserver 型と一致すること。型不一致が出たら `y-partyserver` / `partyserver` の `.d.ts` を読み、`Connection` / `ConnectionContext` の正しい import 元へ修正。

---

### Task 3: サーバテストを YServer 前提へ更新

**Files:**
- Modify: `workers/collab/src/server.test.ts`(全面差し替え)

素のリレーを検証していた「メッセージ中継」「送信者に返らない」テスト(段取り①の #2/#3)は YServer 化で**前提が変わるため削除**。残すのは「WS upgrade で 101」「/count が接続数を反映」。Yjs 同期そのものの検証は Task 4(本番 node 結線)で行う。

- [ ] **Step 1: 失敗するテストを書く(更新後の期待値)**

```ts
import { env, SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("Room (YServer) ", () => {
  it("WebSocket の upgrade 要求に 101 を返す", async () => {
    const res = await SELF.fetch("https://collab.test/parties/room/upgrade-room", {
      headers: { Upgrade: "websocket" },
    });
    expect(res.status).toBe(101);
    expect(res.webSocket).toBeDefined();
    res.webSocket?.close();
  });

  it("接続中は在室数を GET /count で取得できる", async () => {
    const ws = (await SELF.fetch("https://collab.test/parties/room/count-room", {
      headers: { Upgrade: "websocket" },
    })).webSocket!;
    ws.accept();
    try {
      // 接続反映を待つ(最大 ~500ms ポーリング)
      let count = 0;
      for (let i = 0; i < 25; i++) {
        const r = await SELF.fetch("https://collab.test/parties/room/count-room/count");
        count = (await r.json<{ count: number }>()).count;
        if (count >= 1) break;
        await new Promise((res) => setTimeout(res, 20));
      }
      expect(count).toBe(1);
    } finally {
      ws.close();
    }
  });

  it("接続を閉じると在室数が減る", async () => {
    const ws = (await SELF.fetch("https://collab.test/parties/room/close-room", {
      headers: { Upgrade: "websocket" },
    })).webSocket!;
    ws.accept();
    // 1 になるまで待つ
    for (let i = 0; i < 25; i++) {
      const r = await SELF.fetch("https://collab.test/parties/room/close-room/count");
      if ((await r.json<{ count: number }>()).count >= 1) break;
      await new Promise((res) => setTimeout(res, 20));
    }
    ws.close();
    // 0 になるまで待つ
    let count = 1;
    for (let i = 0; i < 25; i++) {
      const r = await SELF.fetch("https://collab.test/parties/room/close-room/count");
      count = (await r.json<{ count: number }>()).count;
      if (count === 0) break;
      await new Promise((res) => setTimeout(res, 20));
    }
    expect(count).toBe(0);
  });
});
```

- [ ] **Step 2: テスト実行**

```bash
cd workers/collab
npm run test
```
Expected: 3テスト PASS。落ちる場合は `getConnections()` が hibernation 環境でどう振る舞うかを切り分け(`isolatedStorage:false` で DO 状態がテスト間共有される点に注意。各テストは異なる room 名を使用済み)。

- [ ] **Step 3: コミット**

```bash
rtk git add workers/collab/src/server.ts workers/collab/src/server.test.ts
rtk git commit -m "feat(collab): Room を YServer 化 + hibernation ON + 在室数 getConnections 化"
```

---

### Task 4: 本番デプロイ + Yjs 同期の実機検証(node 2クライアント)

**Files:**
- Create: `workers/collab/scripts/verify-yjs-sync.mjs`

- [ ] **Step 1: 検証スクリプトを書く**

```js
// 本番 YServer (lopo-collab) に YProvider を2つ繋ぎ、Yjs 同期が成立することを実証。
// 段取り②-a の中核(共同編集中だけ Yjs / 衝突なしマージ)のサーバ側到達点。
import * as Y from "yjs";
import WS from "ws";
import YProvider from "y-partyserver/provider";

const HOST = "lopo-collab.masaya-maeno0106.workers.dev";
const ROOM = "verify-" + process.pid;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dump = (doc) =>
  doc.getArray("timelineMitigations").toArray().map((m) => Object.fromEntries(m.entries()));

function client(label, doc) {
  const p = new YProvider(HOST, ROOM, doc, { party: "room", WebSocketPolyfill: WS, connect: true });
  p.on("sync", (s) => console.log(`[${label}] synced=${s}`));
  return p;
}

const docA = new Y.Doc(), docB = new Y.Doc();
const pA = client("A", docA), pB = client("B", docB);
await sleep(3000);
console.log(`A.synced=${pA.synced} B.synced=${pB.synced}`); // 期待: true/true

// A が1個置く → B に伝わるか
docA.transact(() => {
  const m = new Y.Map();
  m.set("id", "v1"); m.set("mitigationId", "rampart_pld");
  m.set("time", 30); m.set("duration", 20); m.set("ownerId", "MT");
  docA.getArray("timelineMitigations").push([m]);
});
await sleep(2000);
console.log(`[1] B 受信 = ${dump(docB).length === 1}`, JSON.stringify(dump(docB)));

// 後入室 C が既存状態を受け取るか
const docC = new Y.Doc(); const pC = client("C", docC);
await sleep(3000);
console.log(`[2] C late-join 受信 = ${dump(docC).length === 1}`, JSON.stringify(dump(docC)));

// 同時 add で両方残るか
docA.transact(() => { const m=new Y.Map(); m.set("id","vA2"); m.set("mitigationId","tetragrammaton"); m.set("time",60); m.set("duration",1); m.set("ownerId","H1"); docA.getArray("timelineMitigations").push([m]); });
docB.transact(() => { const m=new Y.Map(); m.set("id","vB2"); m.set("mitigationId","sacred_soil"); m.set("time",62); m.set("duration",15); m.set("ownerId","H2"); docB.getArray("timelineMitigations").push([m]); });
await sleep(2500);
console.log(`[3] 同時add両方残る = ${dump(docA).length === 3 && dump(docB).length === 3}`, dump(docA).map(m=>m.id), dump(docB).map(m=>m.id));

pA.destroy(); pB.destroy(); pC.destroy();
await sleep(500); process.exit(0);
```

- [ ] **Step 2: 本番へデプロイ**

```bash
cd workers/collab
rtk npx wrangler deploy
```
Expected: `lopo-collab` がデプロイされ、URL が表示される。**ユーザー影響ゼロ(本体未統合の別 Worker)**。

- [ ] **Step 3: 検証スクリプトを実行**

`yjs` / `y-partyserver` / `ws` が `workers/collab/node_modules` にある状態で:

```bash
cd workers/collab
node scripts/verify-yjs-sync.mjs
```
Expected:
```
A.synced=true B.synced=true
[1] B 受信 = true
[2] C late-join 受信 = true
[3] 同時add両方残る = true
```
**全て true でなければ Phase 2 に進まない**(サーバ側が同期を成立させられていない)。false の場合は `party: "room"` の指定・wrangler の DO routing・YServer の hibernate 設定を切り分ける。

- [ ] **Step 4: コミット**

```bash
cd ../..
rtk git add workers/collab/scripts/verify-yjs-sync.mjs
rtk git commit -m "test(collab): 本番 YServer の Yjs 同期を node 2クライアントで実証"
```

---

## Phase 2 — クライアント Yjs コア(純粋・ネットワーク非依存)

### Task 5: `AppliedMitigation` ⇄ `Y.Map` 変換と Y.Array 操作の純粋ロジック

**Files:**
- Create: `src/lib/collab/yjsMitigations.ts`
- Test: `src/lib/collab/yjsMitigations.test.ts`

`AppliedMitigation`([src/types/index.ts:82-91](../../../src/types/index.ts#L82-L91))は全フィールドがプリミティブ。`Y.Map` にフラット格納する。

- [ ] **Step 1: 失敗するテストを書く(2つの Y.Doc をローカル接続して CRDT 検証)**

```ts
import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import type { AppliedMitigation } from "../../types";
import {
  appliedToYMap,
  yMapToApplied,
  readMitigations,
  YJS_MITIGATIONS_KEY,
} from "./yjsMitigations";

// 2つの Y.Doc を双方向に繋ぐ(ネットワークの代わり)
function bridge(a: Y.Doc, b: Y.Doc) {
  a.on("update", (u: Uint8Array, origin: unknown) => { if (origin !== b) Y.applyUpdate(b, u, a); });
  b.on("update", (u: Uint8Array, origin: unknown) => { if (origin !== a) Y.applyUpdate(a, u, b); });
}
const sample = (over: Partial<AppliedMitigation> = {}): AppliedMitigation => ({
  id: "m1", mitigationId: "rampart_pld", time: 30, duration: 20, ownerId: "MT", ...over,
});

describe("yjsMitigations 変換", () => {
  it("appliedToYMap → yMapToApplied で往復一致(任意フィールド含む)", () => {
    const orig = sample({ targetId: "ST", linkedMitigationId: "x", autoHidden: true });
    const back = yMapToApplied(appliedToYMap(orig));
    expect(back).toEqual(orig);
  });

  it("未指定の任意フィールドは undefined のまま(空文字や false に化けない)", () => {
    const back = yMapToApplied(appliedToYMap(sample()));
    expect(back.targetId).toBeUndefined();
    expect(back.autoHidden).toBeUndefined();
  });
});

describe("yjsMitigations CRDT 同期", () => {
  it("A の add が B に伝わる", () => {
    const a = new Y.Doc(), b = new Y.Doc(); bridge(a, b);
    a.getArray(YJS_MITIGATIONS_KEY).push([appliedToYMap(sample())]);
    expect(readMitigations(b)).toEqual([sample()]);
  });

  it("同時 add で両方残る(衝突なしマージ)", () => {
    const a = new Y.Doc(), b = new Y.Doc(); bridge(a, b);
    a.getArray(YJS_MITIGATIONS_KEY).push([appliedToYMap(sample({ id: "a1" }))]);
    b.getArray(YJS_MITIGATIONS_KEY).push([appliedToYMap(sample({ id: "b1", ownerId: "H1" }))]);
    expect(readMitigations(a).map((m) => m.id).sort()).toEqual(["a1", "b1"]);
    expect(readMitigations(b).map((m) => m.id).sort()).toEqual(["a1", "b1"]);
  });

  it("updateMitigationTime 相当(Y.Map の time set)が伝わる", () => {
    const a = new Y.Doc(), b = new Y.Doc(); bridge(a, b);
    const arr = a.getArray<Y.Map<unknown>>(YJS_MITIGATIONS_KEY);
    arr.push([appliedToYMap(sample({ id: "m1", time: 30 }))]);
    arr.get(0).set("time", 45);
    expect(readMitigations(b)[0].time).toBe(45);
  });

  it("remove(index delete)が伝わる", () => {
    const a = new Y.Doc(), b = new Y.Doc(); bridge(a, b);
    const arr = a.getArray<Y.Map<unknown>>(YJS_MITIGATIONS_KEY);
    arr.push([appliedToYMap(sample({ id: "m1" }))]);
    arr.delete(0, 1);
    expect(readMitigations(b)).toEqual([]);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx vitest run src/lib/collab/yjsMitigations.test.ts
```
Expected: FAIL(`./yjsMitigations` が存在しない / export 未定義)。

- [ ] **Step 3: 実装を書く**

```ts
import * as Y from "yjs";
import type { AppliedMitigation } from "../../types";

/** Y.Doc トップレベルの軽減配置キー(②-b 以降も同じ Y.Doc にキーを並べる)。 */
export const YJS_MITIGATIONS_KEY = "timelineMitigations";

/** AppliedMitigation を 1 個の Y.Map に変換。任意フィールドは値があるときだけ set。 */
export function appliedToYMap(m: AppliedMitigation): Y.Map<unknown> {
  const y = new Y.Map<unknown>();
  y.set("id", m.id);
  y.set("mitigationId", m.mitigationId);
  y.set("time", m.time);
  y.set("duration", m.duration);
  y.set("ownerId", m.ownerId);
  if (m.targetId !== undefined) y.set("targetId", m.targetId);
  if (m.linkedMitigationId !== undefined) y.set("linkedMitigationId", m.linkedMitigationId);
  if (m.autoHidden !== undefined) y.set("autoHidden", m.autoHidden);
  return y;
}

/** Y.Map → AppliedMitigation。未設定の任意フィールドは undefined のまま。 */
export function yMapToApplied(y: Y.Map<unknown>): AppliedMitigation {
  const m: AppliedMitigation = {
    id: y.get("id") as string,
    mitigationId: y.get("mitigationId") as string,
    time: y.get("time") as number,
    duration: y.get("duration") as number,
    ownerId: y.get("ownerId") as string,
  };
  if (y.has("targetId")) m.targetId = y.get("targetId") as string;
  if (y.has("linkedMitigationId")) m.linkedMitigationId = y.get("linkedMitigationId") as string;
  if (y.has("autoHidden")) m.autoHidden = y.get("autoHidden") as boolean;
  return m;
}

/** Y.Doc から軽減配置の配列を読む。 */
export function readMitigations(doc: Y.Doc): AppliedMitigation[] {
  return doc.getArray<Y.Map<unknown>>(YJS_MITIGATIONS_KEY).toArray().map(yMapToApplied);
}

/** Y.Array 内で id に一致する要素の index を返す(なければ -1)。 */
export function indexOfMitigation(arr: Y.Array<Y.Map<unknown>>, id: string): number {
  for (let i = 0; i < arr.length; i++) {
    if (arr.get(i).get("id") === id) return i;
  }
  return -1;
}
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npx vitest run src/lib/collab/yjsMitigations.test.ts
```
Expected: 6テスト PASS。

- [ ] **Step 5: コミット**

```bash
rtk git add src/lib/collab/yjsMitigations.ts src/lib/collab/yjsMitigations.test.ts
rtk git commit -m "feat(collab): Yjs 軽減配置の純粋変換+CRDT 同期ロジック (ネットワーク非依存)"
```

---

## Phase 3 — store / provider 統合

### Task 6: store に Yjs バインド状態と適用 action を追加(分岐はまだ入れない)

**Files:**
- Modify: `src/store/useMitigationStore.ts`

まず「Yjs から store へ反映する経路」と入退室 action を追加する(既存 action の分岐は Task 7)。`resolveShieldLinks` / `getMitigationsFromStore` は同ファイルの module スコープ関数([useMitigationStore.ts:207-254](../../../src/store/useMitigationStore.ts#L207-L254) 付近)を再利用する。

- [ ] **Step 1: `MitigationState` インタフェースに状態とシグネチャを追加**

[useMitigationStore.ts:50-83](../../../src/store/useMitigationStore.ts#L50-L83) の state 群の末尾(`_future` の近く)に追加:

```ts
  // --- 共同編集 (段取り②-a) ---
  _ydoc: import("yjs").Doc | null;
  _yarr: import("yjs").Array<import("yjs").Map<unknown>> | null;
  _collabActive: boolean;
```

action 型(同インタフェース内の action 群)に追加:

```ts
  enterCollabMode: (doc: import("yjs").Doc) => void;
  exitCollabMode: () => void;
  /** Yjs の observeDeep から呼ぶ: Y.Array を読んで store の timelineMitigations を再構築。 */
  _applyMitigationsFromYjs: () => void;
```

- [ ] **Step 2: store 初期値に追加**

`create<MitigationState>(...)` の初期 state(他の初期値が並ぶ箇所)に:

```ts
  _ydoc: null,
  _yarr: null,
  _collabActive: false,
```

- [ ] **Step 3: ファイル冒頭の import に Yjs を追加**

```ts
import * as Y from "yjs";
import {
  appliedToYMap,
  readMitigations,
  indexOfMitigation,
  YJS_MITIGATIONS_KEY,
} from "../lib/collab/yjsMitigations";
```

- [ ] **Step 4: action 実装を追加(store の actions 定義ブロック内)**

```ts
  enterCollabMode: (doc) => {
    const yarr = doc.getArray<Y.Map<unknown>>(YJS_MITIGATIONS_KEY);
    // 最初の参加者(部屋が空)なら現在のローカル軽減を seed。2人目以降は部屋の状態が正。
    if (yarr.length === 0) {
      const current = get().timelineMitigations;
      doc.transact(() => {
        current.forEach((m) => yarr.push([appliedToYMap(m)]));
      }, "seed");
    }
    set({ _ydoc: doc, _yarr: yarr, _collabActive: true });
    get()._applyMitigationsFromYjs();
  },

  exitCollabMode: () => {
    set({ _ydoc: null, _yarr: null, _collabActive: false });
    // 以後の編集は従来の set() + 保存フローへ戻る(timelineMitigations は最後の同期状態を保持)。
  },

  _applyMitigationsFromYjs: () => {
    const yarr = get()._yarr;
    if (!yarr) return;
    const raw = readMitigations(get()._ydoc!);
    // 盾連鎖(linkedMitigationId/duration)は派生再計算: 全クライアントで決定論的に同じ結果になる。
    set({ timelineMitigations: resolveShieldLinks(raw, getMitigationsFromStore()) });
  },
```

- [ ] **Step 5: 型チェック + 既存テスト緑を確認(分岐未導入なので 1人モード不変)**

```bash
npm run build
npx vitest run src/store
```
Expected: `tsc` PASS、既存 store テスト PASS(挙動は未変更)。

- [ ] **Step 6: コミット**

```bash
rtk git add src/store/useMitigationStore.ts
rtk git commit -m "feat(collab): store に Yjs バインド状態と入退室/反映 action を追加 (分岐は次タスク)"
```

---

### Task 7: 3 action に Yjs 分岐を入れる(共同編集中は Y.Array 操作へ)

**Files:**
- Modify: `src/store/useMitigationStore.ts`
- Test: `src/store/useMitigationStore.collab.test.ts`(作成)

共同編集中、3 action は `set()` の代わりに `Y.Array` を操作する。**cascade(セラフィム重複削除・requires 依存削除)は Y 操作として同一トランザクション内で実施**。store への反映は `observeDeep`→`_applyMitigationsFromYjs` 経由で起きるので、Yjs 分岐内では `set(timelineMitigations)` を直接呼ばない(プロンプト等の UI state のみ `set`)。

- [ ] **Step 1: 失敗するテストを書く(store を直接 enterCollabMode して Y 操作されることを検証)**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import * as Y from "yjs";
import { useMitigationStore } from "./useMitigationStore";
import { readMitigations, YJS_MITIGATIONS_KEY } from "../lib/collab/yjsMitigations";

const applied = (over = {}) => ({
  id: crypto.randomUUID(), mitigationId: "rampart_pld", time: 30, duration: 20, ownerId: "MT", ...over,
});

describe("useMitigationStore 共同編集分岐", () => {
  beforeEach(() => {
    useMitigationStore.setState({ timelineMitigations: [], _ydoc: null, _yarr: null, _collabActive: false });
  });

  it("共同編集中の addMitigation は Y.Array に push される", () => {
    const doc = new Y.Doc();
    useMitigationStore.getState().enterCollabMode(doc);
    const m = applied({ id: "x1" });
    useMitigationStore.getState().addMitigation(m);
    expect(readMitigations(doc).map((r) => r.id)).toContain("x1");
  });

  it("共同編集中の updateMitigationTime は Y.Map の time を変える", () => {
    const doc = new Y.Doc();
    useMitigationStore.setState({ timelineMitigations: [applied({ id: "x1", time: 30 })] });
    useMitigationStore.getState().enterCollabMode(doc); // seed で x1 が Y.Array に入る
    useMitigationStore.getState().updateMitigationTime("x1", 50);
    expect(readMitigations(doc).find((r) => r.id === "x1")!.time).toBe(50);
  });

  it("共同編集中の removeMitigation は Y.Array から消える", () => {
    const doc = new Y.Doc();
    useMitigationStore.setState({ timelineMitigations: [applied({ id: "x1" })] });
    useMitigationStore.getState().enterCollabMode(doc);
    useMitigationStore.getState().removeMitigation("x1");
    expect(readMitigations(doc).find((r) => r.id === "x1")).toBeUndefined();
  });

  it("exitCollabMode 後は従来通り set() で state が変わる(Y.Array に触らない)", () => {
    const doc = new Y.Doc();
    useMitigationStore.getState().enterCollabMode(doc);
    useMitigationStore.getState().exitCollabMode();
    useMitigationStore.getState().addMitigation(applied({ id: "solo1" }));
    expect(useMitigationStore.getState().timelineMitigations.map((m) => m.id)).toContain("solo1");
    expect(readMitigations(doc)).toEqual([]); // Y.Array は触られていない
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx vitest run src/store/useMitigationStore.collab.test.ts
```
Expected: FAIL(まだ分岐が無く、Y.Array に反映されない / solo1 が Y.Array に入る等)。

- [ ] **Step 3: `addMitigation` の冒頭に Yjs 分岐を追加**

[useMitigationStore.ts:818](../../../src/store/useMitigationStore.ts#L818) の `addMitigation: (mitigation) => {` 直後、`pushHistory();` の**前**に挿入:

```ts
    const yarr = get()._yarr;
    if (get()._collabActive && yarr) {
      get()._ydoc!.transact(() => {
        // セラフィム配置時: 重複する同一学者の転化を Y.Array から削除(既存 set 版と同ロジック)。
        if (mitigation.mitigationId === "summon_seraph") {
          const s = mitigation.time, e = s + 22;
          for (let i = yarr.length - 1; i >= 0; i--) {
            const ym = yarr.get(i);
            if (ym.get("mitigationId") === "dissipation" && ym.get("ownerId") === mitigation.ownerId) {
              const ds = ym.get("time") as number, de = ds + (ym.get("duration") as number);
              if (!(de <= s || ds >= e)) yarr.delete(i, 1);
            }
          }
        }
        yarr.push([appliedToYMap(mitigation)]);
      }, "local");
      // プロンプト等の UI state は従来通りローカルに反映(timelineMitigations は observe 経由で更新)。
      if (mitigation.mitigationId === "aetherflow") {
        set({ aetherflowChainPrompt: { memberId: mitigation.ownerId, startTime: mitigation.time } });
      }
      const isManualDraw = !mitigation.autoHidden &&
        (mitigation.mitigationId === "astral_draw" || mitigation.mitigationId === "umbral_draw");
      if (isManualDraw) {
        set({ astrologianDrawChainPrompt: { memberId: mitigation.ownerId, startTime: mitigation.time, startKind: mitigation.mitigationId as "astral_draw" | "umbral_draw" } });
      }
      useTutorialStore.getState().completeEvent("mitigation:added");
      return;
    }
```

- [ ] **Step 4: `removeMitigation` の冒頭に Yjs 分岐を追加**

[useMitigationStore.ts:871](../../../src/store/useMitigationStore.ts#L871) の `removeMitigation: (id) => {` 直後、`pushHistory();` の**前**に挿入:

```ts
    const yarrRm = get()._yarr;
    if (get()._collabActive && yarrRm) {
      const currentConflict = get().conflictingMitigationId;
      if (currentConflict) set({ conflictingMitigationId: null });
      get()._ydoc!.transact(() => {
        const removedIdx = indexOfMitigation(yarrRm, id);
        if (removedIdx < 0) return;
        const removedYm = yarrRm.get(removedIdx);
        const removedMitId = removedYm.get("mitigationId") as string;
        const removedOwner = removedYm.get("ownerId") as string;
        const removedStart = removedYm.get("time") as number;
        const removedEnd = removedStart + (removedYm.get("duration") as number);
        // requires 依存: 削除軽減に依存し、有効時間に重なる軽減も削除(既存 set 版と同ロジック)。
        const dependentIds = getMitigationsFromStore()
          .filter((d) => d.requires === removedMitId)
          .map((d) => d.id);
        for (let i = yarrRm.length - 1; i >= 0; i--) {
          if (i === removedIdx) continue;
          const ym = yarrRm.get(i);
          const t = ym.get("time") as number;
          if (
            dependentIds.includes(ym.get("mitigationId") as string) &&
            ym.get("ownerId") === removedOwner &&
            t >= removedStart && t < removedEnd
          ) {
            yarrRm.delete(i, 1);
          }
        }
        const finalIdx = indexOfMitigation(yarrRm, id); // 上の削除で index がずれ得るため取り直す
        if (finalIdx >= 0) yarrRm.delete(finalIdx, 1);
      }, "local");
      return;
    }
```

- [ ] **Step 5: `updateMitigationTime` の冒頭に Yjs 分岐を追加**

[useMitigationStore.ts:905](../../../src/store/useMitigationStore.ts#L905) の `updateMitigationTime: (id, newTime) => {` 直後、`pushHistory();` の**前**に挿入:

```ts
    const yarrUp = get()._yarr;
    if (get()._collabActive && yarrUp) {
      get()._ydoc!.transact(() => {
        const idx = indexOfMitigation(yarrUp, id);
        if (idx < 0) return;
        const ym = yarrUp.get(idx);
        ym.set("time", newTime);
        // セラフィム移動時: 重複する転化を削除(既存 set 版と同ロジック)。
        if (ym.get("mitigationId") === "summon_seraph") {
          const s = newTime, e = s + 22;
          const owner = ym.get("ownerId");
          for (let i = yarrUp.length - 1; i >= 0; i--) {
            if (i === idx) continue;
            const other = yarrUp.get(i);
            if (other.get("mitigationId") === "dissipation" && other.get("ownerId") === owner) {
              const ds = other.get("time") as number, de = ds + (other.get("duration") as number);
              if (!(de <= s || ds >= e)) yarrUp.delete(i, 1);
            }
          }
        }
      }, "local");
      return;
    }
```

- [ ] **Step 6: テストが通ることを確認 + 1人モード回帰**

```bash
npx vitest run src/store/useMitigationStore.collab.test.ts src/store
npm run build
```
Expected: 共同編集テスト PASS、既存 store テスト PASS(1人モードは `_collabActive=false` で従来 set 経路)。`tsc` PASS。

- [ ] **Step 7: コミット**

```bash
rtk git add src/store/useMitigationStore.ts src/store/useMitigationStore.collab.test.ts
rtk git commit -m "feat(collab): 3 action に Yjs 分岐 (共同編集中は Y.Array 操作・cascade も Y 化)"
```

---

### Task 8: provider 接続層(YProvider 生成/seed/observeDeep/destroy)

**Files:**
- Create: `src/lib/collab/collabProvider.ts`

接続〜store バインドを1モジュールに集約。`synced` を待ってから `enterCollabMode`(seed の最初の参加者判定を sync 後に行う)、`observeDeep` で `_applyMitigationsFromYjs` を駆動、`destroy` で解除。

- [ ] **Step 1: 実装を書く**

```ts
import * as Y from "yjs";
import YProvider from "y-partyserver/provider";
import { useMitigationStore } from "../../store/useMitigationStore";
import { YJS_MITIGATIONS_KEY } from "./yjsMitigations";

// 本番 collab Worker のホスト(段取り①でデプロイ済)。dev では同 Worker を指す。
const COLLAB_HOST = "lopo-collab.masaya-maeno0106.workers.dev";

export interface CollabSession {
  provider: YProvider;
  doc: Y.Doc;
  disconnect: () => void;
}

/**
 * plan ID を部屋として共同編集セッションを開始する。
 * サーバ routing /parties/room/<id> に合わせ party:"room" を指定。
 */
export function startCollabSession(planId: string): CollabSession {
  const doc = new Y.Doc();
  const provider = new YProvider(COLLAB_HOST, planId, doc, { party: "room", connect: true });
  const yarr = doc.getArray<Y.Map<unknown>>(YJS_MITIGATIONS_KEY);

  const apply = () => useMitigationStore.getState()._applyMitigationsFromYjs();
  // Y.Map 内フィールド変更(time の set 等)も拾うため observe ではなく observeDeep。
  yarr.observeDeep(apply);

  // 初期同期完了後に入室処理(seed の最初の参加者判定を sync 後に確定させる)。
  const onSynced = (isSynced: boolean) => {
    if (isSynced) useMitigationStore.getState().enterCollabMode(doc);
  };
  provider.on("sync", onSynced);

  const disconnect = () => {
    provider.off("sync", onSynced);
    yarr.unobserveDeep(apply);
    useMitigationStore.getState().exitCollabMode();
    provider.destroy(); // disconnect + doc/awareness リスナー解除
    doc.destroy();
  };

  return { provider, doc, disconnect };
}
```

- [ ] **Step 2: 型チェック**

```bash
npm run build
```
Expected: PASS。`YProvider` のデフォルト import と `provider.on/off("sync", ...)` のシグネチャが `y-partyserver` の型と一致すること。`y-partyserver/provider` の型が見つからない場合は `node_modules/y-partyserver` の `package.json` の `exports` を確認し import パスを調整。

- [ ] **Step 3: コミット**

```bash
rtk git add src/lib/collab/collabProvider.ts
rtk git commit -m "feat(collab): YProvider 接続層 (sync後 seed / observeDeep / destroy)"
```

---

### Task 9: 共同編集中の Firestore 自動保存を抑制

**Files:**
- Modify: `src/components/Layout.tsx`

共同編集中、2クライアントが各自 Firestore を後勝ち上書きするのを防ぐ(設計書 §2-2)。localStorage(`saveSilently`)は継続。`syncToCloud()`([Layout.tsx:225-238](../../../src/components/Layout.tsx#L225-L238))の冒頭でガードする。

- [ ] **Step 1: `syncToCloud` の冒頭にガードを追加**

[Layout.tsx:225](../../../src/components/Layout.tsx#L225) の `const syncToCloud = (force = false) => {` 直後に挿入:

```ts
        // 共同編集中は Firestore への確定保存を抑制(後勝ち上書き合戦の防止)。
        // localStorage の saveSilently は継続。恒久保存は段取り③で DO が代表実施。
        if (useMitigationStore.getState()._collabActive) return;
```

`useMitigationStore` が Layout.tsx で未 import なら import を追加(既存の購読で使っているはずなので確認)。

- [ ] **Step 2: 抑制を検証するテスト or 手動確認**

`_collabActive` を true にした状態で `timelineMitigations` を変えても `syncToFirestore` が呼ばれないことを、`planService.syncDirtyPlans` を spy する単体テストで確認(既存テストパターンに倣う)。テストが重い場合は Task 11 の実機確認(Network タブで PUT が飛ばないこと)で代替し、その旨を進捗メモに記録。

- [ ] **Step 3: 型チェック + 既存テスト**

```bash
npm run build
npx vitest run src/components
```
Expected: PASS(1人モードでは `_collabActive=false` で従来通り同期)。

- [ ] **Step 4: コミット**

```bash
rtk git add src/components/Layout.tsx
rtk git commit -m "feat(collab): 共同編集中は Firestore 自動保存を抑制 (localStorage は継続)"
```

---

### Task 10: ②-a 検証用の最小「一緒に編集」トグル

**Files:**
- Create: `src/components/CollabToggle.tsx`
- Modify: `src/components/Layout.tsx`(トグルを 1 箇所マウント)

完全な共有リンク UI / ログイン必須化は段取り⑤。②-a は**結線の確立**に集中するため、現在の plan ID で部屋に出入りする最小トグルのみ置く。

- [ ] **Step 1: トグルコンポーネントを書く**

```tsx
import { useRef, useState } from "react";
import { usePlanStore } from "../store/usePlanStore";
import { startCollabSession, type CollabSession } from "../lib/collab/collabProvider";

/** 段取り②-a 検証用の最小トグル。現在の plan ID を部屋にして共同編集を開始/終了する。 */
export function CollabToggle() {
  const [active, setActive] = useState(false);
  const sessionRef = useRef<CollabSession | null>(null);
  const currentPlanId = usePlanStore((s) => s.currentPlanId);

  const toggle = () => {
    if (active) {
      sessionRef.current?.disconnect();
      sessionRef.current = null;
      setActive(false);
    } else {
      if (!currentPlanId) return;
      sessionRef.current = startCollabSession(currentPlanId);
      setActive(true);
    }
  };

  return (
    <button type="button" onClick={toggle} disabled={!currentPlanId} aria-pressed={active}>
      {active ? "共同編集を終了" : "一緒に編集"}
    </button>
  );
}
```

- [ ] **Step 2: Layout のツールバー付近に 1 箇所マウント**

[Layout.tsx](../../../src/components/Layout.tsx) の既存ツールバー/ヘッダ領域に `<CollabToggle />` を 1 箇所追加(既存レイアウトを壊さない位置)。配置の見た目調整は段取り⑤で行う前提で最小限に。

- [ ] **Step 3: 型チェック + ビルド**

```bash
npm run build
```
Expected: PASS。

- [ ] **Step 4: コミット**

```bash
rtk git add src/components/CollabToggle.tsx src/components/Layout.tsx
rtk git commit -m "feat(collab): ②-a 検証用の最小『一緒に編集』トグル (完全UIは段取り⑤)"
```

---

## Phase 4 — 統合実機検証

### Task 11: 2ブラウザでライブ同期を確認

**Files:** なし(検証のみ)

- [ ] **Step 1: 全テスト + ビルドの最終確認**

```bash
npm run build
npx vitest run
cd workers/collab && npm run test && cd ../..
```
Expected: 全 PASS([[feedback_vercel_tsc_strict]] 通り push 前に `npm run build` + `vitest run` 必須)。

- [ ] **Step 2: dev では検証できない点を理解する**

`/api/*` 同様、YProvider は本番 collab Worker(`COLLAB_HOST`)へ直接 WebSocket するため、ローカル dev でも**本番の lopo-collab に繋がる**(段取り①と同じ)。dev で UI を出しつつ同期相手は本番 DO。問題なし。

- [ ] **Step 3: 私(Claude)が node 2クライアントで再実証(Task 4 のスクリプト)**

```bash
cd workers/collab && node scripts/verify-yjs-sync.mjs
```
Expected: `[1] [2] [3]` すべて true。

- [ ] **Step 4: ユーザーが 2 ブラウザで確認(依頼する手順)**

1. 同じ軽減表(同じ plan)を 2 つのブラウザ(またはシークレットウィンドウ)で開く。
2. 両方で「一緒に編集」を押す。
3. 片方で軽減を**置く / 動かす / 消す** → もう片方にライブで反映されるか。
4. 2人が**同時に別の軽減**を置く → 両方残るか(衝突なしマージ)。
5. 「共同編集を終了」を押すと従来モードに戻り、以後の編集は各自の表に保存されるか。
6. (限界の確認)両方が終了/離脱して部屋が空になった後に開き直すと、共同編集分は残らない = ②-a の仕様通り(恒久保存は段取り③)。

- [ ] **Step 5: 検証結果を記録**

`docs/.private/2026-06-03-realtime-collab-and-sync-notes.md` に ②-a の実機結果(同期 OK / 同時編集両方残る / Firestore 抑制で 1人モード無影響)を追記。`docs/TODO.md` の「現在の状態」を ②-a 完了・次=②-b(他要素同期)or ③(保存)へ更新。

---

## Self-Review(計画と設計書の突き合わせ)

- **§1 ゴール**(2人で timelineMitigations 同時編集 / 衝突なしマージ / 1人モード無影響): Task 5(CRDT 検証)・Task 7(分岐)・Task 11(実機)で達成。1人モード無影響は `_collabActive` 分岐 + 既存テスト緑で担保。
- **§2 アーキ「共同編集中だけ Yjs」**: Task 6-8。**§9 改訂(YServer 化・hibernation)**: Task 2-4。
- **§3 データモデル(要素単位 Y.Map)**: Task 5 で実装。
- **§4 結合方式(3 action 分岐 / observe→store / Firestore 抑制)**: Task 7(分岐・cascade Y 化)・Task 8(observeDeep)・Task 9(抑制)。
- **§5 保存の限界(揮発)**: Task 2(onSave 未実装)・Task 11 Step4-6 で確認。
- **§6 部屋=plan ID**: Task 8 / Task 10。
- **§7 テスト**: ユニット=Task 5/7、本番結線=Task 4/11。既存テスト緑=各タスクで確認。
- **盾連鎖**: `_applyMitigationsFromYjs` が `resolveShieldLinks` を派生再計算(Task 6)。cascade(セラフィム/requires)は acting client が Y 操作(Task 7)。
- **型整合**: `YJS_MITIGATIONS_KEY` / `appliedToYMap` / `yMapToApplied` / `readMitigations` / `indexOfMitigation` / `enterCollabMode` / `exitCollabMode` / `_applyMitigationsFromYjs` / `_collabActive` / `_ydoc` / `_yarr` を全タスクで同名使用。

### 既知の割り切り(②-a スコープ)
- **盾連鎖の duration/linkedMitigationId は Y.Doc に保存せず派生再計算**。決定論的なので全クライアントで一致するが、もし非決定論が判明したら ②-b で Y 化を再検討。
- **seed の最初の参加者判定**は `synced` 後の `yarr.length===0`。両者ほぼ同時入室の稀なレースは ②-a では許容(設計書 §116、③/⑤で本格化)。
- **Undo/Redo の CRDT 化は ②-c**。共同編集中の `pushHistory` 由来の undo は ②-a では未対応(分岐内で pushHistory を呼ばない)。
- **プラン切替・タブ閉じ等の離脱系**は最小限(トグル終了 = disconnect)。本格対応は ③/⑤。

---

## 進捗メモ(実装者が追記)

- (Task 1) vitest-pool-workers 更新の可否と判断: **更新は据え置き(0.9.14 のまま)。テストは現状赤(4 failed | 1 passed)で許容**。
  - 依存追加結果: `yjs@^13.6.31` / `y-partyserver@^2.2.0` 追加。`y-partyserver@^2` の peer 要求 `partyserver >=0.2.0 <1.0.0` のため、`partyserver` を `^0.0.71` → `^0.5.6` へ更新(同時に `y-protocols@1.0.7` / `lib0` が入る)。
  - 真因(workerd 追随では解決しない): `partyserver@0.5.x` の `routePartykitRequest` は `idFromName(name)` でスタブを作り、もはや `x-partykit-room` ヘッダを設定せず、DO 名解決を `this.ctx.id.name` に依存する(`node_modules/partyserver/dist/index.js` L442・L508-519 で確認)。テスト経路の miniflare/workerd では `idFromName` 経由でも `ctx.id.name` が undefined のままで、`Error: Cannot determine the name for Room: this.ctx.id.name is undefined ...` が出て fetch が 500/throw する。
  - vitest-pool-workers を上げても解消せず: `@latest`=0.16.12 は `vitest@^4.1.0` を peer 要求(本プロジェクトは vitest@^3.2.0)。vitest 3 互換で最も新しいのは `0.12.21`(miniflare 4.20260310.0 / workerd 2026-03-10)で、これを入れると警告は `2025-10-11`→`2026-03-10` に進むが、それでも miniflare が `ctx.id.name` を露出せず同じエラーで 4 failed のまま。`0.13.0` 以降は vitest 4 メジャー更新が必須で本 Task 範囲外。
  - 据え置き判断: 計画 Step3 の指示どおり `@cloudflare/vitest-pool-workers` を `^0.9.0` に戻した(`npm install` で lock 再整合、0.9.14 解決)。Yjs 同期検証は後続 Task の本番 node 結線(本番 wrangler 4.97 / workerd 2026-06-01 = `ctx.id.name` 露出あり)を正典とする。
  - 残課題(後続 Task で対処）: テスト経路は partyserver 0.5.x の name 解決と非互換なため、既存5テストのうち4本(中継/在室数系)が赤のまま。本番 workerd か vitest 4 移行のいずれかで解消する。1本目(101 を返す upgrade テスト)のみ green。
- (Task 4) 本番 Yjs 同期検証の結果:
- (Task 9) Firestore 抑制の検証方法(テスト or 実機):
- (Task 11) 2ブラウザ実機結果:
