# アクセントカラー導入 + モーダル・画面デザイン改善

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 白黒ベースのUIにアクセントカラー（青=OK、赤=危険、黄=警告）を導入し、7画面のデザインを統一・改善する

**Architecture:** CSS変数でアクセントカラーを定義→Tailwind configに登録→各コンポーネントのハードコードされた色をCSS変数に置換。ダーク・ライト両モード対応。

**Tech Stack:** Tailwind CSS v4 + CSS変数 + React TSX

---

## ファイル構成

| ファイル | 変更内容 |
|---------|---------|
| `src/index.css` | アクセントカラーCSS変数を追加（dark/light） |
| `tailwind.config.js` | `app.blue`, `app.red`, `app.amber` をTailwindに登録 |
| `src/components/ConfirmDialog.tsx` | red/amberハードコード → CSS変数に置換 |
| `src/components/PhaseModal.tsx` | 削除ボタンのred → CSS変数、全体デザイン改善 |
| `src/components/LoginModal.tsx` | ログアウトボタンのred → CSS変数 |
| `src/components/FFLogsImportModal.tsx` | エラー色・警告色 → CSS変数 |
| `src/components/NewPlanModal.tsx` | ボタン・警告表示の改善 |
| `src/components/SaveDialog.tsx` | ボタンスタイル統一 |
| `src/components/SharePage.tsx` | ボタンスタイル統一 |
| `src/components/PartyStatusPopover.tsx` | ロールカラー維持、ボタンスタイル統一 |

---

### Task 1: アクセントカラーCSS変数の定義

**Files:**
- Modify: `src/index.css:67-119` (dark theme), `src/index.css:121-165` (light theme)
- Modify: `src/index.css:4-29` (@theme block)
- Modify: `tailwind.config.js:9-22`

- [ ] **Step 1: index.css のダークテーマにアクセントカラー変数を追加**

`:root, .theme-dark` ブロック内（`--color-border-accent` の後）に追加:

```css
    /* アクセントカラー */
    --color-blue: #3b82f6;
    --color-blue-hover: #2563eb;
    --color-blue-dim: rgba(59, 130, 246, 0.10);
    --color-blue-border: rgba(59, 130, 246, 0.25);

    --color-red: #ef4444;
    --color-red-hover: #dc2626;
    --color-red-dim: rgba(239, 68, 68, 0.10);
    --color-red-border: rgba(239, 68, 68, 0.25);

    --color-amber: #f59e0b;
    --color-amber-hover: #d97706;
    --color-amber-dim: rgba(245, 158, 11, 0.10);
    --color-amber-border: rgba(245, 158, 11, 0.25);
```

- [ ] **Step 2: index.css のライトテーマにアクセントカラー変数を追加**

`.theme-light` ブロック内（`--color-border-accent` の後）に追加:

```css
    /* アクセントカラー */
    --color-blue: #2563eb;
    --color-blue-hover: #1d4ed8;
    --color-blue-dim: rgba(37, 99, 235, 0.08);
    --color-blue-border: rgba(37, 99, 235, 0.20);

    --color-red: #dc2626;
    --color-red-hover: #b91c1c;
    --color-red-dim: rgba(220, 38, 38, 0.08);
    --color-red-border: rgba(220, 38, 38, 0.20);

    --color-amber: #d97706;
    --color-amber-hover: #b45309;
    --color-amber-dim: rgba(217, 119, 6, 0.08);
    --color-amber-border: rgba(217, 119, 6, 0.20);
```

- [ ] **Step 3: @theme ブロックにTailwind用マッピングを追加**

`@theme` ブロック内（`--color-app-border-accent` の後）に追加:

```css
  --color-app-blue: var(--color-blue);
  --color-app-blue-hover: var(--color-blue-hover);
  --color-app-blue-dim: var(--color-blue-dim);
  --color-app-blue-border: var(--color-blue-border);

  --color-app-red: var(--color-red);
  --color-app-red-hover: var(--color-red-hover);
  --color-app-red-dim: var(--color-red-dim);
  --color-app-red-border: var(--color-red-border);

  --color-app-amber: var(--color-amber);
  --color-app-amber-hover: var(--color-amber-hover);
  --color-app-amber-dim: var(--color-amber-dim);
  --color-app-amber-border: var(--color-amber-border);
```

- [ ] **Step 4: tailwind.config.js にアクセントカラーを登録**

`app` オブジェクト内に追加:

```js
blue: 'var(--color-blue)',
'blue-hover': 'var(--color-blue-hover)',
'blue-dim': 'var(--color-blue-dim)',
'blue-border': 'var(--color-blue-border)',
red: 'var(--color-red)',
'red-hover': 'var(--color-red-hover)',
'red-dim': 'var(--color-red-dim)',
'red-border': 'var(--color-red-border)',
amber: 'var(--color-amber)',
'amber-hover': 'var(--color-amber-hover)',
'amber-dim': 'var(--color-amber-dim)',
'amber-border': 'var(--color-amber-border)',
```

- [ ] **Step 5: dev serverで変数が効いていることを確認**

Run: `npm run dev` → ブラウザで確認（既存UIが壊れていないこと）

- [ ] **Step 6: コミット**

```bash
git add src/index.css tailwind.config.js
git commit -m "feat: アクセントカラーCSS変数を定義（blue/red/amber）"
```

---

### Task 2: ConfirmDialog — 削除確認画面のアクセントカラー適用

**Files:**
- Modify: `src/components/ConfirmDialog.tsx`

- [ ] **Step 1: dangerバリアントの色をCSS変数に置換**

置換対象:
- `bg-red-500/10` → `bg-app-red-dim`
- `text-red-500` → `text-app-red`
- `bg-red-500 hover:bg-red-600` → `bg-app-red hover:bg-app-red-hover`
- `shadow-red-500/25` → `shadow-app-red/25`

- [ ] **Step 2: warningバリアントの色をCSS変数に置換**

置換対象:
- `bg-amber-500/10` → `bg-app-amber-dim`
- `text-amber-500` → `text-app-amber`
- `bg-amber-500 hover:bg-amber-600` → `bg-app-amber hover:bg-app-amber-hover`
- `shadow-amber-500/25` → `shadow-app-amber/25`

- [ ] **Step 3: ダーク・ライト両モードで確認**

- [ ] **Step 4: コミット**

```bash
git add src/components/ConfirmDialog.tsx
git commit -m "refactor: ConfirmDialogのアクセントカラーをCSS変数に統一"
```

---

### Task 3: PhaseModal — フェーズ追加モーダルの改善

**Files:**
- Modify: `src/components/PhaseModal.tsx`

- [ ] **Step 1: 削除ボタンの色をCSS変数に置換**

- `text-red-400/80` → `text-app-red`
- `hover:text-red-400` → `hover:text-app-red-hover`（もしくはそのまま）
- `hover:bg-red-500/10` → `hover:bg-app-red-dim`

- [ ] **Step 2: 確認ボタンをOK系の青に変更**

- `bg-app-text text-app-bg` → `bg-app-blue text-white hover:bg-app-blue-hover`

- [ ] **Step 3: ヘッダー背景（bg-black/40）をテーマ変数に**

- `bg-black/40` → ダーク・ライト両対応の表現に修正

- [ ] **Step 4: ダーク・ライト両モードで確認**

- [ ] **Step 5: コミット**

```bash
git add src/components/PhaseModal.tsx
git commit -m "refactor: PhaseModalのデザイン改善 + アクセントカラー適用"
```

---

### Task 4: LoginModal — ログイン画面の改善

**Files:**
- Modify: `src/components/LoginModal.tsx`

- [ ] **Step 1: ログアウトボタンの色をCSS変数に置換**

- `text-red-400` → `text-app-red`
- `border-red-400/30` → `border-app-red-border`
- `hover:bg-red-500/10` → `hover:bg-app-red-dim`
- `hover:border-red-400/50` → `hover:border-app-red`

- [ ] **Step 2: ダーク・ライト両モードで確認**

- [ ] **Step 3: コミット**

```bash
git add src/components/LoginModal.tsx
git commit -m "refactor: LoginModalのアクセントカラーをCSS変数に統一"
```

---

### Task 5: FFLogsImportModal — インポート画面の改善

**Files:**
- Modify: `src/components/FFLogsImportModal.tsx`

- [ ] **Step 1: エラー表示の色をCSS変数に置換**

- `text-rose-400` → `text-app-red`
- `bg-rose-500/10` → `bg-app-red-dim`
- `border-rose-500/20` → `border-app-red-border`

- [ ] **Step 2: 警告表示の色をCSS変数に置換**

- `bg-amber-500/10` → `bg-app-amber-dim`
- `border-amber-500/20` → `border-app-amber-border`
- `text-amber-400/80` → `text-app-amber`

- [ ] **Step 3: 取得/インポートボタンを青に変更**

- `bg-app-text text-app-bg` → `bg-app-blue text-white hover:bg-app-blue-hover`

- [ ] **Step 4: ダーク・ライト両モードで確認**

- [ ] **Step 5: コミット**

```bash
git add src/components/FFLogsImportModal.tsx
git commit -m "refactor: FFLogsImportModalのアクセントカラーをCSS変数に統一"
```

---

### Task 6: NewPlanModal — 新規プラン作成画面の改善

**Files:**
- Modify: `src/components/NewPlanModal.tsx`

- [ ] **Step 1: 作成ボタンを青に変更**

- 有効時: `bg-app-text text-app-bg` → `bg-app-blue text-white hover:bg-app-blue-hover`

- [ ] **Step 2: 警告メッセージの色をCSS変数に**

- 既存の `bg-app-text/5 border-app-text/20` を用途に応じてamberに

- [ ] **Step 3: ダーク・ライト両モードで確認**

- [ ] **Step 4: コミット**

```bash
git add src/components/NewPlanModal.tsx
git commit -m "refactor: NewPlanModalのアクセントカラー適用"
```

---

### Task 7: SaveDialog + SharePage — ボタンスタイル統一

**Files:**
- Modify: `src/components/SaveDialog.tsx`
- Modify: `src/components/SharePage.tsx`

- [ ] **Step 1: SaveDialogの保存ボタンを青に変更**

- 有効時: `bg-app-text text-app-bg` → `bg-app-blue text-white hover:bg-app-blue-hover`

- [ ] **Step 2: SharePageのコピーボタンなどを確認・必要に応じて調整**

- 青ベースのアクションボタンに統一すべきか判断

- [ ] **Step 3: ダーク・ライト両モードで確認**

- [ ] **Step 4: コミット**

```bash
git add src/components/SaveDialog.tsx src/components/SharePage.tsx
git commit -m "refactor: SaveDialog・SharePageのボタンスタイル統一"
```

---

### Task 8: PartyStatusPopover — ステータス表示の改善

**Files:**
- Modify: `src/components/PartyStatusPopover.tsx`

- [ ] **Step 1: ロールカラー（blue-500/green-500/red-300）は維持**

ロールカラーはFF14の慣例なのでCSS変数化しない。そのまま維持。

- [ ] **Step 2: ハードコードのtext-white等をテーマ変数に**

- `text-white` → `text-app-text`（該当箇所を確認して置換）

- [ ] **Step 3: ダーク・ライト両モードで確認**

- [ ] **Step 4: コミット**

```bash
git add src/components/PartyStatusPopover.tsx
git commit -m "refactor: PartyStatusPopoverのスタイル改善"
```

---

## カラー設計メモ

| 用途 | ダークモード | ライトモード |
|------|------------|------------|
| OK/進む（blue） | #3b82f6 (blue-500) | #2563eb (blue-600) |
| 削除/危険（red） | #ef4444 (red-500) | #dc2626 (red-600) |
| 警告（amber） | #f59e0b (amber-500) | #d97706 (amber-600) |
| hover | 各色の-600/-700相当 | 各色の-700/-800相当 |
| 背景dim | 各色のrgba 10% | 各色のrgba 8% |
| ボーダー | 各色のrgba 25% | 各色のrgba 20% |

ライトモードはやや暗め（-600相当）にして白背景上での視認性を確保する。
