# フェーズ/ラベル隣接規約の本質的修正 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** フェーズ/ラベルの隣接規約を「`endTime === next.startTime`」から「`endTime + 1 === next.startTime`」に変更し、描画仕様（`endTime + 1 = 次行先頭` inclusive）と整合させる。境界の罫線が消える既存バグを根本解消。

**Architecture:** データ規約の変更 + 既存データの自動修復。描画ロジック（Timeline.tsx）は無変更で温存。追従更新時、ユーザーが指定した値は尊重し、追従される側が `±1` ずれる。既存 Firestore データは `loadSnapshot` で自動修復。

**Tech Stack:** TypeScript / Zustand / vitest / React

---

## 背景

### 現状の問題

1. **描画仕様**（Timeline.tsx:2509-2510, 2557-2558）: `endTime` は inclusive（その行を含む）→ 描画時 `endTime + 1` して次行の先頭まで伸ばす
2. **データ規約**（addPhase / addLabel / 4 update 関数）: 隣接時 `endTime === next.startTime`
3. **結果**: 描画上 1 行オーバーラップ。sort 順で `next` が後に描画され、`phase1` の下辺罫線が `phase2` の背景に覆われて消える

### 再現手順
- 新規プランで 0:04 をクリック → Phase 1 追加
- 0:16 をクリック → Phase 2 追加
- addPhase の clippedPhases で phase1.endTime = 16 に更新 → phase1.endTime === phase2.startTime === 16
- Phase 1 と Phase 2 の境界の罫線が見えない

### 正しい規約

**`phase1.endTime + 1 === phase2.startTime`**

- ユーザーが指定した値は尊重
- 追従される側が `±1` ずれる
  - EndTime を後ろへ動かす → `next.startTime = final + 1`
  - StartTime を前へ動かす → `prev.endTime = final - 1`

---

## ファイル構造

### 修正ファイル
| ファイル | 責務 | 変更内容 |
|---|---|---|
| `src/store/useMitigationStore.ts` | フェーズ/ラベルの追加・編集 | addPhase / addLabel / updatePhase*Time / updateLabel*Time 書き換え |
| `src/utils/phaseMigration.ts` | フェーズのマイグレーション | `ensurePhaseEndTimes` の次フェーズ基準 / 新規 `repairAdjacentPhaseBoundaries` 関数 |
| `src/utils/labelMigration.ts` | ラベルのマイグレーション | `ensureLabelEndTimes` の次ラベル基準 / 新規 `repairAdjacentLabelBoundaries` 関数 |
| `src/store/useMitigationStore.ts` (loadSnapshot) | プラン読み込み | 修復関数の追加呼び出し |

### 新規テストファイル
| ファイル | 内容 |
|---|---|
| （既存更新）`src/store/__tests__/useMitigationStore.boundary.test.ts` | 19 ケースの期待値更新 + addPhase / addLabel のケース追加 |
| （既存更新）`src/utils/__tests__/phaseMigration.test.ts` | ensurePhaseEndTimes の期待値更新、repair 関数テスト追加 |
| （既存更新）`src/utils/__tests__/labelMigration.test.ts` | ensureLabelEndTimes の期待値更新、repair 関数テスト追加 |

### 変更不要
- `src/components/Timeline.tsx` — 描画ロジックは温存
- `src/components/BoundaryEditModal.tsx` — UI 側制限なし

---

## Task 1: 新規隣接規約の boundary テストを更新（Red）

**Files:**
- Modify: `src/store/__tests__/useMitigationStore.boundary.test.ts`

**仕様変更点（既存テストの期待値）**:
- `updatePhaseEndTime` 衝突時: `next.startTime = final + 1`（旧: `= final`）
- `updatePhaseEndTime` 最大: `next.endTime - 2`（旧: `next.endTime - 1`、次が潰れないよう最低幅 1 秒）
- `updatePhaseStartTime` 衝突時: `prev.endTime = final - 1`（旧: `= final`）
- `updatePhaseStartTime` 最小: `prev.startTime + 2`（旧: `prev.startTime + 1`）
- 同じくラベルも

- [ ] **Step 1: 既存テストの期待値を新規約に書き換え**

以下の該当箇所を書き換える（該当行番号は目安）:

**updatePhaseEndTime / 衝突あり**:
```typescript
it('次フェーズと衝突したら、次フェーズの startTime が final+1 に追従する', () => {
    setPhases([makePhase('p1', 0, 30), makePhase('p2', 60, 100)]);
    useMitigationStore.getState().updatePhaseEndTime('p1', 80);
    const phases = useMitigationStore.getState().phases;
    expect(phases.find(p => p.id === 'p1')!.endTime).toBe(80);
    expect(phases.find(p => p.id === 'p2')!.startTime).toBe(81);
    expect(phases.find(p => p.id === 'p2')!.endTime).toBe(100);
});

it('次フェーズを潰す範囲まで延ばすと、次フェーズの endTime - 2 で止まる', () => {
    setPhases([makePhase('p1', 0, 30), makePhase('p2', 60, 100)]);
    useMitigationStore.getState().updatePhaseEndTime('p1', 200);
    const phases = useMitigationStore.getState().phases;
    expect(phases.find(p => p.id === 'p1')!.endTime).toBe(98);
    expect(phases.find(p => p.id === 'p2')!.startTime).toBe(99);
    expect(phases.find(p => p.id === 'p2')!.endTime).toBe(100);
});
```

**updatePhaseStartTime / 衝突あり**:
```typescript
it('前フェーズと衝突したら、前フェーズの endTime が final-1 に追従する', () => {
    setPhases([makePhase('p1', 0, 50), makePhase('p2', 60, 100)]);
    useMitigationStore.getState().updatePhaseStartTime('p2', 30);
    const phases = useMitigationStore.getState().phases;
    expect(phases.find(p => p.id === 'p2')!.startTime).toBe(30);
    expect(phases.find(p => p.id === 'p1')!.endTime).toBe(29);
    expect(phases.find(p => p.id === 'p1')!.startTime).toBe(0);
});

it('前フェーズを潰す範囲まで戻すと、前フェーズの startTime + 2 で止まる', () => {
    setPhases([makePhase('p1', 20, 50), makePhase('p2', 60, 100)]);
    useMitigationStore.getState().updatePhaseStartTime('p2', 5);
    const phases = useMitigationStore.getState().phases;
    expect(phases.find(p => p.id === 'p2')!.startTime).toBe(22);
    expect(phases.find(p => p.id === 'p1')!.endTime).toBe(21);
    expect(phases.find(p => p.id === 'p1')!.startTime).toBe(20);
});
```

**updateLabelEndTime / 衝突あり**:
```typescript
it('次ラベルと衝突したら、次ラベルの startTime が final+1 に追従する', () => {
    setLabels([makeLabel('l1', 0, 30), makeLabel('l2', 60, 100)]);
    useMitigationStore.getState().updateLabelEndTime('l1', 80);
    const labels = useMitigationStore.getState().labels;
    expect(labels.find(l => l.id === 'l1')!.endTime).toBe(80);
    expect(labels.find(l => l.id === 'l2')!.startTime).toBe(81);
    expect(labels.find(l => l.id === 'l2')!.endTime).toBe(100);
});

it('次ラベルを潰す範囲まで延ばすと、次ラベルの endTime - 2 で止まる', () => {
    setLabels([makeLabel('l1', 0, 30), makeLabel('l2', 60, 100)]);
    useMitigationStore.getState().updateLabelEndTime('l1', 200);
    const labels = useMitigationStore.getState().labels;
    expect(labels.find(l => l.id === 'l1')!.endTime).toBe(98);
    expect(labels.find(l => l.id === 'l2')!.startTime).toBe(99);
});
```

**updateLabelStartTime / 衝突あり**:
```typescript
it('前ラベルと衝突したら、前ラベルの endTime が final-1 に追従する', () => {
    setLabels([makeLabel('l1', 0, 50), makeLabel('l2', 60, 100)]);
    useMitigationStore.getState().updateLabelStartTime('l2', 30);
    const labels = useMitigationStore.getState().labels;
    expect(labels.find(l => l.id === 'l2')!.startTime).toBe(30);
    expect(labels.find(l => l.id === 'l1')!.endTime).toBe(29);
});

it('前ラベルを潰す範囲まで戻すと、前ラベルの startTime + 2 で止まる', () => {
    setLabels([makeLabel('l1', 20, 50), makeLabel('l2', 60, 100)]);
    useMitigationStore.getState().updateLabelStartTime('l2', 5);
    const labels = useMitigationStore.getState().labels;
    expect(labels.find(l => l.id === 'l2')!.startTime).toBe(22);
    expect(labels.find(l => l.id === 'l1')!.endTime).toBe(21);
});
```

- [ ] **Step 2: addPhase / addLabel のテストケースを末尾に追加**

```typescript
describe('addPhase', () => {
    beforeEach(() => {
        useMitigationStore.setState({
            phases: [],
            labels: [],
            timelineEvents: [],
            _history: [],
            _future: [],
        });
    });

    it('新規フェーズを 2 個追加したとき、前フェーズの endTime + 1 === 次の startTime になる', () => {
        useMitigationStore.getState().addPhase(4, { ja: 'Phase 1', en: 'Phase 1' });
        useMitigationStore.getState().addPhase(16, { ja: 'Phase 2', en: 'Phase 2' });
        const phases = useMitigationStore.getState().phases;
        expect(phases).toHaveLength(2);
        const p1 = phases.find(p => (p.name as any).ja === 'Phase 1')!;
        const p2 = phases.find(p => (p.name as any).ja === 'Phase 2')!;
        expect(p1.endTime + 1).toBe(p2.startTime);
        expect(p1.endTime).toBe(15);
        expect(p2.startTime).toBe(16);
    });
});

describe('addLabel', () => {
    beforeEach(() => {
        useMitigationStore.setState({
            phases: [],
            labels: [],
            timelineEvents: [],
            _history: [],
            _future: [],
        });
    });

    it('新規ラベルを 2 個追加したとき、前ラベルの endTime + 1 === 次の startTime になる', () => {
        useMitigationStore.getState().addLabel(4, { ja: 'L1', en: 'L1' });
        useMitigationStore.getState().addLabel(16, { ja: 'L2', en: 'L2' });
        const labels = useMitigationStore.getState().labels;
        expect(labels).toHaveLength(2);
        const l1 = labels.find(l => (l.name as any).ja === 'L1')!;
        const l2 = labels.find(l => (l.name as any).ja === 'L2')!;
        expect(l1.endTime + 1).toBe(l2.startTime);
        expect(l1.endTime).toBe(15);
        expect(l2.startTime).toBe(16);
    });
});
```

- [ ] **Step 3: テストを実行して落ちることを確認**

Run: `npx vitest run src/store/__tests__/useMitigationStore.boundary.test.ts`
Expected: 上記の新 assertion が全て FAIL（実装がまだ旧規約のため）

---

## Task 2: `updatePhaseEndTime` / `updatePhaseStartTime` の追従ロジック書き換え

**Files:**
- Modify: `src/store/useMitigationStore.ts` (`updatePhaseEndTime` / `updatePhaseStartTime`)

- [ ] **Step 1: updatePhaseEndTime を書き換え**

置換対象（現在の実装全体）:

```typescript
updatePhaseEndTime: (id, newEndTime) => {
    pushHistory();
    set((state) => {
        const sorted = [...state.phases].sort((a, b) => a.startTime - b.startTime);
        const idx = sorted.findIndex(p => p.id === id);
        if (idx < 0) return {};
        const self = sorted[idx];
        const nextPhase = sorted[idx + 1];
        let final = Math.max(newEndTime, self.startTime + 1);
        if (nextPhase && final >= nextPhase.startTime) {
            // 次フェーズの最低幅 1 秒確保: newNextStart = final + 1 ≤ next.endTime - 1
            // → final ≤ next.endTime - 2
            final = Math.min(final, nextPhase.endTime - 2);
            return {
                phases: state.phases.map(p => {
                    if (p.id === id) return { ...p, endTime: final };
                    if (p.id === nextPhase.id) return { ...p, startTime: final + 1 };
                    return p;
                })
            };
        }
        return {
            phases: state.phases.map(p => p.id === id ? { ...p, endTime: final } : p)
        };
    });
},
```

**変更点**:
- 衝突判定: `final > nextPhase.startTime` → `final >= nextPhase.startTime`（等号も衝突として扱う、新規約は +1 のずれが必要）
- 最大上限: `nextPhase.endTime - 1` → `nextPhase.endTime - 2`
- 追従: `nextPhase.startTime = final` → `nextPhase.startTime = final + 1`

- [ ] **Step 2: updatePhaseStartTime を書き換え**

```typescript
updatePhaseStartTime: (id, newStartTime) => {
    pushHistory();
    set((state) => {
        const sorted = [...state.phases].sort((a, b) => a.startTime - b.startTime);
        const idx = sorted.findIndex(p => p.id === id);
        if (idx < 0) return {};
        const self = sorted[idx];
        const prevPhase = idx > 0 ? sorted[idx - 1] : null;
        let final = Math.max(newStartTime, 0);
        final = Math.min(final, self.endTime - 1);
        if (prevPhase && final <= prevPhase.endTime) {
            // 前フェーズの最低幅 1 秒確保: newPrevEnd = final - 1 ≥ prev.startTime + 1
            // → final ≥ prev.startTime + 2
            final = Math.max(final, prevPhase.startTime + 2);
            return {
                phases: state.phases.map(p => {
                    if (p.id === id) return { ...p, startTime: final };
                    if (p.id === prevPhase.id) return { ...p, endTime: final - 1 };
                    return p;
                })
            };
        }
        return {
            phases: state.phases.map(p => p.id === id ? { ...p, startTime: final } : p)
        };
    });
},
```

**変更点**:
- 衝突判定: `final < prevPhase.endTime` → `final <= prevPhase.endTime`
- 最小下限: `prevPhase.startTime + 1` → `prevPhase.startTime + 2`
- 追従: `prevPhase.endTime = final` → `prevPhase.endTime = final - 1`

- [ ] **Step 3: テスト実行（前半で書き換えた phase 関連テストの pass を確認）**

Run: `npx vitest run src/store/__tests__/useMitigationStore.boundary.test.ts -t updatePhase`
Expected: phase 関連全 PASS

---

## Task 3: `updateLabelEndTime` / `updateLabelStartTime` の追従ロジック書き換え

**Files:**
- Modify: `src/store/useMitigationStore.ts` (`updateLabelEndTime` / `updateLabelStartTime`)

- [ ] **Step 1: updateLabelEndTime を書き換え**

```typescript
updateLabelEndTime: (id, newEndTime) => {
    pushHistory();
    set((state) => {
        const sorted = [...state.labels].sort((a, b) => a.startTime - b.startTime);
        const idx = sorted.findIndex(l => l.id === id);
        if (idx < 0) return {};
        const self = sorted[idx];
        const nextLabel = sorted[idx + 1];
        let final = Math.max(newEndTime, self.startTime + 1);
        if (nextLabel && final >= nextLabel.startTime) {
            final = Math.min(final, nextLabel.endTime - 2);
            return {
                labels: state.labels.map(l => {
                    if (l.id === id) return { ...l, endTime: final };
                    if (l.id === nextLabel.id) return { ...l, startTime: final + 1 };
                    return l;
                })
            };
        }
        return {
            labels: state.labels.map(l => l.id === id ? { ...l, endTime: final } : l)
        };
    });
},
```

- [ ] **Step 2: updateLabelStartTime を書き換え**

```typescript
updateLabelStartTime: (id, newStartTime) => {
    pushHistory();
    set((state) => {
        const sorted = [...state.labels].sort((a, b) => a.startTime - b.startTime);
        const idx = sorted.findIndex(l => l.id === id);
        if (idx < 0) return {};
        const self = sorted[idx];
        const prevLabel = idx > 0 ? sorted[idx - 1] : null;
        let final = Math.max(newStartTime, 0);
        final = Math.min(final, self.endTime - 1);
        if (prevLabel && final <= prevLabel.endTime) {
            final = Math.max(final, prevLabel.startTime + 2);
            return {
                labels: state.labels.map(l => {
                    if (l.id === id) return { ...l, startTime: final };
                    if (l.id === prevLabel.id) return { ...l, endTime: final - 1 };
                    return l;
                })
            };
        }
        return {
            labels: state.labels.map(l => l.id === id ? { ...l, startTime: final } : l)
        };
    });
},
```

- [ ] **Step 3: テスト実行**

Run: `npx vitest run src/store/__tests__/useMitigationStore.boundary.test.ts -t updateLabel`
Expected: label 関連全 PASS

---

## Task 4: `addPhase` / `addLabel` の clippedPhases / clippedLabels を新規約に書き換え

**Files:**
- Modify: `src/store/useMitigationStore.ts` (`addPhase` / `addLabel`)

- [ ] **Step 1: addPhase を書き換え**

```typescript
addPhase: (startTime, name) => {
    const exists = get().phases.some(p => p.startTime === startTime);
    if (exists) return;
    pushHistory();
    set((state) => {
        const sorted = [...state.phases].sort((a, b) => a.startTime - b.startTime);
        const nextPhase = sorted.find(p => p.startTime > startTime);
        const containingPhase = sorted.find(p => p.startTime <= startTime && p.endTime >= startTime);
        const prevPhase = sorted.slice().reverse().find(p => p.startTime < startTime && p.endTime < startTime);
        let endTime: number;
        if (nextPhase) {
            endTime = nextPhase.startTime - 1;
        } else if (containingPhase) {
            endTime = containingPhase.endTime;
        } else {
            const maxEventTime = state.timelineEvents.reduce((max, e) => Math.max(max, e.time), 0);
            endTime = Math.max(maxEventTime, startTime + 1);
        }
        const newPhase: Phase = {
            id: crypto.randomUUID(),
            name,
            startTime,
            endTime,
        };
        const clippedPhases = state.phases.map(p => {
            // 含有フェーズのクリップ: 新 startTime の 1 秒前で終わる
            if (p.endTime >= startTime && p.startTime < startTime) {
                return { ...p, endTime: startTime - 1 };
            }
            return p;
        });
        return { phases: [...clippedPhases, newPhase].sort((a, b) => a.startTime - b.startTime) };
    });
},
```

**変更点**:
- `nextPhase` ありのときの新フェーズ endTime: `nextPhase.startTime` → `nextPhase.startTime - 1`
- `containingPhase` の条件: `p.endTime > startTime` → `p.endTime >= startTime`（== でも含有）
- `clippedPhases` の条件: `p.endTime > startTime` → `p.endTime >= startTime`
- `clippedPhases` の更新値: `p.endTime = startTime` → `p.endTime = startTime - 1`

- [ ] **Step 2: addLabel を書き換え**

```typescript
addLabel: (startTime, name) => {
    const exists = get().labels.some(l => l.startTime === startTime);
    if (exists) return;
    pushHistory();
    set((state) => {
        const sorted = [...state.labels].sort((a, b) => a.startTime - b.startTime);
        const nextLabel = sorted.find(l => l.startTime > startTime);
        const containingLabel = sorted.find(l => l.startTime <= startTime && l.endTime >= startTime);
        let endTime: number;
        if (nextLabel) {
            endTime = nextLabel.startTime - 1;
        } else if (containingLabel) {
            endTime = containingLabel.endTime;
        } else {
            const maxEventTime = state.timelineEvents.reduce((max, e) => Math.max(max, e.time), 0);
            endTime = Math.max(maxEventTime, startTime + 1);
        }
        const newLabel: Label = {
            id: crypto.randomUUID(),
            name,
            startTime,
            endTime,
        };
        const clippedLabels = state.labels.map(l => {
            if (l.endTime >= startTime && l.startTime < startTime) {
                return { ...l, endTime: startTime - 1 };
            }
            return l;
        });
        return { labels: [...clippedLabels, newLabel].sort((a, b) => a.startTime - b.startTime) };
    });
},
```

- [ ] **Step 3: テスト実行**

Run: `npx vitest run src/store/__tests__/useMitigationStore.boundary.test.ts -t addPhase`
Run: `npx vitest run src/store/__tests__/useMitigationStore.boundary.test.ts -t addLabel`
Expected: addPhase / addLabel のテスト PASS

---

## Task 5: `ensurePhaseEndTimes` / `ensureLabelEndTimes` の次フェーズ基準を新規約に書き換え

**Files:**
- Modify: `src/utils/phaseMigration.ts:42`
- Modify: `src/utils/labelMigration.ts:78`

- [ ] **Step 1: phaseMigration.ts の ensurePhaseEndTimes を書き換え**

```typescript
// Line 42 付近
if (next) return { ...p, endTime: next.startTime - 1 } as Phase;
```

変更前: `endTime: next.startTime`
変更後: `endTime: next.startTime - 1`

- [ ] **Step 2: labelMigration.ts の ensureLabelEndTimes を書き換え**

```typescript
// Line 78 付近
if (next) return { ...l, endTime: next.startTime - 1 } as Label;
```

- [ ] **Step 3: 既存テストの期待値を新規約に書き換え**

`src/utils/__tests__/phaseMigration.test.ts`:
- Line 29: `endTime: 60` → `endTime: 59`（p1 が p2 の前、p2.startTime=60）
- Line 39: `endTime: 30` → `endTime: 29`
- Line 63: `endTime: 60` → `endTime: 59`
- Line 78: `toBe(60)` → `toBe(59)`
- Line 79: `toBe(120)` → `toBe(119)`

`src/utils/__tests__/labelMigration.test.ts` も同様（同パターンの行を探して更新）

- [ ] **Step 4: テスト実行**

Run: `npx vitest run src/utils/__tests__/phaseMigration.test.ts src/utils/__tests__/labelMigration.test.ts`
Expected: ensurePhaseEndTimes / ensureLabelEndTimes 系全 PASS

---

## Task 6: 既存データ自動修復関数 `repairAdjacentPhaseBoundaries` を追加

**Files:**
- Modify: `src/utils/phaseMigration.ts` (末尾に新関数追加)
- Create/Modify: `src/utils/__tests__/phaseMigration.test.ts` (テスト追加)

- [ ] **Step 1: テストを先に書く（Red）**

`src/utils/__tests__/phaseMigration.test.ts` の末尾に追加:

```typescript
describe('repairAdjacentPhaseBoundaries', () => {
    it('隣接フェーズで endTime === next.startTime を検出して endTime を 1 引く', () => {
        const phases: Phase[] = [
            { id: 'p1', name: { ja: 'P1', en: 'P1' }, startTime: 0, endTime: 30 },
            { id: 'p2', name: { ja: 'P2', en: 'P2' }, startTime: 30, endTime: 60 },
            { id: 'p3', name: { ja: 'P3', en: 'P3' }, startTime: 60, endTime: 100 },
        ];
        const result = repairAdjacentPhaseBoundaries(phases);
        expect(result[0].endTime).toBe(29);
        expect(result[1].endTime).toBe(59);
        expect(result[2].endTime).toBe(100); // 最終は変更なし
    });

    it('既に規約を満たしている（endTime + 1 === next.startTime）なら変更しない', () => {
        const phases: Phase[] = [
            { id: 'p1', name: { ja: 'P1', en: 'P1' }, startTime: 0, endTime: 29 },
            { id: 'p2', name: { ja: 'P2', en: 'P2' }, startTime: 30, endTime: 59 },
        ];
        const result = repairAdjacentPhaseBoundaries(phases);
        expect(result).toEqual(phases);
    });

    it('gap がある（endTime + 1 < next.startTime）ケースは変更しない', () => {
        const phases: Phase[] = [
            { id: 'p1', name: { ja: 'P1', en: 'P1' }, startTime: 0, endTime: 20 },
            { id: 'p2', name: { ja: 'P2', en: 'P2' }, startTime: 30, endTime: 60 },
        ];
        const result = repairAdjacentPhaseBoundaries(phases);
        expect(result).toEqual(phases);
    });

    it('空配列ならそのまま返す', () => {
        expect(repairAdjacentPhaseBoundaries([])).toEqual([]);
    });

    it('1 個だけならそのまま返す', () => {
        const phases: Phase[] = [
            { id: 'p1', name: { ja: 'P1', en: 'P1' }, startTime: 0, endTime: 60 },
        ];
        expect(repairAdjacentPhaseBoundaries(phases)).toEqual(phases);
    });
});
```

import 文の先頭にも追加:
```typescript
import { migratePhases, isLegacyPhaseFormat, repairLastPhaseEndTime, repairAdjacentPhaseBoundaries } from '../phaseMigration';
```

- [ ] **Step 2: テストを走らせて fail を確認**

Run: `npx vitest run src/utils/__tests__/phaseMigration.test.ts -t repairAdjacent`
Expected: FAIL（関数未実装）

- [ ] **Step 3: `repairAdjacentPhaseBoundaries` を実装**

`src/utils/phaseMigration.ts` の末尾に追加:

```typescript
/**
 * 旧隣接規約（phase[i].endTime === phase[i+1].startTime）で保存された
 * プランを新規約（phase[i].endTime + 1 === phase[i+1].startTime）に修復する。
 *
 * 描画仕様（Timeline.tsx: endTime + 1 まで描画）と整合させ、境界の罫線が
 * 覆い隠される問題を解消する。厳密な等号のみ修復し、gap やオーバーラップは触らない。
 */
export function repairAdjacentPhaseBoundaries(phases: Phase[]): Phase[] {
    if (phases.length < 2) return phases;
    const sorted = [...phases].sort((a, b) => a.startTime - b.startTime);
    return sorted.map((p, i) => {
        const next = sorted[i + 1];
        if (next && p.endTime === next.startTime) {
            return { ...p, endTime: p.endTime - 1 };
        }
        return p;
    });
}
```

- [ ] **Step 4: テストを走らせて pass を確認**

Run: `npx vitest run src/utils/__tests__/phaseMigration.test.ts -t repairAdjacent`
Expected: 全 PASS

---

## Task 7: 既存データ自動修復関数 `repairAdjacentLabelBoundaries` を追加

**Files:**
- Modify: `src/utils/labelMigration.ts` (末尾)
- Modify: `src/utils/__tests__/labelMigration.test.ts`

- [ ] **Step 1: テストを先に書く（Red）**

`src/utils/__tests__/labelMigration.test.ts` の末尾に追加（import も更新）:

```typescript
describe('repairAdjacentLabelBoundaries', () => {
    it('隣接ラベルで endTime === next.startTime を検出して endTime を 1 引く', () => {
        const labels: Label[] = [
            { id: 'l1', name: { ja: 'L1', en: 'L1' }, startTime: 0, endTime: 30 },
            { id: 'l2', name: { ja: 'L2', en: 'L2' }, startTime: 30, endTime: 60 },
        ];
        const result = repairAdjacentLabelBoundaries(labels);
        expect(result[0].endTime).toBe(29);
        expect(result[1].endTime).toBe(60);
    });

    it('gap があるラベルは変更しない', () => {
        const labels: Label[] = [
            { id: 'l1', name: { ja: 'L1', en: 'L1' }, startTime: 0, endTime: 20 },
            { id: 'l2', name: { ja: 'L2', en: 'L2' }, startTime: 30, endTime: 60 },
        ];
        const result = repairAdjacentLabelBoundaries(labels);
        expect(result).toEqual(labels);
    });

    it('空配列 / 1 個はそのまま返す', () => {
        expect(repairAdjacentLabelBoundaries([])).toEqual([]);
        const one: Label[] = [{ id: 'l1', name: { ja: 'L1', en: 'L1' }, startTime: 0, endTime: 60 }];
        expect(repairAdjacentLabelBoundaries(one)).toEqual(one);
    });
});
```

- [ ] **Step 2: FAIL を確認**

Run: `npx vitest run src/utils/__tests__/labelMigration.test.ts -t repairAdjacent`
Expected: FAIL

- [ ] **Step 3: `repairAdjacentLabelBoundaries` を実装**

`src/utils/labelMigration.ts` の末尾に追加:

```typescript
/**
 * 旧隣接規約（label[i].endTime === label[i+1].startTime）で保存された
 * プランを新規約（label[i].endTime + 1 === label[i+1].startTime）に修復する。
 */
export function repairAdjacentLabelBoundaries(labels: Label[]): Label[] {
    if (labels.length < 2) return labels;
    const sorted = [...labels].sort((a, b) => a.startTime - b.startTime);
    return sorted.map((l, i) => {
        const next = sorted[i + 1];
        if (next && l.endTime === next.startTime) {
            return { ...l, endTime: l.endTime - 1 };
        }
        return l;
    });
}
```

- [ ] **Step 4: PASS を確認**

Run: `npx vitest run src/utils/__tests__/labelMigration.test.ts -t repairAdjacent`
Expected: PASS

---

## Task 8: `loadSnapshot` に修復関数を組み込む

**Files:**
- Modify: `src/store/useMitigationStore.ts` (`loadSnapshot` 内、`finalPhases`/`finalLabels` 生成箇所)

- [ ] **Step 1: import 文を追加**

ファイル先頭の import を更新:
```typescript
import { migratePhases, ensurePhaseEndTimes, repairLastPhaseEndTime, repairAdjacentPhaseBoundaries } from '../utils/phaseMigration';
import { migrateLabels, isLegacyLabelFormat, ensureLabelEndTimes, repairLastLabelEndTime, repairAdjacentLabelBoundaries } from '../utils/labelMigration';
```

- [ ] **Step 2: `loadSnapshot` の finalPhases/finalLabels 直前に追加修復を挟む**

現在（Line 304-310 付近）:
```typescript
const finalPhases = maxEventTime !== undefined
    ? repairLastPhaseEndTime(migratedPhases, snapshot.timelineEvents, maxEventTime)
    : migratedPhases;
const finalLabels = maxEventTime !== undefined
    ? repairLastLabelEndTime(labels, snapshot.timelineEvents, maxEventTime)
    : labels;
```

↓ 差し替え:

```typescript
const lastRepairedPhases = maxEventTime !== undefined
    ? repairLastPhaseEndTime(migratedPhases, snapshot.timelineEvents, maxEventTime)
    : migratedPhases;
const finalPhases = repairAdjacentPhaseBoundaries(lastRepairedPhases);
const lastRepairedLabels = maxEventTime !== undefined
    ? repairLastLabelEndTime(labels, snapshot.timelineEvents, maxEventTime)
    : labels;
const finalLabels = repairAdjacentLabelBoundaries(lastRepairedLabels);
```

**修復の順序**:
1. `migratePhases` — 旧形式→新形式
2. `ensurePhaseEndTimes` — endTime 未定義を補完（migratePhases 内から呼ばれる）
3. `repairLastPhaseEndTime` — 最終フェーズ endTime の過去バグ修復
4. `repairAdjacentPhaseBoundaries` — 隣接規約の修復（新規）

- [ ] **Step 3: 全テスト実行**

Run: `npx vitest run`
Expected: 全 PASS（カウント: 旧 189 + 新規 boundary テスト 変更後 + 新 addPhase/addLabel 2 + 新 repair 10）

---

## Task 9: 他の既存テスト（templateConversions / fflogsMapper / useTemplateEditor）の影響確認

**Files:**
- Check: `src/utils/__tests__/templateConversions.test.ts`
- Check: `src/utils/__tests__/fflogsMapper.test.ts`
- Check: `src/hooks/__tests__/useTemplateEditor.test.ts`

- [ ] **Step 1: 上記テストファイルで `endTime` と `startTime` の関係を grep**

Run: `grep -n "endTime" src/utils/__tests__/templateConversions.test.ts src/utils/__tests__/fflogsMapper.test.ts src/hooks/__tests__/useTemplateEditor.test.ts`

- [ ] **Step 2: もし旧規約（endTime === next.startTime）を前提とした assertion があれば、新規約に合わせて修正**

手動で精査し、該当箇所があれば修正。該当がなければスキップ。

- [ ] **Step 3: 全テスト実行**

Run: `npx vitest run`
Expected: 全 PASS

---

## Task 10: 本番ビルド確認 + TODO.md 更新 + commit

**Files:**
- Modify: `docs/TODO.md`

- [ ] **Step 1: 本番ビルド**

Run: `npm run build`
Expected: `✓ built in` が出力される。エラー無し。

- [ ] **Step 2: TODO.md の「現在の状態」と「今セッションの完了事項」を更新**

「現在の状態」セクションに追加:
```
- **フェーズ/ラベル隣接規約の本質修正 実装完了（2026-04-18）**: 描画仕様 (endTime+1) とデータ規約を整合、addPhase/addLabel/update*Time4関数書き換え、loadSnapshot で既存データ自動修復
```

「今セッションの完了事項」セクションに詳細追加（症状・原因・修正内容・テスト件数）。

前セクションの「隣接フェーズ/ラベルの境界追従」記述は残したまま、その下に新セクションを追加。

- [ ] **Step 3: git status / diff で最終確認**

Run: `rtk git status && rtk git diff --stat`

- [ ] **Step 4: ユーザーに差分確認を依頼（push 前に停止）**

> 実装完了、テスト PASS、ビルド成功。push + デプロイ前に差分レビューをお願いします。
> 確認ポイント:
> - 4 関数の追従ロジックが ±1 ずれで動く
> - addPhase/addLabel の clippedPhases が -1 に
> - loadSnapshot で既存データが自動修復される（FRU テストプラン含む）

- [ ] **Step 5: 承認後に commit + push**

```bash
rtk git add src/store/useMitigationStore.ts src/store/__tests__/useMitigationStore.boundary.test.ts src/utils/phaseMigration.ts src/utils/labelMigration.ts src/utils/__tests__/phaseMigration.test.ts src/utils/__tests__/labelMigration.test.ts docs/TODO.md
rtk git diff --cached --stat
git commit -m "$(cat <<'EOF'
fix(boundary): フェーズ/ラベル隣接規約を描画仕様と整合させる

描画仕様「endTime は inclusive（その行を含む）、描画時 +1 して次行先頭まで」と
データ規約「endTime === next.startTime」が噛み合わず、境界の罫線が次フェーズの
背景に覆われて消えるバグを根本修正。

新規約: phase[i].endTime + 1 === phase[i+1].startTime
ユーザー操作で尊重される側の値はそのまま、追従される側が ±1 ずれる。

変更:
- updatePhase*Time / updateLabel*Time: 衝突時 next.startTime = final+1 / prev.endTime = final-1
- addPhase / addLabel: clippedPhases/Labels を endTime = startTime-1、nextPhase ありで endTime = nextStart-1
- ensurePhase/LabelEndTimes: 中間フェーズ/ラベルの endTime を next.startTime - 1 に
- 新規 repairAdjacentPhaseBoundaries / repairAdjacentLabelBoundaries: 旧規約データを自動修復
- loadSnapshot で修復関数を呼び出し、既存プランを都度修復

既存テストの期待値を新規約に更新、新規テスト（新規約 + 修復関数）を追加。
全テスト PASS、本番ビルド成功。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
rtk git push
```

---

## Self-Review チェックリスト

- [x] **Spec coverage**:
  - 4 update 関数の追従ロジック → Task 2, 3
  - addPhase / addLabel の規約変更 → Task 4
  - 中間フェーズ/ラベルの ensure*EndTimes → Task 5
  - 既存データの自動修復 → Task 6, 7, 8
  - 他の既存テストへの影響 → Task 9
  - ビルド + コミット → Task 10
- [x] **Placeholder scan**: なし
- [x] **Type consistency**: `repairAdjacentPhaseBoundaries` / `repairAdjacentLabelBoundaries` 統一

## 備考・リスク

- **描画仕様は温存**: Timeline.tsx に触らない。回帰リスクを最小化
- **修復は厳密な等号のみ**: `endTime === next.startTime` のケースだけ `-1`。gap やオーバーラップは触らず、予期せぬデータ変更を避ける
- **最低幅 1 秒確保**: 被される側が潰れないよう、衝突時の `final` 上下限を厳密に設定
- **push 前ユーザー承認**: 本番デプロイ前に差分レビューを必須とする
