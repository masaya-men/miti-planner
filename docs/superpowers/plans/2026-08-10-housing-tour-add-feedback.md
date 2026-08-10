# ツアー追加フィードバックアニメーション Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ハウジングの「ツアーに追加」ボタン(探すページのカード/詳細ページの操作バー)に、成功時のチェックマーク描画+「追加済み」トグル状態、失敗時(別リージョン)のボタンシェイク+アンカー吹き出しを追加する。

**Architecture:** 新規 hook `useTourAddFeedback(listingId, region)` に「地域チェック→トレイ書き込み→演出トリガー」を1本化し、`ListingCard`(探す/地図/お気に入り/マイページ共通カード)と `HousingActionBar`(詳細ページ操作バー)の両方から使う。「追加済み」表示はローカル state ではなく `useTourTrayStore` の `trayIds` を直接購読して導出するため、トレイ側で外せば自動的にボタンも元に戻る。失敗時のメッセージは新規の小さな portal コンポーネント `HousingTourAddErrorBubble` でボタン直上に出し、画面下中央の汎用 `showToast` はこの操作(追加ボタン)に関して呼ばなくなる。

**Tech Stack:** React 18 / TypeScript / Zustand / vitest + @testing-library/react (happy-dom) / 既存 CSS keyframes 方式(新規ライブラリ追加なし)。

## Global Constraints

- 対象は「ツアーに追加」ボタン(`ListingCard.tsx` の footer ボタン、`HousingActionBar.tsx` の操作バーボタン)のみ。「ツアー開始」ボタンの地域跨ぎ警告 (`housing.tour.region_block_start`) は変更しない。
- 失敗演出は**押したボタン単体だけ**を揺らす(カード全体・操作バー全体は揺らさない)。探すページ/詳細ページで仕組みを統一する。
- 「追加済み」ボタンはトグル: もう一度押すとトレイから外れる(演出なし・静かに外れる)。
- 失敗時、画面下中央の汎用トースト (`showToast`) は**この操作については呼ばない**(置き換え)。
- 新規ライブラリは追加しない。既存の CSS keyframes (`.housing-confirm-button` の bounce/draw/ripple/glow、`.housing-card-fav` の pop/particle) と同じ作法を踏襲する。
- `prefers-reduced-motion: reduce` では、既存パターンと同様にキーフレームアニメーションを無効化する(状態自体は反映する。動きだけ消す)。
- i18n は 5 言語(ja/en/ko/zh/zh-Hant)すべてに新規キーを追加する。
- 色は既存トークンのみ使用: 成功=`--housing-aether`系(エーテライトのシアン。選択/確定状態は青、というハウジングの2アクセント体系に合わせる)、失敗=`--housing-danger`系。新規カラー値は作らない。
- 設計書: `docs/superpowers/specs/2026-08-10-housing-tour-add-feedback-design.md`(ユーザー承認済み)。

---

## File Structure

- **Create** `src/lib/housing/useTourAddFeedback.ts` — 共有 hook。地域チェック・トレイ書き込み・演出状態を1箇所に集約。
- **Create** `src/lib/housing/__tests__/useTourAddFeedback.test.ts` — hook 単体テスト。
- **Create** `src/components/housing/HousingTourAddErrorBubble.tsx` — 失敗時、ボタン直上に出す小さな吹き出し(portal)。
- **Create** `src/components/housing/__tests__/HousingTourAddErrorBubble.test.tsx` — 吹き出し単体テスト。
- **Modify** `src/components/housing/browse/ListingCard.tsx` — footer の「ツアーに追加」ボタンを hook 配線に置き換え。
- **Modify** `src/components/housing/browse/__tests__/ListingCard.test.tsx` / `src/__tests__/housing/ListingCard.test.tsx` — 新規状態のテスト追加 + 既存テストの store リセット。
- **Modify** `src/components/housing/listing/HousingActionBar.tsx` — 独自実装していた地域チェックを hook に置き換え、旧ロジックを削除。
- **Modify** `src/components/housing/listing/__tests__/HousingActionBar.test.tsx` — 新規状態のテスト追加。
- **Modify** `src/styles/housing.css` — 新規 keyframes/クラス(成功フラーリッシュ・追加済み色・シェイク・吹き出し)。
- **Modify** `src/locales/{ja,en,ko,zh,zh-Hant}.json` — 新規キー `housing.card.added_to_tour`。

---

### Task 1: i18n キー追加

**Files:**
- Modify: `src/locales/ja.json:1964` 付近(`housing.card.add_to_tour` の直後)
- Modify: `src/locales/en.json` / `src/locales/ko.json` / `src/locales/zh.json` / `src/locales/zh-Hant.json` の同じキーパス直後

**Interfaces:**
- Produces: i18n キー `housing.card.added_to_tour`(カード・詳細ページ両方の「追加済み」ラベル+aria-labelで共用)

- [ ] **Step 1: 各ロケールファイルで `housing.card.add_to_tour` の行(直前が必ず `"favorite": "..."`)を探し、直後に `added_to_tour` を追加する**

`housing.card` ブロックには `add_to_tour` という名前のキーが他にも2箇所ある(別機能の文言・別セクションの短縮表記)ため、**直前の行が `"favorite": "..."` であること**で対象行を一意に特定する(実ファイルを確認済み・以下は実際の現在値)。

`src/locales/ja.json:1963-1964`:
```json
            "favorite": "お気に入り",
            "add_to_tour": "ツアーに追加",
```
これを:
```json
            "favorite": "お気に入り",
            "add_to_tour": "ツアーに追加",
            "added_to_tour": "追加済み",
```

`src/locales/en.json:1942-1943`:
```json
            "favorite": "Favorite",
            "add_to_tour": "Add to tour",
```
これを:
```json
            "favorite": "Favorite",
            "add_to_tour": "Add to tour",
            "added_to_tour": "Added",
```

`src/locales/ko.json:1907-1908`:
```json
            "favorite": "즐겨찾기",
            "add_to_tour": "투어에 추가",
```
これを:
```json
            "favorite": "즐겨찾기",
            "add_to_tour": "투어에 추가",
            "added_to_tour": "추가됨",
```

`src/locales/zh.json`(簡体字)`:1907-1908`:
```json
            "favorite": "收藏",
            "add_to_tour": "加入导览",
```
これを:
```json
            "favorite": "收藏",
            "add_to_tour": "加入导览",
            "added_to_tour": "已加入",
```

`src/locales/zh-Hant.json`(繁体字)`:1907-1908`:
```json
            "favorite": "收藏",
            "add_to_tour": "加入導覽",
```
これを:
```json
            "favorite": "收藏",
            "add_to_tour": "加入導覽",
            "added_to_tour": "已加入",
```

[[feedback_locale_json_textual_edit]] に従い、該当ブロックのみのテキスト編集で行う(全体パース禁止)。**`housing.detail.add_to_tour` (ja:2744/en:2723/ko,zh,zh-Hant:2688付近、値="ツアー")や、もう1つの `add_to_tour` (ja:2593付近、`favorite_remove`/`copy_url` の隣、別機能の文言) は別キーなので触らない。**なお `housing.detail.add_to_tour` は en/ko/zh で日本語「ツアー」のまま未翻訳という既存の別問題(`docs/TODO.md` 記載の「housing.*の日本語取りこぼし」)があるが、本タスクの対象外なので今回は直さない。

- [ ] **Step 2: 5ファイルとも `added_to_tour` キーが追加されたことを確認する**

Run: `grep -c "added_to_tour" src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json src/locales/zh-Hant.json`
Expected: 各ファイル `1` ずつ(計5件)。

- [ ] **Step 3: Commit**

```bash
git add src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json src/locales/zh-Hant.json
git commit -m "i18n(housing): ツアー追加済みラベルのキーを追加(5言語)"
```

---

### Task 2: 共有 hook `useTourAddFeedback`

**Files:**
- Create: `src/lib/housing/useTourAddFeedback.ts`
- Test: `src/lib/housing/__tests__/useTourAddFeedback.test.ts`

**Interfaces:**
- Consumes: `useTourTrayStore` (`src/store/useTourTrayStore.ts`: `trayIds: string[]`, `setTrayIds: (ids: string[] | ((prev: string[]) => string[])) => void`) / `useHousingListingsStore` (`listings: MockListing[]`, `myListings: MockListing[]`) / `useEphemeralListingsStore` (`ephemeralListings: MockListing[]`) / `canAddToTour(trayAnchorRegion: string | null, candidateRegion: string): boolean` と `tourAnchorRegion<T extends string>(regions: (T|null|undefined)[]): T | null`(`src/lib/housing/tourCrossing.ts`) / `useTranslation` (`react-i18next`)
- Produces: `useTourAddFeedback(listingId: string, region: string | null | undefined): UseTourAddFeedbackResult`、`UseTourAddFeedbackResult = { isAdded: boolean; animState: 'idle' | 'success' | 'error'; errorMessage: string | null; attemptToggle: () => 'added' | 'removed' | 'blocked' }`。後続タスク(3, 5, 6)はこの型・関数名をそのまま使う。

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/housing/__tests__/useTourAddFeedback.test.ts` を新規作成:
```ts
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useTourTrayStore } from '../../../store/useTourTrayStore';
import { useHousingListingsStore } from '../../../store/useHousingListingsStore';
import { useEphemeralListingsStore } from '../../../store/useEphemeralListingsStore';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { useTourAddFeedback } from '../useTourAddFeedback';

beforeEach(() => {
  useTourTrayStore.setState({ trayIds: [], pinnedIds: [], manualOrder: false });
  useHousingListingsStore.setState({ listings: [], myListings: [] } as never);
  useEphemeralListingsStore.setState({ ephemeralListings: [] } as never);
});

describe('useTourAddFeedback', () => {
  it('トレイが空なら追加できてisAddedがtrueになりanimStateがsuccessになる', () => {
    const { result } = renderHook(() => useTourAddFeedback('house1', 'JP'));
    expect(result.current.isAdded).toBe(false);

    act(() => {
      const outcome = result.current.attemptToggle();
      expect(outcome).toBe('added');
    });

    expect(result.current.isAdded).toBe(true);
    expect(result.current.animState).toBe('success');
    expect(useTourTrayStore.getState().trayIds).toEqual(['house1']);
  });

  it('別リージョンの家がすでにトレイにあると追加をブロックしerrorMessageを立てる', () => {
    useHousingListingsStore.setState({
      listings: [{ id: 'other1', region: 'NA' } as never],
      myListings: [],
    } as never);
    useTourTrayStore.setState({ trayIds: ['other1'], pinnedIds: [], manualOrder: false });

    const { result } = renderHook(() => useTourAddFeedback('house1', 'JP'));

    act(() => {
      const outcome = result.current.attemptToggle();
      expect(outcome).toBe('blocked');
    });

    expect(result.current.isAdded).toBe(false);
    expect(result.current.animState).toBe('error');
    expect(result.current.errorMessage).toBe('housing.tour.region_block');
    expect(useTourTrayStore.getState().trayIds).toEqual(['other1']);
  });

  it('追加済みの状態でattemptToggleを呼ぶと演出なしでトレイから外れる', () => {
    useTourTrayStore.setState({ trayIds: ['house1'], pinnedIds: [], manualOrder: false });
    const { result } = renderHook(() => useTourAddFeedback('house1', 'JP'));
    expect(result.current.isAdded).toBe(true);

    act(() => {
      const outcome = result.current.attemptToggle();
      expect(outcome).toBe('removed');
    });

    expect(result.current.isAdded).toBe(false);
    expect(result.current.animState).toBe('idle');
    expect(useTourTrayStore.getState().trayIds).toEqual([]);
  });

  it('animStateは一定時間後にidleへ自動で戻る(success)', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTourAddFeedback('house1', 'JP'));
    act(() => {
      result.current.attemptToggle();
    });
    expect(result.current.animState).toBe('success');
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.animState).toBe('idle');
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run src/lib/housing/__tests__/useTourAddFeedback.test.ts`
Expected: FAIL (`Cannot find module '../useTourAddFeedback'` 等、未実装のため失敗)

- [ ] **Step 3: 最小実装を書く**

`src/lib/housing/useTourAddFeedback.ts` を新規作成:
```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTourTrayStore } from '../../store/useTourTrayStore';
import { useHousingListingsStore } from '../../store/useHousingListingsStore';
import { useEphemeralListingsStore } from '../../store/useEphemeralListingsStore';
import { canAddToTour, tourAnchorRegion } from './tourCrossing';

export type TourAddAnimState = 'idle' | 'success' | 'error';
export type TourAddOutcome = 'added' | 'removed' | 'blocked';

/** 成功フラーリッシュ(bounce+glow+ring)の表示時間。housing-check-ripple(600ms)より少し長め。 */
const SUCCESS_ANIM_MS = 700;
/** 失敗の吹き出し+シェイクの表示時間。 */
const ERROR_ANIM_MS = 2500;

export interface UseTourAddFeedbackResult {
  /** このlistingが現在ツアートレイに入っているか(ストア直読み・常に最新)。 */
  isAdded: boolean;
  /** 'idle'以外の間だけ演出クラス/属性を出す。時間経過で自動的に'idle'へ戻る。 */
  animState: TourAddAnimState;
  /** 直近の失敗理由(翻訳済み文字列)。'error'の間だけ非null。 */
  errorMessage: string | null;
  /**
   * 追加済みなら外す(トグルOFF・演出なし)。未追加なら地域チェックのうえ追加する。
   * 戻り値で呼び出し側が結果を判定できる('added'のときだけ従来の外部通知コールバックを
   * 呼ぶ、といった呼び出し側の分岐に使う)。
   */
  attemptToggle: () => TourAddOutcome;
}

/**
 * 「ツアーに追加」ボタン共通の状態管理(探すページのカード/詳細ページの操作バーで共用)。
 * 地域跨ぎチェックは元々 HousingActionBar が単体で行っていたのと同じ pool 解決方法
 * (公開一覧+自分の登録+一時listingの3ストアを都度 .getState() で読む)を引き継ぐ。
 */
export function useTourAddFeedback(
  listingId: string,
  region: string | null | undefined,
): UseTourAddFeedbackResult {
  const { t } = useTranslation();
  const trayIds = useTourTrayStore((s) => s.trayIds);
  const setTrayIds = useTourTrayStore((s) => s.setTrayIds);
  const isAdded = trayIds.includes(listingId);

  const [animState, setAnimState] = useState<TourAddAnimState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  const attemptToggle = useCallback((): TourAddOutcome => {
    if (isAdded) {
      setTrayIds((prev) => prev.filter((id) => id !== listingId));
      return 'removed';
    }

    const pool = [
      ...useHousingListingsStore.getState().listings,
      ...useHousingListingsStore.getState().myListings,
      ...useEphemeralListingsStore.getState().ephemeralListings,
    ];
    const trayRegion = tourAnchorRegion(
      trayIds.map((id) => pool.find((l) => l.id === id)?.region ?? null),
    );

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    if (!canAddToTour(trayRegion, region ?? '')) {
      setErrorMessage(t('housing.tour.region_block'));
      setAnimState('error');
      timeoutRef.current = setTimeout(() => {
        setAnimState('idle');
        setErrorMessage(null);
      }, ERROR_ANIM_MS);
      return 'blocked';
    }

    setTrayIds((prev) => (prev.includes(listingId) ? prev : [...prev, listingId]));
    setAnimState('success');
    timeoutRef.current = setTimeout(() => setAnimState('idle'), SUCCESS_ANIM_MS);
    return 'added';
  }, [isAdded, trayIds, region, listingId, setTrayIds, t]);

  return { isAdded, animState, errorMessage, attemptToggle };
}
```

- [ ] **Step 4: テストを実行して通過を確認する**

Run: `npx vitest run src/lib/housing/__tests__/useTourAddFeedback.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/housing/useTourAddFeedback.ts src/lib/housing/__tests__/useTourAddFeedback.test.ts
git commit -m "feat(housing): ツアー追加ボタンの共有フィードバックhookを追加"
```

---

### Task 3: 失敗時の吹き出しコンポーネント

**Files:**
- Create: `src/components/housing/HousingTourAddErrorBubble.tsx`
- Test: `src/components/housing/__tests__/HousingTourAddErrorBubble.test.tsx`

**Interfaces:**
- Consumes: なし(純粋な props 駆動コンポーネント)
- Produces: `HousingTourAddErrorBubble({ anchorRef: React.RefObject<HTMLElement>, message: string | null })`。Task 5/6 がこれを `<button ref={...}>` の直後に置いて使う。`data-testid="housing-tour-error-bubble"` で描画有無を検証できる。

- [ ] **Step 1: 失敗するテストを書く**

`src/components/housing/__tests__/HousingTourAddErrorBubble.test.tsx` を新規作成:
```tsx
// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useRef } from 'react';
import { HousingTourAddErrorBubble } from '../HousingTourAddErrorBubble';

function Harness({ message }: { message: string | null }) {
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <div>
      <button ref={ref} type="button">
        トリガー
      </button>
      <HousingTourAddErrorBubble anchorRef={ref} message={message} />
    </div>
  );
}

describe('HousingTourAddErrorBubble', () => {
  it('messageがnullなら何も描画しない', () => {
    render(<Harness message={null} />);
    expect(screen.queryByTestId('housing-tour-error-bubble')).not.toBeInTheDocument();
  });

  it('messageがあれば吹き出しにその文言を表示する', () => {
    render(<Harness message="別リージョンのハウジングは同じツアーに入れられません" />);
    const bubble = screen.getByTestId('housing-tour-error-bubble');
    expect(bubble).toHaveTextContent('別リージョンのハウジングは同じツアーに入れられません');
  });

  it('document.bodyへportalされる(祖先のoverflow:hiddenにクリップされない)', () => {
    const { container } = render(<Harness message="test" />);
    const bubble = screen.getByTestId('housing-tour-error-bubble');
    expect(container.contains(bubble)).toBe(false);
    expect(document.body.contains(bubble)).toBe(true);
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run src/components/housing/__tests__/HousingTourAddErrorBubble.test.tsx`
Expected: FAIL (`Cannot find module '../HousingTourAddErrorBubble'`)

- [ ] **Step 3: 最小実装を書く**

`src/components/housing/HousingTourAddErrorBubble.tsx` を新規作成:
```tsx
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export interface HousingTourAddErrorBubbleProps {
  anchorRef: React.RefObject<HTMLElement>;
  /** null/空文字なら何も描画しない。 */
  message: string | null;
}

/**
 * ボタンの真上に一時的なエラーメッセージを出す吹き出し。カードの overflow:hidden に
 * クリップされないよう、ListingCard.tsx の visibilityMenuPos と同じ手法(document.body へ
 * portal + getBoundingClientRect 基準の fixed 配置)を使う。
 */
export const HousingTourAddErrorBubble: React.FC<HousingTourAddErrorBubbleProps> = ({
  anchorRef,
  message,
}) => {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!message || !anchorRef.current) {
      setPos(null);
      return;
    }
    const rect = anchorRef.current.getBoundingClientRect();
    setPos({ top: rect.top, left: rect.left + rect.width / 2 });
  }, [message, anchorRef]);

  if (!message || !pos) return null;

  return createPortal(
    <div
      className="housing-tour-error-bubble"
      role="status"
      data-testid="housing-tour-error-bubble"
      style={{ top: pos.top, left: pos.left }}
    >
      {message}
    </div>,
    document.body,
  );
};
```

- [ ] **Step 4: テストを実行して通過を確認する**

Run: `npx vitest run src/components/housing/__tests__/HousingTourAddErrorBubble.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/housing/HousingTourAddErrorBubble.tsx src/components/housing/__tests__/HousingTourAddErrorBubble.test.tsx
git commit -m "feat(housing): ツアー追加失敗時のアンカー吹き出しコンポーネントを追加"
```

---

### Task 4: CSS 追加(成功フラーリッシュ・追加済み・シェイク・吹き出し)

**Files:**
- Modify: `src/styles/housing.css`

**Interfaces:**
- Consumes: 既存トークン `--housing-aether` (`#00BFFF`) / `--housing-aether-cta-bg` / `--housing-aether-cta-bg-hover` / `--housing-aether-cta-text` / `--housing-aether-glow-strong` / `--housing-danger` / `--housing-panel-bg-solid` / `--housing-panel-border` / `--housing-panel-shadow` / `--housing-text-xs`(すべて `src/styles/housing.css` 冒頭の `:root` 相当ブロックに既存)
- Produces: `.housing-card-add-btn[data-tour-anim="success"|"error"]` / `.housing-card-add-btn.is-added` / `.housing-tour-error-bubble` の各クラス・属性セレクタ。Task 5/6 がこれらをそのまま使う。

このタスクは見た目のみで自動テストが書けないため、Step 完了の確認は「該当クラスが期待通り DOM に反映されているか」を Task 5 のコンポーネントテストで間接的に検証する(ここでは記述と `npx tsc -b`/`vitest` が壊れていないことのみ確認)。

- [ ] **Step 1: `.housing-card-add-btn:disabled` の直後に新規スタイルを追加する**

`src/styles/housing.css` の以下の既存行を探す:
```css
.housing-card-add-btn:disabled { opacity: 0.45; cursor: not-allowed; }
```

その直後に追記:
```css

/* ===== ツアー追加ボタンのフィードバック演出 (2026-08-10) =====
   成功: チェック描画ライクなフラーリッシュ (housing-check-bounce/ripple を流用、色はエーテライトの
   青に統一。ハウジングの2アクセント体系(honey=主アクション/aether=選択・進行)に合わせ、
   「追加済み」は選択状態として扱うため aether を使う)。
   失敗: ボタン単体のシェイク(danger色)。 */
.housing-card-add-btn[data-tour-anim="success"] {
  overflow: visible;
  animation: housing-tour-add-glow 300ms ease-in-out;
}
.housing-card-add-btn[data-tour-anim="success"] svg {
  animation: housing-check-bounce 400ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
.housing-card-add-btn[data-tour-anim="success"]::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  border: 2px solid var(--housing-aether);
  animation: housing-check-ripple 600ms ease-out;
  pointer-events: none;
}
@keyframes housing-tour-add-glow {
  0% { box-shadow: 0 0 0 rgba(0, 191, 255, 0); }
  40% { box-shadow: 0 0 20px var(--housing-aether-glow-strong); }
  100% { box-shadow: 0 0 0 rgba(0, 191, 255, 0); }
}

/* 追加済み(トレイに入っている間ずっと維持する状態)。honey=主アクションの土台色から、
   aether=選択状態の塗りへ切り替える(housing-card-select.is-selected と同じ意味付け)。 */
.housing-card-add-btn.is-added {
  background: var(--housing-aether-cta-bg);
  border-color: var(--housing-aether-cta-bg);
  color: var(--housing-aether-cta-text);
}
.housing-card-add-btn.is-added:hover {
  background: var(--housing-aether-cta-bg-hover);
  border-color: var(--housing-aether-cta-bg-hover);
}

.housing-card-add-btn[data-tour-anim="error"] {
  animation: housing-shake 320ms ease-in-out;
  border-color: var(--housing-danger);
  color: var(--housing-danger);
}
@keyframes housing-shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-4px); }
  40% { transform: translateX(4px); }
  60% { transform: translateX(-3px); }
  80% { transform: translateX(3px); }
}

@media (prefers-reduced-motion: reduce) {
  .housing-card-add-btn[data-tour-anim="success"],
  .housing-card-add-btn[data-tour-anim="success"] svg,
  .housing-card-add-btn[data-tour-anim="success"]::after,
  .housing-card-add-btn[data-tour-anim="error"] {
    animation: none;
  }
}

/* ツアー追加失敗の吹き出し (HousingTourAddErrorBubble)。document.body 直下に portal されるため
   ここでは housing-workspace スコープに依存しないグローバルなスタイルにする。 */
.housing-tour-error-bubble {
  position: fixed;
  transform: translate(-50%, calc(-100% - 8px));
  max-width: 220px;
  padding: 6px 10px;
  border-radius: 8px;
  background: var(--housing-panel-bg-solid);
  border: 1px solid var(--housing-danger);
  box-shadow: var(--housing-panel-shadow);
  color: var(--housing-danger);
  font-size: var(--housing-text-xs);
  line-height: 1.35;
  text-align: center;
  z-index: 60;
  pointer-events: none;
  animation: housing-tour-bubble-in 160ms ease-out;
}
@keyframes housing-tour-bubble-in {
  from { opacity: 0; transform: translate(-50%, calc(-100% - 2px)); }
  to { opacity: 1; transform: translate(-50%, calc(-100% - 8px)); }
}
```

- [ ] **Step 2: ビルドが壊れていないことを確認する**

Run: `npx vite build --mode development 2>&1 | tail -20`(CSS構文エラーがあればここで検出される。実行が重い場合は `npx vitest run src/lib/housing/__tests__/useTourAddFeedback.test.ts` の通過確認のみで次タスクへ進めてもよい)
Expected: エラー無し

- [ ] **Step 3: Commit**

```bash
git add src/styles/housing.css
git commit -m "style(housing): ツアー追加ボタンの成功/失敗演出+追加済み色+吹き出しCSSを追加"
```

---

### Task 5: `ListingCard.tsx` への配線

**Files:**
- Modify: `src/components/housing/browse/ListingCard.tsx`
- Modify: `src/components/housing/browse/__tests__/ListingCard.test.tsx`
- Modify: `src/__tests__/housing/ListingCard.test.tsx`

**Interfaces:**
- Consumes: `useTourAddFeedback` (Task 2) / `HousingTourAddErrorBubble` (Task 3) / 既存 `useRipple`・`HousingRipple`
- Produces: `ListingCard` の `onAddToTour` prop の**契約は変更しない**(`(id: string) => void`、footer 描画有無のゲートとしても従来通り使う)。ただし呼び出しタイミングが変わる: 地域チェックで**ブロックされたときは呼ばない**(従来の呼び出し元(`BrowsePage.addToTray`/`FavoritesPage`等)が持つ画面下中央トーストを、二重に出さないため)。

- [ ] **Step 1: 失敗するテストを書く(追加済み表示・トグルOFF・地域ブロック)**

`src/components/housing/browse/__tests__/ListingCard.test.tsx` の先頭 import に以下を追加(既存 import 群の直後):
```tsx
import { useTourTrayStore } from '../../../../store/useTourTrayStore';
import { useHousingListingsStore } from '../../../../store/useHousingListingsStore';
```

既存の `beforeEach(() => { navigate.mockReset(); });` を以下に置き換える(トレイ状態を毎回リセットしないと、後続テストに前のテストの追加状態が漏れるため):
```tsx
beforeEach(() => {
  navigate.mockReset();
  useTourTrayStore.setState({ trayIds: [], pinnedIds: [], manualOrder: false });
  useHousingListingsStore.setState({ listings: [], myListings: [] } as never);
});
```

ファイル末尾に新規 `describe` ブロックを追加:
```tsx
describe('ListingCard — ツアー追加のフィードバック(2026-08-10)', () => {
  it('追加成功で「追加済み」表示になりaria-pressedがtrueになる', () => {
    const onAddToTour = vi.fn();
    renderCard({ onAddToTour, listing: { ...mockListing, region: 'JP' } });
    const addBtn = screen.getAllByRole('button').find((btn) =>
      btn.className.includes('housing-card-add-btn'),
    )!;
    fireEvent.click(addBtn);
    expect(addBtn).toHaveTextContent('追加済み');
    expect(addBtn).toHaveAttribute('aria-pressed', 'true');
    expect(addBtn).toHaveClass('is-added');
    expect(onAddToTour).toHaveBeenCalledWith(mockListing.id);
  });

  it('追加済みの状態でもう一度押すとトレイから外れ「ツアーに追加」表示に戻る', () => {
    renderCard({ listing: { ...mockListing, region: 'JP' } });
    const addBtn = screen.getAllByRole('button').find((btn) =>
      btn.className.includes('housing-card-add-btn'),
    )!;
    fireEvent.click(addBtn); // 追加
    fireEvent.click(addBtn); // 外す
    expect(addBtn).toHaveTextContent('ツアーに追加');
    expect(addBtn).toHaveAttribute('aria-pressed', 'false');
    expect(useTourTrayStore.getState().trayIds).toEqual([]);
  });

  it('別リージョンのためブロックされたときは onAddToTour を呼ばず吹き出しを出す', () => {
    useHousingListingsStore.setState({
      listings: [{ id: 'other1', region: 'NA' } as never],
      myListings: [],
    } as never);
    useTourTrayStore.setState({ trayIds: ['other1'], pinnedIds: [], manualOrder: false });
    const onAddToTour = vi.fn();
    renderCard({ onAddToTour, listing: { ...mockListing, region: 'JP' } });
    const addBtn = screen.getAllByRole('button').find((btn) =>
      btn.className.includes('housing-card-add-btn'),
    )!;
    fireEvent.click(addBtn);
    expect(onAddToTour).not.toHaveBeenCalled();
    expect(screen.getByTestId('housing-tour-error-bubble')).toBeInTheDocument();
    expect(useTourTrayStore.getState().trayIds).toEqual(['other1']);
  });
});
```

`src/__tests__/housing/ListingCard.test.tsx` の `beforeEach` に、リーク防止のためトレイのリセットを追加(store import も追加):
```tsx
import { useTourTrayStore } from '../../store/useTourTrayStore';
```
```tsx
beforeEach(() => {
  useHousingFavoritesStore.setState({ ids: [] } as never);
  useTourTrayStore.setState({ trayIds: [], pinnedIds: [], manualOrder: false });
  navigate.mockReset();
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run src/components/housing/browse/__tests__/ListingCard.test.tsx`
Expected: FAIL(「追加済み」テキストが無い・`is-added` クラスが無い・`housing-tour-error-bubble` が無い、等)

- [ ] **Step 3: `ListingCard.tsx` を実装する**

`src/components/housing/browse/ListingCard.tsx:1` は既に `import { useEffect, useRef, useState } from 'react';`、`:5` は既に `import { Plus, Check, Pencil, Image as ImageIcon } from 'lucide-react';` で `useRef`/`Check` とも import 済みなので、この2つの追加作業は不要。

新規 import を追加(`useRipple` 等の既存 import 群の近くに):
```tsx
import { useTourAddFeedback } from '../../../lib/housing/useTourAddFeedback';
import { HousingTourAddErrorBubble } from '../HousingTourAddErrorBubble';
```

コンポーネント本体、`const { ripples, onClick: addRipple } = useRipple();` の直後に追加:
```tsx
  const addToTourBtnRef = useRef<HTMLButtonElement>(null);
  const tourFeedback = useTourAddFeedback(listing.id, listing.region ?? null);
```

footer のボタン部分(既存):
```tsx
      {onAddToTour && (
        <div className="housing-listing-card-footer">
          <button
            type="button"
            className="housing-card-add-btn"
            disabled={listing.visibility === 'unlisted'}
            aria-disabled={listing.visibility === 'unlisted'}
            title={listing.visibility === 'unlisted' ? t('housing.card.addressPrivate') : undefined}
            onClick={(e) => {
              e.stopPropagation();
              if (listing.visibility === 'unlisted') return;
              addRipple(e);
              onAddToTour(listing.id);
            }}
          >
            <Plus size={14} aria-hidden="true" />
            {t('housing.card.add_to_tour')}
            <HousingRipple ripples={ripples} />
          </button>
        </div>
      )}
```

これを置き換える:
```tsx
      {onAddToTour && (
        <div className="housing-listing-card-footer">
          <button
            ref={addToTourBtnRef}
            type="button"
            className={`housing-card-add-btn${tourFeedback.isAdded ? ' is-added' : ''}`}
            data-tour-anim={tourFeedback.animState}
            disabled={listing.visibility === 'unlisted'}
            aria-disabled={listing.visibility === 'unlisted'}
            aria-pressed={tourFeedback.isAdded}
            title={listing.visibility === 'unlisted' ? t('housing.card.addressPrivate') : undefined}
            onClick={(e) => {
              e.stopPropagation();
              if (listing.visibility === 'unlisted') return;
              addRipple(e);
              const outcome = tourFeedback.attemptToggle();
              if (outcome === 'added') onAddToTour(listing.id);
            }}
          >
            {tourFeedback.isAdded ? (
              <Check size={14} aria-hidden="true" />
            ) : (
              <Plus size={14} aria-hidden="true" />
            )}
            {tourFeedback.isAdded ? t('housing.card.added_to_tour') : t('housing.card.add_to_tour')}
            <HousingRipple ripples={ripples} />
          </button>
          <HousingTourAddErrorBubble anchorRef={addToTourBtnRef} message={tourFeedback.errorMessage} />
        </div>
      )}
```

- [ ] **Step 4: テストを実行して通過を確認する**

Run: `npx vitest run src/components/housing/browse/__tests__/ListingCard.test.tsx src/__tests__/housing/ListingCard.test.tsx`
Expected: PASS (全テスト。既存テストも含めて回帰なし)

- [ ] **Step 5: Commit**

```bash
git add src/components/housing/browse/ListingCard.tsx src/components/housing/browse/__tests__/ListingCard.test.tsx src/__tests__/housing/ListingCard.test.tsx
git commit -m "feat(housing): 探すページのツアー追加ボタンに成功/失敗フィードバックを追加"
```

---

### Task 6: `HousingActionBar.tsx` への配線(旧ロジック削除)

**Files:**
- Modify: `src/components/housing/listing/HousingActionBar.tsx`
- Modify: `src/components/housing/listing/__tests__/HousingActionBar.test.tsx`

**Interfaces:**
- Consumes: `useTourAddFeedback` (Task 2) / `HousingTourAddErrorBubble` (Task 3)
- Produces: 変更なし(このボタンは外部に `onAddToTour` 相当のコールバックを持たないリーフ。呼び出し元 (`HousingDetailContent`) への影響なし)

- [ ] **Step 1: 失敗するテストを書く**

`src/components/housing/listing/__tests__/HousingActionBar.test.tsx` の import 群に追加:
```tsx
import { useHousingListingsStore } from '../../../../store/useHousingListingsStore';
```

既存の `beforeEach` (`navigateMock.mockReset(); useTourTrayStore.setState({ trayIds: [], pinnedIds: [], manualOrder: false });`) に、テスト間の汚染防止のため以下を追加する:
```tsx
    useHousingListingsStore.setState({ listings: [], myListings: [] } as never);
```

`describe('HousingActionBar', ...)` 内、既存の `it('「＋ツアー」ボタンを押すと...')` の直後に新規テストを追加:
```tsx
  it('追加成功で「追加済み」表示になりaria-pressedがtrueになる', () => {
    renderBar({ viewerUid: null });
    const btn = screen.getByRole('button', { name: 'housing.card.add_to_tour' });
    fireEvent.click(btn);
    expect(btn).toHaveTextContent('housing.card.added_to_tour');
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('追加済みの状態でもう一度押すとトレイから外れる', () => {
    renderBar({ viewerUid: null });
    const btn = screen.getByRole('button', { name: 'housing.card.add_to_tour' });
    fireEvent.click(btn); // 追加
    fireEvent.click(btn); // 外す
    expect(useTourTrayStore.getState().trayIds).toEqual([]);
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('別リージョンのためブロックされたときはトレイに積まれず吹き出しが出る(下中央トーストは出ない想定)', () => {
    useHousingListingsStore.setState({
      listings: [{ id: 'other1', region: 'NA' } as never],
      myListings: [],
    } as never);
    useTourTrayStore.setState({ trayIds: ['other1'], pinnedIds: [], manualOrder: false });
    // baseListing.dc === 'Mana' → region 'JP'。'NA' とはブロックされる組み合わせ。
    renderBar({ viewerUid: null });
    const btn = screen.getByRole('button', { name: 'housing.card.add_to_tour' });
    fireEvent.click(btn);
    expect(useTourTrayStore.getState().trayIds).toEqual(['other1']);
    expect(screen.getByTestId('housing-tour-error-bubble')).toBeInTheDocument();
  });
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run src/components/housing/listing/__tests__/HousingActionBar.test.tsx`
Expected: FAIL(「追加済み」表示が無い・`aria-pressed` が無い・吹き出しが無い)

- [ ] **Step 3: `HousingActionBar.tsx` を実装する**

削除する import(もう使わない):
```tsx
import { canAddToTour, tourAnchorRegion } from '../../../lib/housing/tourCrossing';
import { useTourTrayStore } from '../../../store/useTourTrayStore';
import { useHousingListingsStore } from '../../../store/useHousingListingsStore';
import { useEphemeralListingsStore } from '../../../store/useEphemeralListingsStore';
```
(`regionForDC` の import と `dcServerMap` はこの後も使うので残す。`showToast` は `onReportClick`/`onConfirmStillHere`/`onConfirmDelete` で引き続き使うので残す。)

追加する import:
```tsx
import { Plus, Check } from 'lucide-react';
import { useTourAddFeedback } from '../../../lib/housing/useTourAddFeedback';
import { HousingTourAddErrorBubble } from '../HousingTourAddErrorBubble';
```

既存の以下のブロック(実機FB②コメント付き、`const { ripples, onClick: addRipple } = useRipple();` から `};` まで):
```tsx
  // 実機FB②: 探すページのカードはスペース不足でボタンを置けないため、詳細ページにも
  // 「＋ツアーに追加」を追加。BrowsePage.addToTray と同じロジック (地域跨ぎブロック + トースト)。
  const { ripples, onClick: addRipple } = useRipple();
  const setTrayIds = useTourTrayStore((s) => s.setTrayIds);
  const listingUnlisted = isAddressHidden(listing);
  const onAddToTour = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (listingUnlisted) return;
    addRipple(e);
    const trayIds = useTourTrayStore.getState().trayIds;
    const pool = [
      ...useHousingListingsStore.getState().listings,
      ...useHousingListingsStore.getState().myListings,
      ...useEphemeralListingsStore.getState().ephemeralListings,
    ];
    const trayRegion = tourAnchorRegion(
      trayIds.map((id) => pool.find((l) => l.id === id)?.region ?? null),
    );
    if (!canAddToTour(trayRegion, regionForDC(listing.dc) ?? '')) {
      showToast(t('housing.tour.region_block'), 'error');
      return;
    }
    setTrayIds((prev) => (prev.includes(listing.id) ? prev : [...prev, listing.id]));
  };
```

これを置き換える:
```tsx
  // 実機FB②: 探すページのカードはスペース不足でボタンを置けないため、詳細ページにも
  // 「＋ツアーに追加」を追加。地域跨ぎチェック・演出は useTourAddFeedback に集約
  // (ListingCard.tsx の footer ボタンと共有)。
  const { ripples, onClick: addRipple } = useRipple();
  const listingUnlisted = isAddressHidden(listing);
  const addToTourBtnRef = useRef<HTMLButtonElement>(null);
  const tourFeedback = useTourAddFeedback(listing.id, regionForDC(listing.dc));
  const onAddToTourClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (listingUnlisted) return;
    addRipple(e);
    tourFeedback.attemptToggle();
  };
```

`src/components/housing/listing/HousingActionBar.tsx:10` の既存 `import { useState } from 'react';` を `import { useRef, useState } from 'react';` に変更する(`useRef` を追加)。

既存のボタン部分:
```tsx
      <button
        type="button"
        className="housing-card-add-btn housing-action-bar-add-tour"
        disabled={listingUnlisted}
        aria-disabled={listingUnlisted}
        aria-label={t('housing.card.add_to_tour')}
        title={listingUnlisted ? t('housing.card.addressPrivate') : undefined}
        onClick={onAddToTour}
      >
        <Plus size={14} aria-hidden="true" />
        {t('housing.detail.add_to_tour')}
        <HousingRipple ripples={ripples} />
      </button>
```

これを置き換える:
```tsx
      <button
        ref={addToTourBtnRef}
        type="button"
        className={`housing-card-add-btn housing-action-bar-add-tour${tourFeedback.isAdded ? ' is-added' : ''}`}
        data-tour-anim={tourFeedback.animState}
        disabled={listingUnlisted}
        aria-disabled={listingUnlisted}
        aria-pressed={tourFeedback.isAdded}
        aria-label={tourFeedback.isAdded ? t('housing.card.added_to_tour') : t('housing.card.add_to_tour')}
        title={listingUnlisted ? t('housing.card.addressPrivate') : undefined}
        onClick={onAddToTourClick}
      >
        {tourFeedback.isAdded ? (
          <Check size={14} aria-hidden="true" />
        ) : (
          <Plus size={14} aria-hidden="true" />
        )}
        {tourFeedback.isAdded ? t('housing.card.added_to_tour') : t('housing.detail.add_to_tour')}
        <HousingRipple ripples={ripples} />
      </button>
      <HousingTourAddErrorBubble anchorRef={addToTourBtnRef} message={tourFeedback.errorMessage} />
```

**注意:** `aria-label` を `added_to_tour` に切り替えると、既存テスト `screen.getByRole('button', { name: 'housing.card.add_to_tour' })` は**追加後の状態では**マッチしなくなる(意図通り。追加前の状態で取得してから click するテストは影響を受けない。Step 1 で追加した新規テストも、ボタン取得は追加前に行っている)。

- [ ] **Step 4: テストを実行して通過を確認する**

Run: `npx vitest run src/components/housing/listing/__tests__/HousingActionBar.test.tsx`
Expected: PASS (全テスト)

- [ ] **Step 5: Commit**

```bash
git add src/components/housing/listing/HousingActionBar.tsx src/components/housing/listing/__tests__/HousingActionBar.test.tsx
git commit -m "feat(housing): 詳細ページのツアー追加ボタンに成功/失敗フィードバックを追加"
```

---

### Task 7: 最終確認

**Files:** なし(検証のみ)

- [ ] **Step 1: ハウジング関連テストを一括実行する**

Run: `npx vitest run src/lib/housing/__tests__/useTourAddFeedback.test.ts src/components/housing/__tests__/HousingTourAddErrorBubble.test.tsx src/components/housing/browse/__tests__/ListingCard.test.tsx src/__tests__/housing/ListingCard.test.tsx src/components/housing/listing/__tests__/HousingActionBar.test.tsx`
Expected: 全PASS

- [ ] **Step 2: 型チェック**

Run: `npx tsc -b`
Expected: エラー無し(未使用importの削除漏れ等がここで検出される)

- [ ] **Step 3: 全体テストスイートを流し、無関係な既存テストを壊していないか確認する**

Run: `npx vitest run 2>&1 | tail -40`
Expected: 既存の既知失敗(TopBar4件+HousingWorkspace1件、`docs/TODO.md` 記載の撤去予定分)以外は全PASS

- [ ] **Step 4: 開発サーバーで実機確認(ユーザー側)**

このステップは自動化しない。ユーザーに、探すページ・詳細ページそれぞれで(1)成功時のチェックマーク演出+「追加済み」表示、(2)もう一度押すと外れること、(3)別リージョンの家を追加しようとしたときのシェイク+吹き出し、を実機(`npm run dev`)で確認してもらう。

- [ ] **Step 5: 最終コミット済み確認**

Run: `git log --oneline -8`
Expected: Task 1〜6 の6コミットが積まれている
