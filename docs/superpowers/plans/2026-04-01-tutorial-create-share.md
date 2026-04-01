# チュートリアル改善（新規作成 & 共有 & 軽減UI）実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `add-event` チュートリアルを `create-plan`（新規作成フロー全体）に置き換え、`share` チュートリアルのバグを修正し、軽減UIを改善する

**Architecture:** 既存のデータ駆動型チュートリアルシステム（`tutorialDefinitions.ts` + `useTutorialStore` + `TutorialOverlay`）を拡張。新アニメーション `typewriter-fill` を追加し、TutorialCard に「わかった」ボタンを追加。軽減UIは EventModal 内の表示変更のみ。

**Tech Stack:** React, Zustand, Framer Motion, i18next, TypeScript

**設計書:** `docs/superpowers/specs/2026-04-01-tutorial-create-share-design.md`

---

## ファイル構成

### 新規作成
| ファイル | 役割 |
|---------|------|
| `src/components/tutorial/animations/TypewriterFill.tsx` | タイプライター入力演出コンポーネント |

### 変更
| ファイル | 変更内容 |
|---------|---------|
| `src/data/tutorialDefinitions.ts` | 型拡張 + `add-event` → `create-plan` 置換 + `share` 修正 |
| `src/store/useTutorialStore.ts` | `restoreUserState` 条件拡張 + `startTutorial` スナップショット対応 |
| `src/components/tutorial/TutorialOverlay.tsx` | `typewriter-fill` アニメーション描画追加 |
| `src/components/tutorial/TutorialCard.tsx` | `pill: 'next'` 時の「わかった」ボタン追加 |
| `src/components/NewPlanModal.tsx` | `data-tutorial` 属性 + `completeEvent` 呼び出し追加 |
| `src/components/EventModal.tsx` | 軽減アイコン表示 + `create-plan` チュートリアル連携 |
| `src/components/TimelineRow.tsx` | +ボタンの `data-tutorial` 属性を動的に変更 |
| `src/components/ShareModal.tsx` | `completeEvent('share:modal-opened')` 追加 |
| `src/components/Sidebar.tsx` | `data-tutorial="new-plan"` → `"new-plan-btn"` + トリガーロジック |
| `src/components/tutorial/TutorialMenu.tsx` | `add-event` → `create-plan` の表示名対応（自動） |
| `src/locales/ja.json` | 新規 i18n キー追加 |
| `src/locales/en.json` | 新規 i18n キー追加 |

---

### Task 1: 型拡張 — TutorialStep に typewriterConfig を追加

**Files:**
- Modify: `src/data/tutorialDefinitions.ts:1-42`

- [ ] **Step 1: TypewriterConfig 型と TutorialStep 拡張を追加**

`src/data/tutorialDefinitions.ts` の既存の型定義の後に追加:

```ts
// --- 以下を TutorialStep の前に追加 ---

export interface TypewriterFieldConfig {
  /** CSSセレクタ（入力先の input 要素） */
  target: string;
  /** i18n キー or 直値（数値文字列等） */
  text: string;
  /** 1文字あたりの遅延ms（デフォルト 80） */
  charDelay?: number;
  /** true の場合 i18n を通さずそのまま使う */
  raw?: boolean;
}

export interface TypewriterConfig {
  fields: TypewriterFieldConfig[];
}
```

TutorialStep の `animation` フィールドに `'typewriter-fill'` を追加:
```ts
animation?: 'palette-hint' | 'party-auto-fill' | 'pill-fly' | 'completion-card' | 'typewriter-fill';
```

TutorialStep に `typewriterConfig` フィールドを追加:
```ts
/** タイプライター演出設定（animation: 'typewriter-fill' 時に必須） */
typewriterConfig?: TypewriterConfig;
```

- [ ] **Step 2: ビルド確認**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: エラーなし（型追加のみなので既存コードに影響しない）

- [ ] **Step 3: コミット**

```bash
git add src/data/tutorialDefinitions.ts
git commit -m "feat(tutorial): TutorialStep に typewriterConfig 型を追加"
```

---

### Task 2: TutorialCard に「わかった」ボタンを追加

**Files:**
- Modify: `src/components/tutorial/TutorialCard.tsx`

`pill: 'next'` のステップ（share ステップ2、create-plan ステップ10の completion-card 以外）で「わかった」ボタンを表示してイベント発火できるようにする。

- [ ] **Step 1: TutorialCard に onNext コールバック props を追加**

`src/components/tutorial/TutorialCard.tsx` の props に追加:

```ts
interface TutorialCardProps {
  messageKey: string;
  descriptionKey?: string;
  image?: string;
  top: number;
  left: number;
  visible: boolean;
  onSkip?: () => void;
  /** 「わかった」ボタン押下時のコールバック（pill: 'next' ステップ用） */
  onNext?: () => void;
  stepLabel?: string;
}
```

JSX の `onSkip` ボタンの直前に「わかった」ボタンを追加:

```tsx
{onNext && (
  <button
    onClick={onNext}
    className="mt-3 w-full py-2 rounded-lg text-[11px] font-bold text-white transition-all hover:opacity-80 active:scale-95 cursor-pointer"
    style={{ backgroundColor: '#22c55e' }}
  >
    {t('tutorial.got_it')}
  </button>
)}

{onSkip && !onNext && (
  <button
    onClick={onSkip}
    className="text-[10px] text-app-text-muted mt-2 underline underline-offset-2 hover:text-app-text transition-colors cursor-pointer"
  >
    {t('tutorial.skip')}
  </button>
)}
```

注意: `onNext` がある場合は `onSkip`（スキップ）ボタンを非表示にする（「わかった」で十分）。

- [ ] **Step 2: TutorialOverlay から onNext を渡す**

`src/components/tutorial/TutorialOverlay.tsx` の TutorialCard 呼び出し部分を修正。
`step.pill === 'next'` かつ `step.animation !== 'completion-card'` の場合に `onNext` を渡す:

```tsx
<TutorialCard
  key={`card-${step.id}`}
  messageKey={step.messageKey}
  descriptionKey={step.descriptionKey}
  image={step.image}
  top={cardPos.top}
  left={cardPos.left}
  visible={true}
  onSkip={handleSkip}
  onNext={step.pill === 'next' && step.animation !== 'completion-card' ? () => {
    useTutorialStore.getState().completeEvent(step.completionEvent);
  } : undefined}
  stepLabel={stepLabel}
/>
```

- [ ] **Step 3: i18n キー追加**

`src/locales/ja.json` の `tutorial` セクションに追加:
```json
"got_it": "わかった！"
```

`src/locales/en.json` の `tutorial` セクションに追加:
```json
"got_it": "Got it!"
```

- [ ] **Step 4: ビルド確認**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: エラーなし

- [ ] **Step 5: コミット**

```bash
git add src/components/tutorial/TutorialCard.tsx src/components/tutorial/TutorialOverlay.tsx src/locales/ja.json src/locales/en.json
git commit -m "feat(tutorial): TutorialCard に「わかった」ボタン追加（pill: 'next' 用）"
```

---

### Task 3: 軽減UI変更 — 「N Selected」→ アイコン並び表示

**Files:**
- Modify: `src/components/EventModal.tsx:622-624`

- [ ] **Step 1: EventModal の selectedMitigations 表示を変更**

`src/components/EventModal.tsx` 624行目の:
```tsx
<span className="text-[10px] text-app-text-muted bg-app-surface2 px-2 py-0.5 rounded-full">{selectedMitigations.length} Selected</span>
```

を以下に置き換え:
```tsx
{selectedMitigations.length > 0 && (
  <div className="flex items-center gap-0.5">
    {selectedMitigations.slice(0, 4).map(mitId => {
      const mit = MITIGATIONS.find(m => m.id === mitId);
      if (!mit) return null;
      return (
        <img
          key={mitId}
          src={mit.icon}
          alt={mit.name[lang] || mit.name.ja}
          className="w-5 h-5 rounded object-contain"
        />
      );
    })}
    {selectedMitigations.length > 4 && (
      <span className="text-[10px] text-app-text-muted ml-0.5">
        +{selectedMitigations.length - 4}
      </span>
    )}
  </div>
)}
```

注意: `lang` 変数は EventModal 内で既に利用可能か確認。なければ `const { t, i18n } = useTranslation(); const lang = i18n.language === 'en' ? 'en' : 'ja';` を追加。

- [ ] **Step 2: ビルド確認**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/components/EventModal.tsx
git commit -m "feat(ui): 軽減表示を「N Selected」→ アイコン並びに変更"
```

---

### Task 4: TypewriterFill アニメーションコンポーネント作成

**Files:**
- Create: `src/components/tutorial/animations/TypewriterFill.tsx`

- [ ] **Step 1: TypewriterFill コンポーネントを作成**

```tsx
// src/components/tutorial/animations/TypewriterFill.tsx
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TypewriterConfig } from '../../../data/tutorialDefinitions';

interface TypewriterFillProps {
  config: TypewriterConfig;
  onComplete: () => void;
}

/**
 * チュートリアル用タイプライター入力演出。
 * 指定された input 要素に1文字ずつテキストを入力し、React の state を更新する。
 * prefers-reduced-motion 時は即座に全文表示。
 */
export function TypewriterFill({ config, onComplete }: TypewriterFillProps) {
  const { t } = useTranslation();
  const [fieldIndex, setFieldIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const completedRef = useRef(false);

  // prefers-reduced-motion チェック
  const prefersReduced = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (completedRef.current) return;
    const fields = config.fields;
    if (!fields || fields.length === 0) {
      completedRef.current = true;
      onComplete();
      return;
    }

    const currentField = fields[fieldIndex];
    if (!currentField) {
      // 全フィールド完了
      completedRef.current = true;
      onComplete();
      return;
    }

    const fullText = currentField.raw ? currentField.text : t(currentField.text);
    const el = document.querySelector(currentField.target) as HTMLInputElement | null;
    if (!el) return;

    // reduced-motion: 即座に全文入力
    if (prefersReduced) {
      setNativeInputValue(el, fullText);
      if (fieldIndex < fields.length - 1) {
        setFieldIndex(prev => prev + 1);
        setCharIndex(0);
      } else {
        completedRef.current = true;
        onComplete();
      }
      return;
    }

    // 1文字ずつ入力
    if (charIndex <= fullText.length) {
      const partial = fullText.slice(0, charIndex);
      setNativeInputValue(el, partial);

      if (charIndex < fullText.length) {
        const delay = currentField.charDelay ?? 80;
        timerRef.current = setTimeout(() => {
          setCharIndex(prev => prev + 1);
        }, delay);
      } else {
        // 現フィールド完了 → 次フィールドへ
        timerRef.current = setTimeout(() => {
          if (fieldIndex < fields.length - 1) {
            setFieldIndex(prev => prev + 1);
            setCharIndex(0);
          } else {
            completedRef.current = true;
            onComplete();
          }
        }, 400); // フィールド間の間
      }
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [fieldIndex, charIndex, config, t, onComplete, prefersReduced]);

  // レンダリングなし（DOM操作のみ）
  return null;
}

/**
 * React 管理の input に外部から値をセットする。
 * nativeInputValueSetter + input イベント発火で React の onChange を起動。
 */
function setNativeInputValue(el: HTMLInputElement, value: string) {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, 'value'
  )?.set;
  if (nativeSetter) {
    nativeSetter.call(el, value);
  } else {
    el.value = value;
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
}
```

- [ ] **Step 2: ビルド確認**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/components/tutorial/animations/TypewriterFill.tsx
git commit -m "feat(tutorial): TypewriterFill アニメーションコンポーネント追加"
```

---

### Task 5: TutorialOverlay に typewriter-fill 描画を追加

**Files:**
- Modify: `src/components/tutorial/TutorialOverlay.tsx`

- [ ] **Step 1: TypewriterFill の import を追加**

`src/components/tutorial/TutorialOverlay.tsx` の import セクションに追加:
```tsx
import { TypewriterFill } from './animations/TypewriterFill';
```

- [ ] **Step 2: renderAnimation に typewriter-fill case を追加**

`renderAnimation()` 関数の `switch` に追加:
```tsx
case 'typewriter-fill':
  return step.typewriterConfig ? (
    <TypewriterFill
      config={step.typewriterConfig}
      onComplete={() => {
        useTutorialStore.getState().completeEvent(step.completionEvent);
      }}
    />
  ) : null;
```

- [ ] **Step 3: typewriter-fill 中のブロッカー制御**

TutorialOverlay の JSX で、`typewriter-fill` 中は全面ブロック（入力中に他の操作を防ぐ）:

`party-auto-fill` や `palette-hint` のブロック条件に `typewriter-fill` を追加:
```tsx
{(step.animation === 'party-auto-fill' || step.animation === 'palette-hint' || step.animation === 'typewriter-fill') && (
  <TutorialBlocker targetRect={null} active={true} />
)}
```

- [ ] **Step 4: ビルド確認**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: エラーなし

- [ ] **Step 5: コミット**

```bash
git add src/components/tutorial/TutorialOverlay.tsx
git commit -m "feat(tutorial): TutorialOverlay に typewriter-fill 描画追加"
```

---

### Task 6: create-plan チュートリアル定義 + i18n

**Files:**
- Modify: `src/data/tutorialDefinitions.ts:166-204` (add-event を create-plan に置換)
- Modify: `src/locales/ja.json:626-694`
- Modify: `src/locales/en.json:622-690`

- [ ] **Step 1: add-event チュートリアル定義を create-plan に置換**

`src/data/tutorialDefinitions.ts` の `addEventTutorial` 定義（行168-204）を以下に置き換え:

```ts
// ─────────────────────────────────────────────
// 個別チュートリアル: 新規作成
// ─────────────────────────────────────────────
const createPlanTutorial: TutorialDefinition = {
  id: 'create-plan',
  nameKey: 'tutorial.menu.create_plan',
  steps: [
    {
      id: 'create-1-open-modal',
      target: '[data-tutorial="new-plan-btn"]',
      pill: 'click',
      messageKey: 'tutorial.create_plan.open_modal.message',
      descriptionKey: 'tutorial.create_plan.open_modal.description',
      completionEvent: 'create:modal-opened',
    },
    {
      id: 'create-2-level',
      target: '[data-tutorial="level-max"]',
      pill: 'click',
      messageKey: 'tutorial.create_plan.level.message',
      completionEvent: 'create:level-selected',
    },
    {
      id: 'create-3-category',
      target: '[data-tutorial="category-dungeon"]',
      pill: 'click',
      messageKey: 'tutorial.create_plan.category.message',
      completionEvent: 'create:category-selected',
    },
    {
      id: 'create-4-name',
      target: '[data-tutorial="plan-name-input"]',
      pill: 'check',
      messageKey: 'tutorial.create_plan.name.message',
      descriptionKey: 'tutorial.create_plan.name.description',
      completionEvent: 'create:name-filled',
      animation: 'typewriter-fill',
      typewriterConfig: {
        fields: [
          {
            target: '[data-tutorial="plan-name-input"]',
            text: 'tutorial.create_plan.typewriter_name',
            charDelay: 80,
          },
        ],
      },
    },
    {
      id: 'create-5-submit',
      target: '[data-tutorial="create-plan-btn"]',
      pill: 'click',
      messageKey: 'tutorial.create_plan.submit.message',
      completionEvent: 'create:plan-created',
    },
    {
      id: 'create-6-add-event',
      target: '[data-tutorial="add-event-btn"]',
      pill: 'click',
      messageKey: 'tutorial.create_plan.add_event.message',
      descriptionKey: 'tutorial.create_plan.add_event.description',
      completionEvent: 'create:event-modal-opened',
    },
    {
      id: 'create-7-fill-event',
      target: '[data-tutorial="event-name-input"]',
      pill: 'check',
      messageKey: 'tutorial.create_plan.fill_event.message',
      descriptionKey: 'tutorial.create_plan.fill_event.description',
      completionEvent: 'create:event-filled',
      animation: 'typewriter-fill',
      typewriterConfig: {
        fields: [
          {
            target: '[data-tutorial="event-name-input"]',
            text: 'tutorial.create_plan.typewriter_event_name',
            charDelay: 80,
          },
          {
            target: '[data-tutorial="event-actual-damage-input"]',
            text: '120000',
            charDelay: 120,
            raw: true,
          },
        ],
      },
    },
    {
      id: 'create-8-miti',
      target: '[data-tutorial="tutorial-skill-reprisal"]',
      pill: 'click',
      messageKey: 'tutorial.create_plan.miti.message',
      descriptionKey: 'tutorial.create_plan.miti.description',
      completionEvent: 'create:miti-selected',
    },
    {
      id: 'create-9-save',
      target: '[data-tutorial="event-save-btn"]',
      pill: 'click',
      messageKey: 'tutorial.create_plan.save.message',
      completionEvent: 'create:event-saved',
    },
    {
      id: 'create-10-complete',
      target: null,
      pill: 'next',
      messageKey: 'tutorial.create_plan.complete.message',
      completionEvent: 'tutorial:dismissed',
      animation: 'completion-card',
    },
  ],
};
```

- [ ] **Step 2: TUTORIALS エクスポートを更新**

```ts
export const TUTORIALS: Record<string, TutorialDefinition> = {
  main: mainTutorial,
  'create-plan': createPlanTutorial,
  share: shareTutorial,
};
```

- [ ] **Step 3: share チュートリアル定義を修正**

既存の `shareTutorial`（行209-230）を以下に置き換え:

```ts
const shareTutorial: TutorialDefinition = {
  id: 'share',
  nameKey: 'tutorial.menu.share',
  steps: [
    {
      id: 'share-1-open',
      target: '[data-tutorial="share-copy-btn"]',
      pill: 'click',
      messageKey: 'tutorial.share.open.message',
      completionEvent: 'share:modal-opened',
    },
    {
      id: 'share-2-done',
      target: null,
      pill: 'next',
      messageKey: 'tutorial.share.done.message',
      descriptionKey: 'tutorial.share.done.description',
      completionEvent: 'share:tutorial-done',
    },
  ],
};
```

- [ ] **Step 4: ja.json に create-plan の i18n キーを追加**

`src/locales/ja.json` の `tutorial` セクション内で `add_event` を `create_plan` に置き換え + `share` を修正:

```json
"menu": {
    "main": "はじめてガイド",
    "create_plan": "新規作成のしかた",
    "share": "共有のしかた"
},
```

`add_event` セクション（行680-694）を削除し、以下に置き換え:
```json
"create_plan": {
    "open_modal": {
        "message": "テンプレにない表を作ってみよう！",
        "description": "好きなダンジョンやコンテンツの軽減表を一から作れます。"
    },
    "level": {
        "message": "レベルを選ぼう"
    },
    "category": {
        "message": "種類を選ぼう — ダンジョンを選んでみましょう"
    },
    "name": {
        "message": "代わりに入力しますね！",
        "description": "好きな名前を付けられます。"
    },
    "submit": {
        "message": "作成ボタンを押そう"
    },
    "add_event": {
        "message": "攻撃を追加してみよう",
        "description": "＋ボタンを押して攻撃を追加します。"
    },
    "fill_event": {
        "message": "攻撃名とダメージを入力します",
        "description": "ゆっくり入力するので見ていてください。"
    },
    "miti": {
        "message": "軽減を選ぼう",
        "description": "野戦治療の陣とディヴァインベールは押しておきました！リプライザルを押してみましょう。"
    },
    "save": {
        "message": "保存しよう"
    },
    "complete": {
        "message": "チュートリアル完了！"
    },
    "typewriter_name": "ダンジョン_チュートリアル",
    "typewriter_event_name": "ボス攻撃"
},
```

`share` セクション（行696-704）を修正:
```json
"share": {
    "open": {
        "message": "共有ボタンを押してみよう"
    },
    "done": {
        "message": "画像などを設定して共有しよう！",
        "description": "OGP画像やチームロゴを設定して、完成した軽減表をみんなに共有できます。"
    }
},
```

- [ ] **Step 5: en.json に create-plan の i18n キーを追加**

同様に `src/locales/en.json` を更新:

```json
"menu": {
    "main": "Getting Started",
    "create_plan": "Creating a Plan",
    "share": "How to Share"
},
```

`add_event` を削除し:
```json
"create_plan": {
    "open_modal": {
        "message": "Let's make a plan from scratch!",
        "description": "Create mitigation plans for any dungeon or content."
    },
    "level": {
        "message": "Choose a level"
    },
    "category": {
        "message": "Pick a type — let's try Dungeon"
    },
    "name": {
        "message": "We'll type it for you!",
        "description": "You can name it anything you like."
    },
    "submit": {
        "message": "Hit Create"
    },
    "add_event": {
        "message": "Let's add an attack",
        "description": "Click the + button to add an attack."
    },
    "fill_event": {
        "message": "Entering attack name and damage",
        "description": "Watch — we'll type it in for you."
    },
    "miti": {
        "message": "Choose a mitigation",
        "description": "Sacred Soil and Divine Veil are already set! Click Reprisal."
    },
    "save": {
        "message": "Save it"
    },
    "complete": {
        "message": "Tutorial complete!"
    },
    "typewriter_name": "Dungeon_Tutorial",
    "typewriter_event_name": "Boss Attack"
},
```

`share` を修正:
```json
"share": {
    "open": {
        "message": "Try the share button"
    },
    "done": {
        "message": "Set up images and share!",
        "description": "Add an OGP image or team logo, then share your plan with everyone."
    }
},
```

- [ ] **Step 6: ビルド確認**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: エラーなし

- [ ] **Step 7: コミット**

```bash
git add src/data/tutorialDefinitions.ts src/locales/ja.json src/locales/en.json
git commit -m "feat(tutorial): create-plan 定義追加 + share 修正 + i18n"
```

---

### Task 7: useTutorialStore — スナップショット対応と復元条件拡張

**Files:**
- Modify: `src/store/useTutorialStore.ts`

- [ ] **Step 1: restoreUserState の条件を拡張**

`src/store/useTutorialStore.ts` の `completeTutorial` 関数（行168-188）を修正。
`if (activeTutorialId === 'main')` を `if (activeTutorialId === 'main' || activeTutorialId === 'create-plan')` に変更:

```ts
completeTutorial: () => {
  const { activeTutorialId } = get();
  if (!activeTutorialId) return;

  // メインチュートリアルと新規作成チュートリアルは状態復元
  if (activeTutorialId === 'main' || activeTutorialId === 'create-plan') {
    restoreUserState(get());
  }

  set(state => ({
    activeTutorialId: null,
    currentStep: 0,
    isActive: false,
    currentStepIndex: 0,
    pendingExit: false,
    hasCompleted: activeTutorialId === 'main' ? true : state.hasCompleted,
    completed: { ...state.completed, [activeTutorialId]: true },
    _savedSnapshot: null,
    _savedPlanId: null,
  }));
},
```

- [ ] **Step 2: confirmExit も同様に拡張**

`confirmExit`（行199-212）の条件も同様に変更:
```ts
confirmExit: () => {
  const { activeTutorialId } = get();
  if (activeTutorialId === 'main' || activeTutorialId === 'create-plan') {
    restoreUserState(get());
  }
  set({
    activeTutorialId: null,
    currentStep: 0,
    isActive: false,
    pendingExit: false,
    currentStepIndex: 0,
    _savedSnapshot: null,
    _savedPlanId: null,
  });
},
```

- [ ] **Step 3: startTutorial を create-plan 対応に拡張**

`startTutorial`（行106-142）を修正。`create-plan` もスナップショット保存するが `resetForTutorial()` は呼ばない:

```ts
startTutorial: (id = 'main') => {
  const tutorial = TUTORIALS[id];
  if (!tutorial) return;

  const mitiState = useMitigationStore.getState();
  const planStore = usePlanStore.getState();

  let snapshot: TutorialSnapshot | null = null;
  let savedPlanId: string | null = null;

  if (id === 'main' || id === 'create-plan') {
    savedPlanId = planStore.currentPlanId;
    if (savedPlanId) {
      planStore.updatePlan(savedPlanId, { data: mitiState.getSnapshot() });
    }
    snapshot = {
      timelineEvents: JSON.parse(JSON.stringify(mitiState.timelineEvents)),
      timelineMitigations: JSON.parse(JSON.stringify(mitiState.timelineMitigations)),
      phases: JSON.parse(JSON.stringify(mitiState.phases)),
      partyMembers: JSON.parse(JSON.stringify(mitiState.partyMembers)),
      myMemberId: mitiState.myMemberId,
      myJobHighlight: mitiState.myJobHighlight,
      hideEmptyRows: mitiState.hideEmptyRows,
    };
    // main はリセット、create-plan はリセットしない（新規作成がチュートリアルの一部）
    if (id === 'main') {
      mitiState.resetForTutorial();
    }
  }

  set({
    activeTutorialId: id,
    currentStep: 0,
    isActive: true,
    pendingExit: false,
    currentStepIndex: 0,
    _savedSnapshot: snapshot,
    _savedPlanId: savedPlanId,
  });
},
```

- [ ] **Step 4: ビルド確認**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: エラーなし

- [ ] **Step 5: コミット**

```bash
git add src/store/useTutorialStore.ts
git commit -m "feat(tutorial): useTutorialStore — create-plan スナップショット対応"
```

---

### Task 8: data-tutorial 属性追加 — NewPlanModal, TimelineRow, Sidebar

**Files:**
- Modify: `src/components/NewPlanModal.tsx`
- Modify: `src/components/TimelineRow.tsx`
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: Sidebar の新規作成ボタン属性を変更**

`src/components/Sidebar.tsx` 行1250付近の `data-tutorial="new-plan"` を `data-tutorial="new-plan-btn"` に変更。

また、クリック時にチュートリアルトリガーロジックを追加:
```tsx
onClick={() => {
  setIsNewPlanModalOpen(true);
  // create-plan チュートリアルトリガー（初回のみ）
  const tutState = useTutorialStore.getState();
  if (!tutState.completed['create-plan'] && !tutState.isActive) {
    tutState.startTutorial('create-plan');
  }
}}
```

- [ ] **Step 2: NewPlanModal に data-tutorial 属性を追加**

`src/components/NewPlanModal.tsx` の以下の要素に属性を付与:

1. **レベルタブ（最大レベル）** — 行271のレベルボタンのmap内で、最初のレベル（`LEVEL_OPTIONS[0]`）に属性を付与:
```tsx
{LEVEL_OPTIONS.map((l, idx) => (
  <button
    key={l}
    data-tutorial={idx === 0 ? 'level-max' : undefined}
    onClick={() => {
      setLevel(l);
      useTutorialStore.getState().completeEvent('create:level-selected');
    }}
    // ...既存のclassName
  >
    {l}
  </button>
))}
```

2. **カテゴリボタン（ダンジョン）** — 行293のカテゴリボタンのmap内:
```tsx
{CATEGORY_OPTIONS.map(cat => (
  <button
    key={cat}
    data-tutorial={cat === 'dungeon' ? 'category-dungeon' : undefined}
    onClick={() => {
      setCategory(cat);
      useTutorialStore.getState().completeEvent('create:category-selected');
    }}
    // ...既存のclassName
  >
    {(CATEGORY_LABELS[cat][lang] || CATEGORY_LABELS[cat].ja).toUpperCase()}
  </button>
))}
```

3. **名前入力欄** — 行373のダンジョン等の自由入力 `<input>` に属性追加:
```tsx
<input
  ref={titleInputRef}
  data-tutorial="plan-name-input"
  // ...既存のprops
/>
```

4. **作成ボタン** — 行449の作成ボタンに属性追加:
```tsx
<button
  data-tutorial="create-plan-btn"
  onClick={handleCreate}
  // ...既存のprops
>
  {t('new_plan.create_button')}
</button>
```

5. **NewPlanModal の handleCreate 内** — 既存の `completeEvent('content:selected')` を変更:
```tsx
// 既存のmainチュートリアル互換を維持しつつ、create-planも発火
useTutorialStore.getState().completeEvent('content:selected');
useTutorialStore.getState().completeEvent('create:plan-created');
```

6. **NewPlanModal が開いたとき** — `useEffect` で `create:modal-opened` を発火:
```tsx
useEffect(() => {
  if (isOpen) {
    useTutorialStore.getState().completeEvent('create:modal-opened');
    // ...既存のリセットロジック
  }
}, [isOpen]);
```

- [ ] **Step 3: TimelineRow の +ボタン属性を動的に変更**

`src/components/TimelineRow.tsx` 行181の:
```tsx
data-tutorial={time === 11 ? 'add-event-btn-11' : undefined}
```
を以下に変更（create-plan チュートリアル中は最初の空き行で反応）:
```tsx
data-tutorial={
  time === 11 ? 'add-event-btn-11' :
  time === 0 ? 'add-event-btn' :
  undefined
}
```

注意: `time === 0` は空プランの最初の時間枠。create-plan チュートリアルでは空のプランが作成されるので、time=0 の行に+ボタンが表示される。

また、+ボタンのクリックハンドラ内で `completeEvent` を発火:
このイベント発火は Timeline.tsx の `handleAddClick` 内で行う。`src/components/Timeline.tsx` の `handleAddClick` 関数（行829-832）の `setIsModalOpen(true)` の直後に追加:
```tsx
setIsModalOpen(true);
useTutorialStore.getState().completeEvent('create:event-modal-opened');
```

- [ ] **Step 4: ビルド確認**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: エラーなし

- [ ] **Step 5: コミット**

```bash
git add src/components/NewPlanModal.tsx src/components/TimelineRow.tsx src/components/Timeline.tsx src/components/Sidebar.tsx
git commit -m "feat(tutorial): data-tutorial 属性 + completeEvent 追加（NewPlanModal, Timeline, Sidebar）"
```

---

### Task 9: EventModal — create-plan チュートリアル連携

**Files:**
- Modify: `src/components/EventModal.tsx`

- [ ] **Step 1: create-plan ステップ7（タイプライター）完了後に軽減プリセット**

EventModal のチュートリアル進行ロジック（行293-354付近の `useEffect`）に、create-plan ステップ8 用の軽減プリセットロジックを追加。

`create-7-fill-event` の完了を検知して `selectedMitigations` に野戦治療の陣（Sacred Soil）とディヴァインベール（Divine Veil）を追加:

```tsx
// create-plan: ステップ8に進んだら軽減をプリセット
if (currentStep?.id === 'create-8-miti') {
  const sacredSoilId = MITIGATIONS.find(m => m.name.en === 'Sacred Soil')?.id;
  const divineVeilId = MITIGATIONS.find(m => m.name.en === 'Divine Veil')?.id;
  const presets = [sacredSoilId, divineVeilId].filter((id): id is string => !!id);
  
  setSelectedMitigations(prev => {
    const newSet = new Set([...prev, ...presets]);
    return Array.from(newSet);
  });
}
```

- [ ] **Step 2: create-plan ステップ8（軽減選択）の完了検知**

リプライザルがクリックされたら `create:miti-selected` を発火:

```tsx
// create-plan: リプライザル選択で完了
if (currentStep?.id === 'create-8-miti') {
  const reprisalId = MITIGATIONS.find(m => m.name.en === 'Reprisal')?.id;
  if (reprisalId && selectedMitigations.includes(reprisalId)) {
    const tId = setTimeout(() => tutorialState.completeEvent('create:miti-selected'), 500);
    return () => clearTimeout(tId);
  }
}
```

- [ ] **Step 3: create-plan ステップ8で他の軽減のクリックをブロック**

`toggleMitigation` 関数内の既存のチュートリアルブロック条件に `create-8-miti` を追加:

```tsx
const toggleMitigation = (id: string) => {
  if (isTutorialActive && (currentStep?.id === 'add-3-miti' || currentStep?.id === 'create-8-miti')) {
    const mit = MITIGATIONS.find(m => m.id === id);
    const isTargetSkill = mit && mit.name.en === 'Reprisal';
    if (!isTargetSkill) return;
  }
  setSelectedMitigations(prev =>
    prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
  );
};
```

- [ ] **Step 4: create-plan ステップ9（保存）の完了検知**

EventModal の保存処理内で `create:event-saved` を発火。既存の `handleSubmit` または保存ロジック内に追加:

```tsx
useTutorialStore.getState().completeEvent('create:event-saved');
```

- [ ] **Step 5: data-tutorial 属性の確認**

以下の属性が EventModal に既に存在することを確認:
- `data-tutorial="event-name-input"` — 攻撃名入力
- `data-tutorial="event-actual-damage-input"` — ダメージ入力
- `data-tutorial="tutorial-skill-reprisal"` — リプライザルボタン（動的に付与）
- `data-tutorial="event-save-btn"` — 保存ボタン

不足があれば追加する。特に `tutorial-skill-reprisal` は `create-plan` でも正しく動的に付与されるか確認:
```tsx
data-tutorial={shouldHighlight ? 'tutorial-skill-target' : undefined}
```
→ `create-plan` チュートリアル時にも `Reprisal` が `isTutorialTarget` に含まれるよう条件を調整:
```tsx
const isTutorialTarget = isTutorialActive && (
  (currentStep?.id === 'add-3-miti' && ['Reprisal', 'Addle', 'Sacred Soil'].includes(mit.name.en) && !selectedMitigations.includes(mit.id)) ||
  (currentStep?.id === 'create-8-miti' && mit.name.en === 'Reprisal' && !selectedMitigations.includes(mit.id))
);
```

`data-tutorial` 属性名も `tutorial-skill-reprisal` にマッチするよう調整:
```tsx
data-tutorial={
  isTutorialActive && mit.name.en === 'Reprisal' && !selectedMitigations.includes(mit.id)
    ? 'tutorial-skill-reprisal'
    : shouldHighlight ? 'tutorial-skill-target' : undefined
}
```

- [ ] **Step 6: ビルド確認**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: エラーなし

- [ ] **Step 7: コミット**

```bash
git add src/components/EventModal.tsx
git commit -m "feat(tutorial): EventModal — create-plan チュートリアル連携 + 軽減プリセット"
```

---

### Task 10: ShareModal — 共有チュートリアルバグ修正

**Files:**
- Modify: `src/components/ShareModal.tsx`
- Modify: `src/components/ShareButtons.tsx`

- [ ] **Step 1: ShareModal に completeEvent 追加**

`src/components/ShareModal.tsx` の `useEffect`（isOpen 監視）内で、モーダルが開いた時に `share:modal-opened` を発火:

```tsx
useEffect(() => {
  if (isOpen) {
    useTutorialStore.getState().completeEvent('share:modal-opened');
    // ...既存のURL生成ロジック
  }
}, [isOpen]);
```

`useTutorialStore` の import を追加:
```tsx
import { useTutorialStore } from '../store/useTutorialStore';
```

- [ ] **Step 2: ShareButtons でチュートリアル完了時にモーダルを閉じる**

`src/components/ShareButtons.tsx` で、`share` チュートリアル完了を監視してモーダルを閉じる:

```tsx
const shareCompleted = useTutorialStore(s => s.completed['share']);
const prevShareCompleted = useRef(shareCompleted);

useEffect(() => {
  // share チュートリアルが今完了した → モーダルを閉じる
  if (shareCompleted && !prevShareCompleted.current) {
    setModalOpen(false);
  }
  prevShareCompleted.current = shareCompleted;
}, [shareCompleted]);
```

`useTutorialStore` と `useRef` の import を追加。

- [ ] **Step 3: ビルド確認**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: エラーなし

- [ ] **Step 4: コミット**

```bash
git add src/components/ShareModal.tsx src/components/ShareButtons.tsx
git commit -m "fix(tutorial): share チュートリアル — バグ修正 + モーダル自動クローズ"
```

---

### Task 11: 統合テスト — ビルド + 手動確認チェックリスト

**Files:** なし（確認のみ）

- [ ] **Step 1: フルビルド確認**

Run: `npm run build 2>&1 | tail -20`
Expected: ビルド成功

- [ ] **Step 2: 手動確認チェックリスト**

以下を `npm run dev` で確認:

**create-plan チュートリアル:**
- [ ] 新規作成ボタンの初回クリックでチュートリアル起動
- [ ] ステップ1: 新規作成モーダルが開く
- [ ] ステップ2: 最大レベルタブにピル表示、クリックで進行
- [ ] ステップ3: ダンジョンボタンにピル表示、クリックで進行
- [ ] ステップ4: タイプライターで名前入力、自動進行
- [ ] ステップ5: 作成ボタンにピル表示、クリックで進行
- [ ] ステップ6: +ボタンにピル表示、クリックで EventModal 表示
- [ ] ステップ7: タイプライターで攻撃名+ダメージ入力、自動進行
- [ ] ステップ8: リプライザルにピル表示（野戦治療の陣+ディヴァインベールがプリセット済み）
- [ ] ステップ9: 保存ボタンにピル表示
- [ ] ステップ10: 完了画面表示
- [ ] 完了後にチュートリアル用プラン削除、元のプランに復元
- [ ] スキップ時も状態復元される
- [ ] TutorialMenu に「新規作成のしかた」表示、完了マーク付き

**share チュートリアル:**
- [ ] 共有ボタンクリックでステップ1進行
- [ ] ShareModal 表示後にステップ2のカード表示
- [ ] 「わかった」ボタンクリックでチュートリアル完了
- [ ] 完了後にShareModal が閉じる

**軽減UI:**
- [ ] EventModal で軽減選択時にアイコンが横並び表示
- [ ] 5個以上で +N 表示
- [ ] 0個で何も表示されない

**英語モード:**
- [ ] 全メッセージが英語で表示される
- [ ] タイプライターが `Dungeon_Tutorial` / `Boss Attack` を入力

- [ ] **Step 3: 最終コミット（必要なら修正を含む）**

```bash
git add -A
git commit -m "feat(tutorial): 新規作成+共有チュートリアル改善 — 統合完了"
```
