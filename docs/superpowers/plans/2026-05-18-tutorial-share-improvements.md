# 共有チュートリアル改善 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `share` チュートリアルを 1 ステップ化し、 共有ボタン初回クリック時に自動発火する動線に作り替える。 完了/スキップ後はチュートリアルメニューに項目が出現する。

**Architecture:** 既存の data-driven tutorial システム ([useTutorialStore](../../src/store/useTutorialStore.ts) + [TutorialOverlay](../../src/components/tutorial/TutorialOverlay.tsx) + [tutorialDefinitions](../../src/data/tutorialDefinitions.ts)) を拡張せず、 ステップ定義・起動条件・終了条件のみ調整する。 z-index 重ね順は既に意図通りで、 TutorialBlocker の active 条件を 1 行拡張するだけで「後ろのモーダル操作不可」 を実現する。

**Tech Stack:** React 19 / Zustand / TypeScript / Vite / Tailwind v4 / i18next / vitest

**Spec:** [2026-05-18-tutorial-share-improvements-design.md](../specs/2026-05-18-tutorial-share-improvements-design.md)

---

## ファイル構成

### 変更
- `src/data/tutorialDefinitions.ts` — share を 1 ステップに削減
- `src/components/ShareButtons.tsx` — onClick で startTutorial 発火 + useEffect 削除
- `src/components/ShareModal.tsx` — `completeEvent('share:modal-opened')` 削除
- `src/components/tutorial/TutorialOverlay.tsx` — TutorialBlocker active 条件拡張
- `src/components/tutorial/TutorialMenu.tsx` — share 項目の表示条件追加
- `src/store/useTutorialStore.ts` — confirmExit で share スキップ時に completed=true
- `src/locales/{ja,en,zh,ko}.json` — `tutorial.share.open.message` 削除

### 新規テスト
- `src/__tests__/useTutorialStore.share.test.ts` — share チュートリアルのスキップ時 completed フラグ挙動

---

## Task 1: share チュートリアルを 1 ステップに削減

**Files:**
- Modify: `src/data/tutorialDefinitions.ts:315-336`

- [ ] **Step 1: 現状確認**

`src/data/tutorialDefinitions.ts` の `shareTutorial` 定義 (315-336 行) が 2 ステップ (`share-1-open`, `share-2-done`) 構成であることを確認。

- [ ] **Step 2: shareTutorial を書き換え**

```ts
const shareTutorial: TutorialDefinition = {
  id: 'share',
  nameKey: 'tutorial.menu.share',
  steps: [
    {
      id: 'share-1-done',
      target: null,
      pill: 'next',
      messageKey: 'tutorial.share.done.message',
      descriptionKey: 'tutorial.share.done.description',
      completionEvent: 'share:tutorial-done',
    },
  ],
};
```

旧 `share-1-open` ステップは削除、 旧 `share-2-done` を `share-1-done` にリネーム (`pillArrow: 'right'` も不要なので削除)。

- [ ] **Step 3: tsc 通過確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

---

## Task 2: useTutorialStore の confirmExit に share スキップ完了処理を追加

**Files:**
- Modify: `src/store/useTutorialStore.ts:263-281`
- Test: `src/__tests__/useTutorialStore.share.test.ts` (新規)

- [ ] **Step 1: 失敗するテストを書く**

新規ファイル `src/__tests__/useTutorialStore.share.test.ts` を作成:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useTutorialStore } from '../store/useTutorialStore';

describe('useTutorialStore - share tutorial skip', () => {
  beforeEach(() => {
    useTutorialStore.getState().resetTutorial();
  });

  it('share チュートリアルをスキップしても completed=true になる', () => {
    useTutorialStore.getState().startTutorial('share');
    expect(useTutorialStore.getState().completed.share).toBe(false);

    useTutorialStore.getState().requestExit();
    useTutorialStore.getState().confirmExit();

    expect(useTutorialStore.getState().completed.share).toBe(true);
  });

  it('main チュートリアルのスキップでは completed=true にならない (既存挙動維持)', () => {
    useTutorialStore.getState().startTutorial('main');
    expect(useTutorialStore.getState().completed.main).toBe(false);

    useTutorialStore.getState().requestExit();
    useTutorialStore.getState().confirmExit();

    expect(useTutorialStore.getState().completed.main).toBe(false);
  });

  it('share チュートリアルを完走すると completed=true になる (既存挙動)', () => {
    useTutorialStore.getState().startTutorial('share');
    useTutorialStore.getState().completeEvent('share:tutorial-done');
    expect(useTutorialStore.getState().completed.share).toBe(true);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/__tests__/useTutorialStore.share.test.ts`
Expected: 1 件目のテストが FAIL (share の confirmExit でフラグが立たない)、 2 件目・3 件目は PASS

- [ ] **Step 3: confirmExit を修正**

`src/store/useTutorialStore.ts` の `confirmExit` (263-281 行) を以下に書き換え:

```ts
confirmExit: () => {
  const { activeTutorialId } = get();
  if (activeTutorialId === 'main' || activeTutorialId === 'create-plan') {
    restoreUserState(get());
  }
  clearSnapshotFromSession();
  set(state => ({
    activeTutorialId: null,
    currentStep: 0,
    isActive: false,
    pendingExit: false,
    currentStepIndex: 0,
    _savedSnapshot: null,
    _savedPlanId: null,
    completed: activeTutorialId === 'share'
      ? { ...state.completed, share: true }
      : state.completed,
  }));
  // チュートリアル中に開いたモーダルをすべて閉じる
  window.dispatchEvent(new Event('tutorial:close-all-modals'));
  window.dispatchEvent(new Event('tutorial:close-new-plan-modal'));
},
```

- [ ] **Step 4: テスト全件 PASS 確認**

Run: `npx vitest run src/__tests__/useTutorialStore.share.test.ts`
Expected: 3 件すべて PASS

---

## Task 3: TutorialBlocker の active 条件拡張

**Files:**
- Modify: `src/components/tutorial/TutorialOverlay.tsx:261-266`

- [ ] **Step 1: 現状の TutorialBlocker 呼び出しを確認**

`src/components/tutorial/TutorialOverlay.tsx` 261-266 行:

```tsx
<TutorialBlocker
  targetRect={targetRect}
  active={!!step.target && !step.animation}
/>
```

- [ ] **Step 2: active 条件を拡張**

以下に書き換え:

```tsx
<TutorialBlocker
  targetRect={targetRect}
  active={(!!step.target && !step.animation) || (!step.target && !step.animation && step.pill === 'next')}
/>
```

意図: target なし + animation なし + pill=next (= 案内カードのみのステップ) でも全面ブロックを出す。 `share-1-done` がこの条件に該当する。

- [ ] **Step 3: tsc 通過確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

---

## Task 4: ShareModal の `completeEvent('share:modal-opened')` 削除

**Files:**
- Modify: `src/components/ShareModal.tsx:82-96`

- [ ] **Step 1: 該当行を削除**

`src/components/ShareModal.tsx` 84 行目を削除:

```tsx
// 削除
useTutorialStore.getState().completeEvent('share:modal-opened');
```

useEffect 全体は維持し、 その 1 行のみ削除する。

- [ ] **Step 2: `useTutorialStore` の import が他で使われていないか確認**

Grep 検索: ShareModal.tsx 内に `useTutorialStore` の他参照がなければ import 文も削除。

- [ ] **Step 3: tsc 通過確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

---

## Task 5: ShareButtons の起動ロジック追加 + useEffect 削除

**Files:**
- Modify: `src/components/ShareButtons.tsx`

- [ ] **Step 1: 現状確認**

`src/components/ShareButtons.tsx` 全体 (58 行) を確認。 27-35 行の useEffect が強制クローズ犯。

- [ ] **Step 2: 全体を書き換え**

```tsx
import React from 'react';
import clsx from 'clsx';
import { Share2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Tooltip } from './ui/Tooltip';
import { ShareModal } from './ShareModal';
import type { SavedPlan } from '../types';
import { useTutorialStore } from '../store/useTutorialStore';

const iconBtnBase = "group w-9 h-9 rounded-full border flex items-center justify-center transition-all duration-300 cursor-pointer active:scale-95";
const hoverInvert = "hover:bg-app-toggle hover:border-app-toggle hover:text-app-toggle-text";
const iconBtnDefault = `bg-transparent border-app-border text-app-text ${hoverInvert}`;

interface ShareButtonsProps {
    contentLabel: string | null;
    currentPlan: SavedPlan | undefined;
}

export const ShareButtons: React.FC<ShareButtonsProps> = ({ contentLabel, currentPlan }) => {
    const { t } = useTranslation();
    const [modalOpen, setModalOpen] = React.useState(false);

    const handleClick = () => {
        setModalOpen(true);
        const { completed, isActive } = useTutorialStore.getState();
        if (!completed['share'] && !isActive) {
            useTutorialStore.getState().startTutorial('share');
        }
    };

    return (
        <>
            <Tooltip content={t('app.share')}>
                <button
                    data-tutorial="share-copy-btn"
                    onClick={handleClick}
                    className={clsx(iconBtnBase, iconBtnDefault, "w-8 h-8")}
                >
                    <Share2 size={14} />
                </button>
            </Tooltip>

            <ShareModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                contentLabel={contentLabel}
                currentPlan={currentPlan}
            />
        </>
    );
};
```

変更点:
- `useEffect` / `useRef` / `wasShareTutorial` / `activeTutorialId` 監視を**削除**
- `handleClick` を追加: setModalOpen + (条件付きで) startTutorial('share')
- import から `useRef` / `useEffect` 削除

- [ ] **Step 3: tsc 通過確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

---

## Task 6: TutorialMenu の表示条件追加

**Files:**
- Modify: `src/components/tutorial/TutorialMenu.tsx:68`

- [ ] **Step 1: 現状確認**

68 行目: `{TUTORIAL_IDS.map(id => {`

- [ ] **Step 2: filter 追加**

68 行目を以下に書き換え:

```tsx
{TUTORIAL_IDS.filter(id => id !== 'share' || completed['share']).map(id => {
```

意図: `share` 項目は `completed['share'] === true` のときのみ表示。 main / create-plan は常時表示 (フィルター条件で `id !== 'share'` の場合は無条件 true)。

- [ ] **Step 3: tsc 通過確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

---

## Task 7: i18n キーから `tutorial.share.open.message` 削除

**Files:**
- Modify: `src/locales/ja.json`
- Modify: `src/locales/en.json`
- Modify: `src/locales/zh.json`
- Modify: `src/locales/ko.json`

- [ ] **Step 1: 現状の `tutorial.share` 構造を確認**

各言語ファイルで `tutorial.share` セクションを Grep し、 `open.message` キーの位置を確認:

```bash
grep -n -A 8 '"share":' src/locales/ja.json
```

- [ ] **Step 2: 各言語から `open` セクションを削除**

ja / en / zh / ko の 4 ファイルから `"open": { ... }` 全体を削除 (`done` セクションは残す)。

例 (ja):

```json
// 変更前
"share": {
  "open": {
    "message": "..."
  },
  "done": {
    "message": "...",
    "description": "..."
  }
}

// 変更後
"share": {
  "done": {
    "message": "...",
    "description": "..."
  }
}
```

- [ ] **Step 3: i18n キー参照漏れチェック**

Grep: `'tutorial.share.open'` がコード内に残っていないか確認。 残っていれば該当箇所も修正。

Run: `grep -rn 'tutorial\.share\.open' src/`
Expected: ヒットなし

- [ ] **Step 4: tsc 通過確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

---

## Task 8: 全体ビルド・テスト・型チェック

- [ ] **Step 1: vitest 全件 PASS 確認**

Run: `rtk vitest run`
Expected: 全件 PASS (既存テストが share 2 ステップ前提なら修正)

- [ ] **Step 2: 既存テストへの影響を確認**

share チュートリアルのステップ数や ID を参照しているテストがあれば修正:

Run: `grep -rn 'share-1-open\|share-2-done\|TUTORIALS\.share\.steps' src/`
Expected: テスト以外への影響なし、 テストがあれば修正

- [ ] **Step 3: tsc 厳密モード確認**

Run: `npx tsc --noEmit`
Expected: エラーなし、 警告なし

- [ ] **Step 4: ビルド確認 (Vercel と同条件)**

Run: `rtk npm run build`
Expected: ビルド成功、 警告なし

---

## Task 9: 実機検証 (Playwright スクリプト)

**Files:**
- 一時ファイル: `/tmp/test-share-tutorial.spec.ts`

- [ ] **Step 1: 開発サーバー起動確認**

Run (background): `npm run dev`
Expected: http://localhost:5173 で起動

- [ ] **Step 2: Playwright で初回フローを検証**

検証項目:
1. 軽減表を開く (テンプレートから 1 つ選択)
2. 共有ボタンクリック → ShareModal が開く + 案内カード表示
3. 背後のモーダル (ShareModal や PopularConsentDialog) を点クリック → 反応しないこと
4. 「わかった」 押下 → カードが消える、 ShareModal は残る
5. リロード後、 共有ボタンクリック → カードは出ない
6. TutorialMenu に「共有のしかた」 が出現することを確認
7. メニューから再起動 → カード表示 → 「わかった」 → カード消える、 ShareModal は残る

- [ ] **Step 3: スキップフロー検証**

1. localStorage クリアして初回状態にリセット
2. 共有ボタンクリック → カード表示 → × ボタン (スキップ) → 確認ダイアログで「終了」
3. カードが消える、 ShareModal は残る
4. TutorialMenu に項目が出現していることを確認

- [ ] **Step 4: 多言語表示確認**

ja / en / zh / ko 切替で案内カードの文言が正しく表示されること。

---

## Task 10: コミット・push・デプロイ

- [ ] **Step 1: コミット**

```bash
rtk git add src/data/tutorialDefinitions.ts \
  src/components/ShareButtons.tsx \
  src/components/ShareModal.tsx \
  src/components/tutorial/TutorialOverlay.tsx \
  src/components/tutorial/TutorialMenu.tsx \
  src/store/useTutorialStore.ts \
  src/locales/ja.json src/locales/en.json src/locales/zh.json src/locales/ko.json \
  src/__tests__/useTutorialStore.share.test.ts \
  docs/superpowers/specs/2026-05-18-tutorial-share-improvements-design.md \
  docs/superpowers/plans/2026-05-18-tutorial-share-improvements.md

rtk git commit -m "feat(tutorial): share チュートリアルを 1 ステップ + 共有ボタン初回自動発火に刷新

- 2 ステップ → 1 ステップに削減 (案内カードのみ)
- 共有ボタン初回クリック時に自動発火 (TutorialMenu からの初学を廃止)
- 完了/スキップ後に TutorialMenu に項目が出現する仕様に変更
- TutorialBlocker の active 条件を拡張し、案内カード表示中の背後モーダル操作を防止
- ShareButtons の強制クローズ useEffect を削除、完了/スキップ後も ShareModal を残す"
```

- [ ] **Step 2: TODO.md 更新**

`docs/TODO.md` の「次セッション最優先」 から共有チュートリアル改善要望を削除。 完了タスクは `docs/TODO_COMPLETED.md` に追記。

- [ ] **Step 3: push**

```bash
rtk git push origin main
```

- [ ] **Step 4: Vercel デプロイ確認**

自動デプロイ完了 (通常 2-3 分) を待ち、 本番環境で動作確認。

---

## Self-Review チェック結果

**1. Spec coverage:**
- §1 ステップ再設計 → Task 1 ✓
- §2 起動ロジック (案 C) → Task 5 ✓
- §3 TutorialMenu 表示条件 → Task 6 ✓
- §4 スキップ時 completed=true → Task 2 ✓
- §5 TutorialBlocker 条件拡張 → Task 3 ✓
- §6 強制クローズ削除 → Task 5 (useEffect 削除) ✓
- §7 ShareModal の completeEvent 削除 → Task 4 ✓
- §8 i18n 削除 → Task 7 ✓
- テスト計画 → Task 2 (unit) + Task 9 (実機) ✓

**2. Placeholder scan:** TBD/TODO 無し ✓

**3. Type consistency:**
- `share-1-done` (新 ID) を Task 1 で定義 → 他タスクは ID 直接参照しないので整合
- `completed['share']` の参照は Task 2/5/6 で一貫
- `startTutorial('share')` のシグネチャは既存と一致
