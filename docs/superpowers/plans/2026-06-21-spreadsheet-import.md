# スプレッドシート軽減表 取り込み Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ユーザー側の軽減表に、人気フォーマットのスプレッドシート軽減表を貼り付けで丸ごと（タイムライン＋ダメージ＋フェーズ＋軽減割り当て＋パーティ）取り込む機能を新設する。

**Architecture:** 取り込みロジックを `src/lib/sheetImport/` の純粋関数（パーサ→スキル解決→パーティ解決→PlanData 組み立て）に集約し、ウィザード UI（マルチ貼り付け）と store 反映を上に載せる。既存の取り込み（FFLogs / `importTimelineEvents` / `importModes`）には一切触れない。

**Tech Stack:** React + TypeScript（strict, tsc -b）、Zustand、react-i18next、vitest（pool=vmThreads）、Vite。

**Spec:** `docs/superpowers/specs/2026-06-21-spreadsheet-import-design.md`

## Global Constraints

- **既存のユーザー側取り込み（FFLogs / `useMitigationStore.importTimelineEvents` / `src/utils/importModes.ts`）には一切触れない。** 本機能は新規経路として独立追加する。
- **対象フォーマットは人気シート 1 種のみ**（spec §3）。他フォーマットは対象外。
- **未対応技は取り込まずスキップし「入らなかった技」として集計する**（手動マッピングは作らない）。未対応 8 技（spec §4.2）: エクリブリウム / ベネディクション / ディグニティ(クラウンロード) / アスペクト・ベネフィク / マニフェステーション / ペプシス / リゾーマタ / テンペラコート。
- **時刻は「通し時間（Total Time）」列を正に使う**（spec §3.1・§10）。フェーズは「Phase 列」のラベル変化で区切る。
- **データモデルの確定フィールド**（`src/types/index.ts`）: `TimelineEvent { id; time(秒); name: LocalizedString; damageType: 'magical'|'physical'|'unavoidable'|'enrage'; damageAmount? }`（:108-121）/ `AppliedMitigation { id; mitigationId; time; duration; ownerId; targetId? }`（:97-106）/ `Phase { id; name: LocalizedString; startTime; endTime }`（:123-128）/ `PartyMember { id(枠); jobId: string|null; role: 'tank'|'healer'|'dps'; stats; computedValues; mode? }`（:166-178）。
- **パーティ枠は固定 8**（`MT/ST/H1/H2/D1/D2/D3/D4`、`useMitigationStore.ts:241-249`）。`AppliedMitigation.ownerId` は枠文字列。
- **プラン上限**: `PLAN_LIMITS.MAX_PLANS_PER_CONTENT = 5` / `MAX_TOTAL_PLANS = 50`（`src/types/firebase.ts:164-166`）。
- **型 import は `import type`**（tsc -b 厳密・`erasableSyntaxOnly`）。未使用 import/var を残さない（Vercel は TS6133 で build 失敗）。
- **i18n 必須**（ja/en/ko/zh・新 prefix `sheetImport.*`）。en 表示崩れなし。
- vitest は `pool='vmThreads'` 維持。実行は **focused** に `npm test -- <path>`、出力はファイルへ（`> .vt.txt 2>&1; echo "EXIT=$?" >> .vt.txt`）、`| grep`/`head`/`tail` へパイプ禁止（Windows EPIPE ハング・[[reference_vitest_vmthreads_hang]]）。push 前 `npm run build`（[[feedback_vercel_tsc_strict]]）。
- ブランチ `feat/spreadsheet-import`（作成済み）で作業。各タスク完了ごとにコミット。

---

## File Structure

| ファイル | 区分 | 責務 |
|---|---|---|
| `src/lib/sheetImport/types.ts` | 新規 | 共有型（`SheetColumn` / `SheetRow` / `ParsedSheet` / `SheetImportResult` / `SkippedSkill`） |
| `src/lib/sheetImport/parseMitigationSheet.ts` | 新規 | TSV 1 タブ分 → `ParsedSheet`（純粋・ラベル駆動） |
| `src/lib/sheetImport/skillAliases.ts` | 新規 | スプシ技名→LoPo 技名 の正規化エイリアス（固定マップ） |
| `src/lib/sheetImport/resolveSheetSkill.ts` | 新規 | (ジョブ名, 技名, jobs, mitigations) → `mitigationId | null`（純粋） |
| `src/lib/sheetImport/resolveImportParty.ts` | 新規 | 使用ジョブ集合 → 枠割当 `PartyMember[]`（純粋） |
| `src/lib/sheetImport/buildPlanFromSheets.ts` | 新規 | 複数フェーズ + パーティ + 解決 → `SheetImportResult`（純粋） |
| `src/components/SpreadsheetImportModal.tsx` | 新規 | ウィザード UI（マルチ貼り付け→確認→プレビュー→確定） |
| `src/components/Timeline.tsx` | 改変 | モーダル mount ＋ 起動イベント/ボタン配線 |
| `src/store/usePlanStore.ts`（または既存新規作成 API） | 利用 | 反映（新規プラン作成 / 5-5 チューザー）。改変は最小。 |
| `src/locales/{ja,en,ko,zh}.json` | 改変 | `sheetImport.*` キー追加 |

テスト: `src/lib/sheetImport/__tests__/{parseMitigationSheet,resolveSheetSkill,resolveImportParty,buildPlanFromSheets}.test.ts`

---

## Task 1: 共有型 ＋ `parseMitigationSheet`（TSV パーサ）

**Files:**
- Create: `src/lib/sheetImport/types.ts`
- Create: `src/lib/sheetImport/parseMitigationSheet.ts`
- Test: `src/lib/sheetImport/__tests__/parseMitigationSheet.test.ts`

**Interfaces:**
- Produces:
  - `SheetColumn = { index: number; job: string; skillNameRaw: string }`
  - `SheetRow = { phaseLabel: string; totalTimeSec: number; action: string; damageAmount: number | null; damageType: 'physical' | 'magical' | null; trueColumnIndexes: number[] }`
  - `ParsedSheet = { columns: SheetColumn[]; rows: SheetRow[] }`
  - `parseMitigationSheet(tsv: string): ParsedSheet | null`（メタ行/データ表が見つからなければ `null`）

**パーサ方針（ラベル駆動・spec §3）:** 行＝`\n` 分割、セル＝`\t` 分割。
1. **データ表ヘッダー行** = セルに `"Action"` を含む行。そこから `Phase`/`Action` の列 index を得る。
2. **Hit 列** = データ表ヘッダーの次以降の行で `"Hit"` を含む行の `"Hit"` 列 index（= `damageAmount`）。`"Type"` 列はデータ表ヘッダー行の `"Type"` index。
3. **Total Time 列** = メタ先頭ヘッダー行の `"Total Time"` 列 index（無ければ `"Time"` の最初）。値は `mm:ss`→秒。
4. **Skill 行** = セルに `"Skill"` を含む行。`"Skill"` 列より右で、空でないセルを持つ列 = 軽減列。各軽減列の `skillNameRaw` = その行のセル。
5. **ジョブ行** = 既知 20 ジョブ名（下記 `JOB_JA_NAMES`）のいずれかを 3 つ以上含む行。各軽減列の `job` = その行の同 index セル。
6. **データ行** = データ表ヘッダー以降で、Total Time 列が `mm:ss` 形式の行。各行: `phaseLabel`=Phase 列セル（空なら直前を引き継ぎ）、`totalTimeSec`、`action`=Action 列、`damageAmount`=Hit 列（数値・カンマ除去、空/0 は `null` か 0）、`damageType`=Type 列（`Physical`→`physical`/`Magic`→`magical`/その他→`null`）、`trueColumnIndexes`=軽減列のうちセルが `"TRUE"` の index。

> **重要（実装者へ）:** 上記は spec のユーザー提供実データに基づくが、本物のシートには 2 段ヘッダー（Damage の下に Hit/DoT/tick）等の癖がある。**この会話に貼られた実データ全文でも必ず動作確認し、ヒューリスティクスを調整すること。** 下の fixture テストは契約の最小固定。実データで崩れたら fixture を増やして直す。

- [ ] **Step 1: 型ファイルを作成**

`src/lib/sheetImport/types.ts`:

```ts
export interface SheetColumn {
  index: number;
  job: string;        // スプシのジョブ名（例 "ナイト"）
  skillNameRaw: string; // スプシのスキル名（例 "リプライザル"）
}

export interface SheetRow {
  phaseLabel: string;
  totalTimeSec: number;
  action: string;
  damageAmount: number | null;
  damageType: 'physical' | 'magical' | null;
  trueColumnIndexes: number[];
}

export interface ParsedSheet {
  columns: SheetColumn[];
  rows: SheetRow[];
}

export interface SkippedSkill {
  job: string;
  skillName: string;
}
```

- [ ] **Step 2: 失敗するテストを書く**

`src/lib/sheetImport/__tests__/parseMitigationSheet.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseMitigationSheet } from '../parseMitigationSheet';

// 最小だが実フォーマット準拠の fixture（タブ区切り）。
// 列レイアウト: 0=Phase 1=TotalTime 2=Time 3=Action 4=Type 5=Hit 6=DoT 7=tick 8.. = 軽減列
const T = (cells: string[]) => cells.join('\t');
const FIXTURE = [
  // ジョブ行（左ラベルは無関係・job 名で検出）
  T(['', '', '', '', '', '', '', '', 'ナイト', 'ナイト', '白魔道士']),
  // Skill 行
  T(['', '', '', 'Skill', '', '', '', '', 'リプライザル', 'ランパート', 'アサイラム']),
  // データ表ヘッダー
  T(['Phase', 'Total Time', 'Time', 'Action', 'Type', 'Hit', 'DoT', 'tick', 'Mitigation', 'Mitigation', 'Mitigation']),
  // データ行 1（開幕・通し0:07・AA・物理・Hit115000・ナイトのリプライザルTRUE）
  T(['開幕', '00:07', '00:07', 'AA', 'Physical', '115,000', '98,325', '14.5%', 'TRUE', 'FALSE', 'FALSE']),
  // データ行 2（開幕・0:29・グランドクロス・魔法・Hit250000・白魔のアサイラムTRUE）
  T(['', '00:29', '00:29', 'グランドクロス', 'Magic', '250,000', '0', '44.4%', 'FALSE', 'FALSE', 'TRUE']),
  // データ行 3（真偽記憶・0:40・なぞなぞマジック・ダメージ0・チェック無し）
  T(['真偽記憶', '00:40', '00:40', 'なぞなぞマジック', '', '0', '0', '23.5%', 'FALSE', 'FALSE', 'FALSE']),
].join('\n');

describe('parseMitigationSheet', () => {
  it('軽減列の (index, job, skillNameRaw) を抽出する', () => {
    const p = parseMitigationSheet(FIXTURE)!;
    expect(p.columns).toEqual([
      { index: 8, job: 'ナイト', skillNameRaw: 'リプライザル' },
      { index: 9, job: 'ナイト', skillNameRaw: 'ランパート' },
      { index: 10, job: '白魔道士', skillNameRaw: 'アサイラム' },
    ]);
  });
  it('データ行を抽出する（通し時間秒・action・damage・type・TRUE列）', () => {
    const p = parseMitigationSheet(FIXTURE)!;
    expect(p.rows[0]).toEqual({
      phaseLabel: '開幕', totalTimeSec: 7, action: 'AA',
      damageAmount: 115000, damageType: 'physical', trueColumnIndexes: [8],
    });
    expect(p.rows[1]).toEqual({
      phaseLabel: '開幕', totalTimeSec: 29, action: 'グランドクロス',
      damageAmount: 250000, damageType: 'magical', trueColumnIndexes: [10],
    });
  });
  it('Phase 列が空の行は直前のフェーズを引き継ぐ', () => {
    const p = parseMitigationSheet(FIXTURE)!;
    expect(p.rows[1].phaseLabel).toBe('開幕');
    expect(p.rows[2].phaseLabel).toBe('真偽記憶');
  });
  it('damageType は Physical→physical / Magic→magical / 空→null', () => {
    const p = parseMitigationSheet(FIXTURE)!;
    expect(p.rows[2].damageType).toBeNull();
  });
  it('メタ行/データ表が無ければ null', () => {
    expect(parseMitigationSheet('foo\tbar\nbaz\tqux')).toBeNull();
    expect(parseMitigationSheet('')).toBeNull();
  });
});
```

- [ ] **Step 3: テストが失敗することを確認**

Run: `npm test -- src/lib/sheetImport/__tests__/parseMitigationSheet.test.ts`（出力はファイルへ）
Expected: FAIL（モジュール無し）

- [ ] **Step 4: 実装する（リファレンス実装・実データで要調整）**

`src/lib/sheetImport/parseMitigationSheet.ts`:

```ts
import type { ParsedSheet, SheetColumn, SheetRow } from './types';

const JOB_JA_NAMES = new Set([
  'ナイト', '戦士', '暗黒騎士', 'ガンブレイカー', '白魔道士', '占星術師', '学者', '賢者',
  'モンク', '竜騎士', '忍者', '侍', 'リーパー', 'ヴァイパー', '吟遊詩人', '機工士',
  '踊り子', '黒魔道士', '召喚士', '赤魔道士', 'ピクトマンサー', 'タンク',
]);

function mmssToSec(v: string): number | null {
  const m = v.trim().match(/^(\d+):([0-5]?\d)$/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function findColIndex(cells: string[], label: string): number {
  return cells.findIndex((c) => c.trim() === label);
}

export function parseMitigationSheet(tsv: string): ParsedSheet | null {
  if (!tsv.trim()) return null;
  const lines = tsv.replace(/\r\n/g, '\n').split('\n').map((l) => l.split('\t'));

  // データ表ヘッダー（"Action" を含む行）
  const headerRow = lines.findIndex((cells) => cells.some((c) => c.trim() === 'Action'));
  if (headerRow < 0) return null;
  const header = lines[headerRow];
  const colAction = findColIndex(header, 'Action');
  const colPhase = findColIndex(header, 'Phase');
  const colType = findColIndex(header, 'Type');
  const colTotalTime = (() => {
    const tt = findColIndex(header, 'Total Time');
    return tt >= 0 ? tt : findColIndex(header, 'Time');
  })();

  // Hit 列（ヘッダー行 or 直後のサブヘッダー行）
  let colHit = findColIndex(header, 'Hit');
  if (colHit < 0 && lines[headerRow + 1]) colHit = findColIndex(lines[headerRow + 1], 'Hit');

  // Skill 行・ジョブ行（ヘッダーより上のメタ領域）
  const skillRowIdx = lines.findIndex((cells) => cells.some((c) => c.trim() === 'Skill'));
  if (skillRowIdx < 0) return null;
  const skillRow = lines[skillRowIdx];
  const jobRowIdx = lines.findIndex(
    (cells) => cells.filter((c) => JOB_JA_NAMES.has(c.trim())).length >= 3,
  );
  if (jobRowIdx < 0) return null;
  const jobRow = lines[jobRowIdx];

  // 軽減列 = Action 列より右で Skill 行が非空の列
  const firstMitCol = colAction + 1;
  const columns: SheetColumn[] = [];
  for (let i = firstMitCol; i < skillRow.length; i++) {
    const skillNameRaw = (skillRow[i] ?? '').trim();
    const job = (jobRow[i] ?? '').trim();
    if (skillNameRaw && job) columns.push({ index: i, job, skillNameRaw });
  }

  // データ行 = ヘッダー以降で Total Time が mm:ss の行
  const rows: SheetRow[] = [];
  let lastPhase = '';
  for (let r = headerRow + 1; r < lines.length; r++) {
    const cells = lines[r];
    const totalTimeSec = mmssToSec(cells[colTotalTime] ?? '');
    if (totalTimeSec === null) continue;
    const phaseCell = (cells[colPhase] ?? '').trim();
    if (phaseCell) lastPhase = phaseCell;
    const hit = (cells[colHit] ?? '').replace(/,/g, '').trim();
    const damageAmount = hit && Number.isFinite(Number(hit)) && Number(hit) > 0 ? Number(hit) : null;
    const typeCell = (cells[colType] ?? '').trim();
    const damageType = typeCell === 'Physical' ? 'physical' : typeCell === 'Magic' ? 'magical' : null;
    const trueColumnIndexes = columns
      .filter((c) => (cells[c.index] ?? '').trim() === 'TRUE')
      .map((c) => c.index);
    rows.push({ phaseLabel: lastPhase, totalTimeSec, action: (cells[colAction] ?? '').trim(), damageAmount, damageType, trueColumnIndexes });
  }
  if (rows.length === 0) return null;
  return { columns, rows };
}
```

- [ ] **Step 5: テストが通ることを確認**

Run: `npm test -- src/lib/sheetImport/__tests__/parseMitigationSheet.test.ts`
Expected: PASS（5 ケース）

- [ ] **Step 6: 実データ検証（必須）**

この会話に貼られた実データ全文（メタ行＋全データ行）を一時 fixture にして `parseMitigationSheet` を通し、columns（ジョブ/スキル名）と rows（通し時間・action・TRUE 列）が妥当か目視。崩れたらヒューリスティクス（特に 2 段ヘッダー・Hit/DoT 位置）を調整し、fixture テストを増やして固定。

- [ ] **Step 7: ビルドとコミット**

Run: `npm run build`（tsc -b エラーなし）
```bash
git add src/lib/sheetImport/types.ts src/lib/sheetImport/parseMitigationSheet.ts src/lib/sheetImport/__tests__/parseMitigationSheet.test.ts
git commit -m "feat(sheetImport): TSVパーサ parseMitigationSheet + 共有型"
```

---

## Task 2: `resolveSheetSkill`（スキル名→LoPo id・正規化）

**Files:**
- Create: `src/lib/sheetImport/skillAliases.ts`
- Create: `src/lib/sheetImport/resolveSheetSkill.ts`
- Test: `src/lib/sheetImport/__tests__/resolveSheetSkill.test.ts`

**Interfaces:**
- Consumes: 型 `Mitigation` / `Job`（`src/types/index.ts`）。
- Produces:
  - `JOB_JA_TO_ID: Record<string, string>`（"ナイト"→"pld" 等）
  - `SKILL_ALIASES: Record<string, string>`（スプシ名→LoPo `name.ja`）
  - `resolveSheetSkill(jobJa: string, skillNameRaw: string, mitigations: Mitigation[]): string | null`

**正規化（spec §6）:** ①末尾括弧除去 ②エイリアス置換 ③ジョブ→jobId ④その jobId の `MITIGATIONS` から `name.ja` 一致を探し id を返す。無ければ `null`。

- [ ] **Step 1: エイリアス/ジョブ表を作成**

`src/lib/sheetImport/skillAliases.ts`:

```ts
/** スプシのジョブ表記 → LoPo jobId */
export const JOB_JA_TO_ID: Record<string, string> = {
  'ナイト': 'pld', '戦士': 'war', '暗黒騎士': 'drk', 'ガンブレイカー': 'gnb',
  '白魔道士': 'whm', '占星術師': 'ast', '学者': 'sch', '賢者': 'sge',
  'モンク': 'mnk', '竜騎士': 'drg', '忍者': 'nin', '侍': 'sam', 'リーパー': 'rpr', 'ヴァイパー': 'vpr',
  '吟遊詩人': 'brd', '機工士': 'mch', '踊り子': 'dnc',
  '黒魔道士': 'blm', '召喚士': 'smn', '赤魔道士': 'rdm', 'ピクトマンサー': 'pct',
};

/** スプシのスキル表記 → LoPo の name.ja（表記ゆれ吸収・spec §6-3） */
export const SKILL_ALIASES: Record<string, string> = {
  'インプロビゼーションフィニッシュ': 'インプロビゼーション',
  'コンジャクション・ヘリオス': 'コンジャンクション・ヘリオス',
  '意気軒昂の策': '意気軒高の策',
  '深謀遠慮の策': '深謀遠慮',
};
```

- [ ] **Step 2: 失敗するテストを書く**

`src/lib/sheetImport/__tests__/resolveSheetSkill.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolveSheetSkill } from '../resolveSheetSkill';
import type { Mitigation } from '../../../types';

const M = (id: string, jobId: string, ja: string): Mitigation =>
  ({ id, jobId, name: { ja, en: ja }, recast: 0, duration: 0, type: 'all', value: 0 } as Mitigation);

const MITS: Mitigation[] = [
  M('reprisal_pld', 'pld', 'リプライザル'),
  M('reprisal_war', 'war', 'リプライザル'),
  M('rampart_pld', 'pld', 'ランパート'),
  M('liturgy_of_the_bell', 'whm', 'リタージー・オブ・ベル'),
  M('excogitation', 'sch', '深謀遠慮'),
  M('improvisation', 'dnc', 'インプロビゼーション'),
];

describe('resolveSheetSkill', () => {
  it('役割共有スキルをジョブ別 id に解決', () => {
    expect(resolveSheetSkill('ナイト', 'リプライザル', MITS)).toBe('reprisal_pld');
    expect(resolveSheetSkill('戦士', 'リプライザル', MITS)).toBe('reprisal_war');
  });
  it('末尾括弧を除去して一致', () => {
    expect(resolveSheetSkill('白魔道士', 'リタージー・オブ・ベル(ダメージトリガー)', MITS)).toBe('liturgy_of_the_bell');
  });
  it('エイリアス（の策付与・フィニッシュ）を解決', () => {
    expect(resolveSheetSkill('学者', '深謀遠慮の策', MITS)).toBe('excogitation');
    expect(resolveSheetSkill('踊り子', 'インプロビゼーションフィニッシュ(踊りの激情0)', MITS)).toBe('improvisation');
  });
  it('LoPo に無い技は null', () => {
    expect(resolveSheetSkill('白魔道士', 'ベネディクション', MITS)).toBeNull();
    expect(resolveSheetSkill('戦士', 'エクリブリウム', MITS)).toBeNull();
  });
  it('未知ジョブは null', () => {
    expect(resolveSheetSkill('未知', 'リプライザル', MITS)).toBeNull();
  });
});
```

- [ ] **Step 3: テストが失敗することを確認**

Run: `npm test -- src/lib/sheetImport/__tests__/resolveSheetSkill.test.ts`
Expected: FAIL（モジュール無し）

- [ ] **Step 4: 実装する**

`src/lib/sheetImport/resolveSheetSkill.ts`:

```ts
import type { Mitigation } from '../../types';
import { JOB_JA_TO_ID, SKILL_ALIASES } from './skillAliases';

/** 末尾の括弧（全角/半角）以降を除去 */
function stripParenthetical(name: string): string {
  return name.replace(/[（(].*$/, '').trim();
}

export function resolveSheetSkill(
  jobJa: string,
  skillNameRaw: string,
  mitigations: Mitigation[],
): string | null {
  const jobId = JOB_JA_TO_ID[jobJa.trim()];
  if (!jobId) return null;
  const stripped = stripParenthetical(skillNameRaw);
  const normalized = SKILL_ALIASES[stripped] ?? stripped;
  const hit = mitigations.find((m) => m.jobId === jobId && m.name.ja === normalized);
  return hit ? hit.id : null;
}
```

- [ ] **Step 5: テストが通ることを確認**

Run: `npm test -- src/lib/sheetImport/__tests__/resolveSheetSkill.test.ts`
Expected: PASS（5 ケース）

- [ ] **Step 6: ビルドとコミット**

Run: `npm run build`
```bash
git add src/lib/sheetImport/skillAliases.ts src/lib/sheetImport/resolveSheetSkill.ts src/lib/sheetImport/__tests__/resolveSheetSkill.test.ts
git commit -m "feat(sheetImport): スキル名→LoPo id 解決 resolveSheetSkill + 正規化エイリアス"
```

---

## Task 3: `resolveImportParty`（使用ジョブ→枠割当）

**Files:**
- Create: `src/lib/sheetImport/resolveImportParty.ts`
- Test: `src/lib/sheetImport/__tests__/resolveImportParty.test.ts`

**Interfaces:**
- Consumes: 型 `Job`（`src/types/index.ts:25-30`、`{ id; name; role }`）。
- Produces: `resolveImportParty(usedJobIds: string[], jobs: Job[]): { slot: string; jobId: string }[]`
  - 枠順: タンク→`['MT','ST']`、ヒーラー→`['H1','H2']`、DPS→`['D1','D2','D3','D4']`（検出順）。ロールあたり枠数を超えた分は捨てる（注記用に呼び出し側で扱う）。

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/sheetImport/__tests__/resolveImportParty.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolveImportParty } from '../resolveImportParty';
import type { Job } from '../../../types';

const J = (id: string, role: 'tank' | 'healer' | 'dps'): Job =>
  ({ id, name: { ja: id, en: id }, role, icon: '' } as Job);
const JOBS: Job[] = [
  J('pld', 'tank'), J('war', 'tank'), J('whm', 'healer'), J('sch', 'healer'),
  J('mnk', 'dps'), J('drg', 'dps'), J('brd', 'dps'), J('blm', 'dps'),
];

describe('resolveImportParty', () => {
  it('ロール別に枠を割り当てる', () => {
    const out = resolveImportParty(['pld', 'war', 'whm', 'sch', 'mnk', 'drg', 'brd', 'blm'], JOBS);
    expect(out).toEqual([
      { slot: 'MT', jobId: 'pld' }, { slot: 'ST', jobId: 'war' },
      { slot: 'H1', jobId: 'whm' }, { slot: 'H2', jobId: 'sch' },
      { slot: 'D1', jobId: 'mnk' }, { slot: 'D2', jobId: 'drg' },
      { slot: 'D3', jobId: 'brd' }, { slot: 'D4', jobId: 'blm' },
    ]);
  });
  it('検出順で枠に詰める（部分編成）', () => {
    const out = resolveImportParty(['whm', 'pld', 'mnk'], JOBS);
    expect(out).toEqual([
      { slot: 'H1', jobId: 'whm' }, { slot: 'MT', jobId: 'pld' }, { slot: 'D1', jobId: 'mnk' },
    ]);
  });
  it('未知 jobId は無視', () => {
    expect(resolveImportParty(['xyz', 'pld'], JOBS)).toEqual([{ slot: 'MT', jobId: 'pld' }]);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test -- src/lib/sheetImport/__tests__/resolveImportParty.test.ts`
Expected: FAIL

- [ ] **Step 3: 実装する**

`src/lib/sheetImport/resolveImportParty.ts`:

```ts
import type { Job } from '../../types';

const SLOTS_BY_ROLE: Record<'tank' | 'healer' | 'dps', string[]> = {
  tank: ['MT', 'ST'],
  healer: ['H1', 'H2'],
  dps: ['D1', 'D2', 'D3', 'D4'],
};

export function resolveImportParty(
  usedJobIds: string[],
  jobs: Job[],
): { slot: string; jobId: string }[] {
  const roleOf = new Map(jobs.map((j) => [j.id, j.role] as const));
  const next: Record<'tank' | 'healer' | 'dps', number> = { tank: 0, healer: 0, dps: 0 };
  const out: { slot: string; jobId: string }[] = [];
  for (const jobId of usedJobIds) {
    const role = roleOf.get(jobId);
    if (!role) continue;
    const slot = SLOTS_BY_ROLE[role][next[role]];
    if (!slot) continue; // ロール枠超過は捨てる
    next[role] += 1;
    out.push({ slot, jobId });
  }
  return out;
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- src/lib/sheetImport/__tests__/resolveImportParty.test.ts`
Expected: PASS（3 ケース）

- [ ] **Step 5: ビルドとコミット**

```bash
git add src/lib/sheetImport/resolveImportParty.ts src/lib/sheetImport/__tests__/resolveImportParty.test.ts
git commit -m "feat(sheetImport): 使用ジョブ→枠割当 resolveImportParty"
```

---

## Task 4: `buildPlanFromSheets`（PlanData 断片の組み立て）

**Files:**
- Create: `src/lib/sheetImport/buildPlanFromSheets.ts`
- Test: `src/lib/sheetImport/__tests__/buildPlanFromSheets.test.ts`

**Interfaces:**
- Consumes: `ParsedSheet`（Task 1）、`resolveSheetSkill`（Task 2）、`resolveImportParty`（Task 3）、型 `Mitigation`/`Job`/`TimelineEvent`/`AppliedMitigation`/`Phase`。
- Produces:
  - `SheetImportResult = { timelineEvents: TimelineEvent[]; timelineMitigations: AppliedMitigation[]; phases: Phase[]; party: { slot: string; jobId: string }[]; skipped: SkippedSkill[] }`
  - `buildPlanFromSheets(sheets: ParsedSheet[], deps: { mitigations: Mitigation[]; jobs: Job[] }, options: { includeMitigations: boolean }): SheetImportResult`

**仕様:** 複数 `ParsedSheet`（フェーズごと）の全行を Total Time 昇順にマージ。各行 → `TimelineEvent`（id 採番、`damageType` 既定 `'magical'`、`name={ja:action,en:action}`）。`includeMitigations` 時のみ: 各行の `trueColumnIndexes` → 列の (job, skill) を `resolveSheetSkill` で解決し `AppliedMitigation`（解決失敗は `skipped` へ・重複は集約）。`ownerId` は使用ジョブ→枠（`resolveImportParty`）の枠。フェーズ = Phase 列ラベルの連続塊（`startTime`=塊先頭の Total Time、`endTime`=次塊先頭 or 最終+1）。

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/sheetImport/__tests__/buildPlanFromSheets.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildPlanFromSheets } from '../buildPlanFromSheets';
import type { ParsedSheet } from '../types';
import type { Mitigation, Job } from '../../../types';

const M = (id: string, jobId: string, ja: string, duration = 10): Mitigation =>
  ({ id, jobId, name: { ja, en: ja }, recast: 0, duration, type: 'all', value: 0 } as Mitigation);
const J = (id: string, role: 'tank' | 'healer' | 'dps'): Job =>
  ({ id, name: { ja: id, en: id }, role, icon: '' } as Job);

const MITS = [M('reprisal_pld', 'pld', 'リプライザル', 15), M('asylum', 'whm', 'アサイラム', 24)];
const JOBS = [J('pld', 'tank'), J('whm', 'healer')];

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

describe('buildPlanFromSheets', () => {
  it('TimelineEvent を Total Time 順に作る（damageType 既定 magical）', () => {
    const r = buildPlanFromSheets([sheet], { mitigations: MITS, jobs: JOBS }, { includeMitigations: true });
    expect(r.timelineEvents.map((e) => [e.time, e.action ?? e.name.ja, e.damageType])).toEqual([
      [7, 'AA', 'physical'], [40, 'なぞなぞ', 'magical'],
    ]);
  });
  it('TRUE セル→AppliedMitigation（owner=枠・time=通し・duration=スナップショット）', () => {
    const r = buildPlanFromSheets([sheet], { mitigations: MITS, jobs: JOBS }, { includeMitigations: true });
    expect(r.timelineMitigations).toHaveLength(1); // ナイトのリプライザルのみ（ベネは skip）
    expect(r.timelineMitigations[0]).toMatchObject({ mitigationId: 'reprisal_pld', ownerId: 'MT', time: 7, duration: 15 });
  });
  it('未対応技は skipped に集約', () => {
    const r = buildPlanFromSheets([sheet], { mitigations: MITS, jobs: JOBS }, { includeMitigations: true });
    expect(r.skipped).toContainEqual({ job: '白魔道士', skillName: 'ベネディクション' });
  });
  it('フェーズを Phase 列ラベルの塊で作る', () => {
    const r = buildPlanFromSheets([sheet], { mitigations: MITS, jobs: JOBS }, { includeMitigations: true });
    expect(r.phases.map((p) => [p.name.ja, p.startTime])).toEqual([['開幕', 7], ['真偽記憶', 40]]);
  });
  it('includeMitigations=false なら軽減もパーティも空', () => {
    const r = buildPlanFromSheets([sheet], { mitigations: MITS, jobs: JOBS }, { includeMitigations: false });
    expect(r.timelineMitigations).toEqual([]);
    expect(r.party).toEqual([]);
    expect(r.timelineEvents).toHaveLength(2);
  });
});
```

> 注: `TimelineEvent` に `action` フィールドは無い（`name: LocalizedString` のみ）。テストの `e.action ?? e.name.ja` は型安全のため `e.name.ja` を読む意図。実装では `name = { ja: row.action, en: row.action }`。テストはこの想定に合わせ `e.name.ja` を使う形へ実装者が調整してよい。

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test -- src/lib/sheetImport/__tests__/buildPlanFromSheets.test.ts`
Expected: FAIL

- [ ] **Step 3: 実装する**

`src/lib/sheetImport/buildPlanFromSheets.ts`:

```ts
import type { ParsedSheet, SheetColumn, SkippedSkill } from './types';
import type { Mitigation, Job, TimelineEvent, AppliedMitigation, Phase } from '../../types';
import { resolveSheetSkill } from './resolveSheetSkill';
import { resolveImportParty } from './resolveImportParty';
import { JOB_JA_TO_ID } from './skillAliases';

export interface SheetImportResult {
  timelineEvents: TimelineEvent[];
  timelineMitigations: AppliedMitigation[];
  phases: Phase[];
  party: { slot: string; jobId: string }[];
  skipped: SkippedSkill[];
}

let seq = 0;
const uid = (p: string) => `${p}_${Date.now().toString(36)}_${(seq++).toString(36)}`;

export function buildPlanFromSheets(
  sheets: ParsedSheet[],
  deps: { mitigations: Mitigation[]; jobs: Job[] },
  options: { includeMitigations: boolean },
): SheetImportResult {
  // 全シートの行を Total Time 昇順マージ。列は各シート固有なので行に紐付けて持つ。
  const merged = sheets.flatMap((s) => s.rows.map((row) => ({ row, columns: s.columns })));
  merged.sort((a, b) => a.row.totalTimeSec - b.row.totalTimeSec);

  const timelineEvents: TimelineEvent[] = merged.map(({ row }) => ({
    id: uid('ev'),
    time: row.totalTimeSec,
    name: { ja: row.action, en: row.action },
    damageType: row.damageType ?? 'magical',
    ...(row.damageAmount != null ? { damageAmount: row.damageAmount } : {}),
  }));

  // フェーズ = phaseLabel の連続塊
  const phases: Phase[] = [];
  for (const { row } of merged) {
    const last = phases[phases.length - 1];
    if (!last || last.name.ja !== row.phaseLabel) {
      if (last) last.endTime = row.totalTimeSec;
      phases.push({ id: uid('ph'), name: { ja: row.phaseLabel, en: row.phaseLabel }, startTime: row.totalTimeSec, endTime: row.totalTimeSec });
    }
  }
  if (phases.length) phases[phases.length - 1].endTime = (merged.at(-1)?.row.totalTimeSec ?? 0) + 1;

  if (!options.includeMitigations) {
    return { timelineEvents, timelineMitigations: [], phases, party: [], skipped: [] };
  }

  // 使用ジョブ検出（TRUE が1つでもある列のジョブ）
  const usedJobJa = new Set<string>();
  for (const { row, columns } of merged) {
    for (const idx of row.trueColumnIndexes) {
      const col = columns.find((c) => c.index === idx);
      if (col) usedJobJa.add(col.job);
    }
  }
  const usedJobIds = [...usedJobJa].map((ja) => JOB_JA_TO_ID[ja]).filter(Boolean) as string[];
  const party = resolveImportParty(usedJobIds, deps.jobs);
  const slotByJobId = new Map(party.map((p) => [p.jobId, p.slot] as const));

  const timelineMitigations: AppliedMitigation[] = [];
  const skippedSet = new Map<string, SkippedSkill>();
  for (const { row, columns } of merged) {
    for (const idx of row.trueColumnIndexes) {
      const col: SheetColumn | undefined = columns.find((c) => c.index === idx);
      if (!col) continue;
      const mitId = resolveSheetSkill(col.job, col.skillNameRaw, deps.mitigations);
      if (!mitId) {
        skippedSet.set(`${col.job}/${col.skillNameRaw}`, { job: col.job, skillName: col.skillNameRaw });
        continue;
      }
      const jobId = JOB_JA_TO_ID[col.job];
      const ownerId = jobId ? slotByJobId.get(jobId) : undefined;
      if (!ownerId) continue; // ロール枠超過等で枠が無い
      const mit = deps.mitigations.find((m) => m.id === mitId);
      timelineMitigations.push({ id: uid('mit'), mitigationId: mitId, time: row.totalTimeSec, duration: mit?.duration ?? 0, ownerId });
    }
  }

  return { timelineEvents, timelineMitigations, phases, party, skipped: [...skippedSet.values()] };
}
```

- [ ] **Step 4: テストが通ることを確認（テストの `e.action` 参照を `e.name.ja` へ直す）**

Run: `npm test -- src/lib/sheetImport/__tests__/buildPlanFromSheets.test.ts`
Expected: PASS（5 ケース）

- [ ] **Step 5: ビルドとコミット**

```bash
git add src/lib/sheetImport/buildPlanFromSheets.ts src/lib/sheetImport/__tests__/buildPlanFromSheets.test.ts
git commit -m "feat(sheetImport): PlanData断片組み立て buildPlanFromSheets（複数フェーズ統合・skip集約）"
```

---

## Task 5: `SpreadsheetImportModal`（ウィザード UI）＋ i18n

**Files:**
- Create: `src/components/SpreadsheetImportModal.tsx`
- Modify: `src/locales/{ja,en,ko,zh}.json`（`sheetImport.*` キー）

**Interfaces:**
- Consumes: `parseMitigationSheet`（Task 1）、`buildPlanFromSheets`（Task 4）、`useSkillsData`（`getMitigationsFromStore`/`getJobsFromStore`）。
- Produces: `SpreadsheetImportModal`（Props: `{ isOpen: boolean; onClose: () => void; onImport: (result: SheetImportResult, mode: 'new' | 'replace_current') => void }`）。Task 6 が配線。

UI 専従（取得→確認→プレビュー→`onImport`）。ロジックは Task 1-4 の純粋関数。テストは UI 駆動を避け、純粋関数テスト＋実機で担保（[[reference_vitest_vmthreads_hang]]）。

- [ ] **Step 1: i18n キーを 4 言語に追加**

各 `src/locales/{ja,en,ko,zh}.json` に `sheetImport` オブジェクトを追加（値は言語別）。ja の例:

```json
"sheetImport": {
  "btn": "スプシ取り込み",
  "title": "スプレッドシートから軽減表を取り込む",
  "mode_with_mitigations": "軽減も取り込む",
  "mode_timeline_only": "タイムラインだけ取り込む",
  "paste_label": "スプレッドシートを全選択(Ctrl+A)してコピーし、ここに貼り付け",
  "add_phase": "次のフェーズを追加",
  "detected_phase": "フェーズ「{{name}}」: イベント{{events}}件・軽減{{mits}}件",
  "parse_failed": "データ表が見つかりません。シートを全選択してコピーし直してください",
  "party_label": "パーティ（枠の割り当てを確認）",
  "preview_summary": "{{phases}}フェーズ・技{{events}}件・軽減{{mits}}件・パーティ{{party}}人",
  "skipped_label": "取り込めなかった技（{{count}}件）",
  "confirm": "この内容で軽減表を作成",
  "limit_reached": "このコンテンツのプランが上限(5)です。どうしますか？",
  "limit_replace_current": "今開いている表を置き換える",
  "limit_delete_one": "既存の表を1つ削除して作成",
  "limit_cancel": "やめる",
  "rights_notice": "取り込む内容の権利・責任は利用者にあります"
}
```

en/ko/zh も同キーで言語別に追加。**JSON カンマに注意**、`npm run build` 前に 4 ファイルとも妥当性確認（`node -e "require('./src/locales/ja.json')"` 等）。

- [ ] **Step 2: モーダルを実装**

`src/components/SpreadsheetImportModal.tsx`（要点・既存モーダル作法に合わせる。`createPortal`＋`useEscapeClose`、glass/トークンは既存 UI ルール準拠の白黒＋機能色）:

```tsx
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useEscapeClose } from '../hooks/useEscapeClose';
import { parseMitigationSheet } from '../lib/sheetImport/parseMitigationSheet';
import { buildPlanFromSheets, type SheetImportResult } from '../lib/sheetImport/buildPlanFromSheets';
import { getMitigationsFromStore, getJobsFromStore } from '../hooks/useSkillsData';
import type { ParsedSheet } from '../lib/sheetImport/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImport: (result: SheetImportResult, mode: 'new' | 'replace_current') => void;
}

export function SpreadsheetImportModal({ isOpen, onClose, onImport }: Props) {
  const { t } = useTranslation();
  const [includeMitigations, setIncludeMitigations] = useState(true);
  const [sheets, setSheets] = useState<ParsedSheet[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEscapeClose(isOpen, onClose);
  if (!isOpen) return null;

  const addSheet = () => {
    const parsed = parseMitigationSheet(draft);
    if (!parsed) { setError(t('sheetImport.parse_failed')); return; }
    setSheets((s) => [...s, parsed]);
    setDraft('');
    setError(null);
  };

  const result = sheets.length
    ? buildPlanFromSheets(sheets, { mitigations: getMitigationsFromStore(), jobs: getJobsFromStore() }, { includeMitigations })
    : null;

  const handleClose = () => { setSheets([]); setDraft(''); setError(null); setIncludeMitigations(true); onClose(); };

  const modal = (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60" onClick={handleClose}>
      <div className="bg-app-bg border border-app-text/10 rounded-lg p-6 w-full max-w-xl space-y-4" onClick={(e) => e.stopPropagation()}>
        <p className="text-app-2xl font-bold">{t('sheetImport.title')}</p>
        {/* モード */}
        <div className="flex gap-3 text-app-lg">
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="radio" checked={includeMitigations} onChange={() => setIncludeMitigations(true)} className="accent-app-text" />
            {t('sheetImport.mode_with_mitigations')}
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="radio" checked={!includeMitigations} onChange={() => setIncludeMitigations(false)} className="accent-app-text" />
            {t('sheetImport.mode_timeline_only')}
          </label>
        </div>
        {/* 貼り付け */}
        <label className="block text-app-base text-app-text-muted">{t('sheetImport.paste_label')}</label>
        <textarea value={draft} onChange={(e) => { setDraft(e.target.value); setError(null); }}
          className="w-full h-28 px-2 py-1.5 text-app-base bg-transparent border border-app-text/20 rounded font-mono text-app-text" />
        <button onClick={addSheet} disabled={!draft.trim()}
          className="px-3 py-1.5 text-app-lg rounded border border-blue-500/40 text-blue-400 hover:bg-blue-500/10 disabled:opacity-40">
          {t('sheetImport.add_phase')}
        </button>
        {error && <p className="text-app-lg text-red-400">{error}</p>}
        {/* 追加済みフェーズ */}
        {sheets.map((s, i) => (
          <p key={i} className="text-app-base text-app-text-muted">
            {t('sheetImport.detected_phase', { name: s.rows[0]?.phaseLabel ?? `#${i + 1}`, events: s.rows.length, mits: s.rows.reduce((n, r) => n + r.trueColumnIndexes.length, 0) })}
          </p>
        ))}
        {/* プレビュー */}
        {result && (
          <div className="border border-app-text/10 rounded p-3 space-y-1 text-app-lg">
            <p>{t('sheetImport.preview_summary', { phases: result.phases.length, events: result.timelineEvents.length, mits: result.timelineMitigations.length, party: result.party.length })}</p>
            {result.skipped.length > 0 && (
              <details className="text-app-base text-amber-400">
                <summary>{t('sheetImport.skipped_label', { count: result.skipped.length })}</summary>
                <ul>{result.skipped.map((s, i) => <li key={i}>{s.job} / {s.skillName}</li>)}</ul>
              </details>
            )}
          </div>
        )}
        <p className="text-app-sm text-app-text-muted">{t('sheetImport.rights_notice')}</p>
        <div className="flex justify-end gap-2">
          <button onClick={handleClose} className="px-3 py-1.5 text-app-lg rounded border border-app-text/20 text-app-text-muted">{t('common.cancel', 'キャンセル')}</button>
          {result && result.timelineEvents.length > 0 && (
            <button onClick={() => { onImport(result, 'new'); handleClose(); }}
              className="px-3 py-1.5 text-app-lg rounded border border-blue-500/40 text-blue-400 hover:bg-blue-500/10">
              {t('sheetImport.confirm')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
  return createPortal(modal, document.body);
}
```

> パーティ確認 UI（枠の入れ替え）は v1 では「プレビューに割当を表示」に留め、入れ替えは後続改善でも可。実装者は `result.party` を表示し、最低限「検出した編成」を見せること。`getMitigationsFromStore`/`getJobsFromStore` の正確な export 名は `src/hooks/useSkillsData.ts` で確認（無ければ `useMasterDataStore` から取得する形に合わせる）。

- [ ] **Step 3: ビルド確認**

Run: `npm run build`
Expected: tsc -b エラーなし。JSON 4 ファイル妥当。

- [ ] **Step 4: コミット**

```bash
git add src/components/SpreadsheetImportModal.tsx src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
git commit -m "feat(sheetImport): 取り込みウィザードモーダル + i18n(sheetImport.*)"
```

---

## Task 6: 配線（入口ボタン ＋ 反映：新規プラン / 5-5 チューザー）

**Files:**
- Modify: `src/components/Timeline.tsx`（モーダル mount ＋ 起動導線）
- Modify: `src/store/usePlanStore.ts`（必要なら新規作成 API を利用。改変は最小・既存 API 流用）

**Interfaces:**
- Consumes: `SpreadsheetImportModal`（Task 5）、`SheetImportResult`（Task 4）、`usePlanStore` の新規プラン作成、`useMitigationStore` のプラン読込、`PLAN_LIMITS`（`src/types/firebase.ts`）。

- [ ] **Step 1: 起動導線とモーダル mount を追加**

`Timeline.tsx`: 既存 FFLogs モーダル（`:3910` 付近）の近くに mount。起動は既存の取り込み導線（ツール群）にボタン追加 or `'timeline:import'` と並ぶ新イベントで。最小実装は state `showSheetImport` を持ち、ツールボタンから `setShowSheetImport(true)`。

```tsx
{/* import 群の近く */}
<SpreadsheetImportModal
  isOpen={showSheetImport}
  onClose={() => setShowSheetImport(false)}
  onImport={handleSheetImport}
/>
```

- [ ] **Step 2: 反映ハンドラを実装（新規プラン作成、5-5 チューザー）**

`Timeline.tsx` 内 `handleSheetImport`:

```tsx
const handleSheetImport = (result: SheetImportResult, mode: 'new' | 'replace_current') => {
  const planData = {
    timelineEvents: result.timelineEvents,
    timelineMitigations: result.timelineMitigations,
    phases: result.phases,
    labels: [],
    partyMembers: buildPartyMembers(result.party), // 既存 INITIAL_PARTY を base に jobId 上書き
  };
  // mode==='new': usePlanStore の新規作成 API で作成→選択。
  // 上限時(5/5): 呼び出し前に判定し、チューザー（置き換え/削除/キャンセル）を出す。
  // 既存の「新規プラン作成」関数のシグネチャに合わせて planData を渡す。
};
```

> **実装者へ**: `usePlanStore` の新規プラン作成関数（例 `createPlan`/`addPlan`）の正確なシグネチャと、`MAX_PLANS_PER_CONTENT` 到達判定（`AdminTemplates`/`usePlanStore.ts:356-360` 参照）を実コードで確認し、planData をその形に整形する。`partyMembers` は `INITIAL_PARTY`（`useMitigationStore.ts:241-249`）を base に、`result.party` の `{slot,jobId}` で `jobId` を上書き（role は job から導出）して 8 枠を埋める。上限チューザーは Task 5 の i18n キー（`limit_*`）を使い、`SpreadsheetImportModal` 側 or Timeline 側どちらで出すか実装時に決める（プレビュー確定時に上限判定→チューザー表示が素直）。

- [ ] **Step 3: ビルドと全テスト**

Run: `npm run build`
Run: `npm test -- src/lib/sheetImport`（純粋関数 4 本が緑）
Expected: 緑。既存テストに新規 failure なし。

- [ ] **Step 4: 実機確認**

`npm run dev` → 軽減表で「スプシ取り込み」→ この会話の実データ（全フェーズ分のタブ）を順に貼り付け → プレビュー確認 → 作成。確認:
- 通し時間で全フェーズが正しく並ぶ／技名・ダメージ・属性が入る／軽減が正しい枠に乗る／未対応技が一覧に出る／「タイムラインだけ」トグルで軽減・パーティがスキップされる／5/5 でチューザーが出る／en/ko/zh 表示崩れなし。

- [ ] **Step 5: コミット**

```bash
git add src/components/Timeline.tsx src/store/usePlanStore.ts
git commit -m "feat(sheetImport): 入口ボタン＋反映配線（新規プラン/5-5チューザー）"
```

---

## 最終確認（全タスク後）

- [ ] `npm run build` 緑（tsc -b 厳密・`npx tsc -b --force` で cache 騙し回避）
- [ ] `npm test -- src/lib/sheetImport` 緑（純粋関数 4 本）。既存テストに新規 failure なし
- [ ] 実機: 実データ全フェーズ取り込み合格（Task 6 Step 4）
- [ ] 既存の FFLogs / CSV 取り込み・`importTimelineEvents`・`importModes` が無改変
- [ ] `docs/TODO.md` / `docs/TODO_COMPLETED.md` 更新、ブランチを main へ統合（finishing-a-development-branch）

---

## Self-Review（計画作成者による点検）

**Spec coverage:**
- spec §3 フォーマット解析 → Task 1 パーサ ✓ / §4 取り込む項目 → Task 1（time/action/damage/type/phase）＋Task 4（軽減/パーティ）✓ / §4.2 未対応スキップ → Task 2(null)＋Task 4(skipped) ✓
- §5 部品①〜⑥ → Task 1〜6 と 1:1 ✓
- §6 正規化（括弧/役割共有/エイリアス4種）→ Task 2 ✓ / §7 枠割当 → Task 3 ✓ / §8 ウィザード（マルチ貼り付け/トグル/プレビュー/skip）→ Task 5 ✓ / §9 反映（新規/5-5）→ Task 6 ✓
- §10 マッピング（Total Time→time, Hit→damageAmount, Type→damageType, Phase列→phases, TRUE→AppliedMitigation, 使用ジョブ→party）→ Task 1＋4 ✓
- §12 権利表記 → Task 5 i18n `rights_notice` ✓ / §13 既存非介入 → Global Constraints＋各 build/test ✓ / §14 テスト → Task 1-4 単体 ✓

**Placeholder scan:** パーサ（Task 1）と反映（Task 6）に「実データ/実 API で確認」の注記があるが、これは**プレースホルダーではなく**ファイル形式・既存 API 依存部の明示的検証ステップ。各 Task に実コード・実コマンド・期待値あり。

**Type consistency:**
- `ParsedSheet`/`SheetColumn`/`SheetRow`（Task 1）→ Task 4/5 で同名消費 ✓
- `resolveSheetSkill(jobJa, skillNameRaw, mitigations)`（Task 2）→ Task 4 呼び出し一致 ✓
- `resolveImportParty(usedJobIds, jobs)`（Task 3）→ Task 4 一致 ✓
- `SheetImportResult`（Task 4）→ Task 5 Props `onImport` ＋ Task 6 `handleSheetImport` 一致 ✓
- `JOB_JA_TO_ID`/`SKILL_ALIASES`（Task 2）→ Task 1(JOB 名検出は別 set)・Task 4(JOB_JA_TO_ID 再利用) ✓

**実装時に確認（計画に注記済み）:** Task 1 の 2 段ヘッダー等の実データ調整 / Task 4 テストの `e.name.ja` 参照 / Task 5 の `getMitigationsFromStore` export 名 / Task 6 の `usePlanStore` 新規作成 API シグネチャ・上限判定・`partyMembers` 整形。
