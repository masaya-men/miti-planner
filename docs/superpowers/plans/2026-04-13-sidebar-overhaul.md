# サイドバー大幅改修 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** サイドバーの4階層構造を3+1タブのフラット構造に置き換え、アーカイブ機能・右クリックメニュー・Shift複数選択を追加する

**Architecture:** Sidebar.tsxの表示ロジックを、SegmentButtonフィルタ+アコーディオン階層から、タブ切替+フラットリストに置き換える。contentRegistryに新しいフィルタ関数を追加し、SavedPlanにarchived/compressedDataフィールドを追加してアーカイブ機能を実現する。

**Tech Stack:** React, TypeScript, Zustand, Framer Motion, Tailwind CSS, CompressionStream API (gzip)

**Spec:** `docs/superpowers/specs/2026-04-13-sidebar-overhaul-design.md`

---

### Task 1: contentRegistryに新規フィルタ関数を追加

**Files:**
- Modify: `src/data/contentRegistry.ts:170-240`
- Create: `src/data/__tests__/contentRegistry.test.ts`

- [ ] **Step 1: テストファイルを作成**

```typescript
// src/data/__tests__/contentRegistry.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// useMasterDataStoreをモック（静的データを使わせる）
vi.mock('../../store/useMasterDataStore', () => ({
    useMasterDataStore: {
        getState: () => ({ contents: null, config: null }),
    },
}));

import {
    getCurrentExpansionLevel,
    getSavageForCurrentExpansion,
    getAllUltimates,
    getOtherContents,
} from '../contentRegistry';

describe('contentRegistry フィルタ関数', () => {
    it('getCurrentExpansionLevel は最大レベルを返す', () => {
        const level = getCurrentExpansionLevel();
        expect(level).toBe(100);
    });

    it('getSavageForCurrentExpansion は現拡張の零式のみ返す', () => {
        const contents = getSavageForCurrentExpansion();
        expect(contents.length).toBeGreaterThan(0);
        expect(contents.every(c => c.category === 'savage' && c.level === 100)).toBe(true);
    });

    it('getAllUltimates は全絶コンテンツを返す', () => {
        const contents = getAllUltimates();
        expect(contents.length).toBeGreaterThan(0);
        expect(contents.every(c => c.category === 'ultimate')).toBe(true);
        // 複数レベルにまたがる
        const levels = new Set(contents.map(c => c.level));
        expect(levels.size).toBeGreaterThan(1);
    });

    it('getOtherContents は dungeon/raid/custom のみ返す', () => {
        const contents = getOtherContents();
        const validCats = ['dungeon', 'raid', 'custom'];
        expect(contents.every(c => validCats.includes(c.category))).toBe(true);
    });
});
```

- [ ] **Step 2: テスト実行 → 失敗を確認**

Run: `npx vitest run src/data/__tests__/contentRegistry.test.ts`
Expected: FAIL — 関数が存在しない

- [ ] **Step 3: contentRegistry.tsに関数を実装**

`src/data/contentRegistry.ts` の末尾（240行目以降）に追加:

```typescript
// ==========================================
// サイドバータブ用フィルタ関数
// ==========================================

/** 現在の最新拡張のレベルを返す */
export function getCurrentExpansionLevel(): ContentLevel {
    const all = getContentDefinitions();
    const levels = all.map(c => c.level);
    return Math.max(...levels) as ContentLevel;
}

/** 現在の拡張パッケージの零式コンテンツ一覧（全ティア） */
export function getSavageForCurrentExpansion(): ContentDefinition[] {
    const currentLevel = getCurrentExpansionLevel();
    return getContentDefinitions()
        .filter(c => c.category === 'savage' && c.level === currentLevel)
        .sort((a, b) => a.order - b.order);
}

/** 全絶コンテンツ一覧（レベル不問、レベル昇順→order昇順） */
export function getAllUltimates(): ContentDefinition[] {
    return getContentDefinitions()
        .filter(c => c.category === 'ultimate')
        .sort((a, b) => a.level - b.level || a.order - b.order);
}

/** dungeon/raid/custom コンテンツ一覧 */
export function getOtherContents(): ContentDefinition[] {
    return getContentDefinitions()
        .filter(c => c.category === 'dungeon' || c.category === 'raid' || c.category === 'custom');
}
```

- [ ] **Step 4: テスト実行 → パスを確認**

Run: `npx vitest run src/data/__tests__/contentRegistry.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: コミット**

```bash
git add src/data/contentRegistry.ts src/data/__tests__/contentRegistry.test.ts
git commit -m "feat: contentRegistryにサイドバータブ用フィルタ関数を追加"
```

---

### Task 2: 圧縮ユーティリティを作成

**Files:**
- Create: `src/utils/compression.ts`
- Create: `src/utils/__tests__/compression.test.ts`

- [ ] **Step 1: テストファイルを作成**

```typescript
// src/utils/__tests__/compression.test.ts
import { describe, it, expect } from 'vitest';
import { compressPlanData, decompressPlanData } from '../compression';
import type { PlanData } from '../../types';

const samplePlanData: PlanData = {
    currentLevel: 100,
    timelineEvents: [
        { id: 'e1', name: 'test', startTime: 10, endTime: 15, damage: 50000, type: 'magical', target: 'party' },
    ],
    timelineMitigations: [],
    phases: [{ id: 'p1', name: 'Phase 1', startTime: 0, endTime: 60 }],
    labels: [],
    partyMembers: [],
    aaSettings: { damage: 5000, type: 'physical', target: 'MT' },
    schAetherflowPatterns: {},
    myMemberId: null,
};

describe('compression', () => {
    it('compressPlanData は base64 文字列を返す', async () => {
        const compressed = await compressPlanData(samplePlanData);
        expect(typeof compressed).toBe('string');
        expect(compressed.length).toBeGreaterThan(0);
        // 元のJSONより小さい（またはbase64オーバーヘッドで近い）
        expect(compressed.length).toBeLessThan(JSON.stringify(samplePlanData).length * 2);
    });

    it('decompressPlanData で元データに復元できる', async () => {
        const compressed = await compressPlanData(samplePlanData);
        const decompressed = await decompressPlanData(compressed);
        expect(decompressed).toEqual(samplePlanData);
    });

    it('空の配列を持つデータでも正常に動作する', async () => {
        const minimal: PlanData = {
            currentLevel: 90,
            timelineEvents: [],
            timelineMitigations: [],
            phases: [],
            partyMembers: [],
            aaSettings: { damage: 0, type: 'physical', target: 'MT' },
            schAetherflowPatterns: {},
        };
        const compressed = await compressPlanData(minimal);
        const decompressed = await decompressPlanData(compressed);
        expect(decompressed).toEqual(minimal);
    });
});
```

- [ ] **Step 2: テスト実行 → 失敗を確認**

Run: `npx vitest run src/utils/__tests__/compression.test.ts`
Expected: FAIL — モジュールが存在しない

- [ ] **Step 3: 圧縮ユーティリティを実装**

```typescript
// src/utils/compression.ts
import type { PlanData } from '../types';

/** PlanData を gzip 圧縮して base64 文字列に変換する */
export async function compressPlanData(data: PlanData): Promise<string> {
    const json = JSON.stringify(data);
    const encoder = new TextEncoder();
    const input = encoder.encode(json);

    const cs = new CompressionStream('gzip');
    const writer = cs.writable.getWriter();
    writer.write(input);
    writer.close();

    const chunks: Uint8Array[] = [];
    const reader = cs.readable.getReader();
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
    }

    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
    const merged = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
    }

    return btoa(String.fromCharCode(...merged));
}

/** base64 + gzip 圧縮データを PlanData に復元する */
export async function decompressPlanData(compressed: string): Promise<PlanData> {
    const binary = atob(compressed);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    const ds = new DecompressionStream('gzip');
    const writer = ds.writable.getWriter();
    writer.write(bytes);
    writer.close();

    const chunks: Uint8Array[] = [];
    const reader = ds.readable.getReader();
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
    }

    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
    const merged = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
    }

    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(merged));
}
```

- [ ] **Step 4: テスト実行 → パスを確認**

Run: `npx vitest run src/utils/__tests__/compression.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: コミット**

```bash
git add src/utils/compression.ts src/utils/__tests__/compression.test.ts
git commit -m "feat: PlanData圧縮/解凍ユーティリティを追加"
```

---

### Task 3: SavedPlan型にarchived/compressedDataフィールドを追加

**Files:**
- Modify: `src/types/index.ts:228-244`
- Modify: `src/store/usePlanStore.ts`

- [ ] **Step 1: SavedPlan型を拡張**

`src/types/index.ts` の SavedPlan インターフェースに追加:

```typescript
export interface SavedPlan {
    id: string;
    ownerId: string;
    ownerDisplayName: string;
    title: string;
    contentId: string | null;
    category?: ContentCategory;
    level?: ContentLevel;
    isPublic: boolean;
    copyCount: number;
    useCount: number;
    data: PlanData;
    createdAt: number;
    updatedAt: number;
    /** アーカイブ済みフラグ */
    archived?: boolean;
    /** 圧縮済みデータ（archived時にdataの代わりに使用） */
    compressedData?: string;
}
```

- [ ] **Step 2: usePlanStoreにアーカイブ関連アクションを追加**

`src/store/usePlanStore.ts` の PlanState インターフェースに追加:

```typescript
/** 指定プランをアーカイブ（圧縮含む） */
archivePlan: (id: string) => Promise<void>;
/** 複数プランを一括アーカイブ */
archivePlans: (ids: string[]) => Promise<void>;
/** アーカイブプランのデータを解凍して返す（プラン自体は変更しない） */
decompressArchivedPlan: (id: string) => Promise<PlanData | null>;
/** archived && data が展開されているプランを検知して再圧縮 */
recompressStaleArchives: () => Promise<void>;
```

実装:

```typescript
archivePlan: async (id) => {
    const plan = get().plans.find(p => p.id === id);
    if (!plan || plan.archived) return;
    const compressed = await compressPlanData(plan.data);
    set((state) => ({
        plans: state.plans.map(p =>
            p.id === id
                ? { ...p, archived: true, compressedData: compressed, data: undefined as unknown as PlanData }
                : p
        ),
        _dirtyPlanIds: new Set([...state._dirtyPlanIds, id]),
    }));
},

archivePlans: async (ids) => {
    for (const id of ids) {
        await get().archivePlan(id);
    }
},

decompressArchivedPlan: async (id) => {
    const plan = get().plans.find(p => p.id === id);
    if (!plan) return null;
    if (plan.data && Object.keys(plan.data).length > 0) return plan.data;
    if (!plan.compressedData) return null;
    return decompressPlanData(plan.compressedData);
},

recompressStaleArchives: async () => {
    const stale = get().plans.filter(p =>
        p.archived && p.data && Object.keys(p.data).length > 0
    );
    for (const plan of stale) {
        await get().archivePlan(plan.id);
    }
},
```

- [ ] **Step 3: usePlanStoreのpersist partializeを更新**

partialize内で `compressedData` が保存されるよう確認。archived プランの `data` は undefined なので localStorage にも保存されない。

- [ ] **Step 4: ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 5: コミット**

```bash
git add src/types/index.ts src/store/usePlanStore.ts
git commit -m "feat: SavedPlanにarchived/compressedDataフィールドとアーカイブアクションを追加"
```

---

### Task 4: Sidebar.tsxをタブ構造に書き換え

これが最大のタスク。Sidebar.tsx内の表示ロジックを段階的に置き換える。

**Files:**
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: activeLevel/activeCategoryをactiveTabに置き換え**

`src/components/Sidebar.tsx` 内の状態変数を変更:

```typescript
// 削除: activeLevel, activeCategory の useState
// 追加:
type SidebarTab = 'savage' | 'ultimate' | 'other' | 'archive';
const [activeTab, setActiveTab] = useState<SidebarTab>(() => {
    if (selectedContentId) {
        const content = getContentById(selectedContentId);
        if (content) {
            if (content.category === 'savage') return 'savage';
            if (content.category === 'ultimate') return 'ultimate';
            return 'other';
        }
    }
    return 'savage';
});
```

チュートリアル開始時の初期化（行770-776）を更新:
```typescript
React.useEffect(() => {
    if (tutorialActive) {
        setActiveTab('savage');
    }
}, [tutorialActive]);
```

チュートリアル復帰時の同期（行778-793）を更新:
```typescript
const handleRestored = (e: Event) => {
    const { contentId } = (e as CustomEvent).detail ?? {};
    if (contentId) {
        const c = getContentById(contentId);
        if (c) {
            if (c.category === 'savage') setActiveTab('savage');
            else if (c.category === 'ultimate') setActiveTab('ultimate');
            else setActiveTab('other');
            setSelectedContentId(contentId);
        }
    }
};
```

currentPlanId変更時の追従（行836-849）を更新:
```typescript
React.useEffect(() => {
    if (currentPlanId) {
        const plan = plans.find(p => p.id === currentPlanId);
        if (plan?.contentId) {
            setSelectedContentId(plan.contentId);
            const content = getContentById(plan.contentId);
            if (content) {
                if (content.category === 'savage') setActiveTab('savage');
                else if (content.category === 'ultimate') setActiveTab('ultimate');
                else setActiveTab('other');
            }
        }
    } else {
        setActiveTab('savage');
        setSelectedContentId(null);
    }
}, [currentPlanId, plans]);
```

- [ ] **Step 2: SegmentButtonをタブUIに置き換え**

行1154-1196のSegmentButton 2つとその周辺を削除し、タブUIに置き換え:

```tsx
{/* タブ */}
<div className="flex px-2.5 pt-2 gap-0.5">
    {([
        { key: 'savage' as const, icon: '⚔', label: t('sidebar.tab_savage') },
        { key: 'ultimate' as const, icon: '👑', label: t('sidebar.tab_ultimate') },
        { key: 'other' as const, icon: '📁', label: t('sidebar.tab_other') },
        { key: 'archive' as const, icon: '📦', label: t('sidebar.tab_archive') },
    ]).map(tab => (
        <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={clsx(
                "flex-1 text-center py-1.5 text-app-base font-bold rounded-t-md transition-all duration-150 cursor-pointer",
                activeTab === tab.key
                    ? "bg-app-surface2 text-app-text border border-glass-border border-b-transparent"
                    : "text-app-text-muted hover:text-app-text-sec hover:bg-glass-hover border border-transparent"
            )}
        >
            {tab.icon} {tab.label}
        </button>
    ))}
</div>
<div className="border-b border-glass-border mx-2.5" />
```

- [ ] **Step 3: コンテンツエリアをタブごとの表示に置き換え**

行1242-1292の CategoryAccordion/FreePlanSection ループを削除し、タブごとの表示に置き換え。

import文の変更:
```typescript
// 追加
import {
    getCurrentExpansionLevel,
    getSavageForCurrentExpansion,
    getAllUltimates,
    getOtherContents,
} from '../data/contentRegistry';
```

零式タブ:
```tsx
{activeTab === 'savage' && (
    <div className="flex-1 overflow-y-auto px-3 pb-2 space-y-1 custom-scrollbar">
        {/* ティアごとにセクション分け */}
        {(() => {
            const savageContents = getSavageForCurrentExpansion();
            const seriesIds = [...new Set(savageContents.map(c => c.seriesId))];
            return seriesIds.map(sid => {
                const series = getSeriesById(sid);
                const contents = savageContents.filter(c => c.seriesId === sid);
                if (contents.length === 0) return null;
                const seriesName = series?.name[lang as ContentLanguage] || series?.name.ja || sid;
                const projectLabel = getProjectLabel(contents[0].level, 'savage');
                const sectionLabel = projectLabel
                    ? `${projectLabel[lang as ContentLanguage] || projectLabel.ja}：${seriesName}`
                    : seriesName;
                return (
                    <div key={sid}>
                        <div className="text-[9px] font-semibold text-app-text-muted uppercase tracking-wider px-2 pt-2 pb-1">
                            {sectionLabel}
                        </div>
                        {contents.map((content, idx) => (
                            <ContentTreeItem
                                key={content.id}
                                content={content}
                                isActive={selectedContentId === content.id}
                                multiSelect={multiSelect}
                                onToggleSelect={toggleItemId}
                                onSelect={handleSelectContent}
                                highlightFirst={isTutorialContentSelect && idx === 0 && sid === seriesIds[0]}
                                lang={lang}
                            />
                        ))}
                    </div>
                );
            });
        })()}
    </div>
)}
```

絶タブ:
```tsx
{activeTab === 'ultimate' && (
    <div className="flex-1 overflow-y-auto px-3 pb-2 space-y-1 custom-scrollbar">
        {getAllUltimates().map(content => (
            <ContentTreeItem
                key={content.id}
                content={content}
                isActive={selectedContentId === content.id}
                multiSelect={multiSelect}
                onToggleSelect={toggleItemId}
                onSelect={handleSelectContent}
                lang={lang}
            />
        ))}
    </div>
)}
```

その他タブ:
```tsx
{activeTab === 'other' && (
    <div className="flex-1 overflow-y-auto px-3 pb-2 space-y-1 custom-scrollbar">
        {/* コンテンツ登録済み（dungeon/raid） */}
        {getOtherContents().map(content => (
            <ContentTreeItem
                key={content.id}
                content={content}
                isActive={selectedContentId === content.id}
                multiSelect={multiSelect}
                onToggleSelect={toggleItemId}
                onSelect={handleSelectContent}
                lang={lang}
            />
        ))}
        {/* フリープラン（category=dungeon/raid/custom、コンテンツ未登録含む） */}
        {(['dungeon', 'raid', 'custom'] as const).map(cat => {
            const catPlans = plans.filter(p => {
                if (p.archived) return false;
                if (p.category) return p.category === cat;
                if (p.contentId === null && cat === 'custom') return true;
                if (p.contentId && !getContentById(p.contentId) && cat === 'custom') return true;
                return false;
            });
            if (catPlans.length === 0) return null;
            const catLabel = CATEGORY_LABELS[cat][lang as ContentLanguage] || CATEGORY_LABELS[cat].ja;
            return (
                <FreePlanSection
                    key={cat}
                    label={catLabel}
                    plans={catPlans}
                    currentPlanId={currentPlanId}
                    multiSelect={multiSelect}
                    onToggleSelect={toggleItemId}
                    onLoadPlan={handleLoadPlan}
                    onUpdatePlan={updatePlan}
                />
            );
        })}
    </div>
)}
```

アーカイブタブ:
```tsx
{activeTab === 'archive' && (
    <div className="flex-1 overflow-y-auto px-3 pb-2 space-y-1 custom-scrollbar">
        {(() => {
            const archivedPlans = plans.filter(p => p.archived);
            if (archivedPlans.length === 0) {
                return (
                    <div className="text-center text-app-text-muted text-app-base py-8">
                        {t('sidebar.archive_empty')}
                    </div>
                );
            }
            // レベル順（昇順）→カテゴリ順でソート
            const sorted = [...archivedPlans].sort((a, b) => {
                const levelA = a.level ?? 0;
                const levelB = b.level ?? 0;
                if (levelA !== levelB) return levelA - levelB;
                const catOrder = ['savage', 'ultimate', 'dungeon', 'raid', 'custom'];
                return catOrder.indexOf(a.category || 'custom') - catOrder.indexOf(b.category || 'custom');
            });
            return sorted.map(plan => (
                <div
                    key={plan.id}
                    role="button"
                    tabIndex={0}
                    className="sidebar-item flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-app-base text-app-text hover:bg-glass-hover cursor-pointer transition-colors active:scale-[0.98]"
                    onClick={async () => {
                        const data = await usePlanStore.getState().decompressArchivedPlan(plan.id);
                        if (data) {
                            runTransition(() => {
                                const store = usePlanStore.getState();
                                const snap = useMitigationStore.getState().getSnapshot();
                                if (store.currentPlanId) {
                                    store.updatePlan(store.currentPlanId, { data: snap });
                                }
                                // 一時的にdataを展開してロード
                                store.updatePlan(plan.id, { data });
                                useMitigationStore.getState().loadSnapshot(data);
                                store.setCurrentPlanId(plan.id);
                            }, 'plan');
                        }
                    }}
                >
                    <span className="w-1 h-1 rounded-full bg-app-text-muted/40 shrink-0" />
                    <span className="truncate flex-1">{plan.title}</span>
                    <span className="text-[9px] text-app-text-muted shrink-0">
                        Lv{plan.level}
                    </span>
                </div>
            ));
        })()}
    </div>
)}
```

- [ ] **Step 4: NewPlanModal close時のサイドバー同期を更新**

行1469-1483を更新:

```tsx
<NewPlanModal isOpen={isNewPlanModalOpen} onClose={(created) => {
    setIsNewPlanModalOpen(false);
    if (created) {
        setSelectedContentId(created.contentId);
        useMitigationStore.getState().setCurrentLevel(created.level);
        // 作成されたプランが属するタブに切り替え
        if (created.category === 'savage') setActiveTab('savage');
        else if (created.category === 'ultimate') setActiveTab('ultimate');
        else setActiveTab('other');
        setTimeout(() => {
            const el = document.querySelector(`[data-content-id="${created.contentId}"]`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 200);
    }
}} />
```

- [ ] **Step 5: 不要になったimportと変数を削除**

削除対象:
- `LEVEL_TIERS` 定数（行66）
- `getCategoriesByLevel` import（行11）
- `getSeriesByLevel` import（行12）— 零式タブで `getSavageForCurrentExpansion` を使うため
- `SegmentButton` import（行33）— Sidebar内では不使用に
- `availableCategories` useMemo（Sidebar内で定義されているはず）
- `SeriesAccordion` コンポーネント（行426-539）
- `CategoryAccordion` コンポーネント（行559-609）

ただし `getSeriesByLevel`, `getContentBySeries`, `getProjectLabel` は零式タブのセクション分けで引き続き使用する可能性があるため、利用状況を確認してから削除。`getContentBySeries` は削除可能（`getSavageForCurrentExpansion` で代替）。`getProjectLabel` と `getSeriesById` は零式タブのセクションラベル生成で使用するため残す。

- [ ] **Step 6: ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 7: 既存テスト実行**

Run: `npx vitest run`
Expected: 全テストパス

- [ ] **Step 8: コミット**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat: サイドバーをタブ構造に書き換え（零式・絶・その他・アーカイブ）"
```

---

### Task 5: i18nキーを追加

**Files:**
- Modify: `src/i18n/locales/ja.json`（または該当する翻訳ファイル）
- 他の言語ファイルも同様に修正

- [ ] **Step 1: 翻訳ファイルの場所を確認**

Run: `find src/i18n -name "*.json" | head -20`

翻訳ファイルを読んで既存のsidebarキーの構造を確認。

- [ ] **Step 2: 翻訳キーを追加**

各言語ファイルの `sidebar` セクションに以下を追加:

```json
{
    "sidebar": {
        "tab_savage": "零式",
        "tab_ultimate": "絶",
        "tab_other": "その他",
        "tab_archive": "アーカイブ",
        "archive_empty": "アーカイブにプランはありません",
        "archive_confirm_title": "過去拡張のプランをアーカイブ",
        "archive_confirm_message": "過去拡張の零式プランをアーカイブしますか？アーカイブタブからいつでもアクセスできます。",
        "archive_confirm_yes": "アーカイブする",
        "archive_confirm_no": "今はしない",
        "archive_delete_all": "一括削除",
        "context_share": "シェア",
        "context_duplicate": "複製",
        "context_rename": "名前変更",
        "context_delete": "削除"
    }
}
```

英語・中国語・韓国語も同様に追加。

- [ ] **Step 3: コミット**

```bash
git add src/i18n/
git commit -m "feat: サイドバー改修用のi18nキーを追加"
```

---

### Task 6: ContentTreeItemにホバー「+」ボタンを追加

**Files:**
- Modify: `src/components/Sidebar.tsx` (ContentTreeItem コンポーネント内)

- [ ] **Step 1: ContentTreeItem内のコンテンツ名行に「+」ボタンを追加**

`src/components/Sidebar.tsx` の ContentTreeItem 内、行241のコメント `{/* ホバーの+ボタンは廃止 → サブアイテム末尾の+行に移動 */}` を以下に置き換え:

```tsx
{/* ホバーで表示される「+」ボタン — 展開せずにプラン追加 */}
{!multiSelect.isEnabled && (
    <Tooltip content={t('sidebar.add_plan')}>
        <button
            onClick={(e) => {
                e.stopPropagation();
                onSelect(content, true);
            }}
            className="shrink-0 w-6 h-6 rounded flex items-center justify-center text-app-text-muted hover:text-app-text hover:bg-glass-hover transition-all cursor-pointer opacity-0 group-hover/content:opacity-100"
        >
            <Plus size={12} />
        </button>
    </Tooltip>
)}
```

- [ ] **Step 2: ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat: コンテンツ行にホバーで表示される+ボタンを追加"
```

---

### Task 7: 右クリックコンテキストメニューを追加

**Files:**
- Create: `src/components/ui/ContextMenu.tsx`
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: ContextMenuコンポーネントを作成**

```typescript
// src/components/ui/ContextMenu.tsx
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';

export interface ContextMenuItem {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    danger?: boolean;
    divider?: boolean;
}

interface ContextMenuProps {
    x: number;
    y: number;
    items: ContextMenuItem[];
    onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('mousedown', handleClick);
        document.addEventListener('keydown', handleEsc);
        return () => {
            document.removeEventListener('mousedown', handleClick);
            document.removeEventListener('keydown', handleEsc);
        };
    }, [onClose]);

    // 画面端からはみ出さないよう位置調整
    useEffect(() => {
        if (!menuRef.current) return;
        const rect = menuRef.current.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            menuRef.current.style.left = `${x - rect.width}px`;
        }
        if (rect.bottom > window.innerHeight) {
            menuRef.current.style.top = `${y - rect.height}px`;
        }
    }, [x, y]);

    return createPortal(
        <div
            ref={menuRef}
            className="fixed z-[100010] min-w-[160px] py-1 rounded-lg bg-app-surface2 border border-glass-border shadow-[0_12px_48px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.06)]"
            style={{ left: x, top: y }}
        >
            {items.map((item, i) => {
                if (item.divider) {
                    return <div key={i} className="h-px bg-glass-border mx-1 my-0.5" />;
                }
                return (
                    <button
                        key={i}
                        onClick={() => { item.onClick(); onClose(); }}
                        className={clsx(
                            "w-full flex items-center gap-2 px-3 py-1.5 text-app-base font-medium transition-colors cursor-pointer text-left",
                            item.danger
                                ? "text-app-red hover:bg-app-red-dim"
                                : "text-app-text-sec hover:bg-glass-hover hover:text-app-text"
                        )}
                    >
                        {item.icon && <span className="w-4 text-center shrink-0 opacity-70">{item.icon}</span>}
                        {item.label}
                    </button>
                );
            })}
        </div>,
        document.body
    );
};
```

- [ ] **Step 2: Sidebar.tsxのContentTreeItem内プラン行にonContextMenuを追加**

ContentTreeItem内のプラン行（行283-381）の `<div role="button" ...>` に `onContextMenu` ハンドラを追加。

Sidebar コンポーネント本体にコンテキストメニュー状態を追加:
```typescript
const [contextMenu, setContextMenu] = useState<{
    x: number; y: number; planId: string; planTitle: string; contentId: string | null;
} | null>(null);
```

プラン行に追加:
```tsx
onContextMenu={(e) => {
    e.preventDefault();
    setContextMenu({
        x: e.clientX,
        y: e.clientY,
        planId: plan.id,
        planTitle: plan.title,
        contentId: plan.contentId,
    });
}}
```

Sidebar本体のJSXの末尾にContextMenuレンダリングを追加:
```tsx
{contextMenu && (
    <ContextMenu
        x={contextMenu.x}
        y={contextMenu.y}
        onClose={() => setContextMenu(null)}
        items={[
            {
                label: t('sidebar.context_share'),
                icon: <Share2 size={12} />,
                onClick: () => {
                    // 単一プランシェア: 既存のShareModal利用
                    const plan = plans.find(p => p.id === contextMenu.planId);
                    if (plan) {
                        setBundlePlansForModal([plan]);
                        setBundleModalOpen(true);
                    }
                },
            },
            {
                label: t('sidebar.context_duplicate'),
                icon: <Copy size={12} />,
                onClick: () => {
                    const newPlan = usePlanStore.getState().duplicatePlan(contextMenu.planId);
                    if (!newPlan) showToast(t('sidebar.duplicate_limit_reached'), 'error');
                },
            },
            {
                label: t('sidebar.context_rename'),
                icon: <Pencil size={12} />,
                onClick: () => {
                    // ContentTreeItem内のstartEditingを呼ぶ必要がある
                    // → contextMenu経由では難しいため、カスタムイベントで通知
                    window.dispatchEvent(new CustomEvent('sidebar:start-rename', {
                        detail: { planId: contextMenu.planId },
                    }));
                },
            },
            { divider: true, label: '', onClick: () => {} },
            {
                label: t('sidebar.context_delete'),
                icon: <Trash2 size={12} />,
                danger: true,
                onClick: () => {
                    const ps = usePlanStore.getState();
                    const authUser = useAuthStore.getState().user;
                    if (authUser) {
                        ps.deleteFromFirestore(contextMenu.planId, authUser.uid, contextMenu.contentId);
                    } else {
                        ps.deletePlan(contextMenu.planId);
                    }
                },
            },
        ]}
    />
)}
```

ContentTreeItem内でカスタムイベントをリッスンしてリネームを開始:
```typescript
React.useEffect(() => {
    const handleRename = (e: Event) => {
        const { planId } = (e as CustomEvent).detail;
        const plan = contentPlans.find(p => p.id === planId);
        if (plan) {
            setEditingPlanId(planId);
            setEditingTitle(plan.title);
            setTimeout(() => editInputRef.current?.select(), 0);
        }
    };
    window.addEventListener('sidebar:start-rename', handleRename);
    return () => window.removeEventListener('sidebar:start-rename', handleRename);
}, [contentPlans]);
```

- [ ] **Step 3: ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 4: コミット**

```bash
git add src/components/ui/ContextMenu.tsx src/components/Sidebar.tsx
git commit -m "feat: プラン行に右クリックコンテキストメニューを追加"
```

---

### Task 8: Shift+クリック複数選択を追加

**Files:**
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: ContentTreeItem内のプラン行クリックハンドラにShift検出を追加**

ContentTreeItemのプラン行のonClickハンドラ（行293-303）を修正:

```tsx
onClick={(e) => {
    if (e.shiftKey && !multiSelect.isEnabled) {
        // Shift+クリック → 複数選択モードに入りつつ選択
        setMultiSelect(prev => ({
            isEnabled: true,
            selectedIds: [...prev.selectedIds, plan.id].filter((v, i, a) => a.indexOf(v) === i),
            mode: 'share',
        }));
        return;
    }
    if (e.shiftKey && multiSelect.isEnabled) {
        // 既に複数選択モード中のShift+クリック → トグル
        onToggleSelect(plan.id);
        return;
    }
    // 通常クリック（既存ロジック）
    if (currentPlanId === plan.id) return;
    runTransition(() => {
        const store = usePlanStore.getState();
        const snap = useMitigationStore.getState().getSnapshot();
        if (store.currentPlanId) {
            store.updatePlan(store.currentPlanId, { data: snap });
        }
        useMitigationStore.getState().loadSnapshot(plan.data);
        store.setCurrentPlanId(plan.id);
    }, 'plan');
}}
```

ただし、ContentTreeItemにsetMultiSelectを渡す必要があるため、propsの追加が必要。またはSidebar本体でShiftキー状態を管理してcontextとして渡す。

ContentTreeItemProps に追加:
```typescript
onShiftSelect?: (planId: string) => void;
```

Sidebar本体からContentTreeItemに渡す:
```tsx
onShiftSelect={(planId) => {
    setMultiSelect(prev => ({
        isEnabled: true,
        selectedIds: prev.selectedIds.includes(planId)
            ? prev.selectedIds.filter(id => id !== planId)
            : [...prev.selectedIds, planId],
        mode: prev.mode || 'share',
    }));
}}
```

- [ ] **Step 2: ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat: Shift+クリックで複数選択モードに入る機能を追加"
```

---

### Task 9: アーカイブ切替時の再圧縮と起動時回収を実装

**Files:**
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/App.tsx` (または適切な初期化箇所)

- [ ] **Step 1: プラン切替時の再圧縮**

Sidebar.tsx内の `handleLoadPlan`（行1019-1041付近）およびプラン切替のrunTransitionコールバック内で、切替元プランがarchivedなら再圧縮する:

```typescript
// runTransitionコールバック内（プラン切替時）
const store = usePlanStore.getState();
const snap = useMitigationStore.getState().getSnapshot();
if (store.currentPlanId) {
    const currentPlan = store.plans.find(p => p.id === store.currentPlanId);
    store.updatePlan(store.currentPlanId, { data: snap });
    // アーカイブプランなら再圧縮
    if (currentPlan?.archived) {
        store.archivePlan(store.currentPlanId);
    }
}
```

- [ ] **Step 2: 起動時の未圧縮アーカイブ回収**

`src/App.tsx` のuseMasterDataInit()呼び出し付近に追加:

```typescript
// 起動時: archivedなのにdataが展開されているプランを再圧縮
useEffect(() => {
    usePlanStore.getState().recompressStaleArchives();
}, []);
```

- [ ] **Step 3: ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 4: コミット**

```bash
git add src/components/Sidebar.tsx src/App.tsx
git commit -m "feat: アーカイブプランの切替時再圧縮と起動時回収を実装"
```

---

### Task 10: 自動アーカイブダイアログを実装

**Files:**
- Create: `src/components/ArchivePromptModal.tsx`
- Modify: `src/App.tsx` (or relevant initialization file)

- [ ] **Step 1: ArchivePromptModalを作成**

```typescript
// src/components/ArchivePromptModal.tsx
import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';

interface ArchivePromptModalProps {
    isOpen: boolean;
    planCount: number;
    onArchive: () => void;
    onDismiss: () => void;
}

export const ArchivePromptModal: React.FC<ArchivePromptModalProps> = ({
    isOpen, planCount, onArchive, onDismiss,
}) => {
    const { t } = useTranslation();
    if (!isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4"
            onClick={onDismiss}
        >
            <div
                className="relative w-full max-w-[400px] glass-tier3 rounded-2xl overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                <div className="px-6 py-5 border-b border-glass-border/30 flex items-center justify-between bg-glass-header/30">
                    <h2 className="text-app-xl font-black text-app-text tracking-widest flex items-center gap-3 uppercase">
                        <span className="w-1.5 h-4 bg-app-toggle rounded-full" />
                        {t('sidebar.archive_confirm_title')}
                    </h2>
                    <button
                        onClick={onDismiss}
                        className="p-2 rounded-full text-app-text border border-transparent hover:bg-app-toggle hover:text-app-toggle-text hover:border-app-toggle transition-all duration-200 cursor-pointer active:scale-90"
                    >
                        <X size={18} />
                    </button>
                </div>
                <div className="p-6 space-y-3">
                    <p className="text-app-xl font-bold text-app-text text-center">
                        {t('sidebar.archive_confirm_message')}
                    </p>
                    <p className="text-app-md text-app-text-muted text-center">
                        {t('sidebar.archive_plan_count', { count: planCount })}
                    </p>
                </div>
                <div className="p-6 bg-glass-card/10 border-t border-glass-border/20 flex gap-4">
                    <button
                        onClick={onDismiss}
                        className="flex-1 py-3.5 rounded-2xl border border-glass-border/40 text-app-md font-black text-app-text hover:bg-glass-hover transition-all cursor-pointer uppercase tracking-widest active:scale-95"
                    >
                        {t('sidebar.archive_confirm_no')}
                    </button>
                    <button
                        onClick={onArchive}
                        className="flex-[2] py-3.5 rounded-2xl text-app-md font-black bg-app-toggle text-app-toggle-text hover:opacity-80 transition-all cursor-pointer uppercase tracking-[0.3em] active:scale-95"
                    >
                        {t('sidebar.archive_confirm_yes')}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
```

- [ ] **Step 2: App.tsxまたはSidebar.tsxに自動アーカイブ検知ロジックを追加**

新しいレベルのコンテンツが追加されたことを検知し、過去拡張の未アーカイブ零式プランがあればダイアログを表示:

```typescript
// Sidebar.tsx 内に追加
const [archivePrompt, setArchivePrompt] = useState<{ planIds: string[] } | null>(null);

useEffect(() => {
    const currentLevel = getCurrentExpansionLevel();
    const oldSavagePlans = plans.filter(p =>
        !p.archived &&
        p.category === 'savage' &&
        p.level !== undefined &&
        p.level < currentLevel
    );
    // localStorageに「確認済み」フラグを保存して再表示を防ぐ
    const dismissedKey = `archive-dismissed-${currentLevel}`;
    const dismissed = localStorage.getItem(dismissedKey);
    if (oldSavagePlans.length > 0 && !dismissed) {
        setArchivePrompt({ planIds: oldSavagePlans.map(p => p.id) });
    }
}, [plans]);
```

JSXにモーダルを追加:
```tsx
<ArchivePromptModal
    isOpen={archivePrompt !== null}
    planCount={archivePrompt?.planIds.length ?? 0}
    onArchive={async () => {
        if (archivePrompt) {
            await usePlanStore.getState().archivePlans(archivePrompt.planIds);
        }
        setArchivePrompt(null);
    }}
    onDismiss={() => {
        const currentLevel = getCurrentExpansionLevel();
        localStorage.setItem(`archive-dismissed-${currentLevel}`, 'true');
        setArchivePrompt(null);
    }}
/>
```

- [ ] **Step 3: i18nに不足キーを追加**

```json
"sidebar.archive_plan_count": "{{count}}件のプランが対象です"
```

- [ ] **Step 4: ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 5: コミット**

```bash
git add src/components/ArchivePromptModal.tsx src/components/Sidebar.tsx src/i18n/
git commit -m "feat: 拡張切替時の自動アーカイブ確認ダイアログを追加"
```

---

### Task 11: 不要コンポーネントの削除とクリーンアップ

**Files:**
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: SeriesAccordion, CategoryAccordion を削除**

Sidebar.tsx 内の以下を削除:
- `SeriesAccordion` コンポーネント定義（行426-539）
- `CategoryAccordion` コンポーネント定義（行559-609）
- `LEVEL_TIERS` 定数（行66）
- 未使用のimportを整理

- [ ] **Step 2: FreePlanSectionの利用状況を確認**

「その他」タブで引き続き使用しているため、FreePlanSectionは残す。ただしアーカイブプランを除外するフィルタを追加する（Task 4で既に対応済みの `p.archived` チェック）。

- [ ] **Step 3: ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 4: 全テスト実行**

Run: `npx vitest run`
Expected: 全テストパス

- [ ] **Step 5: コミット**

```bash
git add src/components/Sidebar.tsx
git commit -m "refactor: 不要になったSeriesAccordion/CategoryAccordionを削除"
```

---

### Task 12: アプリ全体のビルド確認とデプロイ準備

**Files:**
- 変更なし（検証のみ）

- [ ] **Step 1: npm run build**

Run: `npm run build`
Expected: ビルド成功、エラーなし

- [ ] **Step 2: 全テスト実行**

Run: `npx vitest run`
Expected: 全テストパス

- [ ] **Step 3: 開発サーバーで動作確認**

Run: `npm run dev`

確認項目:
1. 零式タブ: 最新ティアのコンテンツが表示される
2. 絶タブ: 全絶コンテンツがフラットに表示される
3. その他タブ: フリープランが表示される
4. アーカイブタブ: 空の状態が正しく表示される
5. コンテンツ行ホバーで「+」ボタンが表示される
6. プラン行右クリックでコンテキストメニューが表示される
7. Shift+クリックで複数選択モードに入る
8. 既存の複数選択ボタンも動作する
9. NewPlanModalからプラン作成後、正しいタブに切り替わる
10. チュートリアルが正常に動作する

- [ ] **Step 4: 最終コミット**

```bash
git add -A
git commit -m "chore: サイドバー大幅改修の最終調整"
```
