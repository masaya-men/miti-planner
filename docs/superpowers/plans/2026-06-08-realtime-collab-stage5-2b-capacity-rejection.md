# リアルタイム共同編集 段取り⑤-2b (満員拒否 = 接続前の安全弁) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 共同編集ルームが上限人数に達したら、新規 WebSocket 接続を **DO に触れる前(onBeforeConnect)** に拒否する安全弁を入れる。

**Architecture (案B 確定):** 上限値(maxParticipants)は受付係(`/api/collab/load`)が返す値を **DO の永続ストレージ(`ctx.storage`)** に onLoad で 1 度だけ書く(hibernation でインスタンス変数が揮発するため storage に置く)。在室数(count)は既存 `getConnections()`(hibernation 安全)。worker の `index.ts` で `routePartykitRequest` に `onBeforeConnect` を渡し、接続前に DO の `/count`(= `{count, max}`)を 1 往復で取得 → 満員なら 403 を返して upgrade を拒否、そうでなければ素通し。判定の中核は純関数 `isRoomFull(count, max)` に切り出して決定的にテストする。**案A(接続のたびに Firestore を引く)は不採用** — onBeforeConnect は自動再接続(ネット瞬断・タブ復帰・hibernation 切断)のたびに走るため接続イベントは稀でなく、案A は案B に「無駄な Firestore 読み取り1回 + 再接続レイテンシ」を足すだけで一方的に劣る(2026-06-08 調査で確定)。

**Tech Stack:** Cloudflare Workers (Durable Objects, SQLite-backed) / partyserver `onBeforeConnect` / y-partyserver(YServer) / vitest-pool-workers(`SELF.fetch` + `fetchMock`) / TypeScript

**設計書:** [../specs/2026-06-05-realtime-collab-stage5-collab-entry-design.md](../specs/2026-06-05-realtime-collab-stage5-collab-entry-design.md) (§5 人数上限・緊急停止 / §11 enforcement 境界)
**前段:** [2026-06-05-realtime-collab-stage5-2a-room-management-api.md](./2026-06-05-realtime-collab-stage5-2a-room-management-api.md) (⑤-2a ルーム管理API + ワーカー結線)

---

## ⑤ 全体の分解 (この計画は ⑤-2b)

| 段 | 内容 | 状態 |
|---|---|---|
| ⑤-1 | ルーム解決層(collabRooms 解決 + load/save の roomToken 対応 + 緊急停止)。 | ✅ 完了(main) |
| ⑤-2a | ルーム管理API(`/api/collab/room` 発行/失効/再発行/上限) + ワーカー結線。 | ✅ 完了(main) |
| **⑤-2b** | **満員拒否(本計画)**: `onBeforeConnect` で接続前に在室数を照合し上限超過は upgrade 拒否。 | この計画 |
| ⑤-3 | クライアントUI(オーナーパネル / ジョイナー一時ビュー / 注意モーダル+赤バナー / ログインゲート) + 実データ往復検証。 | 後続(別計画) |

---

## 確定済みの一次情報 (実装前提・本リポジトリのコードで確認済・推測なし)

- **`onBeforeConnect` は実在し DO ルーティング前に走る**: [workers/collab/node_modules/partyserver/dist/index.js:432,460-464](../../../workers/collab/node_modules/partyserver/dist/index.js#L460-L464)。`isWebSocket` のとき `routePartykitRequest` の `options.onBeforeConnect(req, lobby)` を呼び、戻り値が `Response` なら**その場で return**(DO への `.fetch` = :472 に到達しない)。`lobby.name` = URL から抽出した部屋名(= roomToken)。型は [dist/index.d.ts:182-185](../../../workers/collab/node_modules/partyserver/dist/index.d.ts#L182-L185)。
- **クライアントは切断のたび自動再接続する**: [y-partyserver/dist/provider/index.js:134-143](../../../workers/collab/node_modules/y-partyserver/dist/provider/index.js#L134-L143)。close 時 `wsUnsuccessfulReconnects++` → 指数バックオフ `2^n * 100ms` で `_reconnectWS()`。→ onBeforeConnect は「人間の入室」だけでなく「再接続」でも走る。
- **在室数は既に取れる**: [workers/collab/src/server.ts:80-88](../../../workers/collab/src/server.ts#L80-L88) `onRequest` が `/count` で `getConnections()`(= `ctx.getWebSockets()` ベース・hibernation 安全)の数を返す。
- **maxParticipants は受付係が返す**: [api/collab/_loadHandler.ts:38](../../../api/collab/_loadHandler.ts#L38) が roomToken 経路で `{ mitigations, maxParticipants }` を返す(`resolveRoom`/`clampMaxParticipants` 適用済・[api/collab/_roomLogic.ts:23-37](../../../api/collab/_roomLogic.ts#L23-L37))。デフォルト 8・システム上限 28。
- **現状ワーカーは maxParticipants を捨てている**: [workers/collab/src/collabPersistence.ts:26-27](../../../workers/collab/src/collabPersistence.ts#L26-L27) は load レスポンスから `mitigations` だけ抽出。onLoad([server.ts:39-50](../../../workers/collab/src/server.ts#L39-L50))も mitigations しか見ない。→ ここを `maxParticipants` も拾うよう拡張する。
- **インスタンス変数は hibernation で揮発する**: [server.ts:11,25-26](../../../workers/collab/src/server.ts#L11) のコメント明記。→ max は `this.ctx.storage`(永続)に置く。`#saveEnabled` と違い「接続が存在する間ずっと参照される」値なので、wake 後も復元される storage が必須。
- **DO は SQLite-backed**: [wrangler.jsonc:10-12](../../../workers/collab/wrangler.jsonc#L10-L12) `new_sqlite_classes: ["Room"]`。`ctx.storage.put/get` は利用可。
- **テスト env**: [wrangler.jsonc:15](../../../workers/collab/wrangler.jsonc#L15) は `APP_API_BASE` のみ設定し `COLLAB_SHARED_SECRET` は未設定 → 既存テストでは onLoad が `if (!APP_API_BASE || !COLLAB_SHARED_SECRET) return;`([server.ts:43](../../../workers/collab/src/server.ts#L43))で早期 return = fetch せず hermetic。**満員拒否の統合テストには (1) テスト env に secret を入れる + (2) `fetchMock` で load レスポンスの max を制御** が要る。
- **テスト基盤**: [server.test.ts](../../../workers/collab/src/server.test.ts) は `SELF.fetch("https://collab.test/parties/room/<name>...")` で worker の `index.ts`(onBeforeConnect 込み)を通す。WS は `{ Upgrade: "websocket" }`、`res.webSocket?.accept()` 必須。`/count` は `SELF.fetch(".../<name>/count")` で取得し、`json<{count}>()` で読む。`fetchMock` の使い方は [collabPersistence.test.ts:1-21](../../../workers/collab/src/collabPersistence.test.ts#L1-L21)(`fetchMock.activate()` / `disableNetConnect()` / `fetchMock.get(BASE).intercept({path,method}).reply(...)` / `afterEach(assertNoPendingInterceptors)`)。
- **isolatedStorage:false**: [vitest.config.ts:17](../../../workers/collab/vitest.config.ts#L17)。テスト間で DO 状態が共有されるため**各テストは必ず異なる部屋名を使う**。
- **デフォルト/システム上限値の複製**: worker は別ランタイム(別 node_modules)で root の [_roomLogic.ts](../../../api/collab/_roomLogic.ts) を import できない。worker 内に `DEFAULT_MAX_PARTICIPANTS = 8` / `SYSTEM_MAX_PARTICIPANTS = 28` を**複製**し、コメントで root と同値である旨を明記する(物理的に共有不可なため許容・ハードコーディング回避の例外)。
- **fail-open 方針**: 満員判定(DO への `/count` 往復)が例外/失敗したら**接続を許可**する。安全弁の一時障害で正規ユーザーを締め出さない(設計書 §11「一時的に上限を超える可能性」を許容する soft enforcement と整合)。

### スコープ外 (この計画では触らない)

- **root(Vercel)側コード**。受付係は ⑤-1/2a で maxParticipants を返済み。⑤-2b は worker のみ。→ **Vercel 再デプロイ不要**(Serverless 関数数の懸念なし)。worker は `wrangler deploy` のみ。
- **クライアント UI**(満員時の「満員です」表示・再試行 UX)は ⑤-3。⑤-2b はサーバ側の拒否だけ。拒否された側の y-partyserver は再接続ループに入る(機能上は無害)。
- **オーナーがセッション中に上限を変えた場合の即時反映**。max は onLoad のスナップショット。次の部屋ロードで反映(設計書 §5 / 案B のトレードオフ・許容済)。
- **席種別(編集8/閲覧20)**。⑤ は総参加数の単一上限のみ(設計書 §1 非ゴール)。

## ファイル構成 (作成/変更)

- 作成: `workers/collab/src/collabCapacity.ts` — 満員判定の純ロジック(`isRoomFull` / `resolveMaxParticipants` / 定数 / storage キー)。
- 作成: `workers/collab/src/collabCapacity.test.ts` — 上記の vitest-pool-workers テスト(純関数・WS 不要)。
- 変更: `workers/collab/src/collabPersistence.ts` — `fetchMitigations` を `fetchSeed`(`{mitigations, maxParticipants} | null` を返す)に変更。
- 変更: `workers/collab/src/collabPersistence.test.ts` — `fetchSeed` の戻り値(max 同梱)に追従。
- 変更: `workers/collab/src/server.ts` — onLoad で `fetchSeed` を使い max を `ctx.storage` に保存 / `onRequest('/count')` が `{count, max}` を返す。
- 変更: `workers/collab/src/server.test.ts` — `fetchMock` 基盤を追加(onLoad が fetch するようになるため) + `/count` が max を返す形を検証。
- 変更: `workers/collab/src/index.ts` — `onBeforeConnect` を追加(満員なら 403、それ以外は素通し・fail-open)。
- 変更: `workers/collab/vitest.config.ts` — テスト env に `COLLAB_SHARED_SECRET`(ダミー)を追加(onLoad を走らせ max 経路を統合テストするため)。

---

## Task 1: 満員判定の純ロジック (`workers/collab/src/collabCapacity.ts`)

DO も WS も使わない純関数を先に固める。`index.ts` の onBeforeConnect と `server.ts` の /count がこれを wrap する。

**Files:**
- Create: `workers/collab/src/collabCapacity.ts`
- Test: `workers/collab/src/collabCapacity.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

```typescript
// workers/collab/src/collabCapacity.test.ts
import { describe, it, expect } from "vitest";
import {
  isRoomFull,
  resolveMaxParticipants,
  DEFAULT_MAX_PARTICIPANTS,
  SYSTEM_MAX_PARTICIPANTS,
  MAX_PARTICIPANTS_KEY,
} from "./collabCapacity";

describe("isRoomFull", () => {
  it("在室数が上限未満なら満員でない", () => {
    expect(isRoomFull(0, 8)).toBe(false);
    expect(isRoomFull(7, 8)).toBe(false);
  });
  it("在室数が上限と等しい/超過なら満員", () => {
    expect(isRoomFull(8, 8)).toBe(true);
    expect(isRoomFull(9, 8)).toBe(true);
  });
  it("上限 1 の部屋は 1 人目で満員", () => {
    expect(isRoomFull(0, 1)).toBe(false);
    expect(isRoomFull(1, 1)).toBe(true);
  });
});

describe("resolveMaxParticipants", () => {
  it("未保存(undefined)は既定 8", () => {
    expect(resolveMaxParticipants(undefined)).toBe(DEFAULT_MAX_PARTICIPANTS);
    expect(DEFAULT_MAX_PARTICIPANTS).toBe(8);
  });
  it("非数(NaN/Infinity)は既定 8", () => {
    expect(resolveMaxParticipants(NaN)).toBe(8);
    expect(resolveMaxParticipants(Infinity)).toBe(8);
  });
  it("範囲内はそのまま(小数は切り捨て)", () => {
    expect(resolveMaxParticipants(4)).toBe(4);
    expect(resolveMaxParticipants(4.9)).toBe(4);
  });
  it("[1, SYSTEM_MAX] に丸める", () => {
    expect(resolveMaxParticipants(0)).toBe(1);
    expect(resolveMaxParticipants(-5)).toBe(1);
    expect(resolveMaxParticipants(999)).toBe(SYSTEM_MAX_PARTICIPANTS);
    expect(SYSTEM_MAX_PARTICIPANTS).toBe(28);
  });
});

describe("MAX_PARTICIPANTS_KEY", () => {
  it("storage キーは衝突しにくい名前空間付き", () => {
    expect(MAX_PARTICIPANTS_KEY).toBe("collab:maxParticipants");
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run(`workers/collab` で): `npm test -- --run src/collabCapacity.test.ts`
Expected: FAIL — `Failed to resolve import "./collabCapacity"`(モジュール未作成)。

- [ ] **Step 3: 最小実装を書く**

```typescript
// workers/collab/src/collabCapacity.ts
// 共同編集⑤-2b: 満員判定の純ロジック。DO/WS 非依存で決定的にテストする
// (③/⑤-1 の _logic.ts・_roomLogic.ts と同じ「純関数を分離」方針の worker 版)。
// index.ts(onBeforeConnect)と server.ts(/count)がこれを wrap する。

/**
 * 既定の最大人数 = 零式/絶のフルパーティ1組。
 * root の api/collab/_roomLogic.ts:6 と同値(別ランタイムで import 不可のため複製)。
 */
export const DEFAULT_MAX_PARTICIPANTS = 8;
/**
 * システム上限。root の api/collab/_roomLogic.ts:8 と同値(別ランタイムで複製)。
 */
export const SYSTEM_MAX_PARTICIPANTS = 28;

/** DO 永続ストレージに max を保存するキー。y-partyserver の内部キーと衝突しないよう名前空間を付ける。 */
export const MAX_PARTICIPANTS_KEY = "collab:maxParticipants";

/** 在室数が上限に達しているか。新規接続を受け入れる前に呼ぶ(count は接続前の現在値)。 */
export function isRoomFull(count: number, max: number): boolean {
  return count >= max;
}

/**
 * storage から読んだ max(未保存=undefined や壊れた値を含む)を有効な上限に正規化する。
 * 未指定/非数は既定 8、範囲外は [1, SYSTEM_MAX] に丸め、小数は切り捨て。
 * (受付係が clampMaxParticipants 済みの値を返すが、storage 値の防御的正規化として再適用する。)
 */
export function resolveMaxParticipants(stored: number | undefined): number {
  if (typeof stored !== "number" || !Number.isFinite(stored)) return DEFAULT_MAX_PARTICIPANTS;
  return Math.max(1, Math.min(SYSTEM_MAX_PARTICIPANTS, Math.floor(stored)));
}
```

- [ ] **Step 4: テストが通ることを確認**

Run(`workers/collab` で): `npm test -- --run src/collabCapacity.test.ts`
Expected: PASS(全ケース緑)。

- [ ] **Step 5: コミット**

```bash
git add workers/collab/src/collabCapacity.ts workers/collab/src/collabCapacity.test.ts
git commit -m "feat(collab): 段取り⑤-2b 満員判定の純ロジック(isRoomFull/resolveMaxParticipants)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: 受付係 seed 取得を maxParticipants 同梱に (`collabPersistence.ts`)

onLoad が max を storage に書けるよう、load レスポンスから `maxParticipants` も拾って返すようにする。`fetchMitigations`(mitigations のみ)を `fetchSeed`(`{mitigations, maxParticipants}`)に変える。

**Files:**
- Modify: `workers/collab/src/collabPersistence.ts`
- Modify: `workers/collab/src/collabPersistence.test.ts`

- [ ] **Step 1: テストを `fetchSeed` 期待に書き換える(先に失敗させる)**

[workers/collab/src/collabPersistence.test.ts](../../../workers/collab/src/collabPersistence.test.ts) の冒頭 import と `fetchMitigations` を使う describe を、`fetchSeed` が `{mitigations, maxParticipants}` を返す前提に置き換える。`postMitigations` の describe は不変(そのまま残す)。import 行と最初の describe を以下に差し替え:

```typescript
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
```

> 既存の `postMitigations` describe(`postMitigations (書き戻し)`)はそのまま残す。import で `fetchMitigations` を消し `fetchSeed` にした以外、`postMitigations` のテストは変更しない。

- [ ] **Step 2: テストが失敗することを確認**

Run(`workers/collab` で): `npm test -- --run src/collabPersistence.test.ts`
Expected: FAIL — `fetchSeed` が export されていない(`fetchMitigations` のまま)。

- [ ] **Step 3: `collabPersistence.ts` を `fetchSeed` に変更**

[workers/collab/src/collabPersistence.ts](../../../workers/collab/src/collabPersistence.ts) の `fetchMitigations`(15-32 行)を以下の `fetchSeed` に差し替える。`SeedResult` 型を追加。`postMitigations` は不変:

```typescript
// 共同編集③/⑤ 永続化の HTTP 層(受付係 Vercel API への入出力)。
// DO に依存しない純粋関数として切り出し、fetchMock で決定的にテストする。
// Room(server.ts)はこれを this.collabEnv / this.name(=roomToken) と #saveEnabled ガードで包む。
// ⑤-2a: 受付係は roomToken → planId を解決する。⑤-2b: seed と一緒に maxParticipants も受け取る。
import type { MitigationRecord } from "./yjsMitigations";

export type { MitigationRecord };

const SECRET_HEADER = "x-collab-secret";

/** load の seed 結果。maxParticipants は roomToken 経路のみ付与(レガシー planId 経路では undefined)。 */
export interface SeedResult {
  mitigations: MitigationRecord[];
  maxParticipants?: number;
}

/**
 * 受付係 load を叩き seed(軽減配置 + 最大人数)を取得する。
 * live → SeedResult、墓標(deleted)/不正/障害(非2xx・例外) → null(破壊保存ガードのため seed しない)。
 */
export async function fetchSeed(
  base: string,
  secret: string,
  roomToken: string,
): Promise<SeedResult | null> {
  try {
    const res = await fetch(
      `${base}/api/collab/load?roomToken=${encodeURIComponent(roomToken)}`,
      { headers: { [SECRET_HEADER]: secret } },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { deleted?: boolean; mitigations?: MitigationRecord[]; maxParticipants?: number };
    if (body.deleted || !Array.isArray(body.mitigations)) return null;
    return { mitigations: body.mitigations, maxParticipants: body.maxParticipants };
  } catch {
    return null;
  }
}
```

> `postMitigations`(現 38-56 行)はそのまま。変更は `fetchMitigations` → `fetchSeed` の置換と `SeedResult` 追加のみ。

- [ ] **Step 4: テストが通ることを確認**

Run(`workers/collab` で): `npm test -- --run src/collabPersistence.test.ts`
Expected: PASS(`fetchSeed` 5 ケース + `postMitigations` 既存ケースが緑)。

> この時点で `server.ts` は未修正のため `fetchMitigations` を import していてビルド/型が壊れる。Task 3 で server.ts を直すまで `npm run`(worker 全体)は赤でよい。本 Step は当該テストファイル単体で緑を確認する。

- [ ] **Step 5: コミット**

```bash
git add workers/collab/src/collabPersistence.ts workers/collab/src/collabPersistence.test.ts
git commit -m "feat(collab): 段取り⑤-2b seed 取得を fetchSeed(maxParticipants 同梱)に拡張

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: DO が max を保存し /count で返す (`server.ts` + テスト基盤)

onLoad で `fetchSeed` を使い max を `ctx.storage` に保存。`/count` を `{count, max}` 形に拡張。テストでは onLoad が fetch するようになるため `fetchMock` 基盤を server.test.ts に追加する。

**Files:**
- Modify: `workers/collab/vitest.config.ts`(テスト env に ダミー secret)
- Modify: `workers/collab/src/server.ts`
- Modify: `workers/collab/src/server.test.ts`

- [ ] **Step 1: テスト env にダミー secret を追加**

[workers/collab/vitest.config.ts](../../../workers/collab/vitest.config.ts) の `poolOptions.workers` に `miniflare.bindings` を追加し、onLoad が走る(= secret あり)状態にする。`wrangler: { configPath }` の下に追記:

```typescript
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.jsonc" },
        // ⑤-2b: onLoad の seed fetch(と max 保存)を統合テストするため、
        // テスト env に COLLAB_SHARED_SECRET を与える(値はダミー)。実 fetch は
        // 各テストの fetchMock で intercept し、未 intercept は disableNetConnect で遮断する。
        miniflare: {
          bindings: { COLLAB_SHARED_SECRET: "test-secret" },
        },
        singleWorker: true,
        isolatedStorage: false,
      },
    },
  },
});
```

- [ ] **Step 2: server.test.ts に fetchMock 基盤を追加し、満員拒否テストまで書く(先に失敗させる)**

[workers/collab/src/server.test.ts](../../../workers/collab/src/server.test.ts) を以下に置き換える。既存 3 テスト(upgrade/count/close)は `fetchMock` 基盤の下でそのまま動く(onLoad の fetch は intercept されず `disableNetConnect` で弾かれ、`fetchSeed` の try/catch で null → max 既定 8。これらは count しか見ないので不変)。追加するのは「/count が max を返す」と「満員で 403」の 2 ケース:

```typescript
import { SELF, fetchMock } from "cloudflare:test";
import { describe, it, expect, beforeAll, afterEach } from "vitest";

const BASE = "https://lopoly.app";

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});
afterEach(() => fetchMock.assertNoPendingInterceptors());

/** /count を在室数が安定するまでポーリングして {count, max} を返す。 */
async function pollCount(room: string): Promise<{ count: number; max: number }> {
  let last = { count: 0, max: 0 };
  for (let i = 0; i < 25; i++) {
    const r = await SELF.fetch(`https://collab.test/parties/room/${room}/count`);
    last = await r.json<{ count: number; max: number }>();
    if (last.count >= 1) break;
    await new Promise((res) => setTimeout(res, 20));
  }
  return last;
}

describe("Room (YServer) ", () => {
  it("WebSocket の upgrade 要求に 101 を返す", async () => {
    const res = await SELF.fetch("https://collab.test/parties/room/upgrade-room", {
      headers: { Upgrade: "websocket" },
    });
    expect(res.status).toBe(101);
    expect(res.webSocket).toBeDefined();
    res.webSocket?.accept();
    res.webSocket?.close();
  });

  it("接続中は在室数を GET /count で取得できる", async () => {
    const ws = (await SELF.fetch("https://collab.test/parties/room/count-room", {
      headers: { Upgrade: "websocket" },
    })).webSocket!;
    ws.accept();
    try {
      const { count } = await pollCount("count-room");
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
    await pollCount("close-room");
    ws.close();
    let count = 1;
    for (let i = 0; i < 25; i++) {
      const r = await SELF.fetch("https://collab.test/parties/room/close-room/count");
      count = (await r.json<{ count: number; max: number }>()).count;
      if (count === 0) break;
      await new Promise((res) => setTimeout(res, 20));
    }
    expect(count).toBe(0);
  });

  it("/count は seed で受け取った maxParticipants を返す", async () => {
    fetchMock.get(BASE)
      .intercept({ path: "/api/collab/load?roomToken=max-room", method: "GET" })
      .reply(200, { mitigations: [], maxParticipants: 5 });
    const ws = (await SELF.fetch("https://collab.test/parties/room/max-room", {
      headers: { Upgrade: "websocket" },
    })).webSocket!;
    ws.accept();
    try {
      const { count, max } = await pollCount("max-room");
      expect(count).toBe(1);
      expect(max).toBe(5);
    } finally {
      ws.close();
    }
  });

  it("満員(上限1)の部屋は 2 人目の upgrade を 403 で拒否する", async () => {
    fetchMock.get(BASE)
      .intercept({ path: "/api/collab/load?roomToken=full-room", method: "GET" })
      .reply(200, { mitigations: [], maxParticipants: 1 });
    const ws = (await SELF.fetch("https://collab.test/parties/room/full-room", {
      headers: { Upgrade: "websocket" },
    })).webSocket!;
    ws.accept();
    try {
      // onLoad が max=1 を storage に書くまで待つ(/count が {count:1, max:1} になる)。
      const settled = await pollCount("full-room");
      expect(settled).toEqual({ count: 1, max: 1 });
      // 2 人目: onBeforeConnect が満員と判定し 403(WebSocket は張られない)。
      const res2 = await SELF.fetch("https://collab.test/parties/room/full-room", {
        headers: { Upgrade: "websocket" },
      });
      expect(res2.status).toBe(403);
      expect(res2.webSocket).toBeNull();
    } finally {
      ws.close();
    }
  });
});
```

- [ ] **Step 3: テストが失敗することを確認**

Run(`workers/collab` で): `npm test -- --run src/server.test.ts`
Expected: FAIL — server.ts がまだ `fetchMitigations` を import(モジュール解決失敗)/ `/count` が max を返さない / onBeforeConnect 未実装で 403 にならない。

- [ ] **Step 4: server.ts の onLoad と onRequest を実装**

[workers/collab/src/server.ts](../../../workers/collab/src/server.ts) を変更する。(a) import を `fetchSeed` + capacity に、(b) onLoad で max を storage 保存、(c) onRequest が `{count, max}` を返す。該当箇所を以下に差し替え:

import 行(4-5 行):
```typescript
import { buildSeedDoc, readMitigations } from "./yjsMitigations";
import { fetchSeed, postMitigations } from "./collabPersistence";
import { resolveMaxParticipants, MAX_PARTICIPANTS_KEY } from "./collabCapacity";
```

onLoad(39-50 行)を以下に差し替え:
```typescript
  /** 受付係から seed(軽減配置 + 最大人数)を読む(this.name = roomToken)。live なら Y.Doc を組んで返し、
   *  max を storage に保存(onBeforeConnect の満員判定が /count 経由で参照する)。それ以外は seed しない。 */
  override async onLoad(): Promise<Y.Doc | void> {
    const { APP_API_BASE, COLLAB_SHARED_SECRET } = this.collabEnv;
    if (!APP_API_BASE || !COLLAB_SHARED_SECRET) return;
    const seed = await fetchSeed(APP_API_BASE, COLLAB_SHARED_SECRET, this.name);
    if (seed) {
      this.#saveEnabled = true; // 正常 seed できた部屋だけ保存解禁
      // 上限値は hibernation で揮発するインスタンス変数でなく永続ストレージに置く
      // (接続が存在する間ずっと /count で参照されるため wake 後も復元が要る)。
      await this.ctx.storage.put(MAX_PARTICIPANTS_KEY, resolveMaxParticipants(seed.maxParticipants));
      return buildSeedDoc(seed.mitigations);
    }
    // null(墓標/不存在/障害): seed しない(空 Y.Doc・#saveEnabled は false)。max も書かない(/count は既定 8)。
  }
```

onRequest(80-88 行)を以下に差し替え(async 化 + max 同梱):
```typescript
  // 在室数 + 上限 HTTP。onBeforeConnect(index.ts)が接続前に GET /count で満員判定する。
  // count: getConnections()(ctx.getWebSockets() ベース・hibernation 安全)。
  // max: onLoad が storage に書いた値(未保存なら既定 8)。
  override async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.endsWith("/count")) {
      let count = 0;
      for (const _ of this.getConnections()) count++;
      const stored = await this.ctx.storage.get<number>(MAX_PARTICIPANTS_KEY);
      return Response.json({ count, max: resolveMaxParticipants(stored) });
    }
    return new Response("Not Found", { status: 404 });
  }
```

- [ ] **Step 5: server.test.ts の既存3テスト + 新2テストが通ることを確認**

Run(`workers/collab` で): `npm test -- --run src/server.test.ts`
Expected: PASS。ただし「満員 403」テストは onBeforeConnect 未実装のため**まだ FAIL する想定**。最低でも `/count は maxParticipants を返す`・既存3テストは緑になる。満員テストは Task 4 で緑化。

> もし満員テスト以外も赤い場合は、`miniflare.bindings` の secret 反映・`fetchMock` の path 一致(`?roomToken=max-room`)・onLoad の storage 保存タイミングを切り分ける。

- [ ] **Step 6: コミット**

```bash
git add workers/collab/src/server.ts workers/collab/src/server.test.ts workers/collab/vitest.config.ts
git commit -m "feat(collab): 段取り⑤-2b DO が seed の max を storage 保存し /count で返す

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: onBeforeConnect で満員拒否 (`index.ts`)

worker fetch 層で接続前に DO の `/count` を取り、満員なら 403。失敗時は fail-open(接続許可)。

**Files:**
- Modify: `workers/collab/src/index.ts`

- [ ] **Step 1: index.ts に onBeforeConnect を追加**

[workers/collab/src/index.ts](../../../workers/collab/src/index.ts) を以下に差し替える。`isRoomFull` を import し、`routePartykitRequest` の第3引数に `onBeforeConnect` を渡す。x-partykit-room フォールバックは不変:

```typescript
import { routePartykitRequest } from "partyserver";
import { isRoomFull } from "./collabCapacity";

export { Room } from "./server";

export interface Env {
  Room: DurableObjectNamespace;
  /** 受付係(Vercel)アプリのオリジン。例: https://lopoly.app */
  APP_API_BASE: string;
  /** DO↔Vercel のサーバー間共有シークレット(wrangler secret で投入)。 */
  COLLAB_SHARED_SECRET: string;
}

/**
 * 満員なら upgrade を拒否する(段取り⑤-2b の安全弁)。
 * onBeforeConnect は DO ルーティングの前に走るため、ここで返す Response は DO に届かず接続を断つ。
 * 在室数(count)と上限(max)は対象 DO の GET /count から 1 往復で取得する
 * (max は onLoad が storage に保存した値・hibernation 安全)。
 * 判定や問い合わせが失敗したら接続を許可する(fail-open): 安全弁の一時障害で
 * 正規ユーザーを締め出さない(設計書 §11 の soft enforcement と整合)。
 */
async function rejectIfRoomFull(env: Env, roomName: string): Promise<Response | void> {
  try {
    const stub = env.Room.get(env.Room.idFromName(roomName));
    const res = await stub.fetch("https://do.internal/count");
    const { count, max } = await res.json<{ count: number; max: number }>();
    if (isRoomFull(count, max)) {
      return new Response("room full", { status: 403 });
    }
  } catch {
    // fail-open: 接続を許可する。
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // partyserver 0.5.x は DO 内で ctx.id.name からルーム名を解決するが、
    // Miniflare/古い workerd では ctx.id.name が露出しない。partyserver の
    // フォールバック (x-partykit-room ヘッダ) を我々が補ってテスト/本番両対応にする。
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean); // ["parties","room","<id>"]
    if (parts[0] === "parties" && parts.length >= 3) {
      const room = parts[2];
      const req = new Request(request);
      req.headers.set("x-partykit-room", room);
      request = req;
    }
    return (
      (await routePartykitRequest(request, env as unknown as Record<string, unknown>, {
        // 接続前の満員判定。lobby.name = URL から抽出した部屋名(= roomToken)。
        onBeforeConnect: (_req, lobby) => rejectIfRoomFull(env, lobby.name),
      })) || new Response("Not Found", { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;
```

> `routePartykitRequest` の options 型は `PartyServerOptions<Env>` だが、第2引数を `Record<string, unknown>` にキャストしている既存方針に合わせ、options はそのまま渡してよい(`onBeforeConnect(req, lobby)` の lobby.name は string)。型エラーが出る場合は options を `as any` でなく、`onBeforeConnect` の引数に明示型(`_req: Request, lobby: { name: string }`)を付けて回避する。

- [ ] **Step 2: server.test.ts 全体(満員 403 含む)が通ることを確認**

Run(`workers/collab` で): `npm test -- --run src/server.test.ts`
Expected: PASS(満員テストが 403 を返して緑。既存3 + max返却 + 満員 = 全緑)。

- [ ] **Step 3: worker テスト全体が通ることを確認**

Run(`workers/collab` で): `npm test -- --run`
Expected: PASS(`collabCapacity` / `collabPersistence`(fetchSeed) / `server`(満員含む) / `yjsMitigations` 全緑)。

- [ ] **Step 4: コミット**

```bash
git add workers/collab/src/index.ts
git commit -m "feat(collab): 段取り⑤-2b onBeforeConnect で満員時の upgrade を 403 拒否(fail-open)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: 全体回帰 + worker デプロイ + TODO 反映

⑤-2b が root(Vercel)に影響しないこと・worker が壊れていないことを確定し、worker のみ本番反映する。

**Files:** なし(検証・デプロイ・ドキュメント)

- [ ] **Step 1: root フルビルド(非破壊確認)**

Run(リポジトリ root で): `npm run build`
Expected: 成功。⑤-2b は worker のみ変更のため root は不変だが、念のため型を通す。

- [ ] **Step 2: root フルテスト(非干渉確認)**

Run: `npx vitest run`
Expected: PASS。既知の事前 failure(`housing/TopBar.test.tsx` 4件・`HousingWorkspace.test.tsx` 1件)は ⑤-2b と無関係で従来どおり。collab 系 root テスト(`collabLogic`/`collabRoomLogic`/`collabRoomManageLogic`)が全緑。
※ vitest がハングする場合は出力をパイプせず単体実行で切り分ける(memory `reference_vitest_vmthreads_hang`)。

- [ ] **Step 3: worker テスト全体**

Run(`workers/collab` で): `npm test -- --run`
Expected: PASS(全緑)。

- [ ] **Step 4: worker 本番デプロイ**

Run(`workers/collab` で): `npx wrangler deploy`
Expected: `lopo-collab` デプロイ成功。**root の git push(Vercel デプロイ)は不要**(worker のみ変更・受付係は変わらない)。クライアント UI はまだ roomToken 接続しないため(⑤-3 まで)本番影響ゼロ・休眠。

> デプロイ後の本番スモーク(任意): 既存の空部屋に WS 接続 → `/count` 相当が動くこと。満員拒否の本番 E2E(複数クライアントで上限到達 → 拒否)は collabRooms ドキュメント + 実 roomToken が要るため **⑤-3 の実データ往復検証に統合**する。

- [ ] **Step 5: TODO.md 反映 + コミット(ローカル・push は次の機能 push に同梱)**

[docs/TODO.md](../../TODO.md) の⑤行(段取り⑤の項)に「⑤-2b 満員拒否(onBeforeConnect・案B=DO storage キャッシュ)実装・worker デプロイ済。残=⑤-3 クライアントUI+実データ往復」を反映(100 行以内維持)。

```bash
git add docs/TODO.md docs/superpowers/plans/2026-06-08-realtime-collab-stage5-2b-capacity-rejection.md
git commit -m "docs(todo): 段取り⑤-2b(満員拒否)実装済を反映 + 計画書追加

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

> push は memory `feedback_vercel_builds`(月100ビルド制限)に従い、docs だけで Vercel ビルドを消費しないよう次の機能 push に同梱する(TODO 現行方針「未反映の docs commit はローカルのみ」)。

---

## 完了の定義 (⑤-2b)

- `isRoomFull` / `resolveMaxParticipants` の純ロジックが worker vitest で全緑(境界 count===max・上限1・範囲丸め)。
- `fetchSeed` が load レスポンスから `maxParticipants` も返し、onLoad が `ctx.storage` に保存する。
- `/count` が `{count, max}` を返し、`onBeforeConnect` が満員(`count >= max`)の upgrade を 403 で拒否する(統合テストで実証)。失敗時は fail-open。
- worker テスト全緑 + root フルテスト/ビルドが従来どおり(既知の housing 事前 failure を除き)緑。worker のみ本番デプロイ済・休眠・無害。
- **未達(後続)**: 満員時のクライアント UX(「満員です」表示・再試行)/ オーナーパネル / ジョイナー一時ビュー / 実データ往復 E2E(すべて ⑤-3)。

---

## Self-Review (spec 対照)

- **§5 人数上限 enforcement**: 「DO が接続時に getConnections() の数と上限を比較し超過は満員拒否。上限値は onLoad のレスポンスで DO に渡しキャッシュ」を、onBeforeConnect(接続前・DO 外)+ /count(getConnections)+ storage キャッシュ で実装 → ✅。spec の「DO がキャッシュ」を、揮発するインスタンス変数でなく永続 storage に具体化(調査で onConnect は 101 後で拒否不可・onBeforeConnect が正解と確定したため)。
- **§5 緊急停止**: ⑤-1 の load/save 側ゲートで既出(本計画はスコープ外)。⑤-2b は人数上限のみ → ✅(明記)。
- **§11 enforcement の境界**: 「再接続・切断検知のタイミング差で一時的に上限超過の可能性」→ soft enforcement として許容 + fail-open を明示 → ✅。
- **§1 非ゴール(席種別)**: 総参加数の単一上限のみ実装 → ✅。
- **案A/B の決着**: onBeforeConnect が再接続でも走る事実(provider 自動再接続)+ count は必ず DO 往復が要る事実から、案A(毎接続 Firestore)は案B + 無駄読み取りと確定 → 案B 採用を Architecture に明記 → ✅。
- **Placeholder スキャン**: TBD/TODO/「適切な〜」なし。全 code ステップに実コードあり。
- **型整合**: `isRoomFull(count, max)` / `resolveMaxParticipants(stored)` / `MAX_PARTICIPANTS_KEY`(Task 1)を server.ts(Task 3)・index.ts(Task 4)が同名で参照。`fetchSeed` の戻り `SeedResult{mitigations, maxParticipants?}`(Task 2)を onLoad(Task 3)が `seed.mitigations`/`seed.maxParticipants` で参照。`/count` の `{count, max}` 形(Task 3)を onBeforeConnect(Task 4)とテスト(Task 3)が一致して読む。
- **root 非干渉**: 受付係(`_loadHandler.ts`)は既に maxParticipants を返済み → root 変更ゼロ・Vercel デプロイ不要 → ✅。
</content>
</invoke>
