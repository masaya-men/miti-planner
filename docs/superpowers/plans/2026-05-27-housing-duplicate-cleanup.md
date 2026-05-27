# ハウジング重複の自動掃除 実装計画 (§3.8)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ハウジング重複登録の自動掃除を 3 機能セット (詳細モーダル重複一覧 / 長押し「ちがった」 / ツアー自動追加) + 通報 API 閾値 1 統合で実現する。

**Architecture:** 既存 `findListingsByAddressKey` の peers fetch を `HousingDetailModalRoute` から `HousingDetailContent` まで thread。 「ちがった」 長押しは新規 `useLongPressConfirm` hook + `HousingLongPressButton` で実装 (Phase 2-6 カードバッジでも再利用)。 ツアー自動追加は pure helper `expandTourWithDuplicates` を `FavoritesModal.handleDragEnd` の ADD 経路にだけ挿入する (= スナップショット型維持)。

**Tech Stack:** React 18, TypeScript, Zustand, vitest (happy-dom), Firebase Admin Firestore, framer-motion, react-i18next, react-hot-toast

**Spec:** [docs/superpowers/specs/2026-05-27-housing-duplicate-cleanup-design.md](../specs/2026-05-27-housing-duplicate-cleanup-design.md)

---

## Phase 1: 長押し hook + 通報 API 閾値 1 統合

### Task 1.1: 通報 API `_reportListingHandler` に重複時閾値 1 ロジック追加

**Files:**
- Modify: `api/housing/_reportListingHandler.ts` (transaction 内で同 addressKey の他生存 listing 数を取得 → reason=`wrong_info` + 重複あり時に threshold=1)
- Test: 既存 admin test (新規追加不要、 まず実機検証ベース)

- [ ] **Step 1: 修正方針確認**

現状 [api/housing/_reportListingHandler.ts:82-104](../../api/housing/_reportListingHandler.ts#L82-L104) の transaction で `threshold` は常に `REPORT_AUTO_HIDE_THRESHOLD` (= 3)。 これを「reason=`wrong_info` AND 同 addressKey に自分以外の生存 listing あり」 のときだけ 1 に切り替える。

- [ ] **Step 2: 実装**

```ts
// transaction 内、 既存 const data = snap.data()! の直後に追加。
// Firestore composite index を避けるため addressKey 単一 equality + client filter
// (= addressKey ごとの listing は通常 1-5 件で limit(10) で十分カバー)。
const REPORT_DUPLICATE_THRESHOLD = 1;

let threshold = REPORT_AUTO_HIDE_THRESHOLD;
if (reason === 'wrong_info' && data.addressKey) {
  const duplicateSnap = await tx.get(
    adminDb
      .collection('housing_listings')
      .where('addressKey', '==', data.addressKey)
      .limit(10)
  );
  const hasDuplicates = duplicateSnap.docs.some((d) => {
    if (d.id === listingId) return false;
    const peer = d.data();
    return !peer.isHidden && !peer.deletedAt;
  });
  if (hasDuplicates) threshold = REPORT_DUPLICATE_THRESHOLD;
}

const newCount = (data.reportCount || 0) + 1;
const shouldHide = newCount >= threshold && !data.isHidden;
```

既存の `const newCount = ...` 行を上記ブロックに差し替える。 `REPORT_AUTO_HIDE_THRESHOLD` import は既存 ([api/housing/_reportListingHandler.ts:16](../../api/housing/_reportListingHandler.ts#L16))。

**index 補足**: 単一 equality (`addressKey`) + auto-created single-field index で動作するため `firestore.indexes.json` の新規追加は**不要**。 memory `reference_firestore_composite_index` の対象外。

- [ ] **Step 3: tsc + build pass 確認**

Run: `rtk npm run build`
Expected: 既存 build と同等、 type error 無し。

- [ ] **Step 4: 実機検証準備のメモ**

実機検証は Phase 1 完了 (T1.3 まで) 後に「重複登録 2 件作成 → 1 件に reason=`wrong_info` 通報 → 即 1 撃 hide される」 を確認する。 単独 listing への wrong_info 通報は 3 回必要なまま (= 既存挙動維持) を別途確認。

- [ ] **Step 5: Commit**

```bash
rtk git add api/housing/_reportListingHandler.ts
rtk git commit -m "feat(housing): #60 §3.8 重複時 reason=wrong_info で閾値 1 hide

同 addressKey に他生存 listing あり AND reason=wrong_info のとき threshold=1。
他 reason / 単独 listing は既存 threshold=3 維持。「ちがった」 長押し導入の前段。"
```

---

### Task 1.2: `useLongPressConfirm` hook を TDD で実装

**Files:**
- Create: `src/lib/housing/useLongPressConfirm.ts`
- Test: `src/lib/housing/__tests__/useLongPressConfirm.test.ts`

- [ ] **Step 1: 失敗テストを書く**

Create `src/lib/housing/__tests__/useLongPressConfirm.test.ts`:

```ts
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useLongPressConfirm } from '../useLongPressConfirm';

describe('useLongPressConfirm', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('start → 完了時間到達で onConfirm が呼ばれる', () => {
    const onConfirm = vi.fn();
    const { result } = renderHook(() =>
      useLongPressConfirm({ duration: 2000, onConfirm }),
    );

    act(() => {
      result.current.start();
    });
    expect(onConfirm).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('start → cancel で onConfirm が呼ばれない', () => {
    const onConfirm = vi.fn();
    const { result } = renderHook(() =>
      useLongPressConfirm({ duration: 2000, onConfirm }),
    );

    act(() => {
      result.current.start();
      vi.advanceTimersByTime(1000);
      result.current.cancel();
      vi.advanceTimersByTime(2000);
    });
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('progress が 0 → 1 へ単調増加 (start 後 advance)', () => {
    const { result } = renderHook(() =>
      useLongPressConfirm({ duration: 2000, onConfirm: vi.fn() }),
    );

    expect(result.current.progress).toBe(0);
    act(() => {
      result.current.start();
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.progress).toBeGreaterThan(0.4);
    expect(result.current.progress).toBeLessThan(0.6);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.progress).toBe(1);
  });

  it('cancel 後は progress が 0 に戻る', () => {
    const { result } = renderHook(() =>
      useLongPressConfirm({ duration: 2000, onConfirm: vi.fn() }),
    );

    act(() => {
      result.current.start();
      vi.advanceTimersByTime(1000);
      result.current.cancel();
    });
    expect(result.current.progress).toBe(0);
    expect(result.current.isPressing).toBe(false);
  });

  it('2 回 start しても 1 回しか confirm しない', () => {
    const onConfirm = vi.fn();
    const { result } = renderHook(() =>
      useLongPressConfirm({ duration: 2000, onConfirm }),
    );

    act(() => {
      result.current.start();
      result.current.start();
      vi.advanceTimersByTime(2000);
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: テスト実行 (失敗を確認)**

Run: `rtk vitest run src/lib/housing/__tests__/useLongPressConfirm.test.ts`
Expected: 全 5 件 fail (`useLongPressConfirm` が未定義)

- [ ] **Step 3: 最小実装**

Create `src/lib/housing/useLongPressConfirm.ts`:

```ts
/**
 * 「ちがった」 ボタン用の長押し確定 hook。
 *
 * - duration ミリ秒押し続けると onConfirm 発火
 * - 途中 cancel すれば progress=0 に戻る、 onConfirm は呼ばれない
 * - progress は 16ms (= 約 60fps) tick で 0 → 1 に上がる
 * - 既に押下中なら start を無視 (= 二重起動防止)
 *
 * 設計書 docs/superpowers/specs/2026-05-27-housing-duplicate-cleanup-design.md §2.2
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseLongPressConfirmOptions {
  /** 確定までの時間 (ms)。 デフォルト 2000 */
  duration?: number;
  onConfirm: () => void;
}

export interface UseLongPressConfirmReturn {
  start: () => void;
  cancel: () => void;
  isPressing: boolean;
  progress: number;
}

const PROGRESS_TICK_MS = 16;

export function useLongPressConfirm(
  options: UseLongPressConfirmOptions,
): UseLongPressConfirmReturn {
  const { duration = 2000, onConfirm } = options;
  const [isPressing, setIsPressing] = useState(false);
  const [progress, setProgress] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onConfirmRef = useRef(onConfirm);

  // onConfirm の最新参照を保つ
  useEffect(() => {
    onConfirmRef.current = onConfirm;
  }, [onConfirm]);

  const clearTick = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    clearTick();
    startTimeRef.current = null;
    setIsPressing(false);
    setProgress(0);
  }, [clearTick]);

  const start = useCallback(() => {
    if (startTimeRef.current !== null) return; // 二重起動防止
    startTimeRef.current = Date.now();
    setIsPressing(true);
    setProgress(0);

    tickRef.current = setInterval(() => {
      const startedAt = startTimeRef.current;
      if (startedAt === null) return;
      const elapsed = Date.now() - startedAt;
      const next = Math.min(1, elapsed / duration);
      setProgress(next);
      if (next >= 1) {
        clearTick();
        startTimeRef.current = null;
        setIsPressing(false);
        onConfirmRef.current();
      }
    }, PROGRESS_TICK_MS);
  }, [duration, clearTick]);

  // unmount で tick 破棄
  useEffect(() => clearTick, [clearTick]);

  return { start, cancel, isPressing, progress };
}
```

- [ ] **Step 4: テスト実行 (全件 pass)**

Run: `rtk vitest run src/lib/housing/__tests__/useLongPressConfirm.test.ts`
Expected: 全 5 件 PASS

- [ ] **Step 5: Commit**

```bash
rtk git add src/lib/housing/useLongPressConfirm.ts src/lib/housing/__tests__/useLongPressConfirm.test.ts
rtk git commit -m "feat(housing): #60 §3.8 useLongPressConfirm hook 追加

2 秒長押し確定 + progress 0→1 + cancel 復帰の純 hook。
「ちがった」 ボタンと Phase 2-6 カード版 ちがったボタンで再利用。"
```

---

### Task 1.3: `HousingLongPressButton` コンポーネント実装

**Files:**
- Create: `src/components/housing/listing/HousingLongPressButton.tsx`
- Modify: `src/styles/housing.css` (= ring fill 進捗 UI の class 追加)

- [ ] **Step 1: コンポーネント実装**

Create `src/components/housing/listing/HousingLongPressButton.tsx`:

```tsx
/**
 * 長押し確定ボタン (= 「ちがった」 用、 再利用前提)。
 *
 * - 2 秒長押しで onConfirm 発火
 * - 円形 ring fill の進捗 UI (= prefers-reduced-motion で段階化)
 * - mobile: touch-action: manipulation + user-select: none + onTouchStart preventDefault
 * - PC: mousedown/up/leave + keyboard (Space 長押し)
 *
 * 設計書 docs/superpowers/specs/2026-05-27-housing-duplicate-cleanup-design.md §2.2
 */
import { useLongPressConfirm } from '../../../lib/housing/useLongPressConfirm';

export interface HousingLongPressButtonProps {
  label: string;
  /** ホバー/長押し中のヒント文字 (例「2 秒長押しで非表示」) */
  hint?: string;
  /** 確定時の callback (= 通報 fetch 呼び出し等) */
  onConfirm: () => void;
  disabled?: boolean;
  durationMs?: number;
  className?: string;
}

export const HousingLongPressButton: React.FC<HousingLongPressButtonProps> = ({
  label,
  hint,
  onConfirm,
  disabled = false,
  durationMs = 2000,
  className,
}) => {
  const { start, cancel, isPressing, progress } = useLongPressConfirm({
    duration: durationMs,
    onConfirm,
  });

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    start();
  };
  const onPointerUpOrLeave = () => {
    if (!isPressing) return;
    cancel();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (!isPressing) start();
    }
  };
  const onKeyUp = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      cancel();
    }
  };

  return (
    <button
      type="button"
      className={`housing-longpress-btn${className ? ` ${className}` : ''}`}
      data-pressing={isPressing || undefined}
      disabled={disabled}
      aria-pressed={isPressing}
      aria-valuenow={Math.round(progress * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUpOrLeave}
      onPointerLeave={onPointerUpOrLeave}
      onPointerCancel={onPointerUpOrLeave}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      style={{ ['--housing-longpress-progress' as string]: `${progress}` }}
    >
      <span className="housing-longpress-btn-label">{label}</span>
      {hint && <span className="housing-longpress-btn-hint">{hint}</span>}
      <span className="housing-longpress-btn-ring" aria-hidden="true" />
    </button>
  );
};
```

- [ ] **Step 2: CSS 追加 (housing.css)**

Append to `src/styles/housing.css` (= housing token ブロック内に新規 class):

```css
/* §3.8 長押し「ちがった」 ボタン (= HousingLongPressButton) */
.housing-longpress-btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: var(--housing-radius-md, 8px);
    border: 1px solid var(--housing-border-warning, rgba(255, 180, 120, 0.45));
    background: var(--housing-bg-warning-soft, rgba(255, 200, 135, 0.08));
    color: var(--housing-text-warning, #ffc987);
    font-size: var(--housing-font-sm, 13px);
    cursor: pointer;
    touch-action: manipulation;
    user-select: none;
    -webkit-user-select: none;
    overflow: hidden;
    transition: background-color 120ms ease, border-color 120ms ease;
}

.housing-longpress-btn:hover:not(:disabled) {
    background: var(--housing-bg-warning-hover, rgba(255, 200, 135, 0.16));
}

.housing-longpress-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
}

.housing-longpress-btn-ring {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: calc(var(--housing-longpress-progress, 0) * 100%);
    background: var(--housing-bg-danger-fill, rgba(255, 100, 80, 0.28));
    pointer-events: none;
    transition: width 32ms linear;
    z-index: 0;
}

.housing-longpress-btn-label,
.housing-longpress-btn-hint {
    position: relative;
    z-index: 1;
}

.housing-longpress-btn-hint {
    font-size: var(--housing-font-xs, 11px);
    opacity: 0.7;
}

@media (prefers-reduced-motion: reduce) {
    .housing-longpress-btn-ring {
        transition: width 200ms steps(8);
    }
}
```

CSS token は既存 `--housing-radius-md` 等を流用、 不足分は fallback 値で対応。 housing.css 内に既存 token 一覧があれば fallback 値を該当 token 名に差し替える。

- [ ] **Step 3: tsc + build pass 確認**

Run: `rtk npm run build`
Expected: build success.

- [ ] **Step 4: Commit**

```bash
rtk git add src/components/housing/listing/HousingLongPressButton.tsx src/styles/housing.css
rtk git commit -m "feat(housing): #60 §3.8 HousingLongPressButton コンポーネント追加

useLongPressConfirm + ring fill 進捗 UI + a11y (aria-valuenow/keyboard) +
mobile 抑止 (touch-action / user-select / preventDefault)。"
```

---

### Task 1.4: i18n キー追加 (ja primary、 en/ko/zh は ja コピー)

**Files:**
- Modify: `src/locales/ja.json`, `src/locales/en.json`, `src/locales/ko.json`, `src/locales/zh.json`

- [ ] **Step 1: ja.json に追加**

`src/locales/ja.json` の `housing` ブロック内 (`detail` か新規 `duplicates` セクション) に追加。 既存構造を確認してから挿入位置を選ぶ。

```json
"housing": {
  "detail": {
    "duplicates": {
      "title": "この住所の他の登録 ({{count}})",
      "action_wrong": "ちがった",
      "long_press_hint": "2 秒長押しで非表示",
      "toast_hidden": "「ちがった」 として処理しました。 該当登録は非表示になりました"
    }
  },
  "tour": {
    "auto_added_toast": "同住所の他 {{count}} 件もツアーに追加しました"
  }
}
```

- [ ] **Step 2: en/ko/zh は ja コピー**

en/ko/zh の対応箇所に同じキー構造でコピー、 翻訳実値はあとで (= TODO.md に記録済の方針)。

- [ ] **Step 3: tsc + build pass 確認**

Run: `rtk npm run build`
Expected: build success.

- [ ] **Step 4: Commit**

```bash
rtk git add src/locales/
rtk git commit -m "feat(housing): #60 §3.8 i18n キー追加 (ja primary)

housing.detail.duplicates.* と housing.tour.auto_added_toast。
en/ko/zh は ja コピー、 翻訳実値は別作業。"
```

---

## Phase 2: 詳細モーダル「この住所の他の登録」 セクション

### Task 2.1: `HousingDuplicatePeersSection` コンポーネント実装

**Files:**
- Create: `src/components/housing/listing/HousingDuplicatePeersSection.tsx`
- Test: `src/components/housing/listing/__tests__/HousingDuplicatePeersSection.test.tsx`
- Modify: `src/styles/housing.css` (= section + mini card class 追加)

- [ ] **Step 1: 失敗テストを書く**

Create `src/components/housing/listing/__tests__/HousingDuplicatePeersSection.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { HousingDuplicatePeersSection } from '../HousingDuplicatePeersSection';
import type { HousingListing } from '../../../../types/housing';

i18n.use(initReactI18next).init({
  lng: 'ja',
  resources: {
    ja: {
      translation: {
        housing: {
          detail: {
            duplicates: {
              title: 'この住所の他の登録 ({{count}})',
              action_wrong: 'ちがった',
              long_press_hint: '2 秒長押しで非表示',
            },
          },
        },
      },
    },
  },
});

const mkListing = (id: string, addressKey: string): HousingListing =>
  ({
    id,
    addressKey,
    dc: 'Mana',
    server: 'Pandaemonium',
    area: 'Mist',
    ward: 1,
    plot: 1,
    apartmentNumber: null,
    privateChamber: null,
    sourceImageUrls: [],
    photos: [],
    tags: [],
    description: `desc-${id}`,
    createdAt: 1000,
    updatedAt: 1000,
    lastConfirmedAt: 1000,
    isHidden: false,
    reportCount: 0,
    deletedAt: null,
    ownerUid: 'owner',
  } as any);

describe('HousingDuplicatePeersSection', () => {
  it('peers=[] のとき何も描画しない', () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <HousingDuplicatePeersSection peers={[]} onReportPeer={vi.fn()} />
      </I18nextProvider>,
    );
    expect(container.firstChild).toBeNull();
  });

  it('peers=2 件のとき見出しと 2 つの mini カードを描画', () => {
    const peers = [mkListing('a', 'k'), mkListing('b', 'k')];
    render(
      <I18nextProvider i18n={i18n}>
        <HousingDuplicatePeersSection peers={peers} onReportPeer={vi.fn()} />
      </I18nextProvider>,
    );
    expect(screen.getByText('この住所の他の登録 (2)')).toBeInTheDocument();
    expect(screen.getByText('desc-a')).toBeInTheDocument();
    expect(screen.getByText('desc-b')).toBeInTheDocument();
  });

  it('長押し 2 秒で onReportPeer がその peer.id で呼ばれる', () => {
    vi.useFakeTimers();
    const onReportPeer = vi.fn();
    const peers = [mkListing('a', 'k')];
    render(
      <I18nextProvider i18n={i18n}>
        <HousingDuplicatePeersSection peers={peers} onReportPeer={onReportPeer} />
      </I18nextProvider>,
    );
    const btn = screen.getByRole('button', { name: /ちがった/ });
    fireEvent.pointerDown(btn);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onReportPeer).toHaveBeenCalledWith('a');
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: テスト実行 (失敗を確認)**

Run: `rtk vitest run src/components/housing/listing/__tests__/HousingDuplicatePeersSection.test.tsx`
Expected: 3 件 fail (`HousingDuplicatePeersSection` 未定義)

- [ ] **Step 3: 最小実装**

Create `src/components/housing/listing/HousingDuplicatePeersSection.tsx`:

```tsx
/**
 * 詳細モーダル下部の「この住所の他の登録」 セクション。
 *
 * - peers (= 同 addressKey の他 listing) が 0 件なら何も描画しない
 * - 各 peer を mini カードで縦並び、 右側に長押し「ちがった」 ボタン
 * - onReportPeer(peerId) を完了時に呼ぶ (= 親で reportListing API + toast)
 *
 * 設計書 docs/superpowers/specs/2026-05-27-housing-duplicate-cleanup-design.md §2.1
 */
import { useTranslation } from 'react-i18next';
import type { HousingListing } from '../../../types/housing';
import { formatHousingAddress } from '../../../lib/housing/formatHousingAddress';
import { HousingLongPressButton } from './HousingLongPressButton';

export interface HousingDuplicatePeersSectionProps {
  peers: HousingListing[];
  onReportPeer: (peerId: string) => void;
}

export const HousingDuplicatePeersSection: React.FC<HousingDuplicatePeersSectionProps> = ({
  peers,
  onReportPeer,
}) => {
  const { t, i18n } = useTranslation();
  if (peers.length === 0) return null;

  return (
    <section className="housing-detail-peers">
      <h3 className="housing-detail-peers-title">
        {t('housing.detail.duplicates.title', { count: peers.length })}
      </h3>
      <ul className="housing-detail-peers-list">
        {peers.map((peer) => {
          const addr = formatHousingAddress(peer, i18n.language);
          const title = peer.description?.trim() ? peer.description : addr;
          const thumb = peer.sourceImageUrls?.[0] ?? peer.videoPosterUrl;
          return (
            <li key={peer.id} className="housing-detail-peers-item">
              {thumb && (
                <img
                  className="housing-detail-peers-thumb"
                  src={thumb}
                  alt=""
                  loading="lazy"
                />
              )}
              <div className="housing-detail-peers-info">
                <p className="housing-detail-peers-card-title">{title}</p>
                <p className="housing-detail-peers-card-address">{addr}</p>
              </div>
              <HousingLongPressButton
                label={t('housing.detail.duplicates.action_wrong')}
                hint={t('housing.detail.duplicates.long_press_hint')}
                onConfirm={() => onReportPeer(peer.id)}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
};
```

- [ ] **Step 4: CSS 追加 (housing.css)**

Append to `src/styles/housing.css`:

```css
/* §3.8 詳細モーダル「この住所の他の登録」 セクション */
.housing-detail-peers {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--housing-border-subtle, rgba(255, 255, 255, 0.08));
}

.housing-detail-peers-title {
    font-size: var(--housing-font-md, 15px);
    margin: 0 0 0.75rem;
    color: var(--housing-text-muted, rgba(255, 255, 255, 0.72));
}

.housing-detail-peers-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
}

.housing-detail-peers-item {
    display: grid;
    grid-template-columns: 56px 1fr auto;
    gap: 0.75rem;
    align-items: center;
    padding: 0.5rem;
    border-radius: var(--housing-radius-md, 8px);
    background: var(--housing-bg-tier2, rgba(255, 255, 255, 0.04));
}

.housing-detail-peers-thumb {
    width: 56px;
    height: 56px;
    object-fit: cover;
    border-radius: var(--housing-radius-sm, 6px);
}

.housing-detail-peers-info {
    min-width: 0;
}

.housing-detail-peers-card-title {
    font-size: var(--housing-font-sm, 13px);
    margin: 0 0 0.125rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.housing-detail-peers-card-address {
    font-size: var(--housing-font-xs, 11px);
    color: var(--housing-text-muted, rgba(255, 255, 255, 0.6));
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
```

- [ ] **Step 5: テスト実行 (全件 pass)**

Run: `rtk vitest run src/components/housing/listing/__tests__/HousingDuplicatePeersSection.test.tsx`
Expected: 3 件 PASS

- [ ] **Step 6: Commit**

```bash
rtk git add src/components/housing/listing/HousingDuplicatePeersSection.tsx src/components/housing/listing/__tests__/HousingDuplicatePeersSection.test.tsx src/styles/housing.css
rtk git commit -m "feat(housing): #60 §3.8 HousingDuplicatePeersSection 追加

mini カード縦並び + 長押し「ちがった」 ボタン。 親から peers prop と
onReportPeer callback を受け取る純コンポーネント。"
```

---

### Task 2.2: `HousingDetailModalRoute` で peers を保持 & thread

**Files:**
- Modify: `src/components/housing/listing/HousingDetailModalRoute.tsx` (= 既存 `hasDuplicates` 用 useEffect で `peers` も state 保持)
- Modify: `src/components/housing/listing/HousingDetailModal.tsx` (= peers prop pass-through)

- [ ] **Step 1: 修正対象を確認**

[HousingDetailModalRoute.tsx:47](../../src/components/housing/listing/HousingDetailModalRoute.tsx#L47) 付近: `const [hasDuplicates, setHasDuplicates] = useState(false);` を peers state も追加。

[HousingDetailModalRoute.tsx:94-105](../../src/components/housing/listing/HousingDetailModalRoute.tsx#L94-L105): `findListingsByAddressKey` の useEffect で既に peers fetch 済、 既存 `others.length > 0` 判定の `others` を state にも持つ。

- [ ] **Step 2: HousingDetailModalRoute に peers state 追加**

```tsx
// 既存 hasDuplicates state の下に追加
const [peers, setPeers] = useState<HousingListing[]>([]);

// 既存 useEffect 内、 setHasDuplicates(others.length > 0); の直前に追加
setPeers(others);
```

`HousingListing` の import は既存ファイル先頭から確認、 未 import なら追加。

- [ ] **Step 3: HousingDetailModal に peers prop 追加**

`HousingDetailModal.tsx` の Props 型と JSX 中継:

```tsx
// HousingDetailModalProps に追加
peers?: HousingListing[];

// JSX で HousingDetailContent に prop pass-through
<HousingDetailContent
  ...
  peers={peers}
  ...
/>
```

`HousingDetailContent` 側の props 型拡張は Task 2.3 で実施 (= sequential 依存)。

- [ ] **Step 4: Route から Modal に peers 渡し**

`HousingDetailModalRoute.tsx` の JSX で:

```tsx
<HousingDetailModal
  ...
  peers={peers}
  ...
/>
```

- [ ] **Step 5: tsc + build pass 確認**

Run: `rtk npm run build`
Expected: build success (= 型整合)。 もし `HousingDetailContent` 側 type で fail なら Task 2.3 まで一括 commit。

- [ ] **Step 6: Commit (Task 2.3 と合わせて 1 commit でも OK)**

```bash
rtk git add src/components/housing/listing/HousingDetailModalRoute.tsx src/components/housing/listing/HousingDetailModal.tsx
rtk git commit -m "feat(housing): #60 §3.8 peers prop chain (Route → Modal)

既存 findListingsByAddressKey の useEffect で fetch 済の others を state
保持して下流に渡す。 HousingDetailContent 側の section 統合は次タスク。"
```

---

### Task 2.3: `HousingDetailContent` に peers section を統合 + 通報フロー

**Files:**
- Modify: `src/components/housing/listing/HousingDetailContent.tsx` (= 下部に section 追加)
- Modify: 同上 (= peers prop 受け取り + `onReportPeer` callback 接続)
- 参照: `src/lib/housingApiClient.ts` の `reportListing` 関数 (= 既存)

- [ ] **Step 1: housingApiClient の reportListing 関数を確認**

```bash
rtk grep -n "reportListing" src/lib/housingApiClient.ts
```

既存実装シグネチャを確認 (= `reportListing(id, reason, comment?)` 形を想定)。 異なれば本タスクの呼び出しを合わせる。

- [ ] **Step 2: HousingDetailContent に peers prop 追加 + section 描画**

`HousingDetailContent.tsx` の Props と JSX を以下のように修正:

```tsx
import { HousingDuplicatePeersSection } from './HousingDuplicatePeersSection';
import { reportListing } from '../../../lib/housingApiClient';
import toast from 'react-hot-toast';

export interface HousingDetailContentProps {
  // ... 既存
  peers?: HousingListing[];
}

export const HousingDetailContent: React.FC<HousingDetailContentProps> = ({
  // ... 既存
  peers = [],
}) => {
  const { t, i18n } = useTranslation();
  // ... 既存
  const handleReportPeer = async (peerId: string) => {
    try {
      await reportListing(peerId, 'wrong_info');
      toast.success(t('housing.detail.duplicates.toast_hidden'));
      // 親側で peers 再 fetch するか、 即時 UI 反映のため filter する
      // → onListingUpdated 経由で詳細モーダル側で fetch 再起動が現実的
      onListingUpdated?.();
    } catch (e) {
      toast.error(t('housing.detail.report.error', '通報に失敗しました'));
    }
  };

  return (
    <div className="housing-detail-content">
      {/* ... 既存 reportNotice / gallery / info */}
      <div className="housing-detail-info">
        {/* ... 既存 title / address / tags / description / actions */}
      </div>
      <HousingDuplicatePeersSection peers={peers} onReportPeer={handleReportPeer} />
    </div>
  );
};
```

注: 既存 JSX 構造 ([HousingDetailContent.tsx:56-152](../../src/components/housing/listing/HousingDetailContent.tsx#L56-L152)) は `housing-detail-content` 直下に `report-banner` / `gallery` / `info` を並べる構造。 section は `info` の**外側**、 `content` 直下の末尾に置く (= グリッド外、 縦並び末尾)。 housing.css のグリッド定義を見て `housing-detail-content` の grid-template-areas に `peers` を追加するか、 grid 外の block として扱う。 grid 構造を壊さないよう、 まず block で実装 → 実機で見た目確認 → 必要なら grid に追加する 2 段階。

- [ ] **Step 3: react-hot-toast の確認**

```bash
rtk grep -n "react-hot-toast" package.json
```

未導入なら `npm install react-hot-toast` で導入。 既導入なら既存の Toaster mount を確認 (= App.tsx 等で `<Toaster />` が居る前提)。

- [ ] **Step 4: tsc + build pass 確認**

Run: `rtk npm run build`
Expected: build success。

- [ ] **Step 5: 実機検証メモ**

実機で:
1. 重複登録 2 件作成 (= 同 addressKey、 自分が両方所有 or テスト用)
2. 片方の詳細モーダルを開く
3. 下部に「この住所の他の登録 (1)」 セクションが見える
4. mini カードに自分以外の listing が表示される
5. 「ちがった」 を 2 秒長押し → 進捗 ring fill → 完了 → トースト → 一覧から消える
6. 単独 listing の詳細モーダルでは section 非表示

- [ ] **Step 6: Commit**

```bash
rtk git add src/components/housing/listing/HousingDetailContent.tsx
rtk git commit -m "feat(housing): #60 §3.8 詳細モーダル下部に重複一覧セクション統合

peers prop + HousingDuplicatePeersSection + onReportPeer=reportListing(wrong_info)
+ toast。 Phase 1 の API 閾値 1 と組み合わせて 1 撃 hide が成立。"
```

---

## Phase 3: ツアー自動追加

### Task 3.1: `expandTourWithDuplicates` helper を TDD で実装

**Files:**
- Create: `src/lib/housing/expandTourWithDuplicates.ts`
- Test: `src/lib/housing/__tests__/expandTourWithDuplicates.test.ts`

- [ ] **Step 1: 失敗テストを書く**

Create `src/lib/housing/__tests__/expandTourWithDuplicates.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { expandTourWithDuplicates } from '../expandTourWithDuplicates';
import type { MockListing } from '../../../data/housing/mockListings';

const mk = (id: string, addressKey: string): MockListing =>
  ({ id, addressKey } as any);

describe('expandTourWithDuplicates', () => {
  it('追加 listing の addressKey と一致する他 listing を全部追加する', () => {
    const all = [mk('A', 'k1'), mk('A2', 'k1'), mk('A3', 'k1'), mk('B', 'k2')];
    const result = expandTourWithDuplicates([], 'A', all);
    expect(result.nextIds.sort()).toEqual(['A', 'A2', 'A3']);
    expect(result.autoAddedCount).toBe(2);
  });

  it('既にツアー内に同 addressKey の listing が居れば skip (冪等)', () => {
    const all = [mk('A', 'k1'), mk('A2', 'k1'), mk('A3', 'k1')];
    const result = expandTourWithDuplicates(['A2'], 'A', all);
    expect(result.nextIds.sort()).toEqual(['A', 'A2', 'A3']);
    expect(result.autoAddedCount).toBe(1); // A3 だけ自動追加
  });

  it('addressKey が unique なら自動追加は 0', () => {
    const all = [mk('A', 'k1'), mk('B', 'k2')];
    const result = expandTourWithDuplicates([], 'A', all);
    expect(result.nextIds).toEqual(['A']);
    expect(result.autoAddedCount).toBe(0);
  });

  it('addressKey が一致しても addressKey が空文字なら無視する', () => {
    const all = [mk('A', ''), mk('A2', '')];
    const result = expandTourWithDuplicates([], 'A', all);
    expect(result.nextIds).toEqual(['A']);
    expect(result.autoAddedCount).toBe(0);
  });

  it('newListingId が all に居なければ no-op (= 安全)', () => {
    const all = [mk('A', 'k1')];
    const result = expandTourWithDuplicates(['X'], 'unknown', all);
    expect(result.nextIds).toEqual(['X']);
    expect(result.autoAddedCount).toBe(0);
  });

  it('既に newListingId がツアー内ならその addressKey の他不在分のみ追加', () => {
    const all = [mk('A', 'k1'), mk('A2', 'k1'), mk('A3', 'k1')];
    const result = expandTourWithDuplicates(['A', 'A2'], 'A', all);
    expect(result.nextIds.sort()).toEqual(['A', 'A2', 'A3']);
    expect(result.autoAddedCount).toBe(1);
  });
});
```

- [ ] **Step 2: テスト実行 (失敗を確認)**

Run: `rtk vitest run src/lib/housing/__tests__/expandTourWithDuplicates.test.ts`
Expected: 6 件 fail。

- [ ] **Step 3: 最小実装**

Create `src/lib/housing/expandTourWithDuplicates.ts`:

```ts
/**
 * ツアー追加時に同 addressKey の不在 listing を冪等に追加する pure helper。
 *
 * - newListingId の addressKey と一致する他 listing で、 まだ tourListingIds に
 *   居ないものを「全部追加」 する
 * - addressKey が空 (= '') なら自動追加対象外
 * - newListingId が allListings に存在しない場合は no-op (= 安全)
 * - 戻り値 nextIds は newListingId + 自動追加分の和、 元の tourListingIds 順を維持
 *
 * 設計書 docs/superpowers/specs/2026-05-27-housing-duplicate-cleanup-design.md §2.3
 */
import type { MockListing } from '../../data/housing/mockListings';

export interface ExpandTourResult {
  nextIds: string[];
  autoAddedCount: number;
}

export function expandTourWithDuplicates(
  tourListingIds: string[],
  newListingId: string,
  allListings: MockListing[],
): ExpandTourResult {
  const target = allListings.find((l) => l.id === newListingId);
  if (!target || !target.addressKey) {
    if (tourListingIds.includes(newListingId)) {
      return { nextIds: tourListingIds, autoAddedCount: 0 };
    }
    if (!target) return { nextIds: tourListingIds, autoAddedCount: 0 };
    return { nextIds: [...tourListingIds, newListingId], autoAddedCount: 0 };
  }

  const existingSet = new Set(tourListingIds);
  const peers = allListings.filter(
    (l) => l.addressKey === target.addressKey && !existingSet.has(l.id),
  );

  const peerIds = peers.map((p) => p.id);
  const nextIds = [...tourListingIds, ...peerIds];
  // newListingId は peerIds に含まれる前提 (= 自分自身も peers の一員) なので
  // autoAddedCount は「自分以外」 = peers.length - 1
  const autoAddedCount = Math.max(0, peerIds.length - 1);
  return { nextIds, autoAddedCount };
}
```

- [ ] **Step 4: テスト実行 (全件 pass)**

Run: `rtk vitest run src/lib/housing/__tests__/expandTourWithDuplicates.test.ts`
Expected: 6 件 PASS。

- [ ] **Step 5: Commit**

```bash
rtk git add src/lib/housing/expandTourWithDuplicates.ts src/lib/housing/__tests__/expandTourWithDuplicates.test.ts
rtk git commit -m "feat(housing): #60 §3.8 expandTourWithDuplicates helper

ツアー追加時に同 addressKey の不在 listing を冪等に全追加する pure 関数。
FavoritesModal drop 経路に統合予定 (次タスク)。"
```

---

### Task 3.2: `FavoritesModal.handleDragEnd` で helper を統合 + トースト

**Files:**
- Modify: `src/components/housing/workspace/FavoritesModal.tsx` (= L159-162 付近の drop 処理)

- [ ] **Step 1: 修正対象を確認**

[FavoritesModal.tsx:155-165](../../src/components/housing/workspace/FavoritesModal.tsx#L155-L165) の drop 処理 (現状: 単純 dedup):

```tsx
const idsToAdd = selected.has(dragged) ? Array.from(selected) : [dragged];
const merged = Array.from(new Set([...tourIds, ...idsToAdd]));
if (merged.length === tourIds.length) return;
setTourIds(merged);
```

- [ ] **Step 2: helper を統合**

修正版:

```tsx
import { expandTourWithDuplicates } from '../../../lib/housing/expandTourWithDuplicates';
import toast from 'react-hot-toast';

// drop 内 (idsToAdd 取得直後):
let nextIds = tourIds;
let totalAutoAdded = 0;
for (const addId of idsToAdd) {
  const r = expandTourWithDuplicates(nextIds, addId, listings);
  if (r.nextIds.length === nextIds.length) continue;
  nextIds = r.nextIds;
  totalAutoAdded += r.autoAddedCount;
}
if (nextIds.length === tourIds.length) return; // nothing new
setTourIds(nextIds);
if (totalAutoAdded > 0) {
  toast(t('housing.tour.auto_added_toast', { count: totalAutoAdded }));
}
setSelected(new Set());
```

`listings` は既存 import (= `useHousingListingsStore` から取得済) を流用、 `t` は `useTranslation` を import 済 ([FavoritesModal.tsx:67](../../src/components/housing/workspace/FavoritesModal.tsx#L67))。

- [ ] **Step 3: tsc + build pass 確認**

Run: `rtk npm run build`
Expected: build success.

- [ ] **Step 4: vitest 実行 (既存 FavoritesModal.test 確認)**

Run: `rtk vitest run src/__tests__/housing/FavoritesModal.test.tsx`
Expected: 既存テストが pass のまま (= drag drop 経路の挙動を破壊していない)。 重複登録を mock しているテストがあれば自動追加の挙動を追加 assert する。

- [ ] **Step 5: 実機検証メモ**

実機で:
1. 同 addressKey で 3 件登録 (= A / A2 / A3)
2. お気に入りに 3 件追加
3. お気に入りモーダル開いてツアービルダーに A だけドロップ
4. A2 / A3 も同時に追加される (motion 入場)
5. トースト「同住所の他 2 件もツアーに追加しました」 表示
6. 続けて別 addressKey の B をドロップ → 自動追加なし (= トースト出ない)
7. 個別 × で A2 を消す → A / A3 が残る (= 連動削除なし)

- [ ] **Step 6: Commit**

```bash
rtk git add src/components/housing/workspace/FavoritesModal.tsx
rtk git commit -m "feat(housing): #60 §3.8 ツアー drop で同住所自動追加 + トースト

handleDragEnd で expandTourWithDuplicates を idsToAdd ごとに適用、
合計自動追加件数を 1 トーストで通知。 個別 × / reorder は変更なし。"
```

---

## Phase 4: 統合検証 + 引継ぎ

### Task 4.1: 全テスト + build pass 確認

- [ ] **Step 1: 全テスト**

Run: `rtk vitest run`
Expected: 全 pass。

- [ ] **Step 2: build**

Run: `rtk npm run build`
Expected: build success。

- [ ] **Step 3: tsc 厳密モード**

memory `feedback_vercel_tsc_strict` に従い vercel build と同等の `tsc -b` も流す:

Run: `rtk npx tsc -b`
Expected: 未使用変数 / 型不足 0。

- [ ] **Step 4: 実機検証 (= 設計書 §7 の 3 段階を順に通す)**

1. **Phase 1 単独** (= API 閾値 1 + hook): 既存通報ボタンに HousingLongPressButton を仮設置して長押し動作 + 重複時 1 撃 hide を確認 (= Task 2 以降で正式 UI 統合)
2. **Phase 2** (= 詳細モーダル下部 section): 重複登録あり/なしで描画切替、 長押し → 1 撃 hide → モーダル一覧から消える
3. **Phase 3** (= ツアー自動追加): 重複登録の片方をドロップ → 全部追加 + トースト

memory `feedback_one_fix_one_verify` 厳守: 各 Phase 完了で必ず 1 シナリオ通してから次へ。

- [ ] **Step 5: TODO.md / `docs/.private/2026-05-27-housing-video-3frame-and-phase2.md` 更新**

完了タスクを TODO_COMPLETED.md に移動、 TODO.md の「次セッション最優先」 を Phase 2-6 (= §3.7 バッジ + カード版「ちがった」) に書き換え。

memory `feedback_clean_environment` 厳守: 終了時に `(Get-Content docs\TODO.md | Measure-Object -Line).Lines` で 100 行以内確認。

- [ ] **Step 6: deploy (= memory feedback_deploy)**

push → Vercel 自動デプロイ (= memory `reference_vercel_git_autodeploy`)。

```bash
rtk git push
```

- [ ] **Step 7: 引継ぎメモ出力**

ユーザーに次セッション最初にコピペできる形式で:
- 変更ファイル一覧
- 次の最優先タスク (= Phase 2-6 §3.7 バッジ + カード版「ちがった」)
- 「docs/TODO.md 読め」 指示

---

## 補足: 既存資産活用と注意点

- `findListingsByAddressKey` は既に [HousingDetailModalRoute.tsx:102](../../src/components/housing/listing/HousingDetailModalRoute.tsx#L102) で fetch されているため、 Phase 2 で**追加 fetch は不要**。 既存 fetch 結果を state に保持して下流に渡すだけ。
- `useHousingTourStore` の data model 拡張は**なし** (= flat `string[]` 維持)。 「自動追加」 メタは付けない方針 (設計書 §2.3 通り)。
- 「ちがった」 reason は既存の `ReportReason` 型に `wrong_info` として登録済 ([HousingDetailContent.tsx:93](../../src/components/housing/listing/HousingDetailContent.tsx#L93)) を確認したので新規追加は不要。 型に無ければ `src/types/housing.ts` の `isValidReportReason` を確認する。
- toast ライブラリは既存依存があれば流用、 無ければ `react-hot-toast` を新規導入 (= 軽量 / 既に使用例があるか確認)。
- mobile での長押し挙動 (= テキスト選択メニュー抑止) は実機 (Android Chrome / iOS Safari) で必ず確認。 happy-dom では検出不可。
- Phase 2-6 (= §3.7 カードバッジ + カード版「ちがった」) は本計画スコープ外。 ただし `HousingLongPressButton` は再利用前提で設計済。

## ロールバック方針

各 Phase が独立 commit なので、 問題発生時は該当 Phase の commit を revert すれば前 Phase の動作に戻る。 Phase 1 の API 閾値 1 だけ revert したい場合は `_reportListingHandler.ts` の該当ブロックを `threshold = REPORT_AUTO_HIDE_THRESHOLD` 単行に戻す。
