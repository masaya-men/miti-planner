# スプシ取込 末尾フェーズ黙殺防止 (Bug2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** スプシ取込モーダルで、貼り付け欄に未追加の内容が残っている間は「取り込んで作成」を押せなくし、末尾フェーズの黙殺(データ取りこぼし)を原理的に防ぐ。

**Architecture:** 確定可否の純粋ロジックを canConfirmImport に切り出して TDD。SpreadsheetImportModal の canConfirm をこれに置換し、未追加 draft があるときは警告表示+作成ボタン非活性。あわせてボタン/見出し文言を4言語で明確化。取込ロジック本体(buildPlanFromSheets)・パーティ・プレビューは不変。

**Tech Stack:** React 19 + TypeScript + zustand + react-i18next + vitest(vmThreads)。

## Global Constraints

- UIテキストは必ず i18n キー経由(.claude/rules/i18n.md)。4言語(ja/en/ko/zh)すべてに同じキーを追加(パリティ必須)。
- 見た目のトンマナ(白黒・既存配置)は変えない。色は機能色のみ(警告=黄)。
- push 前に npm run build (tsc -b 厳密) + vitest run 必須。未使用 import で build が落ちる。
- 設計書: docs/superpowers/specs/2026-06-23-sheet-import-no-silent-phase-drop-design.md。

---

### Task 1: canConfirmImport 純粋関数 (TDD)

**Files:**
- Create: src/lib/sheetImport/canConfirmImport.ts
- Test: src/lib/sheetImport/__tests__/canConfirmImport.test.ts

**Interfaces:**
- Produces: canConfirmImport(args: { hasPreviewEvents: boolean; partyComplete: boolean; hasPendingDraft: boolean }): boolean

- [ ] **Step 1: 失敗テストを書く** (src/lib/sheetImport/__tests__/canConfirmImport.test.ts)

import { describe, it, expect } from 'vitest';
import { canConfirmImport } from '../canConfirmImport';

4ケース:
1. 全条件OK かつ hasPendingDraft:false -> true
2. hasPendingDraft:true (他OK) -> false
3. hasPreviewEvents:false -> false
4. partyComplete:false -> false

- [ ] **Step 2: 失敗確認**
Run: npx vitest run src/lib/sheetImport/__tests__/canConfirmImport.test.ts
Expected: FAIL (canConfirmImport が無い=import エラー)

- [ ] **Step 3: 最小実装** (src/lib/sheetImport/canConfirmImport.ts)

export function canConfirmImport(args: {
  hasPreviewEvents: boolean;
  partyComplete: boolean;
  hasPendingDraft: boolean;
}): boolean {
  return args.hasPreviewEvents && args.partyComplete && !args.hasPendingDraft;
}

- [ ] **Step 4: 成功確認**
Run: npx vitest run src/lib/sheetImport/__tests__/canConfirmImport.test.ts
Expected: PASS (4 tests)

- [ ] **Step 5: コミット**
git add src/lib/sheetImport/canConfirmImport.ts src/lib/sheetImport/__tests__/canConfirmImport.test.ts
git commit -m "feat(import): canConfirmImport 純粋関数(未追加draftがある間は作成不可)"

---

### Task 2: モーダル配線 + 警告 + i18n(4言語)

**Files:**
- Modify: src/components/SpreadsheetImportModal.tsx
- Modify: src/locales/ja.json, en.json, ko.json, zh.json

**Interfaces:**
- Consumes: canConfirmImport (Task 1)

- [ ] **Step 1: i18n キーを4言語に追加/変更** (sheetImport ブロック内・既存 add_phase 近く)

add_phase の値を変更:
- ja: このフェーズを追加 (旧 次のフェーズを追加)
- en: Add this phase (旧 Add next phase)
- ko: 이 페이즈 추가 (旧 다음 페이즈 추가)
- zh: 添加此阶段 (旧 添加下一阶段)

新キー added_phases_label:
- ja 追加済みフェーズ / en Added phases / ko 추가된 페이즈 / zh 已添加阶段

新キー pending_draft_warning:
- ja: 貼り付け欄に未追加の内容があります。「このフェーズを追加」を押してください。
- en: You have pasted content that has not been added yet. Press Add this phase.
- ko: 붙여넣기 칸에 추가되지 않은 내용이 있습니다. 이 페이즈 추가 를 누르세요.
- zh: 粘贴框中有尚未添加的内容。请点击 添加此阶段。

注意: JSON 末尾カンマ厳禁。各言語で同一キーセット(パリティ)。

- [ ] **Step 2: モーダルに canConfirmImport を配線** (SpreadsheetImportModal.tsx)

import 追加:
import { canConfirmImport } from '../lib/sheetImport/canConfirmImport';

canConfirm を置換:
const hasPendingDraft = draft.trim() !== '';
const canConfirm = canConfirmImport({
  hasPreviewEvents: preview !== null && preview.timelineEvents.length > 0,
  partyComplete,
  hasPendingDraft,
});

- [ ] **Step 3: 追加済みフェーズ見出し + 未追加警告を表示**

追加済み一覧(entries.length > 0 ブロック)の先頭に見出し:
<p className="text-app-lg text-app-text-muted">{t('sheetImport.added_phases_label')}</p>

フッターの直前(スクロール内容末尾)に警告:
{hasPendingDraft && (
  <div className="flex items-start gap-2 text-app-amber bg-app-amber-dim p-3 rounded-lg border border-app-amber-border text-app-2xl">
    <AlertCircle size={16} className="shrink-0 mt-0.5" />
    <p>{t('sheetImport.pending_draft_warning')}</p>
  </div>
)}
(AlertCircle は import 済み。app-amber* トークンは既存。パース失敗エラーは app-red* を使用しているのと同系統。)

- [ ] **Step 4: build + テスト**
Run: npm run build  => tsc -b クリーン(未使用 import 無し)
Run: npx vitest run src/lib/sheetImport src/locales  => PASS (i18n パリティテストがあれば緑・新キーが4言語に揃う)

- [ ] **Step 5: コミット**
git add src/components/SpreadsheetImportModal.tsx src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
git commit -m "feat(import): 未追加の貼り付けがある間は作成不可+警告(末尾フェーズ黙殺防止)"

---

## Self-Review

- Spec coverage: 核心ルール(draft空のときだけ作成可)=Task1+Task2 Step2。警告=Task2 Step3。文言(add_phase/added_phases_label/pending_draft_warning・4言語)=Task2 Step1。canConfirmImport 切り出し+TDD=Task1。スコープ外は触れない。全要件にタスク対応あり。
- Placeholder scan: TBD/TODO 無し。
- Type consistency: canConfirmImport の引数キー(hasPreviewEvents/partyComplete/hasPendingDraft)は Task1 定義と Task2 Step2 呼び出しで一致。

## 実機検証(実装後)
通常(非collab)で: 単一フェーズを貼る->未追加警告+作成不可->このフェーズを追加->作成可。複数フェーズで末尾を貼ったまま作成不可->追加で作成可。取り込んだ結果に末尾フェーズが入る。
