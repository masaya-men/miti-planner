# スマホUIネイティブリデザイン 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** LoPoのスマホUI全体をApple HIG準拠でリデザインし、PC版にもアニメーション改善を共通適用する

**Architecture:** デザイントークン3ファイル → カスタムフック3ファイル → 共通コンポーネント2ファイル → 既存8モバイルコンポーネント改修。トークン層を先に作り、それを参照する形で全コンポーネントを順番に改修する。

**Tech Stack:** React 19, framer-motion 12.34, Tailwind v4, i18next, CSS変数（src/index.css）

**Spec:** `docs/superpowers/specs/2026-04-08-mobile-native-redesign.md`

---

## ファイル構成

### 新規作成（8ファイル）

| ファイル | 責務 |
|---|---|
| `src/tokens/mobileTokens.ts` | モバイルUI専用のサイズ・角丸・余白トークン |
| `src/tokens/motionTokens.ts` | spring/duration/easing/scale/stagger（PC/モバイル共通） |
| `src/tokens/interactionTokens.ts` | 長押し・スワイプ・触覚フィードバック値 |
| `src/hooks/useDragAndDrop.ts` | タッチ/マウスD&Dロジック |
| `src/hooks/useSwipeAction.ts` | スワイプ削除ロジック |
| `src/hooks/useHaptic.ts` | 触覚フィードバック |
| `src/components/SegmentedControl.tsx` | iOS風Segmented Control（PC/モバイル共通） |
| `src/components/SuccessCheck.tsx` | チェックマークアニメ（PC/モバイル共通） |

### 変更（15ファイル）

| ファイル | 変更内容 |
|---|---|
| `src/index.css` | テーマCSS変数追加（シート背景、ナビ背景等） |
| `src/components/MobileHeader.tsx` | Large Title化 |
| `src/components/MobileBottomNav.tsx` | ブラー背景＋スライドインジケーター |
| `src/components/MobileFAB.tsx` | デザイン刷新＋ラベル表示 |
| `src/components/MobileBottomSheet.tsx` | iOS風角丸＋ハンドル＋springアニメ |
| `src/components/MobileContextMenu.tsx` | ポップ展開＋攻撃名ヘッダー |
| `src/components/MobilePartySettings.tsx` | D&D＋スワイプ削除 |
| `src/components/EventModal.tsx` | iOS風フォーム＋SegmentedControl |
| `src/components/MobileTimelineRow.tsx` | 長押しシュリンク |
| `src/components/MobileGuide.tsx` | チュートリアル更新 |
| `src/components/Timeline.tsx` | PC版springアニメーション |
| `src/locales/ja.json` | 新規i18nキー |
| `src/locales/en.json` | 新規i18nキー |
| `src/locales/zh.json` | 新規i18nキー |
| `src/locales/ko.json` | 新規i18nキー |

---

## Task 1: デザイントークン（3ファイル）

**Files:**
- Create: `src/tokens/mobileTokens.ts`
- Create: `src/tokens/motionTokens.ts`
- Create: `src/tokens/interactionTokens.ts`

- [ ] **Step 1: mobileTokens.ts を作成**

```typescript
// src/tokens/mobileTokens.ts
export const MOBILE_TOKENS = {
  header: {
    height: 72,
    titleSize: 26,
    logoSize: 11,
    subtitleSize: 12,
    logoLetterSpacing: '0.15em',
  },
  bottomNav: {
    height: 52,
    iconSize: 24,
    labelSize: 10,
  },
  fab: {
    size: 52,
    itemSize: 44,
    radius: 16,
  },
  sheet: {
    radius: 14,
    handleWidth: 36,
    handleHeight: 5,
    handleRadius: 3,
  },
  touchTarget: {
    min: 44,
  },
  party: {
    slotColumns: 4,
    iconSize: 32,
    jobChipColumns: 6,
    slotRadius: 14,
    jobChipRadius: 12,
  },
} as const;
```

- [ ] **Step 2: motionTokens.ts を作成**

```typescript
// src/tokens/motionTokens.ts

// framer-motion spring presets
export const SPRING = {
  default: { type: 'spring' as const, stiffness: 400, damping: 28 },
  gentle: { type: 'spring' as const, stiffness: 300, damping: 24 },
  snappy: { type: 'spring' as const, stiffness: 500, damping: 30 },
} as const;

// CSS transition durations (ms)
export const DURATION = {
  fast: 150,
  normal: 250,
  sheet: 350,
} as const;

// CSS easing curves
export const EASING = {
  sheet: 'cubic-bezier(0.32, 0.72, 0, 1)',
} as const;

// Stagger delays (ms)
export const STAGGER = {
  fab: 40,
} as const;

// Scale values
export const SCALE = {
  press: 0.96,
  drag: 1.15,
  dropTarget: 1.08,
  ctxMenu: 0.8,
  tapActive: 0.95,
} as const;
```

- [ ] **Step 3: interactionTokens.ts を作成**

```typescript
// src/tokens/interactionTokens.ts
export const INTERACTION = {
  drag: {
    holdDelay: 150,    // D&D長押し開始 (ms)
    moveThreshold: 8,  // ドラッグ判定の移動量 (px)
  },
  swipe: {
    deleteThreshold: 80,  // スワイプ削除の発火閾値 (px)
  },
  contextMenu: {
    holdDelay: 300,  // コンテキストメニュー長押し (ms)
  },
  haptic: {
    light: 10,           // 軽いフィードバック (ms)
    medium: 15,          // 中程度 (ms)
    success: [10, 30, 10] as readonly number[],  // 成功パターン
  },
} as const;
```

- [ ] **Step 4: ビルド確認**

Run: `npm run build`
Expected: 成功（未使用ファイルなのでエラーなし）

- [ ] **Step 5: コミット**

```bash
git add src/tokens/
git commit -m "feat: デザイントークン3ファイル追加（mobile/motion/interaction）"
```

---

## Task 2: カスタムフック（3ファイル）

**Files:**
- Create: `src/hooks/useHaptic.ts`
- Create: `src/hooks/useSwipeAction.ts`
- Create: `src/hooks/useDragAndDrop.ts`

- [ ] **Step 1: useHaptic.ts を作成**

```typescript
// src/hooks/useHaptic.ts
import { INTERACTION } from '../tokens/interactionTokens';

type HapticLevel = 'light' | 'medium' | 'success';

export function useHaptic() {
  const vibrate = (level: HapticLevel) => {
    if (!navigator.vibrate) return;
    const pattern = level === 'success'
      ? INTERACTION.haptic.success
      : INTERACTION.haptic[level];
    navigator.vibrate(pattern);
  };

  return { vibrate };
}
```

- [ ] **Step 2: useSwipeAction.ts を作成**

```typescript
// src/hooks/useSwipeAction.ts
import { useRef, useState, useCallback } from 'react';
import { INTERACTION } from '../tokens/interactionTokens';

interface UseSwipeActionOptions {
  threshold?: number;
  onSwipe: () => void;
}

export function useSwipeAction({ threshold, onSwipe }: UseSwipeActionOptions) {
  const startX = useRef(0);
  const [offsetX, setOffsetX] = useState(0);
  const [swiped, setSwiped] = useState(false);
  const effectiveThreshold = threshold ?? INTERACTION.swipe.deleteThreshold;

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    setSwiped(false);
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const diff = startX.current - e.touches[0].clientX;
    if (diff > 0) {
      setOffsetX(Math.min(diff, effectiveThreshold + 20));
    }
  }, [effectiveThreshold]);

  const onTouchEnd = useCallback(() => {
    if (offsetX >= effectiveThreshold) {
      setOffsetX(effectiveThreshold);
      setSwiped(true);
    } else {
      setOffsetX(0);
    }
  }, [offsetX, effectiveThreshold]);

  const reset = useCallback(() => {
    setOffsetX(0);
    setSwiped(false);
  }, []);

  const confirm = useCallback(() => {
    onSwipe();
    reset();
  }, [onSwipe, reset]);

  return {
    offsetX,
    swiped,
    handlers: { onTouchStart, onTouchMove, onTouchEnd },
    reset,
    confirm,
  };
}
```

- [ ] **Step 3: useDragAndDrop.ts を作成**

```typescript
// src/hooks/useDragAndDrop.ts
import { useRef, useState, useCallback, useEffect } from 'react';
import { INTERACTION } from '../tokens/interactionTokens';
import { useHaptic } from './useHaptic';

interface Position { x: number; y: number }

interface UseDragAndDropOptions<T> {
  holdDelay?: number;
  onDrop: (item: T, targetId: string) => void;
}

interface DragState<T> {
  isDragging: boolean;
  item: T | null;
  position: Position;
  activeTargetId: string | null;
}

export function useDragAndDrop<T>({ holdDelay, onDrop }: UseDragAndDropOptions<T>) {
  const { vibrate } = useHaptic();
  const delay = holdDelay ?? INTERACTION.drag.holdDelay;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPos = useRef<Position>({ x: 0, y: 0 });
  const [state, setState] = useState<DragState<T>>({
    isDragging: false,
    item: null,
    position: { x: 0, y: 0 },
    activeTargetId: null,
  });

  // Cleanup timer on unmount
  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const startDrag = useCallback((item: T, e: React.TouchEvent | React.MouseEvent) => {
    const pos = 'touches' in e
      ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
      : { x: e.clientX, y: e.clientY };
    startPos.current = pos;

    timerRef.current = setTimeout(() => {
      vibrate('medium');
      setState({ isDragging: true, item, position: pos, activeTargetId: null });
    }, delay);
  }, [delay, vibrate]);

  const moveDrag = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const pos = 'touches' in e
      ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
      : { x: e.clientX, y: e.clientY };

    // Cancel hold if moved too far before drag started
    if (!state.isDragging && timerRef.current) {
      const dx = pos.x - startPos.current.x;
      const dy = pos.y - startPos.current.y;
      if (Math.abs(dx) > INTERACTION.drag.moveThreshold || Math.abs(dy) > INTERACTION.drag.moveThreshold) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
        return;
      }
    }

    if (state.isDragging) {
      setState(prev => ({ ...prev, position: pos }));
    }
  }, [state.isDragging]);

  const endDrag = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (state.isDragging && state.item && state.activeTargetId) {
      vibrate('success');
      onDrop(state.item, state.activeTargetId);
    }
    setState({ isDragging: false, item: null, position: { x: 0, y: 0 }, activeTargetId: null });
  }, [state.isDragging, state.item, state.activeTargetId, onDrop, vibrate]);

  const setActiveTarget = useCallback((targetId: string | null) => {
    setState(prev => ({ ...prev, activeTargetId: targetId }));
  }, []);

  return {
    ...state,
    startDrag,
    moveDrag,
    endDrag,
    setActiveTarget,
  };
}
```

- [ ] **Step 4: ビルド確認**

Run: `npm run build`
Expected: 成功

- [ ] **Step 5: コミット**

```bash
git add src/hooks/useHaptic.ts src/hooks/useSwipeAction.ts src/hooks/useDragAndDrop.ts
git commit -m "feat: カスタムフック3つ追加（haptic/swipe/dragAndDrop）"
```

---

## Task 3: 共通コンポーネント（SegmentedControl + SuccessCheck）

**Files:**
- Create: `src/components/SegmentedControl.tsx`
- Create: `src/components/SuccessCheck.tsx`

- [ ] **Step 1: SegmentedControl.tsx を作成**

```typescript
// src/components/SegmentedControl.tsx
import { motion } from 'framer-motion';
import { SPRING } from '../tokens/motionTokens';

interface SegmentedControlProps<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const activeIndex = options.findIndex(o => o.value === value);
  const widthPercent = 100 / options.length;

  return (
    <div className="relative flex rounded-lg p-0.5 bg-[var(--app-text)]/6">
      {/* Sliding background */}
      <motion.div
        className="absolute top-0.5 bottom-0.5 rounded-[7px] bg-[var(--app-text)]/12 shadow-sm"
        initial={false}
        animate={{
          left: `calc(${widthPercent * activeIndex}% + 2px)`,
          width: `calc(${widthPercent}% - 4px)`,
        }}
        transition={SPRING.snappy}
      />
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`relative z-[1] flex-1 text-center py-2 text-app-lg font-medium transition-colors ${
            option.value === value
              ? 'text-[var(--app-text)] font-semibold'
              : 'text-[var(--app-text-muted)]'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: SuccessCheck.tsx を作成**

```typescript
// src/components/SuccessCheck.tsx
import { motion, AnimatePresence } from 'framer-motion';
import { SPRING } from '../tokens/motionTokens';
import { useHaptic } from '../hooks/useHaptic';
import { useEffect } from 'react';

interface SuccessCheckProps {
  visible: boolean;
  onComplete?: () => void;
  size?: number;
  duration?: number;
}

export function SuccessCheck({ visible, onComplete, size = 48, duration = 1500 }: SuccessCheckProps) {
  const { vibrate } = useHaptic();

  useEffect(() => {
    if (visible) {
      vibrate('success');
      if (onComplete) {
        const timer = setTimeout(onComplete, duration);
        return () => clearTimeout(timer);
      }
    }
  }, [visible, onComplete, duration, vibrate]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={SPRING.default}
          className="flex items-center justify-center rounded-full bg-green-500"
          style={{ width: size, height: size }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            style={{ width: size * 0.5, height: size * 0.5 }}
          >
            <motion.path
              d="M5 13l4 4L19 7"
              stroke="white"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.3, delay: 0.15, ease: 'easeOut' }}
            />
          </svg>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 3: ビルド確認**

Run: `npm run build`
Expected: 成功

- [ ] **Step 4: コミット**

```bash
git add src/components/SegmentedControl.tsx src/components/SuccessCheck.tsx
git commit -m "feat: SegmentedControl + SuccessCheck 共通コンポーネント追加"
```

---

## Task 4: CSS変数追加（テーマ拡張）

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: src/index.css を読んで既存テーマ変数の構造を確認**

既存の `--color-*` 変数定義箇所を特定する。

- [ ] **Step 2: ダーク/ライト両テーマにモバイル用CSS変数を追加**

既存のテーマ変数定義に追記。変数名は `--color-sheet-bg`、`--color-nav-bg`、`--color-nav-border`、`--color-overlay` 等。

ダーク:
```css
--color-sheet-bg: #1c1c1e;
--color-nav-bg: rgba(20, 20, 20, 0.85);
--color-nav-border: rgba(255, 255, 255, 0.08);
--color-overlay: rgba(0, 0, 0, 0.4);
--color-fab-bg: rgba(255, 255, 255, 0.1);
--color-fab-border: rgba(255, 255, 255, 0.15);
```

ライト:
```css
--color-sheet-bg: #ffffff;
--color-nav-bg: rgba(249, 249, 249, 0.94);
--color-nav-border: rgba(0, 0, 0, 0.12);
--color-overlay: rgba(0, 0, 0, 0.2);
--color-fab-bg: rgba(255, 255, 255, 0.9);
--color-fab-border: rgba(0, 0, 0, 0.08);
```

- [ ] **Step 3: ビルド確認**

Run: `npm run build`
Expected: 成功

- [ ] **Step 4: コミット**

```bash
git add src/index.css
git commit -m "feat: モバイルUI用テーマCSS変数追加（sheet/nav/overlay/fab）"
```

---

## Task 5: MobileBottomSheet リデザイン

**Files:**
- Modify: `src/components/MobileBottomSheet.tsx`

- [ ] **Step 1: 現在のMobileBottomSheet.tsxを読む**

131行。独自のmounted/visible管理とswipe-to-dismiss。framer-motion未使用。

- [ ] **Step 2: iOS14風ボトムシートにリデザイン**

変更点:
- 角丸14px（`MOBILE_TOKENS.sheet.radius`）
- ドラッグハンドル（36×5px）
- 背景を `var(--color-sheet-bg)` に
- framer-motionのspring.defaultでスライドイン
- スワイプダウンで閉じる（既存ロジック維持、アニメ改善）
- `MOBILE_TOKENS` と `SPRING` をimportして使用

主な変更: glass-panel/glass-tier3関連のクラスを `var(--color-sheet-bg)` + `rounded-t-[14px]` に置換。ドラッグハンドル追加。AnimatePresence + motion.div でアニメーション。

- [ ] **Step 3: ビルド確認**

Run: `npm run build`
Expected: 成功

- [ ] **Step 4: コミット**

```bash
git add src/components/MobileBottomSheet.tsx
git commit -m "feat: MobileBottomSheet iOS14風リデザイン（角丸・ハンドル・spring）"
```

---

## Task 6: MobileHeader Large Title化

**Files:**
- Modify: `src/components/MobileHeader.tsx`

- [ ] **Step 1: 現在のMobileHeader.tsxを読む**

146行。LoPo ロゴ + コンテンツ名/プラン名（タップでポップアップ）。

- [ ] **Step 2: Large Title構造にリデザイン**

変更点:
- 高さ36px → 72px（`MOBILE_TOKENS.header.height`）
- 上段: 「LOPO」小ラベル（11px, uppercase, muted）
- 中段: コンテンツ名 Large Title（26px, font-weight 800）
- 下段: プラン名＋パーティジョブ名（12px, muted）
- safe-area-inset-top維持
- 既存のポップアップ表示ロジックは削除（情報が常時表示になるため）
- `MOBILE_TOKENS` をimportして使用

- [ ] **Step 3: ビルド確認**

Run: `npm run build`
Expected: 成功

- [ ] **Step 4: コミット**

```bash
git add src/components/MobileHeader.tsx
git commit -m "feat: MobileHeader Large Title化（LoPo小ラベル・コンテンツ名大タイトル）"
```

---

## Task 7: MobileBottomNav リデザイン

**Files:**
- Modify: `src/components/MobileBottomNav.tsx`

- [ ] **Step 1: 現在のMobileBottomNav.tsxを読む**

106行。5タブ、アイコン18px、高さ48px。

- [ ] **Step 2: ブラー背景＋スライドインジケーターにリデザイン**

変更点:
- 高さ52px（`MOBILE_TOKENS.bottomNav.height`）
- アイコン24px（`MOBILE_TOKENS.bottomNav.iconSize`）
- 半透明ブラー背景: `var(--color-nav-bg)` + backdrop-filter（Tailwind v4のLightning CSS対応: `--tw-backdrop-blur` 変数パターンを使う）
- 0.5px border-top: `var(--color-nav-border)`
- アクティブタブにスライドインジケーター: motion.divでSPRING.snappy横移動
- ラベル10px、先頭のみ大文字
- safe-area-inset-bottom維持

**重要**: css-rules.mdの通り、`backdrop-filter: blur(...)` を直接書かず `--tw-backdrop-blur` 変数パターンを使うこと。

- [ ] **Step 3: ビルド確認**

Run: `npm run build`
Expected: 成功

- [ ] **Step 4: コミット**

```bash
git add src/components/MobileBottomNav.tsx
git commit -m "feat: MobileBottomNav ブラー背景＋スライドインジケーター"
```

---

## Task 8: MobileFAB リデザイン

**Files:**
- Modify: `src/components/MobileFAB.tsx`

- [ ] **Step 1: 現在のMobileFAB.tsxを読む**

311行。framer-motion使用、展開メニュー7項目、spring stagger。

- [ ] **Step 2: デザイン刷新**

変更点:
- 閉じた状態: 角丸16px（`MOBILE_TOKENS.fab.radius`）、52px（`MOBILE_TOKENS.fab.size`）
- 背景: `var(--color-fab-bg)` + border `var(--color-fab-border)`
- 展開時: メインボタン→×マーク、各44pxボタン（`MOBILE_TOKENS.fab.itemSize`）
- ラベルが各ボタンの横に表示（13px、半透明黒背景パッド）
- 区切り線でナビ系/設定系分離
- stagger: `STAGGER.fab` (40ms)
- spring: `SPRING.default`
- オーバーレイ: `var(--color-overlay)`
- 既存の同期状態表示・テーマ/言語切替ロジックは維持

- [ ] **Step 3: ビルド確認**

Run: `npm run build`
Expected: 成功

- [ ] **Step 4: コミット**

```bash
git add src/components/MobileFAB.tsx
git commit -m "feat: MobileFAB デザイン刷新（角丸・ラベル・区切り線・トークン化）"
```

---

## Task 9: MobileContextMenu リデザイン

**Files:**
- Modify: `src/components/MobileContextMenu.tsx`

- [ ] **Step 1: 現在のMobileContextMenu.tsxを読む**

212行。framer-motion使用、3選択肢（編集/追加/削除）。

- [ ] **Step 2: ポップ展開＋攻撃名ヘッダーにリデザイン**

変更点:
- シート背景: `var(--color-sheet-bg)` + `rounded-t-[14px]`
- ヘッダー追加: 攻撃名（14px, bold）+ 時間・種別（12px, muted）
- 区切り線で編集/追加と削除を分離
- 削除は赤テキスト（`text-app-red`）
- 各アイコン: 編集=青、追加=緑、削除=赤の半透明背景
- ポップ展開: initial scale `SCALE.ctxMenu` (0.8) → 1.0、`SPRING.default`
- ドラッグハンドル追加（`MOBILE_TOKENS.sheet.*`）

- [ ] **Step 3: ビルド確認**

Run: `npm run build`
Expected: 成功

- [ ] **Step 4: コミット**

```bash
git add src/components/MobileContextMenu.tsx
git commit -m "feat: MobileContextMenu ポップ展開＋攻撃名ヘッダー"
```

---

## Task 10: EventModal iOS風フォーム化

**Files:**
- Modify: `src/components/EventModal.tsx`

- [ ] **Step 1: 現在のEventModal.tsxを読む**

855行。PC/モバイル両対応。モバイル時はボトムシート形式。

- [ ] **Step 2: モバイル表示をiOS風フォームにリデザイン**

変更点（モバイル時のみ）:
- ナビバー: 左「キャンセル」(青) / 中央「イベント編集」(bold) / 右「保存」(青, bold)
- 既存の×ボタンと保存ボタンをナビバーに統合
- 種別（物理/魔法/全体）: 既存ボタン群 → `SegmentedControl` コンポーネントに置換
- 対象（全体/単体）: 既存ボタン群 → `SegmentedControl` コンポーネントに置換
- フィールドラベル: 12px, uppercase, `text-[var(--app-text-muted)]`
- 入力フィールド: 背景 `var(--app-text)/6`、角丸10px、16px font（ズーム防止）
- シート背景: `var(--color-sheet-bg)`
- PC表示は変更なし（既存動作維持）

- [ ] **Step 3: ビルド確認**

Run: `npm run build`
Expected: 成功

- [ ] **Step 4: コミット**

```bash
git add src/components/EventModal.tsx
git commit -m "feat: EventModal iOS風フォーム化（ナビバー・SegmentedControl）"
```

---

## Task 11: MobilePartySettings D&D＋スワイプ削除

**Files:**
- Modify: `src/components/MobilePartySettings.tsx`

- [ ] **Step 1: 現在のMobilePartySettings.tsxを読む**

279行。4列グリッド、タップ操作、フォーカス状態管理。

- [ ] **Step 2: ドラッグ&ドロップを追加**

変更点:
- `useDragAndDrop` フックをimport
- ジョブアイコン: `startDrag` を `onTouchStart`/`onMouseDown` にバインド
- 移動中: `moveDrag` を document-level touchmove/mousemoveで処理
- スロット: `setActiveTarget` を `onTouchMove` 位置判定で呼ぶ
- ドロップ: `endDrag` で `onTouchEnd`/`onMouseUp` 処理
- ドラッグ中のゴースト: position fixed、`SCALE.drag` (1.15)で拡大、shadow付き
- ドロップターゲット: `SCALE.dropTarget` (1.08) + 青枠
- 既に埋まっているスロットへのドロップ: ジョブ入れ替え（スワップ）
- **タップ操作は残す**: ジョブタップ→空きスロットに自動配置
- スロットのアスペクト比: 1:1（`MOBILE_TOKENS.party.*`）
- ジョブピッカー: ロール別セクション（Tank/Healer/DPS）、6列グリッド
- ドラッグヒントテキスト: i18nキー `app.party_drag_hint`

- [ ] **Step 3: スワイプ削除を追加**

- `useSwipeAction` フックをスロットに適用
- 左スワイプ → 赤い「削除」ボタン出現
- ボタンタップで確定
- `INTERACTION.swipe.deleteThreshold` (80px) で発火

- [ ] **Step 4: ビルド確認**

Run: `npm run build`
Expected: 成功

- [ ] **Step 5: コミット**

```bash
git add src/components/MobilePartySettings.tsx
git commit -m "feat: MobilePartySettings D&D＋スワイプ削除"
```

---

## Task 12: MobileTimelineRow 長押しシュリンク

**Files:**
- Modify: `src/components/MobileTimelineRow.tsx`

- [ ] **Step 1: 現在のMobileTimelineRow.tsxを読む**

350行。2行カードレイアウト。既存の長押し（300ms）でコンテキストメニュー。

- [ ] **Step 2: 長押し中のシュリンクアニメーション追加**

変更点:
- 長押し中（300ms到達前）に行がscale(0.96)に縮む → `SCALE.press`
- 指を離すとspring.defaultで元に戻る
- framer-motion の `animate` propで制御: `{ scale: isPressed ? SCALE.press : 1 }`、transition: `SPRING.default`
- 既存の `onTouchStart`/`onTouchEnd`/`onTouchMove` ロジックにisPressed state追加
- 2行カードレイアウト自体は一切変更しない

- [ ] **Step 3: ビルド確認**

Run: `npm run build`
Expected: 成功

- [ ] **Step 4: コミット**

```bash
git add src/components/MobileTimelineRow.tsx
git commit -m "feat: MobileTimelineRow 長押しシュリンクアニメーション"
```

---

## Task 13: MobileGuide チュートリアル更新

**Files:**
- Modify: `src/components/MobileGuide.tsx`

- [ ] **Step 1: 現在のMobileGuide.tsxを読む**

144行。4ステップカルーセル。

- [ ] **Step 2: チュートリアル内容をリデザイン後のUIに更新**

変更点:
- ステップ説明文をリデザイン後のUI操作に合わせて更新
- ドラッグ&ドロップの説明ステップを追加（既存4ステップに1ステップ追加）
- アニメーションをspring.defaultに統一
- 全テキストをi18nキー経由に（現在ハードコーディングされている部分があれば修正）

- [ ] **Step 3: ビルド確認**

Run: `npm run build`
Expected: 成功

- [ ] **Step 4: コミット**

```bash
git add src/components/MobileGuide.tsx
git commit -m "feat: MobileGuide チュートリアルをリデザインUIに更新"
```

---

## Task 14: PC版アニメーション共通適用

**Files:**
- Modify: `src/components/Timeline.tsx`
- Modify: `src/components/PartySettingsModal.tsx`（D&D追加）

- [ ] **Step 1: Timeline.tsxにspringアニメーション適用**

変更点:
- 行表示/非表示のアニメーションにSPRING.defaultを適用
- ボタンのactive:scale(0.95)をframer-motion `whileTap={{ scale: SCALE.tapActive }}` に

- [ ] **Step 2: PartySettingsModal.tsxにマウスD&D追加**

変更点:
- `useDragAndDrop` フックをimport
- マウス操作: `onMouseDown` → `startDrag`、`onMouseMove` → `moveDrag`、`onMouseUp` → `endDrag`
- 既存のクリック操作は維持
- ドラッグ中のゴーストUI追加（モバイルと同じスタイル）

- [ ] **Step 3: ビルド確認**

Run: `npm run build`
Expected: 成功

- [ ] **Step 4: コミット**

```bash
git add src/components/Timeline.tsx src/components/PartySettingsModal.tsx
git commit -m "feat: PC版springアニメーション＋パーティD&D共通化"
```

---

## Task 15: i18nキー追加（4言語）

**Files:**
- Modify: `src/locales/ja.json`
- Modify: `src/locales/en.json`
- Modify: `src/locales/zh.json`
- Modify: `src/locales/ko.json`

- [ ] **Step 1: 全タスクで必要なi18nキーを洗い出し、4言語に追加**

追加キー一覧:
```
app.party_drag_hint: ジョブアイコンをスロットにドラッグ / Drag job icons to slots / 将职业图标拖到槽位 / 직업 아이콘을 슬롯에 드래그
app.party_title: パーティ / Party / 队伍 / 파티
app.ctx_edit: 編集 / Edit / 编辑 / 편집
app.ctx_add_at_time: この時間にイベント追加 / Add event at this time / 在此时间添加事件 / 이 시간에 이벤트 추가
app.ctx_delete: 削除 / Delete / 删除 / 삭제
app.event_cancel: キャンセル / Cancel / 取消 / 취소
app.event_save: 保存 / Save / 保存 / 저장
app.event_edit_title: イベント編集 / Edit Event / 编辑事件 / 이벤트 편집
app.event_add_title: イベント追加 / Add Event / 添加事件 / 이벤트 추가
app.guide_step_drag: ジョブアイコンを長押ししてスロットにドラッグ / Long press job icons and drag to slots / 长按职业图标拖到槽位 / 직업 아이콘을 길게 눌러 슬롯에 드래그
app.swipe_delete: 削除 / Delete / 删除 / 삭제
```

注意: 既存のi18nキーと重複しないか確認してから追加。既に `app.fab_*` 等で定義済みのキーは再利用。

- [ ] **Step 2: ビルド確認**

Run: `npm run build`
Expected: 成功

- [ ] **Step 3: コミット**

```bash
git add src/locales/
git commit -m "feat: モバイルリデザイン用i18nキー追加（4言語）"
```

---

## Task 16: 最終ビルド＋テスト＋動作確認

**Files:** なし（確認のみ）

- [ ] **Step 1: フルビルド**

Run: `npm run build`
Expected: エラーなし

- [ ] **Step 2: テスト実行**

Run: `npx vitest run`
Expected: 116テスト全パス

- [ ] **Step 3: 目視確認チェックリスト**

モバイル（dev server + Chrome DevTools モバイルエミュレーション）:
- [ ] MobileHeader: Large Title表示、LoPo小ラベル
- [ ] MobileBottomNav: ブラー背景、スライドインジケーター
- [ ] MobileFAB: 展開メニューのラベル表示、区切り線
- [ ] MobileBottomSheet: iOS風角丸、ドラッグハンドル
- [ ] MobileContextMenu: 攻撃名ヘッダー、ポップ展開
- [ ] EventModal: ナビバー、SegmentedControl
- [ ] MobilePartySettings: D&D、スワイプ削除
- [ ] MobileTimelineRow: 長押しシュリンク
- [ ] ダーク/ライト両テーマ
- [ ] 4言語表示

PC:
- [ ] springアニメーション適用
- [ ] パーティ設定D&D
- [ ] SegmentedControl動作
- [ ] 既存機能に退行なし

- [ ] **Step 4: 最終コミット＋push**

```bash
git add -A
git commit -m "feat: スマホUIネイティブリデザイン完了"
git push
```
