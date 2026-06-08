# リアルタイム共同編集 段取り⑤-3a (オーナー側の入口・ルーム管理 UI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** オーナーが表の「共有」から「一緒に編集」を選び、共同編集リンクを発行・人数設定・失効/再発行でき、表ツールバーの常設チップで状態が見える(=自分の表が共同編集モードになる)ところまでをクライアント UI と結線だけで実装する。

**Architecture:** サーバ(ルーム発行 API `/api/collab/room`・roomToken 解決・満員拒否・保存)は ⑤-1/2a/2b/③ で実装済。本計画はクライアントのみ: (1) ルーム API ヘルパー、(2) オーケストレーション store(`useCollabSessionStore`)、(3) `startCollabSession` の roomToken 化、(4) オーナーパネル + 共有2択 + 常設チップ、(5) `SYSTEM_MAX_PARTICIPANTS` 28→20。アンカーは既存 [ShareButtons.tsx](../../../src/components/ShareButtons.tsx)(共有ボタン + ShareModal を所有し `currentPlan` を持つ・ConsolidatedHeader 配置)。

**Tech Stack:** React + TypeScript / zustand / react-i18next(`src/locales/*.json`) / framer-motion + lucide / vitest + @testing-library/react(root) + vitest-pool-workers(worker) / 既存 `apiFetch`(ID トークン自動付与)

**設計書:** [../specs/2026-06-08-realtime-collab-stage5-3a-owner-entry-design.md](../specs/2026-06-08-realtime-collab-stage5-3a-owner-entry-design.md)
**親:** [../specs/2026-06-05-realtime-collab-stage5-collab-entry-design.md](../specs/2026-06-05-realtime-collab-stage5-collab-entry-design.md)

---

## ⑤-3 の 4 分割 (この計画は ⑤-3a)

| 段 | 内容 | 状態 |
|---|---|---|
| **⑤-3a** | **オーナー入口(本計画)**: 共有2択 + ルーム発行/人数/失効/再発行 + 常設チップ + roomToken 結線。 | この計画 |
| ⑤-3b | ジョイナー一時ビュー(`/collab/:roomToken` + 一時ワークスペース + 退室クリア)。 | 後続 |
| ⑤-3c | 注意 UI(初回モーダル + 赤バナー) + ログインゲート(未ログイン=閲覧のみ)。 | 後続 |
| ⑤-3d | 実データ往復 E2E(2ブラウザ)。 | 後続 |

---

## 確定済みの一次情報 (本リポジトリのコードで確認済・推測なし)

- **共有ボタンのアンカー** = [src/components/ShareButtons.tsx](../../../src/components/ShareButtons.tsx)(全51行)。`Share2` アイコンボタン + `<ShareModal isOpen .../>` を所有。props = `{ contentLabel, currentPlan }`。[ConsolidatedHeader.tsx:213](../../../src/components/ConsolidatedHeader.tsx#L213) で `currentPlan` を渡して配置。**ここが常設チップ + 2択 + パネルの置き場**。
- **認証ユーザー** = [src/store/useAuthStore.ts](../../../src/store/useAuthStore.ts)。`const { user } = useAuthStore()`(ShareModal も [ShareModal.tsx:44](../../../src/components/ShareModal.tsx#L44) でこれを使用)。`user` は Firebase User(`user.uid`)。
- **API 認証付き fetch** = [src/lib/apiClient.ts:9-36](../../../src/lib/apiClient.ts#L9)。`apiFetch(path, options?)` が `user.getIdToken()` を `Authorization: Bearer` で自動付与し `fetch` を返す。`/api/collab/room` 用。
- **ルーム管理 API** = `/api/collab/room`(⑤-2a)。POST body `{ action:'create'|'revoke'|'reissue'|'set-max', planId, maxParticipants? }`。レスポンス: create/set-max/reissue → `{ roomToken, maxParticipants, revoked:false }`、revoke → `{ revoked:true }`。エラー: 401 unauthenticated / 403 forbidden / 404 not_found / 409 no_room / 503 collab_disabled。検証ロジックは [api/collab/_roomManageLogic.ts](../../../api/collab/_roomManageLogic.ts)、ハンドラは [api/collab/_roomHandler.ts](../../../api/collab/_roomHandler.ts)(統合 index 経由 `/api/collab/room`)。
- **共同編集セッション** = [src/lib/collab/collabProvider.ts:64-149](../../../src/lib/collab/collabProvider.ts#L64)。`startCollabSession(planId)` が `YProvider(COLLAB_HOST, planId, ...)` で接続し `{ provider, doc, disconnect }` を返す。**第2引数(部屋名)を roomToken にするのが結線の核**。`disconnect()` は `exitCollabMode()` を呼ぶ。`onSynced` で `enterCollabMode(handlers)` を内部で呼ぶ(UI 側で別途呼ぶ必要なし)。**現状 `startCollabSession` の呼び出し元は存在しない(休眠)** → 本計画が初の呼び出し元。
- **store の collab モード** = [src/store/useMitigationStore.ts](../../../src/store/useMitigationStore.ts): `_collabActive`(89行) / `enterCollabMode(handlers)`(327) / `exitCollabMode()`(329) / `_applyMitigationsFromCollab`(334)。add/remove/updateTime は `_collabActive` 時に handlers へ委譲(847-956)。**いずれも実装済・UI は触らない**。
- **人数定数(複製)** = worker [workers/collab/src/collabCapacity.ts](../../../workers/collab/src/collabCapacity.ts)(`DEFAULT_MAX_PARTICIPANTS=8` / `SYSTEM_MAX_PARTICIPANTS=28`)と api [api/collab/_roomLogic.ts:6-8](../../../api/collab/_roomLogic.ts#L6)(同値)。**両方の SYSTEM_MAX を 20 に変更**(既定8は不変)。
- **i18n** = [src/i18n.ts](../../../src/i18n.ts) + [src/locales/{ja,en,ko,zh}.json](../../../src/locales/ja.json)。キーはドット名前空間(例 `app.share`)。**全 UI 文言は t() 経由・4言語に追加**(i18n ルール / 英語崩れ確認)。
- **テスト基盤** = root vitest(`@testing-library/react`、例 [src/__tests__/housing/TopBar.test.tsx](../../../src/__tests__/housing/TopBar.test.tsx))。store/API は `vi.mock`。worker は vitest-pool-workers。

### 確定した挙動判断 (設計書 §7 の解決)
- **常設チップの置き場** = ShareButtons.tsx(ツールバーの共有コントロール本体)。
- **リロード時の復元** = しない。`_collabActive` は非永続なのでリロードで通常モードに戻り自動保存が復活。collabRooms は残るのでオーナーは「一緒に編集」で再入室(create は冪等で同 roomToken)。**⑤-3a では復元を作らない(YAGNI)**。
- **create は即時発行**(確認ステップなし)。リンクは共有するまで危険でなく、パネル内に警告を常時表示するため。
- **人数ステッパー変更は即 set-max API**(各 ± クリックが1操作)。
- **参加人数表示** = ⑤-3a では他人は入れないため「1人(あなただけ)」固定表示。動的人数(presence)は段取り④。

### スコープ外 (この計画では触らない)
- ジョイナー入室・`/collab/:roomToken` ルート・一時ワークスペース(⑤-3b)。
- 初回フルモーダル・部屋内赤バナー・未ログイン=閲覧ゲートのサーバ認証(⑤-3c)。
- 動的参加人数/カーソル(presence ④)。
- 既存コピー共有(ShareModal 本体)・1人モードのロジック変更(温存)。

---

## ファイル構成 (作成/変更)

- 変更: `workers/collab/src/collabCapacity.ts` / `.test.ts` — `SYSTEM_MAX_PARTICIPANTS` 28→20。
- 変更: `api/collab/_roomLogic.ts` — `SYSTEM_MAX_PARTICIPANTS` 28→20。
- 変更: `src/lib/__tests__/collabRoomLogic.test.ts` — clamp 上限 20 に追従。
- 作成: `src/lib/collab/collabRoomApi.ts` — `/api/collab/room` クライアントヘルパー(create/setMax/revoke/reissue)。
- 作成: `src/lib/collab/__tests__/collabRoomApi.test.ts`。
- 変更: `src/lib/collab/collabProvider.ts` — `startCollabSession` 第1引数 `planId`→`roomToken`(コメント/名のみ)。
- 作成: `src/store/useCollabSessionStore.ts` — オーケストレーション store(start/setMax/revoke/reissue + 状態)。
- 作成: `src/store/__tests__/useCollabSessionStore.test.ts`。
- 作成: `src/components/collab/OwnerCollabPanel.tsx` — オーナーパネル(警告/情報/リンク/人数/失効・再発行)。
- 作成: `src/components/collab/__tests__/OwnerCollabPanel.test.tsx`。
- 作成: `src/components/collab/ShareChoiceModal.tsx` — 共有2択(コピー/一緒に編集)。
- 変更: `src/components/ShareButtons.tsx` — 2択 → ShareModal/パネル分岐 + `_collabActive` 時に常設チップ。
- 作成: `src/components/collab/__tests__/ShareButtons.collab.test.tsx`。
- 変更: `src/locales/{ja,en,ko,zh}.json` — `collab.*` キー追加。

---

## Task 1: システム上限 28→20 (worker + api)

総参加上限を 20 に統一(設計書 §2)。worker と api 両方の複製定数を変更。

**Files:**
- Modify: `workers/collab/src/collabCapacity.ts`
- Modify: `workers/collab/src/collabCapacity.test.ts`
- Modify: `api/collab/_roomLogic.ts`
- Modify: `src/lib/__tests__/collabRoomLogic.test.ts`

- [ ] **Step 1: worker テストを 20 期待に変更(先に失敗)**

[workers/collab/src/collabCapacity.test.ts](../../../workers/collab/src/collabCapacity.test.ts) の `[1, SYSTEM_MAX] に丸める` ケースを以下に変更:

```typescript
  it("[1, SYSTEM_MAX] に丸める", () => {
    expect(resolveMaxParticipants(0)).toBe(1);
    expect(resolveMaxParticipants(-5)).toBe(1);
    expect(resolveMaxParticipants(999)).toBe(SYSTEM_MAX_PARTICIPANTS);
    expect(SYSTEM_MAX_PARTICIPANTS).toBe(20);
  });
```

- [ ] **Step 2: 失敗確認**

Run(`workers/collab`): `npm test -- --run src/collabCapacity.test.ts`
Expected: FAIL(`expected 28 to be 20`)。

- [ ] **Step 3: worker 定数を 20 に**

[workers/collab/src/collabCapacity.ts](../../../workers/collab/src/collabCapacity.ts) の該当行を変更:

```typescript
/**
 * システム上限。root の api/collab/_roomLogic.ts:8 と同値(別ランタイムで複製)。
 * v1 は編集/閲覧を分けず総参加数の単一上限(設計書 ⑤-3a §2)。
 */
export const SYSTEM_MAX_PARTICIPANTS = 20;
```

- [ ] **Step 4: worker テスト緑**

Run(`workers/collab`): `npm test -- --run src/collabCapacity.test.ts`
Expected: PASS。

- [ ] **Step 5: api 定数を 20 に**

[api/collab/_roomLogic.ts:7-8](../../../api/collab/_roomLogic.ts#L7) を変更:

```typescript
/** システム上限。v1 は編集/閲覧を分けず総参加数の単一上限(設計書 ⑤-3a §2)。worker collabCapacity.ts と同値。 */
export const SYSTEM_MAX_PARTICIPANTS = 20;
```

- [ ] **Step 6: api の clamp テストを 20 に追従**

[src/lib/__tests__/collabRoomLogic.test.ts](../../../src/lib/__tests__/collabRoomLogic.test.ts) 内で `clampMaxParticipants` が大きい値を丸めるケース(28 期待になっている箇所)を 20 に変更する。例(該当アサーションを探して変更):

```typescript
    expect(clampMaxParticipants(999)).toBe(20);
    expect(clampMaxParticipants(28)).toBe(20);
```

> 既存テストに 28 を直接期待している行があれば 20 へ。`SYSTEM_MAX_PARTICIPANTS` をテストが import している場合はその比較値も 20 に。

- [ ] **Step 7: api テスト緑**

Run(repo root): `npx vitest run src/lib/__tests__/collabRoomLogic.test.ts`
Expected: PASS。

- [ ] **Step 8: コミット**

```bash
git add workers/collab/src/collabCapacity.ts workers/collab/src/collabCapacity.test.ts api/collab/_roomLogic.ts src/lib/__tests__/collabRoomLogic.test.ts
git commit -m "feat(collab): 段取り⑤-3a システム上限を 28→20 に統一(v1 総参加数の単一上限)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: ルーム API クライアントヘルパー (`src/lib/collab/collabRoomApi.ts`)

`/api/collab/room` を叩く薄いラッパ。`apiFetch` を使い ID トークンは自動付与。純粋に近く `apiFetch` モックで決定的にテスト。

**Files:**
- Create: `src/lib/collab/collabRoomApi.ts`
- Test: `src/lib/collab/__tests__/collabRoomApi.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

```typescript
// src/lib/collab/__tests__/collabRoomApi.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../apiClient', () => ({ apiFetch: vi.fn() }));
import { apiFetch } from '../../apiClient';
import { createRoom, setMaxParticipants, revokeRoom, reissueRoom } from '../collabRoomApi';

const mockApi = apiFetch as unknown as ReturnType<typeof vi.fn>;
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

beforeEach(() => mockApi.mockReset());

describe('collabRoomApi', () => {
  it('createRoom は action=create を POST し roomToken を返す', async () => {
    mockApi.mockResolvedValue(ok({ roomToken: 'tok1', maxParticipants: 8, revoked: false }));
    const r = await createRoom('plan1');
    expect(mockApi).toHaveBeenCalledWith('/api/collab/room', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', planId: 'plan1' }),
    });
    expect(r).toEqual({ roomToken: 'tok1', maxParticipants: 8, revoked: false });
  });

  it('createRoom は maxParticipants 指定を body に含める', async () => {
    mockApi.mockResolvedValue(ok({ roomToken: 't', maxParticipants: 4, revoked: false }));
    await createRoom('plan1', 4);
    expect(mockApi).toHaveBeenCalledWith('/api/collab/room', expect.objectContaining({
      body: JSON.stringify({ action: 'create', planId: 'plan1', maxParticipants: 4 }),
    }));
  });

  it('setMaxParticipants は action=set-max を POST', async () => {
    mockApi.mockResolvedValue(ok({ roomToken: 't', maxParticipants: 12, revoked: false }));
    const r = await setMaxParticipants('plan1', 12);
    expect(mockApi).toHaveBeenCalledWith('/api/collab/room', expect.objectContaining({
      body: JSON.stringify({ action: 'set-max', planId: 'plan1', maxParticipants: 12 }),
    }));
    expect(r.maxParticipants).toBe(12);
  });

  it('revokeRoom は action=revoke を POST', async () => {
    mockApi.mockResolvedValue(ok({ revoked: true }));
    const r = await revokeRoom('plan1');
    expect(mockApi).toHaveBeenCalledWith('/api/collab/room', expect.objectContaining({
      body: JSON.stringify({ action: 'revoke', planId: 'plan1' }),
    }));
    expect(r).toEqual({ revoked: true });
  });

  it('reissueRoom は action=reissue を POST', async () => {
    mockApi.mockResolvedValue(ok({ roomToken: 'new', maxParticipants: 8, revoked: false }));
    const r = await reissueRoom('plan1');
    expect(mockApi).toHaveBeenCalledWith('/api/collab/room', expect.objectContaining({
      body: JSON.stringify({ action: 'reissue', planId: 'plan1' }),
    }));
    expect(r.roomToken).toBe('new');
  });

  it('非2xx は CollabRoomError を投げる(エラーコード付き)', async () => {
    mockApi.mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: 'forbidden' }) });
    await expect(createRoom('plan1')).rejects.toMatchObject({ code: 'forbidden', status: 403 });
  });
});
```

- [ ] **Step 2: 失敗確認**

Run: `npx vitest run src/lib/collab/__tests__/collabRoomApi.test.ts`
Expected: FAIL(モジュール未作成)。

- [ ] **Step 3: 実装を書く**

```typescript
// src/lib/collab/collabRoomApi.ts
// 共同編集⑤-3a: オーナー用ルーム管理 API(/api/collab/room)のクライアントヘルパー。
// apiFetch が ID トークン(Authorization: Bearer)を自動付与する。サーバの検証/所有者照合は
// /api/collab/room(⑤-2a)が担うため、ここは body 組み立てとレスポンス整形だけを行う。
import { apiFetch } from '../apiClient';

/** create/set-max/reissue の成功レスポンス。 */
export interface RoomInfo {
  roomToken: string;
  maxParticipants: number;
  revoked: false;
}

/** revoke の成功レスポンス。 */
export interface RoomRevoked {
  revoked: true;
}

/** サーバが返したエラーコードを保持する例外。UI はこれで文言を出し分けできる。 */
export class CollabRoomError extends Error {
  constructor(public code: string, public status: number) {
    super(`collab room error: ${code} (${status})`);
    this.name = 'CollabRoomError';
  }
}

type Action = 'create' | 'set-max' | 'revoke' | 'reissue';

async function post(body: Record<string, unknown>): Promise<any> {
  const res = await apiFetch('/api/collab/room', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new CollabRoomError((data?.error as string) ?? 'unknown', res.status);
  return data;
}

/** リンク発行(冪等: 既存があれば同 roomToken を再利用)。maxParticipants 省略時はサーバ既定(8)。 */
export function createRoom(planId: string, maxParticipants?: number): Promise<RoomInfo> {
  const body: Record<string, unknown> = { action: 'create' as Action, planId };
  if (maxParticipants !== undefined) body.maxParticipants = maxParticipants;
  return post(body);
}

/** 入れる人数を変更(サーバが [1, SYSTEM_MAX] にクランプして返す)。 */
export function setMaxParticipants(planId: string, maxParticipants: number): Promise<RoomInfo> {
  return post({ action: 'set-max' as Action, planId, maxParticipants });
}

/** リンクを失効(以後 load/save 拒否=実質停止)。 */
export function revokeRoom(planId: string): Promise<RoomRevoked> {
  return post({ action: 'revoke' as Action, planId });
}

/** 旧リンクを失効し新しい roomToken を発行。 */
export function reissueRoom(planId: string): Promise<RoomInfo> {
  return post({ action: 'reissue' as Action, planId });
}
```

> 注: body の JSON 文字列はテストの `JSON.stringify({ action, planId })` とキー順を一致させる(action→planId→maxParticipants)。`createRoom` の省略時は maxParticipants を含めない。

- [ ] **Step 4: テスト緑**

Run: `npx vitest run src/lib/collab/__tests__/collabRoomApi.test.ts`
Expected: PASS(6 ケース)。

- [ ] **Step 5: コミット**

```bash
git add src/lib/collab/collabRoomApi.ts src/lib/collab/__tests__/collabRoomApi.test.ts
git commit -m "feat(collab): 段取り⑤-3a ルーム管理 API クライアントヘルパー(create/setMax/revoke/reissue)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: `startCollabSession` を roomToken 化

部屋名引数を planId → roomToken に変える(意味のリネーム)。ロジック不変。

**Files:**
- Modify: `src/lib/collab/collabProvider.ts`

- [ ] **Step 1: 引数名とコメントを変更**

[src/lib/collab/collabProvider.ts:60-66](../../../src/lib/collab/collabProvider.ts#L60) を以下に変更(関数本体の `planId` 参照は2箇所=JSDoc と `new YProvider(COLLAB_HOST, planId, ...)`):

```typescript
/**
 * roomToken を部屋として共同編集セッションを開始する(⑤-3a でルーム鍵を plan ID → roomToken に分離)。
 * サーバ routing /parties/room/<roomToken> に合わせ party:"room" を指定。
 */
export function startCollabSession(roomToken: string): CollabSession {
  const doc = new Y.Doc();
  const provider = new YProvider(COLLAB_HOST, roomToken, doc, { party: 'room', connect: true });
```

> 関数内の以降の `planId` 参照は無い(部屋名はこの1箇所のみ)。`yarr` 以降は不変。

- [ ] **Step 2: ビルド/型確認**

Run(repo root): `npm run build`
Expected: 成功(`startCollabSession` の呼び出し元は現状無し=休眠のため型崩れなし)。

- [ ] **Step 3: 既存 collab テストの非破壊確認**

Run: `npx vitest run src/lib/collab`
Expected: PASS(`collabProvider` 関連の既存テストがあれば緑。無ければ Task 2 の collabRoomApi のみ緑)。

- [ ] **Step 4: コミット**

```bash
git add src/lib/collab/collabProvider.ts
git commit -m "refactor(collab): 段取り⑤-3a startCollabSession の部屋名引数を planId→roomToken に

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: オーケストレーション store (`src/store/useCollabSessionStore.ts`)

「発行→接続」「人数変更」「失効→切断」「再発行→張り直し」を1つにまとめる zustand store。`CollabSession`(provider/disconnect)を保持。永続化しない(セッションは非シリアライズ)。

**Files:**
- Create: `src/store/useCollabSessionStore.ts`
- Test: `src/store/__tests__/useCollabSessionStore.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

```typescript
// src/store/__tests__/useCollabSessionStore.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/collab/collabRoomApi', () => ({
  createRoom: vi.fn(),
  setMaxParticipants: vi.fn(),
  revokeRoom: vi.fn(),
  reissueRoom: vi.fn(),
}));
vi.mock('../../lib/collab/collabProvider', () => ({
  startCollabSession: vi.fn(),
}));

import { createRoom, setMaxParticipants, revokeRoom, reissueRoom } from '../../lib/collab/collabRoomApi';
import { startCollabSession } from '../../lib/collab/collabProvider';
import { useCollabSessionStore } from '../useCollabSessionStore';

const mk = (fn: unknown) => fn as unknown as ReturnType<typeof vi.fn>;

function fakeSession() {
  return { provider: {} as any, doc: {} as any, disconnect: vi.fn() };
}

beforeEach(() => {
  mk(createRoom).mockReset();
  mk(setMaxParticipants).mockReset();
  mk(revokeRoom).mockReset();
  mk(reissueRoom).mockReset();
  mk(startCollabSession).mockReset();
  useCollabSessionStore.setState({ active: false, roomToken: null, maxParticipants: 8, session: null });
});

describe('useCollabSessionStore', () => {
  it('start: createRoom→startCollabSession→active=true', async () => {
    mk(createRoom).mockResolvedValue({ roomToken: 'tok', maxParticipants: 8, revoked: false });
    const sess = fakeSession();
    mk(startCollabSession).mockReturnValue(sess);

    await useCollabSessionStore.getState().start('plan1');

    expect(createRoom).toHaveBeenCalledWith('plan1');
    expect(startCollabSession).toHaveBeenCalledWith('tok');
    const s = useCollabSessionStore.getState();
    expect(s.active).toBe(true);
    expect(s.roomToken).toBe('tok');
    expect(s.maxParticipants).toBe(8);
    expect(s.session).toBe(sess);
  });

  it('setMax: setMaxParticipants→maxParticipants 更新', async () => {
    useCollabSessionStore.setState({ active: true, roomToken: 'tok', maxParticipants: 8, session: fakeSession() });
    mk(setMaxParticipants).mockResolvedValue({ roomToken: 'tok', maxParticipants: 12, revoked: false });

    await useCollabSessionStore.getState().setMax('plan1', 12);

    expect(setMaxParticipants).toHaveBeenCalledWith('plan1', 12);
    expect(useCollabSessionStore.getState().maxParticipants).toBe(12);
  });

  it('revoke: revokeRoom→session.disconnect→active=false でクリア', async () => {
    const sess = fakeSession();
    useCollabSessionStore.setState({ active: true, roomToken: 'tok', maxParticipants: 8, session: sess });
    mk(revokeRoom).mockResolvedValue({ revoked: true });

    await useCollabSessionStore.getState().revoke('plan1');

    expect(revokeRoom).toHaveBeenCalledWith('plan1');
    expect(sess.disconnect).toHaveBeenCalled();
    const s = useCollabSessionStore.getState();
    expect(s.active).toBe(false);
    expect(s.roomToken).toBeNull();
    expect(s.session).toBeNull();
  });

  it('reissue: 旧 disconnect→reissueRoom→新 startCollabSession', async () => {
    const oldSess = fakeSession();
    useCollabSessionStore.setState({ active: true, roomToken: 'old', maxParticipants: 8, session: oldSess });
    mk(reissueRoom).mockResolvedValue({ roomToken: 'new', maxParticipants: 8, revoked: false });
    const newSess = fakeSession();
    mk(startCollabSession).mockReturnValue(newSess);

    await useCollabSessionStore.getState().reissue('plan1');

    expect(oldSess.disconnect).toHaveBeenCalled();
    expect(reissueRoom).toHaveBeenCalledWith('plan1');
    expect(startCollabSession).toHaveBeenCalledWith('new');
    const s = useCollabSessionStore.getState();
    expect(s.roomToken).toBe('new');
    expect(s.session).toBe(newSess);
    expect(s.active).toBe(true);
  });
});
```

- [ ] **Step 2: 失敗確認**

Run: `npx vitest run src/store/__tests__/useCollabSessionStore.test.ts`
Expected: FAIL(モジュール未作成)。

- [ ] **Step 3: 実装を書く**

```typescript
// src/store/useCollabSessionStore.ts
// 共同編集⑤-3a: オーナーの共同編集セッションを束ねる store。
// 「リンク発行→接続」「人数変更」「失効→切断」「再発行→張り直し」を1経路にまとめる。
// CollabSession(provider/doc/disconnect)を保持するため永続化しない(非シリアライズ)。
// 実際の Yjs 接続は startCollabSession(collabProvider)、サーバ操作は collabRoomApi に委譲。
import { create } from 'zustand';
import { createRoom, setMaxParticipants, revokeRoom, reissueRoom } from '../lib/collab/collabRoomApi';
import { startCollabSession, type CollabSession } from '../lib/collab/collabProvider';

interface CollabSessionState {
  /** 共同編集モードに入っているか(常設チップ/パネルの表示判定)。 */
  active: boolean;
  /** 現在のルームトークン(発行済リンクの鍵)。未発行は null。 */
  roomToken: string | null;
  /** オーナー設定の入れる人数(サーバがクランプ済の値)。 */
  maxParticipants: number;
  /** 生きている Yjs セッション(切断用)。UI には出さない。 */
  session: CollabSession | null;

  /** リンク発行(冪等)→自分の表をライブ接続。 */
  start: (planId: string) => Promise<void>;
  /** 入れる人数を変更。 */
  setMax: (planId: string, n: number) => Promise<void>;
  /** リンク失効→切断→クリア。 */
  revoke: (planId: string) => Promise<void>;
  /** 旧を切断・失効し新リンクで張り直し。 */
  reissue: (planId: string) => Promise<void>;
}

export const useCollabSessionStore = create<CollabSessionState>((set, get) => ({
  active: false,
  roomToken: null,
  maxParticipants: 8,
  session: null,

  start: async (planId) => {
    const info = await createRoom(planId);
    const session = startCollabSession(info.roomToken);
    set({ active: true, roomToken: info.roomToken, maxParticipants: info.maxParticipants, session });
  },

  setMax: async (planId, n) => {
    const info = await setMaxParticipants(planId, n);
    set({ maxParticipants: info.maxParticipants });
  },

  revoke: async (planId) => {
    await revokeRoom(planId);
    get().session?.disconnect();
    set({ active: false, roomToken: null, session: null });
  },

  reissue: async (planId) => {
    get().session?.disconnect();
    const info = await reissueRoom(planId);
    const session = startCollabSession(info.roomToken);
    set({ active: true, roomToken: info.roomToken, maxParticipants: info.maxParticipants, session });
  },
}));
```

- [ ] **Step 4: テスト緑**

Run: `npx vitest run src/store/__tests__/useCollabSessionStore.test.ts`
Expected: PASS(4 ケース)。

- [ ] **Step 5: コミット**

```bash
git add src/store/useCollabSessionStore.ts src/store/__tests__/useCollabSessionStore.test.ts
git commit -m "feat(collab): 段取り⑤-3a 共同編集セッション store(発行/人数/失効/再発行の結線)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: i18n キー + オーナーパネル (`src/components/collab/OwnerCollabPanel.tsx`)

確定文言のオーナーパネル。`useCollabSessionStore` に委譲。色は機能色(赤=危険)のみ・トークン経由。

**Files:**
- Modify: `src/locales/ja.json` / `en.json` / `ko.json` / `zh.json`
- Create: `src/components/collab/OwnerCollabPanel.tsx`
- Test: `src/components/collab/__tests__/OwnerCollabPanel.test.tsx`

- [ ] **Step 1: 4言語に `collab.*` キーを追加**

各 `src/locales/*.json` のトップレベルに `"collab": { ... }` を追加(既存キーは触らない)。値は下表のとおり。`{{max}}` は i18next 補間。

ja.json:
```json
  "collab": {
    "choice_title": "どう共有しますか？",
    "choice_copy_title": "コピーを配る",
    "choice_copy_desc": "相手が自分用のコピーを作ります(従来)",
    "choice_collab_title": "一緒に編集する",
    "choice_collab_desc": "同じ表に入って同時に編集します",
    "chip_active": "共同編集中",
    "panel_title": "共同編集",
    "participants_solo": "1人(あなただけ)",
    "warning": "このリンクを知っている人は誰でもあなたの表を直接書き換えられます(元に戻せません)。固定メンバー内だけで使い、SNS など外部に公開・転載しないでください。",
    "info": "最大{{max}}人まで一緒に入れます(ログインした人が編集 / していない人は閲覧だけ)。この表はあなたのアカウントに残ります(共同編集はあなたの表をそのまま一緒に編集しているだけ)。いつでも下の「リンクを失効」で共同編集を無効にできます。",
    "link_label": "共同編集リンク",
    "copy": "コピー",
    "copied": "コピーしました",
    "people_label": "入れる人数",
    "people_unit": "人まで",
    "people_hint": "既定 8 人(フルパーティ1組)。1〜{{max}}人で設定可。",
    "reissue": "リンクを作り直す",
    "revoke": "リンクを失効",
    "error_generic": "操作に失敗しました。時間をおいて再度お試しください。"
  }
```

en.json:
```json
  "collab": {
    "choice_title": "How do you want to share?",
    "choice_copy_title": "Hand out a copy",
    "choice_copy_desc": "The other person gets their own copy (classic)",
    "choice_collab_title": "Edit together",
    "choice_collab_desc": "Join the same sheet and edit at the same time",
    "chip_active": "Editing together",
    "panel_title": "Co-editing",
    "participants_solo": "1 person (just you)",
    "warning": "Anyone with this link can directly rewrite your sheet (this can't be undone). Use it only within your fixed group; do not post or share it externally such as on social media.",
    "info": "Up to {{max}} people can join (logged-in people edit / others can only view). This sheet stays in your account (co-editing just edits your sheet directly together). You can disable co-editing anytime with \"Revoke link\" below.",
    "link_label": "Co-editing link",
    "copy": "Copy",
    "copied": "Copied",
    "people_label": "People allowed",
    "people_unit": "max",
    "people_hint": "Default 8 (one full party). Set between 1 and {{max}}.",
    "reissue": "Regenerate link",
    "revoke": "Revoke link",
    "error_generic": "Something went wrong. Please try again later."
  }
```

ko.json:
```json
  "collab": {
    "choice_title": "어떻게 공유할까요?",
    "choice_copy_title": "사본 나눠주기",
    "choice_copy_desc": "상대가 자신의 사본을 만듭니다 (기존)",
    "choice_collab_title": "함께 편집하기",
    "choice_collab_desc": "같은 표에 들어와 동시에 편집합니다",
    "chip_active": "함께 편집 중",
    "panel_title": "공동 편집",
    "participants_solo": "1명(나만)",
    "warning": "이 링크를 아는 사람은 누구나 당신의 표를 직접 덮어쓸 수 있습니다(되돌릴 수 없습니다). 고정 멤버 내에서만 사용하고 SNS 등 외부에 공개·전재하지 마세요.",
    "info": "최대 {{max}}명까지 함께 들어올 수 있습니다(로그인한 사람이 편집 / 아닌 사람은 보기만). 이 표는 당신의 계정에 남습니다(공동 편집은 당신의 표를 그대로 함께 편집하는 것뿐입니다). 아래 \"링크 해지\"로 언제든지 공동 편집을 끌 수 있습니다.",
    "link_label": "공동 편집 링크",
    "copy": "복사",
    "copied": "복사함",
    "people_label": "들어올 수 있는 인원",
    "people_unit": "명까지",
    "people_hint": "기본 8명(풀파티 1조). 1~{{max}}명으로 설정 가능.",
    "reissue": "링크 다시 만들기",
    "revoke": "링크 해지",
    "error_generic": "작업에 실패했습니다. 잠시 후 다시 시도해 주세요."
  }
```

zh.json:
```json
  "collab": {
    "choice_title": "想怎么共享？",
    "choice_copy_title": "分发副本",
    "choice_copy_desc": "对方会创建自己的副本(传统)",
    "choice_collab_title": "一起编辑",
    "choice_collab_desc": "进入同一张表同时编辑",
    "chip_active": "正在共同编辑",
    "panel_title": "共同编辑",
    "participants_solo": "1人(只有你)",
    "warning": "知道此链接的任何人都能直接改写你的表(无法撤销)。请仅在固定成员内使用，不要公开或转载到社交媒体等外部。",
    "info": "最多可有{{max}}人一起加入(登录的人可编辑 / 未登录的人只能查看)。此表会保留在你的账号中(共同编辑只是直接一起编辑你的表)。可随时用下方的\"使链接失效\"关闭共同编辑。",
    "link_label": "共同编辑链接",
    "copy": "复制",
    "copied": "已复制",
    "people_label": "可加入人数",
    "people_unit": "人以内",
    "people_hint": "默认 8 人(一个满编小队)。可设置 1~{{max}}人。",
    "reissue": "重新生成链接",
    "revoke": "使链接失效",
    "error_generic": "操作失败，请稍后再试。"
  }
```

- [ ] **Step 2: パネルの失敗するテストを書く**

```typescript
// src/components/collab/__tests__/OwnerCollabPanel.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OwnerCollabPanel } from '../OwnerCollabPanel';
import { useCollabSessionStore } from '../../../store/useCollabSessionStore';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: any) => (o?.max ? `${k}:${o.max}` : k) }),
}));

beforeEach(() => {
  useCollabSessionStore.setState({
    active: true, roomToken: 'tok7Qk2', maxParticipants: 8, session: null,
    start: vi.fn(), setMax: vi.fn(), revoke: vi.fn(), reissue: vi.fn(),
  } as any);
});

describe('OwnerCollabPanel', () => {
  it('警告と情報文言・リンク・人数を表示する', () => {
    render(<OwnerCollabPanel planId="plan1" onClose={() => {}} />);
    expect(screen.getByText('collab.warning')).toBeInTheDocument();
    expect(screen.getByText('collab.info:20')).toBeInTheDocument(); // {{max}}=SYSTEM_MAX(20)
    expect(screen.getByDisplayValue(/tok7Qk2/)).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('＋/− で setMax を呼ぶ(1..20 クランプ)', () => {
    const setMax = vi.fn();
    useCollabSessionStore.setState({ setMax } as any);
    render(<OwnerCollabPanel planId="plan1" onClose={() => {}} />);
    fireEvent.click(screen.getByLabelText('inc-people'));
    expect(setMax).toHaveBeenCalledWith('plan1', 9);
  });

  it('失効ボタンで revoke→onClose', async () => {
    const revoke = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    useCollabSessionStore.setState({ revoke } as any);
    render(<OwnerCollabPanel planId="plan1" onClose={onClose} />);
    fireEvent.click(screen.getByText('collab.revoke'));
    expect(revoke).toHaveBeenCalledWith('plan1');
  });

  it('再発行ボタンで reissue を呼ぶ', () => {
    const reissue = vi.fn().mockResolvedValue(undefined);
    useCollabSessionStore.setState({ reissue } as any);
    render(<OwnerCollabPanel planId="plan1" onClose={() => {}} />);
    fireEvent.click(screen.getByText('collab.reissue'));
    expect(reissue).toHaveBeenCalledWith('plan1');
  });
});
```

- [ ] **Step 3: 失敗確認**

Run: `npx vitest run src/components/collab/__tests__/OwnerCollabPanel.test.tsx`
Expected: FAIL(コンポーネント未作成)。

- [ ] **Step 4: パネルを実装する**

```tsx
// src/components/collab/OwnerCollabPanel.tsx
// 共同編集⑤-3a: オーナーが共同編集リンクを管理するパネル。
// 警告(機能色 赤)・情報・リンク+コピー・入れる人数・失効/再発行。useCollabSessionStore に委譲。
import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X, Minus, Plus, Link2 } from 'lucide-react';
import { useCollabSessionStore } from '../../store/useCollabSessionStore';
import { SYSTEM_MAX_PARTICIPANTS } from '../../../api/collab/_roomLogic';

interface OwnerCollabPanelProps {
  planId: string;
  onClose: () => void;
}

export const OwnerCollabPanel: React.FC<OwnerCollabPanelProps> = ({ planId, onClose }) => {
  const { t } = useTranslation();
  const { roomToken, maxParticipants, setMax, revoke, reissue } = useCollabSessionStore();
  const [copied, setCopied] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const url = roomToken ? `${window.location.origin}/collab/${roomToken}` : '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* クリップボード不可環境は無視 */ }
  };

  const step = (delta: number) => {
    const next = Math.max(1, Math.min(SYSTEM_MAX_PARTICIPANTS, maxParticipants + delta));
    if (next !== maxParticipants) void setMax(planId, next);
  };

  const handleRevoke = async () => {
    setBusy(true);
    try { await revoke(planId); onClose(); } finally { setBusy(false); }
  };

  const handleReissue = async () => {
    setBusy(true);
    try { await reissue(planId); } finally { setBusy(false); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="relative glass-tier3 rounded-2xl shadow-2xl w-[360px] max-w-[90vw] overflow-hidden"
        style={{ '--glass-tier3-bg': 'var(--share-modal-bg)' } as React.CSSProperties}
        onClick={e => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-app-border bg-app-surface2/40">
          <h3 className="text-app-2xl font-bold text-app-text">{t('collab.panel_title')}</h3>
          <span className="ml-auto inline-flex items-center gap-1.5 text-app-xs text-app-text-muted">
            <span className="w-2 h-2 rounded-full bg-app-text" /> {t('collab.participants_solo')}
          </span>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-app-text border border-transparent hover:bg-app-toggle hover:text-app-toggle-text transition-all duration-200 active:scale-90"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {/* 警告(赤=危険) */}
          <p className="text-app-sm leading-relaxed rounded-lg p-3 border border-app-danger/40 bg-app-danger/10 text-app-danger">
            {t('collab.warning')}
          </p>
          {/* 情報(中立) */}
          <p className="text-app-sm leading-relaxed rounded-lg p-3 border border-app-border bg-app-surface2/40 text-app-text-muted">
            {t('collab.info', { max: SYSTEM_MAX_PARTICIPANTS })}
          </p>

          {/* リンク */}
          <div>
            <div className="text-app-xs uppercase tracking-wide text-app-text-muted mb-1.5">{t('collab.link_label')}</div>
            <div className="flex gap-2">
              <div className="flex-1 h-9 flex items-center gap-2 px-2.5 rounded-lg border border-app-border bg-app-surface2/60 text-app-text-muted overflow-hidden">
                <Link2 size={13} className="shrink-0" />
                <input readOnly value={url} className="flex-1 bg-transparent outline-none text-app-sm font-mono truncate" />
              </div>
              <button onClick={handleCopy} className="px-3 h-9 rounded-lg bg-app-text text-app-bg font-bold text-app-sm active:scale-95 transition-transform">
                {copied ? t('collab.copied') : t('collab.copy')}
              </button>
            </div>
          </div>

          {/* 人数 */}
          <div>
            <div className="text-app-xs uppercase tracking-wide text-app-text-muted mb-1.5">{t('collab.people_label')}</div>
            <div className="flex items-center gap-3">
              <button aria-label="dec-people" onClick={() => step(-1)} className="w-8 h-8 rounded-lg border border-app-border bg-app-surface2/60 flex items-center justify-center text-app-text active:scale-95"><Minus size={15} /></button>
              <span className="text-app-xl font-bold text-app-text min-w-[1.5rem] text-center">{maxParticipants}</span>
              <button aria-label="inc-people" onClick={() => step(1)} className="w-8 h-8 rounded-lg border border-app-border bg-app-surface2/60 flex items-center justify-center text-app-text active:scale-95"><Plus size={15} /></button>
              <span className="text-app-sm text-app-text-muted">{t('collab.people_unit')}</span>
            </div>
            <div className="text-app-xs text-app-text-muted mt-1">{t('collab.people_hint', { max: SYSTEM_MAX_PARTICIPANTS })}</div>
          </div>

          {/* アクション */}
          <div className="flex gap-2 pt-3 border-t border-app-border">
            <button disabled={busy} onClick={handleReissue} className="flex-1 h-8 rounded-lg border border-app-border bg-app-surface2/60 text-app-text text-app-sm active:scale-95 disabled:opacity-50">
              {t('collab.reissue')}
            </button>
            <button disabled={busy} onClick={handleRevoke} className="flex-1 h-8 rounded-lg border border-app-danger/60 bg-app-danger/15 text-app-danger font-bold text-app-sm active:scale-95 disabled:opacity-50">
              {t('collab.revoke')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
```

> `--app-danger` / `text-app-danger` 等のトークンが未定義なら、既存の赤系トークン(`docs/DESIGN.md` 参照・削除/危険で使う赤)に合わせて差し替える。色のハードコードはしない。`SYSTEM_MAX_PARTICIPANTS` を api 定数から import して 20 を一元化。

- [ ] **Step 5: テスト緑**

Run: `npx vitest run src/components/collab/__tests__/OwnerCollabPanel.test.tsx`
Expected: PASS(4 ケース)。`text-app-danger` 等の class 名はテストに影響しない(文言/aria で検証)。

- [ ] **Step 6: ビルド確認(import 解決)**

Run: `npm run build`
Expected: 成功(api 定数の import がクライアントから解決できること。型のみの値 import なので問題ない)。

- [ ] **Step 7: コミット**

```bash
git add src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json src/components/collab/OwnerCollabPanel.tsx src/components/collab/__tests__/OwnerCollabPanel.test.tsx
git commit -m "feat(collab): 段取り⑤-3a オーナーパネル + collab i18n(4言語)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: 共有2択 + 常設チップ (`ShareChoiceModal` + `ShareButtons` 改修)

共有を押すとまず2択。コピー→既存 ShareModal、一緒に編集→(ログイン要)発行+パネル。`_collabActive` 時はボタンが常設チップに変わる。

**Files:**
- Create: `src/components/collab/ShareChoiceModal.tsx`
- Modify: `src/components/ShareButtons.tsx`
- Test: `src/components/collab/__tests__/ShareButtons.collab.test.tsx`

- [ ] **Step 1: ShareChoiceModal を作成**

```tsx
// src/components/collab/ShareChoiceModal.tsx
// 共同編集⑤-3a: 共有を押した直後の2択(コピーを配る / 一緒に編集)。意図を最初に選ばせ事故を防ぐ。
import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X, Copy, Users } from 'lucide-react';

interface ShareChoiceModalProps {
  onCopy: () => void;
  onCollab: () => void;
  onClose: () => void;
}

export const ShareChoiceModal: React.FC<ShareChoiceModalProps> = ({ onCopy, onCollab, onClose }) => {
  const { t } = useTranslation();
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="relative glass-tier3 rounded-2xl shadow-2xl w-[340px] max-w-[90vw] overflow-hidden"
        style={{ '--glass-tier3-bg': 'var(--share-modal-bg)' } as React.CSSProperties}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-app-border bg-app-surface2/40">
          <h3 className="text-app-2xl font-bold text-app-text">{t('collab.choice_title')}</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-app-text border border-transparent hover:bg-app-toggle hover:text-app-toggle-text transition-all duration-200 active:scale-90"><X size={16} /></button>
        </div>
        <div className="p-4 space-y-2.5">
          <button onClick={onCopy} className="w-full flex items-center gap-3 p-3 rounded-xl border border-app-border bg-app-surface2/40 hover:bg-app-surface2/70 transition-colors text-left">
            <span className="w-8 h-8 rounded-lg bg-app-surface2 flex items-center justify-center shrink-0"><Copy size={16} className="text-app-text" /></span>
            <span><span className="block font-bold text-app-text">{t('collab.choice_copy_title')}</span><span className="block text-app-xs text-app-text-muted">{t('collab.choice_copy_desc')}</span></span>
          </button>
          <button onClick={onCollab} className="w-full flex items-center gap-3 p-3 rounded-xl border border-app-border bg-app-surface2/40 hover:bg-app-surface2/70 transition-colors text-left">
            <span className="w-8 h-8 rounded-lg bg-app-surface2 flex items-center justify-center shrink-0"><Users size={16} className="text-app-text" /></span>
            <span><span className="block font-bold text-app-text">{t('collab.choice_collab_title')}</span><span className="block text-app-xs text-app-text-muted">{t('collab.choice_collab_desc')}</span></span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
```

- [ ] **Step 2: ShareButtons の失敗するテストを書く**

```typescript
// src/components/collab/__tests__/ShareButtons.collab.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShareButtons } from '../../ShareButtons';
import { useCollabSessionStore } from '../../../store/useCollabSessionStore';
import { useAuthStore } from '../../../store/useAuthStore';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
// ShareModal/Tooltip は本テストの対象外。軽量モックで描画を単純化。
vi.mock('../../ShareModal', () => ({ ShareModal: ({ isOpen }: { isOpen: boolean }) => isOpen ? <div data-testid="share-modal" /> : null }));
vi.mock('../../ui/Tooltip', () => ({ Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('../../../store/useTutorialStore', () => ({ useTutorialStore: { getState: () => ({ completed: { share: true }, isActive: false, startTutorial: vi.fn() }) } }));

const plan = { id: 'plan1', ownerId: 'uid1' } as any;

beforeEach(() => {
  useCollabSessionStore.setState({ active: false, roomToken: null, maxParticipants: 8, session: null, start: vi.fn().mockResolvedValue(undefined) } as any);
  useAuthStore.setState({ user: { uid: 'uid1' } } as any);
});

describe('ShareButtons + collab', () => {
  it('共有クリックで2択が出る', () => {
    render(<ShareButtons contentLabel={null} currentPlan={plan} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('collab.choice_title')).toBeInTheDocument();
  });

  it('「コピーを配る」で ShareModal が開く', () => {
    render(<ShareButtons contentLabel={null} currentPlan={plan} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('collab.choice_copy_title'));
    expect(screen.getByTestId('share-modal')).toBeInTheDocument();
  });

  it('「一緒に編集」(ログイン済)で start を呼ぶ', () => {
    const start = vi.fn().mockResolvedValue(undefined);
    useCollabSessionStore.setState({ start } as any);
    render(<ShareButtons contentLabel={null} currentPlan={plan} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('collab.choice_collab_title'));
    expect(start).toHaveBeenCalledWith('plan1');
  });

  it('_collabActive 時は常設チップを表示', () => {
    useCollabSessionStore.setState({ active: true, roomToken: 'tok', session: {} as any } as any);
    render(<ShareButtons contentLabel={null} currentPlan={plan} />);
    expect(screen.getByText('collab.chip_active')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: 失敗確認**

Run: `npx vitest run src/components/collab/__tests__/ShareButtons.collab.test.tsx`
Expected: FAIL(ShareButtons がまだ2択/チップを持たない)。

- [ ] **Step 4: ShareButtons.tsx を改修**

[src/components/ShareButtons.tsx](../../../src/components/ShareButtons.tsx) を以下に置き換える(全体)。既存の共有ボタン+ShareModal は温存し、2択/チップ/パネル/ログイン導線を追加:

```tsx
import React from 'react';
import clsx from 'clsx';
import { Share2, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Tooltip } from './ui/Tooltip';
import { ShareModal } from './ShareModal';
import { ShareChoiceModal } from './collab/ShareChoiceModal';
import { OwnerCollabPanel } from './collab/OwnerCollabPanel';
import { LoginModal } from './LoginModal';
import { useCollabSessionStore } from '../store/useCollabSessionStore';
import { useAuthStore } from '../store/useAuthStore';
import type { SavedPlan } from '../types';
import { useTutorialStore } from '../store/useTutorialStore';

const iconBtnBase = "group w-9 h-9 rounded-full border flex items-center justify-center transition-all duration-300 cursor-pointer active:scale-95";
const hoverInvert = "hover:bg-app-toggle hover:border-app-toggle hover:text-app-toggle-text";
const iconBtnDefault = `bg-transparent border-app-border text-app-text ${hoverInvert}`;

interface ShareButtonsProps {
    contentLabel: string | null;
    currentPlan: SavedPlan | undefined;
}

type View = 'none' | 'choice' | 'copy' | 'panel';

export const ShareButtons: React.FC<ShareButtonsProps> = ({ contentLabel, currentPlan }) => {
    const { t } = useTranslation();
    const [view, setView] = React.useState<View>('none');
    const [showLogin, setShowLogin] = React.useState(false);
    const { active, start } = useCollabSessionStore();
    const { user } = useAuthStore();

    const openShareUI = () => {
        // 共同編集中はチップ=パネル直行。通常時は2択。
        setView(active ? 'panel' : 'choice');
        const { completed, isActive } = useTutorialStore.getState();
        if (!completed['share'] && !isActive) useTutorialStore.getState().startTutorial('share');
    };

    const handleCollab = async () => {
        if (!user) { setShowLogin(true); return; }      // 未ログインはログイン導線
        if (!currentPlan) return;                         // 保存済プランが無ければ不可
        await start(currentPlan.id);
        setView('panel');
    };

    return (
        <>
            <Tooltip content={active ? t('collab.chip_active') : t('app.share')}>
                {active ? (
                    <button
                        onClick={openShareUI}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-app-text/40 bg-app-text/10 text-app-text font-bold text-app-sm cursor-pointer active:scale-95 transition-all"
                    >
                        <Users size={13} /> {t('collab.chip_active')}
                    </button>
                ) : (
                    <button
                        data-tutorial="share-copy-btn"
                        onClick={openShareUI}
                        className={clsx(iconBtnBase, iconBtnDefault, "w-8 h-8")}
                    >
                        <Share2 size={14} />
                    </button>
                )}
            </Tooltip>

            {view === 'choice' && (
                <ShareChoiceModal
                    onCopy={() => setView('copy')}
                    onCollab={handleCollab}
                    onClose={() => setView('none')}
                />
            )}

            <ShareModal
                isOpen={view === 'copy'}
                onClose={() => setView('none')}
                contentLabel={contentLabel}
                currentPlan={currentPlan}
            />

            {view === 'panel' && currentPlan && (
                <OwnerCollabPanel planId={currentPlan.id} onClose={() => setView('none')} />
            )}

            <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
        </>
    );
};
```

> `LoginModal` の import パス/props は ShareModal の使い方([ShareModal.tsx](../../../src/components/ShareModal.tsx) 末尾の `<LoginModal isOpen=... onClose=... />`)に合わせる。`active` 時のチップのスタイルは DESIGN トークンに沿って微調整可(緑の機能色は使わず、白黒+状態を太字/枠で表現。実機でユーザーと最終確認)。

- [ ] **Step 5: テスト緑**

Run: `npx vitest run src/components/collab/__tests__/ShareButtons.collab.test.tsx`
Expected: PASS(4 ケース)。

- [ ] **Step 6: 既存 ShareButtons/ShareModal の非破壊確認**

Run: `npx vitest run src/components` (または ShareModal 関連の既存テストがあればそれ)
Expected: 既存緑のまま(コピー共有は温存)。

- [ ] **Step 7: コミット**

```bash
git add src/components/collab/ShareChoiceModal.tsx src/components/ShareButtons.tsx src/components/collab/__tests__/ShareButtons.collab.test.tsx
git commit -m "feat(collab): 段取り⑤-3a 共有2択 + 常設チップ + オーナーパネル結線(ShareButtons)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: 全体回帰 + ビルド + worker デプロイ + TODO 反映

**Files:** なし(検証・デプロイ・ドキュメント)

- [ ] **Step 1: フルビルド**

Run(root): `npm run build`
Expected: 成功(tsc -b)。

- [ ] **Step 2: フルテスト(root)**

Run: `npx vitest run`
Expected: PASS。既知の事前 failure(`housing/TopBar.test.tsx` 4件・`HousingWorkspace.test.tsx` 1件)以外は緑。新規 collab テスト(collabRoomApi / useCollabSessionStore / OwnerCollabPanel / ShareButtons.collab / collabRoomLogic)が緑。
※ vitest がハングする場合は出力をパイプせず単体実行で切り分ける(memory `reference_vitest_vmthreads_hang`)。

- [ ] **Step 3: worker テスト + デプロイ(SYSTEM_MAX 変更を本番反映)**

Run(`workers/collab`): `npm test -- --run` → PASS(collabCapacity が 20 で緑)。
Run(`workers/collab`): `npx wrangler deploy`(`SYSTEM_MAX` 20 を本番反映。クライアント結線はまだ UI 露出するが、他人は ⑤-3b まで入れないため実害なし)。

> ⚠ 本番 UI 露出について: ⑤-3a で「一緒に編集」ボタンがユーザーから見えるようになる。設計書の「完成までUI非表示」厳守方針に従い、**⑤-3a のクライアント変更は push せず main にローカルマージのみ**で止め、UI を出すかは ⑤-3b/3c 完了後にユーザーと判断する(下記 Step 4 参照)。worker の `SYSTEM_MAX` 変更だけは無害なので deploy 可。

- [ ] **Step 4: main へローカルマージ(push しない=UI 非露出維持)**

```bash
git checkout main
git merge --ff-only feat/collab-stage5-3a-owner-entry
git branch -d feat/collab-stage5-3a-owner-entry
```

> Vercel への push は ⑤-3 完成(または UI 露出 OK 判断)まで保留。memory `feedback_vercel_builds`(ビルド枠)+ 設計書「完成までUI非表示」厳守。

- [ ] **Step 5: TODO.md 反映 + コミット(ローカル)**

[docs/TODO.md](../../TODO.md) の⑤行に「⑤-3a(オーナー入口・ルーム管理UI)実装済(休眠・UI 非露出)。残=⑤-3b ジョイナー一時ビュー / ⑤-3c 注意UI+ログインゲート / ⑤-3d 実データ往復」を反映(100 行以内)。

```bash
git add docs/TODO.md docs/superpowers/plans/2026-06-08-realtime-collab-stage5-3a-owner-entry.md
git commit -m "docs(todo): 段取り⑤-3a(オーナー入口)実装済を反映 + 計画書追加

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## 完了の定義 (⑤-3a)

- `SYSTEM_MAX_PARTICIPANTS` が worker/api 両方で 20、テスト追従済。
- `collabRoomApi`(create/setMax/revoke/reissue)が `/api/collab/room` を正しい body で叩き、エラーを `CollabRoomError` で表す(ユニット緑)。
- `startCollabSession` が roomToken を部屋名に使う。
- `useCollabSessionStore` が発行→接続/人数/失効→切断/再発行を結線(ユニット緑)。
- `OwnerCollabPanel`(確定文言・人数1〜20・コピー/失効/再発行)+ `ShareChoiceModal`(2択)+ `ShareButtons`(通常↔チップ + ログイン導線)が描画・委譲する(コンポーネントテスト緑)。
- collab i18n が 4言語に存在(英語モード崩れなし)。
- root フルテスト/ビルド・worker テストが従来どおり(既知 housing failure 除き)緑。worker のみ deploy、**クライアントは main ローカルマージで UI 非露出維持**。
- **未達(後続)**: 他人の入室(⑤-3b)/注意モーダル・赤バナー・ログインゲートのサーバ認証(⑤-3c)/2ブラウザ実データ往復(⑤-3d)/動的参加人数(presence ④)。

---

## Self-Review (spec 対照)

- **§1 ゴール(2択/発行/パネル/人数/失効/再発行/常設チップ)**: Task 6(2択+チップ)+ Task 5(パネル)+ Task 4(発行/人数/失効/再発行結線)+ Task 2(API)で網羅 → ✅。
- **§2 人数モデル(総上限・既定8・最大20)**: Task 1(SYSTEM_MAX 20)+ パネルの 1〜20 クランプ + info 文言 `{{max}}` → ✅。
- **§3.1 入口2択(B案)**: ShareChoiceModal(Task 6)→ ✅。コピー側は ShareModal 温存。
- **§3.2 一緒に編集の挙動(create→接続→パネル)**: `handleCollab`→`start`(Task 4/6)→ ✅。未ログインは LoginModal。
- **§3.3 パネル文言(警告/情報/参加人数/リンク/人数/失効・再発行)**: Task 5 で確定文言を i18n に → ✅。「表は残る」明記(info)。
- **§3.4 常設チップ**: Task 6 で `active` 時チップ→クリックでパネル → ✅。参加人数は「1人(あなただけ)」固定(§7 決定)。
- **§4 変更ファイル**: 全て対応するタスクあり → ✅。
- **§7 残論点**: チップ位置=ShareButtons / 復元しない / 即時発行 / 人数即 set-max / 参加人数固定表示、を「確定した挙動判断」で解決済 → ✅。i18n 4言語 Task 5。
- **Placeholder スキャン**: TBD/TODO/「適切な〜」なし。トークン名(`app-danger`)は「未定義なら既存赤トークンに差し替え」と明示(色ハードコード禁止)。
- **型整合**: `createRoom/setMaxParticipants/revokeRoom/reissueRoom`(Task 2)を store(Task 4)が同名参照。`RoomInfo.maxParticipants`/`roomToken` を store/パネルが参照。`startCollabSession(roomToken)`(Task 3)を store が呼ぶ。`useCollabSessionStore` の `active/roomToken/maxParticipants/start/setMax/revoke/reissue` を Task 5/6 が参照(一致)。
- **非干渉**: 既存コピー共有(ShareModal)・1人モード store は不変 → ✅。
</content>
