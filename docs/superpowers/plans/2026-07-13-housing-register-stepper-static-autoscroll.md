# 登録ステッパー静的化 + 進行連動オートスクロール + コピー改善 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 登録ステッパーの説明文開閉をやめて全ステップ常時表示にし、進捗 (progress 0..1) に連動してビューポート内を自動スクロール+端フェードさせる。あわせて画像/SNS セクションの見出し・URL 欄コピーを意味の通る文言へ改善する (4 言語)。

**Architecture:** スクロール量計算はテスト可能な純関数 `computeStepperScroll` に隔離。`RegisterStepperNav` は既存 `progress` prop と ResizeObserver 測定 (body 高さ=contentH / viewport 高さ=viewportH) から `translateY` を算出し、body (SVG リング+リスト) を一体で動かす。説明文は CSS で常時表示に。コピーは i18n キーの値変更 + 新規 `snsUrl.help` 追加。

**Tech Stack:** React + TypeScript / CSS (mask-image / transform) / vitest + @testing-library/react (happy-dom) / i18next (ja/en/ko/zh)

**設計書(正典):** `docs/superpowers/specs/2026-07-13-housing-register-stepper-static-autoscroll-design.md`

## Global Constraints

- **トークン経由**: 色・寸法は `--housing-*` トークン。ハードコード禁止 (housing-design.md)。フェード距離等の 1 箇所限定・テーマ非依存の px は許容 (例外)。
- **i18n**: 文字列は必ずキー経由。**ja/en/ko/zh の 4 言語 parity 必須**。ロケール JSON は該当ブロックだけ textual 編集 (全体 parse→stringify 禁止・`feedback_locale_json_textual_edit`)。
- **AI 感払拭**: 補足文は色付き箱にせず、グレー小文字の静かな注記 (`feedback_housing_no_ai_pills`)。
- **コピーの誤解防止**: 「動画付きの投稿も OK」は動画 URL 対応の意。**「アップロード」「埋め込める」は書かない** (直接アップロード不可)。サービス列挙は末尾「など」で排他に見せない。
- **既存回帰ゼロ**: リング dashoffset (progress 連動) / done→✓ / active→青枠 / `onJump(id)` / `aria-current` / SVG `aria-hidden` を壊さない。
- **vitest は単一ファイル指定で実行・出力をパイプしない** (`reference_vitest_vmthreads_hang`)。コマンドは `rtk` 前置。
- **build 前提**: Vercel は `tsc -b` 厳密 (`noUnusedLocals`)。未使用 import/var/const は禁止。
- **コミットメッセージ**: 本文末尾に空行 + `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`。

---

## Task 1: スクロール量の純関数 `computeStepperScroll`

**Files:**
- Create: `src/lib/housing/stepperScroll.ts`
- Test: `src/lib/housing/__tests__/stepperScroll.test.ts`

**Interfaces:**
- Produces: `computeStepperScroll(progress: number, contentH: number, viewportH: number): number`
  — 進捗 `progress` (0..1) と中身の高さ `contentH` / ビューポート高さ `viewportH` から、body を上へ送る量 (px, ≥0) を返す。`overflow = max(0, contentH - viewportH)`、`scrollY = clamp(progress,0,1) * overflow`。

- [ ] **Step 1: 失敗テストを書く**

```ts
// src/lib/housing/__tests__/stepperScroll.test.ts
import { describe, it, expect } from 'vitest';
import { computeStepperScroll } from '../stepperScroll';

describe('computeStepperScroll', () => {
  it('progress=0 は 0', () => {
    expect(computeStepperScroll(0, 300, 150)).toBe(0);
  });
  it('progress=1 は overflow 全量 (contentH-viewportH)', () => {
    expect(computeStepperScroll(1, 300, 150)).toBe(150);
  });
  it('中間は overflow に比例', () => {
    expect(computeStepperScroll(0.5, 300, 150)).toBe(75);
  });
  it('収まる (contentH<=viewportH) は 0', () => {
    expect(computeStepperScroll(0.5, 100, 150)).toBe(0);
    expect(computeStepperScroll(1, 150, 150)).toBe(0);
  });
  it('progress は 0..1 にクランプ', () => {
    expect(computeStepperScroll(-1, 300, 150)).toBe(0);
    expect(computeStepperScroll(2, 300, 150)).toBe(150);
  });
  it('負値・NaN は安全に 0 として扱う', () => {
    expect(computeStepperScroll(NaN, 300, 150)).toBe(0);
    expect(computeStepperScroll(0.5, NaN, 150)).toBe(0);
    expect(computeStepperScroll(0.5, 300, NaN)).toBe(0);
    expect(computeStepperScroll(0.5, -10, -20)).toBe(0);
  });
});
```

- [ ] **Step 2: テストが失敗するのを確認**

Run: `rtk vitest run src/lib/housing/__tests__/stepperScroll.test.ts`
Expected: FAIL (`computeStepperScroll` is not a function / モジュール未存在)

- [ ] **Step 3: 最小実装**

```ts
// src/lib/housing/stepperScroll.ts
/**
 * ステッパーの進行連動オートスクロール量 (純関数)。
 * 中身の高さ contentH がビューポート viewportH を超える分だけを overflow とし、
 * 進捗 progress (0..1) に比例して body を上へ送る量 (px, ≥0) を返す。
 * 収まる場合・非有限値・負値はゼロ (動かさない) に丸める。
 */
export function computeStepperScroll(progress: number, contentH: number, viewportH: number): number {
  const c = Number.isFinite(contentH) ? contentH : 0;
  const v = Number.isFinite(viewportH) ? viewportH : 0;
  const overflow = Math.max(0, c - v);
  if (overflow <= 0) return 0;
  const p = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
  return p * overflow;
}
```

- [ ] **Step 4: テストが通るのを確認**

Run: `rtk vitest run src/lib/housing/__tests__/stepperScroll.test.ts`
Expected: PASS (6 件)

- [ ] **Step 5: コミット**

```bash
rtk git add src/lib/housing/stepperScroll.ts src/lib/housing/__tests__/stepperScroll.test.ts
rtk git commit -m "feat(housing): ステッパー進行連動スクロール量の純関数 computeStepperScroll" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: 画像/SNS セクションのコピー改善 (4 言語 + 新規 help 注記)

**Files:**
- Modify: `src/locales/ja.json`, `src/locales/en.json`, `src/locales/ko.json`, `src/locales/zh.json`
- Modify: `src/components/housing/register/HousingRegisterSnsUrlField.tsx` (help 注記 1 行追加)
- Test: `src/components/housing/register/__tests__/HousingRegisterSnsUrlField.help.test.tsx` (新規・最小)

**Interfaces:**
- Produces: i18n キー `housing.register.snsUrl.help` (新規)。値変更キー: `housing.register.step.media` / `housing.register.section_media` / `housing.register.step_desc.media` / `housing.register.snsUrl.label` / `housing.register.snsUrl.placeholder`。

**変更する値 (キーはそのまま・値だけ textual 編集。en/ko/zh の HousingSnap 表記は各ファイルの既存 `step_desc.media` の表記に合わせる。無ければ下記のまま):**

| キー | ja | en | ko | zh |
|---|---|---|---|---|
| `step.media` | `SNS投稿・サイトから自動入力` | `Auto-fill from a post or site` | `게시물·사이트에서 자동 입력` | `从帖子·网站自动填充` |
| `section_media` | `SNS投稿・サイトから自動入力` | `Auto-fill from a post or site` | `게시물·사이트에서 자동 입력` | `从帖子·网站自动填充` |
| `step_desc.media` | `住所が書いてあるSNS投稿やサイトのURLを貼ると、写真と住所の自動入力を試みます` | `Paste the URL of a social post or site that shows the address, and we'll try to auto-fill the photos and address.` | `주소가 적힌 SNS 게시물이나 사이트의 URL을 붙여넣으면 사진과 주소 자동 입력을 시도합니다` | `粘贴含有地址的社交帖子或网站的 URL，会尝试自动填充照片和地址` |
| `snsUrl.label` | `投稿・サイトのURL（任意）` | `Post or site URL (optional)` | `게시물·사이트 URL (선택)` | `帖子·网站 URL（可选）` |
| `snsUrl.placeholder` | `URLを貼ってください` | `Paste a URL` | `URL을 붙여넣으세요` | `粘贴 URL` |
| `snsUrl.help` (新規) | `X(旧Twitter)・YouTube・ハウジングスナップなどに対応。動画付きの投稿もOKです` | `Works with X (Twitter), YouTube, HousingSnap and more. Posts with video are OK too.` | `X(구 Twitter)·YouTube·HousingSnap 등에 대응. 동영상이 포함된 게시물도 OK입니다` | `支持 X(原 Twitter)·YouTube·HousingSnap 等，带视频的帖子也 OK` |

> `snsUrl.help` は各ロケールの `snsUrl` オブジェクト内 (label/placeholder の近く) に追加する。既存キーの並び・インデントを崩さない。`snsUrl.error.invalid` (対応 URL 一覧) は**変更しない**。

- [ ] **Step 1: 失敗テストを書く** (help 注記が URL 欄に表示される)

```tsx
// src/components/housing/register/__tests__/HousingRegisterSnsUrlField.help.test.tsx
// @vitest-environment happy-dom
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../../../locales/ja.json';
import { HousingRegisterSnsUrlField } from '../HousingRegisterSnsUrlField';

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja', fallbackLng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });
});

describe('HousingRegisterSnsUrlField help 注記', () => {
  it('URL 欄の下に snsUrl.help の注記を表示し、新プレースホルダーを使う', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <HousingRegisterSnsUrlField
          onTweetFetched={() => {}}
          onYoutubeFetched={() => {}}
          onOgpFetched={() => {}}
        />
      </I18nextProvider>,
    );
    // 新プレースホルダー
    expect(screen.getByPlaceholderText(jaTranslations.housing.register.snsUrl.placeholder)).toBeInTheDocument();
    // help 注記
    expect(screen.getByText(jaTranslations.housing.register.snsUrl.help)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: テストが失敗するのを確認**

まず 4 ロケールの値を上表どおりに textual 編集し、`ja.json` に `snsUrl.help` を追加してからテストを実行 (help 要素がまだ JSX に無いので FAIL する):
Run: `rtk vitest run src/components/housing/register/__tests__/HousingRegisterSnsUrlField.help.test.tsx`
Expected: FAIL (`snsUrl.help` のテキスト要素が見つからない。プレースホルダーは JSON 変更済みなら通る)

- [ ] **Step 3: help 注記を JSX に追加**

`HousingRegisterSnsUrlField.tsx` の `<input ... />` (現状 208-220 行) の**直後**に追加する:

```tsx
            <p className="housing-register-sns-url-help">
              {t('housing.register.snsUrl.help')}
            </p>
```

- [ ] **Step 4: テストが通るのを確認 + 4 言語 parity 確認**

Run: `rtk vitest run src/components/housing/register/__tests__/HousingRegisterSnsUrlField.help.test.tsx`
Expected: PASS

4 言語に `snsUrl.help` が揃っているか確認:
Run: `node -e "for (const l of ['ja','en','ko','zh']) { const j=require('./src/locales/'+l+'.json'); console.log(l, JSON.stringify(j.housing.register.snsUrl.help)); }"`
Expected: 4 言語すべて非 undefined。

- [ ] **Step 5: help 注記のスタイルを追加** (`src/styles/housing.css`)

`.housing-register-sns-url-field` 関連ルールの近くに、静かなグレー注記として追加 (箱にしない):

```css
.housing-register-sns-url-help {
  margin: 6px 0 0;
  font-size: var(--housing-text-xs);
  line-height: 1.5;
  color: var(--housing-text-mute);
}
```

- [ ] **Step 6: コミット**

```bash
rtk git add src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json src/components/housing/register/HousingRegisterSnsUrlField.tsx src/components/housing/register/__tests__/HousingRegisterSnsUrlField.help.test.tsx src/styles/housing.css
rtk git commit -m "feat(housing): 画像/SNS見出し・URL欄コピー改善 + 動画OK補足 (4言語)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: ステッパー静的化 (説明文常時表示) + 進行連動オートスクロール + 端フェード

**Files:**
- Modify: `src/components/housing/register/RegisterStepperNav.tsx`
- Modify: `src/styles/housing.css`
- Test: `src/components/housing/register/__tests__/RegisterStepperNav.test.tsx` (既存に追加)

**Interfaces:**
- Consumes: `computeStepperScroll` (Task 1)。

**DOM 構造 (nav の中に viewport を新設し、その中で body を translate):**

```
<nav .housing-register-stepper>
  <div .housing-register-stepper-viewport data-overflow={overflow ? 'true' : 'false'} ref=viewportRef>
    <div .housing-register-stepper-body ref=bodyRef style={{ transform: `translateY(${-scrollY}px)` }}>
      <svg .housing-register-stepper-svg .../>
      <ol .housing-register-stepper-list .../>
    </div>
  </div>
</nav>
```

- [ ] **Step 1: 失敗テストを書く** (progress を上げると body の translateY が増える / 全ステップ説明文が DOM にある)

既存 `RegisterStepperNav.test.tsx` の describe 内に追加する。happy-dom は実レイアウト非対応なので `getBoundingClientRect` をスタブして body 高さ=300 / viewport 高さ=150 を与える (overflow=150)。

```tsx
it('progress を上げると body が上へスクロールする (translateY が増える)', () => {
  const orig = Element.prototype.getBoundingClientRect;
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    if (this.classList.contains('housing-register-stepper-body')) {
      return { top: 0, height: 300, bottom: 300, left: 0, right: 40, width: 40, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
    }
    if (this.classList.contains('housing-register-stepper-viewport')) {
      return { top: 0, height: 150, bottom: 150, left: 0, right: 40, width: 40, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
    }
    if (this.classList.contains('housing-register-stepper-num')) {
      return { top: 0, height: 22, bottom: 22, left: 0, right: 22, width: 22, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
    }
    return { top: 0, height: 0, bottom: 0, left: 0, right: 0, width: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
  });

  const translateYOf = (el: HTMLElement | null) => {
    const m = (el?.style.transform ?? '').match(/translateY\((-?\d+(?:\.\d+)?)px\)/);
    return m ? parseFloat(m[1]) : 0;
  };
  const renderAt = (p: number) =>
    render(
      <I18nextProvider i18n={i18n}>
        <RegisterStepperNav steps={steps} onJump={() => {}} progress={p} />
      </I18nextProvider>,
    );

  const { container: c0 } = renderAt(0);
  const y0 = translateYOf(c0.querySelector('.housing-register-stepper-body'));
  const { container: c1 } = renderAt(0.5);
  const y1 = translateYOf(c1.querySelector('.housing-register-stepper-body'));

  expect(y1).toBeLessThan(y0 + 0.0001); // 進むほど translateY は負に大きく (上へ)
  expect(y1).toBeLessThan(0);           // overflow あり → 0.5 で上へ送られている
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(orig);
});

it('全ステップの説明文が常に DOM にある (アクティブ以外も)', () => {
  render(
    <I18nextProvider i18n={i18n}>
      <RegisterStepperNav steps={steps} onJump={() => {}} progress={0} />
    </I18nextProvider>,
  );
  // steps は media(active でない)/address(active)/intro(idle)。全部の説明文が出ている。
  expect(screen.getByTestId('housing-register-step-desc-1')).toHaveTextContent(
    jaTranslations.housing.register.step_desc.media,
  );
  expect(screen.getByTestId('housing-register-step-desc-3')).toHaveTextContent(
    jaTranslations.housing.register.step_desc.intro,
  );
});
```

> 注: 既存テスト冒頭で `jaTranslations` を import 済み。未 import なら
> `import jaTranslations from '../../../../locales/ja.json';` を足す。`vi` も import 済み。

- [ ] **Step 2: テストが失敗するのを確認**

Run: `rtk vitest run src/components/housing/register/__tests__/RegisterStepperNav.test.tsx -t "スクロール"`
Expected: FAIL (viewport / body の translateY が未実装で常に 0)

- [ ] **Step 3: RegisterStepperNav に viewport + オートスクロールを実装**

`computeStepperScroll` を import し、`viewportRef` と `contentH`/`viewportH` state を追加。既存 `useLayoutEffect` の measure を拡張し、body/viewport の高さも測る。body に `translateY` を適用し、viewport に `data-overflow` を付ける。

```tsx
import { computeStepperScroll } from '../../../lib/housing/stepperScroll';
// 既存 import はそのまま。useState/useLayoutEffect/useRef も既存。
```

コンポーネント本体 (既存の `centers`/`svgHeight` state の隣) に追加:

```tsx
  const viewportRef = useRef<HTMLDivElement>(null);
  const [contentH, setContentH] = useState(0);
  const [viewportH, setViewportH] = useState(0);
```

既存 measure() の中 (centers/svgHeight を set している所) に、body/viewport の高さ測定を追加:

```tsx
      const viewport = viewportRef.current;
      const bodyRect = body.getBoundingClientRect();
      setSvgHeight(bodyRect.height);
      setContentH(bodyRect.height);
      setViewportH(viewport ? viewport.getBoundingClientRect().height : 0);
```

> `bodyRef` は既存。`viewportRef` を新設。measure は `list`/`body` が無いと早期 return する既存構造を維持しつつ、`viewport` は任意 (無ければ 0)。ResizeObserver は既存で `list` を observe しているが、viewport のリサイズも拾うため **observe 対象に viewport を追加** する (`ro.observe(list); if (viewport) ro.observe(viewport);`)。

render 内、既存の `fills`/`connectors` 算出の後に:

```tsx
  const scrollY = computeStepperScroll(progress, contentH, viewportH);
  const overflow = contentH > viewportH;
```

JSX を viewport でくるむ (既存 `<div ref={bodyRef} className="housing-register-stepper-body">` を viewport の中へ):

```tsx
      <div
        ref={viewportRef}
        className="housing-register-stepper-viewport"
        data-overflow={overflow ? 'true' : 'false'}
      >
        <div
          ref={bodyRef}
          className="housing-register-stepper-body"
          style={{ transform: `translateY(${-scrollY}px)` }}
        >
          {/* 既存の <svg> と <ol> はそのまま */}
        </div>
      </div>
```

- [ ] **Step 4: 説明文の常時表示 + viewport/フェード/スクロールバー撤去の CSS** (`src/styles/housing.css`)

(1) 説明文の開閉をやめ常時表示に。既存の以下ブロックを置換:

```css
/* 置換前: .housing-register-stepper-desc-wrap (grid 0fr→1fr 開閉) と
   .is-active .desc-wrap (1fr) と @media reduce .desc-wrap を削除し、下記に。 */
.housing-register-stepper-desc-wrap {
  display: block;
}
.housing-register-stepper-desc-inner {
  min-height: 0;
}
.housing-register-stepper-desc {
  display: block;
  margin-top: 4px;
  font-size: var(--housing-text-xs);
  line-height: 1.5;
  color: var(--housing-text-mute);
}
```

(2) nav をスクロール領域一杯に広げ、viewport で clip + フェード、body を translate:

```css
/* 置換: 既存 .housing-register-stepper { flex: 0 0 auto; } を下記に。
   nav 自身も flex column にして viewport が flex:1 で器を満たせるようにする
   (height:100% は nav が definite height でないと崩れるため flex で堅牢化)。 */
.housing-register-stepper {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
/* ビューポート: 器の高さで clip。中身が超えるときだけ上下端をフェード (スクロールバー無し)。 */
.housing-register-stepper-viewport {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}
.housing-register-stepper-viewport[data-overflow='true'] {
  -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 20px, #000 calc(100% - 20px), transparent 100%);
  mask-image: linear-gradient(to bottom, transparent 0, #000 20px, #000 calc(100% - 20px), transparent 100%);
}
/* body: 進行連動で上へ送る。translateY は inline style で与える。
   スクロール追従なのでオーバーシュート系 (spring) は使わず ease-out で軽く追従
   (実画面で速度感は要微調整)。 */
.housing-register-stepper-body {
  position: relative;
  transition: transform 0.2s ease-out;
}
@media (prefers-reduced-motion: reduce) {
  .housing-register-stepper-body { transition: none; }
}
```

> 既存 `.housing-register-stepper-body { position: relative; }` は上の body ルールへ統合 (重複定義しない)。

(3) 左スクロール領域のスクロールバーを撤去 (translate+フェードに一本化):

```css
/* 置換: .housing-register-left-scroll の overflow-y: auto を overflow: hidden に。 */
.housing-register-left-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
```

- [ ] **Step 5: テストが通るのを確認 + 既存回帰**

Run: `rtk vitest run src/components/housing/register/__tests__/RegisterStepperNav.test.tsx`
Expected: PASS (新規 2 件 + 既存 done/active/idle/onJump/step_desc/SVG 本数/dashoffset すべて)

- [ ] **Step 6: build 確認 (tsc -b 厳密・未使用なし)**

Run: `rtk npm run build`
Expected: 成功 (未使用 import/var なし。`viewportRef`/`contentH`/`viewportH`/`computeStepperScroll` すべて使用)

- [ ] **Step 7: コミット**

```bash
rtk git add src/components/housing/register/RegisterStepperNav.tsx src/components/housing/register/__tests__/RegisterStepperNav.test.tsx src/styles/housing.css
rtk git commit -m "feat(housing): ステッパー説明文を常時表示化 + 進行連動オートスクロール+端フェード" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## 完了条件

- `computeStepperScroll` の 6 テストが緑。
- `RegisterStepperNav` の既存回帰 + 新規 (translateY 進行連動 / 説明文常時表示) が緑。
- `HousingRegisterSnsUrlField` の help/placeholder テストが緑。4 言語に新旧キーが揃う。
- `rtk npm run build` 成功。
- 実画面 (本番ログイン必須) で目視: 説明文が全部出て開閉しない / スクロールで見切れる時はフェード+自動追従 (スクロールバー無し) / リングが従来どおり進捗連動 / 見出し・URL 欄コピーが新文言・動画OK補足が出る。
