# 自作スプシ対応・列グリッド取込 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** どんなスプレッドシートでも取り込める「列グリッド取込モーダル」を新設する(まるごと自動検出 / 列ごと手動マッピング)。既存の有名スプシ取込は温存。

**Architecture:** 純関数コア(4言語スキル/ジョブ解決・見出し自動マッピング・グリッド→`SheetImportResult` ビルダー・列検証)を先に TDD で固め、その上に画面いっぱいのスプシ風モーダル UI を載せる。取込結果は既存 `commitImportedPlan` 経路に合流させ、collab 安全作法と §③ テンプレ対象引き継ぎを再利用する。

**Tech Stack:** TypeScript / React / Zustand / framer-motion / react-i18next / vitest。

設計書: `docs/superpowers/specs/2026-06-24-spreadsheet-grid-import-design.md`(全判断の根拠)。

## Global Constraints

- 言語: コード/コメント/ドキュメントは日本語。
- 色: 白黒 + 機能色のみ(青=OK/進む・黄=警告・赤=危険)。**緑禁止**。OK表示は青(`.claude/rules/ui-design.md`)。
- UI 文言は必ず i18n キー経由(4言語 ja/en/ko/zh)。ハードコード禁止。特定スプシ名(「有名スプシ」「○○の軽減表」等)を UI に出さない。`rights_notice` を新モーダルにも表示。
- ジョブ名・スキル名の辞書はハードコードせず store(`getJobsFromStore`/`getMitigationsFromStore`)から構築([feedback_no_hardcoding])。
- 取込は必ず新規・非collabプラン。`commitImportedPlan` を必ず通す(collab-ON で `loadSnapshot` no-op になる Bug #1 を踏まない)。
- **実証済みの取込パイプラインを丸ごと再利用する**(ユーザー指示「コンテンツ選択は絶対必要・バグの起きない既存状態が前提」): **コンテンツ選択**(`ImportContentSelector`・必須)/ **`applyTemplateTargetsToResult`**(§③ テンプレ対象引き継ぎ)/ **`importBlockReason`**(パーティ未割当・未確定draftブロック)/ **`commitImportedPlan`**(collab安全)。新規モーダルでもこれらを**独自実装で迂回せず必ず通す**。`contentId` を `null` 固定にしない。
- **既存 `parseMitigationSheet.ts` / `buildPlanFromSheets.ts`(有名スプシ経路)は変更しない**(回帰防止)。
- push 前に `npm run build`(Vercel tsc -b 厳密・未使用/型不足/`import type` が罠)+ `npx vitest run` 緑([feedback_vercel_tsc_strict])。テスト出力をパイプしない([[reference_vitest_appcheck_teardown]])。
- vitest 実行は既存設定のまま(`pool='vmThreads'` 削除厳禁)。

---

## File Structure(新規/変更)

- 新規 `src/lib/sheetImport/gridTypes.ts` — グリッド内部表の型(`GridField`/`GridColumn`/`GridTable`)。
- 新規 `src/lib/sheetImport/time.ts` — `mmssToSec`(M:SS→秒。grid 専用・既存パーサは触らない)。
- 変更 `src/lib/sheetImport/resolveSheetSkill.ts` — スキル解決を4言語化。
- 新規 `src/lib/sheetImport/resolveJob.ts` — jobs store からジョブ名(4言語)→jobId 解決。
- 新規 `src/lib/sheetImport/normalizeFields.ts` — `target`(MT/ST/AoE)・`damageType`(物理/魔法)の4言語正規化。
- 新規 `src/lib/sheetImport/headerAliases.ts` — field 見出し別名辞書(4言語)+ 見出し→field 判定。
- 新規 `src/lib/sheetImport/parseGridPaste.ts` — TSV→`GridTable`(形式判定 + まるごとの見出し自動マッピング)。
- 新規 `src/lib/sheetImport/buildPlanFromGrid.ts` — `GridTable`→`SheetImportResult`。
- 新規 `src/lib/sheetImport/validateGridColumn.ts` — 列ステータス(青/黄/灰)。
- 新規 `src/components/ImportContentSelector.tsx` — 既存モーダルから抽出した共有コンテンツ選択(両モーダルで使用)。
- 変更 `src/components/SpreadsheetImportModal.tsx` — Step1 を `ImportContentSelector` に置換(挙動保存)。
- 新規 `src/components/SpreadsheetGridImportModal.tsx` — 画面いっぱいモーダル UI(コンテンツ選択 + グリッド)。
- 変更 `src/components/Timeline.tsx` — 新モーダル配線(`commitImportedPlan` 経由)。
- 変更 `src/components/ImportMenu.tsx` — 起動導線追加。
- 変更 `src/locales/{ja,en,ko,zh}.json` — `gridImport.*` 文言。
- テスト各 `src/lib/sheetImport/__tests__/*.test.ts`、`src/components/__tests__/SpreadsheetGridImportModal.test.tsx`。

---

## Task 1: グリッド内部表の型

**Files:**
- Create: `src/lib/sheetImport/gridTypes.ts`

**Interfaces:**
- Produces: `GridField`, `GridColumn`, `GridTable`(後続の parse/build/validate が全て参照)。

- [ ] **Step 1: 型を定義(テスト不要・型のみ)**

```ts
import type { PartySlot } from './partyAssignment';

/** グリッド各列の意味。member=パーティメンバー列、ignore=無視、unknown=未割当(要指定)。 */
export type GridField =
  | 'phase' | 'label' | 'time' | 'action' | 'damage' | 'target' | 'damageType'
  | 'member' | 'ignore' | 'unknown';

export interface GridColumn {
  /** 列の意味 */
  field: GridField;
  /** 元の見出しセル文字列(表示・再判定用) */
  header: string;
  /** member 列のみ: 見出しジョブ名から解決した jobId(未解決は null) */
  jobId?: string | null;
  /** member 列のみ: 割当枠(未割当は null) */
  slot?: PartySlot | null;
}

/** 列定義 + データ行(rows[r][c] は columns[c] に対応)。 */
export interface GridTable {
  columns: GridColumn[];
  rows: string[][];
}
```

- [ ] **Step 2: ビルドが通ることを確認**

Run: `npx tsc -b --noEmit`
Expected: エラーなし(新規型のみ)

- [ ] **Step 3: Commit**

```bash
rtk git add src/lib/sheetImport/gridTypes.ts
rtk git commit -m "feat(import): グリッド内部表の型(GridField/GridColumn/GridTable)を追加"
```

---

## Task 2: M:SS パース(grid 専用)

**Files:**
- Create: `src/lib/sheetImport/time.ts`
- Test: `src/lib/sheetImport/__tests__/time.test.ts`

**Interfaces:**
- Produces: `mmssToSec(v: string | undefined): number | null`

- [ ] **Step 1: 失敗するテストを書く**

```ts
import { describe, it, expect } from 'vitest';
import { mmssToSec } from '../time';

describe('mmssToSec', () => {
  it('M:SS を秒へ', () => {
    expect(mmssToSec('0:00')).toBe(0);
    expect(mmssToSec('1:30')).toBe(90);
    expect(mmssToSec('10:05')).toBe(605);
  });
  it('負値(戦闘前)を扱う', () => {
    expect(mmssToSec('-0:20')).toBe(-20);
  });
  it('前後空白を許容', () => {
    expect(mmssToSec(' 1:00 ')).toBe(60);
  });
  it('不正値は null', () => {
    expect(mmssToSec('あ')).toBeNull();
    expect(mmssToSec('')).toBeNull();
    expect(mmssToSec(undefined)).toBeNull();
    expect(mmssToSec('1:60')).toBeNull(); // 秒は 0-59
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run src/lib/sheetImport/__tests__/time.test.ts`
Expected: FAIL（mmssToSec 未定義）

- [ ] **Step 3: 実装**

```ts
/** "M:SS"（負値対応）→ 秒。パースできなければ null。既存 parseMitigationSheet と同仕様。 */
export function mmssToSec(v: string | undefined): number | null {
  if (v == null) return null;
  const m = v.trim().match(/^(-?)(\d+):([0-5]?\d)$/);
  if (!m) return null;
  const sign = m[1] === '-' ? -1 : 1;
  return sign * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10));
}
```

- [ ] **Step 4: 成功を確認**

Run: `npx vitest run src/lib/sheetImport/__tests__/time.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
rtk git add src/lib/sheetImport/time.ts src/lib/sheetImport/__tests__/time.test.ts
rtk git commit -m "feat(import): grid 用 M:SS パース mmssToSec を追加"
```

---

## Task 3: スキル解決を4言語化

**Files:**
- Modify: `src/lib/sheetImport/resolveSheetSkill.ts`
- Test: `src/lib/sheetImport/__tests__/resolveSheetSkill.test.ts`(既存に追記)

**Interfaces:**
- Consumes: `resolveJob`(Task 4)は使わない。ジョブは引数 `jobName` を従来通り `JOB_JA_TO_ID` で引く + 後述の jobId 直接指定にも対応。
- Produces: 既存シグネチャ維持 `resolveSheetSkill(jobJa, skillNameRaw, mitigations): string | null`。一致判定を `name.ja` から `name.{ja,en,ko,zh}` のいずれかへ拡張。

- [ ] **Step 1: 失敗するテストを追記**

`resolveSheetSkill.test.ts` の `describe` 内に追加:

```ts
  it('英中韓のスキル名でも解決する(4言語一致)', () => {
    const MULTI: Mitigation[] = [
      { id: 'rampart_pld', jobId: 'pld', name: { ja: 'ランパート', en: 'Rampart', ko: '램파트', zh: '铁壁' }, recast: 0, duration: 0, type: 'all', value: 0 } as Mitigation,
    ];
    expect(resolveSheetSkill('ナイト', 'Rampart', MULTI)).toBe('rampart_pld');
    expect(resolveSheetSkill('ナイト', '铁壁', MULTI)).toBe('rampart_pld');
    expect(resolveSheetSkill('ナイト', '램파트', MULTI)).toBe('rampart_pld');
    expect(resolveSheetSkill('ナイト', 'ランパート', MULTI)).toBe('rampart_pld');
  });
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run src/lib/sheetImport/__tests__/resolveSheetSkill.test.ts`
Expected: FAIL（en/ko/zh で null）

- [ ] **Step 3: 実装(4言語一致へ)**

`resolveSheetSkill.ts` の `hit` 行を差し替え:

```ts
  const stripped = stripParenthetical(skillNameRaw);
  const normalized = SKILL_ALIASES[stripped] ?? stripped;
  const hit = mitigations.find(
    (m) =>
      m.jobId === jobId &&
      (m.name.ja === normalized ||
        m.name.en === normalized ||
        m.name.ko === normalized ||
        m.name.zh === normalized),
  );
  return hit ? hit.id : null;
```

- [ ] **Step 4: 成功を確認(既存テストも緑のまま)**

Run: `npx vitest run src/lib/sheetImport/__tests__/resolveSheetSkill.test.ts`
Expected: PASS（既存5件 + 新規1件）

- [ ] **Step 5: Commit**

```bash
rtk git add src/lib/sheetImport/resolveSheetSkill.ts src/lib/sheetImport/__tests__/resolveSheetSkill.test.ts
rtk git commit -m "feat(import): スキル名解決を日英中韓4言語一致に拡張"
```

---

## Task 4: ジョブ名(4言語)→jobId 解決

**Files:**
- Create: `src/lib/sheetImport/resolveJob.ts`
- Test: `src/lib/sheetImport/__tests__/resolveJob.test.ts`

**Interfaces:**
- Produces: `resolveJobId(name: string, jobs: Job[]): string | null` — `Job.name.{ja,en,ko,zh}` のいずれか一致(前後空白除去)で jobId。

- [ ] **Step 1: 失敗するテスト**

```ts
import { describe, it, expect } from 'vitest';
import { resolveJobId } from '../resolveJob';
import type { Job } from '../../../types';

const J = (id: string, ja: string, en: string): Job =>
  ({ id, name: { ja, en }, role: 'tank', icon: '' } as Job);

const JOBS: Job[] = [
  J('pld', 'ナイト', 'Paladin'),
  { id: 'whm', name: { ja: '白魔道士', en: 'White Mage', ko: '백마도사', zh: '白魔法师' }, role: 'healer', icon: '' } as Job,
];

describe('resolveJobId', () => {
  it('日英中韓のジョブ名で解決', () => {
    expect(resolveJobId('ナイト', JOBS)).toBe('pld');
    expect(resolveJobId('Paladin', JOBS)).toBe('pld');
    expect(resolveJobId('白魔道士', JOBS)).toBe('whm');
    expect(resolveJobId('White Mage', JOBS)).toBe('whm');
    expect(resolveJobId('백마도사', JOBS)).toBe('whm');
    expect(resolveJobId('白魔法师', JOBS)).toBe('whm');
  });
  it('前後空白を許容', () => {
    expect(resolveJobId('  ナイト ', JOBS)).toBe('pld');
  });
  it('未知ジョブは null', () => {
    expect(resolveJobId('未知', JOBS)).toBeNull();
    expect(resolveJobId('', JOBS)).toBeNull();
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run src/lib/sheetImport/__tests__/resolveJob.test.ts`
Expected: FAIL（resolveJobId 未定義）

- [ ] **Step 3: 実装**

```ts
import type { Job } from '../../types';

/** ジョブ名(日英中韓いずれか)→ jobId。store の Job[] から解決。未知は null。 */
export function resolveJobId(name: string, jobs: Job[]): string | null {
  const n = name.trim();
  if (!n) return null;
  const hit = jobs.find(
    (j) => j.name.ja === n || j.name.en === n || j.name.ko === n || j.name.zh === n,
  );
  return hit ? hit.id : null;
}
```

- [ ] **Step 4: 成功を確認**

Run: `npx vitest run src/lib/sheetImport/__tests__/resolveJob.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
rtk git add src/lib/sheetImport/resolveJob.ts src/lib/sheetImport/__tests__/resolveJob.test.ts
rtk git commit -m "feat(import): ジョブ名4言語→jobId 解決 resolveJobId を追加"
```

---

## Task 5: target / damageType の正規化

**Files:**
- Create: `src/lib/sheetImport/normalizeFields.ts`
- Test: `src/lib/sheetImport/__tests__/normalizeFields.test.ts`

**Interfaces:**
- Produces:
  - `normalizeTarget(v: string): 'AoE' | 'MT' | 'ST' | null`
  - `normalizeDamageType(v: string): 'physical' | 'magical' | null`

- [ ] **Step 1: 失敗するテスト**

```ts
import { describe, it, expect } from 'vitest';
import { normalizeTarget, normalizeDamageType } from '../normalizeFields';

describe('normalizeTarget', () => {
  it('MT/ST を正規化', () => {
    expect(normalizeTarget('MT')).toBe('MT');
    expect(normalizeTarget('mt')).toBe('MT');
    expect(normalizeTarget('メインタンク')).toBe('MT');
    expect(normalizeTarget('ST')).toBe('ST');
    expect(normalizeTarget('サブタンク')).toBe('ST');
  });
  it('全体/AoE を正規化', () => {
    expect(normalizeTarget('全体')).toBe('AoE');
    expect(normalizeTarget('AoE')).toBe('AoE');
    expect(normalizeTarget('raidwide')).toBe('AoE');
    expect(normalizeTarget('전체')).toBe('AoE');
    expect(normalizeTarget('全体攻击')).toBe('AoE');
  });
  it('空/不明は null', () => {
    expect(normalizeTarget('')).toBeNull();
    expect(normalizeTarget('なにか')).toBeNull();
  });
});

describe('normalizeDamageType', () => {
  it('物理を正規化', () => {
    expect(normalizeDamageType('物理')).toBe('physical');
    expect(normalizeDamageType('Physical')).toBe('physical');
    expect(normalizeDamageType('물리')).toBe('physical');
    expect(normalizeDamageType('物理')).toBe('physical');
  });
  it('魔法を正規化', () => {
    expect(normalizeDamageType('魔法')).toBe('magical');
    expect(normalizeDamageType('Magic')).toBe('magical');
    expect(normalizeDamageType('Magical')).toBe('magical');
    expect(normalizeDamageType('마법')).toBe('magical');
    expect(normalizeDamageType('魔法')).toBe('magical');
  });
  it('空/不明は null', () => {
    expect(normalizeDamageType('')).toBeNull();
    expect(normalizeDamageType('不明')).toBeNull();
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run src/lib/sheetImport/__tests__/normalizeFields.test.ts`
Expected: FAIL（未定義）

- [ ] **Step 3: 実装**

```ts
const MT = new Set(['mt', 'メインタンク', 'main tank', 'maintank', '메인탱커', '主坦']);
const ST = new Set(['st', 'サブタンク', 'off tank', 'offtank', '서브탱커', '副坦']);
const AOE = new Set([
  '全体', 'aoe', 'raidwide', 'raid', '全体攻撃', '全体攻击', '전체', '광역', 'all',
]);

/** 攻撃の対象を MT/ST/AoE に正規化。空/不明は null。 */
export function normalizeTarget(v: string): 'AoE' | 'MT' | 'ST' | null {
  const n = v.trim().toLowerCase();
  if (!n) return null;
  if (n === 'mt' || MT.has(n)) return 'MT';
  if (n === 'st' || ST.has(n)) return 'ST';
  if (AOE.has(n)) return 'AoE';
  return null;
}

const PHYS = new Set(['物理', 'physical', 'phys', '물리', '物理伤害', '物理']);
const MAG = new Set(['魔法', 'magic', 'magical', 'magic damage', '마법', '魔法伤害']);

/** ダメージ種別を physical/magical に正規化。空/不明は null(=呼び出し側で既定 magical)。 */
export function normalizeDamageType(v: string): 'physical' | 'magical' | null {
  const n = v.trim().toLowerCase();
  if (!n) return null;
  if (PHYS.has(n)) return 'physical';
  if (MAG.has(n)) return 'magical';
  return null;
}
```

- [ ] **Step 4: 成功を確認**

Run: `npx vitest run src/lib/sheetImport/__tests__/normalizeFields.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
rtk git add src/lib/sheetImport/normalizeFields.ts src/lib/sheetImport/__tests__/normalizeFields.test.ts
rtk git commit -m "feat(import): target/damageType の4言語正規化を追加"
```

---

## Task 6: 見出し辞書 + field 判定

**Files:**
- Create: `src/lib/sheetImport/headerAliases.ts`
- Test: `src/lib/sheetImport/__tests__/headerAliases.test.ts`

**Interfaces:**
- Consumes: `resolveJobId`(Task 4), `Job[]`。
- Produces: `detectField(header: string, jobs: Job[]): { field: GridField; jobId?: string | null }` — 見出し文字から field を判定。ジョブ名ならメンバー列。判定不能は `unknown`。

- [ ] **Step 1: 失敗するテスト**

```ts
import { describe, it, expect } from 'vitest';
import { detectField } from '../headerAliases';
import type { Job } from '../../../types';

const JOBS: Job[] = [
  { id: 'pld', name: { ja: 'ナイト', en: 'Paladin' }, role: 'tank', icon: '' } as Job,
];

describe('detectField', () => {
  it('正典フィールドを見出しから判定', () => {
    expect(detectField('フェーズ', JOBS).field).toBe('phase');
    expect(detectField('ラベル', JOBS).field).toBe('label');
    expect(detectField('時間', JOBS).field).toBe('time');
    expect(detectField('Time', JOBS).field).toBe('time');
    expect(detectField('敵の攻撃', JOBS).field).toBe('action');
    expect(detectField('Action', JOBS).field).toBe('action');
    expect(detectField('ダメージ', JOBS).field).toBe('damage');
    expect(detectField('Damage', JOBS).field).toBe('damage');
    expect(detectField('攻撃の対象', JOBS).field).toBe('target');
    expect(detectField('ダメージ種別', JOBS).field).toBe('damageType');
    expect(detectField('Type', JOBS).field).toBe('damageType');
  });
  it('ジョブ名見出しは member 列(jobId 付き)', () => {
    const r = detectField('ナイト', JOBS);
    expect(r.field).toBe('member');
    expect(r.jobId).toBe('pld');
  });
  it('判定不能は unknown', () => {
    expect(detectField('最大HP', JOBS).field).toBe('unknown');
    expect(detectField('', JOBS).field).toBe('unknown');
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run src/lib/sheetImport/__tests__/headerAliases.test.ts`
Expected: FAIL（未定義）

- [ ] **Step 3: 実装**

```ts
import type { Job } from '../../types';
import type { GridField } from './gridTypes';
import { resolveJobId } from './resolveJob';

/** field ごとの見出し別名(小文字・前後空白除去で比較)。多言語+よくある表記。 */
const ALIASES: Record<Exclude<GridField, 'member' | 'ignore' | 'unknown'>, string[]> = {
  phase: ['フェーズ', 'phase', '페이즈', '阶段'],
  label: ['ラベル', 'label', 'セクション', 'section', '라벨', '标签'],
  time: ['時間', '時刻', 'time', 'total time', '시간', '时间'],
  action: ['敵の攻撃', '攻撃', '技', 'action', 'ability', 'attack', '공격', '技能', '攻击'],
  damage: ['ダメージ', 'damage', 'hit', 'dmg', '데미지', '伤害'],
  target: ['攻撃の対象', '対象', 'target', '대상', '目标'],
  damageType: ['ダメージ種別', '種別', 'type', 'damage type', '속성', '类型', '属性'],
};

/** 見出し文字から GridField を判定。ジョブ名なら member(jobId付き)。判定不能は unknown。 */
export function detectField(header: string, jobs: Job[]): { field: GridField; jobId?: string | null } {
  const n = header.trim().toLowerCase();
  if (!n) return { field: 'unknown' };
  for (const [field, names] of Object.entries(ALIASES)) {
    if (names.some((a) => a.toLowerCase() === n)) return { field: field as GridField };
  }
  const jobId = resolveJobId(header, jobs);
  if (jobId) return { field: 'member', jobId };
  return { field: 'unknown' };
}
```

- [ ] **Step 4: 成功を確認**

Run: `npx vitest run src/lib/sheetImport/__tests__/headerAliases.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
rtk git add src/lib/sheetImport/headerAliases.ts src/lib/sheetImport/__tests__/headerAliases.test.ts
rtk git commit -m "feat(import): 見出し→GridField 判定(4言語辞書+ジョブ名)を追加"
```

---

## Task 7: TSV→GridTable(形式判定 + 自動マッピング)

**Files:**
- Create: `src/lib/sheetImport/parseGridPaste.ts`
- Test: `src/lib/sheetImport/__tests__/parseGridPaste.test.ts`

**Interfaces:**
- Consumes: `detectField`(Task 6), `GridTable`/`GridColumn`(Task 1), `Job[]`。
- Produces:
  - `isFamousSheetFormat(tsv: string): boolean` — `Skill` 行を含むなら有名スプシ形式(既存経路へ回す合図)。
  - `parseGridPaste(tsv: string, jobs: Job[]): GridTable` — 1行目を見出しとみなし各列を field 判定、2行目以降を rows に。

- [ ] **Step 1: 失敗するテスト**

```ts
import { describe, it, expect } from 'vitest';
import { parseGridPaste, isFamousSheetFormat } from '../parseGridPaste';
import type { Job } from '../../../types';

const JOBS: Job[] = [
  { id: 'pld', name: { ja: 'ナイト', en: 'Paladin' }, role: 'tank', icon: '' } as Job,
];

describe('isFamousSheetFormat', () => {
  it('Skill 行があれば有名スプシ形式', () => {
    expect(isFamousSheetFormat('a\tb\nSkill\tリプライザル\n')).toBe(true);
  });
  it('無ければ false', () => {
    expect(isFamousSheetFormat('時間\t敵の攻撃\n0:16\tばりばりルインガ\n')).toBe(false);
  });
});

describe('parseGridPaste', () => {
  it('見出し行で field を判定し rows を分離(位置非依存)', () => {
    const tsv = '敵の攻撃\t時間\tナイト\t最大HP\n波動砲\t0:43\tセンチネル\t128000\n';
    const t = parseGridPaste(tsv, JOBS);
    expect(t.columns.map((c) => c.field)).toEqual(['action', 'time', 'member', 'unknown']);
    expect(t.columns[2].jobId).toBe('pld');
    expect(t.rows).toEqual([['波動砲', '0:43', 'センチネル', '128000']]);
  });
  it('空入力は空テーブル', () => {
    expect(parseGridPaste('', JOBS)).toEqual({ columns: [], rows: [] });
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run src/lib/sheetImport/__tests__/parseGridPaste.test.ts`
Expected: FAIL（未定義）

- [ ] **Step 3: 実装**

```ts
import type { Job } from '../../types';
import type { GridTable, GridColumn } from './gridTypes';
import { detectField } from './headerAliases';

/** 有名スプシ形式(Skill 行を含む)なら true → 既存 parseMitigationSheet 経路へ回す。 */
export function isFamousSheetFormat(tsv: string): boolean {
  if (!tsv) return false;
  return tsv
    .replace(/\r\n/g, '\n')
    .split('\n')
    .some((line) => line.split('\t').some((c) => c.trim() === 'Skill'));
}

/** TSV を「1行目=見出し / 2行目以降=データ」とみなし GridTable へ。見出しで field 自動判定。 */
export function parseGridPaste(tsv: string, jobs: Job[]): GridTable {
  if (!tsv || !tsv.trim()) return { columns: [], rows: [] };
  const lines = tsv.replace(/\r\n/g, '\n').split('\n').map((l) => l.split('\t'));
  // 末尾の完全空行を除去
  while (lines.length && lines[lines.length - 1].every((c) => c.trim() === '')) lines.pop();
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

- [ ] **Step 4: 成功を確認**

Run: `npx vitest run src/lib/sheetImport/__tests__/parseGridPaste.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
rtk git add src/lib/sheetImport/parseGridPaste.ts src/lib/sheetImport/__tests__/parseGridPaste.test.ts
rtk git commit -m "feat(import): TSV→GridTable パース(形式判定+見出し自動マッピング)を追加"
```

---

## Task 8: GridTable→SheetImportResult ビルダー

**Files:**
- Create: `src/lib/sheetImport/buildPlanFromGrid.ts`
- Test: `src/lib/sheetImport/__tests__/buildPlanFromGrid.test.ts`

**Interfaces:**
- Consumes: `GridTable`(Task 1), `mmssToSec`(Task 2), `resolveSheetSkill`(Task 3・jobId 経由で使うため後述ラッパ), `normalizeTarget`/`normalizeDamageType`(Task 5), `SheetImportResult`(既存 buildPlanFromSheets.ts)。
- Produces: `buildPlanFromGrid(table, deps, options): SheetImportResult`。
  - `deps: { mitigations: Mitigation[]; jobs: Job[] }`
  - `options: { includeMitigations: boolean }`

**設計メモ:** member 列のスキル解決はジョブ名でなく jobId で引きたいので、`resolveSheetSkill` をそのまま使わず、列の `jobId` から `Job.name.ja` を逆引きして渡す(既存関数を壊さない)。phases/labels は既存 buildPlanFromSheets と同じ「引き継ぎ+隣接同名統合」ロジックを移植。

- [ ] **Step 1: 失敗するテスト**

```ts
import { describe, it, expect } from 'vitest';
import { buildPlanFromGrid } from '../buildPlanFromGrid';
import type { GridTable } from '../gridTypes';
import type { Job, Mitigation } from '../../../types';

const JOBS: Job[] = [
  { id: 'pld', name: { ja: 'ナイト', en: 'Paladin' }, role: 'tank', icon: '' } as Job,
  { id: 'whm', name: { ja: '白魔道士', en: 'White Mage' }, role: 'healer', icon: '' } as Job,
];
const MITS: Mitigation[] = [
  { id: 'rampart_pld', jobId: 'pld', name: { ja: 'ランパート', en: 'Rampart' }, recast: 0, duration: 20, type: 'all', value: 0 } as Mitigation,
];

const table: GridTable = {
  columns: [
    { field: 'phase', header: 'フェーズ' },
    { field: 'label', header: 'ラベル' },
    { field: 'time', header: '時間' },
    { field: 'action', header: '敵の攻撃' },
    { field: 'damage', header: 'ダメージ' },
    { field: 'target', header: '攻撃の対象' },
    { field: 'damageType', header: 'ダメージ種別' },
    { field: 'member', header: 'ナイト', jobId: 'pld', slot: 'MT' },
  ],
  rows: [
    ['P1', '前半', '0:10', 'AA', '1,000', 'MT', '物理', ''],
    ['', '', '0:20', '強攻撃', '220000', '全体', '魔法', 'ランパート'],
  ],
};

describe('buildPlanFromGrid', () => {
  it('events/phase/label/target/damageType を構築', () => {
    const r = buildPlanFromGrid(table, { mitigations: MITS, jobs: JOBS }, { includeMitigations: true });
    expect(r.timelineEvents.map((e) => e.time)).toEqual([10, 20]);
    expect(r.timelineEvents[0].name.ja).toBe('AA');
    expect(r.timelineEvents[0].damageAmount).toBe(1000);
    expect(r.timelineEvents[0].target).toBe('MT');
    expect(r.timelineEvents[0].damageType).toBe('physical');
    expect(r.timelineEvents[1].damageType).toBe('magical');
    expect(r.phases.map((p) => p.name.ja)).toEqual(['P1']);
    expect(r.labels.map((l) => l.name.ja)).toEqual(['前半']);
  });
  it('member セルのスキルを枠 owner で配置(立ち上がり)', () => {
    const r = buildPlanFromGrid(table, { mitigations: MITS, jobs: JOBS }, { includeMitigations: true });
    expect(r.timelineMitigations).toHaveLength(1);
    expect(r.timelineMitigations[0].mitigationId).toBe('rampart_pld');
    expect(r.timelineMitigations[0].ownerId).toBe('MT');
    expect(r.timelineMitigations[0].time).toBe(20);
    expect(r.party).toContainEqual({ slot: 'MT', jobId: 'pld' });
  });
  it('解決不能スキルは skipped・includeMitigations=false で軽減ゼロ', () => {
    const t2: GridTable = { ...table, rows: [['', '', '0:20', 'x', '', '', '魔法', '存在しない技']] };
    const r = buildPlanFromGrid(t2, { mitigations: MITS, jobs: JOBS }, { includeMitigations: true });
    expect(r.skipped).toContainEqual({ job: 'ナイト', skillName: '存在しない技' });
    const r2 = buildPlanFromGrid(table, { mitigations: MITS, jobs: JOBS }, { includeMitigations: false });
    expect(r2.timelineMitigations).toHaveLength(0);
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run src/lib/sheetImport/__tests__/buildPlanFromGrid.test.ts`
Expected: FAIL（未定義）

- [ ] **Step 3: 実装**

```ts
import type { Mitigation, Job, TimelineEvent, AppliedMitigation, Phase, Label } from '../../types';
import type { SheetImportResult } from './buildPlanFromSheets';
import type { GridTable, GridColumn } from './gridTypes';
import type { SkippedSkill } from './types';
import { mmssToSec } from './time';
import { resolveSheetSkill } from './resolveSheetSkill';
import { normalizeTarget, normalizeDamageType } from './normalizeFields';

let seq = 0;
const uid = (p: string) => `${p}_${Date.now().toString(36)}_${(seq++).toString(36)}`;

/** カンマ除去の正の有限数。それ以外 null。 */
function parseDamage(raw: string): number | null {
  const n = Number((raw ?? '').replace(/,/g, ''));
  return isFinite(n) && n > 0 ? n : null;
}

/** 引き継ぎ列(phase/label)→区間。隣接同名統合・空はスキップ・末尾は maxTime+1。 */
function buildBands(
  cells: { value: string; time: number }[],
  maxTime: number,
  mk: (name: string, start: number) => Phase | Label,
): (Phase | Label)[] {
  const raw: (Phase | Label)[] = [];
  let cur: string | null = null;
  for (const c of cells) {
    if (!c.value) continue;
    if (c.value !== cur) {
      cur = c.value;
      raw.push(mk(c.value, c.time));
    }
  }
  const out: (Phase | Label)[] = [];
  for (const b of raw) {
    const last = out[out.length - 1];
    if (last && last.name.ja === b.name.ja) continue;
    out.push(b);
  }
  for (let i = 0; i < out.length - 1; i++) out[i].endTime = out[i + 1].startTime;
  if (out.length) out[out.length - 1].endTime = maxTime + 1;
  return out;
}

export function buildPlanFromGrid(
  table: GridTable,
  deps: { mitigations: Mitigation[]; jobs: Job[] },
  options: { includeMitigations: boolean },
): SheetImportResult {
  const col = (f: GridColumn['field']) => table.columns.findIndex((c) => c.field === f);
  const iTime = col('time'), iAction = col('action'), iDamage = col('damage');
  const iTarget = col('target'), iType = col('damageType'), iPhase = col('phase'), iLabel = col('label');

  // 有効データ行(time が解釈できる行のみ)を時刻付きで抽出
  const valid = table.rows
    .map((cells) => ({ cells, t: iTime >= 0 ? mmssToSec(cells[iTime]) : null }))
    .filter((r): r is { cells: string[]; t: number } => r.t !== null)
    .sort((a, b) => a.t - b.t);
  const maxTime = valid.length ? valid[valid.length - 1].t : 0;

  const timelineEvents: TimelineEvent[] = valid.map(({ cells, t }) => {
    const dt = iType >= 0 ? normalizeDamageType(cells[iType] ?? '') : null;
    const tgt = iTarget >= 0 ? normalizeTarget(cells[iTarget] ?? '') : null;
    const dmg = iDamage >= 0 ? parseDamage(cells[iDamage] ?? '') : null;
    const action = iAction >= 0 ? (cells[iAction] ?? '').trim() : '';
    return {
      id: uid('ev'),
      time: t,
      name: { ja: action, en: action },
      damageType: dt ?? 'magical',
      ...(dmg != null ? { damageAmount: dmg } : {}),
      ...(tgt ? { target: tgt } : {}),
    };
  });

  const labels = iLabel >= 0
    ? (buildBands(valid.map((v) => ({ value: (v.cells[iLabel] ?? '').trim(), time: v.t })), maxTime,
        (name, start) => ({ id: uid('lb'), name: { ja: name, en: name }, startTime: start, endTime: start })) as Label[])
    : [];
  const phases = iPhase >= 0
    ? (buildBands(valid.map((v) => ({ value: (v.cells[iPhase] ?? '').trim(), time: v.t })), maxTime,
        (name, start) => ({ id: uid('ph'), name: { ja: name, en: name }, startTime: start, endTime: start })) as Phase[])
    : [];

  // パーティ = 枠割当されたメンバー列
  const memberCols = table.columns
    .map((c, idx) => ({ c, idx }))
    .filter(({ c }) => c.field === 'member' && c.jobId && c.slot);
  const party = memberCols.map(({ c }) => ({ slot: c.slot as string, jobId: c.jobId as string }));

  if (!options.includeMitigations) {
    return { timelineEvents, timelineMitigations: [], phases, labels, party, skipped: [] };
  }

  // member セル → 軽減(同一スキルが連続する行は立ち上がりだけ採用)
  const jobJaById = new Map(deps.jobs.map((j) => [j.id, j.name.ja] as const));
  const mits: AppliedMitigation[] = [];
  const skippedSet = new Map<string, SkippedSkill>();
  for (const { c, idx } of memberCols) {
    const jobJa = jobJaById.get(c.jobId as string) ?? '';
    let prevSkill: string | null = null;
    for (const { cells, t } of valid) {
      const raw = (cells[idx] ?? '').trim();
      if (!raw) { prevSkill = null; continue; }
      if (raw === prevSkill) continue; // 連続同名は立ち上がりのみ
      prevSkill = raw;
      const mitId = resolveSheetSkill(jobJa, raw, deps.mitigations);
      if (!mitId) { skippedSet.set(`${jobJa}/${raw}`, { job: jobJa, skillName: raw }); continue; }
      const dur = deps.mitigations.find((m) => m.id === mitId)?.duration ?? 0;
      mits.push({ id: uid('mit'), mitigationId: mitId, time: t, duration: dur, ownerId: c.slot as string });
    }
  }
  // 重複排除
  const seen = new Set<string>();
  const deduped = mits.filter((m) => {
    const k = `${m.mitigationId}@${m.ownerId}@${m.time}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).sort((a, b) => a.time - b.time);

  return { timelineEvents, timelineMitigations: deduped, phases, labels, party, skipped: [...skippedSet.values()] };
}
```

- [ ] **Step 4: 成功を確認**

Run: `npx vitest run src/lib/sheetImport/__tests__/buildPlanFromGrid.test.ts`
Expected: PASS（3件）

- [ ] **Step 5: Commit**

```bash
rtk git add src/lib/sheetImport/buildPlanFromGrid.ts src/lib/sheetImport/__tests__/buildPlanFromGrid.test.ts
rtk git commit -m "feat(import): GridTable→SheetImportResult ビルダーを追加"
```

---

## Task 9: 列ステータス検証(青/黄/灰)

**Files:**
- Create: `src/lib/sheetImport/validateGridColumn.ts`
- Test: `src/lib/sheetImport/__tests__/validateGridColumn.test.ts`

**Interfaces:**
- Consumes: `GridColumn`(Task 1), `mmssToSec`/`normalizeTarget`/`normalizeDamageType`/`resolveSheetSkill`, `deps`。
- Produces: `validateGridColumn(col, cells, deps): 'ok' | 'partial' | 'empty'`。
  - `cells: string[]`(その列のデータ値), `deps: { mitigations; jobs }`。

- [ ] **Step 1: 失敗するテスト**

```ts
import { describe, it, expect } from 'vitest';
import { validateGridColumn } from '../validateGridColumn';
import type { Job, Mitigation } from '../../../types';
import type { GridColumn } from '../gridTypes';

const JOBS: Job[] = [{ id: 'pld', name: { ja: 'ナイト', en: 'Paladin' }, role: 'tank', icon: '' } as Job];
const MITS: Mitigation[] = [{ id: 'rampart_pld', jobId: 'pld', name: { ja: 'ランパート', en: 'Rampart' }, recast: 0, duration: 0, type: 'all', value: 0 } as Mitigation];
const deps = { mitigations: MITS, jobs: JOBS };

describe('validateGridColumn', () => {
  it('time: 全て M:SS なら ok・一部不正で partial・空で empty', () => {
    expect(validateGridColumn({ field: 'time', header: '時間' }, ['0:10', '0:20'], deps)).toBe('ok');
    expect(validateGridColumn({ field: 'time', header: '時間' }, ['0:10', 'あ'], deps)).toBe('partial');
    expect(validateGridColumn({ field: 'time', header: '時間' }, ['', ''], deps)).toBe('empty');
  });
  it('phase/label/action/damage: 任意。空=empty・値あり=ok', () => {
    expect(validateGridColumn({ field: 'phase', header: 'フェーズ' }, ['', ''], deps)).toBe('empty');
    expect(validateGridColumn({ field: 'phase', header: 'フェーズ' }, ['P1', ''], deps)).toBe('ok');
  });
  it('member: 解決可=ok・一部未解決=partial・空=empty', () => {
    const col: GridColumn = { field: 'member', header: 'ナイト', jobId: 'pld', slot: 'MT' };
    expect(validateGridColumn(col, ['ランパート', ''], deps)).toBe('ok');
    expect(validateGridColumn(col, ['ランパート', '無い技'], deps)).toBe('partial');
    expect(validateGridColumn(col, ['', ''], deps)).toBe('empty');
  });
  it('unknown/ignore は empty 扱い(チップは別表示)', () => {
    expect(validateGridColumn({ field: 'unknown', header: '最大HP' }, ['1'], deps)).toBe('empty');
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run src/lib/sheetImport/__tests__/validateGridColumn.test.ts`
Expected: FAIL（未定義）

- [ ] **Step 3: 実装**

```ts
import type { Mitigation, Job } from '../../types';
import type { GridColumn } from './gridTypes';
import { mmssToSec } from './time';
import { normalizeTarget, normalizeDamageType } from './normalizeFields';
import { resolveSheetSkill } from './resolveSheetSkill';

export type ColumnStatus = 'ok' | 'partial' | 'empty';

/** 列の値を検証して青(ok)/黄(partial)/灰(empty)を返す。 */
export function validateGridColumn(
  col: GridColumn,
  cells: string[],
  deps: { mitigations: Mitigation[]; jobs: Job[] },
): ColumnStatus {
  const nonEmpty = cells.map((c) => (c ?? '').trim()).filter((c) => c !== '');
  if (nonEmpty.length === 0) return 'empty';

  const check = (ok: (v: string) => boolean): ColumnStatus =>
    nonEmpty.every(ok) ? 'ok' : 'partial';

  switch (col.field) {
    case 'time': return check((v) => mmssToSec(v) !== null);
    case 'target': return check((v) => normalizeTarget(v) !== null);
    case 'damageType': return check((v) => normalizeDamageType(v) !== null);
    case 'damage': return check((v) => isFinite(Number(v.replace(/,/g, ''))));
    case 'member': {
      const jobJa = deps.jobs.find((j) => j.id === col.jobId)?.name.ja ?? '';
      return check((v) => resolveSheetSkill(jobJa, v, deps.mitigations) !== null);
    }
    case 'phase': case 'label': case 'action': return 'ok'; // 値があれば OK(任意)
    default: return 'empty'; // unknown/ignore
  }
}
```

- [ ] **Step 4: 成功を確認**

Run: `npx vitest run src/lib/sheetImport/__tests__/validateGridColumn.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
rtk git add src/lib/sheetImport/validateGridColumn.ts src/lib/sheetImport/__tests__/validateGridColumn.test.ts
rtk git commit -m "feat(import): 列ステータス検証(青/黄/灰)を追加"
```

---

## Task 10: i18n 文言(4言語)

**Files:**
- Modify: `src/locales/ja.json`, `src/locales/en.json`, `src/locales/ko.json`, `src/locales/zh.json`

**Interfaces:**
- Produces: `gridImport.*` キー群(後続の UI が参照)。

- [ ] **Step 1: ja.json に追加**

`gridImport` セクションを追加(既存 `sheetImport` の近く):

```json
"gridImport": {
  "title": "スプレッドシートから取り込む",
  "paste_whole": "まるごと貼り付け（Ctrl+A → Ctrl+C → 貼り付け）",
  "paste_whole_hint": "余計な列ごと貼ってOK。たぶん自動で読み取ります",
  "paste_by_column": "列ごとに貼り付け",
  "paste_by_column_hint": "自動で当たらない時はこちら。1列ずつ手で",
  "help": "見出しが分かる列は位置に関係なく自動で割り当てます。分からない列は「この列は？」で指定、要らない列は「無視」でOK。",
  "col_phase": "フェーズ", "col_label": "ラベル", "col_time": "時間",
  "col_action": "敵の攻撃", "col_damage": "ダメージ", "col_target": "攻撃の対象",
  "col_damageType": "ダメージ種別",
  "status_ok": "OK", "status_partial": "一部読めない", "status_empty": "空 / 任意",
  "optional": "任意",
  "assign_slot": "枠は？",
  "this_column": "この列は？",
  "ignore_column": "無視",
  "summary": "{{labels}}ラベル・{{events}}イベント・軽減{{mits}}件",
  "unresolved_warning": "未解決 {{count}}件は取り込みません",
  "slot_unassigned_warning": "枠が未割当のメンバー列があります",
  "create": "この内容で作成",
  "rights_notice": "取り込んだ内容はご自身の控えからの変換です。元の作成者の権利を尊重してご利用ください。"
}
```

- [ ] **Step 2: en/ko/zh.json に同キーを翻訳追加**

en.json(例):
```json
"gridImport": {
  "title": "Import from spreadsheet",
  "paste_whole": "Paste it all (Ctrl+A → Ctrl+C → paste)",
  "paste_whole_hint": "Extra columns are fine — we’ll probably figure it out",
  "paste_by_column": "Paste column by column",
  "paste_by_column_hint": "Use this when auto-detect misses. One column at a time",
  "help": "Columns with a recognizable header are mapped automatically regardless of position. For the rest, set “What is this column?” or choose “Ignore”.",
  "col_phase": "Phase", "col_label": "Label", "col_time": "Time",
  "col_action": "Enemy action", "col_damage": "Damage", "col_target": "Target",
  "col_damageType": "Damage type",
  "status_ok": "OK", "status_partial": "Some unreadable", "status_empty": "Empty / optional",
  "optional": "optional",
  "assign_slot": "Slot?",
  "this_column": "What is this column?",
  "ignore_column": "Ignore",
  "summary": "{{labels}} labels · {{events}} events · {{mits}} mitigations",
  "unresolved_warning": "{{count}} unresolved item(s) won’t be imported",
  "slot_unassigned_warning": "Some member columns have no slot assigned",
  "create": "Create with this",
  "rights_notice": "Imported data is a conversion of your own copy. Please respect the original author’s rights."
}
```
ko.json / zh.json も同じキー構成で各言語へ翻訳(値のみ・キーは英語版と一致させる)。

- [ ] **Step 3: 4言語パリティ確認**

Run: `node -e "for(const l of ['ja','en','ko','zh']){const o=require('./src/locales/'+l+'.json');if(!o.gridImport)throw new Error(l+' missing gridImport');console.log(l, Object.keys(o.gridImport).length)}"`
Expected: 4言語とも同じキー数を出力

- [ ] **Step 4: Commit**

```bash
rtk git add src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
rtk git commit -m "feat(i18n): 列グリッド取込の文言(gridImport.*)を4言語追加"
```

---

## Task 11: ImportContentSelector 抽出(実証済みコンテンツ選択を共有部品化)

**Files:**
- Create: `src/components/ImportContentSelector.tsx`
- Modify: `src/components/SpreadsheetImportModal.tsx`(Step1 のコンテンツ選択 JSX ≈ :347-430 を `<ImportContentSelector .../>` に置換)
- Test: 既存 `src/components/__tests__/SpreadsheetImportModal.wizard.test.tsx`(**回帰ガード**・テストは変更しない)

**Interfaces:**
- Consumes: 既存 `getFilteredBosses`/`deriveContentId`/`hasContentRegistry`/`CATEGORY_LABELS`(`../lib/contentSelection`/`../data/contentRegistry`)、型 `ContentLevel`/`ContentCategory`/`ContentDefinition`。
- Produces: `ImportContentSelector` コンポーネント:
  ```ts
  interface ImportContentSelectorProps {
    selLevel: ContentLevel | null; setSelLevel: (v: ContentLevel | null) => void;
    selCategory: ContentCategory | null; setSelCategory: (v: ContentCategory | null) => void;
    selBoss: ContentDefinition | null; setSelBoss: (v: ContentDefinition | null) => void;
    selTitle: string; setSelTitle: (v: string) => void;
    lang: 'ja' | 'en';
  }
  ```
  内部の Level/Category/Boss/自由入力タイトルの挙動は既存 SpreadsheetImportModal Step1 と**完全一致**(挙動保存リファクタ)。

**目的:** ユーザー指示「コンテンツ選択は絶対必要・バグの起きない既存状態が前提」。実証済みの選択 UI を**複製せず共有化**し、両モーダルが同一部品を使う(将来ズレない)。既存 wizard テストが回帰を守る。

- [ ] **Step 1: 既存 wizard テストを実行(緑ベースライン)**

Run: `npx vitest run src/components/__tests__/SpreadsheetImportModal.wizard.test.tsx`
Expected: PASS（抽出前の基準）

- [ ] **Step 2: `ImportContentSelector.tsx` を作成し、既存 Step1 の JSX を移植**

`SpreadsheetImportModal.tsx` の Step1 内「取り込み先コンテンツ選択」ブロック(Level ボタン群 / Category ボタン群 / Boss リスト / 自由入力タイトル、≈ :350-430)を、上記 props を受け取る `ImportContentSelector` へそのまま移す(`LEVEL_OPTIONS`/`CATEGORY_OPTIONS` も移動 or 共有)。i18n キー・className・トークンは変更しない。

- [ ] **Step 3: 既存モーダルを差し替え**

`SpreadsheetImportModal.tsx` の該当 JSX を `<ImportContentSelector selLevel={selLevel} setSelLevel={setSelLevel} ... lang={lang} />` に置換。`filteredBosses`/`selectedContentId`(`deriveContentId`)等の算出は呼び出し側 or selector 内部に整理(挙動不変)。

- [ ] **Step 4: 回帰確認(挙動保存)**

Run: `npx vitest run src/components/__tests__/SpreadsheetImportModal.wizard.test.tsx`
Expected: PASS（抽出後も同一）

Run: `npm run build`
Expected: 成功

- [ ] **Step 5: Commit**

```bash
rtk git add src/components/ImportContentSelector.tsx src/components/SpreadsheetImportModal.tsx
rtk git commit -m "refactor(import): コンテンツ選択を ImportContentSelector に抽出(挙動保存・共有化)"
```

---

## Task 12: モーダル UI(コンテンツ選択 + 列ごと貼り付け→作成の最小フロー)

**Files:**
- Create: `src/components/SpreadsheetGridImportModal.tsx`
- Test: `src/components/__tests__/SpreadsheetGridImportModal.test.tsx`

**Interfaces:**
- Consumes: `parseGridPaste`/`isFamousSheetFormat`(Task 7), `buildPlanFromGrid`(Task 8), `validateGridColumn`(Task 9), `detectField`(Task 6), `getJobsFromStore`/`getMitigationsFromStore`(`../hooks/useSkillsData`), `SheetImportResult`(buildPlanFromSheets), **`ImportContentSelector`(Task 11)**, `ContentSelectionDefault`/`resolveInitialSelection`/`deriveContentId`/`getFilteredBosses`(`../lib/contentSelection`), **`applyTemplateTargetsToResult`(`../lib/sheetImport/applyTemplateTargets`)**, `partyAssignment`(slots/role)。
- Produces: `SpreadsheetGridImportModal` コンポーネント(props は既存 `SpreadsheetImportModal` と同じ `{ isOpen, onClose, onImport, defaultSelection }`)。
  - `onImport: (result: SheetImportResult, opts: { contentId: string | null }) => Promise<boolean>`

**実装メモ:** 見た目は既存 [SpreadsheetImportModal.tsx](../../../src/components/SpreadsheetImportModal.tsx) の portal/glass/トークン作法を踏襲(`createPortal`・`glass-tier3`・`--share-modal-bg`・`useEscapeClose`・framer-motion)。ただし `max-w-lg` でなく**画面いっぱい近い**(`w-[96vw] max-w-[1280px] h-[88vh]`)・横スクロールするグリッド。本タスクは「**列ごと貼り付け**」と「作成」までの最小フロー(自動検出・枠割当UIは Task 12/13)。`field` 固定列(phase/label/time/action/damage/target/damageType + 検出メンバー列)に textarea ペースト or 行入力で `GridTable` を組み立て、`buildPlanFromGrid` でプレビュー→`onImport`。

- [ ] **Step 1: 失敗する render テスト**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SpreadsheetGridImportModal } from '../SpreadsheetGridImportModal';

vi.mock('../../hooks/useSkillsData', () => ({
  getJobsFromStore: () => [{ id: 'pld', name: { ja: 'ナイト', en: 'Paladin' }, role: 'tank', icon: '' }],
  getMitigationsFromStore: () => [{ id: 'rampart_pld', jobId: 'pld', name: { ja: 'ランパート', en: 'Rampart' }, recast: 0, duration: 0, type: 'all', value: 0 }],
}));

describe('SpreadsheetGridImportModal', () => {
  it('開いているとタイトルと2つの貼り付けボタンを表示', () => {
    render(
      <SpreadsheetGridImportModal
        isOpen
        onClose={vi.fn()}
        onImport={async () => true}
        defaultSelection={{ level: null, category: null, bossId: null, title: '' } as never}
      />,
    );
    expect(screen.getByText('スプレッドシートから取り込む')).toBeInTheDocument();
    expect(screen.getByText(/まるごと貼り付け/)).toBeInTheDocument();
    expect(screen.getByText('列ごとに貼り付け')).toBeInTheDocument();
  });
  it('閉じていると何も描画しない', () => {
    const { container } = render(
      <SpreadsheetGridImportModal isOpen={false} onClose={vi.fn()} onImport={async () => true}
        defaultSelection={{ level: null, category: null, bossId: null, title: '' } as never} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run src/components/__tests__/SpreadsheetGridImportModal.test.tsx`
Expected: FAIL（コンポーネント未定義）

- [ ] **Step 3: 実装(最小)**

骨格(既存モーダルの portal/glass 作法を流用。グリッド本体は GridTable state を編集):

```tsx
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';
import { useEscapeClose } from '../hooks/useEscapeClose';
import { getJobsFromStore, getMitigationsFromStore } from '../hooks/useSkillsData';
import type { SheetImportResult } from '../lib/sheetImport/buildPlanFromSheets';
import type { GridTable, GridColumn, GridField } from '../lib/sheetImport/gridTypes';
import { buildPlanFromGrid } from '../lib/sheetImport/buildPlanFromGrid';
import { validateGridColumn } from '../lib/sheetImport/validateGridColumn';
import { applyTemplateTargetsToResult } from '../lib/sheetImport/applyTemplateTargets';
import { ImportContentSelector } from './ImportContentSelector';
import { resolveInitialSelection, deriveContentId } from '../lib/contentSelection';
import type { ContentSelectionDefault } from '../lib/contentSelection';
import type { ContentLevel, ContentCategory, ContentDefinition } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImport: (result: SheetImportResult, opts: { contentId: string | null }) => Promise<boolean>;
  defaultSelection: ContentSelectionDefault;
}

/** 固定の正典列(member は検出後に動的追加)。 */
const BASE_FIELDS: GridField[] = ['phase', 'label', 'time', 'action', 'damage', 'target', 'damageType'];

export const SpreadsheetGridImportModal: React.FC<Props> = ({ isOpen, onClose, onImport, defaultSelection }) => {
  useEscapeClose(isOpen, onClose);
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'ja';
  const jobs = useMemo(() => getJobsFromStore(), []);
  const mitigations = useMemo(() => getMitigationsFromStore(), []);

  // 取り込み先コンテンツ選択(既存モーダルと同じ ImportContentSelector・必須)
  const [selLevel, setSelLevel] = useState<ContentLevel | null>(null);
  const [selCategory, setSelCategory] = useState<ContentCategory | null>(null);
  const [selBoss, setSelBoss] = useState<ContentDefinition | null>(null);
  const [selTitle, setSelTitle] = useState('');
  // 開いた瞬間だけ初期選択を復元(既存モーダルと同作法・dep は [isOpen] のみ)
  const defaultSelRef = useRef(defaultSelection);
  defaultSelRef.current = defaultSelection;
  useEffect(() => {
    if (!isOpen) return;
    const init = resolveInitialSelection(defaultSelRef.current);
    setSelLevel(init.level); setSelCategory(init.category); setSelBoss(init.boss); setSelTitle(init.title);
  }, [isOpen]);
  const selectedContentId = deriveContentId(selBoss, selCategory, selTitle);

  const [table, setTable] = useState<GridTable>({
    columns: BASE_FIELDS.map((f) => ({ field: f, header: t(`gridImport.col_${f}`) })),
    rows: [],
  });

  const preview = useMemo<SheetImportResult | null>(
    () => (table.rows.length ? buildPlanFromGrid(table, { mitigations, jobs }, { includeMitigations: true }) : null),
    [table, mitigations, jobs],
  );

  const handleConfirm = useCallback(async () => {
    if (!preview) return;
    // 既存モーダルと同じ実証済み手順: テンプレ対象引き継ぎ → onImport(=handleSheetImport→commitImportedPlan)
    const finalResult = await applyTemplateTargetsToResult(preview, selectedContentId);
    const ok = await onImport(finalResult, { contentId: selectedContentId });
    if (ok) onClose();
  }, [preview, onImport, onClose, selectedContentId]);

  if (!isOpen) return null;

  const node = (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-3" onClick={onClose}>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}
          className="relative z-[201] w-[96vw] max-w-[1280px] h-[88vh] glass-tier3 rounded-2xl overflow-hidden flex flex-col"
          style={{ '--glass-tier3-bg': 'var(--share-modal-bg)' } as React.CSSProperties}
          onClick={(e) => e.stopPropagation()}>
          {/* header */}
          <div className="px-5 py-4 border-b border-app-border bg-app-surface2 flex items-center justify-between shrink-0">
            <h2 className="text-app-3xl font-bold text-app-text flex items-center gap-2">
              <FileSpreadsheet size={18} /> {t('gridImport.title')}
            </h2>
            <button onClick={onClose} className="p-1.5 rounded-lg text-app-text hover:bg-app-toggle hover:text-app-toggle-text"><X size={18} /></button>
          </div>
          {/* content selection（既存と同じ実証済み部品・必須） */}
          <div className="px-5 py-3 border-b border-app-border bg-app-surface2 shrink-0">
            <ImportContentSelector
              selLevel={selLevel} setSelLevel={setSelLevel}
              selCategory={selCategory} setSelCategory={setSelCategory}
              selBoss={selBoss} setSelBoss={setSelBoss}
              selTitle={selTitle} setSelTitle={setSelTitle}
              lang={lang}
            />
          </div>
          {/* paste bar */}
          <div className="px-5 py-3 border-b border-app-border bg-app-surface2 flex flex-col gap-1 shrink-0">
            <div className="flex gap-3 items-start flex-wrap">
              <button className="px-4 py-2 rounded-lg text-app-2xl font-bold bg-app-toggle text-app-toggle-text">{t('gridImport.paste_whole')}</button>
              <button className="px-4 py-2 rounded-lg text-app-2xl font-bold border border-app-border text-app-text">{t('gridImport.paste_by_column')}</button>
            </div>
            <p className="text-app-lg text-app-text-muted">{t('gridImport.help')}</p>
          </div>
          {/* grid */}
          <div className="flex-1 overflow-auto">
            <GridView table={table} setTable={setTable} deps={{ mitigations, jobs }} />
          </div>
          {/* footer */}
          <div className="px-5 py-4 border-t border-app-border bg-app-surface2 flex items-center justify-between shrink-0">
            <span className="text-app-2xl text-app-text-muted">
              {preview && t('gridImport.summary', { labels: preview.labels.length, events: preview.timelineEvents.length, mits: preview.timelineMitigations.length })}
            </span>
            <button onClick={handleConfirm} disabled={!preview}
              className={clsx('flex items-center gap-2 px-5 py-2 rounded-lg text-app-2xl font-bold',
                preview ? 'bg-app-toggle text-app-toggle-text' : 'bg-app-surface2 text-app-text-muted')}>
              <CheckCircle2 size={16} /> {t('gridImport.create')}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
  return createPortal(node, document.body);
};

/** グリッド本体: 列ヘッダー(チップ)+ ペースト textarea。最小実装。 */
const GridView: React.FC<{
  table: GridTable; setTable: (t: GridTable) => void;
  deps: { mitigations: ReturnType<typeof getMitigationsFromStore>; jobs: ReturnType<typeof getJobsFromStore> };
}> = ({ table, setTable, deps }) => {
  const { t } = useTranslation();
  const cellsOf = (ci: number) => table.rows.map((r) => r[ci] ?? '');
  return (
    <table className="w-full text-app-lg border-separate" style={{ borderSpacing: 0 }}>
      <thead>
        <tr>
          {table.columns.map((c, ci) => {
            const st = validateGridColumn(c, cellsOf(ci), deps);
            return (
              <th key={ci} className="sticky top-0 bg-app-surface2 border-b border-r border-app-border px-3 py-2 text-left">
                <div className="flex flex-col gap-1 min-w-[90px]">
                  <span className="font-bold">{c.field === 'member' ? c.header : t(`gridImport.col_${c.field}`)}</span>
                  <StatusChip status={st} />
                </div>
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {table.rows.map((r, ri) => (
          <tr key={ri}>
            {table.columns.map((_, ci) => (
              <td key={ci} className="border-b border-r border-app-border px-3 py-1.5 text-app-text">{r[ci] ?? ''}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const StatusChip: React.FC<{ status: 'ok' | 'partial' | 'empty' }> = ({ status }) => {
  const { t } = useTranslation();
  const map = {
    ok: 'text-app-blue bg-app-blue-dim border-app-blue-border',
    partial: 'text-app-amber bg-app-amber-dim border-app-amber-border',
    empty: 'text-app-text-muted bg-app-text/5 border-app-border',
  } as const;
  const label = status === 'ok' ? t('gridImport.status_ok') : status === 'partial' ? t('gridImport.status_partial') : t('gridImport.status_empty');
  return <span className={clsx('text-app-sm font-bold rounded-full px-2 py-0.5 border w-max', map[status])}>{label}</span>;
};
```

> 注: `app-blue`/`app-blue-dim`/`app-blue-border` トークンが未定義なら、既存の青(`app-toggle` 系)に置換して使う(実装時に [docs/DESIGN.md](../../DESIGN.md) で確認・無ければ既存トークンへ寄せる)。緑は使わない。

- [ ] **Step 4: 成功を確認**

Run: `npx vitest run src/components/__tests__/SpreadsheetGridImportModal.test.tsx`
Expected: PASS（2件）

- [ ] **Step 5: Commit**

```bash
rtk git add src/components/SpreadsheetGridImportModal.tsx src/components/__tests__/SpreadsheetGridImportModal.test.tsx
rtk git commit -m "feat(import): 列グリッド取込モーダル(最小フロー)を追加"
```

---

## Task 13: まるごと貼り付け + 列割当 + 枠割当 + 確定ブロック(UI 統合)

**Files:**
- Modify: `src/components/SpreadsheetGridImportModal.tsx`
- Test: `src/components/__tests__/SpreadsheetGridImportModal.test.tsx`(追記)

**Interfaces:**
- Consumes: `parseGridPaste`/`isFamousSheetFormat`(Task 7), `detectField`(Task 6), `partyAssignment`(`SLOTS_BY_ROLE`/`SLOT_ROLE`/`autoFillSingles` 等), **`importBlockReason`(`../lib/sheetImport/importBlockReason`・実証済み確定ブロック)**。
- Produces: モーダル内の貼り付け・列割当・枠割当・確定ブロックハンドラ(外部シグネチャ不変)。

実装内容(各ステップで TDD):
1. **まるごと貼り付け**: textarea or paste イベント → `isFamousSheetFormat` なら警告「これは別経路向け」を出し、既存 `SpreadsheetImportModal` 起動を促す(本モーダルでは扱わない)。それ以外は `parseGridPaste(tsv, jobs)` で `table` を差し替え。
2. **「この列は？」**: `unknown` 列ヘッダーのセレクタで field を手動指定(`setTable` で column.field 更新)。「無視」で `ignore`。
3. **列ごと貼り付け**: 選択列にクリップボードの1列(改行区切り)を流し込む。
4. **枠割当**: member 列ヘッダーの枠セレクタ(`SLOTS_BY_ROLE[role]`)。`autoFillSingles` 相当でロール内1人なら自動。枠未割当でスキルありの列があれば footer 警告(`slot_unassigned_warning`)。
5. **確定ブロック(実証済み再利用)**: `importBlockReason({ hasPreviewEvents, partyComplete, hasPendingDraft })` で「作成」ボタンを gating(既存モーダルと同基準)。`partyComplete`=枠ありスキル列が全て枠割当済み・`hasPendingDraft`=未取込の貼り付けが残存。null=作成可。

- [ ] **Step 1: 失敗するテスト(まるごと貼り付け→列が自動検出される)**

```tsx
import { fireEvent } from '@testing-library/react';
// ...(同 describe 内)
  it('まるごと貼り付けで見出しから列が自動検出される', () => {
    render(<SpreadsheetGridImportModal isOpen onClose={() => {}} onImport={async () => true}
      defaultSelection={{ level: null, category: null, bossId: null, title: '' } as never} />);
    const ta = screen.getByPlaceholderText(/貼り付け/);
    fireEvent.change(ta, { target: { value: '時間\t敵の攻撃\n0:16\tばりばりルインガ\n' } });
    fireEvent.click(screen.getByText(/まるごと貼り付け/));
    expect(screen.getByText('ばりばりルインガ')).toBeInTheDocument();
  });
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run src/components/__tests__/SpreadsheetGridImportModal.test.tsx`
Expected: FAIL（textarea/ハンドラ未実装）

- [ ] **Step 3: 実装**

`GridView` 上部にペースト用 textarea を追加し、`onPasteWhole(tsv)` を実装:
```tsx
// SpreadsheetGridImportModal 内
const [draft, setDraft] = useState('');
const onPasteWhole = useCallback(() => {
  if (isFamousSheetFormat(draft)) { setFamousWarn(true); return; }
  const t2 = parseGridPaste(draft, jobs);
  // member 列の slot 自動割当(ロール内1人)
  setTable(autoAssignSingleSlots(t2, jobs));
}, [draft, jobs]);
```
`autoAssignSingleSlots(table, jobs)` を同ファイルに実装(jobId→role を引き、`SLOTS_BY_ROLE[role]` で member 列が1本なら先頭枠を割当)。
「この列は？」セレクタ・枠セレクタ・列ごと貼り付けハンドラもここで追加(各々 `setTable` で更新)。textarea に `placeholder={t('gridImport.paste_whole')}` を含む文言を付与しテストが拾えるようにする。

- [ ] **Step 4: 成功を確認**

Run: `npx vitest run src/components/__tests__/SpreadsheetGridImportModal.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
rtk git add src/components/SpreadsheetGridImportModal.tsx src/components/__tests__/SpreadsheetGridImportModal.test.tsx
rtk git commit -m "feat(import): まるごと自動検出・列割当・枠割当をモーダルに統合"
```

---

## Task 14: Timeline / ImportMenu 配線 + 実機 + マージ

**Files:**
- Modify: `src/components/Timeline.tsx`(:1285 `handleSheetImport` 近辺・:3945 モーダル並置)
- Modify: `src/components/ImportMenu.tsx`

**Interfaces:**
- Consumes: `SpreadsheetGridImportModal`(Task 12/13), 既存 `handleSheetImport`(`onImport`・`commitImportedPlan` 経由)。
- Produces: 起動導線(window event or メニュー項目)+ モーダル並置。

- [ ] **Step 1: ImportMenu に項目追加**

`ImportMenu.tsx` に「スプレッドシートから取り込む(列グリッド)」項目を追加し、`window.dispatchEvent(new CustomEvent('timeline:grid-import'))` を発火(既存 `timeline:spreadsheet-import` と同作法・[Timeline.tsx:959](../../../src/components/Timeline.tsx))。

- [ ] **Step 2: Timeline に state + リスナー + モーダル並置**

```tsx
const [showGridImport, setShowGridImport] = useState(false);
useEffect(() => {
  const h = () => setShowGridImport(true);
  window.addEventListener('timeline:grid-import', h);
  return () => window.removeEventListener('timeline:grid-import', h);
}, []);
// ...既存 <SpreadsheetImportModal .../> の隣に:
<SpreadsheetGridImportModal
  isOpen={showGridImport}
  onClose={() => setShowGridImport(false)}
  onImport={handleSheetImport}   // 既存ハンドラを再利用(commitImportedPlan 経由)
  defaultSelection={sheetDefaultSelection}  // 既存 SpreadsheetImportModal と同じ値
/>
```
（`handleSheetImport`/`defaultSelection` は既存 SpreadsheetImportModal が使っているものをそのまま渡す。:3945 周辺を参照。）

- [ ] **Step 3: ビルド + 全テスト緑**

Run: `npm run build`
Expected: 成功(tsc -b 厳密)

Run: `npx vitest run src/lib/sheetImport src/components/__tests__/SpreadsheetGridImportModal.test.tsx`
Expected: 全 PASS。**既存 `buildPlanFromSheets.test.ts`/`parseMitigationSheet.test.ts` も不変で緑**(回帰なし)を確認。

- [ ] **Step 4: 実機確認(エンドユーザー視点・[feedback_endpoint_user_verification])**

`npm run dev` で:
1. **コンテンツ選択**が出る・既存モーダルと同じ挙動(Lv/カテゴリ/ボス/自由入力)で選べる。選んだコンテンツが新プランに反映。
2. 自作風スプシ(member列形式)を**まるごと貼り付け** → 列が自動検出・枠割当・対象/種別が入る・未解決はskip → 作成 → タイムラインに反映。
3. **列ごと貼り付け**でも同様に作れる。
4. **テンプレ対象引き継ぎ(§③)**: テンプレ有りコンテンツを選ぶと攻撃の対象(MT/ST)が補完される。取込側の対象列で明示した値はそのまま残る。
5. ダメージ列を右端に置いても検出される。計算列(最大HP 等)は無視される。
6. 4人ぶんのメンバー列でも作成できる。
7. 枠未割当でスキルありなら「作成」がブロックされる(importBlockReason・既存と同基準)。
8. collab-ON の表を開いた状態から取り込んでも「前の表」を引きずらない(Bug #1 回帰)。
9. 既存の有名スプシ取込([SpreadsheetImportModal])が従来通り動く(コンテンツ選択抽出後も wizard 不変)。
10. 英語/中国語/韓国語モードで文言が崩れない。

- [ ] **Step 5: Commit + push(本人ローカル確認をゲートに・[feedback_deploy])**

```bash
rtk git add src/components/Timeline.tsx src/components/ImportMenu.tsx
rtk git commit -m "feat(import): 列グリッド取込モーダルを Timeline/ImportMenu に配線"
```
本人の実機OK後に `feat/spreadsheet-grid-import` を main へマージ+push(Vercel 自動デプロイ)。

---

## Self-Review(spec 突き合わせ)

- **2経路(まるごと/列ごと)**: Task 7(parse)+ Task 12/13(UI) ✓
- **正典列(phase任意/label/time/action/damage/target/damageType/member)**: Task 8(build)+ Task 12(UI) ✓
- **コンテンツ選択(必須・実証済み再利用)**: Task 11(`ImportContentSelector` 抽出・共有)+ Task 12(モーダルに組込)✓
- **メンバー列=ジョブ名+枠割当**: Task 4(job解決)+ Task 8(party)+ Task 13(枠UI) ✓
- **列チップ青/黄/灰(緑不使用)**: Task 9 + Task 12 ✓
- **見出し自動検出(位置非依存)**: Task 6 + Task 7 + Task 13 ✓
- **4言語スキル/ジョブ解決**: Task 3 + Task 4 ✓
- **攻撃の対象列**: Task 5 + Task 8 ✓
- **4人対応**: Task 8(party は検出駆動・枠固定数なし)✓
- **有名スプシ経路温存**: 既存パーサ/ビルダー不変・`isFamousSheetFormat` で別経路へ(Task 7/13)・Task 14 回帰確認 ✓
- **実証済みパイプライン丸ごと再利用**: `ImportContentSelector`(Task 11)/ `applyTemplateTargetsToResult`(Task 12 handleConfirm)/ `importBlockReason`(Task 13)/ `commitImportedPlan`(Task 14 で既存 `handleSheetImport` 再利用)✓
- **§③テンプレ対象引き継ぎ**: Task 12 の handleConfirm が `applyTemplateTargetsToResult(preview, selectedContentId)` を通す。取込側 target 明示は維持(`applyTemplateTargets` は対象未設定の攻撃のみ補完=実装時確認)✓
- **i18n 4言語 + rights_notice + ユーモア**: Task 10 + Task 12/13 ✓
- **マーキー(§5)**: スコープ外(別タスク)— 本計画に含めない(意図的)✓

placeholder/型整合: ステップ内コードは実型(`GridTable`/`SheetImportResult`/`PartySlot`/`ContentLevel`)で一貫。`mmssToSec`/`resolveSheetSkill`/`resolveJobId`/`normalizeTarget`/`buildPlanFromGrid`/`ImportContentSelector` の名称は全タスクで一致。全14タスク。
