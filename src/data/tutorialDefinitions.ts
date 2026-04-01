// src/data/tutorialDefinitions.ts
// チュートリアル定義 — ステップの追加・削除・並べ替えはこのファイルだけで完結する

export type PillLabel = 'click' | 'tap' | 'check' | 'next';

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
  animation?: 'palette-hint' | 'party-auto-fill' | 'pill-fly' | 'completion-card' | 'typewriter-fill';
  /** ピルの矢印方向（デフォルト: down） */
  pillArrow?: 'down' | 'right';
  /** ピル飛行の定義（省略可） */
  pillTransition?: {
    toTarget: string;
    toLabel: PillLabel;
  };
  /** カード表示のアンカー要素セレクタ（targetがnullの時にカード位置の基準にする） */
  cardAnchor?: string;
  /** タイプライター演出設定（animation: 'typewriter-fill' 時に必須） */
  typewriterConfig?: TypewriterConfig;
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
    // ── パーティ編成: H1スロット選択 → 黒魔配置 → 削除 → 戦士 → 白魔 → 自動埋め ──
    {
      id: 'main-3-select-h1',
      target: '[data-tutorial="party-healer-slot"]',
      pill: 'click',
      messageKey: 'tutorial.main.select_slot.message',
      descriptionKey: 'tutorial.main.select_slot.description',
      completionEvent: 'party:slot-focused',
    },
    {
      id: 'main-4-pick-blm',
      target: '[data-job-id="blm"]',
      pill: 'click',
      messageKey: 'tutorial.main.pick_blm.message',
      descriptionKey: 'tutorial.main.pick_blm.description',
      completionEvent: 'party:job-set',
    },
    {
      id: 'main-5-delete-job',
      target: '[data-tutorial-remove="H1"]',
      pill: 'click',
      messageKey: 'tutorial.main.delete_job.message',
      descriptionKey: 'tutorial.main.delete_job.description',
      completionEvent: 'party:job-removed',
    },
    {
      id: 'main-6-pick-war',
      target: '[data-job-id="war"]',
      pill: 'click',
      messageKey: 'tutorial.main.pick_war.message',
      completionEvent: 'party:job-set',
    },
    {
      id: 'main-7-pick-whm',
      target: '[data-job-id="whm"]',
      pill: 'click',
      messageKey: 'tutorial.main.pick_whm.message',
      completionEvent: 'party:job-set',
    },
    {
      id: 'main-8-palette-hint',
      target: null,
      pill: 'check',
      messageKey: 'tutorial.main.palette_hint.message',
      descriptionKey: 'tutorial.main.palette_hint.description',
      completionEvent: 'party:palette-hint-done',
      animation: 'palette-hint',
      cardAnchor: '[data-tutorial="party-healer-slot"]',
    },
    {
      id: 'main-9-auto-fill',
      target: null,
      pill: 'check',
      messageKey: 'tutorial.main.auto_fill.message',
      completionEvent: 'party:auto-filled',
      animation: 'party-auto-fill',
      cardAnchor: '[data-tutorial="party-healer-slot"]',
    },
    {
      id: 'main-10-party-close',
      target: '[data-tutorial="party-settings-close-btn"]',
      pill: 'click',
      pillArrow: 'right',
      messageKey: 'tutorial.main.party_close.message',
      completionEvent: 'party:closed',
    },
    // ── 軽減追加: 致死ダメージCHECK → ピル飛行 → セルクリック → リプライザル ──
    {
      id: 'main-11-check-damage',
      target: '[data-tutorial="tutorial-damage-cell-4-aoe"]',
      pill: 'check',
      messageKey: 'tutorial.main.damage_check.message',
      descriptionKey: 'tutorial.main.damage_check.description',
      completionEvent: 'mitigation:cell-clicked',
      animation: 'pill-fly',
      pillTransition: {
        toTarget: '[data-tutorial="miti-cell-mt-4"]',
        toLabel: 'click',
      },
    },
    {
      id: 'main-12-select-miti',
      target: '[data-tutorial="tutorial-skill-reprisal"]',
      pill: 'click',
      messageKey: 'tutorial.main.select_miti.message',
      descriptionKey: 'tutorial.main.select_miti.description',
      completionEvent: 'mitigation:added',
    },
    {
      id: 'main-13-complete',
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
