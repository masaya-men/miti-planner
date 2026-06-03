# リアルタイム共同編集 段取り① — ライブ部屋(DO)+WebSocket骨組み 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cloudflare 無料プラン上に、partyserver(=PartyKit後継/Cloudflare公式) ベースの「ライブ部屋」Worker を新設し、WebSocket で複数クライアントが接続・退室・相互中継(broadcast)できる骨組みをデプロイする。

**Architecture:** 既存 `workers/media-proxy/`(stateless fetch Worker, デプロイ済) と同じ「`workers/<name>/` に独立npmプロジェクト + `wrangler deploy`」パターンを複製する。新規要素は **Durable Object (1部屋=1 DO) + WebSocket**。無料プラン制約により DO は **SQLite-backed (`new_sqlite_classes`)** で定義する。Yjs / Firestore / 認証 / presence は本段取りに含めず、後続段取り②〜⑦で上に乗せる。

**Tech Stack:** Cloudflare Workers + Durable Objects (SQLite-backed) / partyserver / wrangler v4 / TypeScript / @cloudflare/vitest-pool-workers (Miniflare) でのユニットテスト。

---

## スコープ境界 (重要)

設計書 [docs/superpowers/specs/2026-06-03-realtime-collab-design.md](../specs/2026-06-03-realtime-collab-design.md) セクション9 の段取り①のみを対象とする。

**本計画に含む:**
- `workers/collab/` Worker プロジェクト新設 (media-proxy パターン複製)
- partyserver の `Server` を継承した `Room` クラス (1部屋=1 DO)
- WebSocket 接続 (upgrade→101) / メッセージ中継 (broadcast) / 退室 (onClose) の骨組み
- SQLite-backed DO (無料プラン要件)
- vitest-pool-workers でのテスト
- `wrangler deploy` でのデプロイ + workers.dev での疎通確認

**本計画に含まない (後続段取り):**
- ② Yjs で `PlanData` を共有型化 + `useMitigationStore` 結合
- ③ Firestore からの seed / 書き戻し (y-partyserver の onLoad/onSave)
- ④ presence / awareness / カーソル (P2P)
- ⑤ 共有リンク / 認証 (Discord ログイン必須) / 人数上限 / 緊急停止スイッチ / カスタムドメイン
- ⑥ ポリシー・規約の多言語文面
- ⑦ 負荷テスト
- フロントエンド(React)側の接続UI (本段取りはサーバ側のみで testable)

**前提事実 (調査済 2026-06-03):**
- Cloudflare アカウントは Workers **無料プラン**。無料プランで DO を使うには **SQLite storage backend 必須**(KV-backed は有料プラン専用)。SQLite-backed は無料プランでストレージ課金されない。出典: [DO limits](https://developers.cloudflare.com/durable-objects/platform/limits/) / [DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)。
- 既存 Worker のデプロイ経路は確立済 ([workers/media-proxy/package.json](../../../workers/media-proxy/package.json) の `deploy: wrangler deploy`)。Vercel(本体)とは別経路の手動デプロイ。
- `PlanData` 型 = [src/types/index.ts:228-244](../../../src/types/index.ts#L228-L244)。本段取りでは未使用(②から)。

---

## File Structure (本計画で作成するファイル)

すべて新規。既存コード(`src/`, Vercel側)には一切手を入れない。

| ファイル | 責務 |
|---|---|
| `workers/collab/package.json` | collab Worker の独立npmプロジェクト定義 (scripts: dev/deploy/test/typecheck) |
| `workers/collab/tsconfig.json` | Worker用 TS設定 (media-proxy のものを複製) |
| `workers/collab/wrangler.jsonc` | Worker名 / DO binding / SQLite migration |
| `workers/collab/src/server.ts` | `Room` クラス (partyserver `Server` 継承)。接続・中継・退室の骨組み |
| `workers/collab/src/index.ts` | Worker の default export。`routePartykitRequest` でルーティング + `Room` re-export |
| `workers/collab/vitest.config.ts` | vitest-pool-workers 設定 (Miniflare 上で Worker をテスト) |
| `workers/collab/src/server.test.ts` | WebSocket 疎通 / broadcast / 退室のテスト |
| `workers/collab/.gitignore` | `node_modules` 等を除外 |

---

## Task 1: collab Worker プロジェクトの骨組みを作る

**Files:**
- Create: `workers/collab/package.json`
- Create: `workers/collab/tsconfig.json`
- Create: `workers/collab/.gitignore`
- Create: `workers/collab/wrangler.jsonc`
- Create: `workers/collab/src/server.ts`
- Create: `workers/collab/src/index.ts`

- [ ] **Step 1: `package.json` を作成**

`workers/collab/package.json`:

```json
{
  "name": "lopo-collab",
  "private": true,
  "version": "0.0.0",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "partyserver": "^0.0.71"
  },
  "devDependencies": {
    "@cloudflare/vitest-pool-workers": "^0.9.0",
    "@cloudflare/workers-types": "^4",
    "typescript": "~5.9.3",
    "vitest": "^3.2.0",
    "wrangler": "^4"
  }
}
```

> 注: `@cloudflare/vitest-pool-workers` は対応する `vitest` メジャーが固定される。インストール時に peer 警告が出たら、pool-workers が要求するバージョンに `vitest` を合わせる(このプロジェクトは `workers/collab/node_modules` が独立しているので、本体アプリの vitest^4 とは無関係に選べる)。`partyserver` のバージョンは Step 2 の `npm install partyserver` 実行後に `package.json` に入った実際の値へ揃える。

- [ ] **Step 2: 依存をインストール**

Run:
```bash
cd workers/collab && npm install
```
Expected: `node_modules` が作られ、`partyserver` / `wrangler` / `@cloudflare/vitest-pool-workers` が入る。エラーなく完了。

- [ ] **Step 3: `tsconfig.json` を作成** (media-proxy のものを複製)

`workers/collab/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: `.gitignore` を作成**

`workers/collab/.gitignore`:

```
node_modules/
.wrangler/
dist/
```

- [ ] **Step 5: `wrangler.jsonc` を作成** (DO binding + SQLite migration)

`workers/collab/wrangler.jsonc`:

```jsonc
{
  // ライブ部屋 Worker。1部屋 = 1 Durable Object。
  // 無料プラン要件: DO は SQLite-backed (new_sqlite_classes) で定義する。
  "name": "lopo-collab",
  "main": "src/index.ts",
  "compatibility_date": "2026-05-29",
  "durable_objects": {
    "bindings": [{ "name": "Room", "class_name": "Room" }]
  },
  "migrations": [
    { "tag": "v1", "new_sqlite_classes": ["Room"] }
  ]
}
```

> binding 名 `Room` により、接続URLは `/parties/room/<部屋ID>` になる (routePartykitRequest はサーバ名を binding 名に case-insensitive で対応させる)。

- [ ] **Step 6: 最小の `Room` クラスを作成**

`workers/collab/src/server.ts`:

```typescript
import { Server, type Connection, type ConnectionContext } from "partyserver";

/**
 * ライブ部屋。1部屋 = 1 Durable Object。
 * 段取り①では「接続を受け、メッセージを他の在室者へ中継する」だけの骨組み。
 * Yjs / Firestore / 認証 / presence は後続段取りで上に乗せる。
 */
export class Room extends Server {
  // 接続が確立したとき。段取り①では受け入れるだけ。
  onConnect(_connection: Connection, _ctx: ConnectionContext): void {}

  // 在室者からメッセージが来たら、送信者以外の全員へ中継する。
  onMessage(connection: Connection, message: string | ArrayBuffer): void {
    this.broadcast(message, [connection.id]);
  }
}
```

- [ ] **Step 7: Worker の `index.ts` を作成** (ルーティング)

`workers/collab/src/index.ts`:

```typescript
import { routePartykitRequest } from "partyserver";

export { Room } from "./server";

export interface Env {
  Room: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (
      (await routePartykitRequest(request, env)) ||
      new Response("Not Found", { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;
```

- [ ] **Step 8: 型チェックが通ることを確認**

Run:
```bash
cd workers/collab && npm run typecheck
```
Expected: エラーなし (exit 0)。

- [ ] **Step 9: コミット**

```bash
cd workers/collab && git add package.json package-lock.json tsconfig.json .gitignore wrangler.jsonc src/server.ts src/index.ts
git commit -m "feat(collab): ライブ部屋Workerの骨組み (partyserver + SQLite-backed DO)"
```

---

## Task 2: WebSocket 接続テストの基盤を作り、upgrade を検証する

**Files:**
- Create: `workers/collab/vitest.config.ts`
- Create: `workers/collab/src/server.test.ts`

- [ ] **Step 1: vitest-pool-workers の設定を作成**

`workers/collab/vitest.config.ts`:

```typescript
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        // wrangler.jsonc の DO binding / migration をそのままテスト環境へ読み込む。
        wrangler: { configPath: "./wrangler.jsonc" },
      },
    },
  },
});
```

- [ ] **Step 2: 失敗するテストを書く** (WebSocket upgrade)

`workers/collab/src/server.test.ts`:

```typescript
import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("Room", () => {
  it("WebSocket の upgrade 要求に 101 を返す", async () => {
    const res = await SELF.fetch("https://collab.test/parties/room/test-room", {
      headers: { Upgrade: "websocket" },
    });
    expect(res.status).toBe(101);
    expect(res.webSocket).toBeTruthy();
  });
});
```

- [ ] **Step 3: テストを実行して、まず通ること(または失敗理由)を確認**

Run:
```bash
cd workers/collab && npm test
```
Expected: Task 1 で `Room` は実装済みなので **このテストは PASS** する。もし FAIL する場合、まず想定するのは「`cloudflare:test` 解決不可 = pool-workers 未設定」または「DO binding 不一致」。その場合は `vitest.config.ts` の `configPath` と `wrangler.jsonc` の binding 名 `Room` を突き合わせて直す。

> TDD 補足: Task 1 で先に骨組みを置いたため、本タスクは「テスト基盤が正しく Worker を起動できるか」の検証が主目的。次の Task 3 以降は厳密に red→green で進める。

- [ ] **Step 4: コミット**

```bash
cd workers/collab && git add vitest.config.ts src/server.test.ts
git commit -m "test(collab): vitest-pool-workers基盤 + WebSocket upgrade検証"
```

---

## Task 3: メッセージ中継 (broadcast) を TDD で実装する

`Room.onMessage` は Task 1 で実装済みだが、ここで **2接続間の中継が実際に届くこと**をテストで保証する。

**Files:**
- Modify: `workers/collab/src/server.test.ts` (テスト追加)
- Modify: `workers/collab/src/server.ts` (必要なら調整)

- [ ] **Step 1: 失敗するテストを書く** (送信者以外へ中継)

`workers/collab/src/server.test.ts` の `describe("Room", ...)` 内に追加:

```typescript
  it("ある接続のメッセージを、他の在室者へ中継する", async () => {
    const url = "https://collab.test/parties/room/broadcast-room";

    const resA = await SELF.fetch(url, { headers: { Upgrade: "websocket" } });
    const resB = await SELF.fetch(url, { headers: { Upgrade: "websocket" } });
    const a = resA.webSocket!;
    const b = resB.webSocket!;
    a.accept();
    b.accept();

    const receivedByB = new Promise<string>((resolve) => {
      b.addEventListener("message", (e) => resolve(e.data as string));
    });

    a.send("hello-from-a");
    expect(await receivedByB).toBe("hello-from-a");
  });
```

- [ ] **Step 2: テストを実行して結果を確認**

Run:
```bash
cd workers/collab && npm test
```
Expected: `Room.onMessage` が `this.broadcast(message, [connection.id])` を持つので **PASS**。

> もし FAIL (B が受信しない) する場合に疑うこと: ①同じ部屋名 `broadcast-room` で fetch しているか(別名だと別 DO になり中継されない) ②`a.accept()`/`b.accept()` を呼んでいるか ③`broadcast` の第2引数 exclude が `[connection.id]` で送信者だけを除いているか。

- [ ] **Step 3: 送信者には返らないことも検証 (テスト追加)**

`workers/collab/src/server.test.ts` に追加:

```typescript
  it("中継は送信者自身には返らない", async () => {
    const url = "https://collab.test/parties/room/no-echo-room";

    const a = (await SELF.fetch(url, { headers: { Upgrade: "websocket" } })).webSocket!;
    const b = (await SELF.fetch(url, { headers: { Upgrade: "websocket" } })).webSocket!;
    a.accept();
    b.accept();

    let aGotEcho = false;
    a.addEventListener("message", () => { aGotEcho = true; });
    const receivedByB = new Promise<string>((resolve) => {
      b.addEventListener("message", (e) => resolve(e.data as string));
    });

    a.send("ping");
    await receivedByB; // B が受け取るまで待つ
    expect(aGotEcho).toBe(false);
  });
```

- [ ] **Step 4: テストを実行して PASS を確認**

Run:
```bash
cd workers/collab && npm test
```
Expected: 全テスト PASS。

- [ ] **Step 5: コミット**

```bash
cd workers/collab && git add src/server.test.ts src/server.ts
git commit -m "test(collab): broadcast中継(送信者除外)をテストで保証"
```

---

## Task 4: 退室と在室数を扱う (部屋ライフサイクルの骨組み)

設計書セクション2「誰もいない部屋は存在しない」「部屋クローズ」の足場。段取り③(書き戻し)で `onClose` の「最後の1人が抜けたら保存」に発展させるため、ここで **在室管理 + 退室イベント**を入れる。

**Files:**
- Modify: `workers/collab/src/server.ts`
- Modify: `workers/collab/src/server.test.ts`

- [ ] **Step 1: 失敗するテストを書く** (HTTPで在室数が取れる)

partyserver の `Server` は WebSocket 以外の通常HTTPを `onRequest` で受けられる。在室数を返す `GET` を期待するテストを追加。

`workers/collab/src/server.test.ts` に追加:

```typescript
  it("WebSocket 接続中は、在室数を HTTP GET で取得できる", async () => {
    const wsUrl = "https://collab.test/parties/room/count-room";
    const countUrl = "https://collab.test/parties/room/count-room/count";

    const a = (await SELF.fetch(wsUrl, { headers: { Upgrade: "websocket" } })).webSocket!;
    a.accept();

    const res = await SELF.fetch(countUrl);
    expect(res.status).toBe(200);
    const body = await res.json<{ count: number }>();
    expect(body.count).toBe(1);
  });
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run:
```bash
cd workers/collab && npm test
```
Expected: FAIL。`onRequest` 未実装のため `/count` が 404 (`routePartykitRequest` は DO まで到達するが `onRequest` 既定が空)。

- [ ] **Step 3: `Room` に在室数HTTPを実装**

`workers/collab/src/server.ts` を以下に更新:

```typescript
import { Server, type Connection, type ConnectionContext } from "partyserver";

/**
 * ライブ部屋。1部屋 = 1 Durable Object。
 * 段取り①では「接続を受け、メッセージを他の在室者へ中継し、在室数を答える」骨組み。
 * Yjs / Firestore / 認証 / presence は後続段取りで上に乗せる。
 */
export class Room extends Server {
  onConnect(_connection: Connection, _ctx: ConnectionContext): void {}

  onMessage(connection: Connection, message: string | ArrayBuffer): void {
    this.broadcast(message, [connection.id]);
  }

  // 通常HTTP。段取り①では在室数の確認だけ (デバッグ/疎通用)。
  onRequest(request: Request): Response {
    const url = new URL(request.url);
    if (url.pathname.endsWith("/count")) {
      // getConnections() は現在この部屋(DO)に繋がっている WebSocket 接続の反復子。
      const count = [...this.getConnections()].length;
      return Response.json({ count });
    }
    return new Response("Not Found", { status: 404 });
  }
}
```

> `getConnections()` は partyserver `Server` の API。WebSocket Hibernation 対応で、休眠から復帰しても現在の接続を列挙できる。

- [ ] **Step 4: テストを実行して PASS を確認**

Run:
```bash
cd workers/collab && npm test
```
Expected: 全テスト PASS。

- [ ] **Step 5: 退室で在室数が減ることを検証 (テスト追加)**

`workers/collab/src/server.test.ts` に追加:

```typescript
  it("接続を閉じると在室数が減る", async () => {
    const wsUrl = "https://collab.test/parties/room/leave-room";
    const countUrl = "https://collab.test/parties/room/leave-room/count";

    const a = (await SELF.fetch(wsUrl, { headers: { Upgrade: "websocket" } })).webSocket!;
    a.accept();
    expect((await (await SELF.fetch(countUrl)).json<{ count: number }>()).count).toBe(1);

    const closed = new Promise<void>((resolve) => {
      a.addEventListener("close", () => resolve());
    });
    a.close();
    await closed;

    // close 反映を待ってから再取得
    const after = await (await SELF.fetch(countUrl)).json<{ count: number }>();
    expect(after.count).toBe(0);
  });
```

- [ ] **Step 6: テストを実行して結果を確認**

Run:
```bash
cd workers/collab && npm test
```
Expected: PASS。もし `count` が 0 にならない場合、`getConnections()` が close 済み接続をまだ含むタイミング問題の可能性 → `a.close()` 後の `close` イベント待ちで十分なはずだが、不安定なら partyserver の `onClose` フックで明示的に状態を持つ実装へ切り替える(その場合は本ステップで `onClose` を追加実装し、テストを green 化する)。

- [ ] **Step 7: 型チェック + 全テスト**

Run:
```bash
cd workers/collab && npm run typecheck && npm test
```
Expected: 両方ともエラーなし / 全 PASS。

- [ ] **Step 8: コミット**

```bash
cd workers/collab && git add src/server.ts src/server.test.ts
git commit -m "feat(collab): 在室数HTTP + 退室で在室数が減る (部屋ライフサイクル骨組み)"
```

---

## Task 5: ローカル起動とデプロイ、疎通確認

**Files:** なし (動作確認とデプロイのみ)

- [ ] **Step 1: ローカルで Worker を起動して目視確認**

Run:
```bash
cd workers/collab && npm run dev
```
Expected: `wrangler dev` が起動し、`http://localhost:8787` 等で待受。起動ログにエラーなし。`/parties/room/<id>/count` に未接続でアクセスすると `{"count":0}` が返る(別ターミナルで `curl http://localhost:8787/parties/room/foo/count`)。確認後 Ctrl+C で停止。

- [ ] **Step 2: デプロイ前のドライ確認 (型 + テスト)**

Run:
```bash
cd workers/collab && npm run typecheck && npm test
```
Expected: エラーなし / 全 PASS。

- [ ] **Step 3: デプロイ**

Run:
```bash
cd workers/collab && npm run deploy
```
Expected: `wrangler deploy` が成功し、`https://lopo-collab.<account>.workers.dev` のような workers.dev URL が表示される。初回は DO migration `v1` (`new_sqlite_classes`) が適用される旨が出る。

> 認証: 初回は `wrangler login`(ブラウザOAuth) が必要な場合がある。media-proxy を deploy 済の同一アカウントなので、既にログイン済なら不要。カスタムドメイン(例 `collab.lopoly.app`)は段取り⑤で割り当てる。本段取りは workers.dev で疎通確認すれば十分。

- [ ] **Step 4: 本番疎通確認 (在室数HTTP)**

Run:
```bash
curl https://lopo-collab.<account>.workers.dev/parties/room/smoke/count
```
Expected: `{"count":0}` が返る (200)。`<account>` は Step 3 の出力に出た実URLに置き換える。

- [ ] **Step 5: 段取り①完了を記録**

`docs/TODO.md` のバックログ「リアルタイム共同編集」行を更新: 「設計書あり→**段取り①(部屋+WS骨組み)実装・デプロイ済**→次は段取り②(Yjsで PlanData 共有型化)」へ。

```bash
cd ../.. && git add docs/TODO.md docs/superpowers/plans/2026-06-03-realtime-collab-step1-room-skeleton.md
git commit -m "docs(collab): 段取り①完了を記録 + 実装計画を追加"
```

---

## Self-Review (計画作成者による点検)

**1. スペック該当:** 設計書セクション9 段取り①「DO の部屋 + WebSocket 骨組み (PartyKit 雛形・部屋ライフサイクル)」= Task 1(雛形) / Task 2-3(WebSocket) / Task 4(ライフサイクル) / Task 5(デプロイ) で網羅。②〜⑦はスコープ外と明記済。セクション4のコスト前提(無料プラン=SQLite-backed)は wrangler.jsonc の `new_sqlite_classes` で担保。

**2. プレースホルダ点検:** 各コード step に実コードあり。`<account>` は wrangler 出力に依存する実値なので「出力に置き換える」と明示(プレースホルダではなく手順)。`partyserver`/`@cloudflare/vitest-pool-workers`/`vitest` のバージョンは npm install 後の実値へ揃える旨を Task1 Step1 に注記。

**3. 型/名称整合:** binding 名 `Room`(wrangler.jsonc) = `class_name` `Room`(src/server.ts export) = re-export(index.ts) = URL `/parties/room/...`(case-insensitive) で一貫。`getConnections()` / `broadcast(message, exclude)` / `onConnect`/`onMessage`/`onRequest` は partyserver 公式 API 名 ([partyserver README](https://github.com/cloudflare/partykit/blob/main/packages/partyserver/README.md)) に一致。

**未確定で実装時に確定する点 (計画内に注記済):**
- `@cloudflare/vitest-pool-workers` が要求する `vitest` メジャー (Task1 Step1)。
- close 後の `getConnections()` 反映タイミング、必要なら `onClose` 明示実装 (Task4 Step6)。
- 初回 `wrangler login` の要否 (Task5 Step3)。

---

## Execution Handoff

この計画は段取り①のみ。完了後、段取り②(Yjsで `PlanData` を共有型化 + `useMitigationStore` 結合 — 本機能の核)を別計画として writing-plans で作成する。
