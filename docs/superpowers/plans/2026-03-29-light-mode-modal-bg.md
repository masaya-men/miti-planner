# ライトモードのモーダル背景改善 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ライトモードでglass-tier3モーダルの背景が透明すぎる問題を、CSS変数上書き方式で修正する。ダークモードは絶対に変更しない。

**Architecture:** `.glass-modal` CSSクラスを新設し、`.theme-light .glass-modal` でglass-tier3のCSS変数をライトモード用の不透明な値に上書きする。各モーダルコンポーネントに `glass-modal` クラスを追加するだけで適用される。

**Tech Stack:** CSS変数、Tailwind CSS v4、React/TSX

---

### Task 1: CSS `.glass-modal` クラスの追加

**Files:**
- Modify: `src/index.css` (`.tooltip-invert` の直後、`.glass-tier2` の直前に追加)

- [ ] **Step 1: `.glass-modal` クラスをindex.cssに追加**

`.tooltip-invert` ブロックの後に以下を追加:

```css
/* モーダル用: ライトモードのみ不透明背景（ダークモードは変更しない） */
.theme-light .glass-modal {
  --glass-tier3-bg: rgba(255, 255, 255, 0.92);
  --glass-tier3-blur: 20px;
  --glass-tier3-border: rgba(0, 0, 0, 0.10);
  --glass-tier3-shadow: 0 12px 48px rgba(0, 0, 0, 0.12);
  --glass-tier3-inset: inset 0 1px 0 rgba(255, 255, 255, 0.8);
}
```

- [ ] **Step 2: 開発サーバーで確認**

Run: `npm run dev`
ライトモードに切り替えて、まだどのモーダルにも適用されていないことを確認。

---

### Task 2: 各モーダルに `glass-modal` クラスを追加

**Files:**
- Modify: `src/components/ConfirmDialog.tsx:42` — glass-tier3の横に追加
- Modify: `src/components/LoginModal.tsx:90` — 同上
- Modify: `src/components/ShareModal.tsx:220` — 同上
- Modify: `src/components/Sidebar.tsx:1411` — 削除確認モーダル
- Modify: `src/components/PartySettingsModal.tsx:626` — スライドオーバーパネル
- Modify: `src/components/PartyStatusPopover.tsx:192` — スライドオーバーパネル
- Modify: `src/components/FFLogsImportModal.tsx:244,390,487` — 3箇所のglass-tier3
- Modify: `src/components/NewPlanModal.tsx:238` — 作成モーダル
- Modify: `src/components/SaveDialog.tsx:64` — 保存ダイアログ
- Modify: `src/components/PhaseModal.tsx:90` — フェーズモーダル
- Modify: `src/components/JobMigrationModal.tsx:48` — ジョブ移行モーダル

各ファイルで `glass-tier3` の直後に ` glass-modal` を追加する。

- [ ] **Step 1: ConfirmDialog.tsx**
- [ ] **Step 2: LoginModal.tsx**
- [ ] **Step 3: ShareModal.tsx**
- [ ] **Step 4: Sidebar.tsx（削除確認モーダル）**
- [ ] **Step 5: PartySettingsModal.tsx**
- [ ] **Step 6: PartyStatusPopover.tsx**
- [ ] **Step 7: FFLogsImportModal.tsx（3箇所）**
- [ ] **Step 8: NewPlanModal.tsx**
- [ ] **Step 9: SaveDialog.tsx**
- [ ] **Step 10: PhaseModal.tsx**
- [ ] **Step 11: JobMigrationModal.tsx**

---

### Task 3: 視覚確認

- [ ] **Step 1: ライトモードで全モーダルを開いて背景の不透明度を確認**
- [ ] **Step 2: ダークモードで全モーダルを開いて変化がないことを確認**
- [ ] **Step 3: 必要に応じてrgba値を微調整**

---

### Task 4: ビルド確認

- [ ] **Step 1: ビルドしてbackdrop-filterが消えていないか確認**

Run: `npx vite build && grep -o "backdrop-filter" dist/assets/*.css | wc -l`
Expected: 0件でないこと

- [ ] **Step 2: コミット**
