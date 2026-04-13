# endTime必須化 + プレビュー120fps化 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phase/LabelのendTimeを必須化してeffectiveEndTime計算を一掃し、プレビューをDOM直接操作で120fps化する

**Architecture:** 型変更 → マイグレーション拡張 → Store簡素化 → Timeline描画簡素化 → プレビューDOM直接化の順で段階的に実装。各タスクは独立してビルド可能。

**Tech Stack:** React 19, TypeScript, Zustand, Vitest

---

## ファイル構成

| ファイル | 変更種別 | 責務 |
|---------|---------|------|
| `src/types/index.ts` | 修正 | Phase/Label型のendTimeを必須化 |
| `src/utils/phaseMigration.ts` | 修正 | endTime補完ロジック追加 |
| `src/utils/labelMigration.ts` | 修正 | endTime補完ロジック追加 |
| `src/utils/__tests__/phaseMigration.test.ts` | 修正 | endTime補完テスト追加 |
| `src/utils/__tests__/labelMigration.test.ts` | 修正 | endTime補完テスト追加 |
| `src/store/useMitigationStore.ts` | 修正 | Storeアクション簡素化 |
| `src/components/Timeline.tsx` | 修正 | effectiveEndTime一掃 + プレビューDOM直接化 |
| `src/components/TimelineRow.tsx` | 修正 | previewEndTime prop削除 |
| `src/components/MobileTimelineRow.tsx` | 修正 | previewEndTime prop削除 |
| `src/index.css` | 修正 | .preview-highlightクラス追加 |

---

### Task 1: 型変更 — Phase/LabelのendTimeを必須化

**Files:**
- Modify: `src/types/index.ts:91-103`

- [ ] **Step 1: Phase型のendTimeを必須に変更**

```typescript
// src/types/index.ts L91-96
// Before:
export interface Phase {
    id: string;
    name: LocalizedString;
    startTime: number;
    endTime?: number;  // 未指定なら次のPhaseのstartTimeまで
}

// After:
export interface Phase {
    id: string;
    name: LocalizedString;
    startTime: number;
    endTime: number;
}
```

- [ ] **Step 2: Label型のendTimeを必須に変更**

```typescript
// src/types/index.ts L98-103
// Before:
export interface Label {
    id: string;
    name: LocalizedString;
    startTime: number;
    endTime?: number;  // 未指定なら次のLabelのstartTimeまたはフェーズ境界まで
}

// After:
export interface Label {
    id: string;
    name: LocalizedString;
    startTime: number;
    endTime: number;
}
```

- [ ] **Step 3: TypeScriptコンパイラでエラー箇所を確認**

Run: `npx tsc --noEmit 2>&1 | head -80`
Expected: 複数のコンパイルエラー（endTimeがundefinedになりうる箇所）。これらは以降のタスクで修正する。

- [ ] **Step 4: コミット**

```bash
git add src/types/index.ts
git commit -m "refactor: Phase/Label型のendTimeを必須に変更"
```

---

### Task 2: マイグレーション — phaseMigration.tsにendTime補完を追加

**Files:**
- Modify: `src/utils/phaseMigration.ts:32-52`
- Modify: `src/utils/__tests__/phaseMigration.test.ts`

- [ ] **Step 1: テストを書く — endTimeがないフェーズにendTimeが補完される**

```typescript
// src/utils/__tests__/phaseMigration.test.ts に追加

    it('endTimeがない新形式フェーズにendTimeを補完する', () => {
        const newFormat = [
            { id: 'p1', name: { ja: 'P1', en: 'P1' }, startTime: 0 },
            { id: 'p2', name: { ja: 'P2', en: 'P2' }, startTime: 60 },
            { id: 'p3', name: { ja: 'P3', en: 'P3' }, startTime: 120 },
        ];
        const result = migratePhases(newFormat);
        expect(result[0].endTime).toBe(60);   // 次のstartTime
        expect(result[1].endTime).toBe(120);   // 次のstartTime
        expect(result[2].endTime).toBe(121);   // 最後: startTime + 1（デフォルト）
    });

    it('既にendTimeがあるフェーズはそのまま維持する', () => {
        const newFormat = [
            { id: 'p1', name: { ja: 'P1', en: 'P1' }, startTime: 0, endTime: 50 },
            { id: 'p2', name: { ja: 'P2', en: 'P2' }, startTime: 60, endTime: 100 },
        ];
        const result = migratePhases(newFormat);
        expect(result[0].endTime).toBe(50);   // 既存値維持（空白許容）
        expect(result[1].endTime).toBe(100);   // 既存値維持
    });

    it('旧形式変換後もendTimeが補完される', () => {
        const legacy = [
            { id: 'p1', name: 'Phase 1', endTime: 60 },
            { id: 'p2', name: 'Phase 2', endTime: 120 },
        ];
        const result = migratePhases(legacy);
        expect(result[0].startTime).toBe(0);
        expect(result[0].endTime).toBe(60);    // 次のstartTime
        expect(result[1].startTime).toBe(60);
        expect(result[1].endTime).toBe(61);    // 最後: startTime + 1
    });
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/utils/__tests__/phaseMigration.test.ts`
Expected: 新しいテスト3件がFAIL（endTimeがundefined）

- [ ] **Step 3: ensurePhaseEndTimes関数を追加し、migratePhasesから呼び出す**

```typescript
// src/utils/phaseMigration.ts

/**
 * endTimeが未定義のフェーズにendTimeを補完する。
 * - 中間フェーズ: 次のフェーズのstartTime
 * - 最終フェーズ: startTime + 1（呼び出し元でfightDuration等を使って上書き可能）
 */
export function ensurePhaseEndTimes(phases: Phase[]): Phase[] {
    if (phases.length === 0) return [];
    const sorted = [...phases].sort((a, b) => a.startTime - b.startTime);
    return sorted.map((p, i) => {
        if (p.endTime !== undefined) return p;
        const next = sorted[i + 1];
        return { ...p, endTime: next ? next.startTime : p.startTime + 1 };
    });
}

// migratePhases関数を変更: 最後にensurePhaseEndTimesを通す

export function migratePhases(phases: any[]): Phase[] {
    if (phases.length === 0) return [];

    let result: Phase[];

    if (!isLegacyPhaseFormat(phases)) {
        result = phases.map(p => ({
            id: p.id,
            name: normalizePhaseName(p.name),
            startTime: p.startTime,
            ...(p.endTime !== undefined ? { endTime: p.endTime } : {}),
        }));
    } else {
        const sorted = [...phases].sort((a: any, b: any) => a.endTime - b.endTime);
        result = sorted.map((p: any, i: number) => ({
            id: p.id,
            name: normalizePhaseName(p.name),
            startTime: i === 0 ? 0 : sorted[i - 1].endTime,
        }));
    }

    return ensurePhaseEndTimes(result);
}
```

注意: `result`の一時的な型は`any[]`から`Phase`に変換される過程でendTimeが未定義の可能性がある。`ensurePhaseEndTimes`の入力型を`(Phase | Omit<Phase, 'endTime'> & { endTime?: number })[]`とするか、内部で`as any`を使って補完する。最もシンプルな方法:

```typescript
// ensurePhaseEndTimesの引数型をゆるくする
export function ensurePhaseEndTimes(phases: Array<Omit<Phase, 'endTime'> & { endTime?: number }>): Phase[] {
    if (phases.length === 0) return [];
    const sorted = [...phases].sort((a, b) => a.startTime - b.startTime);
    return sorted.map((p, i) => {
        if (p.endTime !== undefined) return p as Phase;
        const next = sorted[i + 1];
        return { ...p, endTime: next ? next.startTime : p.startTime + 1 } as Phase;
    });
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/utils/__tests__/phaseMigration.test.ts`
Expected: 全テストPASS

- [ ] **Step 5: 既存テストのexpectを更新（endTimeが付与されるようになったため）**

既存テスト `'新形式のデータはそのまま返す'` のexpectにendTimeを追加:

```typescript
    it('新形式のデータはそのまま返す', () => {
        const newFormat = [
            { id: 'p1', name: { ja: 'P1', en: 'P1' }, startTime: 0 },
            { id: 'p2', name: { ja: 'P2', en: 'P2' }, startTime: 60 },
        ];
        const result = migratePhases(newFormat);
        expect(result).toEqual([
            { id: 'p1', name: { ja: 'P1', en: 'P1' }, startTime: 0, endTime: 60 },
            { id: 'p2', name: { ja: 'P2', en: 'P2' }, startTime: 60, endTime: 61 },
        ]);
    });
```

同様に他の既存テストも、返り値にendTimeが含まれることを反映する。

- [ ] **Step 6: 全テスト通過を確認**

Run: `npx vitest run src/utils/__tests__/phaseMigration.test.ts`
Expected: 全テストPASS

- [ ] **Step 7: コミット**

```bash
git add src/utils/phaseMigration.ts src/utils/__tests__/phaseMigration.test.ts
git commit -m "feat: phaseMigrationにendTime補完ロジックを追加"
```

---

### Task 3: マイグレーション — labelMigration.tsにendTime補完を追加

**Files:**
- Modify: `src/utils/labelMigration.ts:19-60`
- Modify: `src/utils/__tests__/labelMigration.test.ts`

- [ ] **Step 1: テストを書く — ラベルにendTimeが補完される**

```typescript
// src/utils/__tests__/labelMigration.test.ts に追加

    it('生成されたラベルにendTimeが補完される', () => {
        const events: TEvent[] = [
            { id: 'e1', time: 0, name: { ja: 'A', en: 'A' }, damageType: 'magical', mechanicGroup: { ja: '開幕', en: 'Opener' } },
            { id: 'e2', time: 10, name: { ja: 'B', en: 'B' }, damageType: 'magical', mechanicGroup: { ja: '開幕', en: 'Opener' } },
            { id: 'e3', time: 20, name: { ja: 'C', en: 'C' }, damageType: 'magical', mechanicGroup: { ja: '展開', en: 'Spread' } },
        ];
        const result = migrateLabels(events, []);
        expect(result[0].endTime).toBe(20);   // 次のラベルのstartTime
        expect(result[1].endTime).toBe(21);   // 最後: startTime + 1
    });
```

テストファイルの`TPhase`型定義のendTimeも必須に更新:

```typescript
type TPhase = {
    id: string;
    name: { ja: string; en: string };
    startTime: number;
    endTime: number;
};
```

既存テスト `'フェーズ境界でラベルは区切る'` のphasesにもendTimeを追加:

```typescript
    it('フェーズ境界でラベルは区切る', () => {
        const phases: TPhase[] = [
            { id: 'p1', name: { ja: 'P1', en: 'P1' }, startTime: 0, endTime: 30 },
            { id: 'p2', name: { ja: 'P2', en: 'P2' }, startTime: 30, endTime: 60 },
        ];
        // ... 以下同じ
    });
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/utils/__tests__/labelMigration.test.ts`
Expected: endTimeのテストがFAIL

- [ ] **Step 3: ensureLabelEndTimes関数を追加し、migrateLabelsから呼び出す**

```typescript
// src/utils/labelMigration.ts

/**
 * endTimeが未定義のラベルにendTimeを補完する。
 * - 中間ラベル: 次のラベルのstartTime
 * - 最終ラベル: startTime + 1
 */
export function ensureLabelEndTimes(labels: Array<Omit<Label, 'endTime'> & { endTime?: number }>): Label[] {
    if (labels.length === 0) return [];
    const sorted = [...labels].sort((a, b) => a.startTime - b.startTime);
    return sorted.map((l, i) => {
        if (l.endTime !== undefined) return l as Label;
        const next = sorted[i + 1];
        return { ...l, endTime: next ? next.startTime : l.startTime + 1 } as Label;
    });
}

// migrateLabels関数の最後にensureLabelEndTimesを通す
export function migrateLabels(timelineEvents: TimelineEvent[], phases: Phase[]): Label[] {
    // ... 既存ロジック（変更なし）...

    return ensureLabelEndTimes(labels);  // ← 最終行を変更
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/utils/__tests__/labelMigration.test.ts`
Expected: 全テストPASS

- [ ] **Step 5: コミット**

```bash
git add src/utils/labelMigration.ts src/utils/__tests__/labelMigration.test.ts
git commit -m "feat: labelMigrationにendTime補完ロジックを追加"
```

---

### Task 4: Store簡素化 — useMitigationStore.tsのアクション修正

**Files:**
- Modify: `src/store/useMitigationStore.ts:233-578`

- [ ] **Step 1: loadSnapshotでendTime補完を適用**

`loadSnapshot`関数（L233-257）で、新形式のラベルにもendTime補完を適用する:

```typescript
// L239-242 を変更
const migratedPhases = migratePhases(snapshot.phases ?? []);
const labels: Label[] = isLegacyLabelFormat(snapshot as any)
    ? migrateLabels(snapshot.timelineEvents, migratedPhases)
    : ensureLabelEndTimes((snapshot as any).labels ?? []);
```

importに`ensureLabelEndTimes`を追加:
```typescript
import { migrateLabels, isLegacyLabelFormat, ensureLabelEndTimes } from '../utils/labelMigration';
```

注意: `migratePhases`は内部で`ensurePhaseEndTimes`を呼ぶので、フェーズ側は追加不要。ラベルの新形式パス（`isLegacyLabelFormat === false`の分岐）だけ`ensureLabelEndTimes`を通す。

- [ ] **Step 2: addPhaseを修正 — 新フェーズにendTimeを必ずセット**

```typescript
// L441-459
addPhase: (startTime, name) => {
    const exists = get().phases.some(p => p.startTime === startTime);
    if (exists) return;
    pushHistory();
    set((state) => {
        const sorted = [...state.phases].sort((a, b) => a.startTime - b.startTime);
        // 新フェーズの直後のフェーズを探す
        const nextPhase = sorted.find(p => p.startTime > startTime);
        const newPhase: Phase = {
            id: crypto.randomUUID(),
            name,
            startTime,
            endTime: nextPhase ? nextPhase.startTime : startTime + 1,
        };
        // 新フェーズの開始時刻で前フェーズのendTimeをクリップ
        const clippedPhases = state.phases.map(p => {
            if (p.endTime > startTime && p.startTime < startTime) {
                return { ...p, endTime: startTime };
            }
            return p;
        });
        return { phases: [...clippedPhases, newPhase].sort((a, b) => a.startTime - b.startTime) };
    });
},
```

- [ ] **Step 3: updatePhaseStartTimeを修正 — undefinedチェック削除**

```typescript
// L491-515
updatePhaseStartTime: (id, newStartTime) => {
    pushHistory();
    set((state) => {
        const phase = state.phases.find(p => p.id === id);
        if (!phase) return {};
        let final = Math.max(newStartTime, 0);
        final = Math.min(final, phase.endTime - 1);
        const oldStartTime = phase.startTime;
        const sorted = [...state.phases].sort((a, b) => a.startTime - b.startTime);
        const idx = sorted.findIndex(p => p.id === id);
        const prevPhase = idx > 0 ? sorted[idx - 1] : null;
        return {
            phases: state.phases.map(p => {
                if (p.id === id) return { ...p, startTime: final };
                if (prevPhase && p.id === prevPhase.id && final > oldStartTime) {
                    return { ...p, endTime: oldStartTime };
                }
                return p;
            })
        };
    });
},
```

変更点: `phase.endTime !== undefined`ガード削除、`p.endTime === undefined`条件削除。

- [ ] **Step 4: addLabelを修正 — 新ラベルにendTimeを必ずセット**

```typescript
// L517-532
addLabel: (startTime, name) => {
    const exists = get().labels.some(l => l.startTime === startTime);
    if (exists) return;
    pushHistory();
    set((state) => {
        const sorted = [...state.labels].sort((a, b) => a.startTime - b.startTime);
        const nextLabel = sorted.find(l => l.startTime > startTime);
        const newLabel: Label = {
            id: crypto.randomUUID(),
            name,
            startTime,
            endTime: nextLabel ? nextLabel.startTime : startTime + 1,
        };
        const clippedLabels = state.labels.map(l => {
            if (l.endTime > startTime && l.startTime < startTime) {
                return { ...l, endTime: startTime };
            }
            return l;
        });
        return { labels: [...clippedLabels, newLabel].sort((a, b) => a.startTime - b.startTime) };
    });
},
```

- [ ] **Step 5: updateLabelStartTimeを修正 — undefinedチェック削除**

```typescript
// L555-578
updateLabelStartTime: (id, newStartTime) => {
    pushHistory();
    set((state) => {
        const label = state.labels.find(l => l.id === id);
        if (!label) return {};
        let final = Math.max(newStartTime, 0);
        final = Math.min(final, label.endTime - 1);
        const oldStartTime = label.startTime;
        const sorted = [...state.labels].sort((a, b) => a.startTime - b.startTime);
        const idx = sorted.findIndex(l => l.id === id);
        const prevLabel = idx > 0 ? sorted[idx - 1] : null;
        return {
            labels: state.labels.map(l => {
                if (l.id === id) return { ...l, startTime: final };
                if (prevLabel && l.id === prevLabel.id && final > oldStartTime) {
                    return { ...l, endTime: oldStartTime };
                }
                return l;
            })
        };
    });
},
```

- [ ] **Step 6: TypeScriptビルド確認**

Run: `npx tsc --noEmit 2>&1 | head -40`
Expected: Storeのエラーが解消。残りはTimeline/TimelineRow関連のみ。

- [ ] **Step 7: コミット**

```bash
git add src/store/useMitigationStore.ts
git commit -m "refactor: StoreアクションをendTime必須に対応、undefinedチェック削除"
```

---

### Task 5: Timeline描画簡素化 — effectiveEndTime計算の一掃

**Files:**
- Modify: `src/components/Timeline.tsx:600,625,1024-1034,1074-1084,2327-2425`

- [ ] **Step 1: selectedPhase/selectedLabel型からoptionalを削除**

```typescript
// L600: selectedPhaseのendTimeを必須に
const [selectedPhase, setSelectedPhase] = useState<{ id: string; name: LocalizedString; startTime: number; endTime: number } | null>(null);

// L625: selectedLabelのendTimeを必須に
const [selectedLabel, setSelectedLabel] = useState<{ id: string; name: LocalizedString; startTime: number; endTime: number } | null>(null);
```

- [ ] **Step 2: handlePhaseEditを簡素化（箇所1）**

```typescript
// L1024-1034
const handlePhaseEdit = (phase: Phase, e: React.MouseEvent) => {
    e.stopPropagation();
    setPhaseModalPosition({ x: e.clientX, y: e.clientY });
    setSelectedPhase({ id: phase.id, name: phase.name, startTime: phase.startTime, endTime: phase.endTime });
    setIsPhaseModalOpen(true);
};
```

変更点: sorted/idx/nextPhase/effectiveEndTimeの計算を全削除。`phase.endTime`をそのまま使う。

- [ ] **Step 3: handleLabelEditを簡素化（箇所2）**

```typescript
// L1074-1084
const handleLabelEdit = (label: Label, e: React.MouseEvent) => {
    e.stopPropagation();
    setLabelModalPosition({ x: e.clientX, y: e.clientY });
    setSelectedLabel({ id: label.id, name: label.name, startTime: label.startTime, endTime: label.endTime });
    setIsLabelModalOpen(true);
};
```

変更点: sorted/idx/nextLabel/effectiveEndTimeの計算を全削除。

- [ ] **Step 4: フェーズ描画オーバーレイを簡素化（箇所3）**

```typescript
// L2334-2337 を置き換え
// Before:
const endTime = phase.endTime !== undefined
    ? Math.min(phase.endTime + 1, nextPhase?.startTime ?? Infinity)
    : nextPhase?.startTime ?? (Math.max(...timelineEvents.map(e => e.time), 0) + 10);

// After:
const endTime = phase.endTime + 1;
```

`nextPhase`変数はもう使わないので、宣言も削除可能（ただし他で使っていないか確認）。

- [ ] **Step 5: ラベル描画オーバーレイを簡素化（箇所4）**

```typescript
// L2383-2386 を置き換え
// Before:
const effectiveEndTime = label.endTime !== undefined
    ? Math.min(label.endTime + 1, nextLabel?.startTime ?? Infinity)
    : nextLabel?.startTime ?? (gridLines[gridLines.length - 1] ?? label.startTime + 1);

// After:
const effectiveEndTime = label.endTime + 1;
```

- [ ] **Step 6: TypeScriptビルド確認**

Run: `npx tsc --noEmit 2>&1 | head -40`
Expected: Timeline.tsxのendTime関連エラーが解消。残りはTimelineRow/MobileTimelineRow関連のみ。

- [ ] **Step 7: コミット**

```bash
git add src/components/Timeline.tsx
git commit -m "refactor: Timeline.tsxのeffectiveEndTime計算5箇所を簡素化"
```

---

### Task 6: プレビュー120fps化 — CSSクラス追加

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: .preview-highlightクラスを追加**

`src/index.css`の適切な位置（他のタイムライン関連スタイルの近く）に追加:

```css
/* タイムライン選択プレビュー — DOM直接操作でクラスを付与 */
/* デスクトップ: フェーズ/ラベル列を個別にハイライト */
.phase-select-preview .preview-highlight [data-phase-col] {
    background-color: rgba(59, 130, 246, 0.1);
}
.label-select-preview .preview-highlight [data-label-col] {
    background-color: rgba(59, 130, 246, 0.1);
}
/* モバイル: カード全体をハイライト */
@media (max-width: 767px) {
    .phase-select-preview .preview-highlight[data-time-row],
    .label-select-preview .preview-highlight[data-time-row] {
        background-color: rgba(59, 130, 246, 0.1);
    }
}
```

コンテナに`.phase-select-preview`/`.label-select-preview`クラスを付与することで、CSSだけでフェーズ選択とラベル選択を区別する。`data-phase-col`/`data-label-col`属性は次のタスクでTimelineRowに追加する。

- [ ] **Step 2: コミット**

```bash
git add src/index.css
git commit -m "style: プレビューハイライト用CSSクラスを追加"
```

---

### Task 7: プレビュー120fps化 — TimelineRow/MobileTimelineRowからpreviewEndTimeを削除

**Files:**
- Modify: `src/components/TimelineRow.tsx:58-63,131,165-177,181-246,649-662`
- Modify: `src/components/MobileTimelineRow.tsx:32-36,119,156-168,231-235,348-364`

- [ ] **Step 1: TimelineRowからpreviewEndTime関連を削除**

propsインターフェース（L58-63）から`previewEndTime`を削除:
```typescript
    timelineSelectMode?: { phaseId: string; startTime: number } | null;
    labelSelectMode?: { labelId: string; startTime: number } | null;
    // previewEndTime を削除
    onTimelineSelect?: (time: number) => void;
    onTimelineSelectHover?: (time: number) => void;
```

コンポーネント本体（L131付近）のdestructuringから`previewEndTime`を削除。

`isHighlighted`/`isLabelHighlighted`計算（L165-177）を削除。

フェーズ列のdivに`data-phase-col`属性を追加（L203付近）:
```typescript
<div
    data-phase-col
    className={clsx(
        "md:w-[60px] border-r h-full relative items-center justify-center group-hover:text-app-text",
        "border-app-border",
        "md:cursor-pointer md:hover:bg-app-surface2",
        hasPhases ? "w-[24px] flex" : "w-[24px] hidden md:flex",
        // isHighlighted && "bg-app-blue/10" ← 削除
    )}
```

ラベル列のdivに`data-label-col`属性を追加（L240付近）:
```typescript
<div
    data-label-col
    className={clsx(
        // ...
        // isLabelHighlighted && "bg-app-blue/10" ← 削除
    )}
```

React.memoの比較関数（L649-662）はpreviewEndTimeを元々チェックしていないので変更不要。

- [ ] **Step 2: MobileTimelineRowからpreviewEndTime関連を削除**

propsインターフェース（L32-36）から`previewEndTime`を削除。

コンポーネント本体（L119付近）のdestructuringから`previewEndTime`を削除。

`isHighlighted`/`isLabelHighlighted`計算（L156-168）を削除。

`data-time-row`のあるdiv（L231付近）から`isHighlighted`/`isLabelHighlighted`のクラス適用を削除:
```typescript
className={clsx(
    // ...
    // (isHighlighted || isLabelHighlighted) && "bg-app-blue/10", ← 削除
    (timelineSelectMode || labelSelectMode) && "cursor-pointer",
)}
```

フェーズ列に`data-phase-col`、ラベル列に`data-label-col`属性を追加（MobileTimelineRow内の該当divに）。

- [ ] **Step 3: TypeScriptビルド確認**

Run: `npx tsc --noEmit 2>&1 | head -40`
Expected: previewEndTimeをまだTimelineから渡している箇所でエラー（次タスクで修正）

- [ ] **Step 4: コミット**

```bash
git add src/components/TimelineRow.tsx src/components/MobileTimelineRow.tsx
git commit -m "perf: TimelineRow/MobileTimelineRowからpreviewEndTime依存を削除"
```

---

### Task 8: プレビュー120fps化 — Timeline.tsxをDOM直接操作に切り替え

**Files:**
- Modify: `src/components/Timeline.tsx:604-621,2190-2313,2427-2456`

- [ ] **Step 1: previewEndTime stateをrefに置き換え、DOM操作関数を追加**

L604-621を以下に置き換え:

```typescript
    const previewEndTimeRef = useRef<number | null>(null);
    const previewRafRef = useRef<number | null>(null);
    const overlayRef = useRef<HTMLDivElement>(null);

    /** DOM直接操作でプレビューハイライトを更新（React再レンダリングなし） */
    const updatePreviewHighlight = useCallback((time: number | null) => {
        const container = scrollContainerRef.current;
        if (!container) return;

        // 前回のハイライトをクリア
        const highlighted = container.querySelectorAll('.preview-highlight');
        for (let i = 0; i < highlighted.length; i++) {
            highlighted[i].classList.remove('preview-highlight');
        }

        if (time === null || (!timelineSelectMode && !labelSelectMode)) {
            if (overlayRef.current) overlayRef.current.style.display = 'none';
            container.classList.remove('phase-select-preview', 'label-select-preview');
            return;
        }

        // コンテナにモード識別クラスを付与（CSS側でフェーズ/ラベル列を区別）
        container.classList.remove('phase-select-preview', 'label-select-preview');
        container.classList.add(timelineSelectMode ? 'phase-select-preview' : 'label-select-preview');

        const mode = timelineSelectMode || labelSelectMode!;
        const min = Math.min(mode.startTime, time);
        const max = Math.max(mode.startTime, time);

        // 範囲内の行にpreview-highlightクラスを付与
        const rows = container.querySelectorAll('[data-time-row]');
        for (let i = 0; i < rows.length; i++) {
            const t = Number(rows[i].getAttribute('data-time-row'));
            if (t >= min && t <= max) {
                rows[i].classList.add('preview-highlight');
            }
        }

        // オーバーレイ位置を直接更新
        if (overlayRef.current && timeToYMapRef.current) {
            const tMap = timeToYMapRef.current;
            const offsetTime = showPreStart ? -10 : 0;
            const pxPerSec = pixelsPerSecond;
            const startTime = Math.max(Math.min(mode.startTime, time), offsetTime);
            const endTime = Math.max(Math.max(mode.startTime, time) + 1, offsetTime);
            const startY = tMap.get(startTime) ?? (Math.max(0, startTime - offsetTime) * pxPerSec);
            const endY = tMap.get(endTime) ?? (Math.max(0, endTime - offsetTime) * pxPerSec);
            const height = Math.max(0, endY - startY);
            overlayRef.current.style.top = `${startY}px`;
            overlayRef.current.style.height = `${height}px`;
            overlayRef.current.style.display = height > 0 ? '' : 'none';
        }
    }, [timelineSelectMode, labelSelectMode, showPreStart, pixelsPerSecond]);

    const throttledUpdatePreview = useCallback((time: number | null) => {
        previewEndTimeRef.current = time;
        if (time === null) {
            if (previewRafRef.current !== null) {
                cancelAnimationFrame(previewRafRef.current);
                previewRafRef.current = null;
            }
            updatePreviewHighlight(null);
            return;
        }
        if (previewRafRef.current === null) {
            previewRafRef.current = requestAnimationFrame(() => {
                updatePreviewHighlight(previewEndTimeRef.current);
                previewRafRef.current = null;
            });
        }
    }, [updatePreviewHighlight]);
```

削除するもの:
- `const [previewEndTime, setPreviewEndTime] = useState<number | null>(null);`
- `const throttledSetPreviewEndTime = useCallback(...)` 全体

- [ ] **Step 2: TimelineRow/MobileTimelineRowへのpreviewEndTime props渡しを削除**

L2211, L2234, L2258, L2286の `previewEndTime={previewEndTime}` を全て削除。

L2308-2311のhoverハンドラを更新:
```typescript
// Before:
onTimelineSelectHover={(time) => {
    if (timelineSelectMode || labelSelectMode) {
        throttledSetPreviewEndTime(time);
    }
}}

// After:
onTimelineSelectHover={(time) => {
    if (timelineSelectMode || labelSelectMode) {
        throttledUpdatePreview(time);
    }
}}
```

L2191のモバイルhoverハンドラも同様に更新:
```typescript
// Before:
const mobileHoverHandler = (time: number) => {
    if (timelineSelectMode || labelSelectMode) throttledSetPreviewEndTime(time);
};

// After:
const mobileHoverHandler = (time: number) => {
    if (timelineSelectMode || labelSelectMode) throttledUpdatePreview(time);
};
```

- [ ] **Step 3: setPreviewEndTime(null)の呼び出しをthrottledUpdatePreview(null)に置き換え**

選択確定時のクリーンアップ（L2295, L2305付近）:
```typescript
// Before:
setPreviewEndTime(null);

// After:
throttledUpdatePreview(null);
```

該当箇所を`setPreviewEndTime`でgrep → 全て`throttledUpdatePreview(null)`に置き換え。

- [ ] **Step 4: ハイライトオーバーレイをrefベース常時レンダリングに変更**

L2427-2456の条件付きレンダリングを、常時表示のrefベースdivに置き換え:

```typescript
// Before: (timelineSelectMode || labelSelectMode) && previewEndTime !== null && (() => { ... })()

// After: 常時レンダリング、display: noneで非表示制御
<div
    ref={overlayRef}
    className={clsx(
        "absolute pointer-events-none z-20 border-2 border-app-blue bg-app-blue/10 rounded-sm",
        labelSelectMode
            ? (phases.length > 0 ? "hidden md:block left-[60px] w-[50px]" : "left-0 w-[24px] md:left-[60px] md:w-[50px]")
            : "left-0 w-[24px] md:w-[60px]"
    )}
    style={{ display: 'none' }}
/>
```

注意: `labelSelectMode`のクラス切り替えはReactレンダリング時に適用される。selectMode開始時にレンダリングが走るのでこれでOK（ホバー中はDOM直接操作）。

- [ ] **Step 5: TypeScriptビルド確認**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: エラー0件

- [ ] **Step 6: フルビルド確認**

Run: `npm run build 2>&1 | tail -20`
Expected: ビルド成功

- [ ] **Step 7: テスト実行**

Run: `npx vitest run`
Expected: 全テストPASS

- [ ] **Step 8: コミット**

```bash
git add src/components/Timeline.tsx
git commit -m "perf: プレビューをDOM直接操作に切り替え、React再レンダリングを完全排除"
```

---

### Task 9: 動作確認 + クリーンアップ

**Files:**
- 全変更ファイル（最終確認）

- [ ] **Step 1: フルビルド + テスト**

Run: `npm run build && npx vitest run`
Expected: ビルド成功、全テストPASS

- [ ] **Step 2: 開発サーバーで動作確認**

Run: `npm run dev`

確認項目:
1. フェーズの開始/終了時間選択モード → ホバーでプレビューハイライトが即座に追従する
2. ラベルの開始/終了時間選択モード → 同上
3. フェーズ/ラベルの描画（色付き帯）が正しく表示される
4. 空白期間（フェーズ間の隙間）が正しく表現される
5. 既存プランの読み込み → endTimeが自動補完される
6. 新規フェーズ/ラベルの追加 → endTimeが正しくセットされる
7. フェーズ/ラベルの削除 → 問題なし
8. モバイル表示 → ハイライト動作確認

- [ ] **Step 3: 不要になったコードがないか最終確認**

grepで確認:
- `effectiveEndTime`の残存 → 箇所5（軽減コンパクト表示）以外にないこと
- `previewEndTime`の残存 → refのみ、stateやpropsにないこと
- `endTime?`や`endTime !== undefined`の残存 → 型変更で不要になったチェックがないこと

- [ ] **Step 4: TODO.mdを更新**

`docs/TODO.md`の「フェーズ/ラベルのendTime必須化リファクタ」セクションを完了に移動。

- [ ] **Step 5: 最終コミット**

```bash
git add docs/TODO.md
git commit -m "docs: endTime必須化リファクタ完了をTODOに反映"
```
