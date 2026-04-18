# 最終フェーズ/ラベル endTime バグ修正 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 最終フェーズ/ラベルの `endTime` が `startTime + 1` に固定され、帯が「2秒分」しか描画されないバグを根本修正する。

**Architecture:** マイグレーション層の `ensurePhaseEndTimes` / `ensureLabelEndTimes` に optional な `maxTime` 引数を追加し、呼び出し元で `timelineEvents` の最大時刻を渡す。描画ロジック（Timeline.tsx）は触らない。後方互換（引数未指定時は既存挙動）を保つ。

**Tech Stack:** TypeScript, Vitest, Zustand

---

## ファイル構成

| ファイル | 変更種別 | 責務 |
|---------|---------|------|
| `src/utils/phaseMigration.ts` | 修正 | `ensurePhaseEndTimes` / `migratePhases` に `maxTime` 引数追加 |
| `src/utils/labelMigration.ts` | 修正 | `ensureLabelEndTimes` に `maxTime` 引数追加。`migrateLabels` 内部で自動計算 |
| `src/utils/__tests__/phaseMigration.test.ts` | 修正 | `maxTime` 引数の新規テストケース追加 |
| `src/utils/__tests__/labelMigration.test.ts` | 修正 | `maxTime` 引数の新規テストケース追加 |
| `src/store/useMitigationStore.ts` | 修正 | `loadSnapshot` / `importTimelineEvents` で `maxTime` を渡す |
| `src/store/usePlanStore.ts` | 修正 | `createPlanFromTemplate` / テンプレート昇格で `maxTime` を渡す |
| `src/components/Sidebar.tsx` | 修正 | テンプレート読込時に `maxTime` を渡す |
| `src/data/templateLoader.ts` | 修正 | `ensureLabels` で `maxTime` を渡す |
| `src/hooks/useTemplateEditor.ts` | 修正 | `deriveLabelsFromEvents` で `maxTime` を渡す |
| `src/utils/fflogsMapper.ts` | 修正 | FFLogs インポート時に `maxTime` を渡す |

**触らないファイル**: `src/components/Timeline.tsx`（描画）、`src/components/BoundaryEditModal.tsx`（モーダル）、その他 React コンポーネント。

---

## 設計原則

- `maxTime` は optional。未指定時は既存挙動 (`startTime + 1`) を保つ → 後方互換
- 最終フェーズ/ラベルに `maxTime` が指定された場合: `Math.max(maxTime, startTime + 1)` を使う（防御的）
- `migrateLabels` は内部で `timelineEvents` から自動的に maxTime を計算（呼び出し元を変更しない）
- 既存の `endTime` 値はそのまま尊重する（maxTime を渡しても、endTime が定義済みなら上書きしない）

---

### Task 1: `ensurePhaseEndTimes` に `maxTime` 引数を追加（テストファースト）

**Files:**
- Modify: `src/utils/phaseMigration.ts`
- Modify: `src/utils/__tests__/phaseMigration.test.ts`

- [ ] **Step 1: テストを追加（失敗する）**

`src/utils/__tests__/phaseMigration.test.ts` の末尾（`describe('migratePhases')` ブロック内、L103の `}` の前）に以下を追加:

```typescript
    it('maxTime を渡すと最終フェーズの endTime がそれになる', () => {
        const newFormat = [
            { id: 'p1', name: { ja: 'P1', en: 'P1' }, startTime: 0 },
            { id: 'p2', name: { ja: 'P2', en: 'P2' }, startTime: 60 },
        ];
        const result = migratePhases(newFormat, 500);
        expect(result[0].endTime).toBe(60);   // 中間: 次の startTime
        expect(result[1].endTime).toBe(500);  // 最終: maxTime
    });

    it('maxTime が startTime 以下の場合、最終フェーズは startTime + 1 に下限クリップされる', () => {
        const newFormat = [
            { id: 'p1', name: { ja: 'P1', en: 'P1' }, startTime: 100 },
        ];
        const result = migratePhases(newFormat, 50);
        expect(result[0].endTime).toBe(101); // maxTime < startTime+1 なので 101
    });

    it('maxTime 未指定時は既存の startTime + 1 フォールバックが使われる', () => {
        const newFormat = [
            { id: 'p1', name: { ja: 'P1', en: 'P1' }, startTime: 0 },
            { id: 'p2', name: { ja: 'P2', en: 'P2' }, startTime: 60 },
        ];
        const result = migratePhases(newFormat);
        expect(result[0].endTime).toBe(60);
        expect(result[1].endTime).toBe(61);   // 後方互換
    });

    it('既に endTime がある最終フェーズは maxTime で上書きされない', () => {
        const newFormat = [
            { id: 'p1', name: { ja: 'P1', en: 'P1' }, startTime: 0, endTime: 200 },
        ];
        const result = migratePhases(newFormat, 500);
        expect(result[0].endTime).toBe(200); // 既存値維持
    });
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `rtk npm test -- --run src/utils/__tests__/phaseMigration.test.ts`
Expected: 新規4テストのうち `maxTime` 関連のものが FAIL（現在 `migratePhases` は2引数目を受け付けないか、受け付けても使わない）

- [ ] **Step 3: 実装**

`src/utils/phaseMigration.ts` を以下のように修正:

```typescript
/**
 * endTimeが未定義のフェーズにendTimeを補完する。
 * - 中間フェーズ: 次のフェーズのstartTime
 * - 最終フェーズ: maxTime が指定されていれば max(maxTime, startTime+1)、未指定なら startTime + 1
 */
export function ensurePhaseEndTimes(
    phases: Array<Omit<Phase, 'endTime'> & { endTime?: number }>,
    maxTime?: number,
): Phase[] {
    if (phases.length === 0) return [];
    const sorted = [...phases].sort((a, b) => a.startTime - b.startTime);
    return sorted.map((p, i) => {
        if (p.endTime !== undefined) return p as Phase;
        const next = sorted[i + 1];
        if (next) return { ...p, endTime: next.startTime } as Phase;
        // 最終フェーズ
        const fallback = maxTime !== undefined
            ? Math.max(maxTime, p.startTime + 1)
            : p.startTime + 1;
        return { ...p, endTime: fallback } as Phase;
    });
}

/**
 * 旧Phase（endTimeベース）→ 新Phase（startTimeベース）に変換。
 * 新形式のデータはそのまま返す。純粋関数。
 * endTimeが未設定の場合は自動補完する。maxTime を渡すと最終フェーズのフォールバックに使われる。
 */
export function migratePhases(phases: any[], maxTime?: number): Phase[] {
    if (phases.length === 0) return [];

    let result: Array<Omit<Phase, 'endTime'> & { endTime?: number }>;

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

    return ensurePhaseEndTimes(result, maxTime);
}
```

変更点: `ensurePhaseEndTimes` / `migratePhases` の両方にオプショナルな `maxTime` を追加、最終フェーズのフォールバックで使う。

- [ ] **Step 4: テストが通ることを確認**

Run: `rtk npm test -- --run src/utils/__tests__/phaseMigration.test.ts`
Expected: 全テスト PASS（既存含む）

- [ ] **Step 5: コミット**

```bash
rtk git add src/utils/phaseMigration.ts src/utils/__tests__/phaseMigration.test.ts
rtk git commit -m "feat(migration): ensurePhaseEndTimes に maxTime 引数追加（後方互換）"
```

---

### Task 2: `ensureLabelEndTimes` に `maxTime` 引数を追加 + `migrateLabels` で自動計算

**Files:**
- Modify: `src/utils/labelMigration.ts`
- Modify: `src/utils/__tests__/labelMigration.test.ts`

- [ ] **Step 1: テストを追加（失敗する）**

`src/utils/__tests__/labelMigration.test.ts` の末尾（`describe('migrateLabels')` の閉じ `}` の前、L135の後）に以下を追加:

```typescript
    it('最終ラベル startTime より後にイベントがある場合、endTime はそこまで伸びる', () => {
        const events: TEvent[] = [
            { id: 'e1', time: 0, name: { ja: 'A', en: 'A' }, damageType: 'magical', mechanicGroup: { ja: '開幕', en: 'Opener' } },
            { id: 'e2', time: 10, name: { ja: 'B', en: 'B' }, damageType: 'magical', mechanicGroup: { ja: '開幕', en: 'Opener' } },
            // 最後のイベントは mechanicGroup なし（= ラベル外）
            { id: 'e3', time: 50, name: { ja: 'C', en: 'C' }, damageType: 'magical' },
        ];
        const result = migrateLabels(events, []);
        expect(result).toHaveLength(1);
        expect(result[0].startTime).toBe(0);
        expect(result[0].endTime).toBe(50); // 最終イベント時刻まで伸びる（バグ修正前は 1）
    });

    it('最終ラベル startTime = 最終イベント時刻の場合、endTime は startTime + 1', () => {
        const events: TEvent[] = [
            { id: 'e1', time: 0, name: { ja: 'A', en: 'A' }, damageType: 'magical', mechanicGroup: { ja: '開幕', en: 'Opener' } },
            { id: 'e2', time: 20, name: { ja: 'B', en: 'B' }, damageType: 'magical', mechanicGroup: { ja: '展開', en: 'Spread' } },
        ];
        const result = migrateLabels(events, []);
        expect(result[1].startTime).toBe(20);
        expect(result[1].endTime).toBe(21); // maxTime=20, Math.max(20, 21) = 21
    });
```

また、`describe('ensureLabelEndTimes', () => { ... })` ブロックを `describe('migrateLabels')` の後（L136 の後）に追加:

```typescript
describe('ensureLabelEndTimes', () => {
    it('maxTime を渡すと最終ラベルの endTime がそれになる', () => {
        const labels = [
            { id: 'l1', name: { ja: 'A', en: 'A' }, startTime: 0 },
            { id: 'l2', name: { ja: 'B', en: 'B' }, startTime: 30 },
        ];
        const result = ensureLabelEndTimes(labels, 200);
        expect(result[0].endTime).toBe(30);  // 中間
        expect(result[1].endTime).toBe(200); // 最終
    });

    it('maxTime 未指定時は startTime + 1 が使われる（後方互換）', () => {
        const labels = [
            { id: 'l1', name: { ja: 'A', en: 'A' }, startTime: 0 },
            { id: 'l2', name: { ja: 'B', en: 'B' }, startTime: 30 },
        ];
        const result = ensureLabelEndTimes(labels);
        expect(result[0].endTime).toBe(30);
        expect(result[1].endTime).toBe(31);
    });
});
```

このインポート文が必要なので、ファイル先頭の import を変更:

```typescript
import { isLegacyLabelFormat, migrateLabels, ensureLabelEndTimes } from '../labelMigration';
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `rtk npm test -- --run src/utils/__tests__/labelMigration.test.ts`
Expected: 新規テストが FAIL（`migrateLabels` 内部の `maxTime` 自動計算がまだ無い）

- [ ] **Step 3: 実装**

`src/utils/labelMigration.ts` を以下のように修正:

```typescript
/**
 * TimelineEvent.mechanicGroupからLabel[]を生成する。純粋関数。
 *
 * ルール:
 * - mechanicGroup.jaの値が変わる地点をstartTimeとしてLabel作成
 * - フェーズ境界でラベルは区切る（同名ラベルでも別フェーズなら別Label）
 * - mechanicGroupがないイベントは隙間として扱う（Labelを作成しない）
 * - 最終ラベルの endTime は timelineEvents の最大時刻まで伸ばす
 */
export function migrateLabels(timelineEvents: TimelineEvent[], phases: Phase[]): Label[] {
    if (timelineEvents.length === 0) return [];

    const sorted = [...timelineEvents].sort((a, b) => a.time - b.time);

    const labels: Array<Omit<Label, 'endTime'>> = [];
    let currentLabelName: string | null = null;
    let currentPhaseId: string | null = null;

    for (const event of sorted) {
        if (!event.mechanicGroup) {
            currentLabelName = null;
            continue;
        }

        const eventGroupName = event.mechanicGroup.ja;
        const eventPhaseId = getPhaseIdForTime(event.time, phases);

        const isNewLabel =
            eventGroupName !== currentLabelName ||
            eventPhaseId !== currentPhaseId;

        if (isNewLabel) {
            labels.push({
                id: crypto.randomUUID(),
                name: {
                    ja: event.mechanicGroup.ja,
                    en: event.mechanicGroup.en || '',
                    ...(event.mechanicGroup.zh ? { zh: event.mechanicGroup.zh } : {}),
                    ...(event.mechanicGroup.ko ? { ko: event.mechanicGroup.ko } : {}),
                },
                startTime: event.time,
            });
            currentLabelName = eventGroupName;
            currentPhaseId = eventPhaseId;
        }
    }

    // 最終ラベルは最終イベント時刻まで伸ばす（startTime+1 の見切れ防止）
    const maxEventTime = sorted[sorted.length - 1].time;
    return ensureLabelEndTimes(labels, maxEventTime);
}

/**
 * endTimeが未定義のラベルにendTimeを補完する。
 * - 中間ラベル: 次のラベルのstartTime
 * - 最終ラベル: maxTime が指定されていれば max(maxTime, startTime+1)、未指定なら startTime + 1
 */
export function ensureLabelEndTimes(
    labels: Array<Omit<Label, 'endTime'> & { endTime?: number }>,
    maxTime?: number,
): Label[] {
    if (labels.length === 0) return [];
    const sorted = [...labels].sort((a, b) => a.startTime - b.startTime);
    return sorted.map((l, i) => {
        if (l.endTime !== undefined) return l as Label;
        const next = sorted[i + 1];
        if (next) return { ...l, endTime: next.startTime } as Label;
        const fallback = maxTime !== undefined
            ? Math.max(maxTime, l.startTime + 1)
            : l.startTime + 1;
        return { ...l, endTime: fallback } as Label;
    });
}
```

変更点:
- `migrateLabels`: 末尾で `sorted[sorted.length - 1].time` を計算して `ensureLabelEndTimes` に渡す
- `ensureLabelEndTimes`: `maxTime` オプショナル引数を追加、最終ラベルのフォールバックで使う

- [ ] **Step 4: テストが通ることを確認**

Run: `rtk npm test -- --run src/utils/__tests__/labelMigration.test.ts`
Expected: 全テスト PASS（既存含む）

- [ ] **Step 5: コミット**

```bash
rtk git add src/utils/labelMigration.ts src/utils/__tests__/labelMigration.test.ts
rtk git commit -m "feat(migration): ensureLabelEndTimes に maxTime 引数、migrateLabels で自動計算"
```

---

### Task 3: `useMitigationStore.loadSnapshot` で `maxTime` を渡す

**Files:**
- Modify: `src/store/useMitigationStore.ts:288-316`

- [ ] **Step 1: 実装**

`useMitigationStore.ts` の `loadSnapshot` 関数を以下のように修正（L294-297 周辺）:

```typescript
loadSnapshot: (snapshot) => {
    const membersWithComputed = snapshot.partyMembers.map((m: PartyMember) => ({
        ...m,
        computedValues: calculateMemberValues(m, snapshot.currentLevel)
    }));

    // timelineEvents の最大時刻を計算（最終フェーズ/ラベルのendTime フォールバックに使用）
    const maxEventTime = snapshot.timelineEvents.length > 0
        ? snapshot.timelineEvents.reduce((max, e) => Math.max(max, e.time), 0)
        : undefined;

    const migratedPhases = migratePhases(snapshot.phases ?? [], maxEventTime);
    const labels: Label[] = isLegacyLabelFormat(snapshot as any)
        ? migrateLabels(snapshot.timelineEvents, migratedPhases)
        : ensureLabelEndTimes((snapshot as any).labels ?? [], maxEventTime);

    set({
        // ... 既存のまま
```

変更点:
- `maxEventTime` を計算
- `migratePhases` に渡す
- `ensureLabelEndTimes` にも渡す（`migrateLabels` は内部で自動計算するので不要）

- [ ] **Step 2: テスト確認**

Run: `rtk npm test -- --run`
Expected: 全テスト PASS

- [ ] **Step 3: コミット**

```bash
rtk git add src/store/useMitigationStore.ts
rtk git commit -m "fix(store): loadSnapshot で maxEventTime を migratePhases/ensureLabelEndTimes に渡す"
```

---

### Task 4: `useMitigationStore.importTimelineEvents` で `maxTime` を渡す

**Files:**
- Modify: `src/store/useMitigationStore.ts:457-480`

- [ ] **Step 1: 実装**

`useMitigationStore.ts` の `importTimelineEvents` 関数を以下のように修正（L463-471 周辺）:

```typescript
importTimelineEvents: (events, importPhases, importLabels) => {
    pushHistory();
    const maxEventTime = events.length > 0
        ? events.reduce((max, e) => Math.max(max, e.time), 0)
        : undefined;
    const update: Partial<ReturnType<typeof get>> = {
        timelineEvents: [...events].sort((a, b) => a.time - b.time),
        timelineMitigations: [],
    };
    if (importPhases) {
        update.phases = ensurePhaseEndTimes(importPhases
            .filter(p => p.startTimeSec >= 0)
            .map(p => ({
                id: `phase_${p.id}`,
                name: p.name,
                startTime: p.startTimeSec,
            })), maxEventTime);
    }
    if (importLabels) {
        update.labels = importLabels;
    }
    set(update as any);
    if (events.length > 0) {
        useTutorialStore.getState().completeEvent('content:selected');
    }
},
```

変更点: `ensurePhaseEndTimes` の呼び出しに第2引数 `maxEventTime` を追加。

- [ ] **Step 2: テスト確認**

Run: `rtk npm test -- --run`
Expected: 全テスト PASS

- [ ] **Step 3: コミット**

```bash
rtk git add src/store/useMitigationStore.ts
rtk git commit -m "fix(store): importTimelineEvents で maxEventTime を ensurePhaseEndTimes に渡す"
```

---

### Task 5: `usePlanStore.createPlanFromTemplate` で `maxTime` を渡す

**Files:**
- Modify: `src/store/usePlanStore.ts:131-178`

- [ ] **Step 1: 実装**

`usePlanStore.ts` の `createPlanFromTemplate` 関数で以下を修正:

L131 の関数本体冒頭に `maxEventTime` 計算を追加し、`ensureLabelEndTimes` と `ensurePhaseEndTimes` 呼び出しに渡す:

```typescript
createPlanFromTemplate: (contentId, templateData, title, initialData) => {
    const newPlanId = `plan_${Date.now()}`;
    const maxEventTime = templateData.timelineEvents.length > 0
        ? templateData.timelineEvents.reduce((max, e) => Math.max(max, e.time), 0)
        : undefined;
    // ラベル変換: TemplateData.labels → Label[]
    const labels = templateData.labels
        ? ensureLabelEndTimes(templateData.labels.map(l => ({
            id: crypto.randomUUID(),
            name: l.name,
            startTime: l.startTimeSec,
            ...(l.endTimeSec !== undefined ? { endTime: l.endTimeSec } : {}),
        })), maxEventTime)
        : undefined;
    const newPlan: SavedPlan = {
        id: newPlanId,
        ownerId: 'local',
        ownerDisplayName: 'Guest',
        contentId: contentId,
        title: title,
        isPublic: false,
        copyCount: 0,
        useCount: 0,
        data: {
            ...initialData,
            timelineEvents: [...templateData.timelineEvents],
            phases: templateData.phases ? ensurePhaseEndTimes(templateData.phases
                .filter(p => p.startTimeSec >= 0)
                .map((p) => ({
                    id: `phase_${p.id}`,
                    name: p.name
                        ? (typeof p.name === 'string'
                            ? { ja: p.name, en: p.name }
                            : {
                                ja: p.name.ja ?? p.name.en ?? '',
                                en: p.name.en ?? p.name.ja ?? '',
                                ...(p.name.zh != null ? { zh: p.name.zh } : {}),
                                ...(p.name.ko != null ? { ko: p.name.ko } : {}),
                            })
                        : { ja: '', en: '' },
                    startTime: p.startTimeSec,
                })), maxEventTime) : [],
            ...(labels ? { labels } : {}),
        },
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
    get().addPlan(newPlan);
    get().setCurrentPlanId(newPlanId);
    return newPlan;
},
```

変更点:
- `maxEventTime` を関数冒頭で計算
- `ensureLabelEndTimes(...)` 呼び出し（L135付近）の第2引数に追加
- `ensurePhaseEndTimes(...)` 呼び出し（L154付近）の第2引数に追加

- [ ] **Step 2: テスト確認**

Run: `rtk npm test -- --run`
Expected: 全テスト PASS

- [ ] **Step 3: コミット**

```bash
rtk git add src/store/usePlanStore.ts
rtk git commit -m "fix(plan): createPlanFromTemplate で maxEventTime を渡す"
```

---

### Task 6: `usePlanStore` テンプレート昇格パスで `maxTime` を渡す

**Files:**
- Modify: `src/store/usePlanStore.ts:280-340` （promoteActivePlanToTemplate 等、`getTemplate(source.contentId)` を扱う箇所）

- [ ] **Step 1: 実装**

L289 以降のブロック（`const tpl = await getTemplate(source.contentId)` 後）を以下のように修正:

```typescript
// 最新テンプレートでイベント・フェーズ・ラベルを差し替え
if (source.contentId) {
    try {
        const tpl = await getTemplate(source.contentId);
        if (tpl) {
            const tplMaxEventTime = tpl.timelineEvents.length > 0
                ? tpl.timelineEvents.reduce((max, e) => Math.max(max, e.time), 0)
                : undefined;
            newPlan.data = {
                ...newPlan.data,
                timelineEvents: [...tpl.timelineEvents],
                phases: tpl.phases ? ensurePhaseEndTimes(tpl.phases
                    .filter(p => p.startTimeSec >= 0)
                    .map((p) => ({
                        id: `phase_${p.id}`,
                        name: p.name
                            ? (typeof p.name === 'string'
                                ? { ja: p.name, en: p.name }
                                : {
                                    ja: p.name.ja ?? p.name.en ?? '',
                                    en: p.name.en ?? p.name.ja ?? '',
                                    ...(p.name.zh != null ? { zh: p.name.zh } : {}),
                                    ...(p.name.ko != null ? { ko: p.name.ko } : {}),
                                })
                            : { ja: '', en: '' },
                        startTime: p.startTimeSec,
                    })), tplMaxEventTime) : [],
                labels: tpl.labels
                    ? ensureLabelEndTimes(tpl.labels.map(l => ({
                        id: crypto.randomUUID(),
                        name: l.name,
                        startTime: l.startTimeSec,
                        ...(l.endTimeSec !== undefined ? { endTime: l.endTimeSec } : {}),
                    })), tplMaxEventTime)
                    : undefined,
```

変更点:
- `tplMaxEventTime` 計算を追加
- `ensurePhaseEndTimes(...)` 呼び出しの第2引数に `tplMaxEventTime`
- `ensureLabelEndTimes(...)` 呼び出しの第2引数に `tplMaxEventTime`

- [ ] **Step 2: TypeScriptビルド確認**

Run: `rtk npm run build 2>&1 | tail -5`
Expected: ビルド成功（型エラー無し）

- [ ] **Step 3: テスト確認**

Run: `rtk npm test -- --run`
Expected: 全テスト PASS

- [ ] **Step 4: コミット**

```bash
rtk git add src/store/usePlanStore.ts
rtk git commit -m "fix(plan): テンプレート昇格パスで maxEventTime を渡す"
```

---

### Task 7: `Sidebar.tsx` テンプレート読込で `maxTime` を渡す

**Files:**
- Modify: `src/components/Sidebar.tsx:980-1020`

- [ ] **Step 1: 実装**

L984 の `const tpl = await getTemplate(content.id);` の後に `tplMaxEventTime` 計算を追加し、L989 と L1000 の呼び出しに渡す:

```typescript
// テンプレートを裏で読み込み → 自動でプランとして保存
const tpl = await getTemplate(content.id);
if (tpl) {
    const snap = store.getSnapshot();
    const tplMaxEventTime = tpl.timelineEvents.length > 0
        ? tpl.timelineEvents.reduce((max, e) => Math.max(max, e.time), 0)
        : undefined;
    // ラベル変換: TemplateData.labels → Label[]
    const labels = tpl.labels
        ? ensureLabelEndTimes(tpl.labels.map(l => ({
            id: crypto.randomUUID(),
            name: l.name,
            startTime: l.startTimeSec,
            ...(l.endTimeSec !== undefined ? { endTime: l.endTimeSec } : {}),
        })), tplMaxEventTime)
        : undefined;
    store.loadSnapshot({
        ...snap,
        timelineMitigations: [],
        timelineEvents: tpl.timelineEvents,
        phases: tpl.phases ? ensurePhaseEndTimes(tpl.phases
            .filter(p => p.startTimeSec >= 0)
            .map((p) => ({
                id: `phase_${p.id}`,
                name: p.name
                    ? (typeof p.name === 'string'
                        ? { ja: p.name, en: '' }
                        : {
                            ja: p.name.ja ?? '',
                            en: p.name.en ?? '',
                            ...(p.name.zh != null ? { zh: p.name.zh } : {}),
                            ...(p.name.ko != null ? { ko: p.name.ko } : {}),
                        })
                    : { ja: '', en: '' },
                startTime: p.startTimeSec,
```

続きの行（閉じ括弧の行）で `ensurePhaseEndTimes` の呼び出し末尾に `, tplMaxEventTime` を追加:

```typescript
            }))), tplMaxEventTime) : [],
```

※ 既存コードの閉じ括弧パターンと同じ行に、第2引数を足す。

変更点:
- `tplMaxEventTime` 計算を追加
- `ensureLabelEndTimes` 第2引数: `tplMaxEventTime`
- `ensurePhaseEndTimes` 第2引数: `tplMaxEventTime`

- [ ] **Step 2: TypeScriptビルド確認**

Run: `rtk npm run build 2>&1 | tail -5`
Expected: ビルド成功

- [ ] **Step 3: テスト確認**

Run: `rtk npm test -- --run`
Expected: 全テスト PASS

- [ ] **Step 4: コミット**

```bash
rtk git add src/components/Sidebar.tsx
rtk git commit -m "fix(sidebar): テンプレート読込で maxEventTime を渡す"
```

---

### Task 8: `templateLoader.ensureLabels` で `maxTime` を渡す

**Files:**
- Modify: `src/data/templateLoader.ts:40-80`

- [ ] **Step 1: 実装**

`ensureLabels` 関数を以下のように修正:

```typescript
function ensureLabels(tpl: TemplateData): TemplateData {
  if (tpl.labels && tpl.labels.length > 0) return tpl;

  const hasLegacy = isLegacyLabelFormat({
    labels: tpl.labels ? [] : undefined,
    timelineEvents: tpl.timelineEvents,
  });
  if (!hasLegacy) return tpl;

  // migrateLabelsはPhase[]形式を期待するので変換
  const maxEventTime = tpl.timelineEvents.length > 0
    ? tpl.timelineEvents.reduce((max, e) => Math.max(max, e.time), 0)
    : undefined;
  const phasesForMigration = ensurePhaseEndTimes((tpl.phases || []).map(p => ({
    id: `phase_${p.id}`,
    name: p.name || { ja: '', en: '' },
    startTime: p.startTimeSec,
  })), maxEventTime);
  const migratedLabels = migrateLabels(tpl.timelineEvents, phasesForMigration);

  if (migratedLabels.length === 0) return tpl;

  // Label[] → TemplateData.labels形式に変換
  return {
    ...tpl,
    labels: migratedLabels.map((label, i) => ({
      id: i + 1,
      startTimeSec: label.startTime,
      name: label.name,
      // 既存の endTimeSec 変換があれば保持
    })),
  };
}
```

変更点: `maxEventTime` 計算と `ensurePhaseEndTimes` への受け渡し。

**注意**: `migrateLabels` は内部で `maxEventTime` を自動計算するので、ここでは第3引数を渡す必要なし。

- [ ] **Step 2: TypeScriptビルド確認**

Run: `rtk npm run build 2>&1 | tail -5`
Expected: ビルド成功

- [ ] **Step 3: テスト確認**

Run: `rtk npm test -- --run`
Expected: 全テスト PASS

- [ ] **Step 4: コミット**

```bash
rtk git add src/data/templateLoader.ts
rtk git commit -m "fix(template): ensureLabels で maxEventTime を ensurePhaseEndTimes に渡す"
```

---

### Task 9: `useTemplateEditor.deriveLabelsFromEvents` で `maxTime` を渡す

**Files:**
- Modify: `src/hooks/useTemplateEditor.ts:43-67`

- [ ] **Step 1: 実装**

`deriveLabelsFromEvents` 関数を以下のように修正:

```typescript
function deriveLabelsFromEvents(
  events: TimelineEvent[],
  phases: TemplateData['phases'],
): TemplateLabel[] {
  const hasLegacy = isLegacyLabelFormat({ labels: undefined, timelineEvents: events });
  if (!hasLegacy) return [];

  const maxEventTime = events.length > 0
    ? events.reduce((max, e) => Math.max(max, e.time), 0)
    : undefined;
  const phasesForMigration = ensurePhaseEndTimes((phases || []).map(p => ({
    id: `phase_${p.id}`,
    name: p.name || { ja: '', en: '' },
    startTime: p.startTimeSec,
  })), maxEventTime);
  const migrated = migrateLabels(events, phasesForMigration);

  return migrated.map((label, i) => ({
    id: i + 1,
    startTimeSec: label.startTime,
    name: label.name,
    ...(label.endTime !== undefined ? { endTimeSec: label.endTime } : {}),
  }));
}
```

変更点: `maxEventTime` 計算と `ensurePhaseEndTimes` への受け渡し。

- [ ] **Step 2: TypeScriptビルド確認**

Run: `rtk npm run build 2>&1 | tail -5`
Expected: ビルド成功

- [ ] **Step 3: テスト確認**

Run: `rtk npm test -- --run`
Expected: 全テスト PASS

- [ ] **Step 4: コミット**

```bash
rtk git add src/hooks/useTemplateEditor.ts
rtk git commit -m "fix(templateEditor): deriveLabelsFromEvents で maxEventTime を渡す"
```

---

### Task 10: `fflogsMapper.ts` で `maxTime` を渡す

**Files:**
- Modify: `src/utils/fflogsMapper.ts:157-172, 400-416`

- [ ] **Step 1: 実装（無ダメージ時のフォールバック経路）**

L157-172 ブロック内の `ensurePhaseEndTimes` 呼び出しを以下のように修正:

```typescript
if (!filtered.length) {
    const tl: TimelineEvent[] = [];
    const damageGuids = new Set<number>();
    addNonDamageCasts(tl, castEn, castJp, jpNameMap, enNameMap, damageGuids, ref, isEnglishOnly);
    tl.sort((a, b) => a.time - b.time);
    const phases = buildPhases(fight);
    const tlMaxEventTime = tl.length > 0
        ? tl.reduce((max, e) => Math.max(max, e.time), 0)
        : undefined;
    const phasesForLabels = ensurePhaseEndTimes(phases.map(p => ({
        id: `phase_${p.id}`,
        name: p.name,
        startTime: p.startTimeSec,
    })), tlMaxEventTime);
    const labels = migrateLabels(tl, phasesForLabels);
    return {
        events: tl, phases, labels,
        stats: { /* 既存のまま */ },
    };
}
```

- [ ] **Step 2: 実装（通常経路）**

L400-416 ブロックの `ensurePhaseEndTimes` 呼び出しを以下のように修正:

```typescript
// ── Step 9: フェーズ自動生成（V5.0） ──
const phases = buildPhases(fight);

// ── Step 10: ラベル生成（mechanicGroupからLabel[]を生成） ──
const tlMaxEventTime = tl.length > 0
    ? tl.reduce((max, e) => Math.max(max, e.time), 0)
    : undefined;
const phasesForLabels = ensurePhaseEndTimes(phases.map(p => ({
    id: `phase_${p.id}`,
    name: p.name,
    startTime: p.startTimeSec,
})), tlMaxEventTime);
const labels = migrateLabels(tl, phasesForLabels);
```

変更点: 両経路で `tlMaxEventTime` を計算し `ensurePhaseEndTimes` に渡す。

- [ ] **Step 3: TypeScriptビルド確認**

Run: `rtk npm run build 2>&1 | tail -5`
Expected: ビルド成功

- [ ] **Step 4: テスト確認**

Run: `rtk npm test -- --run`
Expected: 全テスト PASS

- [ ] **Step 5: コミット**

```bash
rtk git add src/utils/fflogsMapper.ts
rtk git commit -m "fix(fflogs): mapFFLogsToTimeline で maxEventTime を渡す"
```

---

### Task 11: 最終統合テストとビルド確認

**Files:**
- 全変更ファイル（最終確認）

- [ ] **Step 1: フルビルド**

Run: `rtk npm run build`
Expected: ビルド成功、エラー無し

- [ ] **Step 2: 全テスト実行**

Run: `rtk npm test -- --run`
Expected: 全テスト PASS（既存171 + 新規6〜8 = 177〜179テスト程度）

- [ ] **Step 3: 残存する `ensurePhaseEndTimes` / `ensureLabelEndTimes` 呼び出しの検査**

Run: `rtk grep -n "ensurePhaseEndTimes\|ensureLabelEndTimes" src/`

確認: 全呼び出しで第2引数を渡しているか、または「渡さなくて良いケース」（テストやフォールバック）であることを確認。

- [ ] **Step 4: TODO.md 更新**

`docs/TODO.md` の「次にやること」から「フェーズ表示の最後のフェーズが壊れて見える件」を削除し、「今セッションの完了事項」に追記:

```markdown
### 今セッションの完了事項（2026-04-18 追加 最終フェーズ/ラベル endTime 修正）
- ✅ **最終フェーズ/ラベルの endTime バグを根本修正**
  - `ensurePhaseEndTimes` / `ensureLabelEndTimes` に optional な `maxTime` 引数を追加
  - 全呼び出し元（useMitigationStore / usePlanStore / Sidebar / templateLoader / useTemplateEditor / fflogsMapper）で timelineEvents の最大時刻を渡す
  - `migrateLabels` は内部で自動計算
  - 描画ロジック（Timeline.tsx）は無変更
  - 後方互換: `maxTime` 未指定時は既存挙動（startTime+1）
  - 全テスト PASS、本番ビルド成功
```

- [ ] **Step 5: 最終コミット**

```bash
rtk git add docs/TODO.md
rtk git commit -m "docs(todo): 最終フェーズ/ラベル endTime 修正完了を反映"
```

---

## 手動検証（ユーザー依頼）

本番デプロイ後、以下を確認:

### 必須確認
1. **既存プラン（FRU `5lCMACDB`）**: フェーズ帯が最終イベントまで伸びている
2. **新規プラン作成**: テンプレート読込時にフェーズ/ラベル帯が正しく描画される
3. **ラベル帯**: 最終ラベルもイベントまで伸びる（フェーズ境界は保たれる）
4. **BoundaryEditModal**: フェーズ/ラベルの endTime を手動編集 → 保存 → 正しく反映
5. **Timeline Select Mode**: クリック選択で endTime 設定 → 正しく保存

### 追加確認（時間あれば）
6. **FFLogsインポート**: インポート後、最終フェーズの帯が正常
7. **バックアップ復元**: 旧形式の復元でも正常
8. **管理画面テンプレート編集**: `useTemplateEditor` 経由でラベル導出が正常
9. **Undo/Redo**: 履歴が正常に動作
