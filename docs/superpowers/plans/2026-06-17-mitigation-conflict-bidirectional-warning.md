# 軽減競合の双方向警告 + 画面外ガイド矢印 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 同じ軽減のリキャスト被り(競合)を前後どちらでも黄色/赤で「置ける + 気づける」ようにし、競合相手が画面外でも方向を指すガイド矢印で見つけられるようにする。

**Architecture:** 競合判定は「配置時に1回フラグ」方式を廃し、`timelineMitigations` から**常に導出**(派生)する単一ルール(`findSameSkillCdConflicts`)に統一。前方向配置は赤の見た目のままクリックだけ解放(`conflictOverride`)。ドラッグはブロック維持。PC タイムラインで競合アイコンを脈動させ、画面外の競合は列の端に脈動矢印を出してクリックで自動スクロール。

**Tech Stack:** React + TypeScript, Zustand, Vitest, Tailwind, 既存 canvas/CSS アニメ。

**Spec:** `docs/superpowers/specs/2026-06-17-mitigation-conflict-bidirectional-warning-design.md`

## Global Constraints

- 言語: コメント/ドキュメントは日本語。
- UI 文言は i18n キー経由(ハードコード禁止)。4言語(ja/en/ko/zh)に追加。
- push 前に `npm run build`(tsc 厳密) + `npm run test`(vitest run) 必須。未使用変数/型不足で Vercel ビルドが落ちる。
- テストの vitest は `npm run test` または `npx vitest run <path>`。出力をパイプしない。
- 対象は **PC タイムライン(`Timeline.tsx` の `MitigationItem`)のみ**。スマホ(`MobileTimelineRow.tsx`)は視覚フィードバック対象外。
- 競合の定義: 同一オーナー + 同一共有CDグループ + 非チャージ技で、`t2 < t1 + recast`。
- コミット末尾に必ず付与:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

## ファイル構成

- `src/utils/resourceTracker.ts` — 競合ルールの単一の真実。`getSharedCooldownIds`(module 化) + `findSameSkillCdConflicts`(新規) + forward チェックを `conflictOverride` 化。
- `src/utils/__tests__/sameSkillConflicts.test.ts` — 新規。`findSameSkillCdConflicts` の単体テスト。
- `src/utils/__tests__/forwardConflictWarning.test.ts` — 新規。forward の click=override / drag=block テスト。
- `src/components/MitigationSelector.tsx` — `isClickable` に `conflictOverride` を許可。旧 `setConflictingMitigationId` 連携を撤去。
- `src/store/useMitigationStore.ts` — `conflictingMitigationId` 系を撤去。
- `src/components/Timeline.tsx` — 派生 `conflictingIds` を算出し `MitigationItem` に `isConflicting` を渡す。旧購読/クリアを撤去。`ConflictOffscreenArrows` を設置。
- `src/components/timeline/ConflictOffscreenArrows.tsx` — 新規。画面外ガイド矢印(描画 + スクロール)。
- `src/components/timeline/conflictArrows.ts` — 新規。表示する矢印を決める純関数 + その単体テスト。
- `src/locales/{ja,en,ko,zh}.json` — 矢印の aria/title キー追加。

---

### Task 1: 競合判定の共有ヘルパー `findSameSkillCdConflicts`

**Files:**
- Modify: `src/utils/resourceTracker.ts`(`getSharedCooldownIds` を module レベルへ抽出して export、`findSameSkillCdConflicts` 追加)
- Test: `src/utils/__tests__/sameSkillConflicts.test.ts`(新規)

**Interfaces:**
- Produces:
  - `export function getSharedCooldownIds(id: string): string[]`
  - `export function findSameSkillCdConflicts(mitigations: AppliedMitigation[]): Set<string>` — 競合中インスタンス id の集合。

- [ ] **Step 1: 失敗するテストを書く**

`src/utils/__tests__/sameSkillConflicts.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

// master data 未ロード時は mockData(STATIC_MITIGATIONS)へフォールバック
import { vi } from 'vitest';
vi.mock('../../store/useMasterDataStore', () => ({
    useMasterDataStore: { getState: () => ({ skills: null, stats: null, config: null }) },
}));

import { findSameSkillCdConflicts } from '../resourceTracker';
import type { AppliedMitigation } from '../../types';

// reprisal_war: recast 60 / duration 15 (mockData)
function ap(id: string, mitId: string, time: number, ownerId = 'm1'): AppliedMitigation {
    return { id, mitigationId: mitId, time, duration: 15, ownerId };
}

describe('findSameSkillCdConflicts', () => {
    it('同オーナー同技でリキャスト内に2つ → 両方を競合として返す', () => {
        // 1:00(=60s) と 1:30(=90s)。recast 60 → 90 < 60+60 = 被り
        const list = [ap('a', 'reprisal_war', 60), ap('b', 'reprisal_war', 90)];
        const r = findSameSkillCdConflicts(list);
        expect(r.has('a')).toBe(true);
        expect(r.has('b')).toBe(true);
    });

    it('リキャストを超えて離れていれば競合しない', () => {
        // 60s と 130s。130 >= 60+60 → 被らない
        const list = [ap('a', 'reprisal_war', 60), ap('b', 'reprisal_war', 130)];
        const r = findSameSkillCdConflicts(list);
        expect(r.size).toBe(0);
    });

    it('オーナーが違えば同技でも競合しない', () => {
        const list = [ap('a', 'reprisal_war', 60, 'MT'), ap('b', 'reprisal_war', 90, 'ST')];
        const r = findSameSkillCdConflicts(list);
        expect(r.size).toBe(0);
    });

    it('チャージ技(ディヴァインベニゾン)は対象外', () => {
        // divine_benison: maxCharges 2 → このルールでは競合扱いしない
        const list = [ap('a', 'divine_benison', 0), ap('b', 'divine_benison', 10)];
        const r = findSameSkillCdConflicts(list);
        expect(r.size).toBe(0);
    });

    it('解消(離す)すると集合から外れる', () => {
        const before = findSameSkillCdConflicts([ap('a', 'reprisal_war', 60), ap('b', 'reprisal_war', 90)]);
        expect(before.size).toBe(2);
        const after = findSameSkillCdConflicts([ap('a', 'reprisal_war', 60), ap('b', 'reprisal_war', 200)]);
        expect(after.size).toBe(0);
    });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx vitest run src/utils/__tests__/sameSkillConflicts.test.ts`
Expected: FAIL(`findSameSkillCdConflicts` が export されていない)

- [ ] **Step 3: `getSharedCooldownIds` を module レベルへ抽出**

`src/utils/resourceTracker.ts` 内、`validateMitigationPlacement` の中にある以下のローカル定義(現 564-569 付近):

```ts
    const getSharedCooldownIds = (id: string) => {
        if (id === 'bloodwhetting' || id === 'nascent_flash') {
            return ['bloodwhetting', 'nascent_flash'];
        }
        return [id];
    };
```

を削除し、module レベル(関数外・`validateMitigationPlacement` の上)へ export として移動:

```ts
/** 共有リキャストの技グループを返す(例: bloodwhetting / nascent_flash は同一CD)。 */
export function getSharedCooldownIds(id: string): string[] {
    if (id === 'bloodwhetting' || id === 'nascent_flash') {
        return ['bloodwhetting', 'nascent_flash'];
    }
    return [id];
}
```

`validateMitigationPlacement` 内の `const sharedIds = getSharedCooldownIds(m.id);` はそのまま(module 関数を参照する)。

- [ ] **Step 4: `findSameSkillCdConflicts` を追加**

`src/utils/resourceTracker.ts` の module レベル(import 群の下、`getSharedCooldownIds` の近く)に追加:

```ts
/**
 * プラン内の「同一オーナー・同一共有CDグループ・非チャージ技」で
 * リキャストが被る(t2 < t1 + recast)インスタンスの id 集合を返す。
 * 競合は配置時の1回フラグではなく、この関数でデータから常に導出する。
 */
export function findSameSkillCdConflicts(mitigations: AppliedMitigation[]): Set<string> {
    const defs = getMitigationsFromStore();
    const defById = new Map<string, Mitigation>(defs.map(d => [d.id, d]));

    // owner + 共有CDグループ で束ねる
    const groups = new Map<string, AppliedMitigation[]>();
    for (const am of mitigations) {
        const def = defById.get(am.mitigationId);
        if (!def) continue;
        if (def.maxCharges) continue;                  // チャージ技は対象外
        if (!def.recast || def.recast <= 0) continue;  // リキャスト概念なしは対象外
        const groupKey = `${am.ownerId}::${getSharedCooldownIds(am.mitigationId).slice().sort().join('|')}`;
        let arr = groups.get(groupKey);
        if (!arr) { arr = []; groups.set(groupKey, arr); }
        arr.push(am);
    }

    const conflicts = new Set<string>();
    for (const list of groups.values()) {
        list.sort((a, b) => a.time - b.time);
        for (let i = 0; i < list.length - 1; i++) {
            const a = list[i];
            const b = list[i + 1];
            const recast = defById.get(a.mitigationId)?.recast ?? 0;
            if (b.time < a.time + recast) { // a のリキャスト中に b が入る = 競合
                conflicts.add(a.id);
                conflicts.add(b.id);
            }
        }
    }
    return conflicts;
}
```

- [ ] **Step 5: テストを実行して成功を確認**

Run: `npx vitest run src/utils/__tests__/sameSkillConflicts.test.ts`
Expected: PASS(5件)

- [ ] **Step 6: コミット**

```bash
git add src/utils/resourceTracker.ts src/utils/__tests__/sameSkillConflicts.test.ts
git commit -m "feat(conflict): 同技CD被りを導出する共有ヘルパー findSameSkillCdConflicts を追加

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: forward チェックを「クリック=赤のまま置ける / ドラッグ=ブロック」に

**Files:**
- Modify: `src/utils/resourceTracker.ts`(戻り型に `conflictOverride?` 追加、forward チェック 578-588 付近)
- Test: `src/utils/__tests__/forwardConflictWarning.test.ts`(新規)

**Interfaces:**
- Consumes: `validateMitigationPlacement`(既存)
- Produces: 戻り値に `conflictOverride?: boolean`。forward 競合かつ非ドラッグのとき `{ available: false, conflictOverride: true, message }`。

- [ ] **Step 1: 失敗するテストを書く**

`src/utils/__tests__/forwardConflictWarning.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../store/useMasterDataStore', () => ({
    useMasterDataStore: { getState: () => ({ skills: null, stats: null, config: null }) },
}));

import { validateMitigationPlacement } from '../resourceTracker';
import { MITIGATIONS } from '../../data/mockData';
import { useMitigationStore } from '../../store/useMitigationStore';
import type { AppliedMitigation } from '../../types';

const tStub = (key: string, options?: unknown) => {
    if (typeof options === 'string') return options;
    if (options && typeof options === 'object' && 'defaultValue' in options) {
        return String((options as { defaultValue: unknown }).defaultValue);
    }
    return key;
};
const reprisal = MITIGATIONS.find(m => m.id === 'reprisal_war')!; // recast 60
function ap(id: string, time: number): AppliedMitigation {
    return { id, mitigationId: 'reprisal_war', time, duration: 15, ownerId: 'm1' };
}

describe('forward 競合(既存CD中に重ねる)', () => {
    it('クリック配置: 置ける(available:false だが conflictOverride:true)', () => {
        useMitigationStore.setState({ currentLevel: 100 });
        const applied = [ap('a', 60)];          // 1:00 使用 → CD 2:00 まで
        const r = validateMitigationPlacement(reprisal, 90, applied, tStub); // 1:30
        expect(r.available).toBe(false);        // 赤の見た目は維持
        expect(r.conflictOverride).toBe(true);  // クリックは解放
    });

    it('ドラッグ(ignoreInstanceId 指定): ブロック維持(override なし)', () => {
        useMitigationStore.setState({ currentLevel: 100 });
        const applied = [ap('a', 60), ap('dragging', 90)];
        const r = validateMitigationPlacement(reprisal, 90, applied, tStub, 'dragging');
        expect(r.available).toBe(false);
        expect(r.conflictOverride).toBeFalsy();
    });
});
```

- [ ] **Step 2: テスト実行して失敗を確認**

Run: `npx vitest run src/utils/__tests__/forwardConflictWarning.test.ts`
Expected: FAIL(`conflictOverride` が undefined)

- [ ] **Step 3: 戻り型に `conflictOverride?` を追加**

`src/utils/resourceTracker.ts` の `validateMitigationPlacement` 戻り型(現 353 付近)に追加:

```ts
): { available: boolean; warning?: boolean; message?: string; shortMessage?: string; badge?: string; badgeColor?: string; conflictInstanceId?: string; recastInfo?: string; conflictOverride?: boolean } {
```

- [ ] **Step 4: forward チェックを書き換える**

現状(578-588 付近):

```ts
        // Forward check: is the skill still on cooldown from a previous use?
        const prevUses = sameSkillUses.filter(u => u.time <= selectedTime);
        if (prevUses.length > 0) {
            const lastPrev = prevUses[prevUses.length - 1];
            const cdEnd = lastPrev.time + m.recast;
            if (selectedTime < cdEnd) {
                const remaining = Math.ceil(cdEnd - selectedTime);
                const label = t('mitigation.cd_remaining', { seconds: remaining, defaultValue: `CD ${remaining}s` });
                return { available: false, message: label };
            }
        }
```

を以下に置換:

```ts
        // Forward check: is the skill still on cooldown from a previous use?
        const prevUses = sameSkillUses.filter(u => u.time <= selectedTime);
        if (prevUses.length > 0) {
            const lastPrev = prevUses[prevUses.length - 1];
            const cdEnd = lastPrev.time + m.recast;
            if (selectedTime < cdEnd) {
                const remaining = Math.ceil(cdEnd - selectedTime);
                const label = t('mitigation.cd_remaining', { seconds: remaining, defaultValue: `CD ${remaining}s` });
                // ドラッグ中はブロック維持(被りに気づくきっかけが薄いため)。
                if (ignoreInstanceId) {
                    return { available: false, message: label };
                }
                // クリック配置: 赤+禁止カーソルの見た目は available:false で維持しつつ、
                // conflictOverride でクリックだけ解放して配置できるようにする。
                // 競合の可視化(脈動/矢印)は timelineMitigations からの派生(findSameSkillCdConflicts)が担う。
                return { available: false, conflictOverride: true, message: label };
            }
        }
```

- [ ] **Step 5: テスト実行して成功を確認**

Run: `npx vitest run src/utils/__tests__/forwardConflictWarning.test.ts`
Expected: PASS(2件)

- [ ] **Step 6: 既存の resourceTracker テスト回帰確認**

Run: `npx vitest run src/utils/__tests__/chargeLevelGate.test.ts`
Expected: PASS(全件・既存挙動不変)

- [ ] **Step 7: コミット**

```bash
git add src/utils/resourceTracker.ts src/utils/__tests__/forwardConflictWarning.test.ts
git commit -m "feat(conflict): forward競合をクリック=conflictOverrideで置ける/ドラッグ=ブロック維持に

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: MitigationSelector — 赤のままクリック解放 + 旧フラグ撤去

**Files:**
- Modify: `src/components/MitigationSelector.tsx`(`isClickable` 354 付近、`handleMitigationClick` 202-206 付近)

**Interfaces:**
- Consumes: `validateMitigationPlacement` の `conflictOverride`(Task 2)
- 注: 赤スタイルは `!status.available` のままなので CSS 変更不要(前方向は赤を維持)。

- [ ] **Step 1: `isClickable` に conflictOverride を許可**

現状(354):

```ts
                                const isClickable = (status.available || isAlreadyPlaced);
```

に置換:

```ts
                                const isClickable = (status.available || status.conflictOverride || isAlreadyPlaced);
```

- [ ] **Step 2: 旧 conflict フラグ連携を撤去**

現状(202-206):

```ts
        // 配置時にリキャスト被り警告があれば、被り先をハイライト
        const status = getResourceStatus(mitigation);
        if (status.conflictInstanceId) {
            useMitigationStore.getState().setConflictingMitigationId(status.conflictInstanceId);
        }
```

を削除する(競合の可視化は派生に移行したため不要)。`status` がこのブロック以外で使われていない場合は変数ごと削除。使われている場合は `setConflictingMitigationId` の if ブロックのみ削除。

- [ ] **Step 3: ビルドで型・未使用を確認**

Run: `npm run build`
Expected: EXIT 0(`setConflictingMitigationId` 未定義参照や未使用 import が無いこと。残っていれば次タスクで撤去するので、ここでは MitigationSelector 側の未使用 import だけ整理)

- [ ] **Step 4: コミット**

```bash
git add src/components/MitigationSelector.tsx
git commit -m "feat(conflict): 前方向競合を赤のままクリック解放・旧conflictフラグ連携を撤去

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: 派生 conflictingIds で脈動 + 旧 conflictingMitigationId 撤去

**Files:**
- Modify: `src/store/useMitigationStore.ts`(`conflictingMitigationId` / `setConflictingMitigationId` / clear 撤去: 70,155,535,808,1333,1339-1340 付近)
- Modify: `src/components/Timeline.tsx`(派生算出 + `MitigationItem` に `isConflicting` prop、購読/クリア撤去: 83-97,205-211,497,500,504)

**Interfaces:**
- Consumes: `findSameSkillCdConflicts`(Task 1)
- Produces: `MitigationItemProps.isConflicting: boolean`

- [ ] **Step 1: ストアから conflict 系を撤去**

`src/store/useMitigationStore.ts` で以下を削除:
- state 型: `conflictingMitigationId: string | null;`(70 付近)
- action 型: `setConflictingMitigationId: (id: string | null) => void;`(155 付近)
- 初期値: `conflictingMitigationId: null,`(535 付近)
- action 実装: `setConflictingMitigationId: (id) => set({ conflictingMitigationId: id }),`(808 付近)
- `removeMitigation` 内の clear 2 箇所(1333, 1339-1340 付近):
  ```ts
  if (get().conflictingMitigationId) set({ conflictingMitigationId: null });
  ```
  および
  ```ts
  // 被り先のアニメーション、または被り元の軽減が削除された場合もクリア
  const currentConflict = get().conflictingMitigationId;
  if (currentConflict) set({ conflictingMitigationId: null });
  ```
  を削除(`removeMitigation` の他処理は残す)。

- [ ] **Step 2: `MitigationItemProps` に `isConflicting` を追加**

`src/components/Timeline.tsx`(83-97 の interface)に追加:

```ts
    isConflicting?: boolean;
```

- [ ] **Step 3: `MitigationItem` 内の購読を prop 利用へ変更**

現状(205-211 付近):

```ts
    const { myMemberId, hideEmptyRows, conflictingMitigationId } = useMitigationStore(
        useShallow(s => ({ myMemberId: s.myMemberId, hideEmptyRows: s.hideEmptyRows, conflictingMitigationId: s.conflictingMitigationId }))
    );
    ...
    const isConflicting = conflictingMitigationId === mitigation.id;
```

を以下に変更(store からの conflictingMitigationId を外し、prop を使う):

```ts
    const { myMemberId, hideEmptyRows } = useMitigationStore(
        useShallow(s => ({ myMemberId: s.myMemberId, hideEmptyRows: s.hideEmptyRows }))
    );
    ...
    const isConflicting = props.isConflicting ?? false;
```

(脈動クラス適用 497 `isConflicting && "animate-conflict-pulse ring-2 ring-amber-400"` はそのまま)

- [ ] **Step 4: pointerdown/contextmenu のクリアを撤去**

現状(499-505 付近):

```ts
                    onContextMenu={(e) => {
                        if (isConflicting) useMitigationStore.getState().setConflictingMitigationId(null);
                        handleContextMenu(e);
                    }}
                    onPointerDown={(e) => {
                        if (isConflicting) useMitigationStore.getState().setConflictingMitigationId(null);
                        handlePointerDown(e);
                    }}
```

を以下に変更(clear を除去):

```ts
                    onContextMenu={handleContextMenu}
                    onPointerDown={handlePointerDown}
```

- [ ] **Step 5: 親で派生 conflictingIds を算出し prop で渡す**

`src/components/Timeline.tsx` のメイン Timeline コンポーネント本体(`timelineMitigations` が参照可能なスコープ)で算出する。`findSameSkillCdConflicts` を import:

```ts
import { validateMitigationPlacement, findSameSkillCdConflicts } from '../utils/resourceTracker';
```

`timelineMitigations` を購読している箇所の近くで:

```ts
const conflictingIds = useMemo(() => findSameSkillCdConflicts(timelineMitigations), [timelineMitigations]);
```

`<MitigationItem ... />`(3220 付近)の props に追加:

```tsx
isConflicting={conflictingIds.has(mitigation.id)}
```

(`mitigation` は当該 map のループ変数。実際の変数名に合わせる)

- [ ] **Step 6: ビルド + 全テスト**

Run: `npm run build`
Expected: EXIT 0(`conflictingMitigationId` 参照が全て消えていること)

Run: `npm run test`
Expected: PASS(既存 + 新規。既知の housing 系 failure 以外は緑)

- [ ] **Step 7: コミット**

```bash
git add src/store/useMitigationStore.ts src/components/Timeline.tsx
git commit -m "feat(conflict): 競合脈動をtimelineMitigations派生に統一・旧conflictingMitigationId撤去

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: 画面外ガイド矢印(列の端に方向表示 + クリックで自動スクロール)

**Files:**
- Create: `src/components/timeline/conflictArrows.ts`(表示矢印を決める純関数)
- Test: `src/components/timeline/__tests__/conflictArrows.test.ts`(新規)
- Create: `src/components/timeline/ConflictOffscreenArrows.tsx`(React コンポーネント)
- Modify: `src/components/Timeline.tsx`(設置 + 必要値の受け渡し)

**Interfaces:**
- Consumes: `conflictingIds`(Task 4), `timelineMitigations`, `scrollContainerRef`, タイムラインの既存値(`memberLayout`(owner→{left,width}), 時刻→Y 変換, `hideEmptyRows`, `pixelsPerSecond`, `offsetTime`)。
- Produces:
  - 純関数 `computeConflictArrows(input): ArrowDescriptor[]`
  - 型:
    ```ts
    export interface ConflictPoint { id: string; ownerId: string; y: number; columnCenterX: number; }
    export interface ArrowDescriptor { key: string; ownerId: string; direction: 'up' | 'down'; x: number; targetY: number; }
    ```

- [ ] **Step 1: 純関数の失敗テストを書く**

`src/components/timeline/__tests__/conflictArrows.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeConflictArrows, type ConflictPoint } from '../conflictArrows';

const pt = (id: string, ownerId: string, y: number, x = 100): ConflictPoint =>
    ({ id, ownerId, y, columnCenterX: x });

describe('computeConflictArrows', () => {
    // viewport: scrollTop=200, height=300 → 可視は y∈[200,500]
    const view = { scrollTop: 200, viewportHeight: 300 };

    it('可視範囲内の競合は矢印を出さない', () => {
        const arrows = computeConflictArrows([pt('a', 'MT', 300)], view);
        expect(arrows).toEqual([]);
    });

    it('上に外れた競合 → up 矢印(targetY はその競合のy)', () => {
        const arrows = computeConflictArrows([pt('a', 'MT', 50)], view);
        expect(arrows).toHaveLength(1);
        expect(arrows[0].direction).toBe('up');
        expect(arrows[0].ownerId).toBe('MT');
        expect(arrows[0].targetY).toBe(50);
    });

    it('下に外れた競合 → down 矢印', () => {
        const arrows = computeConflictArrows([pt('a', 'MT', 800)], view);
        expect(arrows).toHaveLength(1);
        expect(arrows[0].direction).toBe('down');
        expect(arrows[0].targetY).toBe(800);
    });

    it('同じ列・同じ方向に複数 → 一番近いものを指す(上は最大y)', () => {
        const arrows = computeConflictArrows([pt('a', 'MT', 10), pt('b', 'MT', 150)], view);
        expect(arrows).toHaveLength(1);
        expect(arrows[0].targetY).toBe(150); // 端に最も近い
    });

    it('列ごとに分かれる', () => {
        const arrows = computeConflictArrows([pt('a', 'MT', 50), pt('b', 'ST', 800)], view);
        expect(arrows.map(a => a.ownerId).sort()).toEqual(['MT', 'ST']);
    });
});
```

- [ ] **Step 2: テスト実行して失敗を確認**

Run: `npx vitest run src/components/timeline/__tests__/conflictArrows.test.ts`
Expected: FAIL(モジュール無し)

- [ ] **Step 3: 純関数を実装**

`src/components/timeline/conflictArrows.ts`:

```ts
export interface ConflictPoint {
    id: string;
    ownerId: string;
    y: number;            // スクロール領域内での絶対Y(px)
    columnCenterX: number; // その列の中央X(px)
}

export interface ArrowDescriptor {
    key: string;          // React key (`${ownerId}:${direction}`)
    ownerId: string;
    direction: 'up' | 'down';
    x: number;            // 矢印を置くX(列中央)
    targetY: number;      // クリック時にスクロールする先のY
}

/**
 * 競合点のうち、ビューポート外にあるものを「列×方向」ごとに1個へ集約し、
 * 端に最も近い競合を指す矢印記述子を返す。
 */
export function computeConflictArrows(
    points: ConflictPoint[],
    view: { scrollTop: number; viewportHeight: number },
): ArrowDescriptor[] {
    const top = view.scrollTop;
    const bottom = view.scrollTop + view.viewportHeight;
    // key: `${ownerId}:${direction}` → 採用する point
    const best = new Map<string, ConflictPoint>();
    for (const p of points) {
        let direction: 'up' | 'down' | null = null;
        if (p.y < top) direction = 'up';
        else if (p.y > bottom) direction = 'down';
        if (!direction) continue; // 可視
        const key = `${p.ownerId}:${direction}`;
        const cur = best.get(key);
        // 端に近い = up は y 最大 / down は y 最小
        if (!cur) best.set(key, p);
        else if (direction === 'up' && p.y > cur.y) best.set(key, p);
        else if (direction === 'down' && p.y < cur.y) best.set(key, p);
    }
    const out: ArrowDescriptor[] = [];
    for (const [key, p] of best) {
        const direction = key.endsWith(':up') ? 'up' : 'down';
        out.push({ key, ownerId: p.ownerId, direction, x: p.columnCenterX, targetY: p.y });
    }
    return out;
}
```

- [ ] **Step 4: テスト実行して成功を確認**

Run: `npx vitest run src/components/timeline/__tests__/conflictArrows.test.ts`
Expected: PASS(5件)

- [ ] **Step 5: React コンポーネントを実装**

`src/components/timeline/ConflictOffscreenArrows.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { computeConflictArrows, type ConflictPoint, type ArrowDescriptor } from './conflictArrows';

interface Props {
    /** 競合中インスタンスの位置情報(親が timelineMitigations + conflictingIds + レイアウトから算出) */
    points: ConflictPoint[];
    scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * 競合相手が画面外にあるとき、その列の上端(∧)/下端(∨)に黄色脈動の矢印を出す。
 * クリックでその競合まで自動スクロール。PC タイムライン専用。
 */
export function ConflictOffscreenArrows({ points, scrollContainerRef }: Props) {
    const { t } = useTranslation();
    const [arrows, setArrows] = useState<ArrowDescriptor[]>([]);
    const rafRef = useRef(0);

    useEffect(() => {
        const el = scrollContainerRef.current;
        if (!el) return;
        const recompute = () => {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = requestAnimationFrame(() => {
                setArrows(computeConflictArrows(points, {
                    scrollTop: el.scrollTop,
                    viewportHeight: el.clientHeight,
                }));
            });
        };
        recompute();
        el.addEventListener('scroll', recompute, { passive: true });
        const ro = new ResizeObserver(recompute);
        ro.observe(el);
        return () => {
            cancelAnimationFrame(rafRef.current);
            el.removeEventListener('scroll', recompute);
            ro.disconnect();
        };
    }, [points, scrollContainerRef]);

    const onClick = (a: ArrowDescriptor) => {
        const el = scrollContainerRef.current;
        if (!el) return;
        el.scrollTo({ top: Math.max(0, a.targetY - el.clientHeight / 2), behavior: 'smooth' });
    };

    return (
        <>
            {arrows.map(a => (
                <button
                    key={a.key}
                    type="button"
                    onClick={() => onClick(a)}
                    aria-label={a.direction === 'up'
                        ? t('mitigation.conflict_above', { defaultValue: '競合あり (上へ)' })
                        : t('mitigation.conflict_below', { defaultValue: '競合あり (下へ)' })}
                    title={a.direction === 'up'
                        ? t('mitigation.conflict_above', { defaultValue: '競合あり (上へ)' })
                        : t('mitigation.conflict_below', { defaultValue: '競合あり (下へ)' })}
                    className="animate-conflict-pulse absolute z-30 -translate-x-1/2 flex items-center justify-center w-6 h-6 rounded-full ring-2 ring-amber-400 bg-amber-400/20 text-amber-300 cursor-pointer hover:bg-amber-400/40 transition-colors pointer-events-auto"
                    style={{
                        left: a.x,
                        [a.direction === 'up' ? 'top' : 'bottom']: 4,
                    }}
                >
                    {a.direction === 'up' ? '∧' : '∨'}
                </button>
            ))}
        </>
    );
}
```

- [ ] **Step 6: Timeline に設置し points を供給**

`src/components/Timeline.tsx` のスクロール領域(`timeline-scroll-container` を持つ要素)の内側・直下に、`position: sticky/absolute` が効く形で配置する。`points` は親で算出:

```tsx
// 競合中インスタンスの画面内Y + 列中央X を算出(既存のレイアウト値を流用)
const conflictPoints = useMemo<ConflictPoint[]>(() => {
    return timelineMitigations
        .filter(m => conflictingIds.has(m.id))
        .map(m => {
            const layout = memberLayout.get(m.ownerId); // 既存: owner→{left,width}
            const y = hideEmptyRows
                ? (timeToYMap.get(m.time) ?? (m.time - offsetTime) * pixelsPerSecond)
                : (m.time - offsetTime) * pixelsPerSecond;
            return {
                id: m.id,
                ownerId: m.ownerId,
                y,
                columnCenterX: (layout ? layout.left + layout.width / 2 : 0),
            };
        });
}, [timelineMitigations, conflictingIds, memberLayout, hideEmptyRows, timeToYMap, pixelsPerSecond, offsetTime]);
```

スクロール領域内に追加(矢印を viewport 端に貼るため、スクロール領域を `position: relative` な親でラップしているならその親に置く。既存構造に合わせて sticky な内側ラッパに設置):

```tsx
<ConflictOffscreenArrows points={conflictPoints} scrollContainerRef={scrollContainerRef} />
```

import:

```ts
import { ConflictOffscreenArrows } from './timeline/ConflictOffscreenArrows';
import type { ConflictPoint } from './timeline/conflictArrows';
```

> 注意: `memberLayout` / `timeToYMap` / `pixelsPerSecond` / `offsetTime` / `hideEmptyRows` / `scrollContainerRef` の正確な変数名・型は `Timeline.tsx` 内で確認して合わせる(`memberLayout.get(ownerId)` は 3115 付近で利用、`timeToYMap` は 230 付近)。矢印は「ビューポート端固定」にしたいので、スクロールで動かない要素(スクロール領域自体の `sticky` 子、または領域をラップする `relative` 親)に置くこと。スクロール内容と一緒に流れる位置に置くと端に貼り付かない。

- [ ] **Step 7: ビルド + 全テスト**

Run: `npm run build`
Expected: EXIT 0

Run: `npm run test`
Expected: PASS(既知 housing failure 以外緑)

- [ ] **Step 8: コミット**

```bash
git add src/components/timeline/ src/components/Timeline.tsx
git commit -m "feat(conflict): 画面外の競合相手を指すガイド矢印+クリックで自動スクロール(PC)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: i18n + 実機確認用ビルド最終チェック

**Files:**
- Modify: `src/locales/ja.json` `en.json` `ko.json` `zh.json`

- [ ] **Step 1: 4言語にキーを追加**

各ファイルの `mitigation` セクションに追加(既存の同セクション末尾に):

- `ja.json`: `"conflict_above": "競合あり (上へ)", "conflict_below": "競合あり (下へ)"`
- `en.json`: `"conflict_above": "Conflict above", "conflict_below": "Conflict below"`
- `ko.json`: `"conflict_above": "위쪽에 충돌", "conflict_below": "아래쪽에 충돌"`
- `zh.json`: `"conflict_above": "上方有冲突", "conflict_below": "下方有冲突"`

(キーのネスト位置は各ファイルの `mitigation.cd_remaining` と同階層に合わせる)

- [ ] **Step 2: ビルド + 全テスト最終確認**

Run: `npm run build`
Expected: EXIT 0

Run: `npm run test`
Expected: PASS(既知 housing failure 以外緑)

- [ ] **Step 3: コミット**

```bash
git add src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
git commit -m "i18n(conflict): 画面外ガイド矢印のラベルを4言語追加

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 4: 実機確認(ユーザー)**

`npm run dev` → 軽減表で確認:
1. 既存軽減(例リプライザル)を 1:00 に置く → 1:30 でモーダルを開く → そのスキルが**赤のままだがクリックでき、配置できる**。
2. 配置後、1:00 と 1:30 の両方が**黄色脈動**。
3. 1:00 を画面外へスクロール → 同じ列の**上端に ∧ 矢印**が脈動。クリックで 1:00 へ自動スクロール。
4. どちらかを時間移動して被りを解消 → 脈動/矢印が**自動で消える**。
5. ドラッグで競合位置へ落とそうとすると**ブロック(従来どおり)**。
6. 後ろ方向の黄色警告(既存)が回帰していない。

---

## Self-Review

**Spec coverage:**
- 2.1 配置ルール → Task 2(forward override/drag block) + Task 3(クリック解放) + 既存 backward は不変。✓
- 2.2 派生検出(範囲2) → Task 1(helper) + Task 4(派生算出)。チャージ除外/オーナー別/共有CD/解消で自動消滅をテスト済。✓
- 2.3 脈動 + 画面外矢印 + 自動スクロール + PCのみ → Task 4(脈動) + Task 5(矢印)。✓
- 2.4 perf(派生は変更時のみ・transform/opacity) → useMemo 依存配列で変更時のみ算出。✓
- 撤去(conflictingMitigationId 系) → Task 3 + Task 4。✓
- テスト → Task 1/2/5 に単体。✓
- i18n → Task 6。✓
- 非目標(他ブロック警告化/スマホ/履歴/他機能統合) → 触れていない。✓

**Placeholder scan:** code ステップは全て実コードを記載。Timeline 設置(Task 5 Step 6)は既存変数名の確認を要する旨を明示(巨大ファイルのため避けられない)。それ以外プレースホルダー無し。

**Type consistency:** `findSameSkillCdConflicts(AppliedMitigation[]) => Set<string>`(Task1) を Task4 で `conflictingIds.has(id)` 使用。`conflictOverride`(Task2 戻り型) を Task3 `isClickable` で使用。`ConflictPoint`/`ArrowDescriptor`(Task5) は同タスク内で一貫。`isConflicting` prop(Task4 で追加) を Task4 で使用。整合。
