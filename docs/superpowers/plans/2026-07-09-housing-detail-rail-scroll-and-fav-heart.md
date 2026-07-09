# ハウジング詳細レール「テキスト・スクロール収納（フェード）＋見出し=住所＋お気に入りハート統一」実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 詳細ページ右レールを、タイトル(=住所)＋紹介文などのテキストが長くても固定高さを超えないよう「1つのスクロール領域（バー無し・端フェード）」に収め、操作ボタンと区画マップを常時表示にする。併せて見出しを住所に固定（紹介文は任意の本文）、お気に入りハートを「探す」ページと同じアニメ（pop＋粒子＋ハニーゴールド）に統一する。

**Architecture:** (1) スクロールフェードの共通フック `useScrollFade` を新設し、ギャラリーの縦サムネ列（既存）と詳細テキスト領域（新規）の両方で使う（DRY）。(2) `HousingDetailContent` を「見出し=住所／dc・ワールドはサブ行／タグ／紹介文（任意本文）＝1スクロール領域(フェード)」＋「操作・地図は固定」に再構成。(3) `HousingActionBar` の素のハートを、探すページの再利用コンポーネント `HousingFavHeart`（pop＋8方向粒子＋honey）へ差し替え（positioning だけ行内用に上書き）。

**Tech Stack:** React 18 + TypeScript + vitest + @testing-library/react（happy-dom）+ i18next。ハウジング独自トンマナ（`--housing-*` トークン）。lucide-react（Heart アイコン、既存依存）。

## Global Constraints

- **固定高さを超えない**: 右レールはビューポート内固定高さ（md+）。タイトル・紹介文が長くても、**テキスト領域が内部スクロール**して収める。**操作ボタンと区画マップは常に見える**（見切れゼロ）。
- **スクロール表現（業界標準）**: スクロールバーは出さない（`scrollbar-width:none`＋`::-webkit-scrollbar{display:none}`）。スクロール可能な端に**強めのフェード**、その端までスクロールしきったら**フェードがスムーズに消える**（`opacity` transition・`data-at-top`/`data-at-bottom` 属性で制御）。
- **見出し=住所（自動・任意タイトル不要）**: h2 見出しは `formatHousingAddress` の住所。紹介文（`description`）は**任意**で、本文としてスクロール領域に表示（紹介文が無い物件は本文を出さない）。**紹介文を見出しに使う旧ロジックは撤去**（重複表示も解消）。
- **お気に入りハート統一**: 詳細の ActionBar は探すページと同じ `HousingFavHeart`（pop 1.35倍バウンド＋8方向パーティクル＋`--housing-honey`）を使う。挙動（`useHousingFavoritesStore` 永続）は不変。
- **トンマナ**: 色/影/角丸は `--housing-*` トークン経由（追加行に hex/rgba リテラル禁止。構造的 px は可）。フェード色は `--housing-panel-bg-solid`。
- **モバイル（≤768px）**: 右レールの内部スクロールは md+ のみ。base（モバイル）はパネル全体が自然縦スクロール（従来どおり）。
- **push 前ゲート**: `npm run build` ＋ `npx vitest run`。**vitest 安全実行**: `npx vitest run <path>`・出力パイプ禁止・`vmThreads` 不可触。
- **コミット末尾（verbatim）**: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`。作業ディレクトリ `c:\Users\masay\Desktop\FF14Sim`。

---

## File Structure

- **Create**: `src/lib/housing/useScrollFade.ts` — スクロール端検知フック（`{ ref, atStart, atEnd, onScroll }`）。ResizeObserver で内容変化にも追随。
- **Create（テスト）**: `src/lib/housing/__tests__/useScrollFade.test.tsx` — 初期返り値の形と既定状態。
- **Modify**: `src/components/housing/listing/HousingPhotoGallery.tsx` — 縦サムネ列のスクロールフェードをインライン実装から `useScrollFade` へ置換（DOM・挙動は不変）。
- **Modify**: `src/components/housing/listing/HousingDetailContent.tsx` — 見出し=住所化＋テキスト（見出し/サブ行/タグ/紹介文/peers）を1スクロール領域(`.housing-detail-textscroll-wrap` > `.housing-detail-textscroll`)へ収め、`useScrollFade` でフェード。操作・地図は固定。
- **Modify**: `src/components/housing/listing/HousingActionBar.tsx` — 素のハート＋favorite ロジックを撤去し `HousingFavHeart` を使用。
- **Modify（テスト）**: `src/components/housing/listing/__tests__/HousingActionBar.test.tsx` — お気に入りボタンの aria-label を `housing.card.favorite` に更新。
- **Modify**: `src/styles/housing.css` — テキストスクロール領域＋フェードの CSS 追加、`.housing-detail-side`/`-info`/`-scroll` の base/md+ 調整、`.housing-action-bar .housing-card-fav` の行内 positioning 上書き。
- **利用（変更なし）**: `src/components/housing/browse/HousingFavHeart.tsx`（props `{ listingId: string }`、内部で `useHousingFavoritesStore`）。

---

### Task 1: スクロールフェード共通フック `useScrollFade` ＋ ギャラリーを移行

**Files:**
- Create: `src/lib/housing/useScrollFade.ts`
- Create（テスト）: `src/lib/housing/__tests__/useScrollFade.test.tsx`
- Modify: `src/components/housing/listing/HousingPhotoGallery.tsx`

**Interfaces:**
- Produces: `useScrollFade<T extends HTMLElement>(): { ref: React.RefObject<T>, atStart: boolean, atEnd: boolean, onScroll: () => void }`。`atStart`=先頭（`scrollTop<=1`）、`atEnd`=末尾（`scrollTop+clientHeight>=scrollHeight-1`）。マウント時＋ResizeObserver で自動更新、スクロール時は `onScroll` を要素の `onScroll` に渡す。
- Consumes（Gallery 側）: `HousingPhotoGallery` の縦サムネ列 `ul.housing-detail-thumbrail`（ref＋onScroll）と `.housing-detail-thumbrail-wrap`（`data-at-top`/`data-at-bottom`）。

- [ ] **Step 1: フック本体を作成**

`src/lib/housing/useScrollFade.ts` を新規作成し、以下を**そのまま**書く:

```ts
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 縦スクロール要素の「端フェード」制御フック。
 * - atStart: 先頭に居る (上フェード不要) / atEnd: 末尾に居る (下フェード不要)
 * - マウント時 + ResizeObserver (内容/寸法変化) で自動再計算。 スクロール時は onScroll を要素へ。
 * スクロールバーを出さずに「まだ続きがある」ことをフェードで示す業界標準パターンに使う。
 */
export function useScrollFade<T extends HTMLElement = HTMLElement>(): {
  ref: React.RefObject<T>;
  atStart: boolean;
  atEnd: boolean;
  onScroll: () => void;
} {
  const ref = useRef<T>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  const onScroll = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setAtStart(el.scrollTop <= 1);
    setAtEnd(el.scrollTop + el.clientHeight >= el.scrollHeight - 1);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    onScroll();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => onScroll());
    ro.observe(el);
    return () => ro.disconnect();
  }, [onScroll]);

  return { ref, atStart, atEnd, onScroll };
}
```

- [ ] **Step 2: フックの最小テストを書いて実行**

`src/lib/housing/__tests__/useScrollFade.test.tsx` を新規作成し、以下を**そのまま**書く:

```tsx
// @vitest-environment happy-dom
import { renderHook } from '@testing-library/react';
import { useScrollFade } from '../useScrollFade';

it('初期状態: atStart/atEnd は true、 ref と onScroll を返す', () => {
  const { result } = renderHook(() => useScrollFade<HTMLDivElement>());
  expect(result.current.atStart).toBe(true);
  expect(result.current.atEnd).toBe(true);
  expect(result.current.ref).toBeDefined();
  expect(typeof result.current.onScroll).toBe('function');
});
```

Run: `npx vitest run src/lib/housing/__tests__/useScrollFade.test.tsx`
Expected: PASS（1件緑）。

- [ ] **Step 3: `HousingPhotoGallery` をフックへ移行**

`src/components/housing/listing/HousingPhotoGallery.tsx` を編集する。

**3a. import 行**を編集。現在の:

```tsx
import { useState, useMemo, useCallback, useEffect, useRef, type SyntheticEvent } from 'react';
```

を以下に（`useEffect`/`useRef` はフックへ移るので落とす。まだ他で使っていれば残す — 本ファイルでは gallery のフェード以外に使っていないので落とす）:

```tsx
import { useState, useMemo, useCallback, type SyntheticEvent } from 'react';
```

その下に import を1行追加（他の import 群の並びに合わせて末尾でよい）:

```tsx
import { useScrollFade } from '../../../lib/housing/useScrollFade';
```

**3b. インラインのフェード state を置換**。現在の以下のブロック:

```tsx
  // 縦サムネ列のスクロールフェード: 端に達したらその端のフェードを消す。
  const railRef = useRef<HTMLUListElement>(null);
  const [atTop, setAtTop] = useState(true);
  const [atBottom, setAtBottom] = useState(true);
  const updateFade = useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    setAtTop(el.scrollTop <= 1);
    setAtBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - 1);
  }, []);
  // マウント時・項目数変化時に初期フェード状態を確定（溢れていれば下フェードON）。
  useEffect(() => {
    updateFade();
  }, [mediaItems, updateFade]);
```

を以下に置換:

```tsx
  // 縦サムネ列のスクロールフェード（共通フック）。 端に達したらその端のフェードを消す。
  const { ref: railRef, atStart: atTop, atEnd: atBottom, onScroll: updateFade } =
    useScrollFade<HTMLUListElement>();
```

**3c. JSX 側は変更不要**（`ref={railRef}`・`onScroll={updateFade}`・`data-at-top={atTop}`・`data-at-bottom={atBottom}` の名前が一致するため）。念のため `.housing-detail-thumbrail-wrap` に `data-at-top={atTop} data-at-bottom={atBottom}`、`ul` に `ref={railRef} onScroll={updateFade}` が残っていることを確認する。

- [ ] **Step 4: build + gallery/hook テスト**

Run: `npm run build`
Expected: 成功（未使用 import 無し。`useRef`/`useEffect` を落として問題ないこと）。
Run: `npx vitest run src/lib/housing/__tests__/useScrollFade.test.tsx src/components/housing/listing/__tests__/HousingPhotoGallery.test.tsx`
Expected: PASS（フック1件＋ギャラリー3件緑。ギャラリー挙動は不変）。

- [ ] **Step 5: Commit**

```bash
git add src/lib/housing/useScrollFade.ts src/lib/housing/__tests__/useScrollFade.test.tsx src/components/housing/listing/HousingPhotoGallery.tsx
git commit -m "refactor(housing): スクロールフェードを useScrollFade フックへ共通化(ギャラリー移行)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: 詳細右レールを「見出し=住所＋テキスト・スクロール収納（フェード）＋地図固定」に再構成

**Files:**
- Modify: `src/components/housing/listing/HousingDetailContent.tsx`
- Modify: `src/styles/housing.css`

**Interfaces:**
- Consumes: `useScrollFade`（Task 1）、`formatHousingAddress`（既存 import 済み）。
- Produces: 右レール DOM `.housing-detail-side` > `.housing-detail-textscroll-wrap[data-at-top][data-at-bottom]` > `.housing-detail-textscroll`（見出し/サブ行/タグ/紹介文/peers）／`.housing-detail-actions`（固定）／`HousingDetailMap`（固定）。

- [ ] **Step 1: `HousingDetailContent.tsx` の import に `useScrollFade` を追加**

現在の import 群に1行追加（`HousingDuplicatePeersSection` の import の下あたり）:

```tsx
import { useScrollFade } from '../../../lib/housing/useScrollFade';
```

- [ ] **Step 2: 見出しロジックを住所固定に変更**

`HousingDetailContent.tsx` の以下の行:

```tsx
  const title = listing.description?.trim() ? listing.description : fullAddress;
```

を以下に置換（見出しは常に住所。紹介文は本文へ）:

```tsx
  // 見出しは住所に固定 (FF14 の家は識別子が住所。 任意タイトル欄は設けない)。
  // 紹介文 (description) は任意の本文としてスクロール領域に表示する。
  const title = fullAddress;
```

- [ ] **Step 3: フックを呼び、return の右レール部分を再構成**

`HousingDetailContent` 関数本体の、`handleReportPeer` 定義の**直後**（`return (` の直前）に1行追加:

```tsx
  const textScroll = useScrollFade<HTMLDivElement>();
```

次に、return 内の**右レール `.housing-detail-side` ブロック全体**を差し替える。現在の:

```tsx
        <div className="housing-detail-side">
          <div className="housing-detail-info">
            <h2 className="housing-detail-title">{title}</h2>
            <p className="housing-detail-address">
              {listing.dc} / {listing.server} / {fullAddress}
            </p>
            {listing.tags.length > 0 && (
              <ul className="housing-detail-tags">
                {listing.tags.map((tag) => (
                  <li key={tag}>{tag}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="housing-detail-scroll">
            {listing.description && (
              <p className="housing-detail-description">{listing.description}</p>
            )}
            <HousingDuplicatePeersSection peers={visiblePeers} onReportPeer={handleReportPeer} />
          </div>

          <div className="housing-detail-actions">
            <HousingActionBar
              listing={listing}
              viewerUid={viewerUid}
              hasDuplicates={hasDuplicates}
              onClose={onClose}
              onListingUpdated={onListingUpdated}
              onDeleted={onDeleted}
            />
          </div>

          {/* mapRef が引けない物件では null → レールは操作バーで自然に終わる */}
          <HousingDetailMap listing={listing} />
        </div>
```

を以下に置換（見出し/サブ行/タグ/紹介文/peers を1スクロール領域へ。操作・地図は固定）:

```tsx
        <div className="housing-detail-side">
          {/* テキスト一式 = 唯一のスクロール域。 長くても固定高さを超えず、 端フェードで示す。 */}
          <div
            className="housing-detail-textscroll-wrap"
            data-at-top={textScroll.atStart}
            data-at-bottom={textScroll.atEnd}
          >
            <div
              className="housing-detail-textscroll"
              ref={textScroll.ref}
              onScroll={textScroll.onScroll}
            >
              <div className="housing-detail-info">
                <h2 className="housing-detail-title">{title}</h2>
                <p className="housing-detail-address">
                  {listing.dc} / {listing.server}
                </p>
                {listing.tags.length > 0 && (
                  <ul className="housing-detail-tags">
                    {listing.tags.map((tag) => (
                      <li key={tag}>{tag}</li>
                    ))}
                  </ul>
                )}
              </div>
              {listing.description && (
                <p className="housing-detail-description">{listing.description}</p>
              )}
              <HousingDuplicatePeersSection peers={visiblePeers} onReportPeer={handleReportPeer} />
            </div>
          </div>

          <div className="housing-detail-actions">
            <HousingActionBar
              listing={listing}
              viewerUid={viewerUid}
              hasDuplicates={hasDuplicates}
              onClose={onClose}
              onListingUpdated={onListingUpdated}
              onDeleted={onDeleted}
            />
          </div>

          {/* mapRef が引けない物件では null → レールは操作バーで自然に終わる */}
          <HousingDetailMap listing={listing} />
        </div>
```

- [ ] **Step 4: CSS を追加/調整（`src/styles/housing.css`）**

**4a.** 現在の base ルール群（`.housing-detail-side` / `.housing-detail-info` / `.housing-detail-scroll`）:

```css
.housing-detail-side {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
}
.housing-detail-info {
    display: flex;
    flex-direction: column;
    gap: 8px;
    color: var(--housing-text);
}
.housing-detail-scroll {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
}
```

を以下へ置換（`.housing-detail-scroll` を廃し、新しいテキストスクロール枠＋中身＋フェードを定義）:

```css
.housing-detail-side {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
}
.housing-detail-info {
    display: flex;
    flex-direction: column;
    gap: 8px;
    color: var(--housing-text);
}
/* テキスト一式のスクロール枠。 wrap=非スクロールのフェード枠 / 中の textscroll がスクロール。 */
.housing-detail-textscroll-wrap {
    position: relative;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
}
.housing-detail-textscroll {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
    color: var(--housing-text);
    scrollbar-width: none;            /* Firefox: スクロールバー非表示 */
}
.housing-detail-textscroll::-webkit-scrollbar {
    display: none;                    /* WebKit: スクロールバー非表示 */
}
/* スクロールフェード (強め・端で smooth に外れる)。 wrap は非スクロールなので端に留まる。 */
.housing-detail-textscroll-wrap::before,
.housing-detail-textscroll-wrap::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    height: 32px;
    pointer-events: none;
    z-index: 2;
    opacity: 1;
    transition: opacity 0.22s ease;
}
.housing-detail-textscroll-wrap::before {
    top: 0;
    background: linear-gradient(to bottom, var(--housing-panel-bg-solid), transparent);
}
.housing-detail-textscroll-wrap::after {
    bottom: 0;
    background: linear-gradient(to top, var(--housing-panel-bg-solid), transparent);
}
.housing-detail-textscroll-wrap[data-at-top="true"]::before {
    opacity: 0;
}
.housing-detail-textscroll-wrap[data-at-bottom="true"]::after {
    opacity: 0;
}
```

**4b.** md+ ブロック内の現在の `.housing-detail-info` / `.housing-detail-scroll`:

```css
    .housing-detail-info {
        flex: 0 0 auto;
    }
    .housing-detail-scroll {
        flex: 1 1 auto;
        min-height: 0;
        overflow-y: auto;
    }
```

を以下へ置換（テキスト枠が唯一伸びる＋内部スクロール。`.housing-detail-info` の pin は廃止＝見出しもスクロール域内に入ったため）:

```css
    .housing-detail-textscroll-wrap {
        flex: 1 1 auto;
        min-height: 0;
    }
    .housing-detail-textscroll {
        height: 100%;
        overflow-y: auto;
    }
```

> 注: base（モバイル）では `.housing-detail-textscroll` に固定高さを与えないため内部スクロールは発生せず、パネル全体が自然に縦スクロールする（従来どおり）。md+ でのみ枠が `flex:1` で高さを持ち、中身が溢れたら内部スクロール＋フェード。

- [ ] **Step 5: build + test（＋ハードコード自己チェック）**

Run: `npm run build`
Expected: 成功（型・CSS とも）。
Run: `npx vitest run src/components/housing/listing/__tests__/HousingDetailContent.test.tsx`
Expected: PASS。既存テストは `getAllByText(/隠れ家カフェ/).length>=1`（本文1箇所でも可）・住所 `5-12`/`ミスト・ヴィレッジ`（見出しに出る）で緑のまま。もし赤があれば、見出しが住所になった差分に合わせて**アサーションの意味を壊さない範囲**で更新（例: 45行の「タイトルと本文の2箇所」コメントは本文1箇所に）。
Run: `git diff -- src/styles/housing.css | rg "^\+" | rg "#[0-9a-fA-F]{3,8}|rgba?\("`
Expected: **ヒット0**（`transparent` キーワードは OK）。

- [ ] **Step 6: Commit**

```bash
git add src/components/housing/listing/HousingDetailContent.tsx src/styles/housing.css
git commit -m "feat(housing): 詳細右レールをテキスト・スクロール収納(フェード)+見出し=住所に(地図常時表示)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: お気に入りハートを「探す」ページと統一（`HousingFavHeart` 移植）

**Files:**
- Modify: `src/components/housing/listing/HousingActionBar.tsx`
- Modify: `src/components/housing/listing/__tests__/HousingActionBar.test.tsx`
- Modify: `src/styles/housing.css`

**Interfaces:**
- Consumes: `HousingFavHeart`（`src/components/housing/browse/HousingFavHeart.tsx`、props `{ listingId: string }`、内部で `useHousingFavoritesStore`）。
- Produces: ActionBar 行の先頭に探すページ同一のハート（pop＋粒子＋honey）。DOM: `button.housing-card-fav`（aria-label `housing.card.favorite`）。

- [ ] **Step 1: `HousingActionBar.tsx` の素のハート＋favorite ロジックを撤去し `HousingFavHeart` を使う**

**1a. import を追加**（`HousingShareButton` の import の下あたり）:

```tsx
import { HousingFavHeart } from '../browse/HousingFavHeart';
```

**1b. favorite 用の store フックと state を削除**。以下の3行:

```tsx
  const favIds = useHousingFavoritesStore((s) => s.ids);
  const addFav = useHousingFavoritesStore((s) => s.add);
  const removeFav = useHousingFavoritesStore((s) => s.remove);
  const isFav = favIds.includes(listing.id);
```

を削除する。さらに `onToggleFavorite` ハンドラ:

```tsx
  const onToggleFavorite = () => {
    if (isFav) removeFav(listing.id);
    else addFav(listing.id);
  };
```

も削除する。

**1c. `useHousingFavoritesStore` の import が未使用になれば削除**する。ファイル冒頭の:

```tsx
import { useHousingFavoritesStore } from '../../../store/useHousingFavoritesStore';
```

を削除（他で使っていないことを確認。ActionBar では favorite 以外に使っていない）。

**1d. 素のハートボタンを差し替え**。現在の:

```tsx
      <button
        type="button"
        className="housing-action-btn"
        aria-pressed={isFav}
        aria-label={
          isFav ? t('housing.detail.favorited_aria') : t('housing.detail.favorite_aria')
        }
        onClick={onToggleFavorite}
      >
        {isFav ? '♥' : '♡'}
      </button>
```

を以下に置換:

```tsx
      <HousingFavHeart listingId={listing.id} />
```

- [ ] **Step 2: 行内 positioning の CSS 上書きを追加（`src/styles/housing.css`）**

`.housing-card-fav` は探すカード用に `position:absolute; top:8px; right:8px`（角固定）。ActionBar 行では通常フローに戻す。`.housing-action-bar` 関連 CSS の近く（`.housing-action-bar .housing-action-btn` ルールの直後あたり）に追加:

```css
/* 探すページの HousingFavHeart を詳細の操作バー内で使う: カード角固定(absolute)を行内へ戻す。 */
.housing-action-bar .housing-card-fav {
    position: relative;
    top: auto;
    right: auto;
}
```

- [ ] **Step 3: ActionBar テストの aria-label を更新**

`src/components/housing/listing/__tests__/HousingActionBar.test.tsx` の以下:

```tsx
    expect(
      screen.getByRole('button', { name: 'housing.detail.favorite_aria' }),
    ).toBeInTheDocument();
```

を以下に置換（`HousingFavHeart` の aria-label キーは `housing.card.favorite`）:

```tsx
    expect(
      screen.getByRole('button', { name: 'housing.card.favorite' }),
    ).toBeInTheDocument();
```

- [ ] **Step 4: build + test**

Run: `npm run build`
Expected: 成功（未使用 import 無し）。
Run: `npx vitest run src/components/housing/listing/__tests__/HousingActionBar.test.tsx`
Expected: PASS（お気に入りボタンが `housing.card.favorite` で見つかる。他のボタンテストも緑）。

- [ ] **Step 5: 実機確認（ユーザー・HMR）**

`http://localhost:5173/housing` をハードリロード → 物件詳細で目視（[[feedback_no_screenshots_local_verify]]）:
- 見出し=住所（紹介文が長くても見出しは短い）。紹介文が長い物件で、**タイトル〜紹介文の領域だけが内部スクロール**し、端に強めのフェード＋端でスムーズに外れる。**操作ボタンと区画マップは常に見える（見切れゼロ）**。
- ハートを押すと**探すページと同じ**アニメ（はじけるポップ＋粒子＋ハニーゴールド）。
- パネル全体は無スクロール（md+）。

- [ ] **Step 6: Commit**

```bash
git add src/components/housing/listing/HousingActionBar.tsx src/components/housing/listing/__tests__/HousingActionBar.test.tsx src/styles/housing.css
git commit -m "feat(housing): 詳細のお気に入りを探すページと統一(HousingFavHeart pop+粒子+honey)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## 最終チェック

- [ ] `npm run build` 全緑 / `npx vitest run` 全緑。
- [ ] `git diff -- src/styles/housing.css | rg "^\+" | rg "#[0-9a-fA-F]{3,8}|rgba?\("` がヒット0。
- [ ] `rg -n "housing-detail-scroll\b" src` が**ヒット0**（旧クラスの消し残し確認。新クラスは `-textscroll`）。
- [ ] 実機（ユーザー）: 長い紹介文でも地図が見切れない／テキスト領域が内部スクロール＋フェード／ハートが探すと同一アニメ。

## 実装メモ（安価モデル向け）

- Task 1（フック＋ギャラリー移行）→ Task 2（詳細レール）→ Task 3（ハート）の**逐次**。各タスクで build + vitest ゲート。共有ファイルは `HousingPhotoGallery.tsx`（Task1）/ `HousingDetailContent.tsx`+`housing.css`（Task2）/ `HousingActionBar.tsx`+`housing.css`（Task3）。housing.css は Task2 と Task3 で別箇所を触るので逐次なら競合しない。
- 迷ったら: 見出しは必ず住所（`fullAddress`）／テキストは1スクロール領域に集約／操作・地図は固定（見切れゼロ）／ハートは `HousingFavHeart` をそのまま。
