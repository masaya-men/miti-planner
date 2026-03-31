# チュートリアル刷新 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 28ステップの1本通しチュートリアルを、データ駆動型の短い個別チュートリアル3本＋メニューに刷新する。

**Architecture:** 旧コード（useTutorialStore.ts 753行 + TutorialOverlay.tsx 809行）を完全削除し、データ駆動型の新システムに置き換える。チュートリアル定義は宣言的な配列、UIは緑ピルインジケーター＋吹き出しカード＋クリックブロッカーの3層構成。特殊演出（パーティ飛行、ピル飛行、完了画面）は独立コンポーネント。

**Tech Stack:** React 19, TypeScript, Zustand 5 (persist), Framer Motion, i18next, Tailwind CSS v4

**設計書:** `docs/superpowers/specs/2026-03-31-tutorial-overhaul-design.md`

---

## ファイル構成

### 新規作成
| ファイル | 責務 |
|---|---|
| `src/data/tutorialDefinitions.ts` | 3つのチュートリアルのステップ定義（データのみ） |
| `src/store/useTutorialStore.ts` | 状態管理（旧ファイルを完全置き換え） |
| `src/components/tutorial/TutorialPill.tsx` | 緑ピルインジケーター（バウンス＋飛行） |
| `src/components/tutorial/TutorialCard.tsx` | 吹き出しカード（メッセージ＋画像スロット） |
| `src/components/tutorial/TutorialBlocker.tsx` | クリックブロック層（clipPathくり抜き） |
| `src/components/tutorial/TutorialMenu.tsx` | ドロップダウンメニュー（3項目＋✓マーク） |
| `src/components/tutorial/TutorialOverlay.tsx` | オーケストレーター（Pill/Card/Blockerを統合） |
| `src/components/tutorial/animations/PartyAutoFill.tsx` | パーティ自動埋めアニメーション |
| `src/components/tutorial/animations/PillFly.tsx` | ピル飛行変化アニメーション |
| `src/components/tutorial/animations/CompletionCard.tsx` | 完了画面 |

### 修正
| ファイル | 変更内容 |
|---|---|
| `src/components/ConsolidatedHeader.tsx` | チュートリアルボタン → TutorialMenuに差し替え |
| `src/components/MitiPlannerPage.tsx` | 起動ロジック簡素化 |
| `src/components/PartySettingsModal.tsx` | completeEvent呼び出しを新イベント名に更新 |
| `src/components/Timeline.tsx` | 共有ボタンの初回クリック検出追加 |
| `src/components/EventModal.tsx` | completeEvent呼び出しを新イベント名に更新 |
| `src/components/MitigationSelector.tsx` | completeEvent呼び出しを新イベント名に更新 |
| `src/components/Sidebar.tsx` | completeEvent呼び出しを新イベント名に更新 |
| `src/components/NewPlanModal.tsx` | completeEvent呼び出しを新イベント名に更新 |
| `src/store/useMitigationStore.ts` | completeEvent呼び出しを新イベント名に更新 |
| `src/locales/ja.json` | チュートリアルキーを新構造に置き換え |
| `src/locales/en.json` | 同上 |
| `src/index.css` | 旧チュートリアルCSSアニメーション削除、新アニメーション追加 |

### 削除
| ファイル | 理由 |
|---|---|
| `src/components/TutorialOverlay.tsx`（旧809行） | 新`tutorial/TutorialOverlay.tsx`に置き換え |

### 再利用（変更なし）
| ファイル | 理由 |
|---|---|
| `src/data/tutorialTemplate.ts` | チュートリアル用タイムラインデータ。そのまま使う |

---

## Task 1: チュートリアル定義データ

**Files:**
- Create: `src/data/tutorialDefinitions.ts`

- [ ] **Step 1: ファイルを作成**

```typescript
// src/data/tutorialDefinitions.ts
// チュートリアル定義 — ステップの追加・削除・並べ替えはこのファイルだけで完結する

export type PillLabel = 'click' | 'tap' | 'check' | 'next';

export interface TutorialStep {
  /** ユニークID */
  id: string;
  /** CSSセレクタ（data-tutorial属性）。nullならターゲットなし（演出のみ） */
  target: string | null;
  /** ピルのラベル種類 */
  pill: PillLabel;
  /** i18n: メインメッセージ */
  messageKey: string;
  /** i18n: 補足説明（省略可） */
  descriptionKey?: string;
  /** 画像パス（省略可） */
  image?: string;
  /** この文字列のイベントで次ステップへ進む */
  completionEvent: string;
  /** 特殊演出名（省略可） */
  animation?: 'party-auto-fill' | 'pill-fly' | 'completion-card';
  /** ピル飛行の定義（省略可） */
  pillTransition?: {
    toTarget: string;
    toLabel: PillLabel;
  };
}

export interface TutorialDefinition {
  /** チュートリアルID */
  id: string;
  /** i18n: メニュー表示名 */
  nameKey: string;
  /** ステップ配列 */
  steps: TutorialStep[];
}

// ─────────────────────────────────────────────
// メインチュートリアル: はじめてガイド
// ─────────────────────────────────────────────
const mainTutorial: TutorialDefinition = {
  id: 'main',
  nameKey: 'tutorial.menu.main',
  steps: [
    {
      id: 'main-1-content',
      target: '[data-tutorial-first-item]',
      pill: 'click',
      messageKey: 'tutorial.main.content.message',
      descriptionKey: 'tutorial.main.content.description',
      completionEvent: 'content:selected',
    },
    {
      id: 'main-2-party-open',
      target: '[data-tutorial="party-comp"]',
      pill: 'click',
      messageKey: 'tutorial.main.party_open.message',
      descriptionKey: 'tutorial.main.party_open.description',
      completionEvent: 'party:opened',
    },
    {
      id: 'main-3-wrong-slot',
      target: '[data-tutorial="party-healer-slot"]',
      pill: 'click',
      messageKey: 'tutorial.main.wrong_slot.message',
      descriptionKey: 'tutorial.main.wrong_slot.description',
      completionEvent: 'party:job-set',
    },
    {
      id: 'main-4-delete-job',
      target: null, // 配置されたジョブを動的に取得
      pill: 'click',
      messageKey: 'tutorial.main.delete_job.message',
      descriptionKey: 'tutorial.main.delete_job.description',
      completionEvent: 'party:job-removed',
    },
    {
      id: 'main-5-pick-two',
      target: '[data-tutorial="party-palette-pick"]',
      pill: 'click',
      messageKey: 'tutorial.main.pick_two.message',
      descriptionKey: 'tutorial.main.pick_two.description',
      completionEvent: 'party:two-set',
    },
    {
      id: 'main-6-auto-fill',
      target: null,
      pill: 'check',
      messageKey: 'tutorial.main.auto_fill.message',
      completionEvent: 'party:auto-filled',
      animation: 'party-auto-fill',
    },
    {
      id: 'main-7-party-close',
      target: '[data-tutorial="party-settings-close-btn"]',
      pill: 'click',
      messageKey: 'tutorial.main.party_close.message',
      completionEvent: 'party:closed',
    },
    {
      id: 'main-8-miti-place',
      target: '[data-tutorial="tutorial-damage-cell-4-aoe"]',
      pill: 'check',
      messageKey: 'tutorial.main.damage_check.message',
      descriptionKey: 'tutorial.main.damage_check.description',
      completionEvent: 'mitigation:cell-clicked',
      animation: 'pill-fly',
      pillTransition: {
        toTarget: '[data-tutorial="miti-cell-st-4"]',
        toLabel: 'click',
      },
    },
    {
      id: 'main-9-select-miti',
      target: '[data-tutorial="tutorial-skill-reprisal"]',
      pill: 'click',
      messageKey: 'tutorial.main.select_miti.message',
      descriptionKey: 'tutorial.main.select_miti.description',
      completionEvent: 'mitigation:added',
    },
    {
      id: 'main-10-complete',
      target: null,
      pill: 'next',
      messageKey: 'tutorial.main.complete.message',
      completionEvent: 'tutorial:dismissed',
      animation: 'completion-card',
    },
  ],
};

// ─────────────────────────────────────────────
// 個別チュートリアル: 攻撃の追加
// ─────────────────────────────────────────────
const addEventTutorial: TutorialDefinition = {
  id: 'add-event',
  nameKey: 'tutorial.menu.add_event',
  steps: [
    {
      id: 'add-1-name',
      target: '[data-tutorial="event-name-input"]',
      pill: 'click',
      messageKey: 'tutorial.add_event.name.message',
      descriptionKey: 'tutorial.add_event.name.description',
      completionEvent: 'event:name-entered',
    },
    {
      id: 'add-2-damage',
      target: '[data-tutorial="event-actual-damage-input"]',
      pill: 'click',
      messageKey: 'tutorial.add_event.damage.message',
      descriptionKey: 'tutorial.add_event.damage.description',
      image: '/images/tutorial/ff14-damage-screenshot.webp',
      completionEvent: 'event:damage-entered',
    },
    {
      id: 'add-3-miti',
      target: '[data-tutorial="tutorial-skill-target"]',
      pill: 'click',
      messageKey: 'tutorial.add_event.miti.message',
      completionEvent: 'event:miti-selected',
    },
    {
      id: 'add-4-save',
      target: '[data-tutorial="event-save-btn"]',
      pill: 'click',
      messageKey: 'tutorial.add_event.save.message',
      completionEvent: 'event:saved',
    },
  ],
};

// ─────────────────────────────────────────────
// 個別チュートリアル: 共有のしかた
// ─────────────────────────────────────────────
const shareTutorial: TutorialDefinition = {
  id: 'share',
  nameKey: 'tutorial.menu.share',
  steps: [
    {
      id: 'share-1-copy',
      target: '[data-tutorial="share-copy-btn"]',
      pill: 'check',
      messageKey: 'tutorial.share.copy.message',
      descriptionKey: 'tutorial.share.copy.description',
      completionEvent: 'share:url-copied',
    },
    {
      id: 'share-2-logo',
      target: null,
      pill: 'next',
      messageKey: 'tutorial.share.logo.message',
      descriptionKey: 'tutorial.share.logo.description',
      completionEvent: 'share:tutorial-done',
    },
  ],
};

// ─────────────────────────────────────────────
// 全チュートリアル定義をエクスポート
// ─────────────────────────────────────────────
export const TUTORIALS: Record<string, TutorialDefinition> = {
  main: mainTutorial,
  'add-event': addEventTutorial,
  share: shareTutorial,
};

export const TUTORIAL_IDS = Object.keys(TUTORIALS) as string[];
```

- [ ] **Step 2: ビルド確認**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: 型エラーなし（インポートされていないので当然）

- [ ] **Step 3: コミット**

```bash
git add src/data/tutorialDefinitions.ts
git commit -m "feat(tutorial): チュートリアル定義データ作成"
```

---

## Task 2: 新useTutorialStore

**Files:**
- Create: `src/store/useTutorialStore.ts` (旧ファイルを完全置き換え)

**重要:** 旧ファイルは753行。新ファイルはデータ駆動型で大幅に小さくなる。旧ファイルのエクスポート名（`useTutorialStore`, `TUTORIAL_STEPS`）を維持して、他ファイルのimportを壊さないようにする。ただし`TUTORIAL_STEPS`は新定義に差し替え。

- [ ] **Step 1: 旧ファイルを `useTutorialStore.old.ts` にリネーム（バックアップ）**

```bash
mv src/store/useTutorialStore.ts src/store/useTutorialStore.old.ts
```

- [ ] **Step 2: 新ストアを作成**

```typescript
// src/store/useTutorialStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { TUTORIALS, TUTORIAL_IDS, type TutorialStep } from '../data/tutorialDefinitions';
import { useMitigationStore, type TutorialSnapshot } from './useMitigationStore';
import { usePlanStore } from './usePlanStore';

// ─────────────────────────────────────────────
// 後方互換: 旧コードが TUTORIAL_STEPS を import している箇所向け
// ─────────────────────────────────────────────
export { type TutorialStep } from '../data/tutorialDefinitions';
export const TUTORIAL_STEPS = TUTORIALS.main.steps;

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface TutorialState {
  // 現在の状態
  activeTutorialId: string | null;
  currentStep: number;
  isActive: boolean;

  // 完了状態（localStorage永続化）
  completed: Record<string, boolean>;

  // 退避フラグ
  pendingExit: boolean;

  // 旧コードとの互換用
  hasCompleted: boolean;
  hasVisitedShare: boolean;
  currentStepIndex: number;

  // スナップショット（メインチュートリアル用）
  _savedSnapshot: TutorialSnapshot | null;
  _savedPlanId: string | null;

  // アクション
  startTutorial: (id?: string) => void;
  completeEvent: (eventName: string) => void;
  skipTutorial: () => void;
  requestExit: () => void;
  confirmExit: () => void;
  cancelExit: () => void;
  resetTutorial: () => void;
  setVisitedShare: () => void;

  // 旧互換
  startFromStep: (step: number) => void;
  completeTutorial: () => void;

  // ヘルパー
  getCurrentStep: () => TutorialStep | null;
  getActiveTutorial: () => typeof TUTORIALS[string] | null;
}

// ─────────────────────────────────────────────
// ヘルパー: チュートリアル終了時の状態復元
// ─────────────────────────────────────────────
function restoreUserState(state: TutorialState) {
  const mitiState = useMitigationStore.getState();
  const planStore = usePlanStore.getState();

  // チュートリアル専用プランを削除
  const tutorialPlan = planStore.plans.find(p =>
    p.title.endsWith('_チュートリアル') || p.title.endsWith('_Tutorial')
  );
  if (tutorialPlan) {
    planStore.deletePlan(tutorialPlan.id);
  }

  // 元のプランに復元
  if (state._savedPlanId) {
    const savedPlan = planStore.getPlan(state._savedPlanId);
    if (savedPlan) {
      mitiState.loadSnapshot(savedPlan.data);
      planStore.setCurrentPlanId(state._savedPlanId);
    } else if (state._savedSnapshot) {
      mitiState.restoreFromSnapshot(state._savedSnapshot);
    }
  } else if (state._savedSnapshot) {
    mitiState.restoreFromSnapshot(state._savedSnapshot);
  }
}

// ─────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────
export const useTutorialStore = create<TutorialState>()(
  persist(
    (set, get) => ({
      // 状態
      activeTutorialId: null,
      currentStep: 0,
      isActive: false,
      completed: Object.fromEntries(TUTORIAL_IDS.map(id => [id, false])),
      pendingExit: false,
      hasCompleted: false,
      hasVisitedShare: false,
      currentStepIndex: 0,
      _savedSnapshot: null,
      _savedPlanId: null,

      // ─── アクション ───

      startTutorial: (id = 'main') => {
        const tutorial = TUTORIALS[id];
        if (!tutorial) return;

        const mitiState = useMitigationStore.getState();
        const planStore = usePlanStore.getState();

        // メインチュートリアルの場合、現在の状態を退避
        let snapshot: TutorialSnapshot | null = null;
        let savedPlanId: string | null = null;
        if (id === 'main') {
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
          mitiState.resetForTutorial();
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

      completeEvent: (eventName: string) => {
        const { isActive, activeTutorialId, currentStep } = get();
        if (!isActive || !activeTutorialId) return;

        const tutorial = TUTORIALS[activeTutorialId];
        if (!tutorial) return;

        const step = tutorial.steps[currentStep];
        if (!step) return;

        if (step.completionEvent === eventName) {
          const nextStep = currentStep + 1;
          if (nextStep >= tutorial.steps.length) {
            // チュートリアル完了
            get().completeTutorial();
          } else {
            set({
              currentStep: nextStep,
              currentStepIndex: nextStep,
            });
          }
        }
      },

      completeTutorial: () => {
        const { activeTutorialId } = get();
        if (!activeTutorialId) return;

        // メインチュートリアルの場合は状態復元
        if (activeTutorialId === 'main') {
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

      skipTutorial: () => {
        set({ pendingExit: true });
      },

      requestExit: () => {
        set({ pendingExit: true });
      },

      confirmExit: () => {
        const { activeTutorialId } = get();
        if (activeTutorialId === 'main') {
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

      cancelExit: () => {
        set({ pendingExit: false });
      },

      resetTutorial: () => {
        set({
          activeTutorialId: null,
          currentStep: 0,
          isActive: false,
          completed: Object.fromEntries(TUTORIAL_IDS.map(id => [id, false])),
          hasCompleted: false,
          hasVisitedShare: false,
          pendingExit: false,
          currentStepIndex: 0,
          _savedSnapshot: null,
          _savedPlanId: null,
        });
      },

      setVisitedShare: () => {
        set({ hasVisitedShare: true });
      },

      // 旧互換: startFromStep(1) → startTutorial('main')
      startFromStep: (_step: number) => {
        get().startTutorial('main');
      },

      // ヘルパー
      getCurrentStep: () => {
        const { activeTutorialId, currentStep } = get();
        if (!activeTutorialId) return null;
        return TUTORIALS[activeTutorialId]?.steps[currentStep] ?? null;
      },

      getActiveTutorial: () => {
        const { activeTutorialId } = get();
        if (!activeTutorialId) return null;
        return TUTORIALS[activeTutorialId] ?? null;
      },
    }),
    {
      name: 'tutorial-storage',
      partialize: (state) => ({
        completed: state.completed,
        hasCompleted: state.hasCompleted,
        hasVisitedShare: state.hasVisitedShare,
      }),
    }
  )
);
```

- [ ] **Step 3: ビルド確認**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: useTutorialStoreのimport元が変わっていないので、旧コードのimport先を維持。型エラーがあれば修正。

注意: `TutorialSnapshot`の型は`useMitigationStore`からexportされている。存在を確認すること:
```bash
grep -n "TutorialSnapshot" src/store/useMitigationStore.ts | head -5
```

- [ ] **Step 4: コミット**

```bash
git add src/store/useTutorialStore.ts src/store/useTutorialStore.old.ts src/data/tutorialDefinitions.ts
git commit -m "feat(tutorial): 新useTutorialStore + データ駆動型定義"
```

---

## Task 3: TutorialPill コンポーネント

**Files:**
- Create: `src/components/tutorial/TutorialPill.tsx`

- [ ] **Step 1: tutorialディレクトリ作成**

```bash
mkdir -p src/components/tutorial/animations
```

- [ ] **Step 2: TutorialPill.tsx を作成**

```tsx
// src/components/tutorial/TutorialPill.tsx
import { motion } from 'framer-motion';
import type { PillLabel } from '../../data/tutorialDefinitions';

interface TutorialPillProps {
  label: PillLabel;
  top: number;
  left: number;
  visible: boolean;
}

const LABEL_TEXT: Record<PillLabel, string> = {
  click: 'CLICK',
  tap: 'TAP',
  check: 'CHECK',
  next: 'NEXT',
};

/**
 * 緑ピルインジケーター
 * ボタン自体のCSSをいじらず、近くに浮かぶ独立した「アピール物体」。
 * #22c55e ビビッドグリーン。ダーク/ライト両対応。
 */
export function TutorialPill({ label, top, left, visible }: TutorialPillProps) {
  if (!visible) return null;

  return (
    <motion.div
      className="fixed z-[10003] pointer-events-none"
      animate={{
        top,
        left,
        y: [0, 6, 0],
      }}
      transition={{
        top: { type: 'spring', stiffness: 200, damping: 25 },
        left: { type: 'spring', stiffness: 200, damping: 25 },
        y: { duration: 1.4, ease: [0.36, 0, 0.66, 1], repeat: Infinity },
      }}
      style={{ top, left }}
    >
      <div
        className="flex items-center gap-[5px] rounded-full px-[11px] py-[3px]"
        style={{
          backgroundColor: '#22c55e',
          boxShadow: '0 2px 10px rgba(34, 197, 94, 0.4)',
        }}
      >
        <motion.span
          key={label}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="text-[10px] font-bold text-white tracking-[0.8px]"
          style={{ fontFamily: 'system-ui' }}
        >
          {LABEL_TEXT[label]}
        </motion.span>
        <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
          <path
            d="M1 1 L4 4.5 L7 1"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 3: コミット**

```bash
git add src/components/tutorial/TutorialPill.tsx
git commit -m "feat(tutorial): TutorialPill コンポーネント"
```

---

## Task 4: TutorialCard コンポーネント

**Files:**
- Create: `src/components/tutorial/TutorialCard.tsx`

- [ ] **Step 1: TutorialCard.tsx を作成**

```tsx
// src/components/tutorial/TutorialCard.tsx
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

interface TutorialCardProps {
  messageKey: string;
  descriptionKey?: string;
  image?: string;
  top: number;
  left: number;
  visible: boolean;
  onSkip?: () => void;
}

/**
 * 緑系の吹き出しカード。ピルと統一感のあるデザイン。
 * 画像スロットあり（スクショ等を表示可能）。
 */
export function TutorialCard({
  messageKey,
  descriptionKey,
  image,
  top,
  left,
  visible,
  onSkip,
}: TutorialCardProps) {
  const { t } = useTranslation();

  if (!visible) return null;

  return (
    <motion.div
      className="fixed z-[10002] pointer-events-auto"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1, top, left }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{
        top: { type: 'spring', stiffness: 200, damping: 25 },
        left: { type: 'spring', stiffness: 200, damping: 25 },
        opacity: { duration: 0.2 },
        scale: { duration: 0.2 },
      }}
      style={{
        top,
        left,
        maxWidth: 300,
      }}
    >
      <div
        className="rounded-xl p-4 shadow-lg"
        style={{
          backgroundColor: 'rgba(34, 197, 94, 0.12)',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          backdropFilter: 'blur(8px)',
        }}
      >
        {image && (
          <img
            src={image}
            alt=""
            className="w-full rounded-lg mb-3"
            style={{ maxHeight: 120, objectFit: 'cover' }}
          />
        )}
        <p className="text-sm font-semibold text-app-text">
          {t(messageKey)}
        </p>
        {descriptionKey && (
          <p className="text-xs text-app-text-muted mt-1">
            {t(descriptionKey)}
          </p>
        )}
        {onSkip && (
          <button
            onClick={onSkip}
            className="text-[10px] text-app-text-muted mt-2 underline underline-offset-2 hover:text-app-text transition-colors"
          >
            {t('tutorial.skip')}
          </button>
        )}
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 2: コミット**

```bash
git add src/components/tutorial/TutorialCard.tsx
git commit -m "feat(tutorial): TutorialCard 吹き出しコンポーネント"
```

---

## Task 5: TutorialBlocker コンポーネント

**Files:**
- Create: `src/components/tutorial/TutorialBlocker.tsx`

- [ ] **Step 1: TutorialBlocker.tsx を作成**

```tsx
// src/components/tutorial/TutorialBlocker.tsx

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface TutorialBlockerProps {
  targetRect: TargetRect | null;
  active: boolean;
}

/**
 * クリックブロック層。
 * 画面全体を覆い、ターゲット領域だけclipPathでくり抜く。
 * 画面を暗くしない（スポットライト廃止）。
 */
export function TutorialBlocker({ targetRect, active }: TutorialBlockerProps) {
  if (!active) return null;

  // ターゲットがない場合は全画面ブロック
  const clipPath = targetRect
    ? buildClipPath(targetRect)
    : undefined;

  return (
    <div
      className="fixed inset-0 z-[10001]"
      style={{
        pointerEvents: 'auto',
        clipPath,
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    />
  );
}

/**
 * evenodd clipPathでターゲット領域をくり抜く。
 * 外側の矩形が全画面、内側の矩形がターゲット。
 */
function buildClipPath(rect: TargetRect): string {
  const pad = 4;
  const x = rect.left - pad;
  const y = rect.top - pad;
  const w = rect.width + pad * 2;
  const h = rect.height + pad * 2;
  const r = 8; // 角丸

  // SVG path: 外側（全画面を時計回り）+ 内側（角丸矩形を反時計回り）
  return `path(evenodd, "\
M 0 0 L 100vw 0 L 100vw 100vh L 0 100vh Z \
M ${x + r} ${y} \
L ${x + w - r} ${y} Q ${x + w} ${y} ${x + w} ${y + r} \
L ${x + w} ${y + h - r} Q ${x + w} ${y + h} ${x + w - r} ${y + h} \
L ${x + r} ${y + h} Q ${x} ${y + h} ${x} ${y + h - r} \
L ${x} ${y + r} Q ${x} ${y} ${x + r} ${y} Z")`;
}
```

注意: `clipPath`のpath構文がブラウザで動作しない場合は、SVGオーバーレイ方式にフォールバックする。実装時にChrome/Firefox/Safariで検証すること。旧コードの`clipPath`実装（TutorialOverlay.tsx旧）を参考にする。

- [ ] **Step 2: コミット**

```bash
git add src/components/tutorial/TutorialBlocker.tsx
git commit -m "feat(tutorial): TutorialBlocker クリックブロック層"
```

---

## Task 6: TutorialMenu コンポーネント

**Files:**
- Create: `src/components/tutorial/TutorialMenu.tsx`

- [ ] **Step 1: TutorialMenu.tsx を作成**

```tsx
// src/components/tutorial/TutorialMenu.tsx
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { HelpCircle, Check } from 'lucide-react';
import { useTutorialStore } from '../../store/useTutorialStore';
import { TUTORIALS, TUTORIAL_IDS } from '../../data/tutorialDefinitions';
import clsx from 'clsx';

interface TutorialMenuProps {
  /** ConsolidatedHeaderから受け取るボタンスタイル */
  btnClassName: string;
}

/**
 * 「チュートリアルを見る」ボタン + ドロップダウンメニュー。
 * ボタンの見た目は既存のまま。クリックでメニュー表示。
 */
export function TutorialMenu({ btnClassName }: TutorialMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const completed = useTutorialStore(s => s.completed);

  // 外側クリックで閉じる
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(prev => !prev)}
        className={btnClassName}
      >
        <HelpCircle size={14} className="group-hover:rotate-12 transition-transform duration-300 shrink-0" />
        <span className="text-[10px] font-black uppercase tracking-[0.1em]">
          {t('app.view_tutorial')}
        </span>
      </button>

      {open && (
        <div
          className="absolute top-full right-0 mt-1 min-w-[180px] rounded-lg border border-app-text/15 bg-app-bg shadow-lg py-1 z-50"
        >
          {TUTORIAL_IDS.map(id => {
            const tutorial = TUTORIALS[id];
            const isDone = completed[id] ?? false;
            return (
              <button
                key={id}
                onClick={() => {
                  setOpen(false);
                  useTutorialStore.getState().startTutorial(id);
                }}
                className={clsx(
                  'w-full text-left px-3 py-2 text-xs flex items-center gap-2',
                  'hover:bg-app-text/5 transition-colors'
                )}
              >
                <span className="w-4 flex-shrink-0">
                  {isDone && <Check size={12} className="text-[#22c55e]" />}
                </span>
                <span className="text-app-text">{t(tutorial.nameKey)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: コミット**

```bash
git add src/components/tutorial/TutorialMenu.tsx
git commit -m "feat(tutorial): TutorialMenu ドロップダウンメニュー"
```

---

## Task 7: TutorialOverlay オーケストレーター

**Files:**
- Create: `src/components/tutorial/TutorialOverlay.tsx`

- [ ] **Step 1: TutorialOverlay.tsx を作成**

このコンポーネントは Pill, Card, Blocker を統合し、現在のステップに応じて座標計算と表示制御を行う。

```tsx
// src/components/tutorial/TutorialOverlay.tsx
import { useEffect, useState, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useTutorialStore } from '../../store/useTutorialStore';
import { TutorialPill } from './TutorialPill';
import { TutorialCard } from './TutorialCard';
import { TutorialBlocker } from './TutorialBlocker';
import { PartyAutoFill } from './animations/PartyAutoFill';
import { PillFly } from './animations/PillFly';
import { CompletionCard } from './animations/CompletionCard';
import type { TutorialStep } from '../../data/tutorialDefinitions';

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * ターゲット要素のDOM座標をrequestAnimationFrameで追跡する
 */
function useTargetRect(selector: string | null): TargetRect | null {
  const [rect, setRect] = useState<TargetRect | null>(null);

  useEffect(() => {
    if (!selector) {
      setRect(null);
      return;
    }

    let frameId: number;
    let lastStr = '';

    const measure = () => {
      const el = document.querySelector(selector);
      if (el) {
        const r = el.getBoundingClientRect();
        const str = `${r.x},${r.y},${r.width},${r.height}`;
        if (str !== lastStr) {
          lastStr = str;
          setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
        }
      } else {
        if (lastStr !== '') {
          lastStr = '';
          setRect(null);
        }
      }
      frameId = requestAnimationFrame(measure);
    };

    frameId = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(frameId);
  }, [selector]);

  return rect;
}

/**
 * ピルの表示位置を計算（ターゲットの上・中央）
 */
function calcPillPos(rect: TargetRect | null): { top: number; left: number } {
  if (!rect) return { top: -100, left: -100 };
  return {
    top: rect.top - 32,
    left: rect.left + rect.width / 2 - 28,
  };
}

/**
 * カードの表示位置を計算（ターゲットの下、または空きスペース）
 */
function calcCardPos(rect: TargetRect | null): { top: number; left: number } {
  if (!rect) return { top: window.innerHeight / 2 - 80, left: window.innerWidth / 2 - 150 };

  const cardWidth = 300;
  const cardHeight = 120;
  const gap = 12;

  // デフォルト: 下に表示
  let top = rect.top + rect.height + gap;
  let left = rect.left + rect.width / 2 - cardWidth / 2;

  // 画面外にはみ出る場合は上に
  if (top + cardHeight > window.innerHeight - 20) {
    top = rect.top - cardHeight - gap;
  }

  // 左右のクランプ
  left = Math.max(16, Math.min(left, window.innerWidth - cardWidth - 16));
  top = Math.max(16, top);

  return { top, left };
}

export function TutorialOverlay() {
  const isActive = useTutorialStore(s => s.isActive);
  const activeTutorialId = useTutorialStore(s => s.activeTutorialId);
  const currentStepNum = useTutorialStore(s => s.currentStep);
  const pendingExit = useTutorialStore(s => s.pendingExit);

  const step = useTutorialStore(s => s.getCurrentStep());
  const targetRect = useTargetRect(step?.target ?? null);

  const pillPos = calcPillPos(targetRect);
  const cardPos = calcCardPos(targetRect);

  const handleSkip = useCallback(() => {
    useTutorialStore.getState().requestExit();
  }, []);

  if (!isActive || !step) return null;

  // 特殊演出のレンダリング
  const renderAnimation = () => {
    switch (step.animation) {
      case 'party-auto-fill':
        return <PartyAutoFill onComplete={() => {
          useTutorialStore.getState().completeEvent('party:auto-filled');
        }} />;
      case 'pill-fly':
        return step.pillTransition ? (
          <PillFly
            fromRect={targetRect}
            toSelector={step.pillTransition.toTarget}
            fromLabel={step.pill}
            toLabel={step.pillTransition.toLabel}
          />
        ) : null;
      case 'completion-card':
        return <CompletionCard onDismiss={() => {
          useTutorialStore.getState().completeEvent('tutorial:dismissed');
        }} />;
      default:
        return null;
    }
  };

  return (
    <>
      {/* クリックブロック */}
      <TutorialBlocker
        targetRect={targetRect}
        active={!step.animation || step.animation === 'pill-fly'}
      />

      <AnimatePresence mode="wait">
        {/* 特殊演出 */}
        {step.animation && renderAnimation()}

        {/* 通常ピル（演出中は非表示） */}
        {!step.animation && (
          <TutorialPill
            key={`pill-${step.id}`}
            label={step.pill}
            top={pillPos.top}
            left={pillPos.left}
            visible={!!targetRect}
          />
        )}

        {/* 吹き出しカード（完了画面は専用コンポーネント） */}
        {step.animation !== 'completion-card' && (
          <TutorialCard
            key={`card-${step.id}`}
            messageKey={step.messageKey}
            descriptionKey={step.descriptionKey}
            image={step.image}
            top={cardPos.top}
            left={cardPos.left}
            visible={true}
            onSkip={handleSkip}
          />
        )}
      </AnimatePresence>

      {/* 終了確認ダイアログ */}
      {pendingExit && (
        <ExitDialog />
      )}
    </>
  );
}

function ExitDialog() {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-[10010] flex items-center justify-center bg-black/50">
      <div className="bg-app-bg border border-app-text/15 rounded-xl p-6 max-w-xs text-center shadow-xl">
        <p className="text-sm text-app-text font-semibold mb-4">
          {t('tutorial.exit_confirm')}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => useTutorialStore.getState().cancelExit()}
            className="px-4 py-2 text-xs rounded-lg border border-app-text/15 text-app-text hover:bg-app-text/5 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={() => useTutorialStore.getState().confirmExit()}
            className="px-4 py-2 text-xs rounded-lg bg-app-text text-app-bg font-semibold hover:opacity-80 transition-opacity"
          >
            {t('tutorial.exit_yes')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ExitDialog内でuseTranslationが必要
import { useTranslation } from 'react-i18next';
```

注意: 末尾のimportは実際にはファイル先頭にまとめる。実装時に修正すること。

- [ ] **Step 2: コミット**

```bash
git add src/components/tutorial/TutorialOverlay.tsx
git commit -m "feat(tutorial): TutorialOverlay オーケストレーター"
```

---

## Task 8: 特殊演出コンポーネント（3つ）

**Files:**
- Create: `src/components/tutorial/animations/PartyAutoFill.tsx`
- Create: `src/components/tutorial/animations/PillFly.tsx`
- Create: `src/components/tutorial/animations/CompletionCard.tsx`

- [ ] **Step 1: PartyAutoFill.tsx を作成**

パレットのジョブアイコンの分身が弧を描いてスロットへ飛行する演出。
`getBoundingClientRect()`でパレットアイコンとスロットの座標を取得し、Framer Motionのanimate で弧の軌道を生成。

```tsx
// src/components/tutorial/animations/PartyAutoFill.tsx
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface PartyAutoFillProps {
  onComplete: () => void;
}

interface FlyingJob {
  id: string;
  iconSrc: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  delay: number;
}

/**
 * パーティ自動埋めアニメーション。
 * パレットのジョブアイコンの「分身」がスロットへ飛行する。
 * 残り6枠分のプリセットジョブを使用。
 */
export function PartyAutoFill({ onComplete }: PartyAutoFillProps) {
  const [jobs, setJobs] = useState<FlyingJob[]>([]);
  const [completedCount, setCompletedCount] = useState(0);

  useEffect(() => {
    // パレット上の未配置ジョブアイコンと空きスロットの座標を取得
    const paletteIcons = document.querySelectorAll('[data-tutorial="job-palette"] [data-job-id]');
    const emptySlots = document.querySelectorAll('[data-tutorial="party-slots-target"] [data-slot-empty="true"]');

    const flyingJobs: FlyingJob[] = [];
    const slotsArray = Array.from(emptySlots);

    slotsArray.forEach((slot, i) => {
      const icon = paletteIcons[i % paletteIcons.length];
      if (!icon) return;

      const iconRect = icon.getBoundingClientRect();
      const slotRect = slot.getBoundingClientRect();
      const img = icon.querySelector('img');

      flyingJobs.push({
        id: `fly-${i}`,
        iconSrc: img?.src ?? '',
        fromX: iconRect.left + iconRect.width / 2,
        fromY: iconRect.top + iconRect.height / 2,
        toX: slotRect.left + slotRect.width / 2,
        toY: slotRect.top + slotRect.height / 2,
        delay: i * 0.15,
      });
    });

    setJobs(flyingJobs);
  }, []);

  useEffect(() => {
    if (jobs.length > 0 && completedCount >= jobs.length) {
      // 全ジョブが着地したら少し待ってから完了
      const timer = setTimeout(onComplete, 400);
      return () => clearTimeout(timer);
    }
  }, [completedCount, jobs.length, onComplete]);

  return (
    <>
      {jobs.map(job => (
        <motion.div
          key={job.id}
          className="fixed z-[10005] pointer-events-none"
          initial={{ x: job.fromX - 16, y: job.fromY - 16, scale: 1, opacity: 1 }}
          animate={{
            x: [job.fromX - 16, job.fromX + (Math.random() - 0.5) * 200, job.toX - 16],
            y: [job.fromY - 16, job.fromY - 80 - Math.random() * 60, job.toY - 16],
            scale: [1, 1.3, 1],
            opacity: [1, 1, 1],
          }}
          transition={{
            duration: 0.7,
            delay: job.delay,
            ease: [0.34, 1.56, 0.64, 1],
          }}
          onAnimationComplete={() => setCompletedCount(c => c + 1)}
        >
          {job.iconSrc && (
            <img src={job.iconSrc} alt="" className="w-8 h-8 rounded-full" />
          )}
        </motion.div>
      ))}
    </>
  );
}
```

注意: パレットアイコンとスロットのセレクタ（`data-job-id`, `data-slot-empty`）は実装時にPartySettingsModal.tsxの実際のDOMに合わせて調整すること。

- [ ] **Step 2: PillFly.tsx を作成**

ピルがCHECK状態でダメージセル横に表示 → 1.5秒後に軽減セルへ飛行 → CLICKに変化。

```tsx
// src/components/tutorial/animations/PillFly.tsx
import { useEffect, useState } from 'react';
import { TutorialPill } from '../TutorialPill';
import type { PillLabel } from '../../../data/tutorialDefinitions';

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface PillFlyProps {
  fromRect: TargetRect | null;
  toSelector: string;
  fromLabel: PillLabel;
  toLabel: PillLabel;
}

/**
 * ピル飛行変化アニメーション。
 * CHECK → 1.5秒待ち → 飛行 → CLICK に変化。
 */
export function PillFly({ fromRect, toSelector, fromLabel, toLabel }: PillFlyProps) {
  const [phase, setPhase] = useState<'check' | 'fly'>('check');
  const [toRect, setToRect] = useState<TargetRect | null>(null);

  // 飛行先の座標を取得
  useEffect(() => {
    const el = document.querySelector(toSelector);
    if (el) {
      const r = el.getBoundingClientRect();
      setToRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    }
  }, [toSelector]);

  // 1.5秒後に飛行開始
  useEffect(() => {
    const timer = setTimeout(() => setPhase('fly'), 1500);
    return () => clearTimeout(timer);
  }, []);

  const currentRect = phase === 'check' ? fromRect : toRect;
  const currentLabel = phase === 'check' ? fromLabel : toLabel;

  const pos = currentRect
    ? { top: currentRect.top - 32, left: currentRect.left + currentRect.width / 2 - 28 }
    : { top: -100, left: -100 };

  return (
    <TutorialPill
      label={currentLabel}
      top={pos.top}
      left={pos.left}
      visible={!!currentRect}
    />
  );
}
```

- [ ] **Step 3: CompletionCard.tsx を作成**

```tsx
// src/components/tutorial/animations/CompletionCard.tsx
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Share2, PlusCircle, HelpCircle } from 'lucide-react';

interface CompletionCardProps {
  onDismiss: () => void;
}

/**
 * チュートリアル完了画面。
 * お祝いメッセージ + 機能紹介リスト + チュートリアルメニューの場所案内。
 */
export function CompletionCard({ onDismiss }: CompletionCardProps) {
  const { t } = useTranslation();

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
          {t('tutorial.completion.title')}
        </h2>
        <p className="text-sm text-app-text-muted text-center mb-4">
          {t('tutorial.completion.subtitle')}
        </p>

        <div className="space-y-3 mb-5">
          <FeatureHint
            icon={<Share2 size={14} />}
            text={t('tutorial.completion.share_hint')}
          />
          <FeatureHint
            icon={<PlusCircle size={14} />}
            text={t('tutorial.completion.new_plan_hint')}
          />
          <FeatureHint
            icon={<HelpCircle size={14} />}
            text={t('tutorial.completion.menu_hint')}
          />
        </div>

        <button
          onClick={onDismiss}
          className="w-full py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80"
          style={{ backgroundColor: '#22c55e', color: 'white' }}
        >
          {t('tutorial.completion.start_button')}
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

- [ ] **Step 4: コミット**

```bash
git add src/components/tutorial/animations/
git commit -m "feat(tutorial): 特殊演出3コンポーネント（PartyAutoFill, PillFly, CompletionCard）"
```

---

## Task 9: i18nキー追加

**Files:**
- Modify: `src/locales/ja.json`
- Modify: `src/locales/en.json`

- [ ] **Step 1: ja.json の tutorialセクションを新構造に置き換え**

旧チュートリアルキー（`tutorial.portal_select_title`等）を全て削除し、新キーに置き換える。

旧キー（`tutorial`オブジェクト全体）を以下に差し替え:

```json
"tutorial": {
    "skip": "スキップ",
    "exit_confirm": "チュートリアルを終了しますか？",
    "exit_yes": "終了する",
    "menu": {
        "main": "はじめてガイド",
        "add_event": "攻撃の追加",
        "share": "共有のしかた"
    },
    "main": {
        "content": {
            "message": "戦うボスを選ぼう",
            "description": "サイドバーからコンテンツを選んで、タイムラインを読み込みましょう。"
        },
        "party_open": {
            "message": "パーティを編成しよう",
            "description": "上部の「パーティ編成」ボタンを押してメンバーを設定します。"
        },
        "wrong_slot": {
            "message": "好きなところに入れてみよう",
            "description": "ロールに関係なく、どのスロットにもジョブを配置できます。試しにここに入れてみましょう！"
        },
        "delete_job": {
            "message": "間違えても大丈夫！",
            "description": "クリックして削除できます。何度でもやり直せます。"
        },
        "pick_two": {
            "message": "ジョブを選んでみよう",
            "description": "パレットから好きなジョブを2つクリックしてください。空いているスロットに自動で配置されます。"
        },
        "auto_fill": {
            "message": "残りはおまかせ！"
        },
        "party_close": {
            "message": "パーティ編成完了！閉じましょう"
        },
        "damage_check": {
            "message": "このダメージは致死量です！",
            "description": "赤い数字は軽減なしでは全滅するダメージです。軽減を置いて生き残りましょう。"
        },
        "select_miti": {
            "message": "軽減を選ぼう",
            "description": "リプライザルを選んでパーティ全体を守りましょう！"
        },
        "complete": {
            "message": "チュートリアル完了！"
        }
    },
    "add_event": {
        "name": {
            "message": "攻撃名を入力しよう",
            "description": "ボスの技名を入力してください。"
        },
        "damage": {
            "message": "受けるダメージを入力",
            "description": "実際のゲーム中に表示されたダメージ値を入力しましょう。"
        },
        "miti": {
            "message": "軽減を選ぼう"
        },
        "save": {
            "message": "追加で保存！"
        }
    },
    "share": {
        "copy": {
            "message": "共有URLをコピー",
            "description": "このURLを仲間に送ると、あなたの軽減表を見てもらえます。"
        },
        "logo": {
            "message": "チームロゴを設定できるよ！",
            "description": "ログインするとOGP画像にチームロゴを表示できます。共有がもっと楽しくなります！"
        }
    },
    "completion": {
        "title": "基本操作はこれで完璧！",
        "subtitle": "これで軽減表を自由に作れます。便利な機能も試してみてください。",
        "share_hint": "プランを共有できます。ログインするとチームロゴも設定できるよ！",
        "new_plan_hint": "リストにないコンテンツは「新規作成」から自由に作成できます。",
        "menu_hint": "チュートリアルはいつでも「チュートリアルを見る」から見返せます。",
        "start_button": "はじめる"
    }
}
```

- [ ] **Step 2: en.json の tutorialセクションも同様に置き換え**

```json
"tutorial": {
    "skip": "Skip",
    "exit_confirm": "Exit tutorial?",
    "exit_yes": "Exit",
    "menu": {
        "main": "Getting Started",
        "add_event": "Adding Attacks",
        "share": "How to Share"
    },
    "main": {
        "content": {
            "message": "Choose a boss",
            "description": "Select content from the sidebar to load the timeline."
        },
        "party_open": {
            "message": "Set up your party",
            "description": "Click the Party Comp button to configure your team."
        },
        "wrong_slot": {
            "message": "Try placing a job here",
            "description": "You can place any job in any slot, regardless of role. Give it a try!"
        },
        "delete_job": {
            "message": "Mistakes are OK!",
            "description": "Click to remove it. You can redo this anytime."
        },
        "pick_two": {
            "message": "Pick two jobs",
            "description": "Click two jobs from the palette. They'll auto-fill into empty slots."
        },
        "auto_fill": {
            "message": "We'll handle the rest!"
        },
        "party_close": {
            "message": "Party's ready! Close this window"
        },
        "damage_check": {
            "message": "This damage is lethal!",
            "description": "Red numbers mean the party will wipe without mitigation. Let's fix that."
        },
        "select_miti": {
            "message": "Choose a mitigation",
            "description": "Select Reprisal to protect the whole party!"
        },
        "complete": {
            "message": "Tutorial complete!"
        }
    },
    "add_event": {
        "name": {
            "message": "Enter the attack name",
            "description": "Type the boss ability name."
        },
        "damage": {
            "message": "Enter the damage taken",
            "description": "Enter the damage value you saw in-game."
        },
        "miti": {
            "message": "Select mitigations"
        },
        "save": {
            "message": "Save it!"
        }
    },
    "share": {
        "copy": {
            "message": "Copy the share URL",
            "description": "Send this URL to your teammates so they can see your plan."
        },
        "logo": {
            "message": "Set a team logo!",
            "description": "Log in to add your team logo to the OGP image. Makes sharing even better!"
        }
    },
    "completion": {
        "title": "You've got the basics!",
        "subtitle": "You're ready to create your own mitigation plans. Try these features too.",
        "share_hint": "Share your plans with teammates. Log in to add a team logo!",
        "new_plan_hint": "Create plans for any content using the New Plan button.",
        "menu_hint": "Revisit tutorials anytime from the tutorial button.",
        "start_button": "Let's go"
    }
}
```

- [ ] **Step 3: コミット**

```bash
git add src/locales/ja.json src/locales/en.json
git commit -m "feat(tutorial): i18nキーを新チュートリアル構造に置き換え"
```

---

## Task 10: 既存コンポーネントとの統合

**Files:**
- Modify: `src/components/ConsolidatedHeader.tsx`
- Modify: `src/components/MitiPlannerPage.tsx`
- Delete: `src/components/TutorialOverlay.tsx` (旧)

- [ ] **Step 1: ConsolidatedHeader.tsx — チュートリアルボタンをTutorialMenuに差し替え**

旧コード（Line 233-247のbuttonブロック）を`TutorialMenu`に差し替え。

旧:
```tsx
<button
    onClick={() => { ... }}
    className={clsx(pillBtnBase, pillBtnDefault)}
>
    <HelpCircle size={14} ... />
    <span ...>{t('app.view_tutorial')}</span>
</button>
```

新:
```tsx
<TutorialMenu btnClassName={clsx(pillBtnBase, pillBtnDefault)} />
```

importに追加:
```tsx
import { TutorialMenu } from './tutorial/TutorialMenu';
```

旧importの`HelpCircle`は他で使っていないなら削除。`useTutorialStore`のimportも不要になったら削除。

- [ ] **Step 2: MitiPlannerPage.tsx — 起動ロジック簡素化**

旧コード（Line 28-50）の`startFromStep(1)`を`startTutorial('main')`に差し替え。

旧:
```tsx
if (!hasCompleted && !isActive && !hasVisitedShare && timelineEvents.length === 0) {
    const timer = setTimeout(() => startFromStep(1), 500);
```

新:
```tsx
if (!hasCompleted && !isActive && !hasVisitedShare && timelineEvents.length === 0) {
    const timer = setTimeout(() => useTutorialStore.getState().startTutorial('main'), 500);
```

- [ ] **Step 3: MitiPlannerPage.tsx — TutorialOverlayのimportを新パスに変更**

旧:
```tsx
import TutorialOverlay from '../TutorialOverlay'; // パスは実際のものを確認
```

新:
```tsx
import { TutorialOverlay } from './tutorial/TutorialOverlay';
```

- [ ] **Step 4: 旧TutorialOverlay.tsx を削除**

```bash
rm src/components/TutorialOverlay.tsx
```

- [ ] **Step 5: ビルド確認**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: 型エラーなし。旧`TUTORIAL_STEPS`や`completeEvent`のimportは互換エクスポートで維持されている。

- [ ] **Step 6: コミット**

```bash
git add -A
git commit -m "feat(tutorial): 既存コンポーネント統合 + 旧TutorialOverlay削除"
```

---

## Task 11: completeEventの統合（既存コンポーネント）

**Files:**
- Modify: `src/components/PartySettingsModal.tsx`
- Modify: `src/components/EventModal.tsx`
- Modify: `src/components/MitigationSelector.tsx`
- Modify: `src/store/useMitigationStore.ts`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/NewPlanModal.tsx`

- [ ] **Step 1: 既存のcompleteEvent呼び出しを新イベント名にマッピング**

旧イベント名と新イベント名のマッピング:

| 旧イベント名 | 新イベント名 | ファイル |
|---|---|---|
| `party-settings:opened` | `party:opened` | ConsolidatedHeader.tsx:296 |
| `party-settings:closed` | `party:closed` | PartySettingsModal.tsx:293 |
| `party:four-set` | (削除 — 新フローでは不使用) | PartySettingsModal.tsx:503, useMitigationStore.ts |
| `party:all-set` | (削除 — 新フローでは不使用) | PartySettingsModal.tsx:510 |
| `timeline:events-loaded` | `content:selected` | useMitigationStore.ts:237,387, Sidebar.tsx:1004, NewPlanModal.tsx:201 |
| `mitigation:added` | `mitigation:added` | useMitigationStore.ts:462（そのまま） |
| `tutorial:entered-event-name` | `event:name-entered` | EventModal.tsx:313 |
| `tutorial:entered-event-damage` | `event:damage-entered` | EventModal.tsx:321 |
| `tutorial:selected-event-mitis` | `event:miti-selected` | EventModal.tsx:334 |
| `event:created` | `event:saved` | useMitigationStore.ts:376 |

各ファイルでcompleteEvent呼び出しのイベント名を上記に従って更新する。

不要になったイベント（`party:four-set`の旧用途、`my-job:set`、`tutorial:my-job-highlight-toggled`、`status:opened`、`tutorial:acknowledged`、`sidebar:new-plan-clicked`、`tutorial:new-plan-modal-closed`、`phase:added`、`myjob:set`、`party:eight-set`）の呼び出し行は削除する。

- [ ] **Step 2: 新しいイベントの追加**

以下の新しいcompleteEvent呼び出しを追加する:

- **PartySettingsModal.tsx**: ジョブ設定時に`party:job-set`、ジョブ削除時に`party:job-removed`、2つ目配置時に`party:two-set`を発火
- **Timeline.tsx（または該当箇所）**: 共有ボタン初回クリック時に、`add-event`/`share`チュートリアルの発火条件チェック
- **data-tutorial属性の追加**: `party-healer-slot`、`party-palette-pick`、`share-copy-btn`等、新ステップのターゲットに対応する属性を追加

これらは実装時に各ファイルのDOMを確認して正確な箇所に追加する。

- [ ] **Step 3: ビルド＋動作確認**

Run: `npm run build 2>&1 | tail -20`
Expected: ビルド成功

- [ ] **Step 4: コミット**

```bash
git add -A
git commit -m "feat(tutorial): completeEvent統合 + 新イベント名マッピング"
```

---

## Task 12: CSS更新

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: 旧チュートリアルCSSアニメーションを削除**

以下を削除:
- `--animate-tutorial-ripple` 変数（Line 43付近）
- `@keyframes tutorial-ripple`（Line 46-56付近）
- `@keyframes tutorial-breathing-glow`（Line 759-773付近）
- `.tutorial-target-highlight` クラス（Line 774-778付近）

- [ ] **Step 2: コミット**

```bash
git add src/index.css
git commit -m "refactor(tutorial): 旧チュートリアルCSS削除"
```

---

## Task 13: クリーンアップ + 最終確認

**Files:**
- Delete: `src/store/useTutorialStore.old.ts`（Task 2で作成したバックアップ）

- [ ] **Step 1: バックアップファイル削除**

```bash
rm src/store/useTutorialStore.old.ts
```

- [ ] **Step 2: 全体ビルド確認**

Run: `npm run build 2>&1 | tail -20`
Expected: ビルド成功、エラーなし

- [ ] **Step 3: 開発サーバーで手動確認**

Run: `npm run dev`

確認項目:
- [ ] 初回アクセスでメインチュートリアルが自動起動するか
- [ ] 緑ピルが正しい位置にバウンドしているか
- [ ] クリックブロッカーが機能するか（ターゲット以外がクリックできないか）
- [ ] 各ステップがcompleteEventで正しく進行するか
- [ ] パーティ自動埋めアニメーションが動作するか
- [ ] ピル飛行（CHECK → CLICK）が動作するか
- [ ] 完了画面が表示されるか
- [ ] チュートリアルメニューが動作するか（✓マーク含む）
- [ ] スキップ → 確認ダイアログ → 終了が動作するか
- [ ] ダーク/ライト両テーマで視認性が確保されているか
- [ ] 日本語/英語の切り替えで表示が正しいか

- [ ] **Step 4: 最終コミット**

```bash
git add -A
git commit -m "feat(tutorial): チュートリアル刷新完了 — 3本構成 + メニュー + 緑ピル方式"
```

---

## 補足: 実装時の注意事項

1. **backdrop-filterを直書きしない** → `--tw-backdrop-blur` 変数パターンを使う（TECH_NOTES.md参照）
2. **i18nハードコーディング禁止** → 全テキストはi18nキー経由
3. **clipPathのブラウザ互換性** → TutorialBlockerのclipPath path()構文がSafariで動作しない場合はSVGオーバーレイにフォールバック。旧コードの実装を参考にする
4. **Framer Motionのlayout** → TutorialPillの位置変更にlayout propを使う場合、他のlayoutアニメーションと干渉しないか検証
5. **data-tutorial属性** → 新ステップのターゲットに対応する属性を各コンポーネントに追加。既存の属性名は可能な限り再利用
6. **useTutorialStore.old.ts** → 実装完了まで残しておき、旧ロジックの参照に使う。最終Task 13で削除
