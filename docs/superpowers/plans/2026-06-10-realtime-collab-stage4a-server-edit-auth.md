# 段取り④-a サーバ側編集認証 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 共同編集ルームへの接続のうち、正規にログインした本人だけがドキュメントへ書き込めるよう Cloudflare Worker / Durable Object 側で強制し、未認証接続の書き込みメッセージをサーバが破棄する。

**Architecture:** クライアントは provider の `params` 関数で現在の Firebase ID トークンをクエリ送付（viewer は無し）。worker `onBeforeConnect` がトークンを Vercel 受付係 `verify` へ委譲検証し、正規本人なら接続要求に信頼ヘッダ `x-collab-uid` を付けて DO へ通す（fail-closed・クライアント由来同名ヘッダは除去）。DO は `onConnect` で接続 state に編集権を記録し、y-partyserver 内蔵の `isReadOnly(connection)` を override して未認証接続の sync step2/update をサーバが破棄する。

**Tech Stack:** Cloudflare Workers / Durable Objects, y-partyserver (`isReadOnly` 内蔵ゲート), partyserver `onBeforeConnect`/`Connection.setState`, Firebase Admin `verifyIdToken`(Vercel 側), Vitest（root: vmThreads / worker: @cloudflare/vitest-pool-workers）。

**設計書:** [docs/superpowers/specs/2026-06-10-realtime-collab-stage4a-server-edit-auth-design.md](../specs/2026-06-10-realtime-collab-stage4a-server-edit-auth-design.md)

**厳守:** dormant（UI 入口を増やさない）/ push・deploy は保留（ユーザー承認まで）/ 既存緑（root・worker・build）を維持 / `timelineMitigations` 等の保存経路・②-a/③ は無改変。

---

## ファイル構成（作成 / 変更）

| ファイル | 種別 | 責務 |
|---|---|---|
| `api/collab/_verifyHandler.ts` | 作成 | x-collab-secret 認証 → Firebase Admin `verifyIdToken` → `{valid, uid}` を返す薄いグルー。 |
| `api/collab/index.ts` | 変更 | `action=verify` 分岐を追加（単純ディスパッチ）。 |
| `vercel.json` | 変更 | `/api/collab/verify → /api/collab?action=verify` の rewrite を追加。 |
| `workers/collab/src/collabAuth.ts` | 作成 | (1) 受付係 verify を叩く純関数 `verifyToken(base,secret,token)→uid|null`（fetchMock テスト）、(2) `EDITOR_UID_HEADER`/`TOKEN_PARAM` 定数、(3) `authorizeConnection(req, verifyFn)→Request`（信頼ヘッダ付与・クライアントヘッダ除去・fail-closed）、(4) `isEditorState(state)→boolean`。 |
| `workers/collab/src/collabAuth.test.ts` | 作成 | 上記純関数の決定的テスト。 |
| `workers/collab/src/index.ts` | 変更 | `onBeforeConnect` に満員判定と並べて `authorizeConnection` を結線。 |
| `workers/collab/src/server.ts` | 変更 | `Room.onConnect`（super 呼び + state 記録）と `Room.isReadOnly` を override。 |
| `src/lib/collab/collabProvider.ts` | 変更 | `YProvider` に `params` 関数（最新 ID トークン or 空）を渡す。 |
| `src/lib/collab/__tests__/collabProvider.params.test.ts` | 作成 | params 関数が「ログイン時=token / 未ログイン=空」を返すことのテスト（純関数抽出）。 |

**テスト分業（既存パターン踏襲）**: 受付係ハンドラは admin グルーのため単体テストせず（既存 `_loadHandler`/`_roomHandler` と同様）、**契約は worker 側 `collabAuth.test.ts` が verify 応答を fetchMock して検証**＋最終スモークで担保。純判定（ヘッダ付与/除去・editor 判定・params）は単体テストする。

---

## Task 1: Vercel 受付係 `verify` エンドポイント

**Files:**
- Create: `api/collab/_verifyHandler.ts`
- Modify: `api/collab/index.ts`
- Modify: `vercel.json`

- [ ] **Step 1: `_verifyHandler.ts` を作成**

`_loadHandler.ts`（secret 認証）と `_roomHandler.ts`（`getAuth().verifyIdToken`）のパターンを合成した薄いグルー。

```ts
// api/collab/_verifyHandler.ts
// ④-a: worker(onBeforeConnect) が接続者の Firebase ID トークンを検証するために叩く受付係。
// 認証は DO↔Vercel 共有シークレット(x-collab-secret)。Firestore は使わず ID トークン検証のみ。
// 先頭 `_` で Vercel 関数ルートにしない。worker 以外から叩けないよう secret 必須。
import { initAdmin } from '../../src/lib/adminAuth.js';
import { authorizeCollab } from './_handlerShared.js';
import { getAuth } from 'firebase-admin/auth';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  if (!authorizeCollab(req.headers['x-collab-secret'])) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const token = typeof req.body?.token === 'string' ? req.body.token : '';
  if (!token) return res.status(200).json({ valid: false });
  try {
    initAdmin();
    const decoded = await getAuth().verifyIdToken(token);
    return res.status(200).json({ valid: true, uid: decoded.uid });
  } catch {
    // 不正/期限切れ/署名不一致 → valid:false(worker は fail-closed で viewer 扱い)。
    return res.status(200).json({ valid: false });
  }
}
```

- [ ] **Step 2: `index.ts` ディスパッチャに verify を追加**

```ts
// api/collab/index.ts (抜粋・import と switch に1行ずつ追加)
import verifyHandler from './_verifyHandler.js';
// ...
    case 'room':
      return roomHandler(req, res);
    case 'verify':
      return verifyHandler(req, res);
    default:
```

冒頭コメントの一覧にも追記:
```ts
 * ?action=verify → POST worker が接続者の ID Token を検証(x-collab-secret 認証)
```

- [ ] **Step 3: `vercel.json` に rewrite を追加**

`/api/collab/save` の行の直後に追加（既存 load/save/room と同型）:
```json
    { "source": "/api/collab/verify", "destination": "/api/collab?action=verify" },
```

- [ ] **Step 4: ビルド緑を確認（受付係は admin グルーで単体テストなし・型と build で担保）**

Run: `npm run build`
Expected: 成功（exit 0）。tsc が `_verifyHandler.ts` の型（`getAuth`/`initAdmin`/`authorizeCollab` の利用）を通すこと。

- [ ] **Step 5: Commit**

```bash
git add api/collab/_verifyHandler.ts api/collab/index.ts vercel.json
git commit -m "feat(collab): stage4a 受付係 verify エンドポイント(ID Token 検証・secret 認証)"
```

---

## Task 2: worker `collabAuth.ts` — verify 委譲の純関数

**Files:**
- Create: `workers/collab/src/collabAuth.ts`
- Test: `workers/collab/src/collabAuth.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`collabPersistence.test.ts` の fetchMock 書式を踏襲。

```ts
// workers/collab/src/collabAuth.test.ts
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
```

- [ ] **Step 2: テスト失敗を確認**

Run: `cd workers/collab && npx vitest run src/collabAuth.test.ts`
Expected: FAIL（`verifyToken` 未定義で import エラー）。

- [ ] **Step 3: 最小実装を書く**

```ts
// workers/collab/src/collabAuth.ts
// ④-a: 接続者の編集権をサーバ側で確かめるためのグルー。
// (1) 受付係 verify を叩く純関数, (2) worker→DO 信頼ヘッダ定数, (3) 接続認可, (4) editor 判定。
// Firebase Admin は Workers 非対応のため検証は Vercel(verify)へ委譲(③ と同型)。

const SECRET_HEADER = "x-collab-secret";

/** worker→DO へ「この接続は編集者(uid)」を伝える信頼ヘッダ。クライアントは WS で付けられない。 */
export const EDITOR_UID_HEADER = "x-collab-uid";
/** クライアントが ID トークンを載せるクエリパラメータ名(provider params)。 */
export const TOKEN_PARAM = "token";

/**
 * 受付係 verify を叩き、正規ログイン本人なら uid を返す。
 * 不正/障害/到達不能/空トークン → null(呼び出し側は fail-closed で viewer 扱い)。
 */
export async function verifyToken(
  base: string,
  secret: string,
  token: string,
): Promise<string | null> {
  if (!token) return null;
  try {
    const res = await fetch(`${base}/api/collab/verify`, {
      method: "POST",
      headers: { "content-type": "application/json", [SECRET_HEADER]: secret },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { valid?: boolean; uid?: string };
    return body.valid && typeof body.uid === "string" ? body.uid : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: テスト成功を確認**

Run: `cd workers/collab && npx vitest run src/collabAuth.test.ts`
Expected: PASS（4 件）。

- [ ] **Step 5: Commit**

```bash
git add workers/collab/src/collabAuth.ts workers/collab/src/collabAuth.test.ts
git commit -m "feat(collab): stage4a worker verifyToken(受付係 verify 委譲・純関数)"
```

---

## Task 3: 接続認可ロジック `authorizeConnection` + `isEditorState`

**Files:**
- Modify: `workers/collab/src/collabAuth.ts`
- Modify: `workers/collab/src/collabAuth.test.ts`

- [ ] **Step 1: 失敗するテストを追加**

`verifyToken` をモック注入し、ヘッダ付与/除去・fail-closed を純粋に検証する。

```ts
// collabAuth.test.ts に追記
import { authorizeConnection, isEditorState, EDITOR_UID_HEADER, TOKEN_PARAM } from "./collabAuth";

describe("authorizeConnection (接続認可・信頼ヘッダ)", () => {
  const reqWith = (token: string | null, extra: Record<string, string> = {}) => {
    const url = token === null
      ? "https://w.dev/parties/room/r1"
      : `https://w.dev/parties/room/r1?${TOKEN_PARAM}=${encodeURIComponent(token)}`;
    return new Request(url, { headers: extra });
  };

  it("正トークン → 信頼ヘッダに uid を付ける", async () => {
    const out = await authorizeConnection(reqWith("good"), async () => "user-9");
    expect(out.headers.get(EDITOR_UID_HEADER)).toBe("user-9");
  });

  it("トークン無し(viewer) → 信頼ヘッダ無し", async () => {
    const out = await authorizeConnection(reqWith(null), async () => "should-not-call");
    expect(out.headers.get(EDITOR_UID_HEADER)).toBeNull();
  });

  it("検証失敗(null) → fail-closed で信頼ヘッダ無し", async () => {
    const out = await authorizeConnection(reqWith("bad"), async () => null);
    expect(out.headers.get(EDITOR_UID_HEADER)).toBeNull();
  });

  it("クライアント由来の x-collab-uid を必ず除去(詐称防止)", async () => {
    // 偽ヘッダを付けて未トークンで接続 → 除去されて viewer のまま。
    const out = await authorizeConnection(
      reqWith(null, { [EDITOR_UID_HEADER]: "spoofed" }),
      async () => null,
    );
    expect(out.headers.get(EDITOR_UID_HEADER)).toBeNull();
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
```

- [ ] **Step 2: テスト失敗を確認**

Run: `cd workers/collab && npx vitest run src/collabAuth.test.ts`
Expected: FAIL（`authorizeConnection`/`isEditorState` 未定義）。

- [ ] **Step 3: 最小実装を追加**

`collabAuth.ts` の末尾に追記:

```ts
/** verify 関数の型(本番=verifyToken の部分適用 / テスト=モック)。 */
export type VerifyFn = (token: string) => Promise<string | null>;

/**
 * 接続要求を認可し、DO へ転送する Request を返す。
 * - クライアント由来の信頼ヘッダは必ず除去(詐称防止)。
 * - クエリの token を verifyFn で検証し、正規本人なら EDITOR_UID_HEADER を付与。
 * - 検証失敗/トークン無し → ヘッダ無し(viewer・fail-closed)。接続自体は常に許可(閲覧は誰でも可)。
 */
export async function authorizeConnection(req: Request, verifyFn: VerifyFn): Promise<Request> {
  // WS upgrade を落とさないよう、既存 index.ts と同じ「コピー後に header を in-place 操作」方式。
  const out = new Request(req);
  out.headers.delete(EDITOR_UID_HEADER); // 詐称防止: クライアントの偽ヘッダを落とす
  const token = new URL(req.url).searchParams.get(TOKEN_PARAM) ?? "";
  if (token) {
    const uid = await verifyFn(token);
    if (uid) out.headers.set(EDITOR_UID_HEADER, uid);
  }
  return out;
}

/** DO 接続 state が編集者か。`isReadOnly` の反転に使う。 */
export function isEditorState(state: unknown): boolean {
  return typeof (state as { collabEditor?: unknown } | undefined)?.collabEditor === "string";
}
```

- [ ] **Step 4: テスト成功を確認**

Run: `cd workers/collab && npx vitest run src/collabAuth.test.ts`
Expected: PASS（全 10 件）。

- [ ] **Step 5: Commit**

```bash
git add workers/collab/src/collabAuth.ts workers/collab/src/collabAuth.test.ts
git commit -m "feat(collab): stage4a authorizeConnection(信頼ヘッダ付与/除去・fail-closed)+isEditorState"
```

---

## Task 4: worker 入口 `index.ts` に認可を結線

**Files:**
- Modify: `workers/collab/src/index.ts`

- [ ] **Step 1: `Env` と import を拡張し、onBeforeConnect に認可を追加**

`index.ts` の import 群に追加:
```ts
import { verifyToken, authorizeConnection } from "./collabAuth";
```

`onBeforeConnect` を満員判定→認可の順に変更（満員は fail-open のまま・認可は fail-closed）:
```ts
      (await routePartykitRequest(request, env as unknown as Record<string, unknown>, {
        onBeforeConnect: async (req: Request, lobby: { name: string }) => {
          // ① 満員判定(⑤-2b)。満員なら 403 で接続を断つ。
          const full = await rejectIfRoomFull(env, lobby.name);
          if (full) return full;
          // ② 認可(④-a)。token を verify し編集者なら信頼ヘッダを付けた Request を返す。
          //    返した Request が DO へ転送される(viewer はヘッダ無しで通過=閲覧可)。
          return authorizeConnection(req, (t) =>
            verifyToken(env.APP_API_BASE, env.COLLAB_SHARED_SECRET, t),
          );
        },
      })) || new Response("Not Found", { status: 404 })
```

> 注: `Env` には既に `APP_API_BASE` / `COLLAB_SHARED_SECRET` がある（`index.ts:6-12`）。追加不要。

- [ ] **Step 2: 型チェック（worker）**

Run: `cd workers/collab && npm run typecheck`
Expected: 成功（`onBeforeConnect` が `Response | Request | void` を返す型に適合）。

- [ ] **Step 3: 既存 worker テスト緑を確認（結線で壊れていないこと）**

Run: `cd workers/collab && npx vitest run`
Expected: PASS（既存 35 件 + collabAuth 10 件）。

- [ ] **Step 4: Commit**

```bash
git add workers/collab/src/index.ts
git commit -m "feat(collab): stage4a onBeforeConnect に認可を結線(満員→認可・viewer は通過)"
```

---

## Task 5: DO `Room` に編集権記録と書込ゲートを実装

**Files:**
- Modify: `workers/collab/src/server.ts`

- [ ] **Step 1: import と型を追加**

`server.ts` の import に追加:
```ts
import type { Connection, ConnectionContext } from "partyserver";
import { EDITOR_UID_HEADER, isEditorState } from "./collabAuth";
```
（既存 import 行 `import type { Connection } from "partyserver";` がある場合は `ConnectionContext` を同行に統合する。）

- [ ] **Step 2: `Room` に onConnect / isReadOnly を override（`onClose`/`onRequest` の近くに追加）**

```ts
  /**
   * ④-a: 接続確立時に編集権を記録する。super を必ず呼び YServer の sync step1 送出を維持
   * (新規接続者へ既存状態を渡す)。信頼ヘッダ(x-collab-uid)は onBeforeConnect が検証済みで
   * クライアントは詐称できない。state は merge(awareness 用 state を壊さない)。
   */
  override onConnect(conn: Connection, ctx: ConnectionContext): void | Promise<void> {
    const ret = super.onConnect(conn, ctx);
    const uid = ctx.request.headers.get(EDITOR_UID_HEADER);
    if (uid) {
      conn.setState((prev) => ({ ...(prev as object | null), collabEditor: uid }));
    }
    return ret;
  }

  /**
   * ④-a: 編集者(認証済み)でない接続は読み取り専用。
   * y-partyserver はこれが true の接続の sync step2/update を破棄する(書込をサーバが拒否)。
   */
  override isReadOnly(connection: Connection): boolean {
    return !isEditorState(connection.state);
  }
```

> `super.onConnect` の戻り値はそのまま返す（YServer 実装の同期挙動を変えない）。

- [ ] **Step 3: 型チェック（worker）**

Run: `cd workers/collab && npm run typecheck`
Expected: 成功。

- [ ] **Step 4: 全 worker テスト緑を確認**

Run: `cd workers/collab && npx vitest run`
Expected: PASS（既存 + collabAuth）。既存の同期/seed/save/count テストが onConnect override で壊れないこと（super を呼ぶため不変）。

- [ ] **Step 5: Commit**

```bash
git add workers/collab/src/server.ts
git commit -m "feat(collab): stage4a DO に編集権記録(onConnect)+書込ゲート(isReadOnly override)"
```

---

## Task 6: クライアント `collabProvider` に ID トークン送付

**Files:**
- Modify: `src/lib/collab/collabProvider.ts`
- Test: `src/lib/collab/__tests__/collabProvider.params.test.ts`

- [ ] **Step 1: 失敗するテストを書く（params 純関数を抽出してテスト）**

```ts
// src/lib/collab/__tests__/collabProvider.params.test.ts
import { describe, it, expect, vi } from "vitest";
import { buildCollabParams } from "../collabProvider";

describe("buildCollabParams (provider params)", () => {
  it("ログイン時 → token を含む", async () => {
    const getToken = vi.fn(async () => "id-tok");
    expect(await buildCollabParams(getToken)).toEqual({ token: "id-tok" });
  });
  it("未ログイン(null) → 空(viewer)", async () => {
    const getToken = vi.fn(async () => null);
    expect(await buildCollabParams(getToken)).toEqual({});
  });
  it("取得失敗 → 空(viewer・例外を飲む)", async () => {
    const getToken = vi.fn(async () => { throw new Error("no auth"); });
    expect(await buildCollabParams(getToken)).toEqual({});
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

Run: `npx vitest run src/lib/collab/__tests__/collabProvider.params.test.ts`
Expected: FAIL（`buildCollabParams` 未定義）。

- [ ] **Step 3: `collabProvider.ts` に実装 + provider へ結線**

ファイル冒頭の import 群に追加:
```ts
import { auth } from "../firebase";
```

`COLLAB_HOST` 定義の下あたりに追加:
```ts
/** provider params: ログイン中なら現在の Firebase ID トークンを載せ、未ログインは空(viewer)。
 *  関数なので再接続のたびに最新トークンを取り直す(約1時間の期限を自然に解決)。 */
export async function buildCollabParams(
  getToken: () => Promise<string | null>,
): Promise<Record<string, string>> {
  try {
    const token = await getToken();
    return token ? { token } : {};
  } catch {
    return {}; // 取得失敗 → viewer(編集権はサーバが拒否するだけ・閲覧は維持)
  }
}
```

`new YProvider(...)` 呼び出しに `params` を追加（既存 `{ party: 'room', connect: true }` を拡張）:
```ts
  const provider = new YProvider(COLLAB_HOST, roomToken, doc, {
    party: 'room',
    connect: true,
    params: () => buildCollabParams(() => auth.currentUser?.getIdToken() ?? Promise.resolve(null)),
  });
```

- [ ] **Step 4: テスト成功を確認**

Run: `npx vitest run src/lib/collab/__tests__/collabProvider.params.test.ts`
Expected: PASS（3 件）。

- [ ] **Step 5: Commit**

```bash
git add src/lib/collab/collabProvider.ts src/lib/collab/__tests__/collabProvider.params.test.ts
git commit -m "feat(collab): stage4a クライアントが ID トークンを provider params で送付(viewer は空)"
```

---

## Task 7: 回帰確認（root / worker / build 全緑）

**Files:** なし（検証のみ）

- [ ] **Step 1: worker テスト全緑**

Run: `cd workers/collab && npx vitest run`
Expected: PASS（既存 35 + collabAuth 10）。

- [ ] **Step 2: root テスト（既知5失敗以外が緑）**

Run: `npx vitest run`
Expected: 既知の失敗（TopBar 4 + HousingWorkspace 1）以外すべて PASS。新規 `collabProvider.params` 緑。

- [ ] **Step 3: build 緑（Vercel 厳密 tsc 相当）**

Run: `npm run build`
Expected: 成功（exit 0）。`_verifyHandler.ts` の `.js` 相対 import・型を含め通ること（[[reference_vercel_api_esm_js_extension]] に注意）。

- [ ] **Step 4: yjs 遅延チャンク維持の確認（本体 bundle 非混入）**

Run: `npm run build` の出力で collabProvider/yjs が別チャンクのままか確認（⑤-3b/3c と同様 lazy 維持）。

- [ ] **Step 5: 最終 Commit（あれば）/ 完了報告**

dormant・push/deploy 保留のまま。実機（未ログイン閲覧者は書けない / ログイン編集者は書ける / devtools で readOnly 解除しても本物の表が変わらない）は **⑤-3d と合流してプレビューで確認**（本計画の範囲外・別段取り）。

---

## Self-Review（計画↔spec 突合）

- **spec §3 検証方式（Vercel 委譲）** → Task 1（受付係 verify）+ Task 2（worker verifyToken）でカバー。
- **spec §4.1 クライアント params 関数** → Task 6。
- **spec §4.2 onBeforeConnect 検証 + 信頼ヘッダ + fail-closed + クライアントヘッダ除去** → Task 3（authorizeConnection）+ Task 4（結線）。
- **spec §4.3 DO onConnect state 記録 + isReadOnly override** → Task 5。
- **spec §5 fail-closed / 詐称不可** → Task 3 のテスト（検証失敗→ヘッダ無し / クライアント偽ヘッダ除去）でカバー。
- **spec §6 既存結合（⑤-3a/3b/3c・⑤-2b 満員と同居）** → Task 4 で満員→認可の順に同居。
- **spec §7 コンポーネント一覧** → ファイル構成表と Task 群が一致。
- **spec §8 テスト方針** → 各 Task の TDD ＋ Task 7 回帰。
- **型整合**: `EDITOR_UID_HEADER`/`TOKEN_PARAM`/`collabEditor` state キー/`isEditorState`/`verifyToken`/`authorizeConnection`/`buildCollabParams` は全タスクで同名・同シグネチャ。受付係応答 `{valid,uid}` は Task 1 が返し Task 2 が読む形で一致。
- **プレースホルダ無し**: 全コード/コマンド/期待値を明記。
- **スコープ**: presence(④-b)・席分離は非ゴールとして除外済（単一プラン範囲）。
