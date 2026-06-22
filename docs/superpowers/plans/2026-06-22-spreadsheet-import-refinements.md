# スプレッドシート取り込み 改修2件 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** スプシ取り込みで ① Phase 列を「ラベル」化しフェーズ名は貼り付けごとにユーザー入力、② パーティ枠を全空スタートにし検出ジョブ全員を割り当てるまで作成をブロックする。

**Architecture:** 純ロジックを `src/lib/sheetImport/` に小さな関数として切り出し（`detectUsedJobIds` / `partyAssignment`）TDD で固める。`buildPlanFromSheets` のシグネチャを `ImportSheet[]`（パース結果＋ユーザー入力フェーズ名）＋任意 `partyOverride` に拡張し、`SheetImportResult` に `labels` を追加。`SpreadsheetImportModal` にフェーズ名入力とパーティピッカー UI を足し、`Timeline.handleSheetImport` で `planData.labels` を積む。

**Tech Stack:** React + TypeScript + Zustand + framer-motion + react-i18next、vitest（pool='vmThreads'）。

## Global Constraints

- 既存ユーザー取り込みに**一切触れない**: `useMitigationStore.importTimelineEvents` / `src/utils/importModes.ts` / FFLogs 系（`FFLogsImportModal`, `Timeline.tsx` の `'timeline:import'`）。
- 対象スプシは人気フォーマット1種のみ。未対応技はスキップ→ skipped 集計（手動マッピング無し）。
- 時刻は Total Time（通し秒）が正。
- 型 import は `import type`、未使用 import/var を残さない（Vercel は `tsc -b` 厳密）。
- i18n は 4言語（ja/en/ko/zh）、prefix `sheetImport.*`、nested。ko/zh は実翻訳。
- vitest は pool='vmThreads' 維持、focused 実行、出力はファイルへ、grep/head/tail パイプ禁止（Windows EPIPE）。push 前は `npm run build`。
- UI は LoPo トンマナ: 白黒＋機能色のみ（未割当=赤）、トークン経由（`--app-*`）、glass-tier3、font-size はトークン、AI グラデ/Inter 禁止、マウス追従 UI 禁止。
- 版違いバグ修正コード（commit `bb244981` 等）は feat ブランチに温存済。本改修は別物として積み、最後にまとめて再投入（`git revert b3ed41be` → push）。

---

## File Structure

- **Create** `src/lib/sheetImport/detectUsedJobIds.ts` — データ行で TRUE が付いた列のジョブ id を時刻順初出で返す純関数。
- **Create** `src/lib/sheetImport/detectUsedJobIds.test.ts` — 上記テスト。
- **Create** `src/lib/sheetImport/partyAssignment.ts` — 枠割り当ての純ロジック（割当/入替/自動補完/完了判定/赤判定/override 構築）。
- **Create** `src/lib/sheetImport/__tests__/partyAssignment.test.ts` — 上記テスト。
- **Modify** `src/lib/sheetImport/types.ts` — `ImportSheet` 型を追加。
- **Modify** `src/lib/sheetImport/buildPlanFromSheets.ts` — シグネチャ拡張・`labels` 出力・phases をユーザー名で生成・Phase 列→labels・`detectUsedJobIds` 利用・`partyOverride` 対応。
- **Modify** `src/lib/sheetImport/__tests__/buildPlanFromSheets.test.ts` — 新シグネチャと labels/phases に追従。
- **Modify** `src/components/SpreadsheetImportModal.tsx` — フェーズ名入力・entries 化・パーティピッカー・作成時 override。
- **Modify** `src/components/Timeline.tsx` — `handleSheetImport` の `planData.labels`。
- **Modify** `src/locales/{ja,en,ko,zh}.json` — `sheetImport.*` 追加。

各タスク完了後の検証コマンド（共通）:
```bash
npx vitest run src/lib/sheetImport > "$TEMP/vt.txt" 2>&1; echo EXIT=$?   # 出力はファイルへ
```

---

## Task 1: detectUsedJobIds 純関数（検出ジョブ抽出）

**Files:**
- Create: `src/lib/sheetImport/detectUsedJobIds.ts`
- Test: `src/lib/sheetImport/detectUsedJobIds.test.ts`

**Interfaces:**
- Consumes: `ParsedSheet`（`src/lib/sheetImport/types.ts`）, `JOB_JA_TO_ID`（`src/lib/sheetImport/skillAliases.ts`）。
- Produces: `detectUsedJobIds(parsedSheets: ParsedSheet[]): string[]` — TRUE が1つ以上ある列のジョブ id を時刻順初出・重複排除で返す。`JOB_JA_TO_ID` 未登録ジョブは除外。

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/sheetImport/detectUsedJobIds.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { detectUsedJobIds } from './detectUsedJobIds';
import type { ParsedSheet } from './types';

const sheet: ParsedSheet = {
  columns: [
    { index: 3, job: 'ナイト', skillNameRaw: 'リプライザル' },
    { index: 4, job: '戦士', skillNameRaw: 'ランパート' },
    { index: 5, job: '白魔道士', skillNameRaw: 'アサイラム' }, // TRUE 無し→検出されない
    { index: 6, job: 'マスコット', skillNameRaw: 'なし' },     // JOB_JA_TO_ID 未登録
  ],
  rows: [
    { phaseLabel: 'P', totalTimeSec: 40, action: 'a', damageAmount: null, damageType: null, trueColumnIndexes: [4] },
    { phaseLabel: 'P', totalTimeSec: 10, action: 'b', damageAmount: null, damageType: null, trueColumnIndexes: [3, 6] },
  ],
};

describe('detectUsedJobIds', () => {
  it('TRUE 列のジョブを時刻順初出・重複排除で返す（未登録/未TRUE は除外）', () => {
    // t=10 で pld(3) と マスコット(6・未登録→除外)、t=40 で war(4)
    expect(detectUsedJobIds([sheet])).toEqual(['pld', 'war']);
  });

  it('複数シートを跨いで時刻順初出', () => {
    const s2: ParsedSheet = {
      columns: [{ index: 1, job: '占星術師', skillNameRaw: 'ニュートラルセクト' }],
      rows: [{ phaseLabel: 'Q', totalTimeSec: 5, action: 'c', damageAmount: null, damageType: null, trueColumnIndexes: [1] }],
    };
    // 全行を時刻マージ: t=5(ast), t=10(pld), t=40(war)
    expect(detectUsedJobIds([sheet, s2])).toEqual(['ast', 'pld', 'war']);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/lib/sheetImport/detectUsedJobIds.test.ts > "$TEMP/vt.txt" 2>&1; echo EXIT=$?`
Expected: FAIL（`detectUsedJobIds` is not defined / モジュール未解決）

- [ ] **Step 3: 実装を書く**

`src/lib/sheetImport/detectUsedJobIds.ts`:
```ts
import type { ParsedSheet } from './types';
import { JOB_JA_TO_ID } from './skillAliases';

/**
 * データ行で TRUE が1つでもある列のジョブ id を、全シートを時刻昇順にマージしたうえで
 * 初出順・重複排除で返す。JOB_JA_TO_ID 未登録のジョブ表記は除外。
 */
export function detectUsedJobIds(parsedSheets: ParsedSheet[]): string[] {
  const merged = parsedSheets.flatMap((s) => s.rows.map((row) => ({ row, columns: s.columns })));
  merged.sort((a, b) => a.row.totalTimeSec - b.row.totalTimeSec);

  const usedJobJa = new Set<string>();
  for (const { row, columns } of merged) {
    for (const idx of row.trueColumnIndexes) {
      const col = columns.find((c) => c.index === idx);
      if (col) usedJobJa.add(col.job);
    }
  }
  return [...usedJobJa].map((ja) => JOB_JA_TO_ID[ja]).filter(Boolean) as string[];
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/lib/sheetImport/detectUsedJobIds.test.ts > "$TEMP/vt.txt" 2>&1; echo EXIT=$?`
Expected: PASS（2 passed）

- [ ] **Step 5: コミット**

```bash
rtk git add src/lib/sheetImport/detectUsedJobIds.ts src/lib/sheetImport/detectUsedJobIds.test.ts
rtk git commit -m "feat(sheetImport): 検出ジョブ抽出 detectUsedJobIds を純関数化"
```

---

## Task 2: partyAssignment 純ロジック（枠割り当て）

**Files:**
- Create: `src/lib/sheetImport/partyAssignment.ts`
- Test: `src/lib/sheetImport/__tests__/partyAssignment.test.ts`

**Interfaces:**
- Produces:
  - `PARTY_SLOTS: readonly ['MT','ST','H1','H2','D1','D2','D3','D4']`、`type PartySlot`、`type SlotRole = 'tank'|'healer'|'dps'`、`SLOT_ROLE: Record<PartySlot,SlotRole>`、`SLOTS_BY_ROLE: Record<SlotRole,PartySlot[]>`、`type PartyAssignment = Record<PartySlot,string|null>`。
  - `emptyAssignment(): PartyAssignment`
  - `assignSlot(a, slot, jobId|null): PartyAssignment`（1ジョブ1枠・他枠から外す）
  - `groupByRole(jobIds, roleOf): Record<SlotRole,string[]>`
  - `autoFillSingles(a, byRole): PartyAssignment`（残り1枠1ジョブを埋める）
  - `isAssignmentComplete(a, byRole): boolean`（枠数 capacity 上限で完了判定）
  - `buildPartyOverride(a): { slot: string; jobId: string }[]`
  - `isSlotRequired(a, slot, byRole): boolean`（赤表示すべき空き枠）

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/sheetImport/__tests__/partyAssignment.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  emptyAssignment, assignSlot, groupByRole, autoFillSingles,
  isAssignmentComplete, buildPartyOverride, isSlotRequired,
} from '../partyAssignment';

const roleOf = (id: string): 'tank' | 'healer' | 'dps' | undefined =>
  ({ pld: 'tank', war: 'tank', whm: 'healer', ast: 'healer',
     drg: 'dps', mnk: 'dps', blm: 'dps', dnc: 'dps' } as const)[id as 'pld'];

describe('partyAssignment', () => {
  it('emptyAssignment は全枠 null', () => {
    expect(emptyAssignment()).toEqual({ MT: null, ST: null, H1: null, H2: null, D1: null, D2: null, D3: null, D4: null });
  });

  it('assignSlot は 1ジョブ1枠（同ジョブが他枠にあれば外して入替）', () => {
    let a = emptyAssignment();
    a = assignSlot(a, 'MT', 'pld');
    a = assignSlot(a, 'ST', 'pld'); // pld を ST へ→ MT から外れる
    expect(a.MT).toBeNull();
    expect(a.ST).toBe('pld');
  });

  it('assignSlot は jobId=null で枠を空にする', () => {
    let a = assignSlot(emptyAssignment(), 'MT', 'pld');
    a = assignSlot(a, 'MT', null);
    expect(a.MT).toBeNull();
  });

  it('groupByRole は検出ジョブをロール別に（未知ロールは捨てる・順序保持）', () => {
    expect(groupByRole(['pld', 'whm', 'war', 'zzz'], roleOf)).toEqual({
      tank: ['pld', 'war'], healer: ['whm'], dps: [],
    });
  });

  it('autoFillSingles はロール内「未割当1人×空き1枠」を自動で埋める', () => {
    const byRole = { tank: ['pld', 'war'], healer: [] as string[], dps: [] as string[] };
    let a = assignSlot(emptyAssignment(), 'MT', 'pld'); // ST が空・war 未割当→ST に war
    a = autoFillSingles(a, byRole);
    expect(a.ST).toBe('war');
  });

  it('autoFillSingles は2人以上未割当なら自動補完しない', () => {
    const byRole = { tank: [] as string[], healer: [] as string[], dps: ['drg', 'mnk', 'blm', 'dnc'] };
    const a = autoFillSingles(emptyAssignment(), byRole);
    expect([a.D1, a.D2, a.D3, a.D4]).toEqual([null, null, null, null]);
  });

  it('isAssignmentComplete は検出ジョブ全員が座れば true', () => {
    const byRole = { tank: ['pld', 'war'], healer: ['whm'], dps: [] as string[] };
    let a = emptyAssignment();
    a = assignSlot(a, 'MT', 'pld');
    a = assignSlot(a, 'ST', 'war');
    expect(isAssignmentComplete(a, byRole)).toBe(false); // whm 未割当
    a = assignSlot(a, 'H1', 'whm');
    expect(isAssignmentComplete(a, byRole)).toBe(true);
  });

  it('isAssignmentComplete はロール枠超過分を capacity 上限でカウント（詰み防止）', () => {
    const byRole = { tank: ['pld', 'war', 'drk'], healer: [] as string[], dps: [] as string[] }; // 3 タンク
    let a = assignSlot(emptyAssignment(), 'MT', 'pld');
    a = assignSlot(a, 'ST', 'war'); // 2枠埋め＝capacity 上限→完了扱い（drk は座れない）
    expect(isAssignmentComplete(a, byRole)).toBe(true);
  });

  it('isSlotRequired はロールに未割当検出ジョブが残る空き枠だけ true', () => {
    const byRole = { tank: ['pld', 'war'], healer: [] as string[], dps: [] as string[] };
    const a = assignSlot(emptyAssignment(), 'MT', 'pld');
    expect(isSlotRequired(a, 'ST', byRole)).toBe(true);   // war 未割当→ST 必須(赤)
    expect(isSlotRequired(a, 'MT', byRole)).toBe(false);  // 埋まっている
    expect(isSlotRequired(a, 'H1', byRole)).toBe(false);  // healer 検出ゼロ→不要
  });

  it('buildPartyOverride は埋まっている枠だけ {slot,jobId}[]', () => {
    let a = assignSlot(emptyAssignment(), 'MT', 'pld');
    a = assignSlot(a, 'H1', 'whm');
    expect(buildPartyOverride(a)).toEqual([
      { slot: 'MT', jobId: 'pld' },
      { slot: 'H1', jobId: 'whm' },
    ]);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/lib/sheetImport/__tests__/partyAssignment.test.ts > "$TEMP/vt.txt" 2>&1; echo EXIT=$?`
Expected: FAIL（モジュール未解決）

- [ ] **Step 3: 実装を書く**

`src/lib/sheetImport/partyAssignment.ts`:
```ts
export const PARTY_SLOTS = ['MT', 'ST', 'H1', 'H2', 'D1', 'D2', 'D3', 'D4'] as const;
export type PartySlot = (typeof PARTY_SLOTS)[number];
export type SlotRole = 'tank' | 'healer' | 'dps';

export const SLOT_ROLE: Record<PartySlot, SlotRole> = {
  MT: 'tank', ST: 'tank', H1: 'healer', H2: 'healer',
  D1: 'dps', D2: 'dps', D3: 'dps', D4: 'dps',
};
export const SLOTS_BY_ROLE: Record<SlotRole, PartySlot[]> = {
  tank: ['MT', 'ST'], healer: ['H1', 'H2'], dps: ['D1', 'D2', 'D3', 'D4'],
};

export type PartyAssignment = Record<PartySlot, string | null>;

export function emptyAssignment(): PartyAssignment {
  return { MT: null, ST: null, H1: null, H2: null, D1: null, D2: null, D3: null, D4: null };
}

/** ジョブを枠へ割り当て（1ジョブ1枠：同ジョブが他枠にあれば外す）。jobId=null で枠を空に。 */
export function assignSlot(a: PartyAssignment, slot: PartySlot, jobId: string | null): PartyAssignment {
  const next = { ...a };
  if (jobId !== null) {
    for (const s of PARTY_SLOTS) if (next[s] === jobId) next[s] = null;
  }
  next[slot] = jobId;
  return next;
}

/** 検出ジョブをロール別に分類（roleOf 不明は捨てる・入力順保持）。 */
export function groupByRole(
  jobIds: string[],
  roleOf: (id: string) => SlotRole | undefined,
): Record<SlotRole, string[]> {
  const out: Record<SlotRole, string[]> = { tank: [], healer: [], dps: [] };
  for (const id of jobIds) {
    const r = roleOf(id);
    if (r) out[r].push(id);
  }
  return out;
}

const ROLES: SlotRole[] = ['tank', 'healer', 'dps'];

/** あるロールで「未割当の検出ジョブが1人 かつ 空き枠が1つ」なら自動で埋める（全ロールに適用）。 */
export function autoFillSingles(a: PartyAssignment, byRole: Record<SlotRole, string[]>): PartyAssignment {
  let next = a;
  for (const role of ROLES) {
    const slots = SLOTS_BY_ROLE[role];
    const seated = slots.map((s) => next[s]).filter((v): v is string => v !== null);
    const unseated = byRole[role].filter((j) => !seated.includes(j));
    const emptySlots = slots.filter((s) => next[s] === null);
    if (unseated.length === 1 && emptySlots.length === 1) {
      next = assignSlot(next, emptySlots[0], unseated[0]);
    }
  }
  return next;
}

/** 全検出ジョブが座ったか（ロール枠超過分は capacity 上限でカウント＝詰み防止）。 */
export function isAssignmentComplete(a: PartyAssignment, byRole: Record<SlotRole, string[]>): boolean {
  return ROLES.every((role) => {
    const slots = SLOTS_BY_ROLE[role];
    const need = Math.min(byRole[role].length, slots.length);
    const seated = slots.filter((s) => a[s] !== null).length;
    return seated >= need;
  });
}

/** 埋まっている枠だけ {slot, jobId}[] に。 */
export function buildPartyOverride(a: PartyAssignment): { slot: string; jobId: string }[] {
  return PARTY_SLOTS.filter((s) => a[s] !== null).map((s) => ({ slot: s, jobId: a[s] as string }));
}

/** その空き枠を「未割当の必須枠」として赤表示すべきか（ロールに未割当検出ジョブが残るなら true）。 */
export function isSlotRequired(a: PartyAssignment, slot: PartySlot, byRole: Record<SlotRole, string[]>): boolean {
  if (a[slot] !== null) return false;
  const role = SLOT_ROLE[slot];
  const slots = SLOTS_BY_ROLE[role];
  const seated = slots.filter((s) => a[s] !== null).length;
  const need = Math.min(byRole[role].length, slots.length);
  return seated < need;
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/lib/sheetImport/__tests__/partyAssignment.test.ts > "$TEMP/vt.txt" 2>&1; echo EXIT=$?`
Expected: PASS（10 passed）

- [ ] **Step 5: コミット**

```bash
rtk git add src/lib/sheetImport/partyAssignment.ts src/lib/sheetImport/__tests__/partyAssignment.test.ts
rtk git commit -m "feat(sheetImport): パーティ枠割り当ての純ロジック partyAssignment を追加"
```

---

## Task 3: 機能A — buildPlanFromSheets を ImportSheet[]+labels に拡張 / モーダルにフェーズ名入力 / Timeline で labels 積み

**Files:**
- Modify: `src/lib/sheetImport/types.ts`（`ImportSheet` 追加）
- Modify: `src/lib/sheetImport/buildPlanFromSheets.ts`
- Modify: `src/lib/sheetImport/__tests__/buildPlanFromSheets.test.ts`
- Modify: `src/components/SpreadsheetImportModal.tsx`（フェーズ名入力・entries 化）
- Modify: `src/components/Timeline.tsx`（`handleSheetImport` の `planData.labels`）
- Modify: `src/locales/{ja,en,ko,zh}.json`（`sheetImport.phase_name_label` / `phase_name_placeholder`）

**Interfaces:**
- Consumes: Task 1 の `detectUsedJobIds`。`Label` 型（`src/types/index.ts:130-135`）。
- Produces:
  - `interface ImportSheet { parsed: ParsedSheet; phaseName: string }`（`types.ts`）
  - `buildPlanFromSheets(sheets: ImportSheet[], deps: { mitigations: Mitigation[]; jobs: Job[] }, options: { includeMitigations: boolean; partyOverride?: { slot: string; jobId: string }[] }): SheetImportResult`
  - `SheetImportResult` に `labels: Label[]` 追加。`phases` はユーザー入力名（1 ImportSheet = 1 phase）、`labels` はスプシ Phase 列由来。

- [ ] **Step 1: buildPlanFromSheets のテストを新シグネチャ・labels/phases に書き換える（失敗させる）**

`src/lib/sheetImport/__tests__/buildPlanFromSheets.test.ts` を以下で**全置換**:
```ts
import { describe, it, expect } from 'vitest';
import { buildPlanFromSheets } from '../buildPlanFromSheets';
import type { ParsedSheet, ImportSheet } from '../types';
import type { Mitigation, Job } from '../../../types';

const M = (id: string, jobId: string, ja: string, duration = 10): Mitigation =>
  ({ id, jobId, name: { ja, en: ja }, recast: 0, duration, type: 'all', value: 0 } as Mitigation);
const J = (id: string, role: 'tank' | 'healer' | 'dps'): Job =>
  ({ id, name: { ja: id, en: id }, role, icon: '' } as Job);
const IS = (parsed: ParsedSheet, phaseName: string): ImportSheet => ({ parsed, phaseName });

const MITS = [
  M('reprisal_pld', 'pld', 'リプライザル', 15),
  M('asylum', 'whm', 'アサイラム', 24),
  M('rampart_war', 'war', 'ランパート', 20),
];
const JOBS = [J('pld', 'tank'), J('whm', 'healer'), J('war', 'tank')];

const sheet: ParsedSheet = {
  columns: [
    { index: 8, job: 'ナイト', skillNameRaw: 'リプライザル' },
    { index: 9, job: '白魔道士', skillNameRaw: 'ベネディクション' }, // 未対応
  ],
  rows: [
    { phaseLabel: '開幕', totalTimeSec: 7, action: 'AA', damageAmount: 115000, damageType: 'physical', trueColumnIndexes: [8] },
    { phaseLabel: '真偽記憶', totalTimeSec: 40, action: 'なぞなぞ', damageAmount: null, damageType: null, trueColumnIndexes: [9] },
  ],
};

const sheet2: ParsedSheet = {
  columns: [{ index: 3, job: '戦士', skillNameRaw: 'ランパート' }],
  rows: [
    { phaseLabel: '序章', totalTimeSec: 20, action: 'タンクバスター', damageAmount: 80000, damageType: 'physical', trueColumnIndexes: [3] },
    { phaseLabel: '序章', totalTimeSec: 42, action: '雑魚処理', damageAmount: null, damageType: null, trueColumnIndexes: [] },
    { phaseLabel: '終章', totalTimeSec: 55, action: '全体攻撃', damageAmount: null, damageType: null, trueColumnIndexes: [3] },
  ],
};

describe('buildPlanFromSheets', () => {
  it('TimelineEvent を Total Time 順に作る（damageType 既定 magical・name.ja=action）', () => {
    const r = buildPlanFromSheets([IS(sheet, 'P1')], { mitigations: MITS, jobs: JOBS }, { includeMitigations: true });
    expect(r.timelineEvents.map((e) => [e.time, e.name.ja, e.damageType])).toEqual([
      [7, 'AA', 'physical'], [40, 'なぞなぞ', 'magical'],
    ]);
  });

  it('TRUE セル→AppliedMitigation（owner=枠・time=通し・duration=スナップショット）', () => {
    const r = buildPlanFromSheets([IS(sheet, 'P1')], { mitigations: MITS, jobs: JOBS }, { includeMitigations: true });
    expect(r.timelineMitigations).toHaveLength(1);
    expect(r.timelineMitigations[0]).toMatchObject({ mitigationId: 'reprisal_pld', ownerId: 'MT', time: 7, duration: 15 });
  });

  it('未対応技は skipped に集約', () => {
    const r = buildPlanFromSheets([IS(sheet, 'P1')], { mitigations: MITS, jobs: JOBS }, { includeMitigations: true });
    expect(r.skipped).toContainEqual({ job: '白魔道士', skillName: 'ベネディクション' });
  });

  it('phases はユーザー入力フェーズ名（1 シート 1 フェーズ・シート時間範囲）', () => {
    const r = buildPlanFromSheets(
      [IS(sheet, 'P1 ケフカ'), IS(sheet2, 'P2 ゴッドケフカ')],
      { mitigations: MITS, jobs: JOBS }, { includeMitigations: true },
    );
    expect(r.phases.map((p) => [p.name.ja, p.startTime, p.endTime])).toEqual([
      ['P1 ケフカ', 7, 20],   // sheet 開始7 → 次シート開始20
      ['P2 ゴッドケフカ', 20, 56], // sheet2 開始20 → maxTime(55)+1
    ]);
  });

  it('labels はスプシ Phase 列由来（連続同名チャンク・endTime=次/末尾+1・空ラベルは作らない）', () => {
    const r = buildPlanFromSheets([IS(sheet, 'P1')], { mitigations: MITS, jobs: JOBS }, { includeMitigations: true });
    expect(r.labels.map((l) => [l.name.ja, l.startTime, l.endTime])).toEqual([
      ['開幕', 7, 40],
      ['真偽記憶', 40, 41],
    ]);
  });

  it('includeMitigations=false でも phases/labels は出る・軽減とパーティは空', () => {
    const r = buildPlanFromSheets([IS(sheet, 'P1')], { mitigations: MITS, jobs: JOBS }, { includeMitigations: false });
    expect(r.timelineMitigations).toEqual([]);
    expect(r.party).toEqual([]);
    expect(r.timelineEvents).toHaveLength(2);
    expect(r.phases.map((p) => p.name.ja)).toEqual(['P1']);
    expect(r.labels.map((l) => l.name.ja)).toEqual(['開幕', '真偽記憶']);
  });

  it('シート境界が重なっても labels は交互化(ピンポン)せず単調', () => {
    const overlapA: ParsedSheet = {
      columns: [],
      rows: [
        { phaseLabel: 'Alpha', totalTimeSec: 10, action: 'a1', damageAmount: null, damageType: null, trueColumnIndexes: [] },
        { phaseLabel: 'Alpha', totalTimeSec: 50, action: 'a3', damageAmount: null, damageType: null, trueColumnIndexes: [] },
      ],
    };
    const overlapB: ParsedSheet = {
      columns: [],
      rows: [
        { phaseLabel: 'Beta', totalTimeSec: 45, action: 'b1', damageAmount: null, damageType: null, trueColumnIndexes: [] },
        { phaseLabel: 'Beta', totalTimeSec: 60, action: 'b2', damageAmount: null, damageType: null, trueColumnIndexes: [] },
      ],
    };
    const r = buildPlanFromSheets(
      [IS(overlapA, 'Pa'), IS(overlapB, 'Pb')],
      { mitigations: MITS, jobs: JOBS }, { includeMitigations: true },
    );
    expect(r.labels.map((l) => [l.name.ja, l.startTime, l.endTime])).toEqual([
      ['Alpha', 10, 45],
      ['Beta', 45, 61],
    ]);
  });

  it('複数シートのイベントが Total Time 昇順・sheet2 軽減が正しい owner(ST) で解決', () => {
    const r = buildPlanFromSheets(
      [IS(sheet, 'P1'), IS(sheet2, 'P2')],
      { mitigations: MITS, jobs: JOBS }, { includeMitigations: true },
    );
    expect(r.timelineEvents.map((e) => e.time)).toEqual([7, 20, 40, 42, 55]);
    const warMits = r.timelineMitigations.filter((m) => m.mitigationId === 'rampart_war');
    expect(warMits).toHaveLength(2);
    expect(warMits.map((m) => m.time)).toEqual([20, 55]);
    expect(warMits.every((m) => m.ownerId === 'ST')).toBe(true);
  });

  it('連続TRUE-run は run 先頭で1配置(rising-edge)', () => {
    const durSheet: ParsedSheet = {
      columns: [{ index: 5, job: 'ナイト', skillNameRaw: 'リプライザル' }],
      rows: [38, 43, 50, 60, 63].map((t) => ({
        phaseLabel: 'P', totalTimeSec: t, action: String(t), damageAmount: null, damageType: null, trueColumnIndexes: [5],
      })),
    };
    const r = buildPlanFromSheets([IS(durSheet, 'P')], { mitigations: MITS, jobs: JOBS }, { includeMitigations: true });
    expect(r.timelineMitigations.filter((m) => m.mitigationId === 'reprisal_pld').map((m) => m.time)).toEqual([38]);
  });

  it('FALSE/欠落行で切れた別 run は別配置(rising-edge)', () => {
    const reuseSheet: ParsedSheet = {
      columns: [{ index: 5, job: 'ナイト', skillNameRaw: 'リプライザル' }],
      rows: [
        { phaseLabel: 'P', totalTimeSec: 38, action: 'a', damageAmount: null, damageType: null, trueColumnIndexes: [5] },
        { phaseLabel: 'P', totalTimeSec: 50, action: 'c', damageAmount: null, damageType: null, trueColumnIndexes: [] },
        { phaseLabel: 'P', totalTimeSec: 60, action: 'd', damageAmount: null, damageType: null, trueColumnIndexes: [5] },
      ],
    };
    const r = buildPlanFromSheets([IS(reuseSheet, 'P')], { mitigations: MITS, jobs: JOBS }, { includeMitigations: true });
    expect(r.timelineMitigations.filter((m) => m.mitigationId === 'reprisal_pld').map((m) => m.time)).toEqual([38, 60]);
  });

  it('同一(技/時刻/枠)の重複配置を排除', () => {
    const dupSheet: ParsedSheet = {
      columns: [
        { index: 5, job: 'ナイト', skillNameRaw: 'リプライザル' },
        { index: 6, job: 'ナイト', skillNameRaw: 'リプライザル' },
      ],
      rows: [{ phaseLabel: 'P', totalTimeSec: 38, action: 'a', damageAmount: null, damageType: null, trueColumnIndexes: [5, 6] }],
    };
    const r = buildPlanFromSheets([IS(dupSheet, 'P')], { mitigations: MITS, jobs: JOBS }, { includeMitigations: true });
    expect(r.timelineMitigations.filter((m) => m.mitigationId === 'reprisal_pld')).toHaveLength(1);
  });

  it('partyOverride を渡すと owner がそれに従う（軽減数は不変）', () => {
    // 通常 pld=MT だが override で pld=ST にすると owner が ST になる
    const r = buildPlanFromSheets(
      [IS(sheet, 'P1')], { mitigations: MITS, jobs: JOBS },
      { includeMitigations: true, partyOverride: [{ slot: 'ST', jobId: 'pld' }] },
    );
    expect(r.timelineMitigations).toHaveLength(1);
    expect(r.timelineMitigations[0]).toMatchObject({ mitigationId: 'reprisal_pld', ownerId: 'ST' });
    expect(r.party).toEqual([{ slot: 'ST', jobId: 'pld' }]);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/lib/sheetImport/__tests__/buildPlanFromSheets.test.ts > "$TEMP/vt.txt" 2>&1; echo EXIT=$?`
Expected: FAIL（`ImportSheet` 型未定義 / `labels` undefined / phases 名不一致）

- [ ] **Step 3: types.ts に ImportSheet を追加**

`src/lib/sheetImport/types.ts` の末尾に追記:
```ts
/** モーダルが保持する「1タブ分のパース結果＋ユーザー入力フェーズ名」 */
export interface ImportSheet {
  parsed: ParsedSheet;
  phaseName: string;
}
```

- [ ] **Step 4: buildPlanFromSheets.ts を書き換える**

`src/lib/sheetImport/buildPlanFromSheets.ts` を以下で**全置換**:
```ts
import type { ParsedSheet, SkippedSkill, ImportSheet } from './types';
import type { Mitigation, Job, TimelineEvent, AppliedMitigation, Phase, Label } from '../../types';
import { resolveSheetSkill } from './resolveSheetSkill';
import { resolveImportParty } from './resolveImportParty';
import { detectUsedJobIds } from './detectUsedJobIds';
import { JOB_JA_TO_ID } from './skillAliases';

export interface SheetImportResult {
  timelineEvents: TimelineEvent[];
  timelineMitigations: AppliedMitigation[];
  phases: Phase[];
  labels: Label[];
  party: { slot: string; jobId: string }[];
  skipped: SkippedSkill[];
}

let seq = 0;
const uid = (p: string) => `${p}_${Date.now().toString(36)}_${(seq++).toString(36)}`;

export function buildPlanFromSheets(
  sheets: ImportSheet[],
  deps: { mitigations: Mitigation[]; jobs: Job[] },
  options: { includeMitigations: boolean; partyOverride?: { slot: string; jobId: string }[] },
): SheetImportResult {
  const parsedSheets: ParsedSheet[] = sheets.map((s) => s.parsed);

  // 全シートの行を Total Time 昇順マージ。列はシート固有なので行に紐付けて持つ。
  const merged = parsedSheets.flatMap((s) => s.rows.map((row) => ({ row, columns: s.columns })));
  merged.sort((a, b) => a.row.totalTimeSec - b.row.totalTimeSec);
  const maxTime = merged.length ? merged[merged.length - 1].row.totalTimeSec : 0;

  const timelineEvents: TimelineEvent[] = merged.map(({ row }) => ({
    id: uid('ev'),
    time: row.totalTimeSec,
    name: { ja: row.action, en: row.action },
    damageType: row.damageType ?? 'magical',
    ...(row.damageAmount != null ? { damageAmount: row.damageAmount } : {}),
  }));

  // phases = ユーザー入力名（1 ImportSheet = 1 フェーズ）。startTime=そのシート最小時刻、
  // endTime=次フェーズ開始（末尾は maxTime+1）。startTime 昇順に確定。
  const phases: Phase[] = sheets
    .map((s) => {
      const times = s.parsed.rows.map((r) => r.totalTimeSec);
      const start = times.length ? Math.min(...times) : 0;
      return { id: uid('ph'), name: { ja: s.phaseName, en: s.phaseName }, startTime: start, endTime: start };
    })
    .sort((a, b) => a.startTime - b.startTime);
  for (let i = 0; i < phases.length - 1; i++) phases[i].endTime = phases[i + 1].startTime;
  if (phases.length) phases[phases.length - 1].endTime = maxTime + 1;

  // labels = スプシ Phase 列。シート内で連続する同 phaseLabel 行を 1 ラベルに。
  // 空 phaseLabel はラベルを作らない。隣接同名は統合（境界割れの保険）。
  const rawLabels: Label[] = [];
  for (const s of parsedSheets) {
    const rows = [...s.rows].sort((a, b) => a.totalTimeSec - b.totalTimeSec);
    let curLabel: string | null = null;
    for (const row of rows) {
      if (!row.phaseLabel) continue;
      if (row.phaseLabel !== curLabel) {
        curLabel = row.phaseLabel;
        rawLabels.push({
          id: uid('lb'),
          name: { ja: row.phaseLabel, en: row.phaseLabel },
          startTime: row.totalTimeSec,
          endTime: row.totalTimeSec,
        });
      }
    }
  }
  rawLabels.sort((a, b) => a.startTime - b.startTime);
  const labels: Label[] = [];
  for (const lb of rawLabels) {
    const last = labels[labels.length - 1];
    if (last && last.name.ja === lb.name.ja) continue;
    labels.push(lb);
  }
  for (let i = 0; i < labels.length - 1; i++) labels[i].endTime = labels[i + 1].startTime;
  if (labels.length) labels[labels.length - 1].endTime = maxTime + 1;

  if (!options.includeMitigations) {
    return { timelineEvents, timelineMitigations: [], phases, labels, party: [], skipped: [] };
  }

  // 使用ジョブ検出 → パーティ。override があればそれを優先（全空スタートのユーザー割当）。
  const usedJobIds = detectUsedJobIds(parsedSheets);
  const party = options.partyOverride ?? resolveImportParty(usedJobIds, deps.jobs);
  const slotByJobId = new Map(party.map((p) => [p.jobId, p.slot] as const));

  // スプシ「効果時間中ずっと TRUE」→ rising-edge（非TRUE→TRUE の立ち上がりだけ新規使用）。
  const timelineMitigations: AppliedMitigation[] = [];
  const skippedSet = new Map<string, SkippedSkill>();
  for (const sheet of parsedSheets) {
    const rowsInOrder = [...sheet.rows].sort((a, b) => a.totalTimeSec - b.totalTimeSec);
    for (const col of sheet.columns) {
      const mitId = resolveSheetSkill(col.job, col.skillNameRaw, deps.mitigations);
      const mit = mitId ? deps.mitigations.find((m) => m.id === mitId) : undefined;
      const duration = mit?.duration ?? 0;
      const jobId = JOB_JA_TO_ID[col.job];
      const ownerId = jobId ? slotByJobId.get(jobId) : undefined;
      let hadTrue = false;
      let inRun = false;
      for (const row of rowsInOrder) {
        const isTrue = row.trueColumnIndexes.includes(col.index);
        if (!isTrue) {
          inRun = false;
          continue;
        }
        hadTrue = true;
        if (!inRun) {
          inRun = true;
          if (mitId && ownerId) {
            timelineMitigations.push({ id: uid('mit'), mitigationId: mitId, time: row.totalTimeSec, duration, ownerId });
          }
        }
      }
      if (hadTrue && !mitId) {
        skippedSet.set(`${col.job}/${col.skillNameRaw}`, { job: col.job, skillName: col.skillNameRaw });
      }
    }
  }

  // 同一 (mitigationId, ownerId, time) は重複排除。
  const seen = new Set<string>();
  const dedupedMitigations: AppliedMitigation[] = [];
  for (const m of timelineMitigations) {
    const key = `${m.mitigationId}@${m.ownerId}@${m.time}`;
    if (seen.has(key)) continue;
    seen.add(key);
    dedupedMitigations.push(m);
  }
  dedupedMitigations.sort((a, b) => a.time - b.time);

  return { timelineEvents, timelineMitigations: dedupedMitigations, phases, labels, party, skipped: [...skippedSet.values()] };
}
```

- [ ] **Step 5: lib テストが通ることを確認**

Run: `npx vitest run src/lib/sheetImport > "$TEMP/vt.txt" 2>&1; echo EXIT=$?`
Expected: PASS（detectUsedJobIds / partyAssignment / buildPlanFromSheets / 既存 resolveSheetSkill 等すべて緑）

- [ ] **Step 6: モーダルを entries 化＋フェーズ名入力に更新（tsc を緑に保つ）**

`src/components/SpreadsheetImportModal.tsx` を次のとおり変更:

(a) import を差し替え（`ParsedSheet` 型 import を `ImportSheet` に）:
```ts
import type { ImportSheet } from '../lib/sheetImport/types';
```

(b) `resetState` を更新:
```ts
function resetState() {
  return {
    includeMitigations: true as boolean,
    draft: '' as string,
    phaseName: '' as string,
    entries: [] as ImportSheet[],
    parseError: false as boolean,
  };
}
```

(c) state 宣言を更新（`sheets`→`entries`、`phaseName` 追加）:
```ts
  const [includeMitigations, setIncludeMitigations] = useState(true);
  const [draft, setDraft] = useState('');
  const [phaseName, setPhaseName] = useState('');
  const [entries, setEntries] = useState<ImportSheet[]>([]);
  const [parseError, setParseError] = useState(false);
```

(d) `handleClose` を更新:
```ts
  const handleClose = useCallback(() => {
    const s = resetState();
    setIncludeMitigations(s.includeMitigations);
    setDraft(s.draft);
    setPhaseName(s.phaseName);
    setEntries(s.entries);
    setParseError(s.parseError);
    onClose();
  }, [onClose]);
```

(e) `handleAddPhase` を更新（フェーズ名込みで push・両方クリア）:
```ts
  const handleAddPhase = useCallback(() => {
    const result = parseMitigationSheet(draft);
    if (!result) {
      setParseError(true);
      return;
    }
    setParseError(false);
    setEntries((prev) => [...prev, { parsed: result, phaseName: phaseName.trim() }]);
    setDraft('');
    setPhaseName('');
  }, [draft, phaseName]);
```

(f) `preview` / `perSheetMits` の `sheets` を `entries` に置換:
```ts
  const preview = useMemo<SheetImportResult | null>(
    () =>
      entries.length > 0
        ? buildPlanFromSheets(
            entries,
            { mitigations: getMitigationsFromStore(), jobs: getJobsFromStore() },
            { includeMitigations },
          )
        : null,
    [entries, includeMitigations],
  );

  const perSheetMits = useMemo<number[]>(
    () =>
      includeMitigations
        ? entries.map(
            (e) =>
              buildPlanFromSheets(
                [e],
                { mitigations: getMitigationsFromStore(), jobs: getJobsFromStore() },
                { includeMitigations: true },
              ).timelineMitigations.length,
          )
        : entries.map(() => 0),
    [entries, includeMitigations],
  );
```

(g) フェーズ名入力をテキストエリアの**直上**に追加（Step 2 の `paste_label` ラベルの上）:
```tsx
            {/* Step 2: Phase name + Paste area */}
            <div className="space-y-2">
              <label className="text-app-lg text-app-text-muted block">
                {t('sheetImport.phase_name_label')}
              </label>
              <input
                type="text"
                value={phaseName}
                onChange={(e) => setPhaseName(e.target.value)}
                placeholder={t('sheetImport.phase_name_placeholder')}
                className="w-full bg-app-surface2 border border-app-border rounded-lg px-3 py-2 text-app-2xl text-app-text focus:outline-none focus:border-app-text placeholder:text-app-text-muted"
                spellCheck={false}
              />
              <label className="text-app-lg text-app-text-muted block pt-1">
                {t('sheetImport.paste_label')}
              </label>
              {/* 既存の <textarea> はここに残す */}
```
（既存の `{/* Step 2: Paste area */}` ブロックの `<label>…paste_label…</label>` を上記に統合し、`<textarea>` 以降は既存のまま。）

(h) 「追加」ボタンの活性条件を `draft.trim() && phaseName.trim()` に:
```tsx
              <button
                onClick={handleAddPhase}
                disabled={!draft.trim() || !phaseName.trim()}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-app-2xl font-bold transition-all duration-200',
                  draft.trim() && phaseName.trim()
                    ? 'bg-app-toggle text-app-toggle-text hover:opacity-80 cursor-pointer active:scale-95'
                    : 'bg-app-surface2 text-app-text-muted cursor-not-allowed',
                )}
              >
                {t('sheetImport.add_phase')}
              </button>
```

(i) 追加済みリストの表示名をユーザー入力名に（`sheets.map`→`entries.map`、phaseName 使用）:
```tsx
            {entries.length > 0 && (
              <div className="space-y-1">
                {entries.map((entry, i) => {
                  const phaseNameDisp = entry.phaseName || `Phase ${i + 1}`;
                  const events = entry.parsed.rows.length;
                  const mits = perSheetMits[i] ?? 0;
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-app-text/5 border border-app-border text-app-2xl text-app-text"
                    >
                      <CheckCircle2 size={14} className="shrink-0 text-app-text-muted" />
                      <span>{t('sheetImport.detected_phase', { name: phaseNameDisp, events, mits })}</span>
                    </div>
                  );
                })}
              </div>
            )}
```

（注: この Task では `handleConfirm` は既存どおり `onImport(preview, 'new')` のまま＝パーティは自動割当。ピッカーは Task 4 で追加。）

- [ ] **Step 7: Timeline.handleSheetImport で labels を積む**

`src/components/Timeline.tsx` の `planData` 構築（`phases: result.phases,` の直後）に1行追加:
```ts
            phases: result.phases,
            labels: result.labels,
```

- [ ] **Step 8: i18n キー（phase 名）を 4言語に追加**

`src/locales/ja.json` の `sheetImport` に追加:
```json
        "phase_name_label": "フェーズ名（このタブの呼び名）",
        "phase_name_placeholder": "例: P1 神々の像",
```
`src/locales/en.json`:
```json
        "phase_name_label": "Phase name (label for this tab)",
        "phase_name_placeholder": "e.g. P1 Statue of the Gods",
```
`src/locales/ko.json`:
```json
        "phase_name_label": "페이즈 이름 (이 탭의 명칭)",
        "phase_name_placeholder": "예: P1 신들의 상",
```
`src/locales/zh.json`:
```json
        "phase_name_label": "阶段名称（此标签页的名称）",
        "phase_name_placeholder": "例: P1 神之像",
```
（各ファイルの `sheetImport` ブロック内・既存キーの並びに合わせて挿入。末尾キーのカンマ整合に注意。）

- [ ] **Step 9: ビルドとテストで緑を確認**

Run:
```bash
npx vitest run src/lib/sheetImport > "$TEMP/vt.txt" 2>&1; echo VT=$?
npm run build > "$TEMP/build.txt" 2>&1; echo BUILD=$?
```
Expected: VT=0 / BUILD=0（tsc -b clean・未使用 import 無し）

- [ ] **Step 10: コミット**

```bash
rtk git add src/lib/sheetImport/types.ts src/lib/sheetImport/buildPlanFromSheets.ts src/lib/sheetImport/__tests__/buildPlanFromSheets.test.ts src/components/SpreadsheetImportModal.tsx src/components/Timeline.tsx src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
rtk git commit -m "feat(sheetImport): Phase列をラベル化しフェーズ名を貼付ごとに入力(機能A)"
```

---

## Task 4: 機能B — モーダルにパーティピッカー（全空・全員割当までブロック）

**Files:**
- Modify: `src/components/SpreadsheetImportModal.tsx`
- Modify: `src/locales/{ja,en,ko,zh}.json`（`sheetImport.party_*`）

**Interfaces:**
- Consumes: Task 1 `detectUsedJobIds`、Task 2 `partyAssignment`（`PARTY_SLOTS`/`SLOT_ROLE`/`SLOTS_BY_ROLE`/`emptyAssignment`/`assignSlot`/`groupByRole`/`autoFillSingles`/`isAssignmentComplete`/`buildPartyOverride`/`isSlotRequired`）、Task 3 `buildPlanFromSheets`（`partyOverride`）。`getJobsFromStore`（`src/hooks/useSkillsData.ts`）。
- Produces: 作成時に `partyOverride` を渡して owner 確定。検出ジョブ全員が座るまで「作成」disabled。

- [ ] **Step 1: 追加 import と state**

`src/components/SpreadsheetImportModal.tsx`:
```ts
import {
  PARTY_SLOTS, SLOT_ROLE, SLOTS_BY_ROLE, emptyAssignment, assignSlot,
  groupByRole, autoFillSingles, isAssignmentComplete, buildPartyOverride, isSlotRequired,
  type PartyAssignment, type PartySlot, type SlotRole,
} from '../lib/sheetImport/partyAssignment';
import { detectUsedJobIds } from '../lib/sheetImport/detectUsedJobIds';
```
state に追加:
```ts
  const [assignment, setAssignment] = useState<PartyAssignment>(emptyAssignment());
```
`handleClose` に reset 追加:
```ts
    setAssignment(emptyAssignment());
```

- [ ] **Step 2: 検出ジョブとロール分類の useMemo**

```ts
  const jobs = getJobsFromStore();
  const roleOf = useCallback(
    (id: string) => jobs.find((j) => j.id === id)?.role as SlotRole | undefined,
    [jobs],
  );
  const detectedJobIds = useMemo(
    () => (includeMitigations ? detectUsedJobIds(entries.map((e) => e.parsed)) : []),
    [entries, includeMitigations],
  );
  const detectedByRole = useMemo(() => groupByRole(detectedJobIds, roleOf), [detectedJobIds, roleOf]);
  const jobName = useCallback(
    (id: string) => jobs.find((j) => j.id === id)?.name.ja ?? id,
    [jobs],
  );
```
検出ジョブが変わったら割り当てをリセット（全タブ貼り終えてから割り当てる前提）:
```ts
  useEffect(() => {
    setAssignment(emptyAssignment());
  }, [detectedJobIds]);
```
（`useEffect` を react import に追加。`detectedJobIds` は参照同値が変わるたび＝entries 変化時にリセット。）

- [ ] **Step 3: 枠選択ハンドラ（入替＋自動補完）**

```ts
  const handleSlotChange = useCallback(
    (slot: PartySlot, jobId: string | null) => {
      setAssignment((prev) => autoFillSingles(assignSlot(prev, slot, jobId), detectedByRole));
    },
    [detectedByRole],
  );
```

- [ ] **Step 4: 作成ガードと handleConfirm の差し替え**

`canConfirm` を更新:
```ts
  const partyComplete = !includeMitigations || isAssignmentComplete(assignment, detectedByRole);
  const canConfirm = preview !== null && preview.timelineEvents.length > 0 && partyComplete;
```
`handleConfirm` を override 込みに差し替え:
```ts
  const handleConfirm = useCallback(() => {
    if (entries.length === 0) return;
    const partyOverride = includeMitigations ? buildPartyOverride(assignment) : undefined;
    const result = buildPlanFromSheets(
      entries,
      { mitigations: getMitigationsFromStore(), jobs: getJobsFromStore() },
      { includeMitigations, partyOverride },
    );
    onImport(result, 'new');
    handleClose();
  }, [entries, includeMitigations, assignment, onImport, handleClose]);
```

- [ ] **Step 5: パーティピッカー JSX（プレビューの直前に挿入）**

`{/* Preview */}` ブロックの**直前**に追加。役割別グリッドで枠を整列（左寄り防止）、未割当の必須枠は赤、ジョブはローカライズ名で表示:
```tsx
            {/* Party assignment */}
            {includeMitigations && detectedJobIds.length > 0 && (
              <div className="space-y-2">
                <p className="text-app-lg text-app-text-muted uppercase tracking-wider">
                  {t('sheetImport.party_assign_label')}
                </p>
                <p className="text-app-lg text-app-text-muted/80">
                  {t('sheetImport.party_assign_hint')}
                </p>
                <div className="space-y-2">
                  {(['tank', 'healer', 'dps'] as SlotRole[])
                    .filter((role) => detectedByRole[role].length > 0)
                    .map((role) => (
                      <div
                        key={role}
                        className="grid grid-cols-[4rem_1fr] items-start gap-2"
                      >
                        <span className="text-app-lg text-app-text-muted pt-2">
                          {t(`sheetImport.party_role_${role}`)}
                        </span>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {SLOTS_BY_ROLE[role].map((slot) => {
                            const required = isSlotRequired(assignment, slot, detectedByRole);
                            return (
                              <div
                                key={slot}
                                className={clsx(
                                  'flex flex-col gap-1 p-2 rounded-lg border transition-all duration-200',
                                  required
                                    ? 'border-app-red-border bg-app-red-dim'
                                    : assignment[slot]
                                      ? 'border-app-text bg-app-text/5'
                                      : 'border-app-border',
                                )}
                              >
                                <span
                                  className={clsx(
                                    'text-app-lg font-mono',
                                    required ? 'text-app-red' : 'text-app-text-muted',
                                  )}
                                >
                                  {slot}
                                </span>
                                <select
                                  value={assignment[slot] ?? ''}
                                  onChange={(e) => handleSlotChange(slot, e.target.value || null)}
                                  className="bg-app-surface2 border border-app-border rounded-md px-1.5 py-1 text-app-2xl text-app-text focus:outline-none focus:border-app-text cursor-pointer"
                                >
                                  <option value="">{t('sheetImport.party_slot_unassigned')}</option>
                                  {detectedByRole[role].map((jid) => (
                                    <option key={jid} value={jid}>
                                      {jobName(jid)}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                </div>
                {!partyComplete && (
                  <p className="text-app-lg text-app-red">{t('sheetImport.party_incomplete')}</p>
                )}
              </div>
            )}
```
（既存のプレビュー内 `{/* Party */}`＝自動割当の読み取り専用表示は**削除**する。割り当ては上のピッカーが正本。）

- [ ] **Step 6: i18n キー（party 系）を 4言語に追加**

`src/locales/ja.json` の `sheetImport`:
```json
        "party_assign_label": "パーティの枠を割り当て",
        "party_assign_hint": "スプシのジョブを MT〜D4 に割り当ててください",
        "party_slot_unassigned": "未選択",
        "party_incomplete": "全員の枠を割り当てると作成できます",
        "party_role_tank": "タンク",
        "party_role_healer": "ヒーラー",
        "party_role_dps": "DPS",
```
`src/locales/en.json`:
```json
        "party_assign_label": "Assign party slots",
        "party_assign_hint": "Place each detected job into MT–D4",
        "party_slot_unassigned": "Unassigned",
        "party_incomplete": "Assign every job to a slot to continue",
        "party_role_tank": "Tank",
        "party_role_healer": "Healer",
        "party_role_dps": "DPS",
```
`src/locales/ko.json`:
```json
        "party_assign_label": "파티 슬롯 배정",
        "party_assign_hint": "감지된 직업을 MT~D4에 배정하세요",
        "party_slot_unassigned": "미선택",
        "party_incomplete": "모든 직업을 슬롯에 배정하면 생성할 수 있습니다",
        "party_role_tank": "탱커",
        "party_role_healer": "힐러",
        "party_role_dps": "DPS",
```
`src/locales/zh.json`:
```json
        "party_assign_label": "分配小队槽位",
        "party_assign_hint": "请将识别到的职业分配到 MT~D4",
        "party_slot_unassigned": "未选择",
        "party_incomplete": "为每个职业分配槽位后即可创建",
        "party_role_tank": "坦克",
        "party_role_healer": "治疗",
        "party_role_dps": "DPS",
```

- [ ] **Step 7: ビルドとテストで緑を確認**

Run:
```bash
npx vitest run src/lib/sheetImport > "$TEMP/vt.txt" 2>&1; echo VT=$?
npm run build > "$TEMP/build.txt" 2>&1; echo BUILD=$?
```
Expected: VT=0 / BUILD=0

- [ ] **Step 8: コミット**

```bash
rtk git add src/components/SpreadsheetImportModal.tsx src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
rtk git commit -m "feat(sheetImport): パーティ枠ピッカー(全空・全員割当までブロック・未割当赤)を追加(機能B)"
```

---

## Task 5: 仕上げ検証（ビルド・全テスト・実機ガイド）

**Files:** なし（検証のみ）

- [ ] **Step 1: lib テスト全緑**

Run: `npx vitest run src/lib/sheetImport > "$TEMP/vt.txt" 2>&1; echo EXIT=$?`
Expected: EXIT=0（detectUsedJobIds 2 / partyAssignment 10 / buildPlanFromSheets 全件）

- [ ] **Step 2: 本番ビルド緑**

Run: `npm run build > "$TEMP/build.txt" 2>&1; echo EXIT=$?`
Expected: EXIT=0（Vercel 相当の tsc -b 厳密で未使用 import/型不足が無い）

- [ ] **Step 3: 実機確認ガイドをユーザーへ提示（endpoint user verification）**

dev（`npm run dev`→5173）で確認してもらう項目:
1. モーダルを開き、フェーズ名を入れてからスプシ1タブを貼付→「追加」。名前未入力では追加できないこと。
2. 全5タブを順に追加。
3. パーティ枠が**全空**で表示され、未割当枠が**赤**になること。
4. 検出ジョブを MT〜D4 に割り当て、全員座るまで「作成」が押せないこと（理由文が出る）。残り1枠1ジョブで自動補完されること。
5. 「作成」→ タイムラインに技・軽減が出て、**ラベル**（神々の像 等）がラベル列に、**フェーズ**（入力名）がフェーズとして表示されること。
6. 軽減の持ち主が割り当てどおりであること。

- [ ] **Step 4: 見た目のスクショ承認（ui-design.md 承認フロー）**

Playwright でモーダル全体とパーティピッカーのスクショを撮りユーザーへ提示。左寄り・整列・赤強調・トンマナ（白黒＋赤）を確認。必要なら微修正。

- [ ] **Step 5: 本番再投入（ユーザー OK 後）**

版違い修正込みで全機能を本番へ戻す:
```bash
rtk git checkout main
rtk git revert b3ed41be        # revert の revert（feat は既に main 祖先のため単純 merge は無効）
rtk git merge feat/spreadsheet-import --no-ff   # 本改修2件を main へ
rtk git push
```
（push で Vercel 自動デプロイ。デプロイ後は全タブ閉じて開き直し＝[[reference_collab_two_client_version_skew]]。）

---

## Self-Review（spec 突合）

**1. Spec coverage:**
- spec §3（機能A: Phase→labels＋フェーズ名）→ Task 3。
- spec §4（機能B: ピッカー・全空・ブロック・赤・override・自動補完・枠超過）→ Task 2（純ロジック）＋ Task 4（UI）。枠超過は `isAssignmentComplete` の capacity 上限で詰み防止（Task 2 テスト済）。
- spec §3.4（Timeline labels）→ Task 3 Step 7。
- spec §5（ビジュアル/整列/赤/トークン）→ Task 4 Step 5（グリッド整列・`app-red-*`・トークン）＋ Task 5 Step 4（スクショ承認）。
- spec §6（i18n 4言語）→ Task 3 Step 8 ＋ Task 4 Step 6。
- spec §7（テスト）→ Task 1/2/3 のテスト＋ Task 5 実機。
- spec §10（再投入手順）→ Task 5 Step 5。

**2. Placeholder scan:** プレースホルダ無し（全 code block は実コード）。

**3. Type consistency:** `ImportSheet { parsed; phaseName }`・`SheetImportResult.labels: Label[]`・`buildPlanFromSheets(ImportSheet[], deps, { includeMitigations; partyOverride? })`・`PartyAssignment`/`PartySlot`/`SlotRole` は Task 2→4 で一貫。`detectUsedJobIds(ParsedSheet[])` は Task 1→3→4 で一貫。`buildPartyOverride` の戻り `{slot,jobId}[]` は `partyOverride` 型と一致。

**注意点（実装者向け）:**
- `useEffect` を SpreadsheetImportModal の React import に追加すること（現状 `useState, useCallback, useMemo` のみ）。
- ja.json 等の `sheetImport` ブロックは**末尾キーのカンマ**に注意（既存最後のキー `default_plan_title` の後ろに追記する場合はカンマを足す）。
- 既存プレビュー内の読み取り専用 Party 表示（`{/* Party */}`）は Task 4 Step 5 で削除（ピッカーが正本）。`party_label` キーは未使用化するが削除は任意（死にキー・非ブロッカー）。
