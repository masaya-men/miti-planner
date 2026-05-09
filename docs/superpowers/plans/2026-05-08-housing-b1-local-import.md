# ハウジング Phase B-1: ローカル取り込み 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 未ログインで作ったローカルプラン (`ownerId='local'`) を、ログイン後に「取り込みダイアログ」経由で **新ID発行・部分取り込み・同名採番** でクラウドへ取り込めるようにする。既存ログイン経路のサイレントアップロードは撤去し、ユーザーの明示同意なしに `ownerId='local'` プランがクラウドへ上がらないようにする。

**Architecture:**
- 純粋関数 `computeImportPlan` (`src/utils/localImportPlanner.ts`) で枠計算・新ID発行・同名採番を決定 → 副作用ゼロでテスト可能
- `usePlanStore.importLocalPlans(uid, displayName)` action がそれをオーケストレーションし、`planService.fetchUserPlans` で現状取得 → `planService.createPlan` で新 ID 書き込み → ストア更新 → `ImportResult` 返却
- 既存 `planService.migrateLocalPlansToFirestore` から `ownerId='local'` のサイレントアップロードを撤去 (リモートマージ・書き戻しのみ残す)
- `useLocalImportDialog` 小型 zustand ストア (新規) で Layout (ダイアログホスト) + LoginModal (明示ボタン) + 自動トリガーが共有
- Layout で `migrateOnLogin` 完了後、ローカルプラン件数 > 0 かつ「次回から表示しない」フラグなしならダイアログを自動オープン
- LoginModal にローカルプランがある時のみ「ローカルプランを取り込む (N件)」ボタン表示 → `dontShow` フラグを無視してダイアログ表示

**Tech Stack:** React + TypeScript + Zustand + Firebase Firestore (`createPlan`, `fetchUserPlans`) + react-i18next + Tailwind v4 + lucide-react + vitest + happy-dom

**設計書:** [docs/superpowers/specs/2026-05-08-housing-phase-b-account-link-design.md](../specs/2026-05-08-housing-phase-b-account-link-design.md) §5

**前提:** Phase B-3 (アバター/表示名変更) 完了済み (2026-05-08, commit 2f35231)

---

## ファイル構造

| ファイル | 役割 | 操作 |
|---|---|---|
| `src/utils/localImportPlanner.ts` | 純粋関数 `computeImportPlan` (枠計算・新ID発行・同名採番) | **新規作成** |
| `src/utils/localImportPlanner.test.ts` | computeImportPlan のユニットテスト | **新規作成** |
| `src/store/usePlanStore.ts` | `importLocalPlans` action 追加 | **修正** ([usePlanStore.ts:35-67](../../../src/store/usePlanStore.ts#L35-L67) AuthState インタフェース、`migrateOnLogin` 関数の前後に追加) |
| `src/store/usePlanStore.test.ts` | `importLocalPlans` のユニットテスト | **新規作成** |
| `src/lib/planService.ts` | `migrateLocalPlansToFirestore` から localOnly アップロードを撤去 | **修正** ([planService.ts:351-425](../../../src/lib/planService.ts#L351-L425) localOnly upload loop の削除) |
| `src/store/useLocalImportDialog.ts` | ダイアログ表示状態の zustand ストア (Layout / LoginModal で共有) | **新規作成** |
| `src/components/LocalImportDialog.tsx` | 取り込み確認ダイアログ (glass-tier3 + 「次回から表示しない」) | **新規作成** |
| `src/components/LocalImportDialog.test.tsx` | LocalImportDialog のユニットテスト | **新規作成** |
| `src/components/Layout.tsx` | ダイアログレンダー + 自動トリガーロジック追加 | **修正** ([Layout.tsx:359-386](../../../src/components/Layout.tsx#L359-L386) migrateOnLogin 完了後ブロック) |
| `src/components/LoginModal.tsx` | ローカルプラン件数 > 0 のとき明示ボタン表示 | **修正** ([LoginModal.tsx:163-292](../../../src/components/LoginModal.tsx#L163-L292) ログイン済みブロック) |
| `src/locales/ja.json` | i18n キー追加 (`local_import.*` 10キー) | **修正** |
| `src/locales/en.json` | 同上 (英訳) | **修正** |
| `src/locales/ko.json` | 同上 (韓訳) | **修正** |
| `src/locales/zh.json` | 同上 (中訳) | **修正** |

---

## Task 1: i18n キーを 4 言語に追加

**Files:**
- Modify: `src/locales/ja.json` (新規 `local_import` セクション追加)
- Modify: `src/locales/en.json`
- Modify: `src/locales/ko.json`
- Modify: `src/locales/zh.json`

**説明:** B-1 ダイアログとトーストで使う 10 キーを 4 言語に追加する。既存 `profile` セクション ([ja.json:144-152](../../../src/locales/ja.json#L144-L152)) の **直後** に新規 `local_import` セクションを追加。

- [ ] **Step 1: ja.json に追加**

`src/locales/ja.json` の `"profile": { ... },` セクションの **直後** に次を追加 (末尾カンマに注意):

```json
    "local_import": {
        "title": "ローカルにあるプランを取り込みますか?",
        "body": "ログインしていない時に作ったプランが {{count}} 件あります。クラウドに保存して、別の端末からも見られるようにしますか?",
        "dont_show_again": "次回から自動で表示しない",
        "confirm": "取り込む",
        "cancel": "取り込まない",
        "toast_success": "{{count}} 件のプランを取り込みました",
        "toast_partial": "{{imported}} 件取り込みました ・ {{skipped}} 件は枠不足で残してあります",
        "toast_error": "取り込みに失敗しました",
        "button_retry": "再試行",
        "modal_button": "ローカルプランを取り込む ({{count}}件)"
    },
```

- [ ] **Step 2: en.json に英訳を追加**

```json
    "local_import": {
        "title": "Import your local plans?",
        "body": "You have {{count}} plan(s) saved while signed out. Save them to the cloud so you can access them from other devices?",
        "dont_show_again": "Don't show this automatically next time",
        "confirm": "Import",
        "cancel": "Not now",
        "toast_success": "Imported {{count}} plan(s)",
        "toast_partial": "Imported {{imported}} ・ {{skipped}} skipped (quota full)",
        "toast_error": "Failed to import",
        "button_retry": "Retry",
        "modal_button": "Import local plans ({{count}})"
    },
```

- [ ] **Step 3: ko.json に韓訳を追加**

```json
    "local_import": {
        "title": "로컬 플랜을 가져오시겠습니까?",
        "body": "로그인하지 않은 상태에서 작성한 플랜이 {{count}}개 있습니다. 클라우드에 저장하여 다른 기기에서도 볼 수 있도록 하시겠습니까?",
        "dont_show_again": "다음부터 자동으로 표시하지 않음",
        "confirm": "가져오기",
        "cancel": "가져오지 않음",
        "toast_success": "{{count}}개의 플랜을 가져왔습니다",
        "toast_partial": "{{imported}}개 가져옴 ・ {{skipped}}개는 한도 부족으로 남겨두었습니다",
        "toast_error": "가져오기에 실패했습니다",
        "button_retry": "다시 시도",
        "modal_button": "로컬 플랜 가져오기 ({{count}}개)"
    },
```

- [ ] **Step 4: zh.json に中訳を追加**

```json
    "local_import": {
        "title": "导入本地方案?",
        "body": "你在未登录时创建了 {{count}} 个方案。是否要保存到云端,以便在其他设备上查看?",
        "dont_show_again": "下次起不再自动显示",
        "confirm": "导入",
        "cancel": "暂不导入",
        "toast_success": "已导入 {{count}} 个方案",
        "toast_partial": "已导入 {{imported}} 个 ・ {{skipped}} 个因配额不足保留在本地",
        "toast_error": "导入失败",
        "button_retry": "重试",
        "modal_button": "导入本地方案 ({{count}}个)"
    },
```

- [ ] **Step 5: JSON 構文チェック**

Run: `node -e "['ja','en','ko','zh'].forEach(l => JSON.parse(require('fs').readFileSync('src/locales/'+l+'.json','utf8')))"`
Expected: エラーなし、何も表示されない

- [ ] **Step 6: tsc 通過確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 7: コミット**

```bash
rtk git add src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
rtk git commit -m "$(cat <<'EOF'
i18n(housing-b1): ローカル取り込みダイアログ用の翻訳キーを 4 言語追加

local_import.* 10 キー (title, body, dont_show_again, confirm, cancel,
toast_success, toast_partial, toast_error, button_retry, modal_button)。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: localImportPlanner ユーティリティと純粋関数テスト

**Files:**
- Create: `src/utils/localImportPlanner.ts`
- Create: `src/utils/localImportPlanner.test.ts`

**説明:** 取り込み計画を決定する純粋関数 `computeImportPlan` を作る。Firestore 書き込みは含めず、入力 (ローカルプラン + 既存件数 + 既存タイトル + 上限) から「どれを取り込んで何を skip するか」を返す。新ID発行と同名採番もここで決める。

- [ ] **Step 1: テストファイルを書く (失敗するテスト)**

`src/utils/localImportPlanner.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { computeImportPlan } from './localImportPlanner';
import type { SavedPlan } from '../types';

function makePlan(overrides: Partial<SavedPlan>): SavedPlan {
    return {
        id: 'plan_local_1',
        ownerId: 'local',
        ownerDisplayName: 'Guest',
        contentId: 'fru',
        title: 'FRU 練習',
        isPublic: false,
        copyCount: 0,
        useCount: 0,
        data: {} as any,
        createdAt: 0,
        updatedAt: 0,
        ...overrides,
    };
}

describe('computeImportPlan', () => {
    it('ローカル 0 件のときは何も返さない', () => {
        const plan = computeImportPlan({
            localPlans: [],
            totalCount: 0,
            byContentCounts: {},
            existingTitlesByContent: new Map(),
            totalLimit: 50,
            perContentLimit: 5,
        });
        expect(plan.toImport).toEqual([]);
        expect(plan.toSkip).toEqual([]);
        expect(plan.result).toEqual({ imported: 0, skipped: 0, contentBreakdown: {} });
    });

    it('全件枠内なら全部取り込む', () => {
        const plan = computeImportPlan({
            localPlans: [
                makePlan({ id: 'a', title: 'A' }),
                makePlan({ id: 'b', title: 'B' }),
                makePlan({ id: 'c', title: 'C' }),
            ],
            totalCount: 0,
            byContentCounts: {},
            existingTitlesByContent: new Map(),
            totalLimit: 50,
            perContentLimit: 5,
        });
        expect(plan.toImport).toHaveLength(3);
        expect(plan.toSkip).toHaveLength(0);
        expect(plan.result.imported).toBe(3);
        expect(plan.result.skipped).toBe(0);
        expect(plan.result.contentBreakdown).toEqual({ fru: { imported: 3, skipped: 0 } });
    });

    it('コンテンツ別上限を超えた分は skip', () => {
        // 既存 fru 4 件 + ローカル fru 3 件 → 1 件だけ取り込み、2 件 skip
        const plan = computeImportPlan({
            localPlans: [
                makePlan({ id: 'a', title: 'L1' }),
                makePlan({ id: 'b', title: 'L2' }),
                makePlan({ id: 'c', title: 'L3' }),
            ],
            totalCount: 4,
            byContentCounts: { fru: 4 },
            existingTitlesByContent: new Map([['fru', ['Existing1', 'Existing2', 'Existing3', 'Existing4']]]),
            totalLimit: 50,
            perContentLimit: 5,
        });
        expect(plan.toImport).toHaveLength(1);
        expect(plan.toSkip).toHaveLength(2);
        expect(plan.result.contentBreakdown).toEqual({ fru: { imported: 1, skipped: 2 } });
    });

    it('合計上限を超えた分は skip', () => {
        const plan = computeImportPlan({
            localPlans: [
                makePlan({ id: 'a', contentId: 'fru', title: 'A' }),
                makePlan({ id: 'b', contentId: 'dmu', title: 'B' }),
                makePlan({ id: 'c', contentId: 'top', title: 'C' }),
            ],
            totalCount: 49,
            byContentCounts: { fru: 1, dmu: 1, top: 1 },
            existingTitlesByContent: new Map(),
            totalLimit: 50,
            perContentLimit: 5,
        });
        expect(plan.toImport).toHaveLength(1);
        expect(plan.toSkip).toHaveLength(2);
        expect(plan.result.imported).toBe(1);
        expect(plan.result.skipped).toBe(2);
    });

    it('同名衝突時は (2), (3) で採番する', () => {
        const plan = computeImportPlan({
            localPlans: [
                makePlan({ id: 'a', title: 'FRU 練習' }),
                makePlan({ id: 'b', title: 'FRU 練習' }),
            ],
            totalCount: 1,
            byContentCounts: { fru: 1 },
            existingTitlesByContent: new Map([['fru', ['FRU 練習']]]),
            totalLimit: 50,
            perContentLimit: 5,
        });
        expect(plan.toImport[0].finalTitle).toBe('FRU 練習 (2)');
        expect(plan.toImport[1].finalTitle).toBe('FRU 練習 (3)');
    });

    it('衝突しないタイトルはそのまま', () => {
        const plan = computeImportPlan({
            localPlans: [makePlan({ id: 'a', title: 'Unique Title' })],
            totalCount: 0,
            byContentCounts: {},
            existingTitlesByContent: new Map([['fru', ['Other']]]),
            totalLimit: 50,
            perContentLimit: 5,
        });
        expect(plan.toImport[0].finalTitle).toBe('Unique Title');
    });

    it('新 ID は元 ID と異なり、複数取り込みで重複しない', () => {
        const plan = computeImportPlan({
            localPlans: [
                makePlan({ id: 'plan_old_1', title: 'A' }),
                makePlan({ id: 'plan_old_2', title: 'B' }),
                makePlan({ id: 'plan_old_3', title: 'C' }),
            ],
            totalCount: 0,
            byContentCounts: {},
            existingTitlesByContent: new Map(),
            totalLimit: 50,
            perContentLimit: 5,
        });
        const newIds = plan.toImport.map(i => i.newId);
        expect(newIds[0]).not.toBe('plan_old_1');
        expect(new Set(newIds).size).toBe(3); // 全部ユニーク
    });

    it('contentId 違いの上限は別々に管理される', () => {
        const plan = computeImportPlan({
            localPlans: [
                makePlan({ id: 'a', contentId: 'fru', title: 'F1' }),
                makePlan({ id: 'b', contentId: 'fru', title: 'F2' }),
                makePlan({ id: 'c', contentId: 'dmu', title: 'D1' }),
            ],
            totalCount: 5,
            byContentCounts: { fru: 5, dmu: 0 },
            existingTitlesByContent: new Map(),
            totalLimit: 50,
            perContentLimit: 5,
        });
        // fru は 5 達成で 2 件 skip、dmu は 1 件取り込み
        expect(plan.result.contentBreakdown).toEqual({
            fru: { imported: 0, skipped: 2 },
            dmu: { imported: 1, skipped: 0 },
        });
    });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx vitest run src/utils/localImportPlanner.test.ts`
Expected: FAIL — `Cannot find module './localImportPlanner'`

- [ ] **Step 3: 実装を書く**

`src/utils/localImportPlanner.ts`:

```typescript
import type { SavedPlan } from '../types';
import { generateUniqueTitle } from './planTitle';

export interface ImportResult {
    imported: number;
    skipped: number;
    contentBreakdown: Record<string, { imported: number; skipped: number }>;
}

export interface ImportPlanItem {
    original: SavedPlan;
    newId: string;
    finalTitle: string;
}

export interface ImportPlan {
    toImport: ImportPlanItem[];
    toSkip: SavedPlan[];
    result: ImportResult;
}

interface ComputeImportPlanArgs {
    localPlans: SavedPlan[];
    /** 既存リモートプランの合計件数 (今回取り込む前) */
    totalCount: number;
    /** 既存リモートプランのコンテンツ別件数 (今回取り込む前) */
    byContentCounts: Record<string, number>;
    /** 既存タイトル一覧 (contentId 単位、同名衝突判定用) */
    existingTitlesByContent: Map<string, string[]>;
    totalLimit: number;
    perContentLimit: number;
}

/**
 * ローカルプランの取り込み計画を立てる純粋関数。
 *
 * - 合計枠 (`totalLimit`) と コンテンツ別枠 (`perContentLimit`) を順守
 * - 各取り込み対象に新 ID (`plan_<timestamp>_<random>`) を発行 → 既存 Firestore plan の上書きを物理的に防ぐ
 * - 同名衝突時は `generateUniqueTitle()` で `(2)`, `(3)` 採番、取り込み中の他プランも考慮 (連続採番)
 * - 副作用ゼロ。Firestore も localStorage もタッチしない
 */
export function computeImportPlan(args: ComputeImportPlanArgs): ImportPlan {
    const { localPlans, totalCount, byContentCounts, existingTitlesByContent, totalLimit, perContentLimit } = args;

    const toImport: ImportPlanItem[] = [];
    const toSkip: SavedPlan[] = [];
    const result: ImportResult = { imported: 0, skipped: 0, contentBreakdown: {} };

    let totalUsed = totalCount;
    const liveContentCounts: Record<string, number> = { ...byContentCounts };
    const liveTitles = new Map<string, string[]>();
    for (const [k, v] of existingTitlesByContent) liveTitles.set(k, [...v]);

    for (const plan of localPlans) {
        const cid = plan.contentId ?? '';
        const breakdown = (result.contentBreakdown[cid] ??= { imported: 0, skipped: 0 });
        const currentForContent = liveContentCounts[cid] ?? 0;

        if (totalUsed >= totalLimit || currentForContent >= perContentLimit) {
            breakdown.skipped += 1;
            result.skipped += 1;
            toSkip.push(plan);
            continue;
        }

        const titlesForContent = liveTitles.get(cid) ?? [];
        const existingForTitleCheck = titlesForContent.map(title => ({ title, contentId: cid || null }));
        const finalTitle = generateUniqueTitle(plan.title, existingForTitleCheck, cid || null);
        const newId = `plan_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

        toImport.push({ original: plan, newId, finalTitle });
        breakdown.imported += 1;
        result.imported += 1;
        totalUsed += 1;
        liveContentCounts[cid] = currentForContent + 1;
        liveTitles.set(cid, [...titlesForContent, finalTitle]);
    }

    return { toImport, toSkip, result };
}
```

- [ ] **Step 4: テストを実行して合格を確認**

Run: `npx vitest run src/utils/localImportPlanner.test.ts`
Expected: PASS — 8 tests passed

- [ ] **Step 5: tsc 通過確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 6: コミット**

```bash
rtk git add src/utils/localImportPlanner.ts src/utils/localImportPlanner.test.ts
rtk git commit -m "$(cat <<'EOF'
feat(housing-b1): localImportPlanner 純粋関数を追加

ローカルプラン取り込みの計画立案 (枠計算・新ID発行・同名採番) を
副作用ゼロで決定する computeImportPlan を新設。8 件の vitest で
0 件 / 全件 / 部分 / 全 skip / 同名衝突 / contentId 別枠 をカバー。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: planService.migrateLocalPlansToFirestore からサイレントアップロードを撤去

**Files:**
- Modify: `src/lib/planService.ts` ([planService.ts:351-425](../../../src/lib/planService.ts#L351-L425))

**説明:** 既存の `migrateLocalPlansToFirestore` は `ownerId='local'` のローカルプランを **サイレントにそのままの ID で** Firestore へ書き込む。これは B-1 の「ユーザー明示同意なしに localStorage の内容をクラウドへ上げない」原則に反するので、`localOnly` upload loop だけを撤去する。リモートマージ・書き戻し・カウンター修復は維持。

- [ ] **Step 1: 既存テスト regression チェック (前提)**

Run: `npx vitest run`
Expected: 全件 PASS。ベースラインを取る。

- [ ] **Step 2: planService.ts を修正**

[planService.ts:368-384](../../../src/lib/planService.ts#L368-L384) の次のブロックを削除:

```typescript
  // ローカルにしかないプランを処理
  const localOnly = localPlans.filter((p) => !remoteIds.has(p.id));
  for (const plan of localOnly) {
    // 未ログイン時に作成されたプラン（ownerId === 'local'）のみアップロード
    // それ以外はFirestoreで削除されたとみなしスキップ
    if (plan.ownerId !== 'local') continue;
    try {
      await createPlan(plan, uid, displayName);
    } catch (err) {
      // 上限に達した場合は残りをスキップ
      if (err instanceof Error && err.message.startsWith('PLAN_LIMIT_')) {
        console.warn('プラン上限に達したため、残りのローカルプランのアップロードをスキップ');
        break;
      }
      console.error('プランのアップロードに失敗:', err);
    }
  }
```

そして関数冒頭の docstring (`migrateLocalPlansToFirestore` の上) を次に置き換える:

```typescript
/**
 * ログイン時のリモートマージ
 * Firestoreを正（信頼できるデータ）として扱い、Firestoreから既存プランを取得して
 * ローカルとマージする。両方に存在してローカルが新しい場合はFirestoreに書き戻す
 * （端末間同期の要）。
 *
 * 注意: B-1 で ownerId='local' プランのサイレントアップロードは撤去された。
 * ローカル取り込みは usePlanStore.importLocalPlans (B-1 ダイアログ経由) でのみ行う。
 *
 * @returns { merged, dirtyIds } — マージ済みプラン + Firestoreに書き戻せなかったプランID
 */
```

- [ ] **Step 3: tsc 通過確認**

Run: `npx tsc --noEmit`
Expected: エラーなし (`createPlan` import が未使用にならないよう注意 — ファイル内の他の箇所で使われているはず)

- [ ] **Step 4: 既存テスト regression チェック**

Run: `npx vitest run`
Expected: 全件 PASS — Step 1 と同件数

- [ ] **Step 5: コミット**

```bash
rtk git add src/lib/planService.ts
rtk git commit -m "$(cat <<'EOF'
refactor(housing-b1): migrateLocalPlansToFirestore からサイレントアップロードを撤去

ownerId='local' プランの自動 Firestore 書き込みを廃止し、
リモートマージ・書き戻し・カウンター修復のみ残す。
ローカル取り込みは B-1 ダイアログ経由 (usePlanStore.importLocalPlans) でのみ実行する方針。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: usePlanStore.importLocalPlans action を追加

**Files:**
- Modify: `src/store/usePlanStore.ts`
- Create: `src/store/usePlanStore.test.ts`

**説明:** `importLocalPlans(uid, displayName)` action を新設。`planService.fetchUserPlans` で現在のリモートプランを取得 → `computeImportPlan` で計画 → `planService.createPlan` で新 ID で Firestore に書き込み → 取り込み成功した local プランをローカルから除去 + 新プランをストアに追加 → `ImportResult` 返却。失敗した個別プランは `result.imported` を減算しローカル残存。

- [ ] **Step 1: テストファイルを書く (失敗するテスト)**

`src/store/usePlanStore.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { SavedPlan } from '../types';
import { usePlanStore } from './usePlanStore';
import { planService } from '../lib/planService';

vi.mock('../lib/firebase', () => ({
    db: {},
    auth: {},
    storage: {},
}));

vi.mock('../lib/planService', () => ({
    planService: {
        fetchUserPlans: vi.fn(async () => []),
        createPlan: vi.fn(async () => undefined),
    },
}));

function makePlan(overrides: Partial<SavedPlan>): SavedPlan {
    return {
        id: 'plan_local_1',
        ownerId: 'local',
        ownerDisplayName: 'Guest',
        contentId: 'fru',
        title: 'FRU 練習',
        isPublic: false,
        copyCount: 0,
        useCount: 0,
        data: { currentLevel: 100 } as any,
        createdAt: 1000,
        updatedAt: 1000,
        ...overrides,
    };
}

describe('usePlanStore.importLocalPlans', () => {
    beforeEach(() => {
        usePlanStore.setState({ plans: [], _dirtyPlanIds: new Set(), _deletedPlanIds: new Set() });
        vi.mocked(planService.fetchUserPlans).mockReset();
        vi.mocked(planService.createPlan).mockReset();
        vi.mocked(planService.fetchUserPlans).mockResolvedValue([]);
        vi.mocked(planService.createPlan).mockResolvedValue(undefined);
    });

    it('ローカル 0 件のときは何もせず result を返す', async () => {
        usePlanStore.setState({ plans: [makePlan({ id: 'p1', ownerId: 'discord:U1' })] });
        const result = await usePlanStore.getState().importLocalPlans('discord:U1', 'Tester');
        expect(result).toEqual({ imported: 0, skipped: 0, contentBreakdown: {} });
        expect(planService.createPlan).not.toHaveBeenCalled();
    });

    it('全件取り込み: ストアの local プランがクラウドプランで置き換わる', async () => {
        usePlanStore.setState({
            plans: [
                makePlan({ id: 'l1', title: 'A' }),
                makePlan({ id: 'l2', title: 'B' }),
            ],
        });
        const result = await usePlanStore.getState().importLocalPlans('discord:U1', 'Tester');
        expect(result.imported).toBe(2);
        expect(result.skipped).toBe(0);
        const plans = usePlanStore.getState().plans;
        expect(plans).toHaveLength(2);
        // 元 ID は消えている
        expect(plans.find(p => p.id === 'l1')).toBeUndefined();
        expect(plans.find(p => p.id === 'l2')).toBeUndefined();
        // 全て ownerId=uid に書き換わっている
        expect(plans.every(p => p.ownerId === 'discord:U1')).toBe(true);
        expect(planService.createPlan).toHaveBeenCalledTimes(2);
    });

    it('部分取り込み: 枠超過分は skipped、ローカル残存', async () => {
        // リモートに fru 4 件 → ローカル 3 件 → 1 件取り込み 2 件 skip
        const remote: SavedPlan[] = [1, 2, 3, 4].map(n => makePlan({
            id: `r${n}`, ownerId: 'discord:U1', title: `R${n}`,
        }));
        vi.mocked(planService.fetchUserPlans).mockResolvedValue(remote);
        usePlanStore.setState({
            plans: [
                makePlan({ id: 'l1', title: 'L1' }),
                makePlan({ id: 'l2', title: 'L2' }),
                makePlan({ id: 'l3', title: 'L3' }),
            ],
        });
        const result = await usePlanStore.getState().importLocalPlans('discord:U1', 'Tester');
        expect(result.imported).toBe(1);
        expect(result.skipped).toBe(2);
        const plans = usePlanStore.getState().plans;
        // 取り込み成功した 1 件 + 元の local 3 件のうち 2 件が残る = 3 件
        const localRemaining = plans.filter(p => p.ownerId === 'local');
        expect(localRemaining).toHaveLength(2);
    });

    it('createPlan 失敗時は result から減算しローカル残存', async () => {
        vi.mocked(planService.createPlan)
            .mockResolvedValueOnce(undefined)
            .mockRejectedValueOnce(new Error('Network error'));
        usePlanStore.setState({
            plans: [
                makePlan({ id: 'l1', title: 'A' }),
                makePlan({ id: 'l2', title: 'B' }),
            ],
        });
        const result = await usePlanStore.getState().importLocalPlans('discord:U1', 'Tester');
        expect(result.imported).toBe(1);
        expect(result.skipped).toBe(1);
        const plans = usePlanStore.getState().plans;
        // 失敗した l2 はローカル残存
        expect(plans.find(p => p.id === 'l2')?.ownerId).toBe('local');
    });

    it('同名衝突時は (2) で取り込み', async () => {
        const remote: SavedPlan[] = [makePlan({ id: 'r1', ownerId: 'discord:U1', title: 'FRU 練習' })];
        vi.mocked(planService.fetchUserPlans).mockResolvedValue(remote);
        usePlanStore.setState({
            plans: [makePlan({ id: 'l1', title: 'FRU 練習' })],
        });
        await usePlanStore.getState().importLocalPlans('discord:U1', 'Tester');
        const plans = usePlanStore.getState().plans;
        const imported = plans.find(p => p.ownerId === 'discord:U1' && p.title === 'FRU 練習 (2)');
        expect(imported).toBeDefined();
    });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx vitest run src/store/usePlanStore.test.ts`
Expected: FAIL — `usePlanStore.getState().importLocalPlans is not a function`

- [ ] **Step 3: AuthState インタフェースに型を追加**

`src/store/usePlanStore.ts` の `PlanState` インタフェース ([usePlanStore.ts:16-68](../../../src/store/usePlanStore.ts#L16-L68)) で、既存の `migrateOnLogin: ...` 行 ([usePlanStore.ts:50](../../../src/store/usePlanStore.ts#L50)) の **直前** に次を追加:

```typescript
    /** B-1: ローカルプランをクラウドへ取り込み (新ID発行・部分取り込み・同名採番) */
    importLocalPlans: (uid: string, displayName: string) => Promise<ImportResult>;
```

ファイル冒頭の import セクションに次を追加:

```typescript
import { computeImportPlan, type ImportResult } from '../utils/localImportPlanner';
```

そして PlanState の上 (line 16 直前) に `ImportResult` の型エクスポートを足す (テストで参照可能に):

既存の import で `ImportResult` を取り込み済みなので追加 export 不要。

- [ ] **Step 4: 実装を追加**

`useStore = create<PlanState>(...)` の中、`migrateOnLogin: async (uid, displayName) => { ... }` ([usePlanStore.ts:508-525](../../../src/store/usePlanStore.ts#L508-L525)) の **直前** に次を追加:

```typescript
            importLocalPlans: async (uid, displayName) => {
                const localPlans = get().plans.filter(p => p.ownerId === 'local');
                if (localPlans.length === 0) {
                    return { imported: 0, skipped: 0, contentBreakdown: {} };
                }

                // 1. リモートプランを取得 (枠カウント・既存タイトル抽出)
                const remotePlans = await planService.fetchUserPlans(uid);
                const byContentCounts: Record<string, number> = {};
                const existingTitlesByContent = new Map<string, string[]>();
                for (const p of remotePlans) {
                    const cid = p.contentId ?? '';
                    byContentCounts[cid] = (byContentCounts[cid] ?? 0) + 1;
                    const arr = existingTitlesByContent.get(cid) ?? [];
                    arr.push(p.title);
                    existingTitlesByContent.set(cid, arr);
                }

                // 2. 取り込み計画
                const { toImport, result } = computeImportPlan({
                    localPlans,
                    totalCount: remotePlans.length,
                    byContentCounts,
                    existingTitlesByContent,
                    totalLimit: PLAN_LIMITS.MAX_TOTAL_PLANS,
                    perContentLimit: PLAN_LIMITS.MAX_PLANS_PER_CONTENT,
                });

                // 3. Firestore へ書き込み (失敗した個別プランは result から減算しローカル残存)
                const successfullyImported: { localId: string; cloudPlan: SavedPlan }[] = [];
                for (const item of toImport) {
                    const cloudPlan: SavedPlan = {
                        ...item.original,
                        id: item.newId,
                        ownerId: uid,
                        ownerDisplayName: displayName,
                        title: item.finalTitle,
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                    };
                    try {
                        await planService.createPlan(cloudPlan, uid, displayName);
                        successfullyImported.push({ localId: item.original.id, cloudPlan });
                    } catch (err) {
                        console.error('Local import: createPlan failed', err);
                        result.imported -= 1;
                        result.skipped += 1;
                        const cid = item.original.contentId ?? '';
                        const bd = (result.contentBreakdown[cid] ??= { imported: 0, skipped: 0 });
                        bd.imported -= 1;
                        bd.skipped += 1;
                    }
                }

                // 4. ストア更新: 取り込み成功した local プランを除去、新クラウドプランを追加
                if (successfullyImported.length > 0) {
                    const importedLocalIds = new Set(successfullyImported.map(s => s.localId));
                    set(state => ({
                        plans: [
                            ...successfullyImported.map(s => s.cloudPlan),
                            ...state.plans.filter(p => !importedLocalIds.has(p.id)),
                        ].sort((a, b) => b.updatedAt - a.updatedAt),
                    }));
                }

                return result;
            },
```

- [ ] **Step 5: テストを実行して合格を確認**

Run: `npx vitest run src/store/usePlanStore.test.ts`
Expected: PASS — 5 tests passed

- [ ] **Step 6: 既存テスト全体に regression がないか確認**

Run: `npx vitest run`
Expected: 全件 PASS (既存 458 + 新規 8 (Task 2) + 5 (Task 4) = 471 程度)

- [ ] **Step 7: tsc 通過確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 8: コミット**

```bash
rtk git add src/store/usePlanStore.ts src/store/usePlanStore.test.ts
rtk git commit -m "$(cat <<'EOF'
feat(housing-b1): usePlanStore に importLocalPlans action を追加

リモートプラン取得 → computeImportPlan で計画 → 新 ID で createPlan →
ストア更新 → ImportResult 返却。個別 createPlan 失敗時は result から
減算しローカル残存。5 vitest で 0 件 / 全件 / 部分 / 失敗 / 同名衝突をカバー。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: useLocalImportDialog ストア + LocalImportDialog コンポーネント

**Files:**
- Create: `src/store/useLocalImportDialog.ts`
- Create: `src/components/LocalImportDialog.tsx`
- Create: `src/components/LocalImportDialog.test.tsx`

**説明:** ダイアログ表示状態を管理する小型 zustand ストアを新設し、Layout (ホスト) と LoginModal (明示ボタン) と自動トリガーの 3 箇所が共有する。`LocalImportDialog.tsx` は glass-tier3 + dialogIn 200ms スプリングアニメで、件数表示・「次回から自動で表示しない」チェックボックス (`ignoreDontShow=true` のとき非表示) ・取り込む / 取り込まない の 2 ボタン。

- [ ] **Step 1: useLocalImportDialog ストア作成**

`src/store/useLocalImportDialog.ts`:

```typescript
import { create } from 'zustand';

interface LocalImportDialogState {
    isOpen: boolean;
    /**
     * `true` のとき「次回から自動で表示しない」チェックボックスを非表示にする。
     * LoginModal の明示ボタン経由ではユーザーは既に意図的に表示している → チェックボックス不要。
     * 自動トリガー (Layout) では false → チェックボックス表示。
     */
    ignoreDontShow: boolean;
    open: (ignoreDontShow: boolean) => void;
    close: () => void;
}

export const useLocalImportDialog = create<LocalImportDialogState>((set) => ({
    isOpen: false,
    ignoreDontShow: false,
    open: (ignoreDontShow) => set({ isOpen: true, ignoreDontShow }),
    close: () => set({ isOpen: false }),
}));
```

- [ ] **Step 2: LocalImportDialog テストを書く (失敗するテスト)**

`src/components/LocalImportDialog.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LocalImportDialog } from './LocalImportDialog';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, any>) => {
            if (opts && 'count' in opts) return `${key}:${opts.count}`;
            return key;
        },
    }),
}));

vi.mock('../hooks/useEscapeClose', () => ({ useEscapeClose: () => undefined }));

describe('LocalImportDialog', () => {
    it('isOpen=false のときは何も描画しない', () => {
        const { container } = render(
            <LocalImportDialog
                isOpen={false}
                count={3}
                ignoreDontShow={false}
                onConfirm={vi.fn()}
                onCancel={vi.fn()}
            />,
        );
        expect(container.firstChild).toBeNull();
    });

    it('isOpen=true でタイトルと件数を含む本文を表示する', () => {
        render(
            <LocalImportDialog
                isOpen={true}
                count={3}
                ignoreDontShow={false}
                onConfirm={vi.fn()}
                onCancel={vi.fn()}
            />,
        );
        expect(screen.getByText('local_import.title')).toBeDefined();
        // body は count=3 で interpolation されている
        expect(screen.getByText(/local_import\.body:3/)).toBeDefined();
    });

    it('ignoreDontShow=false ならチェックボックスを表示', () => {
        render(
            <LocalImportDialog
                isOpen={true}
                count={3}
                ignoreDontShow={false}
                onConfirm={vi.fn()}
                onCancel={vi.fn()}
            />,
        );
        expect(screen.getByLabelText('local_import.dont_show_again')).toBeDefined();
    });

    it('ignoreDontShow=true ならチェックボックスを表示しない', () => {
        render(
            <LocalImportDialog
                isOpen={true}
                count={3}
                ignoreDontShow={true}
                onConfirm={vi.fn()}
                onCancel={vi.fn()}
            />,
        );
        expect(screen.queryByLabelText('local_import.dont_show_again')).toBeNull();
    });

    it('「取り込む」クリックで onConfirm({ dontShow: false }) を呼ぶ', () => {
        const onConfirm = vi.fn();
        render(
            <LocalImportDialog
                isOpen={true}
                count={3}
                ignoreDontShow={false}
                onConfirm={onConfirm}
                onCancel={vi.fn()}
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: /local_import\.confirm/i }));
        expect(onConfirm).toHaveBeenCalledWith({ dontShow: false });
    });

    it('チェックを入れて「取り込む」クリックで onConfirm({ dontShow: true })', () => {
        const onConfirm = vi.fn();
        render(
            <LocalImportDialog
                isOpen={true}
                count={3}
                ignoreDontShow={false}
                onConfirm={onConfirm}
                onCancel={vi.fn()}
            />,
        );
        fireEvent.click(screen.getByLabelText('local_import.dont_show_again'));
        fireEvent.click(screen.getByRole('button', { name: /local_import\.confirm/i }));
        expect(onConfirm).toHaveBeenCalledWith({ dontShow: true });
    });

    it('「取り込まない」クリックで onCancel({ dontShow }) を呼ぶ', () => {
        const onCancel = vi.fn();
        render(
            <LocalImportDialog
                isOpen={true}
                count={3}
                ignoreDontShow={false}
                onConfirm={vi.fn()}
                onCancel={onCancel}
            />,
        );
        fireEvent.click(screen.getByLabelText('local_import.dont_show_again'));
        fireEvent.click(screen.getByRole('button', { name: /local_import\.cancel/i }));
        expect(onCancel).toHaveBeenCalledWith({ dontShow: true });
    });
});
```

- [ ] **Step 3: テストを実行して失敗を確認**

Run: `npx vitest run src/components/LocalImportDialog.test.tsx`
Expected: FAIL — `Cannot find module './LocalImportDialog'`

- [ ] **Step 4: LocalImportDialog 実装**

`src/components/LocalImportDialog.tsx`:

```typescript
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { Download, X } from 'lucide-react';
import { useEscapeClose } from '../hooks/useEscapeClose';

interface LocalImportDialogProps {
    isOpen: boolean;
    /** 取り込み対象のローカルプラン件数 */
    count: number;
    /** true のとき「次回から自動で表示しない」チェックを非表示 (LoginModal 明示ボタン経由用) */
    ignoreDontShow: boolean;
    onConfirm: (opts: { dontShow: boolean }) => void;
    onCancel: (opts: { dontShow: boolean }) => void;
}

export const LocalImportDialog: React.FC<LocalImportDialogProps> = ({
    isOpen, count, ignoreDontShow, onConfirm, onCancel,
}) => {
    const { t } = useTranslation();
    const [dontShow, setDontShow] = useState(false);
    const handleCancel = () => onCancel({ dontShow: ignoreDontShow ? false : dontShow });
    useEscapeClose(isOpen, handleCancel);

    if (!isOpen) return null;

    const effectiveDontShow = ignoreDontShow ? false : dontShow;

    return createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center">
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-[2px] animate-[fadeIn_150ms_ease-out]"
                onClick={handleCancel}
            />
            <div
                className={clsx(
                    "relative w-[400px] max-w-[90vw] rounded-2xl glass-tier3",
                    "animate-[dialogIn_200ms_cubic-bezier(0.2,0.8,0.2,1)]",
                )}
                style={{ '--glass-tier3-bg': 'var(--share-modal-bg)' } as React.CSSProperties}
            >
                {/* Header */}
                <div className="flex items-center gap-3 px-5 pt-5 pb-2">
                    <div className="p-2 rounded-xl bg-app-toggle/10">
                        <Download size={18} className="text-app-toggle" />
                    </div>
                    <h3 className="text-app-2xl font-black text-app-text tracking-wide">
                        {t('local_import.title')}
                    </h3>
                    <button
                        onClick={handleCancel}
                        aria-label={t('local_import.cancel')}
                        className="ml-auto p-1 rounded-lg text-app-text border border-transparent hover:bg-app-toggle hover:text-app-toggle-text hover:border-app-toggle transition-all duration-200 cursor-pointer active:scale-90"
                    >
                        <X size={14} />
                    </button>
                </div>

                {/* Body */}
                <div className="px-5 py-3">
                    <p className="text-app-lg text-app-text-sec leading-relaxed font-medium">
                        {t('local_import.body', { count })}
                    </p>
                    {!ignoreDontShow && (
                        <label className="mt-4 flex items-center gap-2 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={dontShow}
                                onChange={e => setDontShow(e.target.checked)}
                                className="w-4 h-4 cursor-pointer accent-app-toggle"
                            />
                            <span className="text-app-md text-app-text-muted">
                                {t('local_import.dont_show_again')}
                            </span>
                        </label>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-app-border">
                    <button
                        onClick={handleCancel}
                        className="px-4 py-2 rounded-xl text-app-md font-black text-app-text-sec hover:text-app-text hover:bg-app-surface2 transition-colors border border-transparent hover:border-app-border cursor-pointer"
                    >
                        {t('local_import.cancel')}
                    </button>
                    <button
                        onClick={() => onConfirm({ dontShow: effectiveDontShow })}
                        className="px-4 py-2 rounded-xl text-app-md font-bold text-white bg-app-blue hover:bg-app-blue-hover transition-all shadow-lg shadow-app-blue/25 cursor-pointer"
                    >
                        {t('local_import.confirm')}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
};
```

- [ ] **Step 5: テストを実行して合格を確認**

Run: `npx vitest run src/components/LocalImportDialog.test.tsx`
Expected: PASS — 7 tests passed

- [ ] **Step 6: tsc 通過確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 7: コミット**

```bash
rtk git add src/store/useLocalImportDialog.ts src/components/LocalImportDialog.tsx src/components/LocalImportDialog.test.tsx
rtk git commit -m "$(cat <<'EOF'
feat(housing-b1): LocalImportDialog コンポーネントと状態ストアを追加

useLocalImportDialog 小型 zustand ストアで Layout / LoginModal /
自動トリガーが共有。ダイアログは glass-tier3 + dialogIn 200ms、
「次回から表示しない」チェック (ignoreDontShow=true で非表示)、
取り込む (青) / 取り込まない (ゴースト) の 2 ボタン。7 vitest PASS。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Layout.tsx に LocalImportDialog 統合と自動トリガー追加

**Files:**
- Modify: `src/components/Layout.tsx` ([Layout.tsx:359-386](../../../src/components/Layout.tsx#L359-L386), `migrateOnLogin` 完了後と return 内)

**説明:** `migrateOnLogin` + `pullFromFirestore` 完了後に **ローカルプラン件数 > 0** かつ **`localStorage.lopo_local_import_dont_show !== 'true'`** ならダイアログを自動オープン。ダイアログは Layout 直下にレンダリングし、`onConfirm` で `usePlanStore.importLocalPlans` を呼び出してトーストで結果通知。

- [ ] **Step 1: import 追加**

`src/components/Layout.tsx` の import セクションに次を追加:

```typescript
import { LocalImportDialog } from './LocalImportDialog';
import { useLocalImportDialog } from '../store/useLocalImportDialog';
import { showToast } from './Toast';
```

- [ ] **Step 2: 自動トリガーロジックを追加**

[Layout.tsx:359-386](../../../src/components/Layout.tsx#L359-L386) の `React.useEffect(() => { ... migrateOnLogin ... pullFromFirestore ... });` ブロック内、`.finally(() => { ... })` ブロックの内側、`planStore.pullFromFirestore(authUser.uid);` の **直後** に次を追加:

```typescript
                planStore.pullFromFirestore(authUser.uid).then(() => {
                    // B-1: ローカル取り込みダイアログ自動トリガー
                    const localCount = usePlanStore.getState().plans.filter(p => p.ownerId === 'local').length;
                    const dontShow = localStorage.getItem('lopo_local_import_dont_show') === 'true';
                    if (localCount > 0 && !dontShow) {
                        useLocalImportDialog.getState().open(false);
                    }
                });
```

(既存の `planStore.pullFromFirestore(authUser.uid);` の行を、`then(() => { ... })` で続けるように書き換える)

修正対象ブロックの差分イメージ:

```diff
         }).finally(() => {
             usePlanStore.setState({ _migrationDone: true });
             // マイグレーション成功・失敗いずれでもPULL実行（他端末の変更を確実に取得）
-            planStore.pullFromFirestore(authUser.uid);
+            planStore.pullFromFirestore(authUser.uid).then(() => {
+                const localCount = usePlanStore.getState().plans.filter(p => p.ownerId === 'local').length;
+                const dontShow = localStorage.getItem('lopo_local_import_dont_show') === 'true';
+                if (localCount > 0 && !dontShow) {
+                    useLocalImportDialog.getState().open(false);
+                }
+            });
         });
```

- [ ] **Step 3: ダイアログコールバック関数を Layout コンポーネント内に追加**

`Layout` コンポーネント内、既存の他の useState/useCallback などが定義されているあたり (例: [Layout.tsx:351](../../../src/components/Layout.tsx#L351) `setHasMigrated` の近く) に次を追加:

```typescript
    // B-1: ローカル取り込みダイアログ
    const localImportOpen = useLocalImportDialog(s => s.isOpen);
    const localImportIgnoreDontShow = useLocalImportDialog(s => s.ignoreDontShow);
    const closeLocalImportDialog = useLocalImportDialog(s => s.close);
    const localImportCount = usePlanStore(s =>
        s.plans.filter(p => p.ownerId === 'local').length,
    );

    const handleLocalImportConfirm = React.useCallback(
        async ({ dontShow }: { dontShow: boolean }) => {
            closeLocalImportDialog();
            if (dontShow) localStorage.setItem('lopo_local_import_dont_show', 'true');

            const currentUser = useAuthStore.getState().user;
            if (!currentUser) return;
            const profileName = useAuthStore.getState().profileDisplayName || 'User';
            try {
                const result = await usePlanStore.getState().importLocalPlans(
                    currentUser.uid,
                    profileName,
                );
                if (result.imported > 0 && result.skipped === 0) {
                    showToast(t('local_import.toast_success', { count: result.imported }));
                } else if (result.imported > 0 && result.skipped > 0) {
                    showToast(t('local_import.toast_partial', {
                        imported: result.imported,
                        skipped: result.skipped,
                    }));
                } else if (result.skipped > 0) {
                    showToast(t('local_import.toast_partial', {
                        imported: 0,
                        skipped: result.skipped,
                    }), 'info');
                }
            } catch (err) {
                console.error('Local import failed:', err);
                showToast(t('local_import.toast_error'), 'error');
            }
        },
        [closeLocalImportDialog, t],
    );

    const handleLocalImportCancel = React.useCallback(
        ({ dontShow }: { dontShow: boolean }) => {
            closeLocalImportDialog();
            if (dontShow) localStorage.setItem('lopo_local_import_dont_show', 'true');
        },
        [closeLocalImportDialog],
    );
```

- [ ] **Step 4: Layout の return JSX 内、最後 (Sidebar や ParticleBackground と同レベルの末尾) に LocalImportDialog を追加**

`Layout.tsx` の `return (...)` JSX 末尾、最後の `</div>` (ルート) の直前に次を追加:

```tsx
            {/* B-1: ローカル取り込みダイアログ */}
            <LocalImportDialog
                isOpen={localImportOpen}
                count={localImportCount}
                ignoreDontShow={localImportIgnoreDontShow}
                onConfirm={handleLocalImportConfirm}
                onCancel={handleLocalImportCancel}
            />
```

- [ ] **Step 5: tsc 通過確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 6: 既存テスト regression チェック**

Run: `npx vitest run`
Expected: 全件 PASS

- [ ] **Step 7: 開発サーバーで動作確認**

Run: `npm run dev`

シナリオ:
1. ログアウト状態で 2 〜 3 件プランを作成 (例: M1S 練習、M2S 練習)
2. ログイン → リダイレクト後にダイアログ表示「ログインしていない時に作ったプランが N 件あります」
3. 「取り込む」クリック → トースト「N 件のプランを取り込みました」
4. 一覧で取り込んだプランが見える、ローカルプランは消えている

- [ ] **Step 8: コミット**

```bash
rtk git add src/components/Layout.tsx
rtk git commit -m "$(cat <<'EOF'
feat(housing-b1): Layout に LocalImportDialog ホストと自動トリガーを追加

migrateOnLogin → pullFromFirestore 完了後、ownerId='local' プランが残存し
かつ「次回から表示しない」フラグなしならダイアログ自動オープン。
取り込みは usePlanStore.importLocalPlans 経由、結果別にトースト 3 種を出し分け。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: LoginModal にローカル取り込み明示ボタンを追加

**Files:**
- Modify: `src/components/LoginModal.tsx` ([LoginModal.tsx:236-260](../../../src/components/LoginModal.tsx#L236-L260) ログイン済みブロック内、ログアウトボタンの上)

**説明:** ローカルプラン (`ownerId='local'`) が 1 件以上存在するときのみ、LoginModal ログイン済み画面に「ローカルプランを取り込む (N件)」ボタンを表示。クリックで `useLocalImportDialog.open(true)` を呼び出し、`ignoreDontShow=true` で「次回から表示しない」フラグを無視してダイアログ表示。

- [ ] **Step 1: import 追加**

`src/components/LoginModal.tsx` の import セクションに次を追加:

```typescript
import { Download } from 'lucide-react';
import { useLocalImportDialog } from '../store/useLocalImportDialog';
import { usePlanStore } from '../store/usePlanStore';
```

既存の `import { X, LogOut, Shield, Pencil, Camera } from 'lucide-react';` 行に `Download` を追加:

```typescript
import { X, LogOut, Shield, Pencil, Camera, Download } from 'lucide-react';
```

- [ ] **Step 2: コンポーネント内で件数とアクション取得**

`LoginModal` 関数内、既存の state 定義の近く ([LoginModal.tsx:46-56](../../../src/components/LoginModal.tsx#L46-L56) あたり) に次を追加:

```typescript
    const localPlanCount = usePlanStore(s =>
        s.plans.filter(p => p.ownerId === 'local').length,
    );
    const openLocalImport = useLocalImportDialog(s => s.open);
```

- [ ] **Step 3: 明示ボタンを追加 (ログアウトボタンの上)**

[LoginModal.tsx:250-259](../../../src/components/LoginModal.tsx#L250-L259) の **ログアウトボタン** の **直前** に次を追加:

```tsx
                                {localPlanCount > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            openLocalImport(true);
                                            onClose();
                                        }}
                                        className={clsx(
                                            "w-full px-4 py-2.5 rounded-xl text-app-lg font-bold uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer mb-2",
                                            "text-app-toggle border border-app-toggle/40 hover:bg-app-toggle/10 hover:border-app-toggle"
                                        )}
                                    >
                                        <Download size={14} />
                                        {t('local_import.modal_button', { count: localPlanCount })}
                                    </button>
                                )}
```

(`onClose()` は LoginModal を閉じてダイアログだけ残す UX。ダイアログが上書き表示できる構造ではあるが、二重表示は避ける)

- [ ] **Step 4: tsc 通過確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 5: 既存テスト regression チェック**

Run: `npx vitest run`
Expected: 全件 PASS

- [ ] **Step 6: ビルド確認**

Run: `npm run build`
Expected: 成功 (Vercel 厳密 tsc も通る)

- [ ] **Step 7: 開発サーバーで動作確認**

Run: `npm run dev`

シナリオ:
1. ログアウト → プラン作成 → ログイン → ダイアログで「次回から自動で表示しない」 ✓ → 「取り込まない」
2. ローカルプランは残っている、フラグもセットされている
3. プラン作成して同じ流れ → ダイアログ自動表示なし
4. アバターアイコン → LoginModal を開く → 「ローカルプランを取り込む (N件)」ボタンが見える
5. クリック → LoginModal 閉じてダイアログ表示 (チェックボックスなし)
6. 「取り込む」 → 取り込み完了トースト → ボタンが LoginModal から消える

- [ ] **Step 8: コミット**

```bash
rtk git add src/components/LoginModal.tsx
rtk git commit -m "$(cat <<'EOF'
feat(housing-b1): LoginModal にローカルプラン取り込みボタンを追加

ownerId='local' プランがある時のみログアウトボタン上に表示。
クリックで useLocalImportDialog.open(true) → 「次回から表示しない」を
無視してダイアログ再表示。LoginModal 自体は閉じる。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: 全体ビルド + デプロイ準備 + TODO 更新

**Files:** `docs/TODO.md` のみ修正、その他はビルド/テスト/動作確認

- [ ] **Step 1: 全テスト実行**

Run: `npx vitest run`
Expected: 全件 PASS、新規テスト 20 件 (8 planner + 5 store + 7 dialog) 増加

- [ ] **Step 2: tsc 厳密チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: 本番ビルド**

Run: `npm run build`
Expected: 成功、warnings は許容 (既存のものなら無視)

- [ ] **Step 4: dev サーバーで最終確認**

Run: `npm run dev`

実機検証チェックリスト (`docs/superpowers/specs/2026-05-08-housing-phase-b-account-link-design.md` §5.6 + §9.4 の B-1 該当部分):

- [ ] 未ログインでプラン 3 件作成 → Discord ログイン → ダイアログ → 「取り込む」 → 3 件取り込み完了 → ローカルプラン 0
- [ ] 未ログインでプラン 3 件作成 → ログイン → 「次回から自動で表示しない」 ✓ → 「取り込まない」 → ローカル残存・フラグセット
- [ ] フラグセット状態で再ログイン → ダイアログ自動表示なし、LoginModal に「ローカルプランを取り込む (3件)」ボタン表示
- [ ] LoginModal 明示ボタン押下 → ダイアログ表示 (チェックボックス非表示) → 「取り込む」 → 取り込み完了
- [ ] 取り込み後、LoginModal を再度開いてもボタン消えている
- [ ] 枠 5/5 (FRU 既存 5) でローカル FRU 1 件 → 取り込み試行 → 「0 件取り込み・1 件残してあります」(info トースト) + ローカル残存
- [ ] 同名 "FRU 練習" 既存 1 件 + ローカル "FRU 練習" 1 件 → 取り込み → "FRU 練習 (2)" として取り込まれる
- [ ] 4 言語 (ja/en/ko/zh) で全 UI 文字列が表示 (英語/韓国語/中国語表示崩れチェック含む)

問題があればこのタスクは「pending」のまま、修正してから次に進める。

- [ ] **Step 5: docs/TODO.md 更新**

`docs/TODO.md` の「現在の状態」セクション最上部 (line 14 付近) に次のような新セクションを追加:

```markdown
- **最新セッション(2026-05-08 Phase B-1 完了・ローカル取り込み)**: 未ログインで作ったプランをログイン時にダイアログ経由で取り込めるよう実装。①計画立案の純粋関数 `computeImportPlan` (枠計算・新ID発行・同名採番) ②`usePlanStore.importLocalPlans` action (Firestore 書き込み + 部分失敗ハンドリング) ③`LocalImportDialog` コンポーネント (glass-tier3、「次回から表示しない」チェック) ④Layout に自動トリガー (migrateOnLogin → pullFromFirestore 完了後にローカル件数 > 0 かつ flag なしで表示) ⑤LoginModal に明示再取り込みボタン (ローカル data がある時のみ) ⑥`migrateLocalPlansToFirestore` からサイレントアップロードを撤去。i18n 4 言語 10 キー追加。新規テスト 20 件 PASS、tsc clean、build 成功、commit 8 個 (i18n / planner / planService / store / dialog / layout / loginModal / TODO)、push・デプロイ済み。次セッションは Phase B-2 (アカウントリンク Discord ↔ X、自前マッピング `account_links/{provider:id}`) のプラン作成 → 実装。
```

加えて「次にやること」セクションの Phase B 行 (line 60 付近) を次のように更新:

```markdown
- **【最優先】Phase B 認証体験向上 (B-3 完了 / B-1 完了 / B-2 次)**: B-1 完了 2026-05-08。次は B-2 (アカウントリンク Discord ↔ X、自前マッピング `account_links/{provider:id} → primaryUid`) のプラン作成 → 実装。設計書 `docs/superpowers/specs/2026-05-08-housing-phase-b-account-link-design.md` §6 参照。
```

- [ ] **Step 6: TODO.md コミット**

```bash
rtk git add docs/TODO.md
rtk git commit -m "$(cat <<'EOF'
docs(todo): Phase B-1 (ローカル取り込み) 完了記録

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 7: push + デプロイ確認**

```bash
rtk git push
```

Vercel 自動デプロイを待って、本番で動作確認。

---

## 完了判定

以下が全部揃っていれば B-1 完了:
- ✅ vitest 全件 PASS (新規 20 件含む: 8 planner + 5 store + 7 dialog)
- ✅ tsc 厳密モード通過
- ✅ npm run build 成功
- ✅ 実機で「ローカル取り込み / 部分取り込み / 次回から表示しない / 明示ボタン / 同名衝突採番」が 4 言語で動作
- ✅ コミット 7 個 (i18n / planner / planService / store / dialog / layout / loginModal) + TODO.md 1 個 = 8 commits
- ✅ Vercel デプロイ成功、本番動作確認

---

## リスクと注意点

| リスク | 影響 | 対応 |
|---|---|---|
| `migrateLocalPlansToFirestore` からサイレントアップロードを撤去すると、既存ユーザー (B-1 リリース前にログイン済) で `ownerId='local'` プランが残っているケースで、次ログイン時に突然ダイアログが出る | UX 変化、ただし設計書 §5 通りの意図した挙動 | 想定どおり。新ID発行で既存データに影響なし |
| `_migrationDone` フラグは `migrateOnLogin` 完了で立つが、`pullFromFirestore.then(...)` のダイアログトリガーはその外で動くため、B-1 ダイアログが open するタイミングで他のチュートリアル ([MitiPlannerPage.tsx:38-40](../../../src/components/MitiPlannerPage.tsx#L38-L40)) が走る可能性 | 二重モーダル | チュートリアルガード `if (authUser && !migrationDone) return;` は既存ロジックで成立。ダイアログは LocalImportDialog 単独 z-[99999] で重ね表示は OK |
| `importLocalPlans` 中に Firestore 書き込み失敗が複数発生 | 部分的に取り込み | 各 `createPlan` を try-catch、失敗分は result から減算 + ローカル残存。1 件失敗で全停止しない |
| プラン編集後に dirty 化 → syncDirtyPlans が `ownerId='local'` をアップロードしてしまう (元 ID で) | B-1 の「ユーザー明示同意なしに上げない」原則違反 | 既存 syncDirtyPlans は `_dirtyPlanIds` Set 上のものだけ処理。Set は localStorage に persist されないので、ログイン直後の loaded local プランは dirty ではなく自動アップロードされない。ユーザーが明示編集した場合のみ dirty 化 → これは「ユーザーが意図して編集」=暗黙の同意とみなして従来動作で OK |
| ダイアログ表示中にユーザーがアバターアイコン → LoginModal を開く動線 | 重ね表示可だが想定外 | LoginModal 内ボタンは `localPlanCount > 0` で出るが、ダイアログ open 中も同件数なので表示される。クリック時 `onClose()` で LoginModal 閉じる + dialog の再 open。実害なし |

---

**完了後、B-2 (アカウントリンク Discord ↔ X) のプランを書きます。** 設計書 §6 参照。

