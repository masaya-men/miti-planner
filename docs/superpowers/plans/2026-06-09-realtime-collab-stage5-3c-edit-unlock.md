# 共同編集 段取り⑤-3c: 注意UI + ログインゲート + 編集解禁 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ジョイナーが部屋ごとのフル警告に同意 + ログインすると、その部屋の表を一緒に編集できる（オーナーの本物の表にライブ反映）。未ログイン/未同意は読み取り専用（⑤-3b）を維持。サーバ側編集認証は非ゴール（④/公開直前）。

**Architecture:** ⑤-3b の「読み取り専用ジョイナー」を、`canEdit`（ログイン && 部屋ごと同意）で条件付きに編集者へ昇格させる。`canEdit` のとき `startCollabSession(roomToken, { readOnly:false })` で `enterCollabMode` を実行＝編集が Y に流れる。「自分の localStorage 保護（persist skip = `_collabReadonly`）」は編集可否と独立に全ジョイナー常時 ON。オーナー名は発行時その場ラベル（`collabRooms.label`）を contentId と同型の seed で配送。

**Tech Stack:** React 18 + React Router v6, Zustand (`persist`), Yjs / y-partyserver (worker), Vercel Node Functions（`api/collab/*`・相対 import は `.js` 必須）, Cloudflare DO worker, react-i18next。

**設計書（正典）:** [docs/superpowers/specs/2026-06-09-realtime-collab-stage5-3c-edit-unlock-design.md](../specs/2026-06-09-realtime-collab-stage5-3c-edit-unlock-design.md)

---

## 前提・既存実装（読んで把握）

- ⑤-3b 完成済（同ブランチ系）: `startCollabSession(roomToken, { readOnly?, onContentId? })` + 純関数 `applyRoomToStore` [src/lib/collab/collabProvider.ts](../../../src/lib/collab/collabProvider.ts)。`readContentId`/`META_CONTENT_ID` [src/lib/collab/yjsPlanData.ts](../../../src/lib/collab/yjsPlanData.ts) / [workers/collab/src/yjsPlanData.ts](../../../workers/collab/src/yjsPlanData.ts)。
- ジョイナー: [src/components/CollabJoinerPage.tsx](../../../src/components/CollabJoinerPage.tsx)（lazy・`joinerView`・cleanup の rehydrate→readonly 解除順序が肝）、[src/store/useCollabJoinerSession.ts](../../../src/store/useCollabJoinerSession.ts)（roomToken/contentId）。
- 読み取り専用ゲート: [src/components/Timeline.tsx](../../../src/components/Timeline.tsx) `resolveContentId`/`isJoinerReadonly(roomToken)`/`readOnlyRef.current` 早期 return。
- persist skip: [src/store/useMitigationStore.ts](../../../src/store/useMitigationStore.ts) `_collabReadonly`/`setCollabReadonly` + persist setItem ガード。
- 受付係: [api/collab/_roomLogic.ts](../../../api/collab/_roomLogic.ts) `resolveRoom`/`CollabRoomDoc`、[api/collab/_loadHandler.ts](../../../api/collab/_loadHandler.ts)（room を読み load レスポンスに maxParticipants を足す）。
- ルーム発行: [api/collab/_roomManageLogic.ts](../../../api/collab/_roomManageLogic.ts) `parseRoomManageRequest`、[api/collab/_roomHandler.ts](../../../api/collab/_roomHandler.ts)（collabRooms doc を tx.set）、[src/lib/collab/collabRoomApi.ts](../../../src/lib/collab/collabRoomApi.ts) `createRoom`/`reissueRoom`。
- ログイン（Discord リダイレクト）: [src/store/useAuthStore.ts](../../../src/store/useAuthStore.ts) `signInWith`/`buildReturnUrl`、戻りは [api/auth/_discordHandler.ts:171](../../../api/auth/_discordHandler.ts#L171)。`user` で在ログイン判定。
- 同意パターン参考: [src/lib/popularConsent.ts](../../../src/lib/popularConsent.ts) / [src/components/PopularConsentDialog.tsx](../../../src/components/PopularConsentDialog.tsx)。

## File Structure（触るファイル）

**ブランチ（Task 0）:** ⑤-3b の上に `feat/collab-stage5-3c-edit-unlock`。

**エンジン拡張（ownerLabel seed・contentId と同型 additive）:**
- `api/collab/_roomLogic.ts` — `CollabRoomDoc.label?` + `resolveRoom` 戻りに `label?`。
- `api/collab/_loadHandler.ts` — load レスポンスに `ownerLabel`（room.label）。
- `workers/collab/src/yjsPlanData.ts` — `PlanDataSeed.ownerLabel?` + `META_OWNER_LABEL` を planMeta に seed（read=save は返さない）。
- `src/lib/collab/yjsPlanData.ts` — `META_OWNER_LABEL` + `readOwnerLabel`。
- `src/lib/collab/collabProvider.ts` — `applyRoomToStore`/`startCollabSession` に `onOwnerLabel`。

**ルーム発行ラベル（書き込み経路）:**
- `api/collab/_roomManageLogic.ts` — `create`/`reissue` に任意 `label`（検証: 文字列・trim・上限）。
- `api/collab/_roomHandler.ts` — collabRooms doc に `label` を書く。
- `src/lib/collab/collabRoomApi.ts` — `createRoom`/`reissueRoom` に `label?`。
- `src/components/collab/OwnerCollabPanel.tsx` — ラベル入力欄（held UI）。

**クライアントゲート:**
- `src/lib/collabEditConsent.ts`（新規） — 部屋ごと同意 localStorage。
- `src/store/useCollabJoinerSession.ts` — `canEdit`/`ownerLabel` 追加。
- `src/components/Timeline.tsx` — `isJoinerReadonly(roomToken, canEdit)` 拡張。
- `src/components/CollabEditConsentModal.tsx`（新規） — フル警告モーダル。
- `src/components/CollabJoinerBanner.tsx`（新規） — 常時赤バナー。
- `src/components/CollabJoinerPage.tsx` — `computeCanEdit` + モーダル/バナー結線 + 再接続 + onOwnerLabel。
- `src/locales/{ja,en,ko,zh}.json` — モーダル + バナー文言。

## 検証コマンド
- client 単体: `npx vitest run <path>`
- worker: `cd workers/collab; npx vitest run; npx tsc -b`
- 受付係: `npx vitest run src/lib/__tests__/collabLogic.test.ts src/lib/__tests__/collabRoomLogic.test.ts src/lib/__tests__/collabRoomManageLogic.test.ts`
- 全 root（最後）: `npx vitest run`（既知5失敗=TopBar4+HousingWorkspace1 のみ）
- build: `npm run build`

> ⚠ root vitest は `pool:'vmThreads'`。出力をパイプしない。push/main マージ/worker deploy は ⑤-3 完成 + 承認まで保留。

---

### Task 0: 作業ブランチ作成

**Files:** git 操作のみ。

- [ ] **Step 1: ⑤-3b ブランチ上に作業ブランチを作る**

```bash
git checkout feat/collab-stage5-3b-joiner-view
git checkout -b feat/collab-stage5-3c-edit-unlock
```
Expected: 競合なし（⑤-3c は ⑤-3b の上に線形）。push しない。

- [ ] **Step 2: 基線確認**

```bash
npx vitest run src/lib/collab src/store/__tests__/useCollabJoinerSession.test.ts
```
Expected: PASS（⑤-3b の collab 単体が緑）。

---

### Task 1: 受付係 load が ownerLabel（room.label）を返す

**Files:**
- Modify: `api/collab/_roomLogic.ts`, `api/collab/_loadHandler.ts`
- Test: `src/lib/__tests__/collabRoomLogic.test.ts`

- [ ] **Step 1: 失敗するテスト**

`collabRoomLogic.test.ts` の `resolveRoom` describe に追加:

```typescript
  it('label がある部屋は解決結果に label を含める', () => {
    expect(resolveRoom({ planId: 'p1', label: '土曜固定P' })).toMatchObject({ ok: true, planId: 'p1', label: '土曜固定P' });
  });
  it('label 未設定は label を持たない（undefined）', () => {
    const r = resolveRoom({ planId: 'p1' });
    expect(r.ok && r.label).toBeUndefined();
  });
```

- [ ] **Step 2: 失敗確認**

Run: `npx vitest run src/lib/__tests__/collabRoomLogic.test.ts`
Expected: FAIL（label が戻りに無い）

- [ ] **Step 3: 実装**

`api/collab/_roomLogic.ts`:

`CollabRoomDoc` に追加（`revoked?` の直後）:

```typescript
  label?: string;
```

`RoomResolution` の ok バリアントに追加:

```typescript
  | { ok: true; planId: string; maxParticipants: number; label?: string }
```

`resolveRoom` の return（最後の ok）に追加:

```typescript
  return { ok: true, planId: room.planId, maxParticipants: clampMaxParticipants(room.maxParticipants), label: room.label };
```

`api/collab/_loadHandler.ts`:

`maxParticipants` 宣言の直後に追加:

```typescript
  let ownerLabel: string | undefined;
```

roomToken 分岐内（`maxParticipants = room.maxParticipants;` の直後）:

```typescript
    ownerLabel = room.label;
```

最終 return を変更:

```typescript
  return res.status(200).json({ ...result, maxParticipants, ownerLabel });
```

- [ ] **Step 4: 通過確認 + build**

Run: `npx vitest run src/lib/__tests__/collabRoomLogic.test.ts && npm run build`
Expected: PASS / build 緑

- [ ] **Step 5: コミット**

```bash
git add api/collab/_roomLogic.ts api/collab/_loadHandler.ts src/lib/__tests__/collabRoomLogic.test.ts
git commit -m "feat(collab): stage5-3c 受付係 load が ownerLabel(room.label)を返す"
```

---

### Task 2: worker が ownerLabel を planMeta に seed（save 非対象）

**Files:**
- Modify: `workers/collab/src/yjsPlanData.ts`
- Test: `workers/collab/src/yjsPlanData.test.ts`

- [ ] **Step 1: 失敗するテスト**

`workers/collab/src/yjsPlanData.test.ts` の `seed` fixture に追加（`contentId` の直後）:

```typescript
  ownerLabel: "土曜固定P",
```

import に `readOwnerLabel` を追加:

```typescript
import { buildSeedDocFull, readPlanDataFull, readContentId, readOwnerLabel, type PlanDataSeed } from "./yjsPlanData";
```

往復テストの分割代入を更新（contentId と同様に save 非対象として除外）:

```typescript
    const { contentId, ownerLabel, ...rest } = seed;
    expect(readPlanDataFull(doc)).toEqual(rest);
```

新規テスト追加:

```typescript
  it("ownerLabel は planMeta に seed され readOwnerLabel で読める", () => {
    const doc = buildSeedDocFull(seed);
    expect(readOwnerLabel(doc)).toBe("土曜固定P");
  });
```

- [ ] **Step 2: 失敗確認**

Run: `cd workers/collab; npx vitest run src/yjsPlanData.test.ts`
Expected: FAIL（`readOwnerLabel` 未 export）

- [ ] **Step 3: 実装**

`workers/collab/src/yjsPlanData.ts`:

`META_CONTENT_ID` の直後に:

```typescript
// ⑤-3c: オーナーが発行時に付けた部屋ラベル。seed のみ（save 経路では読まない）。
export const META_OWNER_LABEL = "ownerLabel";
```

`PlanDataSeed` に追加（`contentId?` の直後）:

```typescript
  ownerLabel?: string;
```

`buildSeedDocFull` の planMeta 設定に追加（`META_CONTENT_ID` set の直後）:

```typescript
    if (seed.ownerLabel !== undefined) meta.set(META_OWNER_LABEL, seed.ownerLabel);
```

末尾に reader を追加:

```typescript
/** seed された ownerLabel（オーナー設定の部屋ラベル）を読む。save 経路では使わない。 */
export function readOwnerLabel(doc: Y.Doc): string | undefined {
  return doc.getMap(PLAN_META_KEY).get(META_OWNER_LABEL) as string | undefined;
}
```

- [ ] **Step 4: 通過確認**

Run: `cd workers/collab; npx vitest run; npx tsc -b`
Expected: PASS（全緑 / 型緑）。`SeedResultFull extends PlanDataSeed` で `ownerLabel` が透過（コード変更不要）。

- [ ] **Step 5: コミット**

```bash
git add workers/collab/src/yjsPlanData.ts workers/collab/src/yjsPlanData.test.ts
git commit -m "feat(collab): stage5-3c worker が ownerLabel を planMeta に seed(save 非対象)"
```

---

### Task 3: クライアントが ownerLabel を読み、セッションが渡す

**Files:**
- Modify: `src/lib/collab/yjsPlanData.ts`, `src/lib/collab/collabProvider.ts`
- Test: `src/lib/collab/__tests__/yjsPlanData.test.ts`, `src/lib/collab/__tests__/collabProvider.readonly.test.ts`

- [ ] **Step 1: 失敗するテスト（yjsPlanData）**

`src/lib/collab/__tests__/yjsPlanData.test.ts` の import に `readOwnerLabel, META_OWNER_LABEL` を追加（`readContentId, ... META_CONTENT_ID` と同じ行群）。planMeta describe に追加:

```typescript
  it("readOwnerLabel は planMeta の ownerLabel を読む（未設定は undefined）", () => {
    const a = new Y.Doc(), b = new Y.Doc(); bridge(a, b);
    setMetaField(a, META_OWNER_LABEL, "土曜固定P");
    expect(readOwnerLabel(b)).toBe("土曜固定P");
    expect(readOwnerLabel(new Y.Doc())).toBeUndefined();
  });
```

- [ ] **Step 2: 失敗確認**

Run: `npx vitest run src/lib/collab/__tests__/yjsPlanData.test.ts`
Expected: FAIL（`readOwnerLabel`/`META_OWNER_LABEL` 未 export）

- [ ] **Step 3: 実装（yjsPlanData）**

`src/lib/collab/yjsPlanData.ts`:

`META_CONTENT_ID` の直後:

```typescript
// ⑤-3c: オーナー設定の部屋ラベル。seed のみ（save には載らない）。
export const META_OWNER_LABEL = "ownerLabel";
```

`readContentId` の直後:

```typescript
/** seed された ownerLabel（オーナー設定の部屋ラベル・バナー表示用）。save には載らない。 */
export function readOwnerLabel(doc: Y.Doc): string | undefined {
  return doc.getMap(PLAN_META_KEY).get(META_OWNER_LABEL) as string | undefined;
}
```

- [ ] **Step 4: 失敗するテスト（collabProvider・onOwnerLabel）**

`src/lib/collab/__tests__/collabProvider.readonly.test.ts` に追加。import に `META_OWNER_LABEL` を追加（`setMetaField, META_CONTENT_ID` と同じ行）。新規テスト:

```typescript
  it("ownerLabel を planMeta から読みコールバックに渡す", () => {
    const doc = new Y.Doc();
    setMetaField(doc, META_OWNER_LABEL, "土曜固定P");
    const onOwnerLabel = vi.fn();
    applyRoomToStore(doc, { readOnly: true, handlers: {} as any, onOwnerLabel });
    expect(onOwnerLabel).toHaveBeenCalledWith("土曜固定P");
  });
```

- [ ] **Step 5: 失敗確認**

Run: `npx vitest run src/lib/collab/__tests__/collabProvider.readonly.test.ts`
Expected: FAIL（onOwnerLabel が呼ばれない）

- [ ] **Step 6: 実装（collabProvider）**

`src/lib/collab/collabProvider.ts`:

import の `readContentId` の隣に `readOwnerLabel` を追加（yjsPlanData から）。

`applyRoomToStore` の opts 型に追加 + 末尾呼び出し:

```typescript
export function applyRoomToStore(
  doc: Y.Doc,
  opts: { readOnly: boolean; handlers: CollabHandlers; onContentId?: (id: string | undefined) => void; onOwnerLabel?: (label: string | undefined) => void },
): void {
```

`opts.onContentId?.(readContentId(doc));` の直後に追加:

```typescript
  opts.onOwnerLabel?.(readOwnerLabel(doc));
```

`startCollabSession` の opts 型に `onOwnerLabel?` を追加し、onSynced の `applyRoomToStore(...)` 呼び出しに `onOwnerLabel: opts.onOwnerLabel` を渡す:

```typescript
export function startCollabSession(
  roomToken: string,
  opts: { readOnly?: boolean; onContentId?: (id: string | undefined) => void; onOwnerLabel?: (label: string | undefined) => void } = {},
): CollabSession {
```

```typescript
    applyRoomToStore(doc, { readOnly, handlers, onContentId: opts.onContentId, onOwnerLabel: opts.onOwnerLabel });
```

- [ ] **Step 7: 通過確認 + build + 回帰**

Run: `npx vitest run src/lib/collab && npm run build`
Expected: PASS / build 緑

- [ ] **Step 8: コミット**

```bash
git add src/lib/collab/yjsPlanData.ts src/lib/collab/collabProvider.ts src/lib/collab/__tests__/yjsPlanData.test.ts src/lib/collab/__tests__/collabProvider.readonly.test.ts
git commit -m "feat(collab): stage5-3c クライアントが ownerLabel を読み onOwnerLabel で渡す"
```

---

### Task 4: ルーム発行が label を受理・保存（書き込み経路）

**Files:**
- Modify: `api/collab/_roomManageLogic.ts`, `api/collab/_roomHandler.ts`, `src/lib/collab/collabRoomApi.ts`, `src/components/collab/OwnerCollabPanel.tsx`
- Test: `src/lib/__tests__/collabRoomManageLogic.test.ts`

> label は `create`/`reissue` のときオーナーが任意で付ける。検証 = 文字列・trim・上限 40 文字。空/未指定は未設定（バナーは汎用文言）。

- [ ] **Step 1: 失敗するテスト**

`src/lib/__tests__/collabRoomManageLogic.test.ts` に追加:

```typescript
  it('create は任意の label を trim して受理する', () => {
    const r = parseRoomManageRequest({ action: 'create', planId: 'p1', label: '  土曜固定P  ' });
    expect(r).toEqual({ ok: true, req: { action: 'create', planId: 'p1', label: '土曜固定P' } });
  });
  it('reissue も label を受理する', () => {
    const r = parseRoomManageRequest({ action: 'reissue', planId: 'p1', label: '固定' });
    expect(r.ok && (r.req as any).label).toBe('固定');
  });
  it('label が文字列でなければ invalid_label', () => {
    expect(parseRoomManageRequest({ action: 'create', planId: 'p1', label: 123 })).toEqual({ ok: false, error: 'invalid_label' });
  });
  it('label が 40 文字超なら invalid_label', () => {
    expect(parseRoomManageRequest({ action: 'create', planId: 'p1', label: 'x'.repeat(41) })).toEqual({ ok: false, error: 'invalid_label' });
  });
  it('label 空文字/空白のみは未設定として受理（label を含めない）', () => {
    const r = parseRoomManageRequest({ action: 'create', planId: 'p1', label: '   ' });
    expect(r).toEqual({ ok: true, req: { action: 'create', planId: 'p1' } });
  });
```

- [ ] **Step 2: 失敗確認**

Run: `npx vitest run src/lib/__tests__/collabRoomManageLogic.test.ts`
Expected: FAIL

- [ ] **Step 3: 実装（_roomManageLogic）**

`api/collab/_roomManageLogic.ts`:

`RoomManageRequest` の create/reissue バリアントに `label?` を追加:

```typescript
export type RoomManageRequest =
  | { action: 'create'; planId: string; maxParticipants?: number; label?: string }
  | { action: 'revoke'; planId: string }
  | { action: 'reissue'; planId: string; label?: string }
  | { action: 'set-max'; planId: string; maxParticipants: number };
```

`ParseResult` の error 種別に `'invalid_label'` を追加:

```typescript
  | { ok: false; error: 'invalid_body' | 'invalid_action' | 'invalid_planId' | 'invalid_maxParticipants' | 'invalid_label' };
```

関数冒頭（planId 検証の直後）に label 抽出ヘルパを追加:

```typescript
  // label は create/reissue のみ任意。文字列・trim・40 文字以内。空白のみは未設定。
  let label: string | undefined;
  if (b.label !== undefined) {
    if (typeof b.label !== 'string' || b.label.length > 40) return { ok: false, error: 'invalid_label' };
    const trimmed = b.label.trim();
    label = trimmed.length === 0 ? undefined : trimmed;
  }
```

create の return を label 込みに変更:

```typescript
    const req: { action: 'create'; planId: string; maxParticipants?: number; label?: string } = { action: 'create', planId };
    if (typeof b.maxParticipants === 'number') req.maxParticipants = b.maxParticipants;
    if (label !== undefined) req.label = label;
    return { ok: true, req };
```

最後の revoke/reissue return を変更（reissue だけ label を載せる）:

```typescript
  if (action === 'reissue') {
    const req: { action: 'reissue'; planId: string; label?: string } = { action: 'reissue', planId };
    if (label !== undefined) req.label = label;
    return { ok: true, req };
  }
  return { ok: true, req: { action: 'revoke', planId } };
```

- [ ] **Step 4: 通過確認**

Run: `npx vitest run src/lib/__tests__/collabRoomManageLogic.test.ts`
Expected: PASS

- [ ] **Step 5: 実装（_roomHandler — collabRooms に label を書く）**

`api/collab/_roomHandler.ts` の `tx.set(db.collection('collabRooms').doc(freshToken), {...})`（create/reissue 発行）に label を含める。`reqData` は create|reissue のときだけ label を持つので安全に取り出す:

```typescript
      const label = (reqData.action === 'create' || reqData.action === 'reissue') ? reqData.label : undefined;
      const roomDoc: Record<string, unknown> = {
        roomToken: freshToken,
        planId,
        ownerId: uid,
        maxParticipants: clamped,
        revoked: false,
        createdAt: Date.now(),
      };
      if (label !== undefined) roomDoc.label = label;
      tx.set(db.collection('collabRooms').doc(freshToken), roomDoc);
```

（create 冪等で既存ルーム再利用する分岐 L104-110 は label を変更しない＝既存ラベル維持。）

- [ ] **Step 6: 実装（collabRoomApi クライアント）**

`src/lib/collab/collabRoomApi.ts`:

```typescript
export function createRoom(planId: string, maxParticipants?: number, label?: string): Promise<RoomInfo> {
  const body: Record<string, unknown> = { action: 'create' as Action, planId };
  if (maxParticipants !== undefined) body.maxParticipants = maxParticipants;
  if (label !== undefined && label.trim().length > 0) body.label = label;
  return post(body);
}
```

```typescript
export function reissueRoom(planId: string, label?: string): Promise<RoomInfo> {
  const body: Record<string, unknown> = { action: 'reissue' as Action, planId };
  if (label !== undefined && label.trim().length > 0) body.label = label;
  return post(body);
}
```

- [ ] **Step 7: 実装（OwnerCollabPanel ラベル入力）**

[src/components/collab/OwnerCollabPanel.tsx](../../../src/components/collab/OwnerCollabPanel.tsx) を読み、発行（createRoom 呼び出し）の直前に**任意のラベル入力欄**（`<input>` + local state `label`）を追加し、`createRoom(planId, max, label)` / `reissueRoom(planId, label)` に渡す。プレースホルダは i18n（`collab.label_placeholder`＝「例: 土曜固定P（任意・空欄可）」）。既存パネルのトークン/スタイルに合わせる（held UI・露出しないが業界水準で作る）。store 経由で発行している場合は `useCollabSessionStore` の発行アクションに label 引数を通す（[src/store/useCollabSessionStore.ts](../../../src/store/useCollabSessionStore.ts) を読み追従）。

i18n（4 言語）に `collab.label_placeholder` を追加:
- ja: `"例: 土曜固定P（任意）"` / en: `"e.g. Sat static (optional)"` / ko: `"예: 토요 고정팟 (선택)"` / zh: `"例: 周六固定队（可选）"`

- [ ] **Step 8: 通過確認 + build**

Run: `npx vitest run src/lib/__tests__/collabRoomManageLogic.test.ts && npm run build`
Expected: PASS / build 緑

- [ ] **Step 9: コミット**

```bash
git add api/collab/_roomManageLogic.ts api/collab/_roomHandler.ts src/lib/collab/collabRoomApi.ts src/components/collab/OwnerCollabPanel.tsx src/store/useCollabSessionStore.ts src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json src/lib/__tests__/collabRoomManageLogic.test.ts
git commit -m "feat(collab): stage5-3c ルーム発行が任意 label を受理・collabRooms に保存"
```

---

### Task 5: 部屋ごと同意の localStorage（collabEditConsent）

**Files:**
- Create: `src/lib/collabEditConsent.ts`
- Test: `src/lib/__tests__/collabEditConsent.test.ts`

- [ ] **Step 1: 失敗するテスト**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { hasCollabEditConsent, setCollabEditConsent } from "../collabEditConsent";

describe("collabEditConsent（部屋ごと同意）", () => {
  beforeEach(() => localStorage.clear());
  it("未同意の部屋は false", () => {
    expect(hasCollabEditConsent("tokA")).toBe(false);
  });
  it("set した部屋だけ true（別の部屋は false のまま）", () => {
    setCollabEditConsent("tokA");
    expect(hasCollabEditConsent("tokA")).toBe(true);
    expect(hasCollabEditConsent("tokB")).toBe(false);
  });
  it("複数部屋の同意が独立に積み上がる", () => {
    setCollabEditConsent("tokA");
    setCollabEditConsent("tokB");
    expect(hasCollabEditConsent("tokA")).toBe(true);
    expect(hasCollabEditConsent("tokB")).toBe(true);
  });
  it("壊れた localStorage 値でも throw せず false", () => {
    localStorage.setItem("lopo_collab_edit_consent", "{not json");
    expect(hasCollabEditConsent("tokA")).toBe(false);
  });
});
```

- [ ] **Step 2: 失敗確認**

Run: `npx vitest run src/lib/__tests__/collabEditConsent.test.ts`
Expected: FAIL（モジュール無し）

- [ ] **Step 3: 実装**

`src/lib/collabEditConsent.ts`:

```typescript
// ⑤-3c: 共同編集の「初回フル警告に同意したか」を部屋ごと（roomToken 単位）に記録する。
// 別の固定パーティ（別 roomToken）を開いたら未同意＝フル警告が再度出る（設計書 §3）。
// 編集はオーナーの本物の表を undo 無しで書き換えるため、文脈（部屋）が変わるたびに警告する。
const KEY = "lopo_collab_edit_consent";

function read(): Record<string, true> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, true>) : {};
  } catch {
    return {};
  }
}

/** この roomToken の部屋に同意済みか。 */
export function hasCollabEditConsent(roomToken: string): boolean {
  return read()[roomToken] === true;
}

/** この roomToken の部屋への同意を記録する（以後この部屋ではフル警告を出さない）。 */
export function setCollabEditConsent(roomToken: string): void {
  const map = read();
  map[roomToken] = true;
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    // プライベートモード等で書けない場合は無視（毎回警告が出るが安全側）。
  }
}
```

- [ ] **Step 4: 通過確認**

Run: `npx vitest run src/lib/__tests__/collabEditConsent.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/collabEditConsent.ts src/lib/__tests__/collabEditConsent.test.ts
git commit -m "feat(collab): stage5-3c 部屋ごと編集同意の localStorage"
```

---

### Task 6: useCollabJoinerSession に canEdit / ownerLabel を追加

**Files:**
- Modify: `src/store/useCollabJoinerSession.ts`
- Test: `src/store/__tests__/useCollabJoinerSession.test.ts`

- [ ] **Step 1: 失敗するテスト**

`src/store/__tests__/useCollabJoinerSession.test.ts` に追加:

```typescript
  it("canEdit / ownerLabel を set でき clear で戻る", () => {
    useCollabJoinerSession.getState().enter("tok");
    expect(useCollabJoinerSession.getState().canEdit).toBe(false);
    expect(useCollabJoinerSession.getState().ownerLabel).toBeNull();
    useCollabJoinerSession.getState().setCanEdit(true);
    useCollabJoinerSession.getState().setOwnerLabel("土曜固定P");
    expect(useCollabJoinerSession.getState().canEdit).toBe(true);
    expect(useCollabJoinerSession.getState().ownerLabel).toBe("土曜固定P");
    useCollabJoinerSession.getState().clear();
    expect(useCollabJoinerSession.getState().canEdit).toBe(false);
    expect(useCollabJoinerSession.getState().ownerLabel).toBeNull();
  });
```

（既存の `enter` テストは `canEdit:false`/`ownerLabel:null` 初期化を確認するよう、必要なら 1 行追記。）

- [ ] **Step 2: 失敗確認**

Run: `npx vitest run src/store/__tests__/useCollabJoinerSession.test.ts`
Expected: FAIL

- [ ] **Step 3: 実装**

`src/store/useCollabJoinerSession.ts` を全面更新:

```typescript
import { create } from "zustand";

/** ⑤-3b/⑤-3c: ジョイナー一時状態（SavedPlan に紐づかない）。localStorage 非永続。 */
interface CollabJoinerSession {
  roomToken: string | null;
  contentId: string | null;
  /** ⑤-3c: オーナー設定の部屋ラベル（バナー表示用）。seed 由来。 */
  ownerLabel: string | null;
  /** ⑤-3c: 編集可否（ログイン && 部屋ごと同意）。Timeline の readOnly 判定が参照。 */
  canEdit: boolean;
  enter: (roomToken: string) => void;
  setContentId: (contentId: string | undefined) => void;
  setOwnerLabel: (label: string | undefined) => void;
  setCanEdit: (v: boolean) => void;
  clear: () => void;
}

export const useCollabJoinerSession = create<CollabJoinerSession>((set) => ({
  roomToken: null,
  contentId: null,
  ownerLabel: null,
  canEdit: false,
  enter: (roomToken) => set({ roomToken, contentId: null, ownerLabel: null, canEdit: false }),
  setContentId: (contentId) => set({ contentId: contentId ?? null }),
  setOwnerLabel: (label) => set({ ownerLabel: label ?? null }),
  setCanEdit: (v) => set({ canEdit: v }),
  clear: () => set({ roomToken: null, contentId: null, ownerLabel: null, canEdit: false }),
}));
```

- [ ] **Step 4: 通過確認**

Run: `npx vitest run src/store/__tests__/useCollabJoinerSession.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/store/useCollabJoinerSession.ts src/store/__tests__/useCollabJoinerSession.test.ts
git commit -m "feat(collab): stage5-3c useCollabJoinerSession に canEdit/ownerLabel"
```

---

### Task 7: Timeline の readOnly を canEdit 連動に拡張

**Files:**
- Modify: `src/components/Timeline.tsx`
- Test: `src/components/__tests__/Timeline.readonly.test.tsx`

> `isJoinerReadonly` を 2 引数（roomToken, canEdit）に拡張。ジョイナーでも canEdit なら編集可（readOnly=false）。

- [ ] **Step 1: 失敗するテスト**

`src/components/__tests__/Timeline.readonly.test.tsx` を更新:

```typescript
import { describe, it, expect } from "vitest";
import { isJoinerReadonly } from "../Timeline";

describe("isJoinerReadonly", () => {
  it("ジョイナー（roomToken あり）かつ編集不可は true", () => {
    expect(isJoinerReadonly("tok", false)).toBe(true);
  });
  it("ジョイナーでも編集可（canEdit）は false", () => {
    expect(isJoinerReadonly("tok", true)).toBe(false);
  });
  it("通常（roomToken null）は canEdit に関わらず false", () => {
    expect(isJoinerReadonly(null, false)).toBe(false);
    expect(isJoinerReadonly(null, true)).toBe(false);
  });
});
```

- [ ] **Step 2: 失敗確認**

Run: `npx vitest run src/components/__tests__/Timeline.readonly.test.tsx`
Expected: FAIL（現 `isJoinerReadonly` は 1 引数）

- [ ] **Step 3: 実装**

`src/components/Timeline.tsx`:

`isJoinerReadonly` を 2 引数に:

```typescript
/** ⑤-3b/⑤-3c: ジョイナー読み取り専用か（部屋参加中 && 編集不可）。canEdit なら編集可＝false。 */
export function isJoinerReadonly(roomToken: string | null, canEdit: boolean): boolean {
  return roomToken !== null && !canEdit;
}
```

コンポーネント内（`const readOnly = isJoinerReadonly(joinerRoomToken);` の箇所）を変更:

```typescript
    const joinerCanEdit = useCollabJoinerSession(s => s.canEdit);
    const readOnly = isJoinerReadonly(joinerRoomToken, joinerCanEdit);
```

- [ ] **Step 4: 通過確認 + build + 回帰**

Run: `npx vitest run src/components/__tests__/Timeline.readonly.test.tsx src/components/__tests__/Timeline.contentId.test.tsx && npm run build`
Expected: PASS / build 緑

- [ ] **Step 5: コミット**

```bash
git add src/components/Timeline.tsx src/components/__tests__/Timeline.readonly.test.tsx
git commit -m "feat(collab): stage5-3c Timeline の readOnly を canEdit 連動に拡張"
```

---

### Task 8: 警告モーダル + 赤バナー コンポーネント

**Files:**
- Create: `src/components/CollabEditConsentModal.tsx`, `src/components/CollabJoinerBanner.tsx`
- Modify: `src/locales/{ja,en,ko,zh}.json`
- Test: `src/components/__tests__/CollabJoinerBanner.test.tsx`

> モーダルは [PopularConsentDialog.tsx](../../../src/components/PopularConsentDialog.tsx) を流用。バナーは状態（編集可/未同意/未ログイン）で文言と CTA を出し分ける純粋部分をテスト。

- [ ] **Step 1: 失敗するテスト（バナーの状態 → 種別の純関数）**

`src/components/__tests__/CollabJoinerBanner.test.tsx`:

```typescript
import { describe, it, expect } from "vitest";
import { bannerKind } from "../CollabJoinerBanner";

describe("bannerKind（バナー状態判定）", () => {
  it("編集可は edit", () => {
    expect(bannerKind({ isLoggedIn: true, canEdit: true })).toBe("edit");
  });
  it("ログイン済・未同意は consent", () => {
    expect(bannerKind({ isLoggedIn: true, canEdit: false })).toBe("consent");
  });
  it("未ログインは login", () => {
    expect(bannerKind({ isLoggedIn: false, canEdit: false })).toBe("login");
  });
});
```

- [ ] **Step 2: 失敗確認**

Run: `npx vitest run src/components/__tests__/CollabJoinerBanner.test.tsx`
Expected: FAIL（モジュール無し）

- [ ] **Step 3: 実装（i18n 4 言語）**

各 `src/locales/*.json` の `collab` namespace に追加（ja の例。en/ko/zh は対応訳）:

```json
        "consent_title": "一緒に編集する前に",
        "consent_body_1": "これはあなたの表ではなく、共有された本物の表です。あなたの編集は参加者全員にリアルタイムで反映されます。",
        "consent_body_2": "元に戻す機能はまだありません。固定メンバー内でだけ使い、内容をよく確認してから編集してください。",
        "consent_accept": "同意して編集する",
        "consent_cancel": "閲覧のみにする",
        "banner_edit": "これは {{label}} の本物の表です。編集は全員に反映され、元に戻せません。",
        "banner_edit_nolabel": "これは共有された本物の表です。編集は全員に反映され、元に戻せません。",
        "banner_consent": "編集するには注意事項への同意が必要です。",
        "banner_consent_cta": "同意して編集",
        "banner_login": "閲覧のみです。編集するにはログインしてください。",
        "banner_login_cta": "ログインして編集"
```

en:
```json
        "consent_title": "Before you edit together",
        "consent_body_1": "This is not your plan — it's someone's real shared plan. Your edits apply to everyone in real time.",
        "consent_body_2": "There is no undo yet. Use this only within your static group, and check carefully before editing.",
        "consent_accept": "Agree and edit",
        "consent_cancel": "View only",
        "banner_edit": "This is {{label}}'s real plan. Edits apply to everyone and cannot be undone.",
        "banner_edit_nolabel": "This is a real shared plan. Edits apply to everyone and cannot be undone.",
        "banner_consent": "You must agree to the notice before editing.",
        "banner_consent_cta": "Agree to edit",
        "banner_login": "View only. Log in to edit.",
        "banner_login_cta": "Log in to edit"
```

ko:
```json
        "consent_title": "함께 편집하기 전에",
        "consent_body_1": "이것은 당신의 표가 아니라 공유된 실제 표입니다. 편집은 모든 참가자에게 실시간 반영됩니다.",
        "consent_body_2": "아직 되돌리기 기능이 없습니다. 고정 멤버 안에서만 사용하고 내용을 확인한 뒤 편집하세요.",
        "consent_accept": "동의하고 편집",
        "consent_cancel": "보기 전용",
        "banner_edit": "이것은 {{label}}의 실제 표입니다. 편집은 모두에게 반영되며 되돌릴 수 없습니다.",
        "banner_edit_nolabel": "이것은 공유된 실제 표입니다. 편집은 모두에게 반영되며 되돌릴 수 없습니다.",
        "banner_consent": "편집하려면 주의사항에 동의해야 합니다.",
        "banner_consent_cta": "동의하고 편집",
        "banner_login": "보기 전용입니다. 편집하려면 로그인하세요.",
        "banner_login_cta": "로그인하고 편집"
```

zh:
```json
        "consent_title": "一起编辑之前",
        "consent_body_1": "这不是你的表，而是共享的真实表。你的编辑会实时反映给所有参与者。",
        "consent_body_2": "目前还没有撤销功能。请仅在固定队内使用，确认内容后再编辑。",
        "consent_accept": "同意并编辑",
        "consent_cancel": "仅查看",
        "banner_edit": "这是 {{label}} 的真实表。编辑会反映给所有人，且无法撤销。",
        "banner_edit_nolabel": "这是共享的真实表。编辑会反映给所有人，且无法撤销。",
        "banner_consent": "编辑前需要同意注意事项。",
        "banner_consent_cta": "同意并编辑",
        "banner_login": "仅查看。登录后可编辑。",
        "banner_login_cta": "登录并编辑"
```

- [ ] **Step 4: 実装（CollabJoinerBanner）**

`src/components/CollabJoinerBanner.tsx`:

```tsx
import { useTranslation } from "react-i18next";

export type BannerKind = "edit" | "consent" | "login";

/** ⑤-3c: バナー状態判定（純粋・テスト可能）。 */
export function bannerKind(s: { isLoggedIn: boolean; canEdit: boolean }): BannerKind {
  if (s.canEdit) return "edit";
  if (s.isLoggedIn) return "consent";
  return "login";
}

interface Props {
  isLoggedIn: boolean;
  canEdit: boolean;
  ownerLabel: string | null;
  onLogin: () => void;
  onOpenConsent: () => void;
}

/** 部屋内に常駐する赤い注意バー（誰の表か・undo 無し・状態別 CTA）。機能色 赤=危険。 */
export function CollabJoinerBanner({ isLoggedIn, canEdit, ownerLabel, onLogin, onOpenConsent }: Props) {
  const { t } = useTranslation();
  const kind = bannerKind({ isLoggedIn, canEdit });
  return (
    <div role="alert" className="collab-joiner-banner w-full bg-red-600 text-white text-sm px-4 py-2 flex items-center justify-between gap-3">
      {kind === "edit" && (
        <span>{ownerLabel ? t("collab.banner_edit", { label: ownerLabel }) : t("collab.banner_edit_nolabel")}</span>
      )}
      {kind === "consent" && (
        <>
          <span>{t("collab.banner_consent")}</span>
          <button onClick={onOpenConsent} className="shrink-0 underline font-bold">{t("collab.banner_consent_cta")}</button>
        </>
      )}
      {kind === "login" && (
        <>
          <span>{t("collab.banner_login")}</span>
          <button onClick={onLogin} className="shrink-0 underline font-bold">{t("collab.banner_login_cta")}</button>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 5: 実装（CollabEditConsentModal）**

`src/components/CollabEditConsentModal.tsx`（[PopularConsentDialog.tsx](../../../src/components/PopularConsentDialog.tsx) を読み同パターンで）:

```tsx
import { useTranslation } from "react-i18next";

interface Props {
  isOpen: boolean;
  onAccept: () => void;
  onCancel: () => void;
}

/** ⑤-3c: 部屋ごとの初回フル警告モーダル（同意必須・cancel で閲覧のみ）。 */
export function CollabEditConsentModal({ isOpen, onAccept, onCancel }: Props) {
  const { t } = useTranslation();
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 px-4">
      <div className="max-w-md w-full bg-app-surface border border-app-border rounded-xl p-6 text-app-text">
        <h2 className="text-lg font-bold mb-3">{t("collab.consent_title")}</h2>
        <p className="text-sm mb-2 text-app-text-muted">{t("collab.consent_body_1")}</p>
        <p className="text-sm mb-5 text-app-text-muted">{t("collab.consent_body_2")}</p>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded border border-app-border">{t("collab.consent_cancel")}</button>
          <button onClick={onAccept} className="px-4 py-2 rounded bg-red-600 text-white font-bold">{t("collab.consent_accept")}</button>
        </div>
      </div>
    </div>
  );
}
```

> ⚠ モーダルの最終的な見た目（PopularConsentDialog のトークン/レイアウト準拠）は実装時に既存に合わせる。色強度・動きは実機で詰める（設計書 §1 非ゴール）。

- [ ] **Step 6: 通過確認 + build**

Run: `npx vitest run src/components/__tests__/CollabJoinerBanner.test.tsx && npm run build`
Expected: PASS / build 緑

- [ ] **Step 7: コミット**

```bash
git add src/components/CollabEditConsentModal.tsx src/components/CollabJoinerBanner.tsx src/components/__tests__/CollabJoinerBanner.test.tsx src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
git commit -m "feat(collab): stage5-3c 警告モーダル + 赤バナー(状態別CTA・i18n4言語)"
```

---

### Task 9: CollabJoinerPage 結線（canEdit 算出・モーダル・バナー・再接続）

**Files:**
- Modify: `src/components/CollabJoinerPage.tsx`
- Test: `src/components/__tests__/CollabJoinerPage.test.tsx`

> ジョイナーの編集解禁ロジックを結線する。`computeCanEdit` を純関数で export しテスト。実セッション（WebSocket）の張り直しは在エディタで結線。

- [ ] **Step 1: 失敗するテスト（computeCanEdit 純関数）**

`src/components/__tests__/CollabJoinerPage.test.tsx` に追加:

```typescript
import { joinerView, computeCanEdit } from "../CollabJoinerPage";

describe("computeCanEdit", () => {
  it("ログイン && 同意 で true", () => {
    expect(computeCanEdit(true, true)).toBe(true);
  });
  it("未ログイン or 未同意 は false", () => {
    expect(computeCanEdit(false, true)).toBe(false);
    expect(computeCanEdit(true, false)).toBe(false);
    expect(computeCanEdit(false, false)).toBe(false);
  });
});
```

- [ ] **Step 2: 失敗確認**

Run: `npx vitest run src/components/__tests__/CollabJoinerPage.test.tsx`
Expected: FAIL（`computeCanEdit` 未 export）

- [ ] **Step 3: 実装（CollabJoinerPage）**

`src/components/CollabJoinerPage.tsx` を更新:

純関数を追加・export:

```typescript
/** ⑤-3c: 編集可否（ログイン && 部屋ごと同意）。 */
export function computeCanEdit(isLoggedIn: boolean, hasConsent: boolean): boolean {
  return isLoggedIn && hasConsent;
}
```

import 追加:

```typescript
import { useAuthStore } from "../store/useAuthStore";
import { hasCollabEditConsent, setCollabEditConsent } from "../lib/collabEditConsent";
import { CollabEditConsentModal } from "./CollabEditConsentModal";
import { CollabJoinerBanner } from "./CollabJoinerBanner";
```

コンポーネント内のロジック（要点・在エディタで結線）:
- `const user = useAuthStore(s => s.user); const isLoggedIn = user !== null;`
- `const [hasConsent, setHasConsent] = useState(false);`（mount/roomToken 変化時に `setHasConsent(hasCollabEditConsent(roomToken))`）。
- `const canEdit = computeCanEdit(isLoggedIn, hasConsent);`
- `useCollabJoinerSession.getState().setCanEdit(canEdit)` を canEdit 変化で反映（`useEffect`）。
- **セッション開始**: `startCollabSession(roomToken, { readOnly: !canEdit, onContentId, onOwnerLabel: (l) => useCollabJoinerSession.getState().setOwnerLabel(l) })`。
- **再接続**: 既存セッション useEffect の依存配列に `canEdit` を追加。canEdit 変化で cleanup（disconnect）→ 再実行で新 readOnly のセッション。`onSync`/`onClose`/timeout の結線は ⑤-3b のまま。
- **モーダル**: `isLoggedIn && !hasConsent && synced` のとき `<CollabEditConsentModal isOpen onAccept={() => { setCollabEditConsent(roomToken); setHasConsent(true); }} onCancel={() => {/* 閲覧のまま。バナーから再開 */}} />`。accept で hasConsent true → canEdit true → 再接続。
- **バナー**: sheet 表示時、Timeline の上に `<CollabJoinerBanner isLoggedIn={isLoggedIn} canEdit={canEdit} ownerLabel={useCollabJoinerSession(s=>s.ownerLabel)} onLogin={() => useAuthStore.getState().signInWith('discord')} onOpenConsent={() => setConsentOpen(true)} />`。`onOpenConsent` は cancel 後の再オープン用に `consentOpen` state を持たせてモーダルを開く（accept 済みなら自動で非表示）。
- **cleanup の rehydrate→readonly 解除順序は不変**（⑤-3b の肝）。`setCanEdit(false)` も clear で戻る（`useCollabJoinerSession.clear()`）。

> ⚠ 在エディタ確定事項: (1) `synced` 前にモーダルを出すか後か（接続中はモーダル抑制し sheet 表示後に出す）。(2) login リダイレクト復帰直後 `user` が null→populate する一瞬で二重接続しないこと（cleanup が先に disconnect するので可・要実機）。(3) モーダルの `consentOpen` state と「ログイン済・未同意で自動表示」の優先順位。

- [ ] **Step 4: 通過確認 + build**

Run: `npx vitest run src/components/__tests__/CollabJoinerPage.test.tsx && npm run build`
Expected: PASS / build 緑

- [ ] **Step 5: コミット**

```bash
git add src/components/CollabJoinerPage.tsx src/components/__tests__/CollabJoinerPage.test.tsx
git commit -m "feat(collab): stage5-3c CollabJoinerPage に編集解禁・モーダル・バナー・再接続を結線"
```

---

### Task 10: 全体回帰 + 無漏洩 + 非露出 + docs/memory

**Files:** 検証のみ + docs。

- [ ] **Step 1: root 全単体**

Run: `npx vitest run`
Expected: 既知5失敗（TopBar4 + HousingWorkspace1）のみ。collab/joiner/store/Timeline 緑。

- [ ] **Step 2: worker + build**

Run: `cd workers/collab; npx vitest run; npx tsc -b`（緑）→ `cd ../..; npm run build`（緑）

- [ ] **Step 3: 受付係単体**

Run: `npx vitest run src/lib/__tests__/collabLogic.test.ts src/lib/__tests__/collabRoomLogic.test.ts src/lib/__tests__/collabRoomManageLogic.test.ts`
Expected: PASS

- [ ] **Step 4: 無漏洩の手動確認（コードレビュー）**

- 編集ジョイナー（canEdit=true）でも `_collabReadonly`（persist skip）が true のまま＝ジョイナーの localStorage に部屋データが書かれないことを [CollabJoinerPage.tsx](../../../src/components/CollabJoinerPage.tsx)（`setCollabReadonly(true)` は canEdit と独立にマウント時実行）で確認。
- cleanup が `rehydrate()` → `setCollabReadonly(false)` の順（⑤-3b の肝）を維持していること。

- [ ] **Step 5: 非露出確認**

`/collab/:roomToken` への内部ナビ導線が無いこと（grep `"/collab/"`）。`readOnly: false` の startCollabSession 呼び出しはオーナー（useCollabSessionStore）と CollabJoinerPage（canEdit 時）のみ。push/main マージ(UI)/worker deploy は ⑤-3 完成 + サーバ認証 + 承認まで保留。

- [ ] **Step 6: lazy chunk 維持確認**

Run: `npm run build` 後、`grep -l "y-partyserver" dist/assets/index-*.js` が**ヒットしないこと**（yjs が main に漏れていない＝ CollabJoinerPage は lazy のまま）。

- [ ] **Step 7: TODO.md / memory 更新 + コミット**

[docs/TODO.md](../../TODO.md) collab セクションに ⑤-3c 完了を追記。memory `project_realtime_collab_status` を更新（次=⑤-3d 実データ往復 / 公開前=④ presence + サーバ編集認証）。

```bash
git add docs/TODO.md
git commit -m "docs(collab): 段取り⑤-3c(注意UI+ログインゲート+編集解禁)実装完了を反映"
```

---

## Self-Review（プラン作成後の自己点検）

**1. Spec coverage:**
- §2 persist skip と canEdit の分離 → Task 6/7/9 ✅
- §3 部屋ごと同意 → Task 5/9 ✅
- §4 赤バナー（状態別 CTA） → Task 8/9 ✅
- §5 オーナーラベル seed（PII なし・発行時その場） → Task 1/2/3/4 ✅
- §6 ログインゲート（Discord リダイレクト・特別処理不要） → Task 8/9 ✅
- §7 Timeline readOnly の canEdit 連動 → Task 7 ✅
- §8 エンジン additive（ownerLabel seed） → Task 1/2/3 ✅
- §9 テスト各層 → 各 Task の TDD + Task 10 ✅
- §10 ブランチ（⑤-3b の上）・push 保留 → Task 0 / Task 10 Step 5 ✅

**2. Placeholder scan:** エンジン系（Task 1-7）は具体コード。UI 系（Task 8/9）は新規コンポーネントは具体コード、CollabJoinerPage 結線と OwnerCollabPanel ラベル欄のみ「在エディタ確定」項を file:line + 確定方針で明示（既存巨大コンポーネント/held UI への結線は正当な探索点）。

**3. Type consistency:** `META_OWNER_LABEL`/`readOwnerLabel`（client/worker 同名・別パッケージ）・`ownerLabel`（seed→session→banner）・`onOwnerLabel`・`label`（room API）・`canEdit`/`setCanEdit`・`computeCanEdit`/`isJoinerReadonly(roomToken,canEdit)`/`bannerKind`・`hasCollabEditConsent`/`setCollabEditConsent` が定義タスクと使用箇所で一致。

**未確定で実装時に確定する点（正直な明記）:**
- Task 9: モーダル表示タイミング（sync 前後）/ login 復帰直後の二重接続回避 / `consentOpen` と自動表示の優先順位。
- Task 4: OwnerCollabPanel / useCollabSessionStore のラベル欄結線（held UI・既存パターン追従）。
- Task 9（任意）: `_collabReadonly` → `_collabEphemeral` リネームは見送り（名前は readonly だが意味は persist-skip とコメント済）。やるなら独立ステップ。
