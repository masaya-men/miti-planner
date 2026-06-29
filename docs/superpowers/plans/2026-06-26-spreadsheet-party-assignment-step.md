# 有名スプシ取込: パーティ割当独立ステップ化 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 有名スプシ(行列形式)の複数フェーズ取込で「最後に割当UIが消えて詰む」デッドエンドを、パーティ割当を独立ステップ化+自動仮割当で解消する。

**Architecture:** 取込モーダルを2→3ステップウィザード化(コンテンツ選択→表を貼る→パーティ割当)。割当state を既存 `resolveImportParty` でシード(タンクcanonical順・ヒラPH/BH を新規追加)。手動編集は保持。クリアボタン新設・戻るはデータ保持。自作スプシ(grid)は非対象で現状維持。

**Tech Stack:** React + TypeScript, framer-motion, react-i18next, vitest。

**設計書:** `docs/superpowers/specs/2026-06-26-spreadsheet-party-assignment-step-design.md`

## Global Constraints

- 言語: コメント・UI文言は日本語。i18n は ja/en/ko/zh の4言語 parity 必須(ロケールJSONは該当ブロックのみ textual 編集)。
- デザイン: 白黒のみ。機能色は青(進む)/赤(危険)/黄(警告)のみ。色は `--app-*` トークン経由・px直書き禁止・glass は `glass-tier*`。
- ハードコーディング禁止。並び順・割当は既存 `resolveImportParty` / `dpsOrder.ts` を再利用・拡張(重複定義しない)。
- push 前に `npm run build`(tsc -b + api + vite)と `npm run test`(vitest) を必ず通す。
- スコープ厳守: 変更は有名スプシ(`source==='matrix'`)経路のみ。自作スプシ(`source==='grid'`)の挙動は変えない。

---

### Task 1: ロール並び順データ拡張 + resolveImportParty 一般化

**Files:**
- Modify: `src/data/dpsOrder.ts`(タンク・ヒラの並び順定数とランク関数を追加)
- Modify: `src/lib/sheetImport/resolveImportParty.ts`(全ロールをランク順で枠採番する形に一般化)
- Test: `src/lib/sheetImport/__tests__/resolveImportParty.test.ts`(1ケース更新+PH/BH・タンクcanonicalのケース追加)

**Interfaces:**
- Consumes: `Job`(`src/types`), 既存 `DPS_SUBROLE_ORDER` / `dpsRank`。
- Produces:
  - `TANK_ORDER: readonly string[]`, `HEALER_PURE`, `HEALER_BARRIER`, `HEALER_ORDER: readonly string[]`
  - `tankRank(jobId: string): number`, `healerRank(jobId: string): number`
  - `resolveImportParty(usedJobIds: string[], jobs: Job[]): { slot: string; jobId: string }[]`(シグネチャ不変・出力は検出順保持)

- [ ] **Step 1: 既存テストを新仕様へ更新(失敗を作る)**

`src/lib/sheetImport/__tests__/resolveImportParty.test.ts` の「タンク/ヒラの枠順は不変…」テスト(現状 `war:MT, pld:ST` を期待)を canonical 順に更新し、PH/BH とタンク canonical の新ケースを追加する。該当 `it(...)` ブロックを以下で置換:

```ts
  it('タンクは canonical 順で MT/ST を決める（検出順は無視）', () => {
    // 検出順 war→pld でも canonical(pld<war) で MT=pld, ST=war。
    const out = resolveImportParty(['war', 'smn', 'pld', 'nin'], JOBS);
    const slotByJob = Object.fromEntries(out.map((p) => [p.jobId, p.slot]));
    expect(slotByJob).toEqual({ pld: 'MT', war: 'ST', nin: 'D1', smn: 'D2' });
  });
  it('ヒラは PH(白/占)→H1・BH(学/賢)→H2 で割り当てる（検出順は無視）', () => {
    // 検出順 sch(BH)→ast(PH) でも PH 優先で H1=ast, H2=sch。
    const out = resolveImportParty(['sch', 'ast'], [...JOBS, J('ast', 'healer')]);
    const slotByJob = Object.fromEntries(out.map((p) => [p.jobId, p.slot]));
    expect(slotByJob).toEqual({ ast: 'H1', sch: 'H2' });
  });
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx vitest run src/lib/sheetImport/__tests__/resolveImportParty.test.ts`
Expected: FAIL(新ケースで `ast: 'H1'` 等が現状の検出順実装と不一致)。

- [ ] **Step 3: dpsOrder.ts にタンク・ヒラの並び順を追加**

`src/data/dpsOrder.ts` の末尾(`dpsRank` の後)に追記:

```ts
/** タンクの並び順(MT→ST の既定)。FF14 公式ジョブガイド順。MT/ST はジョブで一意に決まらないため決定的な既定として使う。 */
export const TANK_ORDER: readonly string[] = ['pld', 'war', 'drk', 'gnb'];

/** ピュアヒラ(PH = H1 寄り)。 */
export const HEALER_PURE: readonly string[] = ['whm', 'ast'];
/** バリアヒラ(BH = H2 寄り)。 */
export const HEALER_BARRIER: readonly string[] = ['sch', 'sge'];
/** ヒラの並び順(PH → BH = H1→H2 の既定)。 */
export const HEALER_ORDER: readonly string[] = [...HEALER_PURE, ...HEALER_BARRIER];

/** jobId のタンク並び順ランク(小さいほど MT 寄り)。未知は末尾。 */
export function tankRank(jobId: string): number {
  const i = TANK_ORDER.indexOf(jobId);
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
}
/** jobId のヒラ並び順ランク(小さいほど H1 寄り=PH 優先)。未知は末尾。 */
export function healerRank(jobId: string): number {
  const i = HEALER_ORDER.indexOf(jobId);
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
}
```

- [ ] **Step 4: resolveImportParty を全ロール一般化に置換**

`src/lib/sheetImport/resolveImportParty.ts` の全文を以下に置換:

```ts
import type { Job } from '../../types';
import { dpsRank, tankRank, healerRank } from '../../data/dpsOrder';

type SlotRole = 'tank' | 'healer' | 'dps';

const SLOTS_BY_ROLE: Record<SlotRole, string[]> = {
  tank: ['MT', 'ST'],
  healer: ['H1', 'H2'],
  dps: ['D1', 'D2', 'D3', 'D4'],
};

/** ロールごとの並び順ランク(小さいほど先頭枠寄り)。 */
const RANK: Record<SlotRole, (id: string) => number> = {
  tank: tankRank,
  healer: healerRank,
  dps: dpsRank,
};

/**
 * 検出ジョブをロール枠(MT/ST・H1/H2・D1〜D4)へ割り当てる。
 * - 各ロール内をサブロール/並び順ランク昇順で安定ソートして枠を採番:
 *   タンク=canonical 順(pld→war→drk→gnb)で MT/ST、ヒラ=PH(白/占)→BH(学/賢)で H1/H2、
 *   DPS=近接→遠隔物理→キャスターで D1〜D4。同ランク(未知)は検出順を保つ(安定ソート)。
 * - ロール枠超過・未知ロール/未知ジョブは捨てる。
 *
 * 戻り値の配列順は元の usedJobIds 順を保つ(slot だけ上記規則で確定)。
 * 順序に依存する consumer(既存テスト・表示前整列)を壊さないため。
 */
export function resolveImportParty(
  usedJobIds: string[],
  jobs: Job[],
): { slot: string; jobId: string }[] {
  const roleOf = new Map(jobs.map((j) => [j.id, j.role] as const));

  // ロールごとに jobId→slot を先に確定。
  const slotByJob = new Map<string, string>();
  for (const role of ['tank', 'healer', 'dps'] as SlotRole[]) {
    const ids = usedJobIds.filter((id) => roleOf.get(id) === role);
    [...ids]
      .sort((a, b) => RANK[role](a) - RANK[role](b))
      .forEach((jobId, i) => {
        const slot = SLOTS_BY_ROLE[role][i];
        if (slot) slotByJob.set(jobId, slot);
      });
  }

  // 出力は検出順を保持。枠が決まらなかった(超過/未知)ものは捨てる。
  const out: { slot: string; jobId: string }[] = [];
  for (const jobId of usedJobIds) {
    const slot = slotByJob.get(jobId);
    if (slot) out.push({ slot, jobId });
  }
  return out;
}
```

- [ ] **Step 5: テストを実行して全緑を確認**

Run: `npx vitest run src/lib/sheetImport/__tests__/resolveImportParty.test.ts`
Expected: PASS(既存5ケース+新2ケース)。

- [ ] **Step 6: 影響範囲の回帰確認(共有関数のため)**

`resolveImportParty` は `buildPlanFromSheets`(partyOverride 未指定時)でも使われる共有関数。関連テストを実行:

Run: `npx vitest run src/lib/sheetImport/__tests__/buildPlanFromSheets.test.ts src/lib/sheetImport/__tests__/gridRowsFromResult.test.ts`
Expected: PASS(単一タンク/ヒラ・明示 party 配列のケースのみで、canonical 化に非依存)。万一 tank/healer 枠順に依存する assertion が落ちたら canonical/PH-BH 期待値へ更新する。

- [ ] **Step 7: コミット**

```bash
rtk git add src/data/dpsOrder.ts src/lib/sheetImport/resolveImportParty.ts src/lib/sheetImport/__tests__/resolveImportParty.test.ts
rtk git commit -m "feat(import): resolveImportParty をタンクcanonical順・ヒラPH/BHに拡張"
```

---

### Task 2: seedAssignment(自動仮割当 + 手動保持)純関数

**Files:**
- Modify: `src/lib/sheetImport/partyAssignment.ts`(`seedAssignment` を追加)
- Test: `src/lib/sheetImport/__tests__/partyAssignment.test.ts`(`seedAssignment` の describe を追加)

**Interfaces:**
- Consumes: `resolveImportParty`(Task 1), `pruneAssignment`/`groupByRole`/`PARTY_SLOTS`/`SLOTS_BY_ROLE`/`PartyAssignment`/`SlotRole`(同ファイル), `Job`(`src/types`)。
- Produces: `seedAssignment(prev: PartyAssignment, detectedJobIds: string[], jobs: Job[]): PartyAssignment`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/sheetImport/__tests__/partyAssignment.test.ts` の最後の `});`(ファイル末尾の describe 閉じ)の直前に、新しい describe を追加。先頭の import に `seedAssignment` を追加し、テスト用 JOBS を用意:

```ts
// ファイル冒頭の import に seedAssignment を追加:
//   import { emptyAssignment, assignSlot, ..., pruneAssignment, seedAssignment } from '../partyAssignment';
// 末尾 describe 内に追加:
  describe('seedAssignment', () => {
    const J = (id: string, role: 'tank' | 'healer' | 'dps') =>
      ({ id, name: { ja: id, en: id }, role, icon: '' } as import('../../../types').Job);
    const JOBS = [
      J('pld', 'tank'), J('war', 'tank'), J('whm', 'healer'), J('sch', 'healer'),
      J('ast', 'healer'),
      J('mnk', 'dps'), J('drg', 'dps'), J('brd', 'dps'), J('blm', 'dps'),
    ];

    it('フル8人を空 assignment から全枠 resolveImportParty 既定で埋める', () => {
      const a = seedAssignment(
        emptyAssignment(),
        ['pld', 'war', 'whm', 'sch', 'mnk', 'drg', 'brd', 'blm'],
        JOBS,
      );
      expect(a).toEqual({
        MT: 'pld', ST: 'war', H1: 'whm', H2: 'sch',
        D1: 'mnk', D2: 'drg', D3: 'brd', D4: 'blm',
      });
    });

    it('手動で割り当てた枠は保持し、空き枠だけ埋める', () => {
      // 手動で war を MT に置いた(既定なら pld=MT)。pld は空きタンク枠 ST へ回る。
      const prev = assignSlot(emptyAssignment(), 'MT', 'war');
      const a = seedAssignment(prev, ['pld', 'war'], JOBS);
      expect(a.MT).toBe('war'); // 手動を保持
      expect(a.ST).toBe('pld'); // 既定枠(MT)が埋まっていたので空きの ST へ
    });

    it('検出から消えたジョブの枠は外す', () => {
      // war を ST に置いていたが、war が検出から消えた → ST は空く。
      const prev = assignSlot(assignSlot(emptyAssignment(), 'MT', 'pld'), 'ST', 'war');
      const a = seedAssignment(prev, ['pld'], JOBS);
      expect(a.MT).toBe('pld');
      expect(a.ST).toBeNull();
    });

    it('元の assignment を破壊しない(pure)', () => {
      const prev = emptyAssignment();
      seedAssignment(prev, ['pld'], JOBS);
      expect(prev.MT).toBeNull();
    });
  });
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx vitest run src/lib/sheetImport/__tests__/partyAssignment.test.ts`
Expected: FAIL(`seedAssignment` が未定義)。

- [ ] **Step 3: seedAssignment を実装**

`src/lib/sheetImport/partyAssignment.ts` の冒頭に import を追加(現状 import 無し):

```ts
import type { Job } from '../types';
import { resolveImportParty } from './resolveImportParty';
```

ファイル末尾に追加:

```ts
/**
 * 検出ジョブを枠へ自動で仮割当しつつ、既存(手動含む)の割当は保持する。
 * - prev のうち検出に残るジョブの枠は維持、消えたジョブの枠は外す(prune)。
 * - まだ座っていない検出ジョブを resolveImportParty の既定配置で空き枠に詰める。
 *   既定の枠が埋まっていれば同ロールの別の空き枠へ。空きが無ければ捨てる。
 * 純関数(prev は変更しない)。
 */
export function seedAssignment(
  prev: PartyAssignment,
  detectedJobIds: string[],
  jobs: Job[],
): PartyAssignment {
  const roleOf = (id: string): SlotRole | undefined =>
    jobs.find((j) => j.id === id)?.role as SlotRole | undefined;
  const byRole = groupByRole(detectedJobIds, roleOf);
  const base = pruneAssignment(prev, byRole); // shallow copy(prev 不変)
  const seated = new Set(
    PARTY_SLOTS.map((s) => base[s]).filter((v): v is string => v !== null),
  );
  for (const { slot, jobId } of resolveImportParty(detectedJobIds, jobs)) {
    if (seated.has(jobId)) continue;
    if (base[slot as PartySlot] === null) {
      base[slot as PartySlot] = jobId;
      seated.add(jobId);
      continue;
    }
    // 既定枠が埋まっている → 同ロールの空き枠へ
    const role = roleOf(jobId);
    if (!role) continue;
    const empty = SLOTS_BY_ROLE[role].find((s) => base[s] === null);
    if (empty) {
      base[empty] = jobId;
      seated.add(jobId);
    }
  }
  return base;
}
```

- [ ] **Step 4: テストを実行して全緑を確認**

Run: `npx vitest run src/lib/sheetImport/__tests__/partyAssignment.test.ts`
Expected: PASS。

- [ ] **Step 5: コミット**

```bash
rtk git add src/lib/sheetImport/partyAssignment.ts src/lib/sheetImport/__tests__/partyAssignment.test.ts
rtk git commit -m "feat(import): seedAssignment(自動仮割当+手動保持)を追加"
```

---

### Task 3: i18n キー追加(4言語)

**Files:**
- Modify: `src/locales/ja.json`, `src/locales/en.json`, `src/locales/ko.json`, `src/locales/zh.json`(各 `gridImport` ブロックに5キー追加)
- Test: `src/locales/__tests__/sheet-import-wizard-i18n-parity.test.ts`(既存・実行のみ)

**Interfaces:**
- Produces: i18n キー `gridImport.step_party` / `gridImport.next_to_party` / `gridImport.slot_empty` / `gridImport.no_party_detected` / `gridImport.clear`

- [ ] **Step 1: ja.json にキーを追加**

`src/locales/ja.json` の `gridImport` ブロック内、`"format_hint": ...` 行の末尾に `,` を付け、その下に追加(該当ブロックのみ textual 編集):

```json
        "step_party": "パーティ割当",
        "next_to_party": "パーティ割当へ",
        "slot_empty": "未割当",
        "no_party_detected": "パーティが検出されませんでした。このまま作成できます。",
        "clear": "やり直す"
```

- [ ] **Step 2: en.json にキーを追加**

`src/locales/en.json` の `gridImport` ブロック末尾に同様に追加:

```json
        "step_party": "Party assignment",
        "next_to_party": "To party assignment",
        "slot_empty": "Unassigned",
        "no_party_detected": "No party detected. You can still create.",
        "clear": "Start over"
```

- [ ] **Step 3: ko.json にキーを追加**

`src/locales/ko.json` の `gridImport` ブロック末尾に追加:

```json
        "step_party": "파티 배치",
        "next_to_party": "파티 배치로",
        "slot_empty": "미배치",
        "no_party_detected": "파티가 감지되지 않았습니다. 그대로 생성할 수 있습니다.",
        "clear": "처음부터"
```

- [ ] **Step 4: zh.json にキーを追加**

`src/locales/zh.json` の `gridImport` ブロック末尾に追加:

```json
        "step_party": "队伍分配",
        "next_to_party": "前往队伍分配",
        "slot_empty": "未分配",
        "no_party_detected": "未检测到队伍。仍可直接创建。",
        "clear": "重新开始"
```

- [ ] **Step 5: パリティテスト+JSON妥当性を確認**

Run: `npx vitest run src/locales/__tests__/sheet-import-wizard-i18n-parity.test.ts`
Expected: PASS(4言語に同一キーが揃っている)。fal なら追加キーの綴り/カンマを修正。

- [ ] **Step 6: コミット**

```bash
rtk git add src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
rtk git commit -m "feat(import): パーティ割当ステップの i18n キーを4言語追加"
```

---

### Task 4: 取込モーダルを3ステップ化(割当ステップ+自動シード+クリア)

**Files:**
- Modify: `src/components/SpreadsheetGridImportModal.tsx`

**Interfaces:**
- Consumes: `seedAssignment`(Task 2), Task 1 の `resolveImportParty` 経由の自動割当, Task 3 の i18n キー, 既存 `handleSlotChange`/`detectedByRole`/`PARTY_SLOTS`/`SLOTS_BY_ROLE`。
- Produces: 3ステップウィザード(matrix 経路)。grid 経路は現状維持。

UI 単体テストは設けない(モーダルは state 結合が密)。検証 = ビルド + 実機 E2E。

- [ ] **Step 1: WizardStep 型を 1|2|3 に拡張**

`SpreadsheetGridImportModal.tsx` のステップ型定義を置換:

```ts
/** ウィザードのステップ。1=コンテンツ選択 / 2=スプシ風グリッド / 3=パーティ割当。 */
type WizardStep = 1 | 2 | 3;
```

- [ ] **Step 2: リセットを関数化(クリアボタンと共用)**

`useEffect(() => { if (!isOpen) return; setStep(1); setTable(...)... }, [isOpen])`(モーダルを開くたびのリセット)を、データ初期化を `resetAll` に切り出して置換。`useEscapeClose` の直後あたりに追加し、open 用 useEffect から呼ぶ:

```ts
  // データ初期化(open 時リセット・クリアボタンで共用)。step は触らない。
  const resetAll = useCallback(() => {
    setTable(emptyHeaderTable(t));
    setSource('none');
    setMatrixParsed(null);
    setParseFailed(false);
    setByColumnMode(false);
    setPhaseName('');
    setEntries([]);
    setAssignment(emptyAssignment());
    setTargetOverrides({});
  }, [t]);
```

open 用 useEffect を置換:

```ts
  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    resetAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);
```

- [ ] **Step 3: 自動シードを seedAssignment に切替**

import に追加: `import { ..., seedAssignment } from '../lib/sheetImport/partyAssignment';`(既存の partyAssignment import 行に追記)。

検出ジョブ変化時の useEffect(現状 `setAssignment((prev) => autoFillSingles(pruneAssignment(prev, detectedByRole), detectedByRole))`)を置換:

```ts
  // 検出ジョブが変わるたびに割当を再シード。手動済み枠は保持し、空き枠を resolveImportParty 既定で埋める。
  useEffect(() => {
    setAssignment((prev) => seedAssignment(prev, detectedJobIds, jobs));
  }, [detectedJobIds, jobs]);
```

- [ ] **Step 4: 未追加ドラフトのコミットを関数化し、handleAddPhase / goToParty で共用**

`handleAddPhase` を `commitPendingDraft` に置換し、step3 へ進む `goToParty` を追加:

```ts
  // 未追加の matrix 貼り付けを entries へ積み、現在の貼り付けをクリアする(次のタブを貼れるように)。
  const commitPendingDraft = useCallback(() => {
    if (source !== 'matrix' || !matrixParsed) return;
    setEntries((prev) => [...prev, { parsed: matrixParsed, phaseName }]);
    setTable(emptyHeaderTable(t));
    setSource('none');
    setMatrixParsed(null);
    setPhaseName('');
  }, [source, matrixParsed, phaseName, t]);

  // ステップ2 → 3(パーティ割当)。未追加ドラフトがあれば取り込んでから遷移。
  const goToParty = useCallback(() => {
    commitPendingDraft();
    setStep(3);
  }, [commitPendingDraft]);
```

「このフェーズを追加」ボタンの `onClick={handleAddPhase}` を `onClick={commitPendingDraft}` に変更。

- [ ] **Step 5: GridView の matrix 枠セレクタを撤去(grid のみ残す)**

`GridView` 内の member 枠セレクタの描画条件を grid 限定にする。`{c.field === 'member' && role && (` を以下に変更:

```tsx
                  {/* 枠セレクタは自作(grid)のみ。matrix の割当はステップ3に集約。 */}
                  {c.field === 'member' && role && source === 'grid' && (
```

これにより、matrix のメンバー列は step2 で見出し(ジョブ)のみ表示し、枠ドロップダウンは出ない。`source` は GridView の既存 props にある(変更不要)。

- [ ] **Step 6: ヘッダーのステップ表示を3値化**

タイトル行のステップラベル(`{step}/2` と `t(step === 1 ? 'gridImport.step_content' : 'gridImport.step_grid')`)を置換:

```tsx
              <span className="text-app-lg text-app-text-muted truncate">
                · {step}/3 · {t(step === 1 ? 'gridImport.step_content' : step === 2 ? 'gridImport.step_grid' : 'gridImport.step_party')}
              </span>
```

- [ ] **Step 7: パーティ割当ステップ本体(PartyAssignmentStep)を追加**

ファイル末尾(`StatusChip` の後)に新コンポーネントを追加:

```tsx
/** ステップ3: 検出ジョブをロール別に MT/ST・H1/H2・D1〜D4 へ割り当てる。自動仮割当済み・入れ替え可。 */
const PartyAssignmentStep: React.FC<{
  assignment: PartyAssignment;
  detectedByRole: Record<SlotRole, string[]>;
  jobs: Job[];
  onSlotChange: (slot: PartySlot, jobId: string | null) => void;
  gridLang: Lang4;
}> = ({ assignment, detectedByRole, jobs, onSlotChange, gridLang }) => {
  const { t } = useTranslation();
  const ROWS: { role: SlotRole; slots: PartySlot[]; label: string }[] = [
    { role: 'tank', slots: ['MT', 'ST'], label: t('roles.tank') },
    { role: 'healer', slots: ['H1', 'H2'], label: t('roles.healer') },
    { role: 'dps', slots: ['D1', 'D2', 'D3', 'D4'], label: t('roles.dps') },
  ];
  const anyDetected = ROWS.some((r) => detectedByRole[r.role].length > 0);
  const jobName = (id: string) => {
    const j = jobs.find((x) => x.id === id);
    return j ? ((j.name[gridLang as keyof typeof j.name] ?? j.name.ja) || j.id) : id;
  };

  if (!anyDetected) {
    return (
      <div className="flex-1 overflow-y-auto px-5 py-5 flex items-center justify-center">
        <p className="text-app-2xl text-app-text-muted text-center">{t('gridImport.no_party_detected')}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">
      {ROWS.filter((r) => detectedByRole[r.role].length > 0).map(({ role, slots, label }) => (
        <div key={role} className="flex flex-col gap-2">
          <span className="text-app-lg font-bold text-app-text-muted">{label}</span>
          <div className="flex flex-wrap items-center gap-3">
            {slots.map((slot) => (
              <label key={slot} className="flex items-center gap-2">
                <span className="w-10 text-app-2xl font-bold text-app-text">{slot}</span>
                <select
                  className="min-w-[140px] appearance-none bg-app-surface2 border border-app-border rounded-lg px-3 py-1.5 text-app-2xl text-app-text focus:outline-none focus:border-app-text"
                  value={assignment[slot] ?? ''}
                  onChange={(e) => onSlotChange(slot, e.target.value || null)}
                  aria-label={slot}
                >
                  <option value="">{t('gridImport.slot_empty')}</option>
                  {detectedByRole[role].map((id) => (
                    <option key={id} value={id}>{jobName(id)}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
```

注: `roles.tank`/`roles.healer`/`roles.dps` は既存(ja.json:419-422 ほか4言語 parity 済み)。`SlotRole` は既に partyAssignment から import 済み。

- [ ] **Step 8: step===3 のとき PartyAssignmentStep を描画**

step2 ブロック `{step === 2 && (...)}` の直後に追加:

```tsx
          {/* ── Step 3: パーティ割当 ── */}
          {step === 3 && (
            <PartyAssignmentStep
              assignment={assignment}
              detectedByRole={detectedByRole}
              jobs={jobs}
              onSlotChange={handleSlotChange}
              gridLang={gridLang}
            />
          )}
```

- [ ] **Step 9: フッターを3ステップ分岐に書き換え**

`blockMsg` の算出条件(`step !== 2 ? null : ...`)を「matrix は step3、grid は step2 で評価」へ変更:

```ts
  // 作成ブロック表示面: grid=step2 / matrix=step3。
  const showCreateBlock = (step === 2 && isGrid) || step === 3;
  const blockMsg: { text: string; tone: 'red' | 'amber' } | null =
    !showCreateBlock
      ? null
      : hasNoTimeCol
        ? { text: t('gridImport.no_time_warning'), tone: 'amber' }
        : blockReason === 'party_incomplete'
          ? hasUnassignedMemberCols
            ? { text: t('gridImport.slot_unassigned_warning'), tone: 'amber' }
            : { text: t('gridImport.party_incomplete_warning'), tone: 'red' }
          : blockReason === 'no_phases' && source !== 'none'
            ? { text: t('gridImport.no_phases_warning'), tone: 'amber' }
            : null;
```

フッター JSX(`{/* フッター */}` の `<div className="px-5 py-3 ...">` 配下)を以下のロジックに置換。左ボタン=ステップ別の戻る/キャンセル+クリア、右=ステップ別の次へ/作成:

```tsx
          {/* フッター */}
          <div className="px-5 py-3 border-t border-app-border bg-app-surface2 flex flex-col gap-1.5 shrink-0">
            <div className="flex items-center justify-between gap-3">
              {/* 左: 戻る/キャンセル + クリア */}
              <div className="flex items-center gap-2">
                {step === 1 ? (
                  <button
                    onClick={onClose}
                    className="px-4 py-2 rounded-lg text-app-2xl font-bold text-app-text border border-transparent hover:bg-app-toggle hover:text-app-toggle-text transition-all duration-200"
                  >
                    {t('common.cancel')}
                  </button>
                ) : (
                  <button
                    onClick={() => setStep((s) => (s === 3 ? 2 : 1) as WizardStep)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-app-2xl font-bold text-app-text border border-app-border hover:bg-app-toggle hover:text-app-toggle-text transition-all duration-200"
                  >
                    <ArrowLeft size={16} /> {t('gridImport.back')}
                  </button>
                )}
                {/* クリア(やり直す): step2/3 で表示。貼った内容を全消去 */}
                {step !== 1 && (entries.length > 0 || source !== 'none') && (
                  <button
                    onClick={() => { resetAll(); setStep(2); }}
                    className="px-3 py-2 rounded-lg text-app-lg font-bold text-app-text-muted border border-transparent hover:bg-app-toggle hover:text-app-toggle-text transition-all duration-200"
                  >
                    {t('gridImport.clear')}
                  </button>
                )}
              </div>

              {/* 右: ステップ別の主アクション */}
              {step === 1 ? (
                <button
                  onClick={() => setStep(2)}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg text-app-2xl font-bold bg-app-toggle text-app-toggle-text hover:opacity-80 transition-all duration-200"
                >
                  {t('gridImport.next')} <ArrowRight size={16} />
                </button>
              ) : step === 2 && !isGrid ? (
                // matrix: 次へ(割当へ)。何も無ければ無効。
                <button
                  onClick={goToParty}
                  disabled={source === 'none' && entries.length === 0}
                  className={clsx('flex items-center gap-2 px-5 py-2 rounded-lg text-app-2xl font-bold',
                    (source === 'none' && entries.length === 0)
                      ? 'bg-app-surface2 text-app-text-muted cursor-not-allowed'
                      : 'bg-app-toggle text-app-toggle-text hover:opacity-80 transition-all duration-200')}
                >
                  {t('gridImport.next_to_party')} <ArrowRight size={16} />
                </button>
              ) : (
                // grid(step2) / matrix(step3): 作成ブロック
                <div className="flex items-center gap-3 flex-wrap justify-end">
                  {blockMsg ? (
                    <span className={clsx('flex items-center gap-1.5 text-app-2xl',
                      blockMsg.tone === 'red' ? 'text-app-red' : 'text-app-amber')}>
                      <AlertCircle size={14} className="shrink-0" /> {blockMsg.text}
                    </span>
                  ) : (
                    <span className="text-app-2xl text-app-text-muted">
                      {preview && t('gridImport.summary', { labels: preview.labels.length, events: preview.timelineEvents.length, mits: preview.timelineMitigations.length })}
                    </span>
                  )}
                  {skipped.length > 0 && (
                    <span className="text-app-2xl text-app-amber">
                      {t('gridImport.skipped_count', { count: skipped.length })}
                    </span>
                  )}
                  <button
                    onClick={handleConfirm}
                    disabled={!canConfirm}
                    className={clsx('flex items-center gap-2 px-5 py-2 rounded-lg text-app-2xl font-bold',
                      canConfirm ? 'bg-app-toggle text-app-toggle-text' : 'bg-app-surface2 text-app-text-muted cursor-not-allowed')}
                  >
                    <CheckCircle2 size={16} /> {t('gridImport.create')}
                  </button>
                </div>
              )}
            </div>
            {/* 補足(読めない技の説明=skipped時)+ 権利表記。作成ブロック表示時のみ。 */}
            {showCreateBlock && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-app-sm text-app-amber/80 truncate">
                  {skipped.length > 0 ? t('gridImport.unresolved_note') : ''}
                </span>
                <p className="text-app-sm text-app-text-muted/60 shrink-0">{t('gridImport.rights_notice')}</p>
              </div>
            )}
          </div>
```

注: 旧フッターの `{step === 2 && (...)}`(補足行)は上の `{showCreateBlock && (...)}` に置換済み。`blockMsg` 内で参照する `hasNoTimeCol`/`hasUnassignedMemberCols`/`isGrid`/`canConfirm`/`preview`/`skipped` は既存変数(変更不要)。

- [ ] **Step 10: 未使用 import / 変数の掃除**

`autoFillSingles` がモーダル内で未参照になっていれば import から削除(`handleSlotChange` がまだ使う場合は残す)。`handleAddPhase` の旧定義を削除済みであることを確認。`pruneAssignment` のモーダル直接利用が無くなっていれば import から外す。

Run: `rtk tsc`(または下記 build)で未使用エラーを検出([[feedback_vercel_tsc_strict]])。

- [ ] **Step 11: ビルド + 全テスト**

```bash
npm run build
npm run test
```
Expected: build EXIT 0(tsc -b + api + vite 緑) / vitest 緑。

- [ ] **Step 12: コミット**

```bash
rtk git add src/components/SpreadsheetGridImportModal.tsx
rtk git commit -m "feat(import): 有名スプシ取込を3ステップ化(パーティ割当を独立ステップ+自動仮割当+クリア)"
```

- [ ] **Step 13: 実機(PC)E2E — エンドユーザー視点で1回通す**

`npm run dev` で起動し、有名スプシで以下を確認([[feedback_endpoint_user_verification]]・[[reference_playwright_lopo_dev_verification]]):

1. インポート → スプレッドシートから取り込み → コンテンツ選択 → 次へ。
2. P1 を貼る → 「このフェーズを追加」→ P2…P5 を追加 → 「パーティ割当へ」。
3. ステップ3で **8枠が自動で埋まっている**(MT/ST=タンクcanonical順, H1/H2=PH/BH, D1〜D4=近接→遠隔物理→キャスター)。
4. 何も手動割当せずに「この内容で作成」→ タイムラインへ正しく取り込まれる(あなたが詰まったケースが解消)。
5. 枠を1つ入れ替え → 反映される。
6. 「戻る」でステップ2へ → データ保持。「やり直す」で全消去 → 貼り直せる。
7. (回帰)自作スプシ(grid)を貼ると、従来どおり列ヘッダーで枠割当ができ step2 から作成できる。

---

## Self-Review

**1. Spec coverage:**
- A(3ステップ化)= Task 4 Step 1,6,8,9。
- B(ステップ3の見た目)= Task 4 Step 7。
- C-1(seedAssignment シード+手動保持)= Task 2 + Task 4 Step 3。
- C-2(タンクcanonical+ヒラPH/BH)= Task 1。
- C-3(共有関数影響・テスト更新)= Task 1 Step 1,6。
- D(戻る保持/クリア)= Task 4 Step 2,9。
- E(grid 非対象・現状維持)= Task 4 Step 5(枠セレクタ grid 限定)、Step 9(grid は step2 で作成)。
- F(i18n 4言語)= Task 3 + Task 4 Step 7 注記(roles.* 確認)。
- テスト = Task 1/2 ユニット、Task 4 Step 11 build+test、Step 13 実機 E2E。
→ spec の全項目に対応タスクあり。ギャップなし。

**2. Placeholder scan:** "TBD"/"後で"等なし。全コードブロックは実コード。Task 4 Step 7 の `roles.*` 確認は条件付き追加手順を明記済み(プレースホルダではない)。

**3. Type consistency:**
- `seedAssignment(prev, detectedJobIds, jobs)` = Task 2 定義 と Task 4 Step 3 呼び出しが一致。
- `resolveImportParty(usedJobIds, jobs)` シグネチャ不変(Task 1)。
- `commitPendingDraft` / `goToParty` / `resetAll` の命名が Task 4 内で一貫。
- `PartyAssignmentStep` props(`assignment/detectedByRole/jobs/onSlotChange/gridLang`)が Step 7 定義と Step 8 呼び出しで一致。
- `WizardStep = 1|2|3` と `setStep((s) => (s === 3 ? 2 : 1) as WizardStep)` が整合。
