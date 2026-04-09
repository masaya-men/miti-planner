# スプリングモーダルアニメーション 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 軽減アプリ内の4つのモーダルに、スプリング物理ベースの出現アニメーションを導入する

**Architecture:** 既存のframer-motion基盤を活用。各モーダルの `initial` を `scale: 0.2` に変更し、`transition` にspring設定を適用。4モーダルとも表示位置はクリック付近のままで、その場でスプリングスケールする。

**Tech Stack:** framer-motion (既存), React, TypeScript

**安全策:** 作業前にコミットを作成。問題があればrevert可能。

---

## ファイル構成

| 操作 | ファイル | 内容 |
|------|---------|------|
| Modify | `src/tokens/motionTokens.ts:4-9` | `SPRING.dialog` 追加 |
| Modify | `src/components/JobPicker.tsx:49-52` | spring初期値・トランジション変更 |
| Modify | `src/components/BoundaryEditModal.tsx:118-122` | spring初期値・トランジション変更 |
| Modify | `src/components/EventModal.tsx:472-490` | framer-motion追加、spring適用 |
| Modify | `src/components/AASettingsPopover.tsx:78-88` | framer-motion追加、spring適用 |

---

### Task 1: motionTokens.ts にspring設定追加

**Files:**
- Modify: `src/tokens/motionTokens.ts:4-9`

- [ ] **Step 1: `SPRING.dialog` を追加**

```ts
// src/tokens/motionTokens.ts の SPRING オブジェクトに追加
dialog: { type: 'spring' as const, stiffness: 380, damping: 25 },
```

既存の `default`, `gentle`, `snappy`, `bouncy` の後に追加。

- [ ] **Step 2: ビルド確認**

Run: `rtk npm run build`
Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
rtk git add src/tokens/motionTokens.ts
rtk git commit -m "feat(motion): SPRING.dialog追加（スプリングモーダル用）"
```

---

### Task 2: JobPicker にスプリングアニメーション適用

**Files:**
- Modify: `src/components/JobPicker.tsx:1,49-52`

- [ ] **Step 1: SPRING importとアニメーション値を変更**

import追加:
```ts
import { SPRING } from '../tokens/motionTokens';
```

`motion.div` のpropsを変更（L49-52）:

変更前:
```tsx
initial={{ opacity: 0, scale: 0.95, y: -10 }}
animate={{ opacity: 1, scale: 1, y: 0 }}
exit={{ opacity: 0, scale: 0.95 }}
```

変更後:
```tsx
initial={{ opacity: 0, scale: 0.2 }}
animate={{ opacity: 1, scale: 1 }}
exit={{ opacity: 0, scale: 0.95 }}
transition={{
    scale: SPRING.dialog,
    opacity: { duration: 0.2 },
}}
```

`y: -10` と `y: 0` を削除（スプリングスケールが十分なフィードバックを提供するため）。

- [ ] **Step 2: ビルド確認**

Run: `rtk npm run build`
Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
rtk git add src/components/JobPicker.tsx
rtk git commit -m "feat(animation): JobPickerにスプリング出現アニメーション適用"
```

---

### Task 3: BoundaryEditModal にスプリングアニメーション適用

**Files:**
- Modify: `src/components/BoundaryEditModal.tsx:1-6,118-122`

- [ ] **Step 1: SPRING importとアニメーション値を変更**

import追加:
```ts
import { SPRING } from '../tokens/motionTokens';
```

`motion.div` のpropsを変更（L118-122）:

変更前:
```tsx
initial={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.95, y: 10 }}
animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
exit={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.95, y: 10 }}
transition={{ duration: 0.1 }}
```

変更後:
```tsx
initial={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.2 }}
animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1 }}
exit={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.95 }}
transition={isMobile
    ? { duration: 0.3, ease: [0.32, 0.72, 0, 1] }
    : { scale: SPRING.dialog, opacity: { duration: 0.2 } }
}
```

モバイル時はボトムシートのスライドを維持。PC時のみスプリングスケール。

- [ ] **Step 2: ビルド確認**

Run: `rtk npm run build`
Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
rtk git add src/components/BoundaryEditModal.tsx
rtk git commit -m "feat(animation): BoundaryEditModalにスプリング出現アニメーション適用"
```

---

### Task 4: EventModal にframer-motion + スプリング適用

**Files:**
- Modify: `src/components/EventModal.tsx:2,18-19,477-487`

EventModalは現在framer-motionを使っていない。`motion.div` を追加する。
注意: L431に `if (!isOpen) return null` があるためexit animationは不要（コンポーネントがアンマウントされるため）。入場アニメーションのみ追加。

- [ ] **Step 1: import追加**

L2付近に追加:
```ts
import { motion } from 'framer-motion';
```

L18-19のコメントアウトされたSPRING importを有効化:
```ts
import { SPRING } from '../tokens/motionTokens';
```
（コメント行 `// SPRING は今後のアニメーション実装で使用予定` も削除）

- [ ] **Step 2: モーダル本体のdivをmotion.divに変更**

L477の `<div data-tutorial-modal ...>` を `<motion.div data-tutorial-modal ...>` に変更。
閉じタグも `</div>` → `</motion.div>` に変更。

PC時（isMobileでない場合）のアニメーション属性を追加:

```tsx
<motion.div
    data-tutorial-modal
    initial={isMobile ? undefined : { opacity: 0, scale: 0.2 }}
    animate={isMobile ? undefined : { opacity: 1, scale: 1 }}
    transition={isMobile ? undefined : {
        scale: SPRING.dialog,
        opacity: { duration: 0.2 },
    }}
    onClick={(e) => e.stopPropagation()}
    className={clsx(
        "flex flex-col overflow-hidden shadow-sm ring-1 ring-inset pointer-events-auto",
        !isMobile && "glass-tier3",
        "ring-black/[0.02] dark:ring-white/5",
        isMobile
            ? "fixed bottom-14 left-0 right-0 z-[9999] w-full max-h-[75vh] border-b-0"
            : "absolute w-[500px] rounded-2xl"
    )}
    style={isMobile ? {
        backgroundColor: 'var(--color-sheet-bg)',
        ...existing mobile styles
    } : desktopStyle}
>
```

注意: PC時の `transition-all duration-200` をclassNameから除去（framer-motionが制御するため）。

- [ ] **Step 3: ビルド確認**

Run: `rtk npm run build`
Expected: エラーなし

- [ ] **Step 4: コミット**

```bash
rtk git add src/components/EventModal.tsx
rtk git commit -m "feat(animation): EventModalにframer-motion+スプリング出現アニメーション適用"
```

---

### Task 5: AASettingsPopover にframer-motion + スプリング適用

**Files:**
- Modify: `src/components/AASettingsPopover.tsx:1-8,78-88`

AASettingsPopoverは現在framer-motionを使っていない。Tailwindの `animate-in fade-in zoom-in-95` をframer-motion springに置き換える。

- [ ] **Step 1: import追加**

```ts
import { motion } from 'framer-motion';
import { SPRING } from '../tokens/motionTokens';
```

- [ ] **Step 2: createPortal内のdivをmotion.divに変更**

L78-88の `<div ref={popoverRef} ...>` を `<motion.div ref={popoverRef} ...>` に変更。

変更前:
```tsx
<div
    ref={popoverRef}
    className={clsx(
        "fixed w-[280px] glass-tier3 rounded-lg z-[9999] overflow-hidden animate-in fade-in zoom-in-95 duration-200 shadow-sm transition-opacity",
        !isPositioned ? "opacity-0" : "opacity-100"
    )}
    style={{
        top: `${popoverPosition.top}px`,
        left: `${popoverPosition.left}px`,
    }}
>
```

変更後:
```tsx
<motion.div
    ref={popoverRef}
    initial={{ opacity: 0, scale: 0.2 }}
    animate={isPositioned ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.2 }}
    transition={{
        scale: SPRING.dialog,
        opacity: { duration: 0.2 },
    }}
    className="fixed w-[280px] glass-tier3 rounded-lg z-[9999] overflow-hidden shadow-sm"
    style={{
        top: `${popoverPosition.top}px`,
        left: `${popoverPosition.left}px`,
        transformOrigin: 'top left',
    }}
>
```

`animate-in fade-in zoom-in-95 duration-200` と `transition-opacity` をclassNameから除去（framer-motionが代替）。
`isPositioned` の制御もframer-motionの `animate` に統合。
`transformOrigin: 'top left'` でボタンの位置から展開する印象を与える。

- [ ] **Step 3: ビルド確認**

Run: `rtk npm run build`
Expected: エラーなし

- [ ] **Step 4: コミット**

```bash
rtk git add src/components/AASettingsPopover.tsx
rtk git commit -m "feat(animation): AASettingsPopoverにframer-motion+スプリング出現アニメーション適用"
```

---

### Task 6: 動作確認

- [ ] **Step 1: dev起動**

Run: `rtk npm run dev`

- [ ] **Step 2: 全モーダル手動テスト（PC）**

以下を順番に確認:
1. AA設定ポップオーバー: ツールバーのSwordアイコンクリック → ボタン下からスプリングで出現
2. ジョブピッカー: パーティメンバーのジョブアイコンクリック → クリック位置でスプリング出現
3. フェーズ/ラベル追加: +ボタンクリック → クリック位置でスプリング出現
4. イベント追加: +ボタンクリック → クリック位置でスプリング出現

確認ポイント:
- スプリングの弾み感が自然か（1回の軽いオーバーシュート）
- 閉じるときスムーズにフェードアウトするか
- モーダルの見た目（デザイン）が変わっていないか

- [ ] **Step 3: モバイル確認**

ブラウザの DevTools でモバイル表示に切り替え:
- BoundaryEditModal: ボトムシートとして下からスライドイン（変更なし）
- EventModal: ボトムシートとして表示（スプリングなし、変更なし）

- [ ] **Step 4: パラメータ微調整（必要な場合）**

stiffness/dampingが合わなければ `motionTokens.ts` の `SPRING.dialog` を調整:
- もう少し控えめにしたい → damping上げる（25→30）
- もう少し弾ませたい → damping下げる（25→20）

- [ ] **Step 5: 最終ビルド確認**

Run: `rtk npm run build`
Expected: エラーなし

- [ ] **Step 6: コミット & push**

```bash
rtk git add -A
rtk git commit -m "feat(animation): スプリングモーダルアニメーション全モーダル適用完了"
```
