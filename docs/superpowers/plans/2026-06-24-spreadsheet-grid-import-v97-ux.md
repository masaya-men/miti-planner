# 列グリッド取込 §9.7 UX改訂 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 既存の列グリッド取込モーダル(`feat/spreadsheet-grid-import`)を、spec §9.7 の確定方針(スプシ面に操作集約・対象の行ごと編集とテンプレ競合解消・「読めない」表示の是正・常時作成・自作シートの最小アク取り)に沿って改訂する。

**Architecture:** 純関数(空白前処理 / skipped 位置情報 / 実効対象解決 / ブロック判定 / result→グリッド変換)を先に TDD で改修し、その上でモーダル UI(`SpreadsheetGridImportModal.tsx`)を「右パネル廃止→スプシ面集約」に組み替える。取込結果は既存 `commitImportedPlan` 経路を維持。

**Tech Stack:** TypeScript / React / Zustand / framer-motion / react-i18next / vitest。

設計書: `docs/superpowers/specs/2026-06-24-spreadsheet-grid-import-design.md` **§9.7 が最新・確定**(§9.5/9.6 を継承)。本計画は既に実装済みの同モーダルの**改修**(net diff 起点 = `feat/spreadsheet-grid-import` @ 現 HEAD)。

## Global Constraints

- 言語: コード/コメント/ドキュメントは日本語。
- 色: 白黒 + 機能色のみ(青=OK/進む・黄=警告・赤=危険)。**緑禁止**(`.claude/rules/ui-design.md`)。
- UI 文言は必ず i18n キー経由(4言語 ja/en/ko/zh)。ハードコード禁止。特定スプシ名(「有名」「famous」等)を UI/コメント/関数名に出さない(grep 0 を維持)。`gridImport.rights_notice` を維持。
- ロケール JSON は**該当ブロックだけ textual 編集**。全体 parse→stringify 禁止(全行差分・履歴汚染を招く。[[feedback_locale_json_textual_edit]])。4言語 parity 維持。
- ジョブ名・スキル名の辞書はハードコードせず store(`getJobsFromStore`/`getMitigationsFromStore`)から構築([[feedback_no_hardcoding]])。**ジョブ/スキルの略称辞書は作らない**(§9.7 E・正式名称前提)。
- 取込は必ず新規・非collabプラン。`commitImportedPlan` 経路(collab 切断→loadSnapshot)を維持(Bug #1 を踏まない)。
- **既存 `parseMitigationSheet.ts`(有名スプシパーサ)は変更しない**。`buildPlanFromSheets.ts` は **skipped 位置情報の付与(additive)のみ**許可(events/mitigations/party/phases/labels の挙動は不変・既存テストが回帰ガード)。
- matrix(行列形式)プレビューは §9.5 原則「グリッドから再構築しない・result をそのまま create」を維持。対象編集は result への override 適用で行う(再構築しない)。
- push 前に `npm run build`(Vercel tsc -b 厳密・`import type`/未使用が罠)+ `npx vitest run` 緑([[feedback_vercel_tsc_strict]])。テスト出力をパイプしない([[reference_vitest_appcheck_teardown]])。vitest 設定は不変(`pool='vmThreads'` 削除厳禁)。

---

## File Structure(変更/新規)

- 変更 `src/lib/sheetImport/parseGridPaste.ts` — 空行/空列の前処理 + 見出し行発見(Task 1)。
- 変更 `src/lib/sheetImport/types.ts` — `SkippedSkill` に位置情報(slot/times)を additive 追加(Task 2)。
- 変更 `src/lib/sheetImport/buildPlanFromSheets.ts` — skipped に slot/times を付与(additive・Task 2)。
- 変更 `src/lib/sheetImport/buildPlanFromGrid.ts` — skipped に slot/times を付与(Task 2)。
- 新規 `src/lib/sheetImport/resolveEventTargets.ts` — 実効対象(手動>自作対象列>テンプレ>空)解決の純関数(Task 3)。
- 変更 `src/lib/sheetImport/importBlockReason.ts` — `pending_draft` を廃止(Task 4)。
- 変更 `src/lib/sheetImport/gridRowsFromResult.ts` — skipped の生テキストを該当 (slot,time) セルへ注入(Task 5)。
- 変更 `src/components/SpreadsheetGridImportModal.tsx` — 右パネル廃止→スプシ面集約・対象編集・黄色セル/編集・ジョブ手動割当・時間欠落表示・常時作成(Task 6〜9)。
- 変更 `src/locales/{ja,en,ko,zh}.json` — `gridImport.*` 追加/変更(Task 10)。
- テスト: 各 `src/lib/sheetImport/__tests__/*.test.ts`、`src/components/__tests__/SpreadsheetGridImportModal.test.tsx`。

> **scope メモ(matrix の在席編集)**: §9.7 #10 の「読めない技をその場で編集」は **自作(grid)パスで実装**する(セル編集→再ビルドで自然に再解決)。**matrix(行列形式)は黄色"表示"のみ**(在席編集は本計画では行わない)。理由: 行列形式で skip される技は LoPo 非対応の技(LB3 等)が大半で、改名しても解決しないため価値が低く、result への再注入は複雑。matrix の在席編集が要るなら follow-up(spec §9.7 C 実装メモの「override/再注入」方式)。Task 11 実機で要否を判断。

---

## Task 1: parseGridPaste の空白前処理(空行/空列スキップ + 見出し行発見)

**Files:**
- Modify: `src/lib/sheetImport/parseGridPaste.ts`
- Test: `src/lib/sheetImport/__tests__/parseGridPaste.test.ts`(既存に追記)

**Interfaces:**
- Produces(不変シグネチャ): `parseGridPaste(tsv: string, jobs: Job[]): GridTable`。挙動を変更=先頭の完全空行をスキップし、**最初の中身ある行を見出し**にする。`isMatrixSheetFormat` は不変。

- [ ] **Step 1: 失敗するテストを追記**

`parseGridPaste.test.ts` の `describe('parseGridPaste', ...)` 内に追加:

```ts
  it('先頭の空行を飛ばして最初の中身ある行を見出しにする', () => {
    // 先頭にタブだけの空行 → これまでは空行が見出しになり全列 unknown だった
    const tsv = '\t\t\t\n時間\t敵の攻撃\tナイト\n0:16\tばりばりルインガ\tセンチネル\n';
    const t = parseGridPaste(tsv, JOBS);
    expect(t.columns.map((c) => c.field)).toEqual(['time', 'action', 'member']);
    expect(t.rows).toEqual([['0:16', 'ばりばりルインガ', 'センチネル']]);
  });
  it('全体が空白だけなら空テーブル', () => {
    expect(parseGridPaste('\t\t\n\t\n', JOBS)).toEqual({ columns: [], rows: [] });
  });
```

(既存テストの `JOBS` には `{ id: 'pld', name: { ja: 'ナイト', ... } }` がある前提。無ければ既存の JOBS 定義に合わせる)

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run src/lib/sheetImport/__tests__/parseGridPaste.test.ts`
Expected: FAIL(先頭空行が見出しになり field が全部 unknown)

- [ ] **Step 3: 実装(先頭空行スキップ)**

`parseGridPaste` の本体を差し替え。`lines` 構築後、**先頭の完全空行を pop ではなく shift で除去**してから見出しを取る:

```ts
export function parseGridPaste(tsv: string, jobs: Job[]): GridTable {
  if (!tsv || !tsv.trim()) return { columns: [], rows: [] };
  const lines = tsv.replace(/\r\n/g, '\n').split('\n').map((l) => l.split('\t'));
  // 末尾の完全空行を除去
  while (lines.length && lines[lines.length - 1].every((c) => c.trim() === '')) lines.pop();
  // 先頭の完全空行を除去(スプシのタイトル行・余白行対策)
  while (lines.length && lines[0].every((c) => c.trim() === '')) lines.shift();
  if (lines.length === 0) return { columns: [], rows: [] };
  const header = lines[0];
  const columns: GridColumn[] = header.map((h) => {
    const d = detectField(h, jobs);
    return d.field === 'member'
      ? { field: 'member', header: h, jobId: d.jobId ?? null, slot: null }
      : { field: d.field, header: h };
  });
  const rows = lines.slice(1);
  return { columns, rows };
}
```

> 注: 先頭の**空列**(全行で col0 が空)は、見出しが空→`detectField('')`→`unknown` 列として1本残るだけで無害(ユーザーは「無視」可)。列の自動 trim は過剰なので**行のみ**前処理する(YAGNI)。

- [ ] **Step 4: 成功を確認(既存も緑)**

Run: `npx vitest run src/lib/sheetImport/__tests__/parseGridPaste.test.ts`
Expected: PASS(既存 + 新規2件)

- [ ] **Step 5: Commit**

```bash
rtk git add src/lib/sheetImport/parseGridPaste.ts src/lib/sheetImport/__tests__/parseGridPaste.test.ts
rtk git commit -m "fix(import): グリッド貼付で先頭空行を飛ばし最初の中身ある行を見出しに(空白だらけシート対策)"
```

---

## Task 2: SkippedSkill に位置情報(slot/times)を additive 追加

**Files:**
- Modify: `src/lib/sheetImport/types.ts`
- Modify: `src/lib/sheetImport/buildPlanFromSheets.ts`(additive のみ)
- Modify: `src/lib/sheetImport/buildPlanFromGrid.ts`
- Test: `src/lib/sheetImport/__tests__/buildPlanFromGrid.test.ts`(追記)、`__tests__/buildPlanFromSheets.test.ts`(あれば追記・無ければ新規 it 追加)

**Interfaces:**
- Produces: `SkippedSkill { job: string; skillName: string; slot?: string | null; times?: number[] }`。`slot` = そのジョブの枠(未割当 null)、`times` = 配置されるはずだった立ち上がり時刻列。**既存の job/skillName は不変**(後方互換)。

- [ ] **Step 1: 型を additive 拡張(`types.ts`)**

```ts
export interface SkippedSkill {
  job: string;
  skillName: string;
  /** そのジョブの割当枠(MT/ST/...)。未割当は null。グリッド黄色セルの配置先に使う。 */
  slot?: string | null;
  /** 配置されるはずだった立ち上がり時刻(秒)。複数可。 */
  times?: number[];
}
```

- [ ] **Step 2: 失敗するテストを追記(grid)**

`buildPlanFromGrid.test.ts` の解決不能ケースに位置情報を assert 追加:

```ts
  it('skipped に slot と times が付く', () => {
    const t2: GridTable = { ...table, rows: [['', '', '0:20', 'x', '', '', '魔法', '存在しない技']] };
    const r = buildPlanFromGrid(t2, { mitigations: MITS, jobs: JOBS }, { includeMitigations: true });
    const s = r.skipped.find((x) => x.skillName === '存在しない技');
    expect(s?.slot).toBe('MT');      // table の member 列 slot
    expect(s?.times).toEqual([20]);  // 0:20
  });
```

- [ ] **Step 3: 失敗を確認**

Run: `npx vitest run src/lib/sheetImport/__tests__/buildPlanFromGrid.test.ts`
Expected: FAIL(slot/times undefined)

- [ ] **Step 4: 実装(buildPlanFromGrid)**

`buildPlanFromGrid.ts` の skipped 構築を、`times` を蓄積する形へ。`skippedSet` の値を「times を持つ」形に変更:

```ts
  const skippedMap = new Map<string, SkippedSkill>();
  for (const { c, idx } of memberCols) {
    const jobJa = jobJaById.get(c.jobId as string) ?? '';
    let prevSkill: string | null = null;
    for (const { cells, t } of valid) {
      const raw = (cells[idx] ?? '').trim();
      if (!raw) { prevSkill = null; continue; }
      if (raw === prevSkill) continue;
      prevSkill = raw;
      const mitId = resolveSheetSkill(jobJa, raw, deps.mitigations);
      if (!mitId) {
        const key = `${jobJa}/${raw}`;
        const ex = skippedMap.get(key);
        if (ex) ex.times!.push(t);
        else skippedMap.set(key, { job: jobJa, skillName: raw, slot: (c.slot as string) ?? null, times: [t] });
        continue;
      }
      const dur = deps.mitigations.find((m) => m.id === mitId)?.duration ?? 0;
      mits.push({ id: uid('mit'), mitigationId: mitId, time: t, duration: dur, ownerId: c.slot as string });
    }
  }
  // ...(dedupe は不変)
  return { timelineEvents, timelineMitigations: deduped, phases, labels, party, skipped: [...skippedMap.values()] };
```

- [ ] **Step 5: 実装(buildPlanFromSheets・additive)**

`buildPlanFromSheets.ts` の skipped 構築(現 `skippedSet.set(...{job,skillName})`)を、slot/times 付きへ。rising-edge 検出ループ内で立ち上がり時刻を集めるよう変更(`ownerId` は既に算出済み):

```ts
  const skippedMap = new Map<string, SkippedSkill>();
  for (const sheet of parsedSheets) {
    const rowsInOrder = [...sheet.rows].sort((a, b) => a.totalTimeSec - b.totalTimeSec);
    for (const col of sheet.columns) {
      const mitId = resolveSheetSkill(col.job, col.skillNameRaw, deps.mitigations);
      const mit = mitId ? deps.mitigations.find((m) => m.id === mitId) : undefined;
      const duration = mit?.duration ?? 0;
      const jobId = JOB_JA_TO_ID[col.job];
      const ownerId = jobId ? slotByJobId.get(jobId) : undefined;
      let inRun = false;
      const riseTimes: number[] = [];
      for (const row of rowsInOrder) {
        const isTrue = row.trueColumnIndexes.includes(col.index);
        if (!isTrue) { inRun = false; continue; }
        if (!inRun) {
          inRun = true;
          riseTimes.push(row.totalTimeSec);
          if (mitId && ownerId) {
            timelineMitigations.push({ id: uid('mit'), mitigationId: mitId, time: row.totalTimeSec, duration, ownerId });
          }
        }
      }
      if (riseTimes.length && !mitId) {
        skippedMap.set(`${col.job}/${col.skillNameRaw}`, {
          job: col.job, skillName: col.skillNameRaw, slot: ownerId ?? null, times: riseTimes,
        });
      }
    }
  }
```

(末尾の `return ... skipped: [...skippedMap.values()]` に変更。`hadTrue` 変数は `riseTimes.length` で代替し削除。)

- [ ] **Step 6: 成功を確認(既存 buildPlanFromSheets/Grid テスト緑)**

Run: `npx vitest run src/lib/sheetImport/__tests__/buildPlanFromGrid.test.ts src/lib/sheetImport/__tests__/buildPlanFromSheets.test.ts`
Expected: PASS(既存の events/mits/party/skipped[job,skillName] は不変・新規 slot/times が乗る)

- [ ] **Step 7: Commit**

```bash
rtk git add src/lib/sheetImport/types.ts src/lib/sheetImport/buildPlanFromSheets.ts src/lib/sheetImport/buildPlanFromGrid.ts src/lib/sheetImport/__tests__/
rtk git commit -m "feat(import): skipped に位置情報(slot/times)を付与(セル内黄色表示の配置用・additive)"
```

---

## Task 3: 実効対象(手動>自作対象列>テンプレ>空)解決の純関数

**Files:**
- Create: `src/lib/sheetImport/resolveEventTargets.ts`
- Test: `src/lib/sheetImport/__tests__/resolveEventTargets.test.ts`

**Interfaces:**
- Consumes: `TimelineEvent`(types)、`matchTemplateTarget`/`CarryTarget`(`carryOverTargets.ts`)。
- Produces:
  - `type TargetSource = 'manual' | 'sheet' | 'template' | 'none'`
  - `interface ResolvedTarget { target: CarryTarget | null; source: TargetSource }`
  - `resolveEventTarget(ev, templateEvents, overrides): ResolvedTarget` — 優先 **手動(overrides[ev.id]) > 自作対象列(ev.target) > テンプレ(matchTemplateTarget) > なし**。`overrides[id] === 'none'` は「手動でなし」=テンプレに勝ち null。
  - `applyResolvedTargets(events, templateEvents, overrides): TimelineEvent[]` — create 用。各 event の target を実効値で確定(none/未解決は target を外す)。

- [ ] **Step 1: 失敗するテスト**

```ts
import { describe, it, expect } from 'vitest';
import { resolveEventTarget, applyResolvedTargets } from '../resolveEventTargets';
import type { TimelineEvent } from '../../../types';

const ev = (id: string, ja: string, time: number, target?: 'MT' | 'ST' | 'AoE'): TimelineEvent =>
  ({ id, name: { ja, en: ja }, time, damageType: 'magical', ...(target ? { target } : {}) } as TimelineEvent);

const TEMPLATE: TimelineEvent[] = [ev('t1', '波動砲', 43, 'AoE')];

describe('resolveEventTarget', () => {
  it('手動 override が最優先', () => {
    const r = resolveEventTarget(ev('e1', '波動砲', 43), TEMPLATE, { e1: 'MT' });
    expect(r).toEqual({ target: 'MT', source: 'manual' });
  });
  it('手動「なし」はテンプレに勝って null', () => {
    const r = resolveEventTarget(ev('e1', '波動砲', 43), TEMPLATE, { e1: 'none' });
    expect(r).toEqual({ target: null, source: 'manual' });
  });
  it('自作対象列(ev.target)はテンプレに勝つ', () => {
    const r = resolveEventTarget(ev('e1', '波動砲', 43, 'ST'), TEMPLATE, {});
    expect(r).toEqual({ target: 'ST', source: 'sheet' });
  });
  it('手動も自作も無ければテンプレ由来', () => {
    const r = resolveEventTarget(ev('e1', '波動砲', 43), TEMPLATE, {});
    expect(r).toEqual({ target: 'AoE', source: 'template' });
  });
  it('どれも無ければ none', () => {
    const r = resolveEventTarget(ev('e1', '謎技', 99), TEMPLATE, {});
    expect(r).toEqual({ target: null, source: 'none' });
  });
});

describe('applyResolvedTargets', () => {
  it('各 event に実効 target を確定(none は target を外す)', () => {
    const events = [ev('e1', '波動砲', 43), ev('e2', '波動砲', 50)];
    const out = applyResolvedTargets(events, TEMPLATE, { e2: 'none' });
    expect(out[0].target).toBe('AoE');     // テンプレ由来
    expect(out[1].target).toBeUndefined(); // 手動なし
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run src/lib/sheetImport/__tests__/resolveEventTargets.test.ts`
Expected: FAIL(未定義)

- [ ] **Step 3: 実装**

```ts
import type { TimelineEvent } from '../../types';
import { matchTemplateTarget, type CarryTarget } from './carryOverTargets';

export type TargetSource = 'manual' | 'sheet' | 'template' | 'none';
export interface ResolvedTarget { target: CarryTarget | null; source: TargetSource; }

/** 実効対象を解決。優先: 手動(overrides) > 自作対象列(ev.target) > テンプレ > なし。
 *  overrides[id]==='none' は「手動でなし」= テンプレに勝って null。 */
export function resolveEventTarget(
  ev: TimelineEvent,
  templateEvents: TimelineEvent[],
  overrides: Record<string, CarryTarget | 'none'>,
): ResolvedTarget {
  const ov = overrides[ev.id];
  if (ov !== undefined) return { target: ov === 'none' ? null : ov, source: 'manual' };
  if (ev.target !== undefined) return { target: ev.target as CarryTarget, source: 'sheet' };
  const tmpl = matchTemplateTarget(ev.name.ja, ev.time, templateEvents);
  if (tmpl !== undefined) return { target: tmpl, source: 'template' };
  return { target: null, source: 'none' };
}

/** create 用: 各 event の target を実効値で確定(null は target キーを外す・非破壊)。 */
export function applyResolvedTargets(
  events: TimelineEvent[],
  templateEvents: TimelineEvent[],
  overrides: Record<string, CarryTarget | 'none'>,
): TimelineEvent[] {
  return events.map((ev) => {
    const { target } = resolveEventTarget(ev, templateEvents, overrides);
    const next = { ...ev };
    if (target === null) delete (next as { target?: CarryTarget }).target;
    else (next as { target?: CarryTarget }).target = target;
    return next;
  });
}
```

- [ ] **Step 4: 成功を確認**

Run: `npx vitest run src/lib/sheetImport/__tests__/resolveEventTargets.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
rtk git add src/lib/sheetImport/resolveEventTargets.ts src/lib/sheetImport/__tests__/resolveEventTargets.test.ts
rtk git commit -m "feat(import): 実効対象(手動>自作対象列>テンプレ>空)解決の純関数を追加"
```

---

## Task 4: importBlockReason から pending_draft を廃止

**Files:**
- Modify: `src/lib/sheetImport/importBlockReason.ts`
- Test: `src/lib/sheetImport/__tests__/importBlockReason.test.ts`(あれば修正・無ければ新規)

**Interfaces:**
- Produces: `importBlockReason({ hasPreviewEvents, partyComplete }): 'no_phases' | 'party_incomplete' | null`。**`pending_draft` と `hasPendingDraft` 引数を削除**(未追加の貼付は作成時に自動取り込みするため・Task 6 で配線)。

- [ ] **Step 1: テストを pending_draft 無しへ修正(失敗確認)**

```ts
import { describe, it, expect } from 'vitest';
import { importBlockReason } from '../importBlockReason';

describe('importBlockReason', () => {
  it('イベント無し→no_phases', () => {
    expect(importBlockReason({ hasPreviewEvents: false, partyComplete: true })).toBe('no_phases');
  });
  it('パーティ未完→party_incomplete', () => {
    expect(importBlockReason({ hasPreviewEvents: true, partyComplete: false })).toBe('party_incomplete');
  });
  it('全部OK→null', () => {
    expect(importBlockReason({ hasPreviewEvents: true, partyComplete: true })).toBeNull();
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run src/lib/sheetImport/__tests__/importBlockReason.test.ts`
Expected: FAIL(現行は hasPendingDraft 必須・型不一致)

- [ ] **Step 3: 実装(pending_draft 削除)**

```ts
export type ImportBlockReason = 'no_phases' | 'party_incomplete';

export interface ImportConfirmArgs {
  hasPreviewEvents: boolean;
  partyComplete: boolean;
}

/** 「取り込んで作成」が押せない理由を1つ返す(優先順)。押せるなら null。
 * - no_phases: プレビューにイベントが無い
 * - party_incomplete: パーティ枠が未割当
 * 未追加の貼り付けは作成時に自動取り込みするためブロック理由にしない(§9.7 D)。 */
export function importBlockReason(args: ImportConfirmArgs): ImportBlockReason | null {
  if (!args.hasPreviewEvents) return 'no_phases';
  if (!args.partyComplete) return 'party_incomplete';
  return null;
}
```

- [ ] **Step 4: 成功を確認**

Run: `npx vitest run src/lib/sheetImport/__tests__/importBlockReason.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
rtk git add src/lib/sheetImport/importBlockReason.ts src/lib/sheetImport/__tests__/importBlockReason.test.ts
rtk git commit -m "feat(import): importBlockReason から pending_draft を廃止(作成時に自動取込)"
```

> 注: この時点で `SpreadsheetGridImportModal.tsx` がコンパイルエラー(`hasPendingDraft` 引数消失・`pending_draft` 参照)になる。Task 6 で同時に直す(Task 4→6 は連続実行)。tsc を緑に戻すのは Task 6 完了時。

---

## Task 5: gridRowsFromResult に skipped の生テキストを注入

**Files:**
- Modify: `src/lib/sheetImport/gridRowsFromResult.ts`
- Test: `src/lib/sheetImport/__tests__/gridRowsFromResult.test.ts`(あれば追記・無ければ新規)

**Interfaces:**
- Produces(不変シグネチャ): `gridRowsFromResult(result, deps, lang): GridTable`。member セルに、解決済み軽減名(従来) に加え `result.skipped` で同 (slot,time) のものの**生スキル名を ` / ` で連結**して注入する。これにより matrix プレビューでも「読めなかった技」がその場所に出る(GridView 側で未解決部分を黄色表示=Task 8)。

- [ ] **Step 1: 失敗するテスト**

```ts
import { describe, it, expect } from 'vitest';
import { gridRowsFromResult } from '../gridRowsFromResult';
import type { SheetImportResult } from '../buildPlanFromSheets';
import type { Job, Mitigation } from '../../../types';

const JOBS: Job[] = [{ id: 'pld', name: { ja: 'ナイト', en: 'Paladin' }, role: 'tank', icon: '' } as Job];
const MITS: Mitigation[] = [{ id: 'rampart_pld', jobId: 'pld', name: { ja: 'ランパート', en: 'Rampart' }, recast: 0, duration: 20, type: 'all', value: 0 } as Mitigation];

const result: SheetImportResult = {
  timelineEvents: [{ id: 'e1', name: { ja: 'AA', en: 'AA' }, time: 20, damageType: 'magical' } as any],
  timelineMitigations: [],
  phases: [], labels: [],
  party: [{ slot: 'MT', jobId: 'pld' }],
  skipped: [{ job: 'ナイト', skillName: 'ベネ', slot: 'MT', times: [20] }],
};

describe('gridRowsFromResult skipped 注入', () => {
  it('skipped の生テキストを (slot,time) セルに出す', () => {
    const t = gridRowsFromResult(result, { mitigations: MITS, jobs: JOBS }, 'ja');
    const memberColIdx = t.columns.findIndex((c) => c.field === 'member' && c.slot === 'MT');
    const row = t.rows.find((r) => r[t.columns.findIndex((c) => c.field === 'time')] === '0:20')!;
    expect(row[memberColIdx]).toBe('ベネ');
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run src/lib/sheetImport/__tests__/gridRowsFromResult.test.ts`
Expected: FAIL(セルが空)

- [ ] **Step 3: 実装(member セル構築に skipped を合流)**

`gridRowsFromResult.ts` の member セル構築(現 `for (const { slot } of result.party) { ... cells.push(names.join(' / ')); }`)を、解決済み名 + その (slot,time) の skipped 生テキストを連結する形へ:

```ts
    for (const { slot } of result.party) {
      const mits = result.timelineMitigations.filter(
        (m) => m.ownerId === slot && m.time === event.time,
      );
      const names = mits.map((m) => {
        const mit = deps.mitigations.find((x) => x.id === m.mitigationId);
        return mit ? localize(mit.name, lang) : '';
      });
      // 同 (slot,time) で skip された生スキル名も足す(GridView が未解決として黄色表示)
      const skippedHere = result.skipped
        .filter((s) => s.slot === slot && (s.times ?? []).includes(event.time))
        .map((s) => s.skillName);
      cells.push([...names, ...skippedHere].filter((x) => x !== '').join(' / '));
    }
```

- [ ] **Step 4: 成功を確認**

Run: `npx vitest run src/lib/sheetImport/__tests__/gridRowsFromResult.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
rtk git add src/lib/sheetImport/gridRowsFromResult.ts src/lib/sheetImport/__tests__/gridRowsFromResult.test.ts
rtk git commit -m "feat(import): matrixプレビューに読めなかった技の生テキストをセル注入"
```

---

## Task 6(UI): 右パネル廃止 → スプシ面集約(フェーズ・バー / インライン枠 / Ctrl+A / matrixチップ撤去)

**Files:**
- Modify: `src/components/SpreadsheetGridImportModal.tsx`
- Test: `src/components/__tests__/SpreadsheetGridImportModal.test.tsx`(追記)

**前提:** Task 4 で `importBlockReason` が `{hasPreviewEvents, partyComplete}` 2引数化。本タスクでモーダルの該当箇所を全て直し tsc を緑に戻す。

**やること(spec §9.7 A + D + C#7):**

- [ ] **Step 1: 右パネル(`w-full md:w-[340px]` のブロック・現 504-626 行)を解体し、構成要素を移設**
  - **フェーズ・バー**を Step2 グリッドの**上部**(操作バー 457-468 の直後)に新設: 「このフェーズの名前」input(`phaseName`/`setPhaseName` 流用) + 主ボタン「このフェーズを追加して次へ」(`handleAddPhase` 流用・ラベルを `gridImport.add_phase_next` に) + 追加済み✓チップ(現 `entries.map` の表示をチップ列で横に)。`source==='matrix'` のときのみ表示(自作は phase 列で帯を作るため不要=現行踏襲)。
  - **Ctrl+A 導線**: グリッド上部に1行常時表示(`gridImport.flow_hint`)。
  - **skipped リスト**(現 607-622)は撤去(セル内黄色=Task 8 + フッターのサマリ count に集約)。フッター summary に「読めなかった技 N件」を追記(下記 Step 4)。
  - **権利表記**(現 625)はフッターか上部ヘルプ脇へ移設(消さない)。

- [ ] **Step 2: パーティ枠割当をメンバー列ヘッダーにインライン化(matrix にも)**
  現状 `GridView` の枠セレクタは `source !== 'matrix'` 条件(現 776 行)で matrix では出ない。これを **matrix でも出す**よう変更し、右パネルのパーティ枠 UI(現 549-604)を撤去。
  - `GridView` の member 列ヘッダーのセレクタ条件 `c.field === 'member' && role && source !== 'matrix'` → `c.field === 'member' && role`(matrix も表示)。
  - matrix では列の slot 変更を `assignment`/`handleSlotChange` に反映する必要がある。matrix の列は `gridRowsFromResult` 由来で `table` の列 slot を持つが、真実の枠割当は `assignment` state。**変更**: matrix のヘッダー枠セレクタ `onChange` で `handleSlotChange(slot, jobId)` を呼ぶ(列の jobId→その枠へ)。表示中の列 slot は `assignment` から引き直す(`gridRowsFromResult(sortResultPartyBySlots(...))` は `partyOverride` 反映済み preview を使う=既存 `matrixPreview` 経路)。
  - 実装容易化のため: matrix のヘッダー枠セレクタは「この列(jobId)を MT/ST/... のどれにするか」を選ばせ、`handleSlotChange(selectedSlot, jobId)` を呼ぶだけにする(role 内候補は `SLOTS_BY_ROLE[role]`)。

  > 注: matrix の枠割当 state は `assignment`(jobId→slot)に一元化されているため、ヘッダーからの変更も `assignment` を更新すれば preview(`matrixPreview`)とグリッド表示が再計算される。grid パスは従来通り列の `slot` を直接編集(`setColSlot`)。

- [ ] **Step 3: matrix プレビューの列ステータスチップを撤去(C#7)**
  `GridView` の `<StatusChip status={st} />`(現 745 行)を `source !== 'matrix'` のときだけ描画する。matrix では `validateGridColumn` 由来の誤チップ(解決済み表示値の再検証)を出さない。`st` 計算自体も matrix ではスキップしてよい。

- [ ] **Step 4: フッターの整理(D + skipped サマリ)**
  - `pending_draft` の警告ブロック(現 638-643)を**削除**。
  - `blockReason` の参照を Task 4 の2引数版へ(`hasPendingDraft` 削除)。`hasPendingDraft` 変数(現 372)と `importBlockReason` 呼び出し(現 374-378)を修正。
  - summary(現 685)に skipped 件数を追記: `preview.skipped.length > 0` のとき `gridImport.skipped_count`({{count}}) を amber で併記。

- [ ] **Step 5: 作成ボタンの自動取り込み(D#12)**
  `handleConfirm`(現 381-386)の冒頭で、未追加の貼り付けが残っていれば先に entries へ積む:

```ts
  const handleConfirm = useCallback(async () => {
    // 未追加の matrix 貼り付けが残っていれば自動で取り込んでから作成(袋小路撤去)
    let effectiveEntries = entries;
    if (source === 'matrix' && matrixParsed) {
      effectiveEntries = [...entries, { parsed: matrixParsed, phaseName }];
    }
    const finalPreview = isGrid
      ? gridPreview
      : (effectiveEntries.length > 0
          ? buildPlanFromSheets(effectiveEntries, { mitigations, jobs }, { includeMitigations: true, partyOverride })
          : null);
    if (!finalPreview || finalPreview.timelineEvents.length === 0) return;
    // ...(対象適用は Task 7 で差し込む)...
    const ok = await onImport(finalPreview, { contentId: selectedContentId });
    if (ok) onClose();
  }, [/* deps */]);
```

  > `canConfirm` は「1フェーズでも追加済み or 未追加でもプレビュー有り」を許可する形へ。`preview`(現 337)を「entries か未追加 draft のどちらかがあれば見える」よう調整(matrix の `matrixPreview` を `effectiveEntries` ベースにするか、`canConfirm` 判定で `hasPendingDraft` も「作成可」に含める)。

- [ ] **Step 6: モーダルテスト追記**
  `SpreadsheetGridImportModal.test.tsx` に:
  - 「matrix 貼付後、右パネルが無い(`queryByText('フェーズ名…')` 等が旧右パネル位置に無い)」
  - 「貼付→フェーズ名未追加でも『この内容で作成』が disabled でない」(自動取込)
  - 「matrix プレビューで列ヘッダーに status チップが出ない」
  既存テスト(22件)が緑のまま。

- [ ] **Step 7: build + 関連テスト**

Run: `npx tsc -b --noEmit` / `npx vitest run src/components/__tests__/SpreadsheetGridImportModal.test.tsx`
Expected: tsc エラーなし(Task 4 の型変更を吸収) / モーダルテスト緑

- [ ] **Step 8: Commit**

```bash
rtk git add src/components/SpreadsheetGridImportModal.tsx src/components/__tests__/SpreadsheetGridImportModal.test.tsx
rtk git commit -m "feat(import): 右パネル廃止→スプシ面集約(フェーズバー/インライン枠/Ctrl+A/matrixチップ撤去/常時作成)"
```

---

## Task 7(UI): 攻撃の対象=行ごと編集 + テンプレをプレビューに表示

**Files:**
- Modify: `src/components/SpreadsheetGridImportModal.tsx`
- Modify: `src/components/__tests__/SpreadsheetGridImportModal.test.tsx`(追記)

**やること(spec §9.7 B):**

- [ ] **Step 1: テンプレを state に読み込む**
  `getTemplate`(`src/data/templateLoader.ts`)を `selectedContentId` 変化時に呼び、`templateEvents: TimelineEvent[]` を state へ。失敗は空配列(握る)。

```ts
  const [templateEvents, setTemplateEvents] = useState<TimelineEvent[]>([]);
  useEffect(() => {
    let alive = true;
    if (!selectedContentId) { setTemplateEvents([]); return; }
    getTemplate(selectedContentId)
      .then((tpl) => { if (alive) setTemplateEvents(tpl?.timelineEvents ?? []); })
      .catch(() => { if (alive) setTemplateEvents([]); });
    return () => { alive = false; };
  }, [selectedContentId]);
```

- [ ] **Step 2: 手動 override state**
  `const [targetOverrides, setTargetOverrides] = useState<Record<string, CarryTarget | 'none'>>({});`
  貼り直し/フェーズ追加時にリセット(`ingestText`/`handleAddPhase`/開閉 effect に `setTargetOverrides({})` を足す)。
  ※ event id は build ごとに再採番されるため、**override のキーは event.id ではなく安定キー(`${time}|${name.ja}`)**にする。`resolveEventTarget` 呼び出し側で安定キーへ変換するヘルパを噛ませる(下記)。

```ts
  const targetKey = (ev: TimelineEvent) => `${ev.time}|${ev.name.ja}`;
  // overrides を id→ ではなく key→ で持ち、適用時に id へマップ
```

  > `resolveEventTargets.ts` の `overrides` は `Record<string, ...>` で id を想定しているが、安定運用のためモーダル側で「key→target」を保持し、`applyResolvedTargets`/表示直前に `overridesById = Object.fromEntries(events.filter(e=>byKey[targetKey(e)]).map(e=>[e.id, byKey[targetKey(e)]]))` に変換して渡す。

- [ ] **Step 3: 対象列セルを `<select>` に(表示+編集)**
  `GridView` の対象列セル(`field==='target'`)を、テキストでなく `<select>`(MT/ST/全体/—)に。各行 event を特定するため、`GridView` に「対象列セルの行→event」対応を渡す必要がある。
  - matrix/grid とも、対象は `resolveEventTarget(ev, templateEvents, overridesById)` の結果を初期値に。`source==='template'` は**薄字+「テンプレ」**、`source==='manual'|'sheet'` は通常表示、`none` は「—」。
  - onChange → `setTargetOverrides({ ...prev, [targetKey(ev)]: value })`(value: 'MT'|'ST'|'AoE'|'none')。
  - 実装容易化: `GridView` は表示専用テーブルなので、対象列の編集は**モーダル本体で event 配列(preview.timelineEvents をソート)を持ち**、行 index と対応付ける。matrix/grid とも `preview.timelineEvents` を時刻順に並べた配列の index = グリッド行 index(両ビルダーとも時刻昇順 events・gridRowsFromResult も時刻昇順)。この対応で行→event を引く。

- [ ] **Step 4: create 時に実効対象を適用(applyTemplateTargetsToResult を置換)**
  `handleConfirm` の `applyTemplateTargetsToResult(preview, contentId)` 呼び出しを撤去し、代わりに:

```ts
  import { applyResolvedTargets } from '../lib/sheetImport/resolveEventTargets';
  // ...
  const overridesById = /* key→ を finalPreview.timelineEvents の id へマップ */;
  const withTargets = {
    ...finalPreview,
    timelineEvents: applyResolvedTargets(finalPreview.timelineEvents, templateEvents, overridesById),
  };
  const ok = await onImport(withTargets, { contentId: selectedContentId });
```

  > これでテンプレ適用がプレビュー表示と create で**同一ロジック**になり、二重適用しない。`applyTemplateTargetsToResult` は本モーダルからは使わない(他経路は不変)。

- [ ] **Step 5: テスト(モーダル) + 純関数は Task 3 で担保済**
  モーダルテスト: 「対象列に select が出る」「テンプレ由来行は『テンプレ』表示」「select 変更で create 時 target が手動値になる(onImport 引数を spy)」。

- [ ] **Step 6: build + test**

Run: `npx tsc -b --noEmit` / `npx vitest run src/components/__tests__/SpreadsheetGridImportModal.test.tsx`
Expected: 緑

- [ ] **Step 7: Commit**

```bash
rtk git add src/components/SpreadsheetGridImportModal.tsx src/components/__tests__/SpreadsheetGridImportModal.test.tsx
rtk git commit -m "feat(import): 攻撃の対象を行ごと編集可+テンプレをプレビュー表示(手動>自作>テンプレ>空)"
```

---

## Task 8(UI): 読めない技をセル内黄色 + 自作パスは在席編集 + 取り込めません明記

**Files:**
- Modify: `src/components/SpreadsheetGridImportModal.tsx`(`GridView` の member セル描画)
- Modify: `src/components/__tests__/SpreadsheetGridImportModal.test.tsx`

**やること(spec §9.7 C#8/#9/#10):**

- [ ] **Step 1: member セルを「` / ` 分割 → 各パートを解決判定」して描画**
  `GridView` の member セル(現 800-801 の `<td>{r[ci]}</td>`)を、member 列のときは専用描画へ。各パートを `resolveSheetSkill(jobJa, part, mitigations)` で判定:
  - 解決 → 通常文字(白)。
  - 非空 & 未解決 → **黄色 + 点線下線**(`text-app-amber underline decoration-dotted`)。
  - **同時刻2技 `A / B`(両方解決)は両方白**(黄にしない=#9)。
  - jobJa は列の `jobId` から `jobs` 逆引き。

- [ ] **Step 2: 自作(grid)パスは未解決パートを編集可能 input に**
  `source === 'grid'` かつ未解決の member セルは、黄色テキストの代わりに小さな `<input>`(初期値=生テキスト)。onChange/onBlur で `setTable` の該当セルを更新 → `gridPreview`(useMemo)が再ビルド → 解決すれば次レンダーで白に。
  - grid の member セルは1セル=1スキル(buildPlanFromGrid 仕様)なので分割不要・セル全体を input に。
  - `matrix` は input にしない(**表示のみ**=本計画スコープ。File Structure の scope メモ参照)。

- [ ] **Step 3: 「取り込めません」明記**
  黄色セル近傍 or フッターに「読めなかった技は LoPo に無いため取り込まれません。自作シートは正式名称に直すと取り込めます」(`gridImport.unresolved_note`)。フッター summary の skipped count(Task 6 Step4)と整合。

- [ ] **Step 4: テスト**
  - matrix: 注入された未解決技セルが amber クラスを持つ(Task 5 の注入 + 本描画)。
  - matrix: 同時刻2技セル(両解決)は amber を持たない。
  - grid: 未解決 member セルが input を持ち、正式名称に変えると skipped から消える(再ビルド)。

- [ ] **Step 5: build + test**

Run: `npx tsc -b --noEmit` / `npx vitest run src/components/__tests__/SpreadsheetGridImportModal.test.tsx`
Expected: 緑

- [ ] **Step 6: Commit**

```bash
rtk git add src/components/SpreadsheetGridImportModal.tsx src/components/__tests__/SpreadsheetGridImportModal.test.tsx
rtk git commit -m "feat(import): 読めない技をセル内黄色表示(同時刻2技は白)+自作は在席編集+取り込めません明記"
```

---

## Task 9(UI): ジョブ列の手動救済 + 時間欠落表示 + 入口案内文

**Files:**
- Modify: `src/components/SpreadsheetGridImportModal.tsx`
- Modify: `src/components/__tests__/SpreadsheetGridImportModal.test.tsx`

**やること(spec §9.7 E#14/#15/#16):**

- [ ] **Step 1: 「この列は？」にメンバー(ジョブ選択)を追加**
  現状 `ASSIGNABLE_FIELDS`(現 53 行)に `member` が無いため、不明なジョブ見出し列を救済できない。**2段選択**にする:
  - unknown 列セレクタ(現 757-774)の選択肢に「メンバー(ジョブを選ぶ)」を追加。
  - 選ぶと、その列を `member` 化し、続けて**ジョブ選択 `<select>`**(jobs 全件・`jobName` 表示)を出す。選んだ jobId を列に設定(`{ field:'member', jobId, slot:null }`)。役割は jobId から決まり、枠セレクタ(Task 6 のインライン枠)が出る。
  - これにより略称ジョブ見出しでも辞書なしで手動割当でき、確定ブロックの袋小路にならない(jobId 付き)。

```ts
  // setColField を member 対応へ拡張(jobId 必須)
  const setColMember = (ci: number, jobId: string) => {
    const cols = table.columns.map((c, i) => i !== ci ? c : { field: 'member' as GridField, header: c.header, jobId, slot: null });
    setTable({ ...table, columns: cols });
  };
```

- [ ] **Step 2: 時間列が無い時の明示**
  グリッド本体 or フッターに、`source !== 'none'` かつ time 列が未検出のとき警告: `gridImport.no_time_warning`(「時間(M:SS)の列が必要です。見出しを『時間』にするか『この列は？→時間』で指定してください」)。
  - 判定: grid パスは `table.columns.some(c => c.field === 'time')` が false。matrix は時刻必須なので対象外。

- [ ] **Step 3: 入口の案内文**
  空状態プロンプト(現 494-500)or ヘルプに「ジョブ・スキルは正式名称で、時間(M:SS)の列を入れてください」(`gridImport.format_hint`)を追加。

- [ ] **Step 4: テスト**
  - unknown 列で「メンバー」を選ぶ→ジョブ select 出現→選択で member 列化(jobId 付与)。
  - time 列無しの grid で no_time 警告が出る。

- [ ] **Step 5: build + test**

Run: `npx tsc -b --noEmit` / `npx vitest run src/components/__tests__/SpreadsheetGridImportModal.test.tsx`
Expected: 緑

- [ ] **Step 6: Commit**

```bash
rtk git add src/components/SpreadsheetGridImportModal.tsx src/components/__tests__/SpreadsheetGridImportModal.test.tsx
rtk git commit -m "feat(import): ジョブ列の手動救済(この列は?→メンバー)+時間欠落表示+正式名称の案内"
```

---

## Task 10: i18n 文言(4言語・block 単位 textual 編集)

**Files:**
- Modify: `src/locales/{ja,en,ko,zh}.json`(`gridImport` ブロックのみ追記/変更)

**Interfaces:**
- 追加/変更キー(4言語):
  - 追加: `add_phase_next`(このフェーズを追加して次へ)、`flow_hint`(A1→Ctrl+A→Ctrl+C→ここで Ctrl+V)、`skipped_count`({{count}}件 読めない技)、`unresolved_note`、`no_time_warning`、`format_hint`、`assign_member_job`(メンバー(ジョブを選ぶ))、`target_source_template`(テンプレ表示用ラベル/任意)。
  - 既存で不要化: `pending_phase_warning`(死にキー化)、`status_partial`(matrix で未使用化・grid では使用継続のため残す)。死にキー削除は最後にまとめて(grep で参照ゼロ確認後)。

- [ ] **Step 1: ja.json の `gridImport` ブロックに textual 追記**(該当行のみ・全体再シリアライズ禁止)

```json
"add_phase_next": "このフェーズを追加して次へ",
"flow_hint": "スプシで A1 をクリック → Ctrl+A（全選択）→ Ctrl+C（コピー）→ ここで Ctrl+V",
"skipped_count": "読めなかった技 {{count}}件",
"unresolved_note": "黄色＝読めなかった技。LoPo に無いため取り込まれません。自作シートは正式名称に直すと取り込めます。",
"no_time_warning": "時間（M:SS）の列が必要です。見出しを「時間」にするか「この列は？」で指定してください。",
"format_hint": "ジョブ・スキルは正式名称で、時間（M:SS）の列を入れてください。",
"assign_member_job": "メンバー（ジョブを選ぶ）"
```

- [ ] **Step 2: en/ko/zh の `gridImport` ブロックに同キーを各言語で追記**(値のみ翻訳・キー一致)。直訳でなく各言語自然に。

- [ ] **Step 3: パリティ確認**

Run: `node -e "for(const l of ['ja','en','ko','zh']){const o=require('./src/locales/'+l+'.json');console.log(l, Object.keys(o.gridImport).length)}"`
Expected: 4言語とも同数

- [ ] **Step 4: Commit**

```bash
rtk git add src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
rtk git commit -m "i18n(import): gridImport に §9.7 文言を4言語追加(block単位編集)"
```

---

## Task 11: 統合検証(build / vitest / 実機)+ 死にキー整理

- [ ] **Step 1: 全ビルド + 全テスト**

Run: `npm run build`
Expected: EXIT 0(tsc -b 厳密)
Run: `npx vitest run`
Expected: 既知 failure(TopBar×4 + HousingWorkspace×1)のみ・新規 regression ゼロ。`sheetImport` 全緑・モーダルテスト緑。

- [ ] **Step 2: 死にキー grep**

Run: `rtk grep -n "pending_phase_warning\|gridImport.status_partial" src`
Expected: 参照が消えたキーは locale から textual に削除(4言語)。残すキー(status_partial は grid で使用)は残す。

- [ ] **Step 3: 実機チェックリスト(`npm run dev`→5173・[[feedback_endpoint_user_verification]])**
  - [ ] メニュー→スプレッドシート取り込み→コンテンツ選択→次へ。
  - [ ] **有名スプシ(TRUE/FALSE)を1タブ貼付**: 右パネルが無くフェーズ・バーで操作できる。列ヘッダーに「一部読めない」チップが**出ない**。読めない技だけ**黄色**でセルに出る。同時刻2技は白。
  - [ ] **フェーズを2枚**貼って「追加して次へ」で蓄積→「この内容で作成」が常時押せる(未追加でも自動取込)。
  - [ ] **対象列**: テンプレ由来が薄字「テンプレ」、行ごとに MT/ST/全体/— に変更でき、作成後タイムラインに反映。手動がテンプレに勝つ。
  - [ ] **メンバー列ヘッダーの枠セレクタ**で MT/ST 等を入替できる(2タンク等)。
  - [ ] **自作シート**(略称ジョブ見出し): 「この列は？→メンバー(ジョブ選択)」でジョブ列を救済。正式名称セルは取り込まれ、読めないセルは**その場で正式名称に編集**すると取り込まれる。
  - [ ] **時間列が無い**自作シートで「時間の列が必要」警告が出る。
  - [ ] 作成→タイムライン反映・collab 切断・前の表を引きずらない([[reference_commitnewplan_loadsnapshot_contract]])。

- [ ] **Step 4: 実機 OK 後 → finishing-a-development-branch で main merge + push**(新機能=本人実機ゲート・勝手に merge しない)。

---

## Self-Review(計画作成者チェック)

- **spec §9.7 網羅**: A(右パネル廃止/フェーズバー/インライン枠/Ctrl+A)=Task 6 / B(対象編集+テンプレ競合)=Task 3,7 / C(チップ撤去/黄色セル/同時刻2技白/在席編集)=Task 5,6,8 / D(常時作成/自動取込)=Task 4,6 / E(空白前処理/時間欠落/ジョブ手動/案内文)=Task 1,9 / i18n=Task 10。**matrix 在席編集のみ意図的に scope 外**(File Structure の scope メモに明記・follow-up)。
- **型整合**: `SkippedSkill`(slot/times) は Task 2 で定義→Task 5 で使用。`CarryTarget`/`resolveEventTarget`/`applyResolvedTargets` は Task 3 定義→Task 7 使用。`importBlockReason` 2引数化は Task 4→Task 6 で配線。`targetKey` 安定キーは Task 7 内で一貫。
- **placeholder**: UI タスク(6-9)は既存 800 行モーダルの改修のため、完全 JSX でなく「正確な現行行アンカー + 追加/削除する state・handler・条件・テスト assertion」を提示(実装者は実ファイルを読んで適用)。純関数(1-5)は完全 TDD コード。
- **既存不変**: `parseMitigationSheet` 不変 / `buildPlanFromSheets` は skipped additive のみ(既存テスト=回帰ガード) / 他取込経路(`applyTemplateTargetsToResult` 自体は残す・本モーダルが使わなくなるだけ)。
