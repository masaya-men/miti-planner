# チュートリアル Fキー体験割り込みステップ 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** メインチュートリアルの最後にCompletionCardを弾き飛ばすユーモラスな割り込み演出を追加し、Fキー（フォーカスモード）を体験させてから本当の完了画面を出す。

**Architecture:** 既存のステップ13（completion-card）を差し替え、fake-completion-card → focus-interrupt → completion-card(variant=real) の3ステップに分割。新規アニメーションコンポーネント1つ追加。Layout.tsx にチュートリアル用イベント連携を追加。

**Tech Stack:** React, Framer Motion, Zustand (useTutorialStore), react-i18next

---

## ファイル構成

| ファイル | 操作 | 責務 |
|---------|------|------|
| `src/data/tutorialDefinitions.ts` | 変更 | animation型拡張 + ステップ13→15に変更 |
| `src/components/tutorial/animations/FakeCompletionCard.tsx` | **新規** | 偽CompletionCard + 割り込み吹き飛ばし + Fキー案内 |
| `src/components/tutorial/animations/CompletionCard.tsx` | 変更 | variant prop追加で文言分岐 |
| `src/components/tutorial/TutorialOverlay.tsx` | 変更 | renderAnimation拡張 + ブロッカー追加 |
| `src/components/Layout.tsx` | 変更 | Fキーでtutorialイベント発火 + exit-focus対応 |
| `src/locales/ja.json` | 変更 | i18nキー追加 |
| `src/locales/en.json` | 変更 | i18nキー追加 |

---

### Task 1: i18n キー追加

**Files:**
- Modify: `src/locales/ja.json:694-735`
- Modify: `src/locales/en.json:690-731`

- [ ] **Step 1: ja.json に新キー追加**

`tutorial.main` ブロック内の `complete` の後に `focus_mode` と `real_complete` を追加:

```json
"complete": {
    "message": "チュートリアル完了！"
},
"focus_mode": {
    "message": "ちょっと待って、あと1つだけ！",
    "description": "「F」キーを押して、表だけの集中モードを体験してみよう！"
},
"real_complete": {
    "message": "今度こそチュートリアル完了！"
}
```

`tutorial.completion` ブロックの後に `completion_real` を追加:

```json
"completion_real": {
    "title": "今度こそ、本当に完了！",
    "menu_hint": "チュートリアルはいつでも「チュートリアルを見る」から見返せます。",
    "start_button": "本当にはじめる"
}
```

- [ ] **Step 2: en.json に同キー追加**

`tutorial.main` ブロック内:

```json
"complete": {
    "message": "Tutorial complete!"
},
"focus_mode": {
    "message": "Wait — one more thing!",
    "description": "Press \"F\" to try Focus Mode — it hides everything but the table!"
},
"real_complete": {
    "message": "Tutorial complete — for real this time!"
}
```

`tutorial.completion` ブロックの後:

```json
"completion_real": {
    "title": "Okay, NOW you're done!",
    "menu_hint": "You can revisit tutorials anytime from the tutorial menu.",
    "start_button": "Let's really go"
}
```

- [ ] **Step 3: ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 4: コミット**

```bash
git add src/locales/ja.json src/locales/en.json
git commit -m "feat(tutorial): add i18n keys for focus-interrupt steps"
```

---

### Task 2: tutorialDefinitions.ts — ステップ定義変更

**Files:**
- Modify: `src/data/tutorialDefinitions.ts:45,179-187`

- [ ] **Step 1: animation 型を拡張**

L45 の animation 型定義に `'fake-completion-card'` と `'focus-interrupt'` を追加:

```typescript
animation?: 'palette-hint' | 'party-auto-fill' | 'pill-fly' | 'completion-card' | 'typewriter-fill' | 'fake-completion-card' | 'focus-interrupt';
```

- [ ] **Step 2: ステップ13-15 を差し替え**

L179-187 の既存ステップ13（`main-13-complete`）を以下の3ステップに置き換え:

```typescript
    {
      id: 'main-13-fake-complete',
      target: null,
      pill: 'next',
      messageKey: 'tutorial.main.complete.message',
      completionEvent: 'tutorial:fake-dismissed',
      animation: 'fake-completion-card',
    },
    {
      id: 'main-14-focus-mode',
      target: null,
      pill: 'next',
      messageKey: 'tutorial.main.focus_mode.message',
      descriptionKey: 'tutorial.main.focus_mode.description',
      completionEvent: 'focus-mode:entered',
      animation: 'focus-interrupt',
    },
    {
      id: 'main-15-real-complete',
      target: null,
      pill: 'next',
      messageKey: 'tutorial.main.real_complete.message',
      completionEvent: 'tutorial:dismissed',
      animation: 'completion-card',
    },
```

- [ ] **Step 3: ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラーなし（新animation名はまだ未使用だが型は通る）

- [ ] **Step 4: コミット**

```bash
git add src/data/tutorialDefinitions.ts
git commit -m "feat(tutorial): add fake-completion + focus-interrupt + real-completion steps"
```

---

### Task 3: FakeCompletionCard コンポーネント新規作成

**Files:**
- Create: `src/components/tutorial/animations/FakeCompletionCard.tsx`

- [ ] **Step 1: FakeCompletionCard コンポーネントを作成**

このコンポーネントは3つのフェーズを管理:
1. **fake**: 偽CompletionCard表示（ボタン無効、~1.5秒）
2. **interrupt**: 割り込みカード登場 + CompletionCard吹き飛び → `onInterruptDone` 発火
3. **focus-wait**: 「Fキーを押して！」案内表示

```tsx
// src/components/tutorial/animations/FakeCompletionCard.tsx
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { HelpCircle, Keyboard } from 'lucide-react';

interface FakeCompletionCardProps {
  onFakeDismissed: () => void;
}

export function FakeCompletionCard({ onFakeDismissed }: FakeCompletionCardProps) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<'fake' | 'interrupt' | 'focus-wait'>('fake');

  // 1.5秒後に割り込みフェーズへ
  useEffect(() => {
    const timer = setTimeout(() => setPhase('interrupt'), 1500);
    return () => clearTimeout(timer);
  }, []);

  // 吹き飛ばしアニメーション完了後
  const handleBlowAwayComplete = useCallback(() => {
    setPhase('focus-wait');
    // focus-wait に切り替わったら fake-dismissed を発火
    // → ステップ14(focus-interrupt)に進む
    onFakeDismissed();
  }, [onFakeDismissed]);

  return (
    <div className="fixed inset-0 z-[10005] flex items-center justify-center">
      {/* 背景オーバーレイ */}
      <div className="absolute inset-0 bg-black/30" />

      <AnimatePresence>
        {/* 偽 CompletionCard */}
        {(phase === 'fake' || phase === 'interrupt') && (
          <motion.div
            key="fake-card"
            className="relative bg-app-bg border border-app-text/15 rounded-2xl p-6 max-w-sm mx-4 shadow-2xl z-10"
            initial={{ scale: 0.9, y: 20 }}
            animate={phase === 'interrupt' ? {
              // ぐにゃっと凹んで右上に飛ぶ
              scaleX: [1, 0.85, 1.1],
              scaleY: [1, 1.15, 0.9],
              rotate: [0, -5, 25],
              x: [0, -20, 600],
              y: [0, 10, -400],
              opacity: [1, 1, 0],
            } : {
              scale: 1, y: 0,
            }}
            transition={phase === 'interrupt' ? {
              duration: 0.8,
              times: [0, 0.2, 1],
              ease: 'easeInOut',
            } : {
              type: 'spring', stiffness: 300, damping: 25,
            }}
            onAnimationComplete={() => {
              if (phase === 'interrupt') handleBlowAwayComplete();
            }}
          >
            <h2 className="text-lg font-bold text-app-text text-center mb-2">
              {t('tutorial.completion.title')}
            </h2>
            <div className="space-y-3 mb-5">
              <div className="flex items-start gap-2.5 text-xs text-app-text-muted">
                <span className="mt-0.5 flex-shrink-0 text-[#22c55e]"><HelpCircle size={14} /></span>
                <span>{t('tutorial.completion.menu_hint')}</span>
              </div>
            </div>
            {/* ボタン無効 */}
            <button
              disabled
              className="w-full py-2.5 rounded-lg text-sm font-semibold opacity-50 cursor-not-allowed"
              style={{ backgroundColor: '#22c55e', color: 'white' }}
            >
              {t('tutorial.completion.start_button')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 割り込みカード（interrupt フェーズで左からスライドイン） */}
      <AnimatePresence>
        {phase === 'interrupt' && (
          <motion.div
            key="interrupt-card"
            className="absolute bg-app-bg border-2 border-[#22c55e]/50 rounded-2xl p-6 max-w-sm mx-4 shadow-2xl z-20"
            initial={{ x: -500, rotate: -10, opacity: 0 }}
            animate={{ x: 0, rotate: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.1 }}
          >
            <p className="text-lg font-black text-app-text text-center">
              {t('tutorial.main.focus_mode.message')}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 2: ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/components/tutorial/animations/FakeCompletionCard.tsx
git commit -m "feat(tutorial): add FakeCompletionCard with blow-away animation"
```

---

### Task 4: CompletionCard に variant prop 追加

**Files:**
- Modify: `src/components/tutorial/animations/CompletionCard.tsx`

- [ ] **Step 1: variant prop 追加と文言分岐**

CompletionCard コンポーネントを以下に変更:

```tsx
// src/components/tutorial/animations/CompletionCard.tsx
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { HelpCircle } from 'lucide-react';

interface CompletionCardProps {
  onDismiss: () => void;
  variant?: 'default' | 'real';
}

/**
 * チュートリアル完了画面。
 * variant='real' の場合はユーモア版の文言を使用。
 */
export function CompletionCard({ onDismiss, variant = 'default' }: CompletionCardProps) {
  const { t } = useTranslation();
  const prefix = variant === 'real' ? 'tutorial.completion_real' : 'tutorial.completion';

  return (
    <motion.div
      className="fixed inset-0 z-[10005] flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* 背景オーバーレイ */}
      <div className="absolute inset-0 bg-black/30" onClick={onDismiss} />

      {/* カード */}
      <motion.div
        className="relative bg-app-bg border border-app-text/15 rounded-2xl p-6 max-w-sm mx-4 shadow-2xl"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      >
        <h2 className="text-lg font-bold text-app-text text-center mb-2">
          {t(`${prefix}.title`)}
        </h2>

        <div className="space-y-3 mb-5">
          <FeatureHint
            icon={<HelpCircle size={14} />}
            text={t(`${prefix}.menu_hint`)}
          />
        </div>

        <button
          onClick={onDismiss}
          className="w-full py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80 cursor-pointer"
          style={{ backgroundColor: '#22c55e', color: 'white' }}
        >
          {t(`${prefix}.start_button`)}
        </button>
      </motion.div>
    </motion.div>
  );
}

function FeatureHint({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-2.5 text-xs text-app-text-muted">
      <span className="mt-0.5 flex-shrink-0 text-[#22c55e]">{icon}</span>
      <span>{text}</span>
    </div>
  );
}
```

- [ ] **Step 2: ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/components/tutorial/animations/CompletionCard.tsx
git commit -m "feat(tutorial): add variant prop to CompletionCard for real-completion"
```

---

### Task 5: TutorialOverlay.tsx — renderAnimation 拡張 + ブロッカー追加

**Files:**
- Modify: `src/components/tutorial/TutorialOverlay.tsx:1-295`

- [ ] **Step 1: import 追加**

L12 の `CompletionCard` import の後に追加:

```typescript
import { FakeCompletionCard } from './animations/FakeCompletionCard';
```

- [ ] **Step 2: renderAnimation に新しい case を追加**

`renderAnimation` 関数内の `case 'completion-card':` の前に以下を追加:

```typescript
      case 'fake-completion-card':
        return <FakeCompletionCard onFakeDismissed={() => {
          useTutorialStore.getState().completeEvent('tutorial:fake-dismissed');
        }} />;
      case 'focus-interrupt':
        return (
          <motion.div
            className="fixed inset-0 z-[10005] flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/30" />
            <motion.div
              className="relative bg-app-bg border-2 border-[#22c55e]/50 rounded-2xl p-6 max-w-sm mx-4 shadow-2xl"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              <p className="text-lg font-black text-app-text text-center mb-3">
                {t('tutorial.main.focus_mode.message')}
              </p>
              <p className="text-sm text-app-text-muted text-center mb-4">
                {t('tutorial.main.focus_mode.description')}
              </p>
              <div className="flex items-center justify-center">
                <motion.div
                  className="w-12 h-12 rounded-xl border-2 border-app-text/30 flex items-center justify-center text-xl font-black text-app-text"
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
                >
                  F
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        );
```

- [ ] **Step 3: completion-card case を変更して variant を渡す**

既存の `case 'completion-card':` を変更。ステップIDが `main-15-real-complete` なら variant='real' を渡す:

```typescript
      case 'completion-card':
        return <CompletionCard
          variant={step.id === 'main-15-real-complete' ? 'real' : 'default'}
          onDismiss={() => {
            useTutorialStore.getState().completeEvent('tutorial:dismissed');
          }}
        />;
```

- [ ] **Step 4: ブロッカー制御を更新**

L243 付近の全面ブロック条件に `'fake-completion-card'` と `'focus-interrupt'` を追加:

```typescript
      {/* 自動演出中は全面ブロック（スロット操作防止） */}
      {(step.animation === 'party-auto-fill' || step.animation === 'palette-hint' || step.animation === 'typewriter-fill' || step.animation === 'fake-completion-card' || step.animation === 'focus-interrupt') && (
        <TutorialBlocker targetRect={null} active={true} />
      )}
```

- [ ] **Step 5: カード非表示条件を更新**

L271 のカード非表示条件に `'fake-completion-card'` と `'focus-interrupt'` を追加:

```typescript
        {step.animation !== 'completion-card' && step.animation !== 'party-auto-fill' && step.animation !== 'fake-completion-card' && step.animation !== 'focus-interrupt' && (
```

- [ ] **Step 6: ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 7: コミット**

```bash
git add src/components/tutorial/TutorialOverlay.tsx
git commit -m "feat(tutorial): wire FakeCompletionCard + focus-interrupt into overlay"
```

---

### Task 6: Layout.tsx — Fキーにチュートリアルイベント発火 + exit-focus 対応

**Files:**
- Modify: `src/components/Layout.tsx:1-176`

- [ ] **Step 1: useTutorialStore import 追加**

ファイル上部の import に追加（既存 import があればスキップ）:

```typescript
import { useTutorialStore } from '../store/useTutorialStore';
```

- [ ] **Step 2: Fキーハンドラにチュートリアルイベント発火を追加**

L155-172 の `else if (key === 'f')` ブロック内、`e.preventDefault();` の直後に追加:

```typescript
            } else if (key === 'f') {
                e.preventDefault();
                // チュートリアル: focus-mode 体験ステップの完了イベント発火
                const tutState = useTutorialStore.getState();
                if (tutState.isActive) {
                    tutState.completeEvent('focus-mode:entered');
                }
                if (!focusModeRef.current) {
```

（既存の if/else ブロックはそのまま維持）

- [ ] **Step 3: shortcut:exit-focus カスタムイベント対応を追加**

L174 の `window.addEventListener('keydown', handleShortcut);` の後に、フォーカスモード解除用のカスタムイベントリスナーを追加:

```typescript
        const handleExitFocus = () => {
            if (focusModeRef.current) {
                setIsSidebarOpen(preFocusSidebarRef.current);
                localStorage.setItem('lopo_sidebar_open', String(preFocusSidebarRef.current));
                setIsHeaderCollapsed(preFocusHeaderRef.current);
                focusModeRef.current = false;
            }
        };
        window.addEventListener('keydown', handleShortcut);
        window.addEventListener('shortcut:exit-focus', handleExitFocus);
        return () => {
            window.removeEventListener('keydown', handleShortcut);
            window.removeEventListener('shortcut:exit-focus', handleExitFocus);
        };
```

（既存の return クリーンアップを差し替え）

- [ ] **Step 4: ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 5: コミット**

```bash
git add src/components/Layout.tsx
git commit -m "feat(tutorial): fire focus-mode:entered event + support shortcut:exit-focus"
```

---

### Task 7: CompletionCard(variant=real) マウント時にフォーカスモードを解除

**Files:**
- Modify: `src/components/tutorial/animations/CompletionCard.tsx`

- [ ] **Step 1: useEffect で exit-focus イベント発火**

CompletionCard コンポーネント内に `useEffect` を追加。variant='real' の場合にマウント時にフォーカスモードを解除:

```tsx
import { useEffect } from 'react';  // 既存importに追加
```

`CompletionCard` 関数内、`return` の前に追加:

```tsx
  // variant=real: フォーカスモードを解除して元のUI状態に戻す
  useEffect(() => {
    if (variant === 'real') {
      window.dispatchEvent(new Event('shortcut:exit-focus'));
    }
  }, [variant]);
```

- [ ] **Step 2: ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/components/tutorial/animations/CompletionCard.tsx
git commit -m "feat(tutorial): auto-exit focus mode when real completion card mounts"
```

---

### Task 8: 動作確認 + 最終ビルド

- [ ] **Step 1: TypeScript ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 2: Vite ビルド確認**

Run: `npx vite build`
Expected: ビルド成功

- [ ] **Step 3: 手動確認チェックリスト**

ブラウザでメインチュートリアルを最初から通して以下を確認:
1. ステップ12（軽減配置）完了後にCompletionCardが出る（ボタン無効）
2. ~1.5秒後に割り込みカードが左から登場
3. CompletionCardがぐにゃっと変形して右上に吹き飛ぶ
4. 「Fキーを押して」案内が表示される（F以外の操作はブロック）
5. Fキーを押すとフォーカスモードが発動
6. 本当のCompletionCardが表示される（ユーモア文言）
7. フォーカスモードが自動解除されている（サイドバー・ヘッダーが戻る）
8. 「本当にはじめる」ボタンでチュートリアル完了

- [ ] **Step 4: 最終コミット（必要に応じて）**

```bash
git add -A
git commit -m "feat(tutorial): focus-interrupt step — complete integration"
```
