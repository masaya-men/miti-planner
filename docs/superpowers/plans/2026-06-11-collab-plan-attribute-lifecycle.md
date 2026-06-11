# 共同編集「プラン属性 ON/OFF」化 + ライフサイクル管制 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 共同編集を「プランの属性 ON/OFF」(スプレッドシート/Notion 型) に再設計し、「見ているプラン＝接続先」を常に一致させることで本番ロールバックの原因(別プランを開くと壊れが引き継がれる)を構造的に根治する。

**Architecture:** セッションがどのプランのものかを `useCollabSessionStore.collabPlanId` で保持する。Layout に置く単一の「ライフサイクル管制」useEffect が `currentPlanId` を監視し、(a) collab 中に別プランへ移ったら必ず disconnect + ローカル再ロード、(b) [後半] collab-ON プランを開いたら自動接続、を一元的に司る。これにより複数の切替経路 (Sidebar×2 / NewPlanModal / Tutorial) に分散させず DRY に保つ。モーダル✕は接続を切らない (collab は ON のプラン属性であって「セッション」ではない)。

**Tech Stack:** React + zustand (persist) + Yjs/y-partyserver (遅延チャンク) + Firebase (Firestore / Auth) + vitest。循環 import 回避のため orchestration はストアではなく Layout(コンポーネント)が `getState()` 経由で行う。

**前提・厳守:**
- push/deploy は全タスク完了 + ユーザー承認まで**保留** (git main=ff510af は push 禁止)。
- UI の見た目に影響する Task 5/7 (バッジ・ON/OFF UI・OFF 確認) は実装前にユーザーへプレビュー→承認 (`.claude/rules/ui-design.md` のデザイン承認フロー)。
- 各タスクは TDD。push 前に `npm run build` + `npx vitest run` 緑を確認 (memory `feedback_vercel_tsc_strict`)。

---

## File Structure

| ファイル | 責務 | 変更種別 |
|---|---|---|
| `src/store/useCollabSessionStore.ts` | セッション状態 + `collabPlanId` 保持・start で既存切断 | Modify |
| `src/lib/collab/collabReconcile.ts` | 「現在プラン vs セッション所属」から取るべきアクションを決める純関数 | **Create** |
| `src/lib/planLoad.ts` | プランデータをストアへ読み込む共有ヘルパ (decompress+loadSnapshot) | **Create** |
| `src/components/Sidebar.tsx` | プラン読込を共有ヘルパへ置換 + collab-ON バッジ | Modify |
| `src/components/Layout.tsx` | collab ライフサイクル管制 useEffect | Modify |
| `src/types/index.ts` | `SavedPlan.activeCollabRoomToken` 追加 | Modify |
| `src/lib/planService.ts` | `fromFirestore` で `activeCollabRoomToken` をマップ | Modify |
| `src/components/ShareButtons.tsx` / `collab/OwnerCollabPanel.tsx` | ON/OFF 枠組み + OFF 確認 | Modify |

---

## Task 1: セッションにプラン所属 (`collabPlanId`) を持たせ、start で既存セッションを切断する

**狙い:** 「このセッションはどのプランのものか」を保持し、二重 start のリーク経路を塞ぐ。これが管制 (Task 3) の判定材料になる。

**Files:**
- Modify: `src/store/useCollabSessionStore.ts`
- Test: `src/store/__tests__/useCollabSessionStore.test.ts`

- [ ] **Step 1: 失敗するテストを追加**

`src/store/__tests__/useCollabSessionStore.test.ts` の `describe` 内に追記:

```ts
  it('start: collabPlanId に planId を記録する', async () => {
    mk(createRoom).mockResolvedValue({ roomToken: 'tok', maxParticipants: 8, revoked: false });
    mk(startCollabSession).mockReturnValue(fakeSession());
    await useCollabSessionStore.getState().start('planA');
    expect(useCollabSessionStore.getState().collabPlanId).toBe('planA');
  });

  it('start: 既存セッションがあれば先に disconnect してから張り直す', async () => {
    const oldSess = fakeSession();
    useCollabSessionStore.setState({ active: true, roomToken: 'old', session: oldSess, collabPlanId: 'planA', maxParticipants: 8 });
    mk(createRoom).mockResolvedValue({ roomToken: 'new', maxParticipants: 8, revoked: false });
    mk(startCollabSession).mockReturnValue(fakeSession());
    await useCollabSessionStore.getState().start('planB');
    expect(oldSess.disconnect).toHaveBeenCalled();
    expect(useCollabSessionStore.getState().collabPlanId).toBe('planB');
  });

  it('revoke: collabPlanId も null に戻す', async () => {
    useCollabSessionStore.setState({ active: true, roomToken: 'tok', session: fakeSession(), collabPlanId: 'planA', maxParticipants: 8 });
    mk(revokeRoom).mockResolvedValue({ revoked: true });
    await useCollabSessionStore.getState().revoke('planA');
    expect(useCollabSessionStore.getState().collabPlanId).toBeNull();
  });
```

`beforeEach` の `setState` に `collabPlanId: null` を追加:

```ts
  useCollabSessionStore.setState({ active: false, roomToken: null, maxParticipants: 8, session: null, collabPlanId: null });
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run src/store/__tests__/useCollabSessionStore.test.ts`
Expected: FAIL (`collabPlanId` undefined / 既存 disconnect 未呼び出し)

- [ ] **Step 3: 実装**

`src/store/useCollabSessionStore.ts`:

`CollabSessionState` interface に追加:

```ts
  /** 現在のセッションが属するプラン ID。未接続は null。管制 (Layout) が現在プランと突き合わせる。 */
  collabPlanId: string | null;
```

初期値に追加:

```ts
  collabPlanId: null,
```

`start` を差し替え (既存切断 + planId 記録):

```ts
  start: async (planId, label) => {
    // 二重開始リーク防止: 既存セッションがあれば先に切断してから張り直す。
    get().session?.disconnect();
    const info = await createRoom(planId, undefined, label);
    const session = startCollabSession(info.roomToken);
    set({ active: true, roomToken: info.roomToken, maxParticipants: info.maxParticipants, session, collabPlanId: planId });
  },
```

`revoke` の `set` に `collabPlanId: null` を追加:

```ts
    set({ active: false, roomToken: null, session: null, collabPlanId: null });
```

`reissue` の最後の `set` に `collabPlanId: planId` を追加:

```ts
    set({ active: true, roomToken: info.roomToken, maxParticipants: info.maxParticipants, session, collabPlanId: planId });
```

- [ ] **Step 4: 緑を確認**

Run: `npx vitest run src/store/__tests__/useCollabSessionStore.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
rtk git add src/store/useCollabSessionStore.ts src/store/__tests__/useCollabSessionStore.test.ts
rtk git commit -m "feat(collab): セッションにプラン所属(collabPlanId)を持たせ二重startを切断"
```

---

## Task 2: プラン読込の共有ヘルパ `loadPlanDataIntoStore` を抽出する

**狙い:** Sidebar の「圧縮なら解凍 → loadSnapshot」ロジックを 1 箇所に切り出し、管制 (Task 3) が disconnect 後の再ロードに再利用できるようにする (DRY)。

**Files:**
- Create: `src/lib/planLoad.ts`
- Modify: `src/components/Sidebar.tsx`
- Test: `src/lib/__tests__/planLoad.test.ts`

- [ ] **Step 1: 失敗するテスト**

Create `src/lib/__tests__/planLoad.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadPlanDataIntoStore } from '../planLoad';
import { useMitigationStore } from '../../store/useMitigationStore';

vi.mock('../../utils/compression', () => ({
  decompressPlanData: vi.fn(async () => ({ marker: 'decompressed' })),
}));

beforeEach(() => useMitigationStore.setState({ _collabActive: false }));

describe('loadPlanDataIntoStore', () => {
  it('data があればそのまま loadSnapshot に渡す', async () => {
    const spy = vi.spyOn(useMitigationStore.getState(), 'loadSnapshot');
    await loadPlanDataIntoStore({ id: 'p1', data: { marker: 'plain' } } as any);
    expect(spy).toHaveBeenCalledWith({ marker: 'plain' });
    spy.mockRestore();
  });

  it('data が空 + compressedData があれば解凍して loadSnapshot に渡す', async () => {
    const spy = vi.spyOn(useMitigationStore.getState(), 'loadSnapshot');
    await loadPlanDataIntoStore({ id: 'p1', data: {}, compressedData: 'xxx' } as any);
    expect(spy).toHaveBeenCalledWith({ marker: 'decompressed' });
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run src/lib/__tests__/planLoad.test.ts`
Expected: FAIL (`loadPlanDataIntoStore` 未定義)

- [ ] **Step 3: 実装**

Create `src/lib/planLoad.ts`:

```ts
import type { SavedPlan, PlanData } from '../types';
import { useMitigationStore } from '../store/useMitigationStore';
import { decompressPlanData } from '../utils/compression';

/**
 * 指定プランのデータを MitigationStore に読み込む共有ヘルパ。
 * Sidebar のプラン切替と、collab 管制 (Layout) の disconnect 後再ロードが共用する。
 * 圧縮プラン (archived/silent compress) は解凍してから渡す。
 * 注: collab 中は loadSnapshot 自体が no-op (useMitigationStore:_collabActive ガード)。
 * 管制は disconnect (= exitCollabMode) の後にこれを呼ぶこと。
 */
export async function loadPlanDataIntoStore(plan: SavedPlan): Promise<void> {
  let data: PlanData | undefined = plan.data;
  if ((!data || Object.keys(data).length === 0) && plan.compressedData) {
    data = await decompressPlanData(plan.compressedData);
  }
  if (data) useMitigationStore.getState().loadSnapshot(data);
}
```

- [ ] **Step 4: 緑を確認**

Run: `npx vitest run src/lib/__tests__/planLoad.test.ts`
Expected: PASS

- [ ] **Step 5: Sidebar を共有ヘルパへ置換 (挙動同一・回帰なし)**

`src/components/Sidebar.tsx` の通常プラン onClick ([Sidebar.tsx:358-369](../../../src/components/Sidebar.tsx#L358)) の解凍 + `useMitigationStore.getState().loadSnapshot(planData)` ブロックを、import 追加の上で次に置換:

```ts
// import 追加 (ファイル先頭付近の import 群へ)
import { loadPlanDataIntoStore } from '../lib/planLoad';

// onClick 内: 解凍 try/catch + loadSnapshot を 1 行へ
await loadPlanDataIntoStore(plan);
store.setCurrentPlanId(plan.id);
```

> 解凍失敗トーストを維持するため、`loadPlanDataIntoStore` を try/catch で囲み catch 内で既存 `showToast(t('app.decompress_error') ...)` を呼ぶ。アーカイブプラン onClick ([Sidebar.tsx:686-700](../../../src/components/Sidebar.tsx#L686)) は `decompressArchivedPlan` 経由で data 確定済みのため `useMitigationStore.getState().loadSnapshot(data)` のまま据え置き (変更しない)。

- [ ] **Step 6: 既存テスト + build 緑**

Run: `npx vitest run src/components/__tests__ src/lib/__tests__/planLoad.test.ts && npm run build`
Expected: PASS / build 緑

- [ ] **Step 7: コミット**

```bash
rtk git add src/lib/planLoad.ts src/lib/__tests__/planLoad.test.ts src/components/Sidebar.tsx
rtk git commit -m "refactor(plan): プラン読込を共有ヘルパ loadPlanDataIntoStore に抽出"
```

---

## Task 3: collab ライフサイクル管制 — 別プランへ移ったら disconnect + 再ロード (本バグの根治)

**狙い:** 「見ているプラン ≠ セッション所属プラン」になった瞬間に必ず切断し、ローカルプランを再ロードする。これが本番ロールバックの原因の直接修正。判定は純関数に切り出してテストする。

**Files:**
- Create: `src/lib/collab/collabReconcile.ts`
- Modify: `src/components/Layout.tsx`
- Test: `src/lib/collab/__tests__/collabReconcile.test.ts`

- [ ] **Step 1: 失敗するテスト (純関数の判定)**

Create `src/lib/collab/__tests__/collabReconcile.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { decideCollabAction } from '../collabReconcile';

describe('decideCollabAction', () => {
  it('未接続 → 何もしない', () => {
    expect(decideCollabAction({ sessionActive: false, collabPlanId: null, newPlanId: 'B' }))
      .toEqual({ type: 'none' });
  });
  it('接続中で別プランへ移動 → 切断+再ロード', () => {
    expect(decideCollabAction({ sessionActive: true, collabPlanId: 'A', newPlanId: 'B' }))
      .toEqual({ type: 'disconnect-and-reload' });
  });
  it('接続中で同じプランのまま → 何もしない', () => {
    expect(decideCollabAction({ sessionActive: true, collabPlanId: 'A', newPlanId: 'A' }))
      .toEqual({ type: 'none' });
  });
  it('接続中でプラン未選択(null)へ → 切断+再ロード', () => {
    expect(decideCollabAction({ sessionActive: true, collabPlanId: 'A', newPlanId: null }))
      .toEqual({ type: 'disconnect-and-reload' });
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run src/lib/collab/__tests__/collabReconcile.test.ts`
Expected: FAIL (`decideCollabAction` 未定義)

- [ ] **Step 3: 純関数を実装**

Create `src/lib/collab/collabReconcile.ts`:

```ts
/** 管制の入力: 現在のセッション所属と、切替先のプラン ID。 */
export interface CollabReconcileInput {
  sessionActive: boolean;
  collabPlanId: string | null;
  newPlanId: string | null;
}

/** 管制が取るアクション。Task 6 で 'connect' を追加する。 */
export type CollabAction =
  | { type: 'none' }
  | { type: 'disconnect-and-reload' };

/**
 * 「見ているプラン ≠ セッション所属プラン」になったら切断+再ロードを指示する。
 * collab セッションは常に現在プランに束縛されるべき (本番ロールバックの根治)。
 */
export function decideCollabAction(input: CollabReconcileInput): CollabAction {
  if (input.sessionActive && input.collabPlanId !== input.newPlanId) {
    return { type: 'disconnect-and-reload' };
  }
  return { type: 'none' };
}
```

- [ ] **Step 4: 緑を確認**

Run: `npx vitest run src/lib/collab/__tests__/collabReconcile.test.ts`
Expected: PASS

- [ ] **Step 5: Layout に管制 useEffect を配線**

`src/components/Layout.tsx` の import に追加:

```ts
import { useCollabSessionStore } from '../store/useCollabSessionStore';
import { decideCollabAction } from '../lib/collab/collabReconcile';
import { loadPlanDataIntoStore } from '../lib/planLoad';
```

新しい `useEffect` を追加 (既存の自動保存 useEffect とは独立。`[]` で 1 回だけ subscribe):

```ts
  // collab ライフサイクル管制: 「見ているプラン = 接続先」を常に一致させる。
  // collab 中に別プランへ移ったら必ず disconnect (exitCollabMode + unobserve) し、
  // 切替先プランをローカル再ロードする (collab 中 loadSnapshot は no-op だったので張り直す)。
  React.useEffect(() => {
    let prev = usePlanStore.getState().currentPlanId;
    const unsub = usePlanStore.subscribe((state) => {
      const newId = state.currentPlanId;
      if (newId === prev) return;
      prev = newId;
      const sess = useCollabSessionStore.getState();
      const action = decideCollabAction({
        sessionActive: sess.active,
        collabPlanId: sess.collabPlanId,
        newPlanId: newId,
      });
      if (action.type === 'disconnect-and-reload') {
        sess.session?.disconnect(); // exitCollabMode + observer 解除
        useCollabSessionStore.setState({ active: false, roomToken: null, session: null, collabPlanId: null, maxParticipants: 8 });
        // disconnect 後 (_collabActive=false) に現在プランを再ロード。
        const p = usePlanStore.getState().plans.find((x) => x.id === newId);
        if (p) void loadPlanDataIntoStore(p);
      }
    });
    // ページ離脱時もセッションを切断 (端末メモリ汚染を残さない)。
    const onUnload = () => useCollabSessionStore.getState().session?.disconnect();
    window.addEventListener('beforeunload', onUnload);
    return () => { unsub(); window.removeEventListener('beforeunload', onUnload); };
  }, []);
```

- [ ] **Step 6: build + 関連テスト緑**

Run: `npm run build && npx vitest run src/lib/collab src/store/__tests__/useCollabSessionStore.test.ts`
Expected: PASS / build 緑

- [ ] **Step 7: コミット**

```bash
rtk git add src/lib/collab/collabReconcile.ts src/lib/collab/__tests__/collabReconcile.test.ts src/components/Layout.tsx
rtk git commit -m "fix(collab): プラン切替/離脱で必ず切断+再ロードする管制を追加(本番バグ根治)"
```

- [ ] **Step 8: 実機で増殖バグの消滅を確認 (systematic-debugging の検証)**

ローカル全スタック (vite dev + `wrangler dev` で collab worker・`VITE_COLLAB_HOST` をローカルに向ける) で 2 ブラウザ:
1. 共有→共同編集 ON にした表 A を開く → 別の表 B を開く → **B が壊れない / A の列が混入しない**。
2. A に戻る → A も正常。
3. リロード → 端末メモリ汚染なし。
> ここで再現していた「列増殖」が出ないことを確認できれば根治。出る場合は systematic-debugging Phase1 に戻り、disconnect 後に残る observer / 二重セッションを計測する。

---

## Task 4: `activeCollabRoomToken` をローカル SavedPlan に降ろす (ON/OFF 判定の土台)

**狙い:** 「このプランは collab ON か」をローカルで判定可能にする (サイドバーバッジ Task 5・自動接続 Task 6 の前提)。Firestore plan doc には既に保存済 ([_roomHandler.ts:130](../../../api/collab/_roomHandler.ts#L130))。

**Files:**
- Modify: `src/types/index.ts`, `src/lib/planService.ts`, `src/store/useCollabSessionStore.ts`
- Test: `src/lib/__tests__/planService.fromFirestore.test.ts` (なければ新規)

- [ ] **Step 1: 型に追加**

`src/types/index.ts` の `SavedPlan` ([index.ts:303](../../../src/types/index.ts#L303) `_createdLoggedIn` の直後) に追加:

```ts
    /**
     * 共同編集 ON のとき有効なルームトークン。OFF/未発行は未設定。
     * Firestore plan doc の同名フィールドから降ろす (ON/OFF バッジ・自動接続の判定に使う)。
     */
    activeCollabRoomToken?: string;
```

- [ ] **Step 2: 失敗するテスト (fromFirestore マッピング)**

Create `src/lib/__tests__/planService.fromFirestore.test.ts` — `fromFirestore` は非公開のため、公開 API 経由でなく**テスト用に export** する。`src/lib/planService.ts` の `function fromFirestore` を `export function fromFirestore` に変更し:

```ts
import { describe, it, expect } from 'vitest';
import { fromFirestore } from '../planService';

describe('fromFirestore: activeCollabRoomToken', () => {
  it('Firestore に token があれば SavedPlan に乗せる', () => {
    const p = fromFirestore('plan1', { ownerId: 'u', ownerDisplayName: 'n', title: 't', contentId: 'c', isPublic: false, copyCount: 0, useCount: 0, data: {}, version: 1, activeCollabRoomToken: 'tok123' } as any);
    expect(p.activeCollabRoomToken).toBe('tok123');
  });
  it('token が無ければ未設定', () => {
    const p = fromFirestore('plan1', { ownerId: 'u', ownerDisplayName: 'n', title: 't', contentId: 'c', isPublic: false, copyCount: 0, useCount: 0, data: {}, version: 1 } as any);
    expect(p.activeCollabRoomToken).toBeUndefined();
  });
});
```

- [ ] **Step 3: 失敗を確認 → 実装**

Run: `npx vitest run src/lib/__tests__/planService.fromFirestore.test.ts` → FAIL

`src/lib/planService.ts` `fromFirestore` の return に追加 ([planService.ts:103](../../../src/lib/planService.ts#L103) 墓標スプレッドの隣):

```ts
    ...(data.activeCollabRoomToken ? { activeCollabRoomToken: data.activeCollabRoomToken } : {}),
```

- [ ] **Step 4: start/revoke でローカル plan にも反映**

`src/store/useCollabSessionStore.ts` の `start` 成功後・`revoke` 成功後に usePlanStore のローカル plan を更新 (循環 import 回避のため動的 import):

`start` の `set(...)` の直後:

```ts
    const { usePlanStore } = await import('./usePlanStore');
    usePlanStore.getState().updatePlan(planId, { activeCollabRoomToken: info.roomToken });
```

`revoke` の `set(...)` の直後:

```ts
    const { usePlanStore } = await import('./usePlanStore');
    usePlanStore.getState().updatePlan(planId, { activeCollabRoomToken: undefined });
```

> 注: `updatePlan` は `_dirtyPlanIds` に積むが、`activeCollabRoomToken` はサーバ (room API) が真実。ローカル反映はバッジ/自動接続の即時性のためで、Firestore 書き戻しは room API 側で完了済 (二重書き込みでも値は同一)。

- [ ] **Step 5: 緑 + build**

Run: `npx vitest run src/lib/__tests__/planService.fromFirestore.test.ts && npm run build`
Expected: PASS / build 緑

- [ ] **Step 6: コミット**

```bash
rtk git add src/types/index.ts src/lib/planService.ts src/lib/__tests__/planService.fromFirestore.test.ts src/store/useCollabSessionStore.ts
rtk git commit -m "feat(collab): activeCollabRoomTokenをローカルSavedPlanに降ろす(ON/OFF判定の土台)"
```

---

## Task 5: サイドバーに共同編集 ON バッジ【UI・要ユーザー承認】

**狙い:** ON のプランを一目で分かるようにする (Google Drive の人型アイコン標準)。

**Files:** Modify `src/components/Sidebar.tsx` / i18n (`src/locales/*.json`)

- [ ] **Step 1: デザイン承認** — 実装前にユーザーへ提示: 配置 (プラン名の右)・アイコン (lucide `Users` 13px)・色 (白黒トーン)・ツールチップ文言。承認を得てから Step 2 へ。
- [ ] **Step 2: 実装** — プラン行 ([Sidebar.tsx:388](../../../src/components/Sidebar.tsx#L388) 周辺の名前行) で `plan.activeCollabRoomToken` があれば `Users` アイコン + Tooltip(`t('collab.badge_on')`) を表示。i18n キー `collab.badge_on` を 4 言語へ追加。
- [ ] **Step 3: build 緑 → コミット**

```bash
rtk git add src/components/Sidebar.tsx src/locales
rtk git commit -m "feat(collab): サイドバーに共同編集ONバッジ"
```

---

## Task 6: collab-ON プランを開いたら自動接続する (管制の拡張)

**狙い:** あなたのモデルの核心。「ON のプランを開く＝自動でライブ接続」。Task 3 の管制に 'connect' アクションを足す。オーナー本人のみ自動接続 (ジョイナーは `/collab/:token` 経路が既存)。

**Files:**
- Modify: `src/lib/collab/collabReconcile.ts`, `src/components/Layout.tsx`
- Test: `src/lib/collab/__tests__/collabReconcile.test.ts`

- [ ] **Step 1: 失敗するテスト (connect 判定)**

`collabReconcile.test.ts` に追記:

```ts
  it('未接続で collab-ON のプランを開いた(オーナー) → connect', () => {
    expect(decideCollabAction({ sessionActive: false, collabPlanId: null, newPlanId: 'B', newPlanRoomToken: 'tok', isOwner: true }))
      .toEqual({ type: 'connect', roomToken: 'tok', planId: 'B' });
  });
  it('collab-ON でもオーナーでなければ自動接続しない', () => {
    expect(decideCollabAction({ sessionActive: false, collabPlanId: null, newPlanId: 'B', newPlanRoomToken: 'tok', isOwner: false }))
      .toEqual({ type: 'none' });
  });
  it('接続中に別の collab-ON プランへ移動 → 一旦切断 (次サイクルで connect)', () => {
    expect(decideCollabAction({ sessionActive: true, collabPlanId: 'A', newPlanId: 'B', newPlanRoomToken: 'tok2', isOwner: true }))
      .toEqual({ type: 'disconnect-and-reload' });
  });
```

- [ ] **Step 2: 純関数を拡張**

`CollabReconcileInput` に任意フィールド追加: `newPlanRoomToken?: string; isOwner?: boolean;`。`CollabAction` に `| { type: 'connect'; roomToken: string; planId: string }` 追加。ロジック:

```ts
export function decideCollabAction(input: CollabReconcileInput): CollabAction {
  // 接続中で所属プランと違う → まず切断 (connect は切断後の次サイクルで判定)
  if (input.sessionActive && input.collabPlanId !== input.newPlanId) {
    return { type: 'disconnect-and-reload' };
  }
  // 未接続で、開いたプランが collab-ON かつオーナー本人 → 自動接続
  if (!input.sessionActive && input.newPlanId && input.newPlanRoomToken && input.isOwner) {
    return { type: 'connect', roomToken: input.newPlanRoomToken, planId: input.newPlanId };
  }
  return { type: 'none' };
}
```

- [ ] **Step 3: Layout 管制に connect を配線**

管制 subscribe 内で input を組み立てる (現在プランの token + オーナー判定):

```ts
      const p = usePlanStore.getState().plans.find((x) => x.id === newId);
      const action = decideCollabAction({
        sessionActive: sess.active,
        collabPlanId: sess.collabPlanId,
        newPlanId: newId,
        newPlanRoomToken: p?.activeCollabRoomToken,
        isOwner: !!p && p.ownerId === useAuthStore.getState().user?.uid,
      });
```

`connect` 分岐を追加 (`startCollabSession` は遅延チャンクなので動的 import、`applyRoomToStore` は sync で発火する既存経路に任せる。ここではセッション store の既存 `start` ではなく**接続のみ** = 新規軽量アクション `connectExisting(roomToken, planId)` を session store に追加して使う):

```ts
      if (action.type === 'connect') {
        void useCollabSessionStore.getState().connectExisting(action.roomToken, action.planId);
      }
```

`useCollabSessionStore` に追加 (room を新規作成せず既存 token に接続):

```ts
  connectExisting: (roomToken, planId) => {
    get().session?.disconnect();
    const session = startCollabSession(roomToken);
    set({ active: true, roomToken, session, collabPlanId: planId });
  },
```

> `maxParticipants` はオーナーパネルを開いた時に room API から取得すれば足りるため connectExisting では触らない (既定 8 のまま)。型に `connectExisting: (roomToken: string, planId: string) => void;` を追加。

- [ ] **Step 4: 初回マウント時の自動接続** — Layout マウント時、既に collab-ON のプランが開かれている場合も接続するため、subscribe 登録直後に 1 度 `decideCollabAction` を現在プランで評価して connect を発火させる (リロード復帰)。

- [ ] **Step 5: 緑 + build → 実機 (2ブラウザでオーナー再接続) → コミット**

```bash
rtk git add src/lib/collab/collabReconcile.ts src/lib/collab/__tests__/collabReconcile.test.ts src/components/Layout.tsx src/store/useCollabSessionStore.ts
rtk git commit -m "feat(collab): collab-ONプランを開いたらオーナーは自動接続(プラン属性モデル)"
```

---

## Task 7: 共有 UI を「ON/OFF」枠組みへ + OFF 確認【UI・要ユーザー承認】

**狙い:** 「セッション開始」概念を撤廃し、共有ボタンを「共同編集 ON/OFF トグル + リンク配布 + 人数 + 参加者」に再構成。OFF (失効) は確認 1 枚を挟む。

**Files:** Modify `src/components/ShareButtons.tsx`, `src/components/collab/OwnerCollabPanel.tsx`, i18n

- [ ] **Step 1: デザイン承認** — 実装前にユーザーへ提示:
  - ON/OFF をどう見せるか (例: パネル上部にトグル or 「共同編集を ON にする」ボタン → ON 後はリンク/人数/参加者を表示)。
  - OFF 押下時の確認モーダル文言 (「OFF にすると今いる全員が編集できなくなり、リンクは無効になります。再度 ON にすると新しいリンクが発行されます。」)。
  - ❌ 閉じるは collab を切らない (チップは現在プランが ON の間だけ表示)。
  承認を得てから Step 2。
- [ ] **Step 2: 実装** — `OwnerCollabPanel` の `revoke` を確認モーダル経由に。`ShareButtons` のチップ表示は `currentPlan?.activeCollabRoomToken` 基準へ寄せる (session active と二重判定にしない)。i18n 追加。
- [ ] **Step 3: build + 既存 collab UI テスト緑 → コミット**

```bash
rtk git add src/components/ShareButtons.tsx src/components/collab/OwnerCollabPanel.tsx src/locales
rtk git commit -m "feat(collab): 共有UIをON/OFF枠組みに再構成+OFF確認"
```

---

## 完了基準 (全タスク後)

- [ ] `npm run build` 緑 + `npx vitest run` 緑 (既知5失敗=TopBar4+HousingWorkspace1 のみ)。
- [ ] 実機 (2ブラウザ): ①ON の表 A→別表 B→A の列が混入しない ②A 再訪で自動再接続 ③OFF で全員編集不可+リンク無効 ④再 ON で同じ中身+新リンク ⑤リロードで ON プランへ自動復帰。
- [ ] サイドバーで ON プランにバッジ。
- [ ] **ユーザー承認 → push → worker/Vercel deploy**。それまで push 禁止。

## 非ゴール (将来・実装時期未定)
- **BAN (uid ブロックリスト)** — 編集ゲート/onBeforeConnect で弾く。通報モデ ロードマップ「BAN ポリシー自動化」に統合。
- カーソル時間ベース補間 / ジョイナーのヘッダー表示 / 赤バナー下移動 (collab 再公開前の残 UI 課題・別タスク)。
- バグ修正3件 (ダメージ0上書き/ツールチップ残留/スクロール飛び) は collab 独立 → cherry-pick で別途先行デプロイ可能。
