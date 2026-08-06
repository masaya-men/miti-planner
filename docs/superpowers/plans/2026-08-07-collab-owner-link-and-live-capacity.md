# 共同編集: オーナーの自動判別・人数変更(リンク再作成不要) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** オーナーが自分の共有リンクを開いたら自動的にいつもの編集画面に案内し、共同編集の「入れる人数」をリンクを作り直さず確実に変更できるようにする。

**Architecture:** (1) 既存の `/api/collab/room` に `check-owner` アクションを追加し、`collabRooms/{roomToken}.ownerId` とログイン中uidを突き合わせる。(2) `CollabJoinerPage` がログイン済みならこれを1回呼び、本人ならいつもの編集画面へリダイレクトする。(3) 人数変更は即時デバウンス送信をやめ、「仮の値→確定ボタン」の明示確定にし、確定成功時にplan側データへも書き戻す(現状の保存漏れバグの修正)。

**Tech Stack:** React 18 / Zustand / Firebase Admin (Firestore) / Vercel Serverless Functions / Vitest + Testing Library

## Global Constraints

- 設計書: `docs/superpowers/specs/2026-08-07-collab-owner-link-and-live-capacity-design.md`(このPlanの元)
- オーナー判定はサーバー側でFirebase ID Tokenを検証し、`collabRooms/{roomToken}.ownerId` とuidを比較する。クライアントの自己申告は一切信用しない。
- 判定に失敗・不確実な場合(未ログイン・API失敗・roomToken不存在等)は必ず安全側(今まで通りの参加者フロー)に倒す。誤ってオーナー権限を渡す方向の失敗は絶対に許容しない。
- 新規UI文言は必ず `src/locales/{ja,en,ko,zh,zh-Hant}.json` 全てにi18nキーを追加する(ハードコード禁止)。
- `CollabJoinerPage.tsx` の複雑なロジックは既存踏襲で「純関数として切り出してテストする」(`joinerView`/`computeCanEdit` と同じパターン)。コンポーネント全体をrenderするテストは追加しない。
- 既存の4アクション(`create`/`revoke`/`reissue`/`set-max`)の挙動・レスポンス形は一切変更しない。
- 各タスックごとにコミットする。全タスク完了後、フルビルド+フルテストを実行してからのみ本番push対象とする(このPlanの最終タスクで実施)。

---

### Task 1: サーバー — `/api/collab/room` に `check-owner` アクションを追加

**Files:**
- Modify: `api/collab/_roomManageLogic.ts`
- Modify: `api/collab/_roomHandler.ts`
- Test: `src/lib/__tests__/collabRoomManageLogic.test.ts`

**Interfaces:**
- Produces: `resolveRoomOwner(room: RoomOwnerDoc | null, uid: string): OwnerCheckResult`(`RoomOwnerDoc = { ownerId?: string; planId?: string }`, `OwnerCheckResult = { isOwner: boolean; planId?: string }`)。Task 2以降のクライアント側 `OwnerCheckResult` 型と形を一致させる。
- Produces: `parseRoomManageRequest` が `{ action: 'check-owner', roomToken: string }` を受理するようになる。

- [ ] **Step 1: 失敗するテストを書く(`_roomManageLogic.test.ts` に追記)**

既存の `'ROOM_ACTIONS は 4 アクション'` テストを次で置き換え、新規テストを追加する:

```ts
  it('ROOM_ACTIONS は 5 アクション', () => {
    expect(ROOM_ACTIONS).toEqual(['create', 'revoke', 'reissue', 'set-max', 'check-owner']);
  });
  it('check-owner は roomToken 必須(planId不要)', () => {
    expect(parseRoomManageRequest({ action: 'check-owner', roomToken: 'tok123' }))
      .toEqual({ ok: true, req: { action: 'check-owner', roomToken: 'tok123' } });
  });
  it('check-owner で roomToken 欠落/空 → invalid_roomToken', () => {
    expect(parseRoomManageRequest({ action: 'check-owner' }))
      .toEqual({ ok: false, error: 'invalid_roomToken' });
    expect(parseRoomManageRequest({ action: 'check-owner', roomToken: '' }))
      .toEqual({ ok: false, error: 'invalid_roomToken' });
  });
```

ファイル末尾のimportに `resolveRoomOwner` を追加:

```ts
import { parseRoomManageRequest, ROOM_ACTIONS, resolveRoomOwner } from '../../../api/collab/_roomManageLogic';
```

`describe` ブロックの外(ファイル末尾)に新規 `describe` を追加:

```ts
describe('resolveRoomOwner', () => {
  it('room が null(roomToken不存在) → isOwner:false', () => {
    expect(resolveRoomOwner(null, 'uid1')).toEqual({ isOwner: false });
  });
  it('ownerId が一致 → isOwner:true + planId', () => {
    expect(resolveRoomOwner({ ownerId: 'uid1', planId: 'plan1' }, 'uid1'))
      .toEqual({ isOwner: true, planId: 'plan1' });
  });
  it('ownerId が不一致(他人) → isOwner:false', () => {
    expect(resolveRoomOwner({ ownerId: 'uid1', planId: 'plan1' }, 'uid2'))
      .toEqual({ isOwner: false });
  });
  it('失効済みルームでもオーナー本人なら isOwner:true', () => {
    expect(resolveRoomOwner({ ownerId: 'uid1', planId: 'plan1' }, 'uid1'))
      .toEqual({ isOwner: true, planId: 'plan1' });
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `rtk npx vitest run src/lib/__tests__/collabRoomManageLogic.test.ts`
Expected: FAIL(`resolveRoomOwner` が存在しない / `check-owner` が invalid_action になる 等)

- [ ] **Step 3: `_roomManageLogic.ts` を実装**

`RoomAction` / `ROOM_ACTIONS` / `RoomManageRequest` / `ParseResult` を置き換え:

```ts
export type RoomAction = 'create' | 'revoke' | 'reissue' | 'set-max' | 'check-owner';

export const ROOM_ACTIONS: RoomAction[] = ['create', 'revoke', 'reissue', 'set-max', 'check-owner'];

export type RoomManageRequest =
  | { action: 'create'; planId: string; maxParticipants?: number; label?: string }
  | { action: 'revoke'; planId: string }
  | { action: 'reissue'; planId: string; label?: string }
  | { action: 'set-max'; planId: string; maxParticipants: number }
  | { action: 'check-owner'; roomToken: string };

export type ParseResult =
  | { ok: true; req: RoomManageRequest }
  | { ok: false; error: 'invalid_body' | 'invalid_action' | 'invalid_planId' | 'invalid_maxParticipants' | 'invalid_label' | 'invalid_roomToken' };

/** roomToken に紐づく共同編集ルームの所有者判定に使う最小限のドキュメント形。 */
export interface RoomOwnerDoc {
  ownerId?: string;
  planId?: string;
}

/** 結果: サーバーが認証済みuidと照合した本人判定。 */
export interface OwnerCheckResult {
  isOwner: boolean;
  planId?: string;
}

/** collabRooms/{roomToken} のドキュメント(存在しなければ null)と uid から本人判定を行う純関数。 */
export function resolveRoomOwner(room: RoomOwnerDoc | null, uid: string): OwnerCheckResult {
  if (!room || room.ownerId !== uid) return { isOwner: false };
  return { isOwner: true, planId: room.planId };
}
```

`parseRoomManageRequest` の冒頭、action検証の直後に `check-owner` の早期分岐を追加(既存の `planId` 必須チェックより前に置く):

```ts
export function parseRoomManageRequest(body: unknown): ParseResult {
  if (!body || typeof body !== 'object') return { ok: false, error: 'invalid_body' };
  const b = body as Record<string, unknown>;

  const action = b.action;
  if (typeof action !== 'string' || !ROOM_ACTIONS.includes(action as RoomAction)) {
    return { ok: false, error: 'invalid_action' };
  }

  // check-owner だけ roomToken ベース(planId 不要)。他の4アクションより前に分岐する。
  if (action === 'check-owner') {
    const roomToken = b.roomToken;
    if (typeof roomToken !== 'string' || roomToken.length === 0) {
      return { ok: false, error: 'invalid_roomToken' };
    }
    return { ok: true, req: { action: 'check-owner', roomToken } };
  }

  const planId = b.planId;
  if (typeof planId !== 'string' || planId.length === 0) {
    return { ok: false, error: 'invalid_planId' };
  }

  // (以降、label/set-max/create/reissue/revoke の既存処理は無変更のまま残す)
  ...
```

(`...` 以降は既存コードを変更せずそのまま残すこと。)

- [ ] **Step 4: テストが通ることを確認**

Run: `rtk npx vitest run src/lib/__tests__/collabRoomManageLogic.test.ts`
Expected: PASS(全件)

- [ ] **Step 5: `_roomHandler.ts` に `check-owner` の早期分岐を実装**

import行を変更:

```ts
import { parseRoomManageRequest, resolveRoomOwner, type RoomOwnerDoc } from './_roomManageLogic.js';
```

`const reqData = parsed.req;` の直後、`const planId = reqData.planId;` より前に挿入(`db` の宣言を1行上へ移動する):

```ts
  const parsed = parseRoomManageRequest(req.body);
  // 'error' in parsed で失敗バリアントへ narrow する(`!parsed.ok` の boolean discriminant narrow は
  // @vercel/node の strictNullChecks-off ビルドでは効かないため。`in` 演算子の narrow は strict 非依存)。
  if ('error' in parsed) return res.status(400).json({ error: parsed.error });
  const reqData = parsed.req;

  const db = getAdminFirestore();

  // check-owner: roomToken ベースの所有者判定(planId 不要・Firestore トランザクション不要・読み取りのみ)。
  // 共有リンクをオーナー本人が踏んだときの自動リダイレクト判定に使う。
  if (reqData.action === 'check-owner') {
    const roomSnap = await db.collection('collabRooms').doc(reqData.roomToken).get();
    const room = roomSnap.exists ? (roomSnap.data() as RoomOwnerDoc) : null;
    return res.status(200).json(resolveRoomOwner(room, uid));
  }

  const planId = reqData.planId;
  const planRef = db.collection('plans').doc(planId);
```

(元の `const db = getAdminFirestore(); const planRef = db.collection('plans').doc(planId);` の2行をこの形に置き換える。それ以外(トランザクション本体等)は無変更。)

- [ ] **Step 6: 型チェックとテストを実行**

Run: `rtk npx tsc -b --noEmit && rtk npx vitest run src/lib/__tests__/collabRoomManageLogic.test.ts`
Expected: 型エラー無し・テスト全件PASS

- [ ] **Step 7: コミット**

```bash
git add api/collab/_roomManageLogic.ts api/collab/_roomHandler.ts src/lib/__tests__/collabRoomManageLogic.test.ts
git commit -m "feat(collab): /api/collab/room に check-owner アクションを追加"
```

---

### Task 2: クライアントAPI — `collabRoomApi.ts` に `checkOwner()` を追加

**Files:**
- Modify: `src/lib/collab/collabRoomApi.ts`
- Test: `src/lib/collab/__tests__/collabRoomApi.test.ts`

**Interfaces:**
- Consumes: なし(独立)
- Produces: `checkOwner(roomToken: string): Promise<OwnerCheckResult>`、`export interface OwnerCheckResult { isOwner: boolean; planId?: string }`。Task 3 がこの関数と型を使う。

- [ ] **Step 1: 失敗するテストを書く(`collabRoomApi.test.ts` に追記)**

import行に `checkOwner` を追加:

```ts
import { createRoom, setMaxParticipants, revokeRoom, reissueRoom, checkOwner } from '../collabRoomApi';
```

`describe('collabRoomApi', ...)` 内、末尾のテストの後に追加:

```ts
  it('checkOwner は action=check-owner を roomToken で POST する', async () => {
    mockApi.mockResolvedValue(ok({ isOwner: true, planId: 'plan1' }));
    const r = await checkOwner('tok123');
    expect(mockApi).toHaveBeenCalledWith('/api/collab/room', expect.objectContaining({
      body: JSON.stringify({ action: 'check-owner', roomToken: 'tok123' }),
    }));
    expect(r).toEqual({ isOwner: true, planId: 'plan1' });
  });

  it('checkOwner は isOwner:false もそのまま返す', async () => {
    mockApi.mockResolvedValue(ok({ isOwner: false }));
    const r = await checkOwner('tok123');
    expect(r).toEqual({ isOwner: false });
  });
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `rtk npx vitest run src/lib/collab/__tests__/collabRoomApi.test.ts`
Expected: FAIL(`checkOwner` が存在しない)

- [ ] **Step 3: `collabRoomApi.ts` に実装を追加**

`type Action = 'create' | 'set-max' | 'revoke' | 'reissue';` を次に置き換え:

```ts
type Action = 'create' | 'set-max' | 'revoke' | 'reissue' | 'check-owner';
```

ファイル末尾に追加:

```ts
/** 共有リンクを開いた人が、この部屋のオーナー本人かどうかをサーバーに確認する。 */
export interface OwnerCheckResult {
  isOwner: boolean;
  planId?: string;
}

/** roomToken ベースの本人確認(planId不要)。共有リンクをオーナーが踏んだときの自動判別に使う。 */
export function checkOwner(roomToken: string): Promise<OwnerCheckResult> {
  return post({ action: 'check-owner' as Action, roomToken });
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `rtk npx vitest run src/lib/collab/__tests__/collabRoomApi.test.ts`
Expected: PASS(全件)

- [ ] **Step 5: コミット**

```bash
git add src/lib/collab/collabRoomApi.ts src/lib/collab/__tests__/collabRoomApi.test.ts
git commit -m "feat(collab): collabRoomApi に checkOwner() クライアントヘルパーを追加"
```

---

### Task 3: `CollabJoinerPage.tsx` — オーナー自動判別とリダイレクト

**Files:**
- Modify: `src/components/CollabJoinerPage.tsx`
- Test: `src/components/__tests__/CollabJoinerPage.test.tsx`

**Interfaces:**
- Consumes: `checkOwner(roomToken): Promise<OwnerCheckResult>` (Task 2)、`usePlanStore.getState().setCurrentPlanId(id: string | null): void` (既存)
- Produces: `shouldRedirectToOwnerEditor(result: OwnerCheckResult | null): { redirect: false } | { redirect: true; planId: string }`(純関数・テスト対象)

- [ ] **Step 1: 失敗するテストを書く(`CollabJoinerPage.test.tsx` に追記)**

import行を変更:

```ts
import { joinerView, computeCanEdit, rehydrateThenClearReadonly, shouldRedirectToOwnerEditor } from "../CollabJoinerPage";
```

ファイル末尾に追加:

```ts
describe("shouldRedirectToOwnerEditor(オーナー判別結果 → リダイレクト要否)", () => {
  it("isOwner:true かつ planId があれば redirect:true", () => {
    expect(shouldRedirectToOwnerEditor({ isOwner: true, planId: "plan1" }))
      .toEqual({ redirect: true, planId: "plan1" });
  });
  it("isOwner:false は redirect:false", () => {
    expect(shouldRedirectToOwnerEditor({ isOwner: false })).toEqual({ redirect: false });
  });
  it("isOwner:true でも planId が無ければ redirect:false(安全側)", () => {
    expect(shouldRedirectToOwnerEditor({ isOwner: true })).toEqual({ redirect: false });
  });
  it("result が null(判別未完了/失敗)は redirect:false", () => {
    expect(shouldRedirectToOwnerEditor(null)).toEqual({ redirect: false });
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `rtk npx vitest run src/components/__tests__/CollabJoinerPage.test.tsx`
Expected: FAIL(`shouldRedirectToOwnerEditor` が存在しない)

- [ ] **Step 3: `CollabJoinerPage.tsx` に実装を追加**

import群に追加(`import { LoginModal } from "./LoginModal";` の下あたり):

```tsx
import { checkOwner, type OwnerCheckResult } from "../lib/collab/collabRoomApi";
import { usePlanStore } from "../store/usePlanStore";
```

`computeCanEdit` 関数の直後に純関数を追加:

```tsx
/** ⑤-4: オーナー判別結果 → いつもの編集画面へ案内するか。判別未完了・非オーナー・情報欠落は
 * 全て redirect:false(安全側=今まで通り参加者フローを継続)。 */
export function shouldRedirectToOwnerEditor(
  result: OwnerCheckResult | null,
): { redirect: false } | { redirect: true; planId: string } {
  if (!result || !result.isOwner || !result.planId) return { redirect: false };
  return { redirect: true, planId: result.planId };
}
```

コンポーネント内、`const user = useAuthStore((s) => s.user);` の直後に1行追加:

```tsx
  const authLoading = useAuthStore((s) => s.loading);
```

「効果A」(`useEffect(() => { if (!roomToken) {...`)の直後、「効果B」の直前に新しい効果を追加:

```tsx
  // 効果0(⑤-4): オーナー自動判別。ログイン済みなら「自分の部屋か」をサーバーに確認し、本人なら
  // いつもの編集画面(そのプランを開いた状態)へ案内する。共有リンクを自分で踏んでも参加者扱いの
  // まま権限を失わないための処置。判別未完了・非ログイン・失敗は全て安全側(参加者フロー継続)。
  useEffect(() => {
    if (!roomToken || authLoading || !isLoggedIn) return;
    let cancelled = false;
    void checkOwner(roomToken)
      .then((result) => {
        if (cancelled) return;
        const decision = shouldRedirectToOwnerEditor(result);
        if (decision.redirect) {
          usePlanStore.getState().setCurrentPlanId(decision.planId);
          navigate('/');
        }
      })
      .catch(() => { /* 判別失敗は安全側: 参加者フローを継続 */ });
    return () => { cancelled = true; };
  }, [roomToken, authLoading, isLoggedIn, navigate]);
```

- [ ] **Step 4: テストと型チェックを実行**

Run: `rtk npx tsc -b --noEmit && rtk npx vitest run src/components/__tests__/CollabJoinerPage.test.tsx`
Expected: 型エラー無し・テスト全件PASS

- [ ] **Step 5: コミット**

```bash
git add src/components/CollabJoinerPage.tsx src/components/__tests__/CollabJoinerPage.test.tsx
git commit -m "feat(collab): オーナーが自分の共有リンクを開いたらいつもの編集画面へ自動案内"
```

---

### Task 4: `useCollabSessionStore.setMax` の保存漏れ修正 + デバウンス撤去

**Files:**
- Modify: `src/store/useCollabSessionStore.ts`
- Test: `src/store/__tests__/useCollabSessionStore.test.ts`

**Interfaces:**
- Produces: `setMax: (planId: string, n: number) => Promise<void>`(旧: `void`。呼び出し元は Task 5 で更新)。成功時に `useCollabSessionStore.maxParticipants` と `usePlanStore` の該当プランの `collabMaxParticipants` の両方を更新する。失敗時は例外を投げる(store状態は変更しない)。

- [ ] **Step 1: 失敗するテストを書く(既存の `'setMax: 楽観的更新は即時・API はデバウンス後に送信'` を置き換え)**

該当テストを削除し、次の2つに置き換える:

```ts
  it('setMax: API を呼び、成功したら store と plan 側の両方を更新する', async () => {
    useCollabSessionStore.setState({ active: true, roomToken: 'tok', maxParticipants: 8, session: fakeSession() });
    usePlanStore.setState({
      currentPlanId: 'plan1',
      plans: [{
        id: 'plan1', ownerId: 'uid1', ownerDisplayName: 'Owner', title: 'p',
        contentId: null, isPublic: false, copyCount: 0, useCount: 0,
        data: { timelineEvents: [], timelineMitigations: [], phases: [], partyMembers: [], labels: [], memos: [] },
        createdAt: 0, updatedAt: 0, collabMaxParticipants: 8,
      }],
    } as any);
    mk(setMaxParticipants).mockResolvedValue({ roomToken: 'tok', maxParticipants: 12, revoked: false });

    await useCollabSessionStore.getState().setMax('plan1', 12);

    expect(setMaxParticipants).toHaveBeenCalledWith('plan1', 12);
    expect(useCollabSessionStore.getState().maxParticipants).toBe(12);
    expect(usePlanStore.getState().plans.find((p) => p.id === 'plan1')?.collabMaxParticipants).toBe(12);
  });

  it('setMax: API 失敗時は store を書き換えず例外を投げる', async () => {
    useCollabSessionStore.setState({ active: true, roomToken: 'tok', maxParticipants: 8, session: fakeSession() });
    mk(setMaxParticipants).mockRejectedValue(new Error('network'));

    await expect(useCollabSessionStore.getState().setMax('plan1', 12)).rejects.toThrow('network');
    expect(useCollabSessionStore.getState().maxParticipants).toBe(8);
  });
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `rtk npx vitest run src/store/__tests__/useCollabSessionStore.test.ts`
Expected: FAIL(旧デバウンス実装のため即時反映されない/plan側が更新されない)

- [ ] **Step 3: `useCollabSessionStore.ts` を実装**

モジュール冒頭の以下2行を削除:

```ts
// 人数変更のデバウンス: 連打しても最後の値だけサーバへ送る(往復待ちで表示が遅れるのを防ぐ)。
let maxSyncTimer: ReturnType<typeof setTimeout> | null = null;
const MAX_SYNC_DEBOUNCE_MS = 400;
```

interface内の該当行を置き換え:

```ts
  /** 入れる人数を確定変更する(呼び出し成功で store と plan 側の両方を更新)。失敗時は例外を投げる。 */
  setMax: (planId: string, n: number) => Promise<void>;
```

`setMax` の実装を置き換え:

```ts
  setMax: async (planId, n) => {
    const info = await setMaxParticipants(planId, n);
    set({ maxParticipants: info.maxParticipants });
    // #6 と同じ理由: plan 側にも書き戻す(でないとリロード後に古い値で上書き表示される)。
    const { usePlanStore } = await import('./usePlanStore');
    usePlanStore.getState().updatePlan(planId, { collabMaxParticipants: info.maxParticipants });
  },
```

- [ ] **Step 4: テストと型チェックを実行**

Run: `rtk npx tsc -b --noEmit && rtk npx vitest run src/store/__tests__/useCollabSessionStore.test.ts`
Expected: 型エラー無し・テスト全件PASS

- [ ] **Step 5: コミット**

```bash
git add src/store/useCollabSessionStore.ts src/store/__tests__/useCollabSessionStore.test.ts
git commit -m "fix(collab): setMax がplan側のcollabMaxParticipantsへ保存されず再読込で戻るバグを修正"
```

---

### Task 5: `OwnerCollabPanel.tsx` — 仮の値+確定ボタンのUI変更 + i18n

**Files:**
- Modify: `src/components/collab/OwnerCollabPanel.tsx`
- Modify: `src/locales/ja.json` / `en.json` / `ko.json` / `zh.json` / `zh-Hant.json`
- Test: `src/components/collab/__tests__/OwnerCollabPanel.test.tsx`

**Interfaces:**
- Consumes: `setMax(planId, n): Promise<void>` (Task 4)

- [ ] **Step 1: i18nキーを追加**

各ロケールファイルの `"people_hint": ...,` の行の直後に1行追加する。

`src/locales/ja.json`:
```json
        "confirm_max": "定員を{{count}}人に変更する",
```

`src/locales/en.json`:
```json
        "confirm_max": "Change limit to {{count}}",
```

`src/locales/ko.json`:
```json
        "confirm_max": "정원을 {{count}}명으로 변경",
```

`src/locales/zh.json`:
```json
        "confirm_max": "将人数上限改为{{count}}人",
```

`src/locales/zh-Hant.json`:
```json
        "confirm_max": "將人數上限改為{{count}}人",
```

- [ ] **Step 2: 失敗するテストを書く(`OwnerCollabPanel.test.tsx` を修正)**

importに `waitFor` を追加:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
```

既存の `'＋/− で setMax を呼ぶ(1..20 クランプ)'` テストを削除し、次の3つに置き換える:

```tsx
  it('＋/− は仮の値だけを変える。確定ボタンを押すまで setMax は呼ばれない', () => {
    const setMax = vi.fn().mockResolvedValue(undefined);
    useCollabSessionStore.setState({ setMax } as any);
    render(<OwnerCollabPanel planId="plan1" onClose={() => {}} />);
    fireEvent.click(screen.getByLabelText('inc-people'));
    expect(setMax).not.toHaveBeenCalled();
    expect(screen.getByText('9')).toBeInTheDocument();
  });

  it('変更していない間は確定ボタンが出ない', () => {
    render(<OwnerCollabPanel planId="plan1" onClose={() => {}} />);
    expect(screen.queryByText(/collab.confirm_max/)).not.toBeInTheDocument();
  });

  it('仮の値を変えると確定ボタンが出る。押すと setMax(planId, 仮の値) を呼び、成功後はボタンが消える', async () => {
    const setMax = vi.fn().mockImplementation(async (_planId: string, n: number) => {
      useCollabSessionStore.setState({ maxParticipants: n });
    });
    useCollabSessionStore.setState({ setMax } as any);
    render(<OwnerCollabPanel planId="plan1" onClose={() => {}} />);
    fireEvent.click(screen.getByLabelText('inc-people'));
    const confirmBtn = screen.getByText('collab.confirm_max:9');
    fireEvent.click(confirmBtn);
    await waitFor(() => expect(setMax).toHaveBeenCalledWith('plan1', 9));
    await waitFor(() => expect(screen.queryByText(/collab.confirm_max/)).not.toBeInTheDocument());
  });
```

(モックの `t` 関数(ファイル冒頭の `vi.mock('react-i18next', ...)`)は `o?.count != null` の場合 `${k}:${o.count}` を返す実装が既にあるため、`collab.confirm_max:9` という表示になる。)

- [ ] **Step 3: テストが失敗することを確認**

Run: `rtk npx vitest run src/components/collab/__tests__/OwnerCollabPanel.test.tsx`
Expected: FAIL(まだ仮の値/確定ボタンが存在しない)

- [ ] **Step 4: `OwnerCollabPanel.tsx` を実装**

importに `showToast` を追加(`import { ConfirmDialog } from '../ConfirmDialog';` の下):

```tsx
import { showToast } from '../Toast';
```

`const [label, setLabel] = React.useState('');` の直後に追加:

```tsx
  // 仮の値(確定ボタンを押すまでサーバーへ送らない)。maxParticipants(確定値)が外部要因で
  // 変わったら追従する(#6の再同期やsetMax成功後の反映を含む)。
  const [draftMax, setDraftMax] = React.useState(maxParticipants);
  React.useEffect(() => { setDraftMax(maxParticipants); }, [maxParticipants]);
  const [maxBusy, setMaxBusy] = React.useState(false);
```

`step` 関数を置き換え:

```tsx
  const step = (delta: number) => {
    setDraftMax((d) => Math.max(1, Math.min(SYSTEM_MAX_PARTICIPANTS, d + delta)));
  };

  const handleConfirmMax = async () => {
    setMaxBusy(true);
    try {
      await setMax(planId, draftMax);
    } catch {
      showToast(t('collab.error_generic'));
    } finally {
      setMaxBusy(false);
    }
  };
```

人数表示のJSXブロックを置き換え:

```tsx
              <div>
                <div className="text-app-xs uppercase tracking-wide text-app-text-muted mb-1.5">{t('collab.people_label')}</div>
                <div className="flex flex-wrap items-center gap-3">
                  <button aria-label="dec-people" onClick={() => step(-1)} className="w-8 h-8 rounded-lg border border-app-border bg-app-surface2/60 flex items-center justify-center text-app-text cursor-pointer active:scale-95"><Minus size={15} /></button>
                  <span className="text-app-xl font-bold text-app-text min-w-[1.5rem] text-center">{draftMax}</span>
                  <button aria-label="inc-people" onClick={() => step(1)} className="w-8 h-8 rounded-lg border border-app-border bg-app-surface2/60 flex items-center justify-center text-app-text cursor-pointer active:scale-95"><Plus size={15} /></button>
                  <span className="text-app-sm text-app-text-muted">{t('collab.people_unit')}</span>
                  {draftMax !== maxParticipants && (
                    <button
                      disabled={maxBusy}
                      onClick={handleConfirmMax}
                      className="px-3 h-8 rounded-lg bg-app-text text-app-bg font-bold text-app-sm cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t('collab.confirm_max', { count: draftMax })}
                    </button>
                  )}
                </div>
                <div className="text-app-xs text-app-text-muted mt-1">{t('collab.people_hint', { max: SYSTEM_MAX_PARTICIPANTS })}</div>
              </div>
```

- [ ] **Step 5: テストと型チェックを実行**

Run: `rtk npx tsc -b --noEmit && rtk npx vitest run src/components/collab/__tests__/OwnerCollabPanel.test.tsx`
Expected: 型エラー無し・テスト全件PASS

- [ ] **Step 6: コミット**

```bash
git add src/components/collab/OwnerCollabPanel.tsx src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json src/locales/zh-Hant.json src/components/collab/__tests__/OwnerCollabPanel.test.tsx
git commit -m "feat(collab): 人数変更を仮の値+確定ボタン方式にし、5言語のi18nキーを追加"
```

---

### Task 6: 最終検証(フルビルド・フルテスト・実機確認)

**Files:** なし(検証のみ)

- [ ] **Step 1: フルビルドを実行**

Run: `rtk npm run build`
Expected: エラー無く完了

- [ ] **Step 2: フルテストを実行**

Run: `rtk npm test`
Expected: 既知の環境依存失敗(`EphemeralAddPanel.test.tsx`、開発サーバー未起動時のみ失敗)以外は全件PASS

- [ ] **Step 3: 第三者視点のコードレビューを1回挟む**

`/code-review` で今回の一連の差分(Task1〜5)をレビューし、指摘のうち正しさに関わるものだけ反映する。

- [ ] **Step 4: 実機での手動確認手順(本番反映後)**

以下を実際のブラウザで確認する(ユーザーと一緒に実施):
1. オーナーとしてログインした状態で、共同編集リンクをコピーし、別タブでそのリンクを開く → 自動的にいつもの編集画面(そのプランが開いた状態)になることを確認する。
2. 別のアカウント(または未ログイン状態)で同じリンクを開く → 従来通り参加者用の画面のままであることを確認する(オーナー以外に影響が無いことの確認)。
3. オーナーパネルで人数を+/-で変えてから「定員を◯人に変更する」ボタンを押す → 反映されることを確認する。
4. 3の後、パネルを閉じて再度開く → 変更した人数のままであることを確認する(リンクを作り直していないこと)。
5. 人数を変えたが確定ボタンを押さずに閉じた場合 → 次に開いたときは元の人数に戻っていることを確認する。

- [ ] **Step 5: 本番デプロイ**

他の未関連の変更とは混ぜず、このタスックの変更のみを単独でpushする。

```bash
git push
```

Vercelの自動デプロイ完了後、Step 4の手動確認を実施する。
