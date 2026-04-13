# サイレント圧縮 + アーカイブ改善 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 7日間未使用の軽減表を全カテゴリでサイレント圧縮し、過去零式アーカイブを自動化、UI表記を統一する

**Architecture:** localStorageに`lastOpenedAt`マップを保持し、アプリ起動時に7日超過の軽減表を既存の`compressPlanData()`で圧縮する。`archived`フラグは変更せずタブ移動しない。クリック時に解凍して通常表示する。過去零式アーカイブは確認ダイアログを通知ダイアログに変更する。

**Tech Stack:** React, Zustand, TypeScript, Vitest, i18next, gzip (CompressionStream API)

---

### Task 1: 定数追加 + lastOpenedAtユーティリティ

**Files:**
- Modify: `src/types/firebase.ts:154-171`
- Create: `src/utils/lastOpenedStore.ts`
- Create: `src/utils/__tests__/lastOpenedStore.test.ts`

- [ ] **Step 1: テスト作成**

```typescript
// src/utils/__tests__/lastOpenedStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { getLastOpenedMap, setLastOpened, getStaleplanIds, LAST_OPENED_KEY } from '../lastOpenedStore';

beforeEach(() => {
    localStorage.clear();
});

describe('lastOpenedStore', () => {
    it('初期状態は空オブジェクトを返す', () => {
        expect(getLastOpenedMap()).toEqual({});
    });

    it('setLastOpened で記録し getLastOpenedMap で取得できる', () => {
        const now = Date.now();
        setLastOpened('plan_1', now);
        const map = getLastOpenedMap();
        expect(map['plan_1']).toBe(now);
    });

    it('複数プランを記録できる', () => {
        setLastOpened('plan_1', 1000);
        setLastOpened('plan_2', 2000);
        const map = getLastOpenedMap();
        expect(map['plan_1']).toBe(1000);
        expect(map['plan_2']).toBe(2000);
    });

    it('同じプランを上書き更新できる', () => {
        setLastOpened('plan_1', 1000);
        setLastOpened('plan_1', 9999);
        expect(getLastOpenedMap()['plan_1']).toBe(9999);
    });

    it('getStaleplanIds: 期限超過のプランIDを返す', () => {
        const now = Date.now();
        const eightDaysAgo = now - 8 * 24 * 60 * 60 * 1000;
        const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000;
        setLastOpened('old_plan', eightDaysAgo);
        setLastOpened('recent_plan', threeDaysAgo);

        const allIds = ['old_plan', 'recent_plan'];
        const stale = getStaleplanIds(allIds, 7);
        expect(stale).toContain('old_plan');
        expect(stale).not.toContain('recent_plan');
    });

    it('getStaleplanIds: 記録がないプランは期限超過とみなす', () => {
        const stale = getStaleplanIds(['unknown_plan'], 7);
        expect(stale).toContain('unknown_plan');
    });

    it('localStorage破損時は空オブジェクトを返す', () => {
        localStorage.setItem(LAST_OPENED_KEY, 'invalid json');
        expect(getLastOpenedMap()).toEqual({});
    });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/utils/__tests__/lastOpenedStore.test.ts`
Expected: FAIL — モジュールが存在しない

- [ ] **Step 3: lastOpenedStore ユーティリティを実装**

```typescript
// src/utils/lastOpenedStore.ts
export const LAST_OPENED_KEY = 'plan-last-opened';

/** localStorage から lastOpenedAt マップを取得 */
export function getLastOpenedMap(): Record<string, number> {
    try {
        const raw = localStorage.getItem(LAST_OPENED_KEY);
        if (!raw) return {};
        return JSON.parse(raw);
    } catch {
        return {};
    }
}

/** 指定プランの lastOpenedAt を更新 */
export function setLastOpened(planId: string, timestamp: number): void {
    const map = getLastOpenedMap();
    map[planId] = timestamp;
    localStorage.setItem(LAST_OPENED_KEY, JSON.stringify(map));
}

/**
 * 指定日数以上開かれていないプランIDを返す
 * lastOpenedAt が未記録のプランも対象
 */
export function getStaleplanIds(planIds: string[], days: number): string[] {
    const map = getLastOpenedMap();
    const threshold = Date.now() - days * 24 * 60 * 60 * 1000;
    return planIds.filter(id => {
        const lastOpened = map[id];
        return lastOpened === undefined || lastOpened < threshold;
    });
}
```

- [ ] **Step 4: 定数を追加**

`src/types/firebase.ts` の `PLAN_LIMITS` に追加:

```typescript
// 既存の ARCHIVE_AFTER_DAYS: 90 の直後に追加
/** サイレント圧縮までの日数 */
SILENT_COMPRESS_AFTER_DAYS: 7,
```

- [ ] **Step 5: テスト実行**

Run: `npx vitest run src/utils/__tests__/lastOpenedStore.test.ts`
Expected: PASS (全7件)

- [ ] **Step 6: コミット**

```bash
git add src/utils/lastOpenedStore.ts src/utils/__tests__/lastOpenedStore.test.ts src/types/firebase.ts
git commit -m "feat: lastOpenedStoreユーティリティ + SILENT_COMPRESS_AFTER_DAYS定数"
```

---

### Task 2: サイレント圧縮ロジック（usePlanStore）

**Files:**
- Modify: `src/store/usePlanStore.ts:586-593` (recompressStaleArchives 付近)

- [ ] **Step 1: usePlanStore に silentCompressStale メソッドを追加**

`recompressStaleArchives` メソッドの直後（593行目付近）に追加:

```typescript
/**
 * 7日以上開かれていない非アーカイブプランをサイレント圧縮
 * archived フラグは変更しない（タブ移動しない）
 */
silentCompressStale: async () => {
    const { getStaleplanIds } = await import('../utils/lastOpenedStore');
    const plans = get().plans;
    const candidates = plans.filter(p =>
        !p.archived &&
        p.data && Object.keys(p.data).length > 0
    );
    if (candidates.length === 0) return;

    const staleIds = getStaleplanIds(
        candidates.map(p => p.id),
        PLAN_LIMITS.SILENT_COMPRESS_AFTER_DAYS
    );
    if (staleIds.length === 0) return;

    for (const id of staleIds) {
        const plan = get().plans.find(p => p.id === id);
        if (!plan || !plan.data) continue;
        const compressed = await compressPlanData(plan.data);
        set((state) => ({
            plans: state.plans.map(p =>
                p.id === id
                    ? { ...p, compressedData: compressed, data: undefined as unknown as PlanData }
                    : p
            ),
            _dirtyPlanIds: new Set([...state._dirtyPlanIds, id]),
        }));
    }
},
```

`PLAN_LIMITS` が未インポートの場合、ファイル先頭の import に追加:

```typescript
import { PLAN_LIMITS } from '../types/firebase';
```

- [ ] **Step 2: テスト実行（既存テスト破壊なし確認）**

Run: `npx vitest run`
Expected: 全テスト PASS

- [ ] **Step 3: コミット**

```bash
git add src/store/usePlanStore.ts
git commit -m "feat: silentCompressStaleメソッド追加（7日未使用プランの自動圧縮）"
```

---

### Task 3: アプリ起動時にサイレント圧縮を実行

**Files:**
- Modify: `src/App.tsx:51-54`

- [ ] **Step 1: useEffect にサイレント圧縮を追加**

`src/App.tsx` の既存 useEffect（51-54行目）を修正:

```typescript
// 起動時: archivedなのにdataが展開されているプランを再圧縮 + 未使用プランのサイレント圧縮
useEffect(() => {
    const store = usePlanStore.getState();
    store.recompressStaleArchives();
    store.silentCompressStale();
}, []);
```

- [ ] **Step 2: ビルド確認**

Run: `npm run build`
Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/App.tsx
git commit -m "feat: 起動時にサイレント圧縮を実行"
```

---

### Task 4: 軽減表クリック時の解凍 + lastOpenedAt更新

**Files:**
- Modify: `src/components/Sidebar.tsx:323-343` (ContentTreeItem の onClick)
- Modify: `src/components/Sidebar.tsx:645-670` (ArchivePlanRow の onClick)
- Modify: `src/components/Sidebar.tsx:1045-1063` (handleLoadPlan)

- [ ] **Step 1: ContentTreeItem の onClick に解凍+記録を追加**

`src/components/Sidebar.tsx` 323行目付近、`onClick` ハンドラ内。`plan.data` を使う前に解凍チェックを挿入し、`lastOpenedAt` を更新する。

既存コード（329-343行目）を以下に差し替え:

```typescript
if (currentPlanId === plan.id) return;
runTransition(async () => {
    const store = usePlanStore.getState();
    const snap = useMitigationStore.getState().getSnapshot();
    if (store.currentPlanId) {
        store.updatePlan(store.currentPlanId, { data: snap });
        // アーカイブプランまたはサイレント圧縮対象なら再圧縮
        const currentPlan = store.plans.find(p => p.id === store.currentPlanId);
        if (currentPlan?.archived || currentPlan?.compressedData) {
            store.archivePlan(store.currentPlanId);
        }
    }
    // サイレント圧縮されている場合は解凍
    let planData = plan.data;
    if ((!planData || Object.keys(planData).length === 0) && plan.compressedData) {
        planData = await decompressPlanData(plan.compressedData);
        store.updatePlan(plan.id, { data: planData, compressedData: undefined });
    }
    useMitigationStore.getState().loadSnapshot(planData);
    store.setCurrentPlanId(plan.id);
    // lastOpenedAt を更新
    setLastOpened(plan.id, Date.now());
}, 'plan');
```

ファイル先頭に import を追加（既存の compression import の近くに）:

```typescript
import { decompressPlanData } from '../utils/compression';
import { setLastOpened } from '../utils/lastOpenedStore';
```

- [ ] **Step 2: handleLoadPlan にも同じ解凍ロジックを追加**

`src/components/Sidebar.tsx` の `handleLoadPlan` 関数（1045行目付近）を修正:

```typescript
const handleLoadPlan = (planId: string) => {
    const plan = usePlanStore.getState().getPlan(planId);
    if (!plan || currentPlanId === planId) return;

    runTransition(async () => {
        // Save current session before switching
        if (currentPlanId) {
            const snapshot = getSnapshot();
            updatePlan(currentPlanId, { data: snapshot });
            // アーカイブプランまたはサイレント圧縮対象なら再圧縮
            const currentPlan = usePlanStore.getState().plans.find(p => p.id === currentPlanId);
            if (currentPlan?.archived || currentPlan?.compressedData) {
                usePlanStore.getState().archivePlan(currentPlanId);
            }
        }

        // サイレント圧縮されている場合は解凍
        let planData = plan.data;
        if ((!planData || Object.keys(planData).length === 0) && plan.compressedData) {
            planData = await decompressPlanData(plan.compressedData);
            usePlanStore.getState().updatePlan(plan.id, { data: planData, compressedData: undefined });
        }

        // Load new plan
        loadSnapshot(planData);
        setCurrentPlanId(planId);
        setSelectedContentId(plan.contentId);
        const c = plan.contentId ? getContentById(plan.contentId) : undefined;
        const newLevel = (c?.level ?? plan.level ?? planData.currentLevel ?? 100) as ContentLevel;
        if (c) {
            if (c.category === 'savage') setActiveTab('savage');
            else if (c.category === 'ultimate') setActiveTab('ultimate');
```
（以降は既存コードそのまま）

        // lastOpenedAt を更新
        setLastOpened(planId, Date.now());
    }, 'plan');
};
```

- [ ] **Step 3: ArchivePlanRow の onClick も lastOpenedAt 更新を追加**

`src/components/Sidebar.tsx` の ArchivePlanRow（656行目付近）の onClick 内、`store.setCurrentPlanId(plan.id)` の直後に追加:

```typescript
setLastOpened(plan.id, Date.now());
```

- [ ] **Step 4: ビルド確認**

Run: `npm run build`
Expected: エラーなし

- [ ] **Step 5: コミット**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat: 軽減表クリック時の解凍+lastOpenedAt更新"
```

---

### Task 5: 過去零式アーカイブを自動化（通知のみに変更）

**Files:**
- Modify: `src/components/ArchivePromptModal.tsx` (全体を通知モーダルに書き換え)
- Modify: `src/components/Sidebar.tsx:860-874` (自動アーカイブの useEffect)
- Modify: `src/components/Sidebar.tsx:1792-1807` (モーダル呼び出し)

- [ ] **Step 1: ArchivePromptModal を通知モーダルに書き換え**

```typescript
// src/components/ArchivePromptModal.tsx
import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';

interface ArchivePromptModalProps {
    isOpen: boolean;
    planCount: number;
    onClose: () => void;
}

export const ArchivePromptModal: React.FC<ArchivePromptModalProps> = ({
    isOpen, planCount, onClose,
}) => {
    const { t } = useTranslation();
    if (!isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4"
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-[400px] glass-tier3 rounded-2xl overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* ヘッダー */}
                <div className="px-6 py-5 border-b border-glass-border/30 flex items-center justify-between bg-glass-header/30">
                    <h2 className="text-app-xl font-black text-app-text tracking-widest flex items-center gap-3 uppercase">
                        <span className="w-1.5 h-4 bg-app-toggle rounded-full" />
                        {t('sidebar.archive_notice_title')}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full text-app-text border border-transparent hover:bg-app-toggle hover:text-app-toggle-text hover:border-app-toggle transition-all duration-200 cursor-pointer active:scale-90"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* 本文 */}
                <div className="p-6 space-y-3">
                    <p className="text-app-md text-app-text text-center">
                        {t('sidebar.archive_notice_message', { count: planCount })}
                    </p>
                    <p className="text-app-sm text-app-text-muted text-center">
                        {t('sidebar.archive_notice_slow')}
                    </p>
                </div>

                {/* フッターボタン */}
                <div className="p-6 bg-glass-card/10 border-t border-glass-border/20">
                    <button
                        onClick={onClose}
                        className="w-full py-3.5 rounded-2xl text-app-md font-black bg-app-toggle text-app-toggle-text hover:opacity-80 transition-all cursor-pointer uppercase tracking-[0.3em] active:scale-95"
                    >
                        OK
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
```

- [ ] **Step 2: Sidebar の自動アーカイブ useEffect を自動実行+通知に変更**

`src/components/Sidebar.tsx` 860-874行目を以下に差し替え:

```typescript
// 過去拡張の零式プランを自動アーカイブ（通知のみ）
React.useEffect(() => {
    const currentLevel = getCurrentExpansionLevel();
    const oldSavagePlans = plans.filter(p =>
        !p.archived &&
        p.category === 'savage' &&
        p.level !== undefined &&
        p.level < currentLevel
    );
    const doneKey = `archive-auto-done-${currentLevel}`;
    const done = localStorage.getItem(doneKey);
    if (oldSavagePlans.length > 0 && !done) {
        // 自動でアーカイブ実行
        usePlanStore.getState().archivePlans(oldSavagePlans.map(p => p.id)).then(() => {
            localStorage.setItem(doneKey, 'true');
            setArchivePrompt({ planIds: oldSavagePlans.map(p => p.id) });
        });
    }
}, [plans]);
```

- [ ] **Step 3: Sidebar のモーダル呼び出しを更新**

`src/components/Sidebar.tsx` 1792-1807行目を以下に差し替え:

```typescript
{/* 自動アーカイブ通知ダイアログ */}
<ArchivePromptModal
    isOpen={archivePrompt !== null}
    planCount={archivePrompt?.planIds.length ?? 0}
    onClose={() => setArchivePrompt(null)}
/>
```

- [ ] **Step 4: ビルド確認**

Run: `npm run build`
Expected: エラーなし

- [ ] **Step 5: コミット**

```bash
git add src/components/ArchivePromptModal.tsx src/components/Sidebar.tsx
git commit -m "feat: 過去零式アーカイブを自動化（確認→通知ダイアログに変更）"
```

---

### Task 6: 右クリックメニューに「アーカイブ」追加

**Files:**
- Modify: `src/components/Sidebar.tsx:1741-1789` (コンテキストメニューの items)

- [ ] **Step 1: コンテキストメニューに「アーカイブ」項目を追加**

`src/components/Sidebar.tsx` のコンテキストメニュー items 配列内、divider の直前（1773行目付近）に追加:

```typescript
{
    label: t('sidebar.context_archive'),
    icon: <Archive size={12} />,
    onClick: async () => {
        await usePlanStore.getState().archivePlan(contextMenu.planId);
    },
},
```

`Archive` アイコンを lucide-react の import に追加（ファイル先頭の import 行）:

```typescript
import { ..., Archive } from 'lucide-react';
```

- [ ] **Step 2: ビルド確認**

Run: `npm run build`
Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat: 右クリックメニューに「アーカイブ」追加"
```

---

### Task 7: i18nキー追加 + 表記統一（4言語）

**Files:**
- Modify: `src/locales/ja.json`
- Modify: `src/locales/en.json`
- Modify: `src/locales/zh.json`
- Modify: `src/locales/ko.json`

- [ ] **Step 1: 日本語（ja.json）**

変更するキー:

```json
"archive_empty": "アーカイブに軽減表はありません",
"archive_plan_count": "{{count}}件の軽減表",
"duplicate_limit_reached": "軽減表の上限に達しています",
"manage_plans": "軽減表管理",
```

削除するキー:
```json
"archive_confirm_title": (削除)
"archive_confirm_message": (削除)
"archive_confirm_yes": (削除)
"archive_confirm_no": (削除)
```

追加するキー:
```json
"archive_notice_title": "過去拡張の軽減表をアーカイブしました",
"archive_notice_message": "過去拡張の零式の軽減表（{{count}}件）をアーカイブに移動しました。アーカイブタブからいつでも開けます。",
"archive_notice_slow": "初回の読み込みが少し遅くなることがあります。",
"context_archive": "アーカイブ",
```

- [ ] **Step 2: 英語（en.json）**

変更するキー:

```json
"archive_empty": "No archived lists",
"archive_plan_count": "{{count}} list(s)",
"duplicate_limit_reached": "List limit reached",
"manage_plans": "Manage Lists",
```

削除するキー:
```json
"archive_confirm_title": (削除)
"archive_confirm_message": (削除)
"archive_confirm_yes": (削除)
"archive_confirm_no": (削除)
```

追加するキー:
```json
"archive_notice_title": "Old Expansion Lists Archived",
"archive_notice_message": "{{count}} savage mitigation list(s) from previous expansions have been moved to the Archive tab. You can access them anytime.",
"archive_notice_slow": "The first time you open them may take a moment to load.",
"context_archive": "Archive",
```

- [ ] **Step 3: 中国語（zh.json）**

変更するキー:

```json
"archive_empty": "归档中没有减伤表",
"archive_plan_count": "{{count}}个减伤表",
"duplicate_limit_reached": "减伤表数量已达上限",
"manage_plans": "管理减伤表",
```

削除するキー:
```json
"archive_confirm_title": (削除)
"archive_confirm_message": (削除)
"archive_confirm_yes": (削除)
"archive_confirm_no": (削除)
```

追加するキー:
```json
"archive_notice_title": "已归档旧版本减伤表",
"archive_notice_message": "已将{{count}}个旧版本零式减伤表移至归档标签页。您可以随时从归档中访问。",
"archive_notice_slow": "首次打开时加载可能会稍慢。",
"context_archive": "归档",
```

- [ ] **Step 4: 韓国語（ko.json）**

変更するキー:

```json
"archive_empty": "보관된 경감표가 없습니다",
"archive_plan_count": "{{count}}개의 경감표",
"duplicate_limit_reached": "경감표 한도에 도달했습니다",
"manage_plans": "경감표 관리",
```

削除するキー:
```json
"archive_confirm_title": (削除)
"archive_confirm_message": (削除)
"archive_confirm_yes": (削除)
"archive_confirm_no": (削除)
```

追加するキー:
```json
"archive_notice_title": "이전 확장팩 경감표 보관 완료",
"archive_notice_message": "이전 확장팩의 영식 경감표 {{count}}개를 보관함으로 이동했습니다. 보관함 탭에서 언제든 접근할 수 있습니다.",
"archive_notice_slow": "처음 열 때 로딩이 약간 느릴 수 있습니다.",
"context_archive": "보관",
```

- [ ] **Step 5: ビルド確認**

Run: `npm run build`
Expected: エラーなし

- [ ] **Step 6: コミット**

```bash
git add src/locales/ja.json src/locales/en.json src/locales/zh.json src/locales/ko.json
git commit -m "feat: i18n表記統一（プラン→軽減表）+ アーカイブ通知キー追加"
```

---

### Task 8: 圧縮往復テスト強化

**Files:**
- Modify: `src/utils/__tests__/compression.test.ts`

- [ ] **Step 1: 大規模データの往復テストを追加**

`src/utils/__tests__/compression.test.ts` に追加:

```typescript
it('大規模データ（FRU相当）の圧縮・復元が一致する', async () => {
    // FRU相当: 391イベント、8パーティメンバー、多数の軽減
    const largeData: PlanData = {
        currentLevel: 100,
        timelineEvents: Array.from({ length: 400 }, (_, i) => ({
            id: `evt_${i}`,
            name: { ja: `攻撃${i}`, en: `Attack ${i}` },
            time: i * 1.5,
            damage: 50000 + i * 100,
            type: i % 2 === 0 ? 'magical' as const : 'physical' as const,
            target: 'party' as const,
        })),
        timelineMitigations: Array.from({ length: 200 }, (_, i) => ({
            id: `mit_${i}`,
            skillId: `skill_${i % 20}`,
            time: i * 3,
            duration: 15,
            ownerId: `member_${i % 8}`,
            targets: [`member_${i % 8}`],
        })),
        phases: [
            { id: 'p1', name: { ja: 'P1', en: 'P1' }, startTime: 0, endTime: 120 },
            { id: 'p2', name: { ja: 'P2', en: 'P2' }, startTime: 120, endTime: 240 },
            { id: 'p3', name: { ja: 'P3', en: 'P3' }, startTime: 240, endTime: 360 },
            { id: 'p4', name: { ja: 'P4', en: 'P4' }, startTime: 360, endTime: 480 },
            { id: 'p5', name: { ja: 'P5', en: 'P5' }, startTime: 480, endTime: 600 },
        ],
        labels: [],
        partyMembers: Array.from({ length: 8 }, (_, i) => ({
            id: `member_${i}`,
            jobId: `job_${i}`,
            hp: 100000,
            mainStat: 4000,
            det: 2000,
            crt: 2500,
            ten: 400,
            ss: 400,
            wd: 132,
        })),
        aaSettings: { damage: 5000, type: 'physical', target: 'MT' },
        schAetherflowPatterns: {},
        myMemberId: 'member_0',
    };

    const compressed = await compressPlanData(largeData);
    const decompressed = await decompressPlanData(compressed);
    expect(decompressed).toEqual(largeData);

    // 圧縮率の確認（80%以上の削減）
    const originalSize = JSON.stringify(largeData).length;
    expect(compressed.length).toBeLessThan(originalSize * 0.5);
});

it('圧縮→解凍を複数回繰り返しても安定する', async () => {
    let data = samplePlanData;
    for (let i = 0; i < 3; i++) {
        const compressed = await compressPlanData(data);
        data = await decompressPlanData(compressed);
    }
    expect(data).toEqual(samplePlanData);
});
```

- [ ] **Step 2: テスト実行**

Run: `npx vitest run src/utils/__tests__/compression.test.ts`
Expected: PASS（既存3件 + 新規2件 = 5件）

注: 大規模データのテストが型エラーを出す場合、`TimelineEvent` / `AppliedMitigation` / `PartyMember` の実際のフィールドに合わせて調整する。実際の型定義を確認してからテストデータを修正すること。

- [ ] **Step 3: コミット**

```bash
git add src/utils/__tests__/compression.test.ts
git commit -m "test: 圧縮往復テスト強化（大規模データ+安定性）"
```

---

### Task 9: 全テスト + ビルド確認

**Files:** なし（検証のみ）

- [ ] **Step 1: 全テスト実行**

Run: `npx vitest run`
Expected: 全テスト PASS

- [ ] **Step 2: ビルド確認**

Run: `npm run build`
Expected: エラーなし

- [ ] **Step 3: 開発サーバーで動作確認**

Run: `npm run dev`

確認項目:
1. アプリが正常に起動すること
2. サイドバーで軽減表をクリック → 通常通り開けること
3. 右クリックメニューに「アーカイブ」が表示されること
4. アーカイブタブが正常に動作すること
5. コンソールに planId が表示されないこと（セキュリティ修正の確認）

- [ ] **Step 4: 最終コミット（必要な修正があれば）**

```bash
git add -A
git commit -m "fix: サイレント圧縮の動作確認修正"
```
