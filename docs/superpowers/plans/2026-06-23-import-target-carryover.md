# スプシ取込で攻撃に「対象(MT/ST)」をテンプレから引き継ぐ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 取込先コンテンツに管理者作成のテンプレが在るとき、スプシ取込で作る攻撃イベントへ、攻撃名でマッチした技の **対象(AoE/MT/ST) だけ**を引き継ぐ（精度優先・誤マッチ回避）。管理画面で「スプシ表記」別名を登録でき、「対象マッチ確認」で当たり具合を検証・修正できる。

**Architecture:** マッチング（正規化照合 + 別名 + 対象解決）は純粋関数モジュール `carryOverTargets.ts` に集約しユニットテスト（既存 `importBlockReason.ts`/`importWizard.ts` と同じ流儀）。取込時は `SpreadsheetImportModal.handleConfirm` で `getTemplate(contentId)` を取得し後段の独立関数で対象を補完（既存 parse/build は不変）。管理画面は TemplateEditor に「スプシ表記」列(`sheetAliases`)を足し、`SheetTargetMatchModal` で**取込時と同一関数**を使って当たり具合を表示（DRY=管理で見た結果=本番取込結果）。

**Tech Stack:** React 18 + TypeScript（strict / `tsc -b`）、react-i18next、Vitest + @testing-library/react（happy-dom）、Firestore テンプレ（`getTemplate`）。

## Global Constraints

- **引き継ぐのは target(`'AoE'|'MT'|'ST'`) のみ**。name/damage/altName/time 等は引き継がない（スプシ側不変・空欄 target を埋めるだけ）。`target` が既にある event は上書きしない。
- **精度優先**: マッチは「正規化(括弧除去/`NFKC`/空白除去)後の完全一致 + スプシ別名一致」のみ。**編集距離の曖昧一致はやらない**（誤マッチ=タンバスMT/STの誤付けは有害）。
- **テンプレが在るときだけ**: `contentId` null / テンプレ無し / fetch 失敗 / 未マッチ → **何もしない**（既存挙動を壊さない・取込自体は止めない）。
- 同名で target 食い違い → 時刻最近傍。最近傍が等距離で食い違う → `undefined`（推測しない）。
- 既存の取込ロジック（`parseMitigationSheet`/`buildPlanFromSheets`）・既存テンプレ機能・ユーザープランデータは**不変**。`sheetAliases` は任意フィールドで後方互換。
- i18n: 新規 UI 文字列は `t()` 経由・`admin.*` を ja/en/ko/zh の **4 言語すべて**に追加（`.claude/rules/i18n.md`）。
- デザイン: 管理画面は既存トーン（`bg-app-bg`/`border-app-text/10`/機能色ボタン）に準拠。
- push 前ゲート: `npm run build`(tsc -b 厳密) + `npx vitest run` 必須（[[feedback_vercel_tsc_strict]]）。コマンドは PowerShell で実行。
- 言語: コメント・コミットは日本語。

---

### Task 1: マッチング純粋モジュール `carryOverTargets.ts` + 型追加

新規の純粋ロジックを切り出してユニットテストする。取込・管理プレビュー双方がこのモジュールを使う（DRY）。

**Files:**
- Modify: `src/types/index.ts`（`TimelineEvent` に `sheetAliases?: string[]` を追加）
- Modify: `src/lib/sheetImport/resolveSheetSkill.ts`（`stripParenthetical` を `export` 化＝DRY 再利用）
- Create: `src/lib/sheetImport/carryOverTargets.ts`
- Test: `src/lib/sheetImport/__tests__/carryOverTargets.test.ts`

**Interfaces:**
- Produces（Task 2/3/4 が import）:
  - `type SheetMatchRow = { action: string; status: 'carried' | 'matched_no_target' | 'unmatched'; templateName: string | null; target: 'AoE' | 'MT' | 'ST' | null }`
  - `normalizeAttackName(s: string): string`
  - `parseSheetAliases(input: string): string[]`
  - `findTemplateAttacks(actionName: string, templateEvents: TimelineEvent[]): TimelineEvent[]`
  - `resolveTargetFromMatches(matches: TimelineEvent[], time: number): 'AoE' | 'MT' | 'ST' | undefined`
  - `matchTemplateTarget(actionName: string, time: number, templateEvents: TimelineEvent[]): 'AoE' | 'MT' | 'ST' | undefined`
  - `applyTargetsFromTemplate(events: TimelineEvent[], templateEvents: TimelineEvent[]): TimelineEvent[]`
  - `buildSheetMatchReport(rows: { action: string; time: number }[], templateEvents: TimelineEvent[]): SheetMatchRow[]`
  - `TimelineEvent.sheetAliases?: string[]`

- [ ] **Step 1: 型と export を準備**

`src/types/index.ts` の `TimelineEvent` の `altName?` の直後に追加:

```ts
    /** 2択攻撃の代替名（"A or B" の B）。無し/空 = 通常イベント。名前だけ変わりダメージ等は共通。 */
    altName?: LocalizedString;
    /** スプシ取込の対象引き継ぎ用。この技がスプレッドシートでどう書かれるかの別名集合（管理画面で登録）。テンプレ攻撃のみ使用・ユーザープランでは未使用。 */
    sheetAliases?: string[];
```

`src/lib/sheetImport/resolveSheetSkill.ts` の `stripParenthetical` に `export` を付ける（他は不変）:

```ts
/** 末尾の括弧（全角/半角）以降を除去 */
export function stripParenthetical(name: string): string {
  return name.replace(/[（(].*$/, '').trim();
}
```

- [ ] **Step 2: 失敗するテストを書く**

Create `src/lib/sheetImport/__tests__/carryOverTargets.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { TimelineEvent } from '../../../types';
import {
  normalizeAttackName, parseSheetAliases, findTemplateAttacks,
  resolveTargetFromMatches, matchTemplateTarget, applyTargetsFromTemplate, buildSheetMatchReport,
} from '../carryOverTargets';

const ev = (over: Partial<TimelineEvent>): TimelineEvent => ({
  id: over.id ?? 'x', time: over.time ?? 0,
  name: over.name ?? { ja: '', en: '' },
  damageType: 'magical',
  ...over,
});

describe('normalizeAttackName', () => {
  it('括弧以降除去・全半角統一・空白除去', () => {
    expect(normalizeAttackName('リプライザル（範囲）')).toBe('リプライザル');
    expect(normalizeAttackName('Ａ Ｂ Ｃ')).toBe('ABC'); // NFKC 全角→半角 + 空白除去
    expect(normalizeAttackName('  裁きの 光 ')).toBe('裁きの光');
  });
});

describe('parseSheetAliases', () => {
  it('カンマ/改行区切り→trim→空除去', () => {
    expect(parseSheetAliases('散開, まとまる\n 集合 ')).toEqual(['散開', 'まとまる', '集合']);
    expect(parseSheetAliases('   ')).toEqual([]);
  });
});

describe('findTemplateAttacks', () => {
  const tpl = [
    ev({ id: 't1', name: { ja: 'アクモーン', en: 'Akh Morn' }, target: 'MT' }),
    ev({ id: 't2', name: { ja: '雷神の怒り', en: 'x' }, sheetAliases: ['カミナリ'] }),
  ];
  it('name.ja 正規化一致', () => {
    expect(findTemplateAttacks('アクモーン（連続）', tpl).map((e) => e.id)).toEqual(['t1']);
  });
  it('別名一致', () => {
    expect(findTemplateAttacks('カミナリ', tpl).map((e) => e.id)).toEqual(['t2']);
  });
  it('一致なし→空', () => {
    expect(findTemplateAttacks('存在しない技', tpl)).toEqual([]);
  });
});

describe('resolveTargetFromMatches', () => {
  it('target undefined は無視', () => {
    expect(resolveTargetFromMatches([ev({ target: undefined })], 0)).toBeUndefined();
  });
  it('target 1種→確定', () => {
    expect(resolveTargetFromMatches([ev({ target: 'MT' }), ev({ target: undefined })], 0)).toBe('MT');
  });
  it('食い違い→時刻最近傍', () => {
    const m = [ev({ time: 10, target: 'MT' }), ev({ time: 100, target: 'ST' })];
    expect(resolveTargetFromMatches(m, 90)).toBe('ST');
  });
  it('最近傍が等距離で食い違い→undefined(推測しない)', () => {
    const m = [ev({ time: 0, target: 'MT' }), ev({ time: 20, target: 'ST' })];
    expect(resolveTargetFromMatches(m, 10)).toBeUndefined();
  });
});

describe('matchTemplateTarget', () => {
  const tpl = [ev({ name: { ja: 'アクモーン', en: 'x' }, time: 50, target: 'MT' })];
  it('一致して target を返す', () => {
    expect(matchTemplateTarget('アクモーン', 50, tpl)).toBe('MT');
  });
  it('未マッチ→undefined', () => {
    expect(matchTemplateTarget('別の技', 50, tpl)).toBeUndefined();
  });
});

describe('applyTargetsFromTemplate', () => {
  const tpl = [ev({ name: { ja: 'アクモーン', en: 'x' }, time: 50, target: 'MT' })];
  it('target 空の event を補完(非破壊)', () => {
    const events = [ev({ id: 'e1', name: { ja: 'アクモーン', en: 'x' }, time: 50 })];
    const out = applyTargetsFromTemplate(events, tpl);
    expect(out[0].target).toBe('MT');
    expect(events[0].target).toBeUndefined(); // 入力非破壊
  });
  it('既に target ある event は上書きしない', () => {
    const events = [ev({ name: { ja: 'アクモーン', en: 'x' }, time: 50, target: 'ST' })];
    expect(applyTargetsFromTemplate(events, tpl)[0].target).toBe('ST');
  });
  it('未マッチ event はそのまま', () => {
    const events = [ev({ name: { ja: '別技', en: 'x' }, time: 50 })];
    expect(applyTargetsFromTemplate(events, tpl)[0].target).toBeUndefined();
  });
});

describe('buildSheetMatchReport', () => {
  const tpl = [
    ev({ name: { ja: 'アクモーン', en: 'x' }, time: 50, target: 'MT' }),
    ev({ name: { ja: '無対象技', en: 'x' }, time: 60 }), // target なし
  ];
  it('carried / matched_no_target / unmatched を分類・重複 action は1回', () => {
    const rows = [
      { action: 'アクモーン', time: 50 },
      { action: 'アクモーン', time: 99 }, // 重複→無視
      { action: '無対象技', time: 60 },
      { action: '知らない技', time: 70 },
    ];
    const rep = buildSheetMatchReport(rows, tpl);
    expect(rep).toEqual([
      { action: 'アクモーン', status: 'carried', templateName: 'アクモーン', target: 'MT' },
      { action: '無対象技', status: 'matched_no_target', templateName: '無対象技', target: null },
      { action: '知らない技', status: 'unmatched', templateName: null, target: null },
    ]);
  });
});
```

- [ ] **Step 3: テストが失敗することを確認**

Run（PowerShell）: `npx vitest run src/lib/sheetImport/__tests__/carryOverTargets.test.ts`
Expected: FAIL（`Cannot find module '../carryOverTargets'`）

- [ ] **Step 4: 実装**

Create `src/lib/sheetImport/carryOverTargets.ts`:

```ts
/**
 * スプシ取込の「攻撃の対象(AoE/MT/ST)引き継ぎ」用の純粋マッチング。
 * 取込時(applyTargetsFromTemplate) と 管理プレビュー(buildSheetMatchReport) の双方が使う(DRY)。
 *
 * 精度優先: 正規化後の完全一致 + スプシ別名一致のみ。編集距離の曖昧一致はしない
 * (対象の誤付け=タンバスMT/ST誤誘導が有害)。自信が無ければ付けない(undefined)。
 */
import type { TimelineEvent } from '../../types';
import { stripParenthetical } from './resolveSheetSkill';

export type CarryTarget = 'AoE' | 'MT' | 'ST';

export interface SheetMatchRow {
  action: string;
  status: 'carried' | 'matched_no_target' | 'unmatched';
  templateName: string | null;
  target: CarryTarget | null;
}

/** 攻撃名の正規化: 末尾括弧除去 → NFKC(全半角統一) → 空白除去 → trim。 */
export function normalizeAttackName(s: string): string {
  return stripParenthetical(s).normalize('NFKC').replace(/\s+/g, '').trim();
}

/** 「スプシ表記」入力(カンマ/改行区切り)を string[] へ。trim・空除去。 */
export function parseSheetAliases(input: string): string[] {
  return input.split(/[,、\n]/).map((s) => s.trim()).filter((s) => s.length > 0);
}

/** action 名がテンプレ技に一致するか(name.ja 正規化一致 or 別名正規化一致)。 */
function matches(actionName: string, ev: TimelineEvent): boolean {
  const n = normalizeAttackName(actionName);
  if (normalizeAttackName(ev.name.ja) === n) return true;
  return (ev.sheetAliases ?? []).some((a) => normalizeAttackName(a) === n);
}

/** action 名に一致するテンプレ技を全件返す(入力順)。 */
export function findTemplateAttacks(actionName: string, templateEvents: TimelineEvent[]): TimelineEvent[] {
  return templateEvents.filter((ev) => matches(actionName, ev));
}

/**
 * 候補から対象を解決。target undefined 候補は無視。1種なら確定。
 * 食い違いは時刻最近傍。最近傍が等距離で食い違うなら undefined(推測しない)。
 */
export function resolveTargetFromMatches(matchesList: TimelineEvent[], time: number): CarryTarget | undefined {
  const withTarget = matchesList.filter((m): m is TimelineEvent & { target: CarryTarget } => m.target !== undefined);
  if (withTarget.length === 0) return undefined;
  const distinct = new Set(withTarget.map((m) => m.target));
  if (distinct.size === 1) return withTarget[0].target;
  const minDist = Math.min(...withTarget.map((m) => Math.abs(m.time - time)));
  const nearest = withTarget.filter((m) => Math.abs(m.time - time) === minDist);
  const nearestTargets = new Set(nearest.map((m) => m.target));
  return nearestTargets.size === 1 ? nearest[0].target : undefined;
}

/** action 名+時刻 → 引き継ぐ対象(なければ undefined)。 */
export function matchTemplateTarget(actionName: string, time: number, templateEvents: TimelineEvent[]): CarryTarget | undefined {
  return resolveTargetFromMatches(findTemplateAttacks(actionName, templateEvents), time);
}

/** target が空の event だけテンプレから対象を補完(非破壊・新配列)。 */
export function applyTargetsFromTemplate(events: TimelineEvent[], templateEvents: TimelineEvent[]): TimelineEvent[] {
  return events.map((ev) => {
    if (ev.target !== undefined) return ev;
    const target = matchTemplateTarget(ev.name.ja, ev.time, templateEvents);
    return target !== undefined ? { ...ev, target } : ev;
  });
}

/** 管理プレビュー用: スプシ各 action のマッチ結果一覧(action 重複は初出のみ)。 */
export function buildSheetMatchReport(
  rows: { action: string; time: number }[],
  templateEvents: TimelineEvent[],
): SheetMatchRow[] {
  const seen = new Set<string>();
  const out: SheetMatchRow[] = [];
  for (const { action, time } of rows) {
    if (seen.has(action)) continue;
    seen.add(action);
    const found = findTemplateAttacks(action, templateEvents);
    if (found.length === 0) {
      out.push({ action, status: 'unmatched', templateName: null, target: null });
      continue;
    }
    const target = resolveTargetFromMatches(found, time);
    if (target === undefined) {
      out.push({ action, status: 'matched_no_target', templateName: found[0].name.ja, target: null });
      continue;
    }
    const named = found.find((m) => m.target === target) ?? found[0];
    out.push({ action, status: 'carried', templateName: named.name.ja, target });
  }
  return out;
}
```

- [ ] **Step 5: テストが通ることを確認**

Run（PowerShell）: `npx vitest run src/lib/sheetImport/__tests__/carryOverTargets.test.ts`
Expected: PASS（全 describe 緑）

- [ ] **Step 6: 型チェック**

Run（PowerShell）: `npm run build`
Expected: tsc 成功（`sheetAliases` 追加・`stripParenthetical` export が他を壊さない）

- [ ] **Step 7: コミット**

```bash
rtk git add src/types/index.ts src/lib/sheetImport/resolveSheetSkill.ts src/lib/sheetImport/carryOverTargets.ts src/lib/sheetImport/__tests__/carryOverTargets.test.ts
rtk git commit -m "feat(import): 対象引き継ぎの純粋マッチングモジュール+TimelineEvent.sheetAliases 追加"
```

---

### Task 2: 取込時に対象を補完（`applyTemplateTargets.ts` + handleConfirm 配線）

**Files:**
- Create: `src/lib/sheetImport/applyTemplateTargets.ts`
- Modify: `src/components/SpreadsheetImportModal.tsx`（import 追加 + `handleConfirm` に 1 行）
- Test: `src/lib/sheetImport/__tests__/applyTemplateTargets.test.ts`

**Interfaces:**
- Consumes（Task 1）: `applyTargetsFromTemplate`。
- Consumes（既存）: `getTemplate(contentId: string): Promise<TemplateData | null>`（[templateLoader.ts:112](src/data/templateLoader.ts#L112)）、`SheetImportResult`（[buildPlanFromSheets.ts:8](src/lib/sheetImport/buildPlanFromSheets.ts#L8)）。
- Produces: `applyTemplateTargetsToResult(result: SheetImportResult, contentId: string | null): Promise<SheetImportResult>`。

- [ ] **Step 1: 失敗するテストを書く**

Create `src/lib/sheetImport/__tests__/applyTemplateTargets.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SheetImportResult } from '../buildPlanFromSheets';

const getTemplate = vi.fn();
vi.mock('../../../data/templateLoader', () => ({ getTemplate: (id: string) => getTemplate(id) }));

import { applyTemplateTargetsToResult } from '../applyTemplateTargets';

const baseResult = (): SheetImportResult => ({
  timelineEvents: [
    { id: 'e1', time: 50, name: { ja: 'アクモーン', en: 'x' }, damageType: 'magical' },
  ],
  timelineMitigations: [], phases: [], labels: [], party: [], skipped: [],
});

beforeEach(() => getTemplate.mockReset());

describe('applyTemplateTargetsToResult', () => {
  it('contentId null → そのまま(getTemplate 呼ばない)', async () => {
    const r = baseResult();
    const out = await applyTemplateTargetsToResult(r, null);
    expect(out).toBe(r);
    expect(getTemplate).not.toHaveBeenCalled();
  });

  it('テンプレ有 → 一致 event の target を補完', async () => {
    getTemplate.mockResolvedValue({
      contentId: 'm4s', generatedAt: '', sourceLogsCount: 0, phases: [],
      timelineEvents: [{ id: 't1', time: 50, name: { ja: 'アクモーン', en: 'x' }, damageType: 'magical', target: 'MT' }],
    });
    const out = await applyTemplateTargetsToResult(baseResult(), 'm4s');
    expect(out.timelineEvents[0].target).toBe('MT');
  });

  it('テンプレ null → そのまま', async () => {
    getTemplate.mockResolvedValue(null);
    const r = baseResult();
    expect(await applyTemplateTargetsToResult(r, 'm4s')).toBe(r);
  });

  it('getTemplate 失敗 → 握って そのまま(取込は止めない)', async () => {
    getTemplate.mockRejectedValue(new Error('network'));
    const r = baseResult();
    expect(await applyTemplateTargetsToResult(r, 'm4s')).toBe(r);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run（PowerShell）: `npx vitest run src/lib/sheetImport/__tests__/applyTemplateTargets.test.ts`
Expected: FAIL（`Cannot find module '../applyTemplateTargets'`）

- [ ] **Step 3: 実装**

Create `src/lib/sheetImport/applyTemplateTargets.ts`:

```ts
/**
 * スプシ取込結果に、取込先コンテンツのテンプレ由来の対象(target)を補完する。
 * テンプレが無い/取得失敗/未マッチは何もしない(取込自体は止めない)。
 */
import type { SheetImportResult } from './buildPlanFromSheets';
import { getTemplate } from '../../data/templateLoader';
import { applyTargetsFromTemplate } from './carryOverTargets';

export async function applyTemplateTargetsToResult(
  result: SheetImportResult,
  contentId: string | null,
): Promise<SheetImportResult> {
  if (!contentId) return result;
  let template;
  try {
    template = await getTemplate(contentId);
  } catch {
    return result; // 取得失敗は握る(取込は続行)
  }
  if (!template || !template.timelineEvents || template.timelineEvents.length === 0) return result;
  return {
    ...result,
    timelineEvents: applyTargetsFromTemplate(result.timelineEvents, template.timelineEvents),
  };
}
```

- [ ] **Step 4: テストが通ることを確認**

Run（PowerShell）: `npx vitest run src/lib/sheetImport/__tests__/applyTemplateTargets.test.ts`
Expected: PASS（4 it 緑）

- [ ] **Step 5: `handleConfirm` に配線**

`src/components/SpreadsheetImportModal.tsx` の import 群に追加（他の `../lib/sheetImport/*` import の近く）:

```tsx
import { applyTemplateTargetsToResult } from '../lib/sheetImport/applyTemplateTargets';
```

`handleConfirm` の `buildPlanFromSheets(...)` と `onImport(...)` の間に1行挟む（旧 → 新）:

```tsx
  const handleConfirm = useCallback(async () => {
    if (entries.length === 0) return;
    const partyOverride = includeMitigations ? buildPartyOverride(assignment) : undefined;
    const result = buildPlanFromSheets(
      entries,
      { mitigations: getMitigationsFromStore(), jobs: getJobsFromStore() },
      { includeMitigations, partyOverride },
    );
    // 取込先テンプレが在れば攻撃の対象(MT/ST)を補完(無ければ素通り)
    const finalResult = await applyTemplateTargetsToResult(result, selectedContentId);
    const committed = await onImport(finalResult, { contentId: selectedContentId });
    if (committed) handleClose();
  }, [entries, includeMitigations, assignment, onImport, handleClose, selectedContentId]);
```

- [ ] **Step 6: 型チェック + 全テスト**

Run（PowerShell）: `npm run build`
Expected: tsc 成功

Run（PowerShell）: `npx vitest run`
Expected: 新規緑・既存の緑数維持（既知 failure=`TopBar.test.tsx`×4 + `HousingWorkspace.test.tsx`×1 のみ許容）

- [ ] **Step 7: コミット**

```bash
rtk git add src/lib/sheetImport/applyTemplateTargets.ts src/lib/sheetImport/__tests__/applyTemplateTargets.test.ts src/components/SpreadsheetImportModal.tsx
rtk git commit -m "feat(import): 取込確定時にテンプレ由来の対象(MT/ST)を補完する配線"
```

---

### Task 3: 管理画面 TemplateEditor に「スプシ表記」列を追加

`sheetAliases` を管理画面で編集・保存できるようにする（マッチの「修正」手段）。

**Files:**
- Modify: `src/hooks/useTemplateEditor.ts`（`updateCell` の switch に `case 'sheetAliases'`）
- Modify: `src/components/admin/TemplateEditor.tsx`（colgroup / thead / tbody に列1つ）
- Modify: `src/locales/{ja,en,ko,zh}.json`（`admin.tpl_editor_sheet_aliases`）
- Test: `src/hooks/__tests__/useTemplateEditor.test.ts`（`sheetAliases` 編集の it を追加）

**Interfaces:**
- Consumes（Task 1）: `parseSheetAliases`。
- 既存編集経路 `onUpdateCell(eventId, field, value)` → `useTemplateEditor.updateCell`。`default: return prev` のため **case 追加が必須**（[useTemplateEditor.ts:180](src/hooks/useTemplateEditor.ts#L180)）。保存は POST 全置換で whitelist 無し → case さえ足せば永続化される。

- [ ] **Step 1: 失敗するテストを書く**

`src/hooks/__tests__/useTemplateEditor.test.ts` の既存 describe 内に追加（`renderHook`/`act` は同ファイルの既存テストに倣う。先頭 import に無ければ `import { renderHook, act } from '@testing-library/react';` を追加）:

```ts
  it('sheetAliases を編集すると配列で保存データに乗る・空配列で削除', () => {
    const { result } = renderHook(() => useTemplateEditor());
    act(() => {
      result.current.loadEvents(
        [{ id: 'e1', time: 10, name: { ja: 'アクモーン', en: 'x' }, damageType: 'magical' }],
        [],
      );
    });
    act(() => { result.current.updateCell('e1', 'sheetAliases', ['散開', 'まとまる']); });
    expect(result.current.getSaveData().events[0].sheetAliases).toEqual(['散開', 'まとまる']);
    act(() => { result.current.updateCell('e1', 'sheetAliases', []); });
    expect(result.current.getSaveData().events[0].sheetAliases).toBeUndefined();
  });
```

- [ ] **Step 2: テストが失敗することを確認**

Run（PowerShell）: `npx vitest run src/hooks/__tests__/useTemplateEditor.test.ts`
Expected: FAIL（`case 'sheetAliases'` 未実装＝`default: return prev` で書き込み無視され `sheetAliases` が undefined のまま）

- [ ] **Step 3: `updateCell` に case を追加**

`src/hooks/useTemplateEditor.ts` の `switch` 内、`case 'target':` ブロックの直後に追加:

```ts
          case 'target':
            ev.target = value as TimelineEvent['target'];
            break;
          case 'sheetAliases': {
            const arr = value as string[];
            if (arr.length === 0) delete ev.sheetAliases;
            else ev.sheetAliases = arr;
            break;
          }
```

- [ ] **Step 4: テストが通ることを確認**

Run（PowerShell）: `npx vitest run src/hooks/__tests__/useTemplateEditor.test.ts`
Expected: PASS

- [ ] **Step 5: i18n キーを4言語追加**

各 `src/locales/{lang}.json` の `admin` オブジェクト内、`tpl_editor_target` の隣に追加（末尾カンマに注意・他キー不変）:

- ja: `"tpl_editor_sheet_aliases": "スプシ表記",`
- en: `"tpl_editor_sheet_aliases": "Sheet name",`
- ko: `"tpl_editor_sheet_aliases": "스프시 표기",`
- zh: `"tpl_editor_sheet_aliases": "表格名称",`

- [ ] **Step 6: TemplateEditor に列を追加（colgroup / thead / tbody の3箇所）**

`src/components/admin/TemplateEditor.tsx`:

(6a) import に `parseSheetAliases` を追加（既存 import 群へ）:

```tsx
import { parseSheetAliases } from '../../lib/sheetImport/carryOverTargets';
```

(6b) `<colgroup>` 内、`{/* 対象 */}` の `<col>` の直後に追加:

```tsx
          <col style={{ width: '60px' }} />  {/* 対象 */}
          <col className="min-w-[110px]" />  {/* スプシ表記 */}
```

(6c) `<thead>` の `{t('admin.tpl_editor_target')}` の `<th>` の直後に追加:

```tsx
            <th className="pb-2 pr-2 font-normal">{t('admin.tpl_editor_target')}</th>
            <th className="pb-2 pr-2 font-normal">{t('admin.tpl_editor_sheet_aliases')}</th>
```

(6d) `<tbody>` の「{/* 対象 */}」セル（`DropdownCell` の `</td>`）の直後に追加:

```tsx
                {/* 対象 */}
                <td className={`py-1 pr-2 ${highlightClass(targetHighlight)}`}>
                  <DropdownCell
                    value={event.target ?? 'AoE'}
                    options={targetOptions}
                    highlight={targetHighlight}
                    onCommit={(val) => onUpdateCell(evId, 'target', val)}
                  />
                </td>

                {/* スプシ表記 */}
                <td className="py-1 pr-2">
                  <EditableCell
                    value={event.sheetAliases?.join(', ') ?? ''}
                    onCommit={(val) => onUpdateCell(evId, 'sheetAliases', parseSheetAliases(val))}
                  />
                </td>
```

- [ ] **Step 7: 型チェック + テスト**

Run（PowerShell）: `npm run build`
Expected: tsc 成功（`EditableCell` の必須 prop は `value`/`onCommit` のみ＝他セルと同様。`highlight` 等は任意）

Run（PowerShell）: `npx vitest run src/hooks/__tests__/useTemplateEditor.test.ts`
Expected: PASS

- [ ] **Step 8: コミット**

```bash
rtk git add src/hooks/useTemplateEditor.ts src/components/admin/TemplateEditor.tsx src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json src/hooks/__tests__/useTemplateEditor.test.ts
rtk git commit -m "feat(admin): テンプレ編集に「スプシ表記」列(sheetAliases)を追加(対象マッチ別名)"
```

---

### Task 4: 管理画面「対象マッチ確認」モーダル

標準スプシを貼って、技ごとの対象引き継ぎ結果（✓/△/✗）を確認する。照合は Task 1 の同一関数（DRY）。

**Files:**
- Create: `src/components/admin/SheetTargetMatchModal.tsx`
- Modify: `src/components/admin/TemplateEditorToolbar.tsx`（ボタン1つ + prop）
- Modify: `src/components/admin/AdminTemplates.tsx`（state + prop 配線 + モーダル配置）
- Modify: `src/locales/{ja,en,ko,zh}.json`（`admin.tpl_sheet_match_*`）
- Test: `src/components/admin/__tests__/SheetTargetMatchModal.test.tsx`

**Interfaces:**
- Consumes（Task 1）: `buildSheetMatchReport`, `SheetMatchRow`。
- Consumes（既存）: `parseMitigationSheet(text): ParsedSheet | null`（[parseMitigationSheet.ts](src/lib/sheetImport/parseMitigationSheet.ts)）、`editor.visibleEvents`（現在のテンプレ技・[AdminTemplates.tsx:563](src/components/admin/AdminTemplates.tsx#L563) と同様に渡す）。

- [ ] **Step 1: 失敗するテストを書く**

Create `src/components/admin/__tests__/SheetTargetMatchModal.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: any) => (o && typeof o === 'object' ? `${k}:${JSON.stringify(o)}` : k), i18n: { language: 'ja' } }),
}));

import { SheetTargetMatchModal } from '../SheetTargetMatchModal';
import type { TimelineEvent } from '../../../types';

const tpl: TimelineEvent[] = [
  { id: 't1', time: 50, name: { ja: 'アクモーン', en: 'x' }, damageType: 'magical', target: 'MT' },
];

describe('SheetTargetMatchModal', () => {
  it('isOpen=false は何も描画しない', () => {
    const { container } = render(
      <SheetTargetMatchModal isOpen={false} onClose={() => {}} templateEvents={tpl} />,
    );
    expect(container.querySelector('textarea')).toBeNull();
  });

  it('isOpen=true でタイトルと貼付欄が出る', () => {
    render(<SheetTargetMatchModal isOpen onClose={() => {}} templateEvents={tpl} />);
    expect(screen.getByText('admin.tpl_sheet_match_title')).toBeTruthy();
    expect(document.querySelector('textarea')).toBeTruthy();
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run（PowerShell）: `npx vitest run src/components/admin/__tests__/SheetTargetMatchModal.test.tsx`
Expected: FAIL（`Cannot find module '../SheetTargetMatchModal'`）

- [ ] **Step 3: モーダルを実装**

Create `src/components/admin/SheetTargetMatchModal.tsx`（shell は [FflogsTimelineImportModal.tsx](src/components/admin/FflogsTimelineImportModal.tsx) に倣う）:

```tsx
/**
 * 「対象マッチ確認」モーダル。標準スプシを貼り付けると、各攻撃名がテンプレのどの技に
 * 当たり、どの対象(MT/ST/AoE)が引き継がれるかを一覧表示する。照合は取込時と同一関数。
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useEscapeClose } from '../../hooks/useEscapeClose';
import { parseMitigationSheet } from '../../lib/sheetImport/parseMitigationSheet';
import { buildSheetMatchReport, type SheetMatchRow } from '../../lib/sheetImport/carryOverTargets';
import type { TimelineEvent } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  templateEvents: TimelineEvent[];
}

export function SheetTargetMatchModal({ isOpen, onClose, templateEvents }: Props) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [report, setReport] = useState<SheetMatchRow[] | null>(null);
  const [parseError, setParseError] = useState(false);

  useEscapeClose(isOpen, onClose);
  if (!isOpen) return null;

  const handleClose = () => {
    setText('');
    setReport(null);
    setParseError(false);
    onClose();
  };

  const handleCheck = () => {
    const parsed = parseMitigationSheet(text);
    if (!parsed) {
      setParseError(true);
      setReport(null);
      return;
    }
    setParseError(false);
    const rows = parsed.rows.map((r) => ({ action: r.action, time: r.totalTimeSec }));
    setReport(buildSheetMatchReport(rows, templateEvents));
  };

  const counts = report
    ? {
        carried: report.filter((r) => r.status === 'carried').length,
        noTarget: report.filter((r) => r.status === 'matched_no_target').length,
        unmatched: report.filter((r) => r.status === 'unmatched').length,
      }
    : null;

  const btnBase = 'px-3 py-1.5 text-app-lg rounded cursor-pointer transition-colors border';
  const btnBlue = `${btnBase} border-blue-500/40 text-blue-400 hover:bg-blue-500/10`;
  const btnMuted = `${btnBase} border-app-text/20 text-app-text-muted hover:bg-app-text/5`;

  const modal = (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60" onClick={handleClose}>
      <div
        className="bg-app-bg border border-app-text/10 rounded-lg p-6 w-full max-w-lg max-h-[85vh] flex flex-col space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-app-2xl font-bold">{t('admin.tpl_sheet_match_title')}</p>
        <p className="text-app-base text-app-text-muted">{t('admin.tpl_sheet_match_hint')}</p>

        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setParseError(false); }}
          placeholder={t('admin.tpl_sheet_match_placeholder')}
          className="w-full h-28 bg-transparent border border-app-text/20 rounded p-2 text-app-lg font-mono text-app-text focus:outline-none focus:border-app-text/50 resize-none"
          spellCheck={false}
        />

        {parseError && (
          <p className="text-app-lg text-red-400">{t('admin.tpl_sheet_match_parse_failed')}</p>
        )}

        {counts && (
          <p className="text-app-base text-app-text-muted">
            {t('admin.tpl_sheet_match_summary', counts)}
          </p>
        )}

        {report && (
          <div className="overflow-y-auto border border-app-text/10 rounded">
            <table className="w-full text-app-lg border-collapse">
              <tbody>
                {report.map((r) => (
                  <tr key={r.action} className="border-b border-app-text/5">
                    <td className="py-1 px-2 text-app-text">{r.action}</td>
                    <td className="py-1 px-2 text-right whitespace-nowrap">
                      {r.status === 'carried' && (
                        <span className="text-emerald-400">✓ {r.templateName} / {r.target}</span>
                      )}
                      {r.status === 'matched_no_target' && (
                        <span className="text-amber-400">△ {r.templateName} / {t('admin.tpl_sheet_match_no_target')}</span>
                      )}
                      {r.status === 'unmatched' && (
                        <span className="text-app-text-muted">✗ {t('admin.tpl_sheet_match_unmatched')}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={handleClose} className={btnMuted}>{t('admin.cancel')}</button>
          <button onClick={handleCheck} disabled={!text.trim()} className={`${btnBlue} disabled:opacity-40 disabled:cursor-not-allowed`}>
            {t('admin.tpl_sheet_match_check')}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
```

- [ ] **Step 4: モーダルテストが通ることを確認**

Run（PowerShell）: `npx vitest run src/components/admin/__tests__/SheetTargetMatchModal.test.tsx`
Expected: PASS（2 it 緑）

- [ ] **Step 5: ツールバーにボタンを追加**

`src/components/admin/TemplateEditorToolbar.tsx`:

(5a) interface に prop 追加（`onOpenBulkEdit` の隣）:

```tsx
  selectedCount: number;
  onOpenBulkEdit: () => void;
  onOpenSheetMatch: () => void;
```

(5b) 関数引数の分割代入に追加:

```tsx
  selectedCount,
  onOpenBulkEdit,
  onOpenSheetMatch,
}: TemplateEditorToolbarProps) {
```

(5c) FFLogs 取り込みボタン（`onOpenFflogsTimelineImport`）の直後にボタン追加:

```tsx
      <button
        type="button"
        onClick={onOpenSheetMatch}
        disabled={!hasEvents}
        className={`${baseButtonClass} border-teal-500/40 text-teal-400 hover:bg-teal-500/10`}
      >
        {t('admin.tpl_sheet_match_btn')}
      </button>
```

- [ ] **Step 6: AdminTemplates に配線**

`src/components/admin/AdminTemplates.tsx`:

(6a) import 追加:

```tsx
import { SheetTargetMatchModal } from './SheetTargetMatchModal';
```

(6b) モーダル表示フラグ state を追加（`showFflogsImportModal` の隣・[AdminTemplates.tsx:66](src/components/admin/AdminTemplates.tsx#L66)）:

```tsx
  const [showFflogsImportModal, setShowFflogsImportModal] = useState(false);
  const [showSheetMatchModal, setShowSheetMatchModal] = useState(false);
```

(6c) `<TemplateEditorToolbar>` の props に追加（`onOpenBulkEdit` の隣）:

```tsx
            onOpenBulkEdit={() => setShowBulkEdit(true)}
            onOpenSheetMatch={() => setShowSheetMatchModal(true)}
```

(6d) `<FflogsTimelineImportModal .../>` の直後（`</AdminPage>` の前）にモーダル配置:

```tsx
      <SheetTargetMatchModal
        isOpen={showSheetMatchModal}
        onClose={() => setShowSheetMatchModal(false)}
        templateEvents={editor.visibleEvents}
      />
```

- [ ] **Step 7: i18n キーを4言語追加**

各 `src/locales/{lang}.json` の `admin` オブジェクト内に追加（既存キーの末尾カンマに注意）:

ja:
```json
        "tpl_sheet_match_btn": "対象マッチ確認",
        "tpl_sheet_match_title": "対象マッチ確認（スプシ→テンプレ）",
        "tpl_sheet_match_hint": "標準スプレッドシートを貼り付けて、各攻撃にどの対象が引き継がれるか確認します。",
        "tpl_sheet_match_placeholder": "スプレッドシートを全選択(Ctrl+A)してコピーし、ここに貼り付け",
        "tpl_sheet_match_check": "確認する",
        "tpl_sheet_match_parse_failed": "データ表が見つかりません。全選択してコピーし直してください。",
        "tpl_sheet_match_summary": "引き継ぎ {{carried}} / 対象未設定 {{noTarget}} / 未マッチ {{unmatched}}",
        "tpl_sheet_match_no_target": "対象未設定",
        "tpl_sheet_match_unmatched": "未マッチ",
```

en:
```json
        "tpl_sheet_match_btn": "Check target match",
        "tpl_sheet_match_title": "Target match check (sheet → template)",
        "tpl_sheet_match_hint": "Paste the standard spreadsheet to see which target each attack will inherit.",
        "tpl_sheet_match_placeholder": "Select all (Ctrl+A) in your spreadsheet, copy, and paste here",
        "tpl_sheet_match_check": "Check",
        "tpl_sheet_match_parse_failed": "No data table found. Select all and copy again.",
        "tpl_sheet_match_summary": "Carried {{carried}} / No target {{noTarget}} / Unmatched {{unmatched}}",
        "tpl_sheet_match_no_target": "no target",
        "tpl_sheet_match_unmatched": "unmatched",
```

ko:
```json
        "tpl_sheet_match_btn": "대상 매칭 확인",
        "tpl_sheet_match_title": "대상 매칭 확인 (스프시 → 템플릿)",
        "tpl_sheet_match_hint": "표준 스프레드시트를 붙여넣어 각 공격에 어떤 대상이 인계되는지 확인합니다.",
        "tpl_sheet_match_placeholder": "스프레드시트를 전체 선택(Ctrl+A)하여 복사한 후 여기에 붙여넣기",
        "tpl_sheet_match_check": "확인",
        "tpl_sheet_match_parse_failed": "데이터 표를 찾을 수 없습니다. 전체 선택하여 다시 복사해 주세요.",
        "tpl_sheet_match_summary": "인계 {{carried}} / 대상 미설정 {{noTarget}} / 미매칭 {{unmatched}}",
        "tpl_sheet_match_no_target": "대상 미설정",
        "tpl_sheet_match_unmatched": "미매칭",
```

zh:
```json
        "tpl_sheet_match_btn": "确认对象匹配",
        "tpl_sheet_match_title": "对象匹配确认（表格→模板）",
        "tpl_sheet_match_hint": "粘贴标准电子表格，查看每个攻击将继承哪个对象。",
        "tpl_sheet_match_placeholder": "在电子表格中全选(Ctrl+A)并复制，然后粘贴到此处",
        "tpl_sheet_match_check": "确认",
        "tpl_sheet_match_parse_failed": "未找到数据表。请全选后重新复制。",
        "tpl_sheet_match_summary": "继承 {{carried}} / 未设对象 {{noTarget}} / 未匹配 {{unmatched}}",
        "tpl_sheet_match_no_target": "未设对象",
        "tpl_sheet_match_unmatched": "未匹配",
```

- [ ] **Step 8: 型チェック + 全テスト**

Run（PowerShell）: `npm run build`
Expected: tsc 成功

Run（PowerShell）: `npx vitest run`
Expected: 新規緑・既存の緑数維持（既知 failure 5 件のみ許容）

- [ ] **Step 9: コミット**

```bash
rtk git add src/components/admin/SheetTargetMatchModal.tsx src/components/admin/__tests__/SheetTargetMatchModal.test.tsx src/components/admin/TemplateEditorToolbar.tsx src/components/admin/AdminTemplates.tsx src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
rtk git commit -m "feat(admin): 「対象マッチ確認」モーダルを追加(標準スプシ貼付→引き継ぎ結果一覧)"
```

---

## 実機検証（実装後・人手 / verify スキル）

merge/push 前にエンドユーザー＋管理者視点で1回ずつ通す（[[feedback_endpoint_user_verification]]）。テンプレデータは破棄可。

- [ ] **管理（`npm run dev:admin` or 本番）**: テンプレ編集で「スプシ表記」列に別名を入れ保存 → 再ロードで残る。「対象マッチ確認」に標準スプシを貼る → ✓/△/✗ が出る。名前不一致を別名で✓化できる。
- [ ] **ユーザー（`npm run dev`）**: テンプレ有コンテンツでスプシ取込 → タンバスに MT/ST が入る（誤マッチ無し）。EventForm で個別修正もできる。
- [ ] テンプレ無しコンテンツ / contentId 未選択 → 従来通り（target 空・取込は成功）。
- [ ] OK なら finishing-a-development-branch で merge + push（本番自動デプロイ）。TODO/COMPLETED 更新。

---

## Self-Review（spec 照合）

**spec カバレッジ**:
- §2 土台(A)正規化照合+別名 → Task 1（`findTemplateAttacks`/`matches`）。✅
- §2 精度(正規化+別名のみ・編集距離なし) → Task 1（`normalizeAttackName` + `matches`、曖昧一致関数なし）。✅
- §2 引き継ぐのは target のみ・上書きしない → Task 1 `applyTargetsFromTemplate`(target 空のみ補完)。✅
- §2 条件(テンプレ在るときだけ・無/失敗/未マッチは何もしない) → Task 2 `applyTemplateTargetsToResult`(null/throw/空ガード)。✅
- §2 衝突(時刻最近傍・等距離食い違いは undefined) → Task 1 `resolveTargetFromMatches`。✅
- §3 データモデル `sheetAliases?: string[]` を TimelineEvent に追加 → Task 1。✅
- §4 純粋関数群(normalize/match/resolve/apply) → Task 1。✅
- §5 取込フロー配線(handleConfirm 後段で getTemplate→apply) → Task 2。✅
- §6 管理「スプシ表記」列 → Task 3 / 「対象マッチ確認」パネル(同一関数) → Task 4。✅
- §6 i18n 4言語 → Task 3（列ヘッダー）+ Task 4（モーダル）。✅
- §7 テスト(carryOverTargets ユニット / 配線 / 管理プレビュー) → Task 1/2/4。✅
- §8 スコープ外(編集距離/target以外/A or B/ユーザープレビュー) → 本計画で扱わない。✅

**プレースホルダ走査**: TBD/「適切に」等なし。全コードステップに実コードあり。✅

**型整合**: `CarryTarget`/`SheetMatchRow` は Task 1 定義 = Task 2/4 使用で一致。`applyTargetsFromTemplate(events, templateEvents)` のシグネチャ Task1定義 = Task2使用一致。`buildSheetMatchReport(rows, templateEvents)` Task1定義 = Task4使用一致。`parseSheetAliases` Task1 = Task3使用一致。`sheetAliases?: string[]` Task1追加 = Task3編集 = Task1マッチ参照で一致。✅
