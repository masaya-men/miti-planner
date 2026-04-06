# FFLogsフェーズ名自動取得 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** FFLogsインポート時にフェーズ名（ボス名）をAPIから自動取得し、Timeline上で `Phase 1 / Fatebreaker` のように2行表示する

**Architecture:** `fetchFights()` のGraphQLクエリに `report.phases` を追加し、`encounterID` で各fightに紐付ける。`buildPhases()` がfight.phaseNamesを参照してボス名を取得。Timeline表示で `Phase {index}` をインデックスから自動生成し、ボス名を2行目に表示。

**Tech Stack:** TypeScript, React, FFLogs GraphQL API v2, vitest

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/api/fflogs.ts` | Modify | GraphQLクエリ拡張、型追加、phaseNames紐付け |
| `src/utils/fflogsMapper.ts` | Modify | buildPhasesでphaseNames参照 |
| `src/components/Timeline.tsx` | Modify | Phase表示の2行化 |
| `src/locales/ja.json` | Modify | i18nキー追加 |
| `src/locales/en.json` | Modify | i18nキー追加 |
| `src/locales/zh.json` | Modify | i18nキー追加 |
| `src/locales/ko.json` | Modify | i18nキー追加 |
| `src/utils/__tests__/fflogsMapper.test.ts` | Modify | テスト更新 |

---

### Task 1: fflogs.ts — GraphQLクエリ拡張と型追加

**Files:**
- Modify: `src/api/fflogs.ts:60-68` (FFLogsFight型)
- Modify: `src/api/fflogs.ts:167-186` (FIGHTS_QUERY)
- Modify: `src/api/fflogs.ts:188-199` (FightsQueryResult型、fetchFights関数)

- [ ] **Step 1: FFLogsFight型にフィールド追加**

`src/api/fflogs.ts` の `FFLogsFight` interfaceを修正:

```typescript
export interface FFLogsFight {
    id: number;
    startTime: number;
    endTime: number;
    name: string;
    difficulty?: number;
    kill?: boolean;
    encounterID?: number;
    phaseTransitions?: { id: number; startTime: number }[];
    /** report.phasesから紐付けたフェーズ名 */
    phaseNames?: { id: number; name: string }[];
}
```

- [ ] **Step 2: FIGHTS_QUERYにencounterIDとphasesを追加**

```graphql
query GetFights($reportCode: String!) {
  reportData {
    report(code: $reportCode) {
      fights(killType: Kills) {
        id
        startTime
        endTime
        name
        difficulty
        kill
        encounterID
        phaseTransitions {
          id
          startTime
        }
      }
      phases {
        encounterID
        phases {
          id
          name
        }
      }
    }
  }
}
```

- [ ] **Step 3: FightsQueryResult型とfetchFights関数を更新**

```typescript
interface FightsQueryResult {
    reportData: {
        report: {
            fights: FFLogsFight[];
            phases?: { encounterID: number; phases: { id: number; name: string }[] }[];
        };
    };
}

export async function fetchFights(reportCode: string): Promise<FFLogsFight[]> {
    const token = await getAccessToken();
    const data = await gql<FightsQueryResult>(token, FIGHTS_QUERY, { reportCode });
    const fights = data.reportData.report.fights;
    const phaseInfos = data.reportData.report.phases ?? [];

    // encounterIDでフェーズ名を紐付け
    for (const fight of fights) {
        if (fight.encounterID) {
            const info = phaseInfos.find(p => p.encounterID === fight.encounterID);
            if (info?.phases.length) {
                fight.phaseNames = info.phases;
            }
        }
    }

    return fights;
}
```

- [ ] **Step 4: 型チェック**

Run: `npx tsc --noEmit`
Expected: コンパイルエラーなし

- [ ] **Step 5: コミット**

```bash
git add src/api/fflogs.ts
git commit -m "feat: FFLogs GraphQLクエリにreport.phases追加（フェーズ名取得）"
```

---

### Task 2: fflogsMapper.ts — buildPhasesでフェーズ名を使用

**Files:**
- Modify: `src/utils/fflogsMapper.ts:675-686` (buildPhases関数)

- [ ] **Step 1: buildPhases関数を修正**

```typescript
/** フェーズ自動生成（V5.1: report.phasesからボス名取得） */
function buildPhases(fight: FFLogsFight): { id: number; startTimeSec: number; name: string }[] {
    const transitions = fight.phaseTransitions;
    const phaseNames = fight.phaseNames;

    if (!transitions || transitions.length === 0) {
        // フェーズ遷移なし — phaseNamesがあれば最初の名前を使用
        const name = phaseNames?.[0]?.name;
        return [{ id: 1, startTimeSec: 0, name: cleanPhaseName(name) || 'P1' }];
    }

    return transitions.map(pt => {
        const nameEntry = phaseNames?.find(p => p.id === pt.id);
        return {
            id: pt.id,
            startTimeSec: Math.floor((pt.startTime - fight.startTime) / 1000),
            name: cleanPhaseName(nameEntry?.name) || `P${pt.id}`,
        };
    });
}

/**
 * FFLogsフェーズ名のクリーニング
 * "P1: Fatebreaker" → "Fatebreaker"
 * "Phase One" → "Phase One" (プレフィックスなしはそのまま)
 */
function cleanPhaseName(name: string | undefined): string {
    if (!name) return '';
    // "P1: ", "P2: " 等のプレフィックスを除去
    const stripped = name.replace(/^P\d+:\s*/, '');
    return stripped;
}
```

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit`
Expected: コンパイルエラーなし

- [ ] **Step 3: コミット**

```bash
git add src/utils/fflogsMapper.ts
git commit -m "feat: buildPhasesでFFLogsフェーズ名（ボス名）を使用"
```

---

### Task 3: テスト更新

**Files:**
- Modify: `src/utils/__tests__/fflogsMapper.test.ts:6-11` (makeFight)
- Modify: `src/utils/__tests__/fflogsMapper.test.ts:62-67` (既存テスト)

- [ ] **Step 1: makeFightにphaseNamesサポート追加（既にoverridesで対応済み、変更不要）**

確認: `makeFight` は `...overrides` で任意のフィールドを渡せるため変更不要。

- [ ] **Step 2: 既存テストの期待値を確認**

`fflogsMapper.test.ts:62-67` のテスト:
```typescript
it('空の入力で空の結果とデフォルトフェーズを返す', () => {
    const r = mapFFLogsToTimeline([], [], makeFight(), [], [], [], makePlayers());
    expect(r.events).toHaveLength(0);
    expect(r.phases).toHaveLength(1);
    expect(r.phases[0].name).toBe('P1');  // phaseNamesなし → フォールバックP1
});
```

phaseNames未指定なので `'P1'` フォールバックが使われる。**期待値の変更不要。**

- [ ] **Step 3: phaseNames付きのテストを追加**

```typescript
it('phaseNamesがある場合、ボス名をフェーズ名として使用する', () => {
    const fight = makeFight({
        phaseTransitions: [
            { id: 1, startTime: 1000000 },
            { id: 2, startTime: 1165000 },
        ],
        encounterID: 1079,
        phaseNames: [
            { id: 1, name: 'P1: Fatebreaker' },
            { id: 2, name: 'P2: Usurper of Frost' },
        ],
    });
    const r = mapFFLogsToTimeline([], [], fight, [], [], [], makePlayers());
    expect(r.phases).toHaveLength(2);
    expect(r.phases[0].name).toBe('Fatebreaker');
    expect(r.phases[1].name).toBe('Usurper of Frost');
});

it('phaseNamesにプレフィックスがない場合はそのまま使用する', () => {
    const fight = makeFight({
        phaseTransitions: [{ id: 1, startTime: 1000000 }],
        phaseNames: [{ id: 1, name: 'Phase One' }],
    });
    const r = mapFFLogsToTimeline([], [], fight, [], [], [], makePlayers());
    expect(r.phases[0].name).toBe('Phase One');
});

it('phaseNamesが空の場合、P1/P2にフォールバックする', () => {
    const fight = makeFight({
        phaseTransitions: [
            { id: 1, startTime: 1000000 },
            { id: 2, startTime: 1060000 },
        ],
        phaseNames: [],
    });
    const r = mapFFLogsToTimeline([], [], fight, [], [], [], makePlayers());
    expect(r.phases[0].name).toBe('P1');
    expect(r.phases[1].name).toBe('P2');
});
```

- [ ] **Step 4: テスト実行**

Run: `npx vitest run src/utils/__tests__/fflogsMapper.test.ts`
Expected: 全テストPASS

- [ ] **Step 5: コミット**

```bash
git add src/utils/__tests__/fflogsMapper.test.ts
git commit -m "test: FFLogsフェーズ名自動取得のテスト追加"
```

---

### Task 4: Timeline.tsx — Phase表示の2行化

**Files:**
- Modify: `src/components/Timeline.tsx:1997-2005` (フェーズ表示部分)
- Modify: `src/locales/ja.json`
- Modify: `src/locales/en.json`
- Modify: `src/locales/zh.json`
- Modify: `src/locales/ko.json`

- [ ] **Step 1: i18nキー追加**

4つのlocaleファイルの `timeline` セクションに追加:

`ja.json`:
```json
"phase_prefix": "Phase {{index}}"
```

`en.json`:
```json
"phase_prefix": "Phase {{index}}"
```

`zh.json`:
```json
"phase_prefix": "Phase {{index}}"
```

`ko.json`:
```json
"phase_prefix": "Phase {{index}}"
```

注: ユーザーの判断で「Phase」を英語のままにする。将来「フェーズ」に変更可能。

- [ ] **Step 2: Timeline.tsxのフェーズ表示を2行化**

`src/components/Timeline.tsx` のフェーズ表示部分（1997-2005行付近）を修正。
`phaseIndex` は `phasesWithLayout` の配列インデックスから取得する。

現在のコード:
```tsx
<div className="transform -rotate-90 overflow-visible px-2 drop-shadow-md origin-center flex flex-col items-center gap-0.5">
    <span className="hidden md:block whitespace-nowrap text-app-xl font-bold text-app-text leading-none">
        {getPhaseName(phase.name, contentLanguage)}
    </span>
    <span className="md:hidden whitespace-nowrap text-app-base font-bold text-app-text leading-none">
        {getPhaseName(phase.name, contentLanguage)}
    </span>
</div>
```

修正後:
```tsx
<div className="transform -rotate-90 overflow-visible px-2 drop-shadow-md origin-center flex flex-col items-center gap-0.5">
    {/* PC: Phase番号 + ボス名の2行表示 */}
    <span className="hidden md:block whitespace-nowrap text-app-xl font-bold text-app-text leading-none">
        {t('timeline.phase_prefix', { index: phaseIndex + 1 })}
    </span>
    {getPhaseName(phase.name, contentLanguage) !== t('timeline.phase_prefix', { index: phaseIndex + 1 }) && (
        <span className="hidden md:block whitespace-nowrap text-app-sm font-medium text-app-text/70 leading-none">
            {getPhaseName(phase.name, contentLanguage)}
        </span>
    )}
    {/* スマホ: 1行に結合 */}
    <span className="md:hidden whitespace-nowrap text-app-base font-bold text-app-text leading-none">
        {getPhaseName(phase.name, contentLanguage)}
    </span>
</div>
```

2行目の条件: フェーズ名がPhaseプレフィックスと同じ（= フォールバック名）の場合は1行のみ表示。
ボス名がある場合のみ2行目を表示。

注意: `phaseIndex` は `phasesWithLayout` の `.map()` コールバックの第2引数(index)から取得する。
該当のmapを確認し、indexが利用可能か確認すること。もし利用不可なら `phases.indexOf(phase)` で取得。

- [ ] **Step 3: 型チェック**

Run: `npx tsc --noEmit`
Expected: コンパイルエラーなし

- [ ] **Step 4: テスト実行（回帰確認）**

Run: `npx vitest run`
Expected: 全95+テストPASS

- [ ] **Step 5: コミット**

```bash
git add src/components/Timeline.tsx src/locales/ja.json src/locales/en.json src/locales/zh.json src/locales/ko.json
git commit -m "feat: TimelineのPhase表示を2行化（Phase番号 + ボス名）"
```
