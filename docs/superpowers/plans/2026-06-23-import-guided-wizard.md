# スプシ取込モーダル 誘導型ウィザード化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** スプレッドシート取込モーダルを 1 画面 1 ステップの「次へ/戻る」ウィザード（軽減も&ジョブ検出時=4 ステップ / それ以外=3 ステップ）に作り直し、貼り方ガイド常時表示・フェーズ名任意化・黄/赤の遷移ゲートを移植する。

**Architecture:** ウィザードの遷移判定とフェーズ名解決は純粋関数として `src/lib/sheetImport/importWizard.ts` に切り出し（codebase の `importBlockReason.ts` 等と同じ流儀でユニットテスト）、`SpreadsheetImportModal.tsx` は **既存の state / useEffect / useMemo / ハンドラを一切変えず**、表示を `step` で出し分けるだけの presentation 刷新にとどめる。i18n は 4 言語に新キーを追加。

**Tech Stack:** React 18 + TypeScript（strict / `tsc -b`）、react-i18next、framer-motion、Tailwind（`--app-*` トークン）、Vitest + @testing-library/react（happy-dom）。

## Global Constraints

- ロジック不変: parse / build / party 割当 / ブロック判定 / 初期選択復元 / assignment リセットの挙動は**一切変えない**。`SpreadsheetImportModal.tsx` の 2 つの `useEffect`（初期選択復元 dep`[isOpen]`+ref / `[detectedJobIds]` での `setAssignment(emptyAssignment())`）と全 `useMemo` は**現状のまま据え置く**（再選択巻き戻りバグの根治を維持。詳細は同ファイルの既存コメント参照）。
- i18n: UI 文字列は必ず `t()` 経由。ハードコード禁止。新キーは ja/en/ko/zh の **4 言語すべて**に追加（`.claude/rules/i18n.md`）。
- デザイン: 白黒 + 機能色のみ（青=進む/OK・黄=警告・赤=危険）。AI 風グラデ/Inter 禁止。色は `--app-*` トークン経由、glass は `glass-tier3`。既存モーダルの様式（`max-w-lg` / `max-h-[90vh]` / framer-motion 開閉）を踏襲。
- push 前ゲート: `npm run build`（tsc -b 厳密・未使用変数/型不足が罠）+ `npx vitest run` 必須（[[feedback_vercel_tsc_strict]]）。本計画では PowerShell 環境のため各コマンドは PowerShell で実行。
- 言語: コメント・ドキュメントは日本語。

---

### Task 1: ウィザード遷移・フェーズ名解決の純粋モジュール `importWizard.ts`

新規の純粋ロジックのみを切り出してユニットテストする（`SpreadsheetImportModal` は本タスクでは触らない）。

**Files:**
- Create: `src/lib/sheetImport/importWizard.ts`
- Test: `src/lib/sheetImport/__tests__/importWizard.test.ts`

**Interfaces:**
- Produces（Task 3/4 が import する）:
  - `type WizardStep = 1 | 2 | 3 | 4`
  - `wizardHasPartyStep(includeMitigations: boolean, detectedJobCount: number): boolean`
  - `wizardTotalSteps(hasPartyStep: boolean): number`
  - `wizardStepPosition(step: WizardStep, hasPartyStep: boolean): number`
  - `interface WizardGateCtx { entriesCount: number; hasPendingDraft: boolean; partyComplete: boolean }`
  - `wizardCanAdvance(step: WizardStep, ctx: WizardGateCtx): boolean`
  - `wizardNextStep(step: WizardStep, hasPartyStep: boolean): WizardStep`
  - `wizardPrevStep(step: WizardStep, hasPartyStep: boolean): WizardStep`
  - `wizardClampStep(step: WizardStep, hasPartyStep: boolean): WizardStep`
  - `resolvePhaseName(rawName: string, index0: number): string`

- [ ] **Step 1: 失敗するテストを書く**

Create `src/lib/sheetImport/__tests__/importWizard.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  wizardHasPartyStep, wizardTotalSteps, wizardStepPosition,
  wizardCanAdvance, wizardNextStep, wizardPrevStep, wizardClampStep, resolvePhaseName,
} from '../importWizard';

describe('wizardHasPartyStep', () => {
  it('軽減も かつ ジョブ検出>0 のときだけ true', () => {
    expect(wizardHasPartyStep(true, 3)).toBe(true);
    expect(wizardHasPartyStep(true, 0)).toBe(false);   // ジョブ未検出
    expect(wizardHasPartyStep(false, 3)).toBe(false);  // タイムラインだけ
  });
});

describe('wizardTotalSteps', () => {
  it('party有り=4 / 無し=3', () => {
    expect(wizardTotalSteps(true)).toBe(4);
    expect(wizardTotalSteps(false)).toBe(3);
  });
});

describe('wizardStepPosition', () => {
  it('party有りは step と位置が一致', () => {
    expect(wizardStepPosition(1, true)).toBe(1);
    expect(wizardStepPosition(4, true)).toBe(4);
  });
  it('party無しは step4 が 3番目（step3 はスキップ）', () => {
    expect(wizardStepPosition(1, false)).toBe(1);
    expect(wizardStepPosition(2, false)).toBe(2);
    expect(wizardStepPosition(4, false)).toBe(3);
  });
});

describe('wizardCanAdvance', () => {
  const ctx = (o: Partial<{ entriesCount: number; hasPendingDraft: boolean; partyComplete: boolean }>) =>
    ({ entriesCount: 0, hasPendingDraft: false, partyComplete: true, ...o });
  it('step1 は常に進める', () => {
    expect(wizardCanAdvance(1, ctx({}))).toBe(true);
  });
  it('step2 は entries>0 かつ 未追加draftなし', () => {
    expect(wizardCanAdvance(2, ctx({ entriesCount: 0 }))).toBe(false);
    expect(wizardCanAdvance(2, ctx({ entriesCount: 1, hasPendingDraft: true }))).toBe(false);
    expect(wizardCanAdvance(2, ctx({ entriesCount: 1, hasPendingDraft: false }))).toBe(true);
  });
  it('step3 は partyComplete', () => {
    expect(wizardCanAdvance(3, ctx({ partyComplete: false }))).toBe(false);
    expect(wizardCanAdvance(3, ctx({ partyComplete: true }))).toBe(true);
  });
  it('step4 は常に true（確定は canConfirm で別判定）', () => {
    expect(wizardCanAdvance(4, ctx({}))).toBe(true);
  });
});

describe('wizardNextStep', () => {
  it('1→2', () => expect(wizardNextStep(1, true)).toBe(2));
  it('2→3 (party有り)', () => expect(wizardNextStep(2, true)).toBe(3));
  it('2→4 (party無しはスキップ)', () => expect(wizardNextStep(2, false)).toBe(4));
  it('3→4', () => expect(wizardNextStep(3, true)).toBe(4));
});

describe('wizardPrevStep', () => {
  it('4→3 (party有り)', () => expect(wizardPrevStep(4, true)).toBe(3));
  it('4→2 (party無しはスキップ)', () => expect(wizardPrevStep(4, false)).toBe(2));
  it('3→2', () => expect(wizardPrevStep(3, true)).toBe(2));
  it('2→1', () => expect(wizardPrevStep(2, true)).toBe(1));
});

describe('wizardClampStep', () => {
  it('party無しなのに step3 のときだけ 4 へ', () => {
    expect(wizardClampStep(3, false)).toBe(4);
  });
  it('それ以外は据え置き', () => {
    expect(wizardClampStep(3, true)).toBe(3);
    expect(wizardClampStep(2, false)).toBe(2);
    expect(wizardClampStep(4, false)).toBe(4);
  });
});

describe('resolvePhaseName', () => {
  it('空(trim後空)なら Phase {index0+1} を実体化', () => {
    expect(resolvePhaseName('', 0)).toBe('Phase 1');
    expect(resolvePhaseName('   ', 2)).toBe('Phase 3');
  });
  it('入力があれば trim して採用', () => {
    expect(resolvePhaseName('  P1 神々の像 ', 0)).toBe('P1 神々の像');
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run（PowerShell）: `npx vitest run src/lib/sheetImport/__tests__/importWizard.test.ts`
Expected: FAIL（`Cannot find module '../importWizard'`）

- [ ] **Step 3: 最小実装**

Create `src/lib/sheetImport/importWizard.ts`:

```ts
/**
 * スプシ取込モーダル「誘導型ウィザード」の遷移判定・フェーズ名解決（純粋関数）。
 * UI から分離してユニットテストする（importBlockReason.ts と同じ流儀）。
 *
 * ステップ:
 *  1 設定 / 2 貼付ループ / 3 パーティ割当(条件付き) / 4 確認
 *  Step3 は「軽減も かつ ジョブ検出>0」のときだけ存在。満たさなければ 2→4 にスキップ。
 */
export type WizardStep = 1 | 2 | 3 | 4;

/** Step3(パーティ割当)を出すか。軽減も かつ 検出ジョブ>0。 */
export function wizardHasPartyStep(includeMitigations: boolean, detectedJobCount: number): boolean {
  return includeMitigations && detectedJobCount > 0;
}

/** 総ステップ数（party有り=4 / 無し=3）。 */
export function wizardTotalSteps(hasPartyStep: boolean): number {
  return hasPartyStep ? 4 : 3;
}

/** 論理ステップ(1..4)を進捗ドットの表示位置(1..total)へ。party無しのとき step4 は 3番目。 */
export function wizardStepPosition(step: WizardStep, hasPartyStep: boolean): number {
  if (hasPartyStep) return step;
  return step === 4 ? 3 : step;
}

export interface WizardGateCtx {
  entriesCount: number;
  hasPendingDraft: boolean;
  partyComplete: boolean;
}

/** 「次へ」を押せるか（黄/赤ゲートの移植）。step4 は確定ボタン側で canConfirm 判定するため常に true。 */
export function wizardCanAdvance(step: WizardStep, ctx: WizardGateCtx): boolean {
  switch (step) {
    case 1: return true;
    case 2: return ctx.entriesCount > 0 && !ctx.hasPendingDraft;
    case 3: return ctx.partyComplete;
    case 4: return true;
  }
}

/** 次ステップ（party無しは 2→4 スキップ）。 */
export function wizardNextStep(step: WizardStep, hasPartyStep: boolean): WizardStep {
  if (step === 1) return 2;
  if (step === 2) return hasPartyStep ? 3 : 4;
  if (step === 3) return 4;
  return 4;
}

/** 前ステップ（party無しは 4→2 スキップ）。 */
export function wizardPrevStep(step: WizardStep, hasPartyStep: boolean): WizardStep {
  if (step === 4) return hasPartyStep ? 3 : 2;
  if (step === 3) return 2;
  if (step === 2) return 1;
  return 1;
}

/** Step3 が無効化された（party無しなのに step3 に居る）場合のみ 4 へクランプ。レース対策。 */
export function wizardClampStep(step: WizardStep, hasPartyStep: boolean): WizardStep {
  if (step === 3 && !hasPartyStep) return 4;
  return step;
}

/**
 * 追加時のフェーズ名を確定する。空（trim 後空）なら `Phase {index0+1}` を実体化。
 * 理由: buildPlanFromSheets は phaseName をそのまま生成プランの phase 名に使うため、
 * 空のままだとフェーズ名が空になる（モーダル表示の `Phase N` フォールバックは表示専用）。
 * index0 = 追加時点の entries.length（0 始まり）。
 */
export function resolvePhaseName(rawName: string, index0: number): string {
  const trimmed = rawName.trim();
  return trimmed !== '' ? trimmed : `Phase ${index0 + 1}`;
}
```

- [ ] **Step 4: テストが通ることを確認**

Run（PowerShell）: `npx vitest run src/lib/sheetImport/__tests__/importWizard.test.ts`
Expected: PASS（全 describe 緑）

- [ ] **Step 5: コミット**

```bash
rtk git add src/lib/sheetImport/importWizard.ts src/lib/sheetImport/__tests__/importWizard.test.ts
rtk git commit -m "feat(import): ウィザード遷移・フェーズ名解決の純粋モジュール追加"
```

---

### Task 2: i18n 新キー追加（ja/en/ko/zh）+ パリティテスト

ウィザードの貼り方ガイド・ナビ・ステップタイトルのキーを 4 言語に追加し、既存 2 キー（`paste_label` / `phase_name_label`）を文言調整。新キー存在のパリティテストを追加。

**Files:**
- Modify: `src/locales/ja.json`（`sheetImport` 末尾 `party_role_dps` の後ろに追記、`paste_label`/`phase_name_label` を置換）
- Modify: `src/locales/en.json`（同上）
- Modify: `src/locales/ko.json`（同上）
- Modify: `src/locales/zh.json`（同上）
- Create: `src/locales/__tests__/sheet-import-wizard-i18n-parity.test.ts`

**Interfaces:**
- Produces（Task 3/4 が `t()` で参照するキー）: `howto_title` `howto_step1..4` `howto_mac_note` `wizard_next` `wizard_back` `next_to_paste` `next_to_party` `next_to_confirm` `add_more_or_next` `step_title_setup` `step_title_paste` `step_title_party` `step_title_confirm`。変更: `paste_label` `phase_name_label`。

- [ ] **Step 1: 失敗するパリティテストを書く**

Create `src/locales/__tests__/sheet-import-wizard-i18n-parity.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import ja from '../ja.json';
import en from '../en.json';
import ko from '../ko.json';
import zh from '../zh.json';

const locales: Record<string, any> = { ja, en, ko, zh };

const NEW_KEYS = [
  'howto_title', 'howto_step1', 'howto_step2', 'howto_step3', 'howto_step4', 'howto_mac_note',
  'wizard_next', 'wizard_back', 'next_to_paste', 'next_to_party', 'next_to_confirm',
  'add_more_or_next', 'step_title_setup', 'step_title_paste', 'step_title_party', 'step_title_confirm',
];

describe('sheetImport ウィザード i18n パリティ', () => {
  for (const [lang, dict] of Object.entries(locales)) {
    it(`${lang}: 新キーが全て存在`, () => {
      for (const k of NEW_KEYS) {
        expect(dict.sheetImport?.[k], `${lang}.sheetImport.${k}`).toBeTruthy();
      }
    });
    it(`${lang}: 既存キー paste_label / phase_name_label が存在`, () => {
      expect(dict.sheetImport?.paste_label).toBeTruthy();
      expect(dict.sheetImport?.phase_name_label).toBeTruthy();
    });
  }
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run（PowerShell）: `npx vitest run src/locales/__tests__/sheet-import-wizard-i18n-parity.test.ts`
Expected: FAIL（新キーが未定義で `toBeTruthy` が落ちる）

- [ ] **Step 3: ja.json を編集**

`src/locales/ja.json` の `sheetImport` 内で、既存 2 キーを置換:
- `"paste_label": "スプレッドシートを全選択(Ctrl+A)してコピーし、ここに貼り付け",` → `"paste_label": "下の枠に貼り付け（Ctrl+V）",`
- `"phase_name_label": "フェーズ名（このタブの呼び名）",` → `"phase_name_label": "フェーズ名（任意・空なら自動）",`

`sheetImport` の最後のキー `"party_role_dps": "DPS"` の行末にカンマを追加し、直後に以下を追記（`sheetImport` オブジェクトを閉じる `}` の直前）:

```json
        "party_role_dps": "DPS",
        "howto_title": "貼り方（スプレッドシート）",
        "howto_step1": "A1セルをクリック",
        "howto_step2": "Ctrl+A で全選択",
        "howto_step3": "Ctrl+C でコピー",
        "howto_step4": "下の枠に Ctrl+V",
        "howto_mac_note": "Mac は ⌘（Command）",
        "wizard_next": "次へ",
        "wizard_back": "戻る",
        "next_to_paste": "次へ（貼り付け）",
        "next_to_party": "次へ（パーティ割当）",
        "next_to_confirm": "次へ（確認）",
        "add_more_or_next": "次のフェーズがあれば同じ手順でもう1枚。無ければ次へ。",
        "step_title_setup": "設定",
        "step_title_paste": "フェーズを貼り付け",
        "step_title_party": "パーティ割当",
        "step_title_confirm": "確認して作成"
```

- [ ] **Step 4: en.json を編集**

置換:
- `"paste_label": "Select all (Ctrl+A) in your spreadsheet, copy, and paste here",` → `"paste_label": "Paste into the box below (Ctrl+V)",`
- `"phase_name_label": "Phase name (label for this tab)",` → `"phase_name_label": "Phase name (optional, auto if blank)",`

`"party_role_dps": "DPS"` の後ろにカンマ + 追記:

```json
        "party_role_dps": "DPS",
        "howto_title": "How to paste (spreadsheet)",
        "howto_step1": "Click cell A1",
        "howto_step2": "Ctrl+A to select all",
        "howto_step3": "Ctrl+C to copy",
        "howto_step4": "Ctrl+V into the box below",
        "howto_mac_note": "On Mac use ⌘ (Command)",
        "wizard_next": "Next",
        "wizard_back": "Back",
        "next_to_paste": "Next (paste)",
        "next_to_party": "Next (party)",
        "next_to_confirm": "Next (review)",
        "add_more_or_next": "Got another phase? Paste it the same way. Otherwise continue.",
        "step_title_setup": "Setup",
        "step_title_paste": "Paste phases",
        "step_title_party": "Party",
        "step_title_confirm": "Review & create"
```

- [ ] **Step 5: ko.json を編集**

置換:
- `"paste_label": "스프레드시트를 전체 선택(Ctrl+A)하여 복사한 후 여기에 붙여넣기",` → `"paste_label": "아래 칸에 붙여넣기 (Ctrl+V)",`
- `"phase_name_label": "페이즈 이름 (이 탭의 명칭)",` → `"phase_name_label": "페이즈 이름 (선택・비우면 자동)",`

`"party_role_dps": "DPS"` の後ろにカンマ + 追記:

```json
        "party_role_dps": "DPS",
        "howto_title": "붙여넣는 방법 (스프레드시트)",
        "howto_step1": "A1 셀 클릭",
        "howto_step2": "Ctrl+A 전체 선택",
        "howto_step3": "Ctrl+C 복사",
        "howto_step4": "아래 칸에 Ctrl+V",
        "howto_mac_note": "Mac은 ⌘ (Command)",
        "wizard_next": "다음",
        "wizard_back": "이전",
        "next_to_paste": "다음 (붙여넣기)",
        "next_to_party": "다음 (파티 배정)",
        "next_to_confirm": "다음 (확인)",
        "add_more_or_next": "다음 페이즈가 있으면 같은 방법으로 한 번 더. 없으면 다음으로.",
        "step_title_setup": "설정",
        "step_title_paste": "페이즈 붙여넣기",
        "step_title_party": "파티 배정",
        "step_title_confirm": "확인 후 작성"
```

- [ ] **Step 6: zh.json を編集**

置換:
- `"paste_label": "在电子表格中全选(Ctrl+A)并复制，然后粘贴到此处",` → `"paste_label": "粘贴到下方框中（Ctrl+V）",`
- `"phase_name_label": "阶段名称（此标签页的名称）",` → `"phase_name_label": "阶段名称（可选・留空自动）",`

`"party_role_dps": "DPS"` の後ろにカンマ + 追記:

```json
        "party_role_dps": "DPS",
        "howto_title": "粘贴方法（电子表格）",
        "howto_step1": "点击 A1 单元格",
        "howto_step2": "Ctrl+A 全选",
        "howto_step3": "Ctrl+C 复制",
        "howto_step4": "在下方框中 Ctrl+V",
        "howto_mac_note": "Mac 使用 ⌘（Command）",
        "wizard_next": "下一步",
        "wizard_back": "上一步",
        "next_to_paste": "下一步（粘贴）",
        "next_to_party": "下一步（小队分配）",
        "next_to_confirm": "下一步（确认）",
        "add_more_or_next": "还有下一阶段就用同样方法再粘一次，没有就继续下一步。",
        "step_title_setup": "设置",
        "step_title_paste": "粘贴阶段",
        "step_title_party": "小队分配",
        "step_title_confirm": "确认并创建"
```

- [ ] **Step 7: パリティテスト + 全テスト緑を確認**

Run（PowerShell）: `npx vitest run src/locales/__tests__/sheet-import-wizard-i18n-parity.test.ts`
Expected: PASS（4 言語 × 2 it = 8 緑）

JSON 構文崩れ検出のため型チェックも:
Run（PowerShell）: `npm run build`
Expected: tsc 成功（JSON import が壊れていればここで落ちる）

- [ ] **Step 8: コミット**

```bash
rtk git add src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json src/locales/__tests__/sheet-import-wizard-i18n-parity.test.ts
rtk git commit -m "feat(import): ウィザード用 i18n 4言語追加(貼り方ガイド/ナビ/ステップ名)"
```

---

### Task 3: `SpreadsheetImportModal` をウィザード化（presentation 刷新・挙動同一）

**state / useEffect / useMemo / 既存ハンドラは据え置き**、`step` で表示を出し分け、進捗ヘッダー + 貼り方ガイド + 戻る/次へフッターを追加する。**フェーズ名は本タスクでは「必須」のまま**（add ボタンの活性条件・`handleAddPhase` は変えない）。フェーズ名任意化は Task 4。

**Files:**
- Modify: `src/components/SpreadsheetImportModal.tsx`（全面再構成。下記 Step 3 の内容で**ファイル全体を置換**）
- Test: `src/components/__tests__/SpreadsheetImportModal.wizard.test.tsx`（Create）

**Interfaces:**
- Consumes（Task 1）: `WizardStep` `wizardHasPartyStep` `wizardTotalSteps` `wizardStepPosition` `wizardCanAdvance` `wizardNextStep` `wizardPrevStep` `wizardClampStep`（`resolvePhaseName` は Task 4 で配線）。
- Consumes（Task 2）: `sheetImport.*` の新キー。
- Produces: 変更なし（`Props` インターフェイス・`onImport` 契約は不変）。

- [ ] **Step 1: ナビゲーションのスモークテストを書く（失敗）**

framer-motion を素通しモックして AnimatePresence のアニメ非同期を排除し、ステップ遷移をテストする。`t` はキー文字列を返すモックにし、表示中ステップを判定する。

Create `src/components/__tests__/SpreadsheetImportModal.wizard.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opt?: any) => (typeof opt === 'string' ? opt : k),
    i18n: { language: 'ja' },
  }),
}));

// framer-motion を素通し（アニメの非同期 exit を排除して同期描画）
vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: any) => children,
  motion: {
    div: ({ children, initial, animate, exit, transition, ...dom }: any) => (
      <div {...dom}>{children}</div>
    ),
  },
}));

import { SpreadsheetImportModal } from '../SpreadsheetImportModal';

const defaultSelection = { contentId: null, level: null, category: null, title: '' };

function renderModal() {
  return render(
    <SpreadsheetImportModal
      isOpen
      onClose={() => {}}
      onImport={async () => true}
      defaultSelection={defaultSelection}
    />,
  );
}

describe('SpreadsheetImportModal ウィザード遷移', () => {
  it('Step1: 取込先ラベルと「次へ（貼り付け）」が出る', () => {
    renderModal();
    expect(screen.getByText('sheetImport.target_content_label')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'sheetImport.next_to_paste' })).toBeTruthy();
  });

  it('Step1→Step2: 貼り方ガイドが出て、entries 0 件なので次へは disabled', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'sheetImport.next_to_paste' }));
    expect(screen.getByText('sheetImport.howto_title')).toBeTruthy();
    // 軽減も=true だが entries 0 → 検出ジョブ 0 → party無し → 次の行先は確認
    const next = screen.getByRole('button', { name: 'sheetImport.next_to_confirm' }) as HTMLButtonElement;
    expect(next.disabled).toBe(true);
  });

  it('Step2→戻る でStep1に戻れる', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'sheetImport.next_to_paste' }));
    fireEvent.click(screen.getByRole('button', { name: 'sheetImport.wizard_back' }));
    expect(screen.getByText('sheetImport.target_content_label')).toBeTruthy();
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run（PowerShell）: `npx vitest run src/components/__tests__/SpreadsheetImportModal.wizard.test.tsx`
Expected: FAIL（現状はウィザードでなく `next_to_paste` ボタンが存在しない）

- [ ] **Step 3: `SpreadsheetImportModal.tsx` をウィザード構成へ全面置換**

`src/components/SpreadsheetImportModal.tsx` を以下で**ファイル全体を置換**する。既存の state・2 つの useEffect・全 useMemo・`handleClose`・`handleAddPhase`・`handleSlotChange`・`handleConfirm` は**現状のまま**（`handleClose` と open 復元 effect に `setStep(1)` を 1 行だけ足す）。追加要素は `step` state / `scrollRef` / クランプ effect / scroll-to-top effect / ナビハンドラ / `WizardProgress` / `HowToPasteGuide` / step 出し分け描画 / 戻る次へフッター。

```tsx
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileSpreadsheet, AlertCircle, CheckCircle2, ChevronDown, ArrowLeft, ArrowRight } from 'lucide-react';
import clsx from 'clsx';
import { useEscapeClose } from '../hooks/useEscapeClose';
import { parseMitigationSheet } from '../lib/sheetImport/parseMitigationSheet';
import { buildPlanFromSheets } from '../lib/sheetImport/buildPlanFromSheets';
import type { SheetImportResult } from '../lib/sheetImport/buildPlanFromSheets';
import type { ImportSheet } from '../lib/sheetImport/types';
import { getMitigationsFromStore, getJobsFromStore } from '../hooks/useSkillsData';
import {
  SLOTS_BY_ROLE, emptyAssignment, assignSlot,
  groupByRole, autoFillSingles, isAssignmentComplete, buildPartyOverride, isSlotRequired,
  type PartyAssignment, type PartySlot, type SlotRole,
} from '../lib/sheetImport/partyAssignment';
import { detectUsedJobIds } from '../lib/sheetImport/detectUsedJobIds';
import { importBlockReason } from '../lib/sheetImport/importBlockReason';
import {
  type WizardStep, wizardHasPartyStep, wizardTotalSteps, wizardStepPosition,
  wizardCanAdvance, wizardNextStep, wizardPrevStep, wizardClampStep,
} from '../lib/sheetImport/importWizard';
import { hasContentRegistry, getFilteredBosses, deriveContentId, resolveInitialSelection } from '../lib/contentSelection';
import type { ContentSelectionDefault } from '../lib/contentSelection';
import { CATEGORY_LABELS } from '../data/contentRegistry';
import type { ContentLevel, ContentCategory, ContentDefinition } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImport: (result: SheetImportResult, opts: { contentId: string | null }) => Promise<boolean>;
  defaultSelection: ContentSelectionDefault;
}

const LEVEL_OPTIONS: ContentLevel[] = [100, 90, 80, 70];
const CATEGORY_OPTIONS: ContentCategory[] = ['savage', 'ultimate', 'dungeon', 'raid', 'custom'];

const STEP_TITLE_KEY: Record<WizardStep, string> = {
  1: 'sheetImport.step_title_setup',
  2: 'sheetImport.step_title_paste',
  3: 'sheetImport.step_title_party',
  4: 'sheetImport.step_title_confirm',
};

/** 進捗ドット + 現在ステップ名（party無しのとき step4 は 3番目として表示）。 */
const WizardProgress: React.FC<{ step: WizardStep; hasPartyStep: boolean }> = ({ step, hasPartyStep }) => {
  const { t } = useTranslation();
  const total = wizardTotalSteps(hasPartyStep);
  const position = wizardStepPosition(step, hasPartyStep);
  return (
    <div className="px-5 py-2.5 border-b border-app-border bg-app-surface2 flex items-center gap-3 shrink-0">
      <div className="flex items-center gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={clsx(
              'h-1.5 rounded-full transition-all duration-200',
              i + 1 === position
                ? 'w-5 bg-app-text'
                : i + 1 < position
                  ? 'w-1.5 bg-app-text/60'
                  : 'w-1.5 bg-app-border',
            )}
          />
        ))}
      </div>
      <span className="text-app-lg text-app-text-muted">
        {position}/{total} · {t(STEP_TITLE_KEY[step])}
      </span>
    </div>
  );
};

/** 貼り方ガイド（常時表示・スプレッドシート手順）。 */
const HowToPasteGuide: React.FC = () => {
  const { t } = useTranslation();
  const steps = ['howto_step1', 'howto_step2', 'howto_step3', 'howto_step4'] as const;
  return (
    <div className="rounded-xl border border-app-border bg-app-text/5 p-3 space-y-2">
      <p className="text-app-lg font-bold text-app-text">{t('sheetImport.howto_title')}</p>
      <ol className="flex flex-col gap-1.5">
        {steps.map((k, i) => (
          <li key={k} className="flex items-center gap-2 text-app-2xl text-app-text">
            <span className="shrink-0 w-5 h-5 rounded-full bg-app-text/10 text-app-text text-app-lg font-bold flex items-center justify-center">
              {i + 1}
            </span>
            {t(`sheetImport.${k}`)}
          </li>
        ))}
      </ol>
      <p className="text-app-lg text-app-text-muted/70">{t('sheetImport.howto_mac_note')}</p>
    </div>
  );
};

function resetState() {
  return {
    includeMitigations: true as boolean,
    draft: '' as string,
    phaseName: '' as string,
    entries: [] as ImportSheet[],
    parseError: false as boolean,
  };
}

export const SpreadsheetImportModal: React.FC<Props> = ({ isOpen, onClose, onImport, defaultSelection }) => {
  useEscapeClose(isOpen, onClose);
  const { t, i18n } = useTranslation();

  const [includeMitigations, setIncludeMitigations] = useState(true);
  const [draft, setDraft] = useState('');
  const [phaseName, setPhaseName] = useState('');
  const [entries, setEntries] = useState<ImportSheet[]>([]);
  const [parseError, setParseError] = useState(false);
  const [assignment, setAssignment] = useState<PartyAssignment>(emptyAssignment());

  const [selLevel, setSelLevel] = useState<ContentLevel | null>(null);
  const [selCategory, setSelCategory] = useState<ContentCategory | null>(null);
  const [selBoss, setSelBoss] = useState<ContentDefinition | null>(null);
  const [selTitle, setSelTitle] = useState('');

  const [step, setStep] = useState<WizardStep>(1);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(() => {
    const s = resetState();
    setIncludeMitigations(s.includeMitigations);
    setDraft(s.draft);
    setPhaseName(s.phaseName);
    setEntries(s.entries);
    setParseError(s.parseError);
    setAssignment(emptyAssignment());
    setSelLevel(null);
    setSelCategory(null);
    setSelBoss(null);
    setSelTitle('');
    setStep(1);
    onClose();
  }, [onClose]);

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

  const jobs = useMemo(() => getJobsFromStore(), []);
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
    (id: string) => {
      const name = jobs.find((j) => j.id === id)?.name;
      if (!name) return id;
      return (name[i18n.language as keyof typeof name] ?? name.ja) || id;
    },
    [jobs, i18n.language],
  );

  useEffect(() => {
    setAssignment(emptyAssignment());
  }, [detectedJobIds]);

  // 初期選択の復元は「モーダルを開いた瞬間だけ」行う。
  // defaultSelection は Timeline の useMemo 由来で、開いている最中でも
  // 自動保存/同期(saveSilently・pullFromFirestore)が updatePlan→plans 配列を
  // 再生成すると currentPlan 参照が変わり新しい object になる。これを dep に置くと
  // ユーザーが選び直したコンテンツが操作中に初期値へ巻き戻る（再選択バグ）。
  // よって dep は [isOpen] のみとし、最新値は ref 経由で開いた瞬間に読む。
  const defaultSelectionRef = useRef(defaultSelection);
  defaultSelectionRef.current = defaultSelection;
  useEffect(() => {
    if (!isOpen) return;
    const init = resolveInitialSelection(defaultSelectionRef.current);
    setSelLevel(init.level);
    setSelCategory(init.category);
    setSelBoss(init.boss);
    setSelTitle(init.title);
    setStep(1);
  }, [isOpen]);

  const handleSlotChange = useCallback(
    (slot: PartySlot, jobId: string | null) => {
      setAssignment((prev) => autoFillSingles(assignSlot(prev, slot, jobId), detectedByRole));
    },
    [detectedByRole],
  );

  // preview は entries / includeMitigations のみに依存。draft 入力の再レンダーで
  // 重い buildPlanFromSheets を再計算しないよう memo 化（大きな貼り付け対策）。
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

  // 各フェーズチップの「軽減N件」は実際の配置数（連続TRUEを1回に畳んだ後）を出す。
  // 生の TRUE セル数だと「効果時間中ずっと TRUE」仕様で実配置数より大きく出て誤解を招くため。
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

  const lang = i18n.language === 'en' ? 'en' : 'ja';
  const filteredBosses = useMemo(() => getFilteredBosses(selLevel, selCategory), [selLevel, selCategory]);
  const selectedContentId = deriveContentId(selBoss, selCategory, selTitle);

  const partyComplete = !includeMitigations || isAssignmentComplete(assignment, detectedByRole);
  const hasPendingDraft = draft.trim() !== '';
  const blockReason = importBlockReason({
    hasPreviewEvents: preview !== null && preview.timelineEvents.length > 0,
    partyComplete,
    hasPendingDraft,
  });
  const canConfirm = blockReason === null;

  // ── ウィザード遷移 ──
  const hasPartyStep = wizardHasPartyStep(includeMitigations, detectedJobIds.length);
  const canAdvance = wizardCanAdvance(step, {
    entriesCount: entries.length,
    hasPendingDraft,
    partyComplete,
  });
  const goNext = useCallback(() => {
    setStep((s) => wizardNextStep(s, wizardHasPartyStep(includeMitigations, detectedJobIds.length)));
  }, [includeMitigations, detectedJobIds.length]);
  const goBack = useCallback(() => {
    setStep((s) => wizardPrevStep(s, wizardHasPartyStep(includeMitigations, detectedJobIds.length)));
  }, [includeMitigations, detectedJobIds.length]);

  // Step3 が消えるレース対策（party無しなのに step3 → 4 へクランプ）。
  useEffect(() => {
    setStep((s) => wizardClampStep(s, hasPartyStep));
  }, [hasPartyStep]);

  // ステップ移動時は本文先頭へスクロール（happy-dom 等 scrollTo 未実装環境を考慮し optional call）。
  useEffect(() => {
    scrollRef.current?.scrollTo?.({ top: 0 });
  }, [step]);

  const nextLabelKey =
    step === 1
      ? 'sheetImport.next_to_paste'
      : step === 2
        ? hasPartyStep
          ? 'sheetImport.next_to_party'
          : 'sheetImport.next_to_confirm'
        : 'sheetImport.next_to_confirm';

  const handleConfirm = useCallback(async () => {
    if (entries.length === 0) return;
    const partyOverride = includeMitigations ? buildPartyOverride(assignment) : undefined;
    const result = buildPlanFromSheets(
      entries,
      { mitigations: getMitigationsFromStore(), jobs: getJobsFromStore() },
      { includeMitigations, partyOverride },
    );
    const committed = await onImport(result, { contentId: selectedContentId });
    if (committed) handleClose();
  }, [entries, includeMitigations, assignment, onImport, handleClose, selectedContentId]);

  if (!isOpen) return null;

  const modalContent = (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center p-4"
        onClick={handleClose}
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative z-[201] w-full max-w-lg glass-tier3 shadow-sm rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
          style={{ '--glass-tier3-bg': 'var(--share-modal-bg)' } as React.CSSProperties}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-app-border bg-app-surface2 flex items-center justify-between shrink-0">
            <h2 className="text-app-3xl font-bold text-app-text flex items-center gap-2">
              <FileSpreadsheet size={18} className="text-app-text" />
              {t('sheetImport.title')}
            </h2>
            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg text-app-text border border-transparent hover:bg-app-toggle hover:text-app-toggle-text hover:border-app-toggle transition-all duration-200 cursor-pointer active:scale-90"
            >
              <X size={18} />
            </button>
          </div>

          {/* Progress */}
          <WizardProgress step={step} hasPartyStep={hasPartyStep} />

          {/* Scrollable Content（step 出し分け） */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.15 }}
                className="p-5 space-y-5"
              >
                {/* ── Step 1: 設定（取込先 + モード） ── */}
                {step === 1 && (
                  <>
                    {/* 取り込み先コンテンツ選択 */}
                    <div className="space-y-2">
                      <p className="text-app-lg text-app-text-muted block">
                        {t('sheetImport.target_content_label')}
                      </p>
                      {/* Level */}
                      <div className="flex gap-2 flex-wrap">
                        {LEVEL_OPTIONS.map((lv) => (
                          <button
                            key={lv}
                            type="button"
                            onClick={() => { setSelLevel(lv); setSelBoss(null); }}
                            className={clsx(
                              'px-3 py-1.5 rounded-lg text-app-2xl font-bold border transition-all duration-200 cursor-pointer active:scale-95',
                              selLevel === lv
                                ? 'border-app-text bg-app-text/5 text-app-text'
                                : 'border-app-border text-app-text-muted hover:border-app-text/40',
                            )}
                          >
                            Lv{lv}
                          </button>
                        ))}
                      </div>
                      {/* Category */}
                      <div className="flex gap-2 flex-wrap pt-1">
                        {CATEGORY_OPTIONS.map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => { setSelCategory(cat); setSelBoss(null); setSelTitle(''); }}
                            className={clsx(
                              'px-3 py-1.5 rounded-lg text-app-2xl font-bold border transition-all duration-200 cursor-pointer active:scale-95',
                              selCategory === cat
                                ? 'border-app-text bg-app-text/5 text-app-text'
                                : 'border-app-border text-app-text-muted hover:border-app-text/40',
                            )}
                          >
                            {(CATEGORY_LABELS[cat][lang] || CATEGORY_LABELS[cat].ja).toUpperCase()}
                          </button>
                        ))}
                      </div>
                      {/* Boss (零式・絶) */}
                      {hasContentRegistry(selCategory) && (
                        selLevel ? (
                          filteredBosses.length > 0 ? (
                            <div className="flex flex-col gap-1.5 max-h-[160px] overflow-y-auto custom-scrollbar pt-1">
                              {filteredBosses.map((b) => (
                                <button
                                  key={b.id}
                                  type="button"
                                  onClick={() => setSelBoss(b)}
                                  className={clsx(
                                    'w-full px-3 py-2 rounded-lg text-app-2xl font-bold border text-left transition-all duration-200 cursor-pointer active:scale-[0.98]',
                                    selBoss?.id === b.id
                                      ? 'border-app-text bg-app-text/5 text-app-text'
                                      : 'border-app-border text-app-text-muted hover:border-app-text/40',
                                  )}
                                >
                                  {b.name[lang] || b.name.ja}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <p className="text-app-lg text-app-text-muted py-2">{t('new_plan.no_matches')}</p>
                          )
                        ) : (
                          <p className="text-app-lg text-app-text-muted py-2">{t('new_plan.select_level_first')}</p>
                        )
                      )}
                      {/* 自由入力タイトル (ダンジョン/レイド/その他) */}
                      {selCategory !== null && !hasContentRegistry(selCategory) && (
                        <input
                          type="text"
                          value={selTitle}
                          onChange={(e) => setSelTitle(e.target.value)}
                          placeholder={t('new_plan.plan_name_placeholder')}
                          className="w-full bg-app-surface2 border border-app-border rounded-lg px-3 py-2 text-app-2xl text-app-text focus:outline-none focus:border-app-text placeholder:text-app-text-muted mt-1"
                          spellCheck={false}
                        />
                      )}
                    </div>

                    {/* Mode */}
                    <div className="space-y-2">
                      {(['with_mitigations', 'timeline_only'] as const).map((mode) => {
                        const checked = mode === 'with_mitigations' ? includeMitigations : !includeMitigations;
                        return (
                          <label
                            key={mode}
                            className={clsx(
                              'flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all duration-200 text-app-2xl',
                              checked
                                ? 'border-app-text bg-app-text/5 text-app-text'
                                : 'border-app-border text-app-text-muted hover:border-app-text/40',
                            )}
                          >
                            <input
                              type="radio"
                              name="sheet-import-mode"
                              checked={checked}
                              onChange={() => setIncludeMitigations(mode === 'with_mitigations')}
                              className="accent-app-text"
                            />
                            <span>
                              {mode === 'with_mitigations'
                                ? t('sheetImport.mode_with_mitigations')
                                : t('sheetImport.mode_timeline_only')}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* ── Step 2: フェーズを貼り付け（ループ） ── */}
                {step === 2 && (
                  <>
                    <HowToPasteGuide />

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
                      <textarea
                        value={draft}
                        onChange={(e) => {
                          setDraft(e.target.value);
                          if (parseError) setParseError(false);
                        }}
                        className="w-full h-40 bg-app-surface2 border border-app-border rounded-xl p-3 text-[16px] md:text-app-2xl font-mono text-app-text focus:outline-none focus:border-app-text resize-none placeholder:text-app-text-muted"
                        spellCheck={false}
                      />

                      {parseError && (
                        <div className="flex items-start gap-2 text-app-red bg-app-red-dim p-3 rounded-lg border border-app-red-border text-app-2xl">
                          <AlertCircle size={16} className="shrink-0 mt-0.5" />
                          <p>{t('sheetImport.parse_failed')}</p>
                        </div>
                      )}

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
                    </div>

                    {/* Added phases list */}
                    {entries.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-app-lg text-app-text-muted">{t('sheetImport.added_phases_label')}</p>
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
                        <p className="text-app-lg text-app-text-muted/80 pt-1">
                          {t('sheetImport.add_more_or_next')}
                        </p>
                      </div>
                    )}
                  </>
                )}

                {/* ── Step 3: パーティ割当（条件付き） ── */}
                {step === 3 && (
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
                            <div className="grid grid-cols-2 gap-2">
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
                                    <div className="relative">
                                      <select
                                        value={assignment[slot] ?? ''}
                                        onChange={(e) => handleSlotChange(slot, e.target.value || null)}
                                        className="w-full appearance-none bg-app-surface2 border border-app-border rounded-md pl-2 pr-6 py-1 text-app-2xl text-app-text focus:outline-none focus:border-app-text cursor-pointer"
                                      >
                                        <option value="">{t('sheetImport.party_slot_unassigned')}</option>
                                        {detectedByRole[role].map((jid) => (
                                          <option key={jid} value={jid}>
                                            {jobName(jid)}
                                          </option>
                                        ))}
                                      </select>
                                      <ChevronDown
                                        size={14}
                                        className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-app-text-muted"
                                      />
                                    </div>
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

                {/* ── Step 4: 確認して作成 ── */}
                {step === 4 && (
                  <>
                    {preview && (
                      <div className="space-y-3 pt-1">
                        {/* Summary */}
                        <div className="p-3 rounded-xl bg-app-text/5 border border-app-border text-app-2xl text-app-text">
                          {t('sheetImport.preview_summary', {
                            phases: preview.phases.length,
                            events: preview.timelineEvents.length,
                            mits: preview.timelineMitigations.length,
                            party: preview.party.length,
                          })}
                        </div>

                        {/* Skipped */}
                        {preview.skipped.length > 0 && (
                          <details className="rounded-lg border border-amber-500/30 overflow-hidden">
                            <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer text-app-2xl text-amber-400 bg-amber-500/5 hover:bg-amber-500/10 transition-colors select-none">
                              <ChevronDown size={14} className="shrink-0" />
                              {t('sheetImport.skipped_label', { count: preview.skipped.length })}
                            </summary>
                            <ul className="px-4 py-2 space-y-1">
                              {preview.skipped.map((s, i) => (
                                <li key={i} className="text-app-lg text-amber-400/80 font-mono">
                                  {s.job} / {s.skillName}
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </div>
                    )}

                    {/* Rights notice */}
                    <p className="text-app-lg text-app-text-muted/60">
                      {t('sheetImport.rights_notice')}
                    </p>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer（戻る/次へ/作成） */}
          <div className="px-5 py-4 border-t border-app-border bg-app-surface2 flex flex-col gap-3 shrink-0">
            {step === 2 && hasPendingDraft && (
              <div className="flex items-start gap-2 text-app-amber bg-app-amber-dim p-3 rounded-lg border border-app-amber-border text-app-2xl">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <p>{t('sheetImport.pending_draft_warning')}</p>
              </div>
            )}
            {step === 3 && !partyComplete && (
              <div className="flex items-start gap-2 text-app-red bg-app-red-dim p-3 rounded-lg border border-app-red-border text-app-2xl">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <p>{t('sheetImport.party_required_warning')}</p>
              </div>
            )}
            {step === 4 && blockReason === 'pending_draft' && (
              <div className="flex items-start gap-2 text-app-amber bg-app-amber-dim p-3 rounded-lg border border-app-amber-border text-app-2xl">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <p>{t('sheetImport.pending_draft_warning')}</p>
              </div>
            )}
            {step === 4 && blockReason === 'party_incomplete' && (
              <div className="flex items-start gap-2 text-app-red bg-app-red-dim p-3 rounded-lg border border-app-red-border text-app-2xl">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <p>{t('sheetImport.party_required_warning')}</p>
              </div>
            )}

            <div className="flex justify-between gap-3">
              {/* 左: Step1=キャンセル / それ以外=戻る */}
              {step === 1 ? (
                <button
                  onClick={handleClose}
                  className="px-4 py-2 rounded-lg text-app-2xl font-bold text-app-text border border-transparent hover:bg-app-toggle hover:text-app-toggle-text hover:border-app-toggle transition-all duration-200 cursor-pointer active:scale-95"
                >
                  {t('common.cancel')}
                </button>
              ) : (
                <button
                  onClick={goBack}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-app-2xl font-bold text-app-text border border-app-border hover:bg-app-toggle hover:text-app-toggle-text hover:border-app-toggle transition-all duration-200 cursor-pointer active:scale-95"
                >
                  <ArrowLeft size={16} />
                  {t('sheetImport.wizard_back')}
                </button>
              )}

              {/* 右: Step1-3=次へ / Step4=作成 */}
              {step < 4 ? (
                <button
                  onClick={goNext}
                  disabled={!canAdvance}
                  className={clsx(
                    'flex items-center gap-2 px-5 py-2 rounded-lg text-app-2xl font-bold transition-all duration-300',
                    canAdvance
                      ? 'bg-app-toggle text-app-toggle-text hover:opacity-80 cursor-pointer active:scale-95'
                      : 'bg-app-surface2 text-app-text-muted cursor-not-allowed',
                  )}
                >
                  {t(nextLabelKey)}
                  <ArrowRight size={16} />
                </button>
              ) : (
                <button
                  onClick={handleConfirm}
                  disabled={!canConfirm}
                  className={clsx(
                    'flex items-center gap-2 px-5 py-2 rounded-lg text-app-2xl font-bold uppercase transition-all duration-300',
                    canConfirm
                      ? 'bg-app-toggle text-app-toggle-text hover:opacity-80 cursor-pointer active:scale-95'
                      : 'bg-app-surface2 text-app-text-muted cursor-not-allowed',
                  )}
                >
                  <CheckCircle2 size={16} />
                  {t('sheetImport.confirm')}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
};
```

- [ ] **Step 4: スモークテストが通ることを確認**

Run（PowerShell）: `npx vitest run src/components/__tests__/SpreadsheetImportModal.wizard.test.tsx`
Expected: PASS（3 it 緑）

- [ ] **Step 5: 型チェック + 全テスト緑を確認**

Run（PowerShell）: `npm run build`
Expected: tsc 成功（未使用 import なし。`ArrowLeft`/`ArrowRight`/`wizard*` を使用、`buildPlanFromSheets`/`importBlockReason` 等は据え置きで使用）

Run（PowerShell）: `npx vitest run`
Expected: 既存テストの緑数が維持（既知 failure=`TopBar.test.tsx` 4件 + `HousingWorkspace.test.tsx` 1件は本変更と無関係・許容）。新規 importWizard / i18n パリティ / wizard スモークが緑。

- [ ] **Step 6: コミット**

```bash
rtk git add src/components/SpreadsheetImportModal.tsx src/components/__tests__/SpreadsheetImportModal.wizard.test.tsx
rtk git commit -m "feat(import): 取込モーダルを誘導型ウィザード化(4/3ステップ・進捗/貼り方ガイド/戻る次へ)"
```

---

### Task 4: フェーズ名を任意化（空名 → `Phase N` 実体化）

唯一の挙動変更。add ボタンの活性条件を `draft.trim()` のみにし、`handleAddPhase` で `resolvePhaseName` を使って空名を `Phase N` で実体化する。これにより生成プランのフェーズ名が空にならない。

**Files:**
- Modify: `src/components/SpreadsheetImportModal.tsx`（import 追加 + `handleAddPhase` 1 行 + add ボタン 2 箇所）
- Test: `src/components/__tests__/SpreadsheetImportModal.wizard.test.tsx`（Modify: テスト 1 件追加）

**Interfaces:**
- Consumes（Task 1）: `resolvePhaseName(rawName, index0)`。

- [ ] **Step 1: 失敗するテストを追加**

`src/components/__tests__/SpreadsheetImportModal.wizard.test.tsx` の `describe` 末尾に追加:

```tsx
  it('フェーズ名任意: Step2 でフェーズ名空でも貼り付けがあれば「追加」が活性', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'sheetImport.next_to_paste' }));
    const addBtn = screen.getByRole('button', { name: 'sheetImport.add_phase' }) as HTMLButtonElement;
    // 貼り付け空 → disabled
    expect(addBtn.disabled).toBe(true);
    // textarea に何か入力（フェーズ名は空のまま）→ 活性化（= 名前任意）
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'A1\tB1' } });
    expect(addBtn.disabled).toBe(false);
  });
```

- [ ] **Step 2: テストが失敗することを確認**

Run（PowerShell）: `npx vitest run src/components/__tests__/SpreadsheetImportModal.wizard.test.tsx`
Expected: FAIL（現状 add ボタンは `phaseName.trim()` も要求するため、名前空では disabled のまま）

- [ ] **Step 3: import を追加**

`SpreadsheetImportModal.tsx` の importWizard import に `resolvePhaseName` を加える:

```tsx
import {
  type WizardStep, wizardHasPartyStep, wizardTotalSteps, wizardStepPosition,
  wizardCanAdvance, wizardNextStep, wizardPrevStep, wizardClampStep, resolvePhaseName,
} from '../lib/sheetImport/importWizard';
```

- [ ] **Step 4: `handleAddPhase` で空名を実体化**

`handleAddPhase` の `setEntries` 行を置換:

```tsx
    // 旧:
    // setEntries((prev) => [...prev, { parsed: result, phaseName: phaseName.trim() }]);
    // 新（空名は Phase N を実体化）:
    setEntries((prev) => [...prev, { parsed: result, phaseName: resolvePhaseName(phaseName, prev.length) }]);
```

- [ ] **Step 5: add ボタンの活性条件から名前必須を外す**

Step 2 本体の add ボタン（`disabled` と `className`）を置換:

```tsx
                      <button
                        onClick={handleAddPhase}
                        disabled={!draft.trim()}
                        className={clsx(
                          'flex items-center gap-2 px-4 py-2 rounded-lg text-app-2xl font-bold transition-all duration-200',
                          draft.trim()
                            ? 'bg-app-toggle text-app-toggle-text hover:opacity-80 cursor-pointer active:scale-95'
                            : 'bg-app-surface2 text-app-text-muted cursor-not-allowed',
                        )}
                      >
                        {t('sheetImport.add_phase')}
                      </button>
```

- [ ] **Step 6: テストが通ることを確認**

Run（PowerShell）: `npx vitest run src/components/__tests__/SpreadsheetImportModal.wizard.test.tsx`
Expected: PASS（4 it 緑）

- [ ] **Step 7: 全ゲート再実行**

Run（PowerShell）: `npm run build`
Expected: tsc 成功

Run（PowerShell）: `npx vitest run`
Expected: 新規・既存とも緑（既知 failure 5 件のみ許容）

- [ ] **Step 8: コミット**

```bash
rtk git add src/components/SpreadsheetImportModal.tsx src/components/__tests__/SpreadsheetImportModal.wizard.test.tsx
rtk git commit -m "feat(import): フェーズ名を任意化(空名はPhase Nで実体化・add活性条件をdraftのみに)"
```

---

## 実機検証（実装後・人手 / verify スキル）

push/merge の前に、エンドユーザー視点で実機 1 回通す（[[feedback_endpoint_user_verification]] / [[feedback_one_fix_one_verify]]）。スプシ取込データは破棄可（[[feedback_housing_data_disposable]]）。

- [ ] 軽減も経路: Step1 設定 → Step2 貼付（ジョブ列ありシート）→ Step3 パーティ割当 → Step4 確認 → 作成。4 ステップで迷わず完走・進捗ドット 4。
- [ ] タイムラインだけ経路: Step1 でモード=タイムラインだけ → Step2 貼付 → Step4 確認（Step3 スキップ）。3 ステップ・進捗ドット 3。
- [ ] フェーズ名空のまま追加 → 追加済みリストに `Phase 1` 表示 → 作成後タイムラインのフェーズ名が空でない。
- [ ] Step2 ゲート: 0 件で次へ disabled / 未追加 draft 残で黄 `pending_draft_warning` + 次へ disabled / 追加で活性。
- [ ] Step3 ゲート: 未割当で赤 `party_required_warning` + 次へ disabled / 完了で活性。
- [ ] 4 言語（ja/en/ko/zh）で貼り方ガイド・ナビ・ステップ名・警告が崩れず表示。
- [ ] 既存 2 バグの非再発: ①開いた瞬間の取込先プリセレクト維持 ②別コンテンツ選択が確定時に巻き戻らない（state/effect 据え置きで担保。実機で 1 回確認）。
- [ ] OK なら finishing-a-development-branch で merge + push（= 本番自動デプロイ）。TODO.md「現在の状態」更新・①完了を記録。

---

## Self-Review（spec 照合）

**spec カバレッジ**:
- §2 型A フルウィザード / 4・3 ステップ → Task 1（`wizardTotalSteps`/`wizardStepPosition`/skip）+ Task 3（step 出し分け）。✅
- §2 貼り方ガイド常時表示 → Task 3 `HowToPasteGuide`。✅
- §2/§3 フェーズ名任意・空→`Phase N` 実体化 → Task 1 `resolvePhaseName` + Task 4 配線。`buildPlanFromSheets` は `s.phaseName` 直使用（既存実装 L46・既存テスト済）なので、空名が実体化されれば生成プランのフェーズ名は非空。✅
- §3 Step1 初期選択 dep`[isOpen]`+ref 維持 → Task 3 で effect 据え置き（`setStep(1)` 追記のみ）。✅
- §3 Step2 黄ゲート（pending draft）/ 0 件 disabled → Task 1 `wizardCanAdvance` + Task 3 フッター黄表示。✅
- §3 Step3 条件表示 + 赤ゲート → Task 1 `wizardHasPartyStep`/`wizardCanAdvance` + Task 3 step3 表示 + 赤表示。✅
- §3 Step4 文字サマリ + skipped + 権利注意 + `handleConfirm` 不変 → Task 3 step4。✅
- §4 進捗ドット + ステップ名 + Esc 維持 + スクロール先頭 → Task 3 `WizardProgress` + `useEscapeClose` 据え置き + scroll-to-top effect。✅
- §5 遷移ロジック + クランプ防御 → Task 1 `wizardNextStep`/`wizardPrevStep`/`wizardClampStep` + Task 3 clamp effect。✅
- §6 i18n 4 言語新キー + `paste_label`/`phase_name_label` 変更 → Task 2。✅（ステップタイトルは番号を含めず、位置番号は `WizardProgress` が動的付与＝party skip 時の番号ズレを回避。spec §4 の「① 設定」表記より整合的に改善）
- §7 既存ロジック/hook 再利用・リファクタ・トークン/機能色・framer-motion 切替 → Task 3。✅
- §8 テスト（遷移/ゲート/名前任意/skip）→ Task 1（純粋遷移・名前解決）+ Task 2（i18n パリティ）+ Task 3/4（コンポーネントスモーク）。✅
- §9 スコープ外（③攻撃対象・②画像・途中取込）→ 本計画では扱わない。✅

**プレースホルダ走査**: TBD/TODO/「適切に」等なし。全ステップに実コードあり。✅

**型整合**: `WizardStep` は Task 1 で定義し Task 3/4 が import。`resolvePhaseName(rawName, index0)` のシグネチャは Task 1 定義 = Task 4 使用で一致。`wizardCanAdvance` の `WizardGateCtx`（entriesCount/hasPendingDraft/partyComplete）は Task 3 の呼び出しと一致。✅
