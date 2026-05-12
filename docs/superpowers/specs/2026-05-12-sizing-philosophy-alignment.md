# LoPo Sizing 思想統一 — Phase 1 修正 + Phase 2 撤回 spec

> 全プロジェクト共通の **サイズ設計哲学** (`C:\Users\masay\.claude\design-philosophy-sizing.md`) と LoPo の既存 plan `2026-05-12-timeline-full-responsive.md` の差分を解消するための spec。

最終更新: 2026-05-12
適用先: LoPo (FF14Sim) `src/index.css` + Phase 2 設計書

---

## 1. 背景

全プロジェクトで「**開発者が見ている画面を、 ノート PC からウルトラワイドモニターまでほとんどのユーザーに同じ密度・同じ見え方で届ける**」 思想を確定 (`~/.claude/design-philosophy-sizing.md`)。

既存 LoPo plan `2026-05-12-timeline-full-responsive.md` (= Timeline Full Responsive) と差分があり、 修正が必要:

### LoPo 元 plan の問題点

| 元 plan の意図 | 思想との差分 |
|---|---|
| `--col-th-w: clamp(110px, 8.395vw, 180px)` (max 180 = base × 1.44) | ❌ max が base 超え → ultrawide で要素が過剰拡大 → ユーザー目標と矛盾 |
| `--col-dps-w: clamp(45px, 3.358vw, 80px)` (max 80 = base × 1.60) | 同上 |
| 全列幅 clamp max が base × 1.4〜1.6 (上下伸縮) | 同上 |
| Phase 2 (font rem 化): `clamp(min-rem, Nvw, max-rem)` | ❌ rem ベースで Chromium UWP text scale factor との二重 scaling、 全ユーザーで同じ見え方目標と矛盾 |

---

## 2. 修正内容

### 2-1. Phase 1 の clamp 値修正 (max を base に統一)

`src/index.css` の `@media (min-width: 768px)` ブロック内、 既存の clamp 値の `max` を `base` (アンカー値) に変更:

```css
/* ❌ 元 plan */
--col-phase-w: clamp(48px, 4.030vw, 80px);
--col-label-w: clamp(40px, 3.358vw, 70px);
--col-time-w: clamp(48px, 4.030vw, 80px);
--col-mechanic-w: clamp(160px, 13.432vw, 280px);
--col-counter-w: clamp(80px, 6.716vw, 140px);
--col-th-w: clamp(110px, 8.395vw, 180px);
--col-dps-w: clamp(45px, 3.358vw, 80px);

/* ✅ 修正版 (max = base) */
--col-phase-w: clamp(48px, 4.030vw, 60px);     /* base 60 */
--col-label-w: clamp(40px, 3.358vw, 50px);     /* base 50 */
--col-time-w: clamp(48px, 4.030vw, 60px);      /* base 60 */
--col-mechanic-w: clamp(160px, 13.432vw, 200px); /* base 200 */
--col-counter-w: clamp(80px, 6.716vw, 100px);  /* base 100 */
--col-th-w: clamp(110px, 8.395vw, 125px);      /* base 125 */
--col-dps-w: clamp(45px, 3.358vw, 50px);       /* base 50 */
```

### 2-2. viewport ごとの挙動 (修正後)

| viewport | T/H 列 | DPS 列 | MECHANIC 列 |
|---|---|---|---|
| 1366 (ノート) | 110px (min) | 45px (min) | 160px (min) |
| 1489 (開発者) | **125px** ← アンカー | **50px** ← アンカー | **200px** ← アンカー |
| 1920 (一般デスクトップ) | 125px (max 固定) | 50px (max 固定) | 200px (max 固定) |
| 2560 (27" 4K@150%) | 125px (固定) | 50px (固定) | 200px (固定) |
| 3840 (4K native / ultrawide) | 125px (固定) | 50px (固定) | 200px (固定) |

= **開発者画面の見え方を上限として、 1489 を超える viewport では要素サイズ固定、 余白だけ増える**

### 2-3. container max-width (新規追加)

タイムライン本体は横スクロール対応のため適用不要だが、 sidebar / modal / popover / landing page には適用:

```css
:root {
  --container-max: 1489px;
}

.app-container,
.modal-content,
.popover-content {
  max-width: var(--container-max);
  margin-inline: auto;
}
```

LP (Landing Page) は本適用が特に重要。 ultrawide でコンテンツが間延びしない。

### 2-4. Phase 2 (font rem 化) は撤回 → 修正版に置換

#### 元 plan の Phase 2 (撤回対象)
```css
/* ❌ 元 plan の Phase 2 計画 */
--font-size-base: clamp(0.5rem, 0.671vw, 0.75rem);  /* rem ベース */
```

#### 修正版 Phase 2 (採用)
```css
/* ✅ 修正版 (px ベース、 max = base) */
:root {
  /* ブラウザ font 設定の影響を無効化 */
  font-size: 16px;

  /* アプリ内 text size 設定の倍率 (将来追加用) */
  --text-scale-multiplier: 1;

  /* Text tokens (clamp+vw, max = base = 開発者画面 px) */
}

@media (min-width: 768px) {
  :root {
    --font-size-3xs: clamp(5px,  0.403vw, 6px);   /* base 6 */
    --font-size-2xs: clamp(6px,  0.470vw, 7px);   /* base 7 */
    --font-size-xs:  clamp(7px,  0.537vw, 8px);   /* base 8 */
    --font-size-sm:  clamp(8px,  0.604vw, 9px);   /* base 9 */
    --font-size-base: clamp(9px,  0.671vw, 10px); /* base 10 */
    --font-size-md:  clamp(10px, 0.738vw, 11px);  /* base 11 */
    --font-size-lg:  clamp(10px, 0.806vw, 12px);  /* base 12 */
    --font-size-xl:  clamp(11px, 0.873vw, 13px);  /* base 13 */
    --font-size-2xl: clamp(12px, 0.940vw, 14px);  /* base 14 */
    --font-size-2xl-plus: clamp(14px, 1.074vw, 16px); /* base 16 */
    --font-size-3xl: clamp(15px, 1.209vw, 18px);  /* base 18 */
    --font-size-4xl: clamp(17px, 1.343vw, 20px);  /* base 20 */
    --font-size-4xl-plus: clamp(20px, 1.612vw, 24px); /* base 24 */
    --font-size-5xl: clamp(22px, 1.746vw, 26px);  /* base 26 */
    --font-size-6xl: clamp(30px, 2.418vw, 36px);  /* base 36 */
  }
}
```

ポイント:
- **rem 単位は完全に使わない** (Chromium UWP text scale factor の影響を最小化)
- max を base に統一 (= 開発者画面で見える size 以上には拡大しない)
- 既存の Tailwind マッピング (`text-app-*`) はそのまま使える (値が CSS 変数経由なので)

### 2-5. アクセシビリティ代替 (将来追加)

ブラウザ font 設定が px ベースには効きにくいため、 アプリ内設定 UI で代替:

```css
:root[data-text-scale="small"]  { --text-scale-multiplier: 0.9; }
:root[data-text-scale="medium"] { --text-scale-multiplier: 1; }
:root[data-text-scale="large"]  { --text-scale-multiplier: 1.1; }
:root[data-text-scale="x-large"] { --text-scale-multiplier: 1.25; }

/* 各 token に multiplier を掛ける場合は calc() でラップ */
--font-size-base: clamp(
  calc(9px * var(--text-scale-multiplier)),
  calc(0.671vw * var(--text-scale-multiplier)),
  calc(10px * var(--text-scale-multiplier))
);
```

アプリ設定 UI (例: 「サイズ調整」 menu) から `data-text-scale` を切り替え。 これは LoPo Phase 3+ の検討事項。

---

## 3. 実装ステップ

### Step 1: Phase 1 の clamp 値修正

[src/index.css](src/index.css) の `@media (min-width: 768px)` ブロック内の列幅 token の max を base に変更 (上記 2-1 の値)。

### Step 2: Phase 1 完走の確認

- `--col-member-start` (= calc(col-phase + col-label + col-time + col-mechanic + col-counter * 2)) は max=base 値で再計算 → 1489 で 570px (元 plan と同値)、 1366 で min クランプ合計 ≈ 478px、 1920+ で 570px 固定
- 既存の `Timeline.tsx` の `currentLeft = 570` (line 1841) と整合性: 1489+ で 570 固定なので OK
- 1366 ノートでは min クランプで縮小、 layout 自体は崩れない (skyline 系の問題なし)

### Step 3: Phase 2 (font 修正版) の実装

[src/index.css](src/index.css) の `@media (min-width: 768px)` ブロック内、 既存の固定 px 値 `--font-size-*: Npx` を上記 2-4 の clamp 値に置換。

### Step 4: container max-width の追加 (LP / Modal)

該当コンポーネントの class に `max-width: var(--container-max)` を追加。 Timeline 本体は除外。

### Step 5: 動作確認

- Chrome DevTools Device Mode で **3 viewport** を必ず確認:
  - 1366 × 100% × text 100% (ノート想定): min クランプで縮小、 layout 崩れなし
  - 1920 × 100% × text 100% (一般デスクトップ): 開発者画面と同じ表示
  - 3840 × 100% × text 100% (ultrawide): 同じ表示、 余白拡大
- Playwright snapshot (`playwright/timeline-responsive.spec.ts`) で 5 viewport 全て pass

### Step 6: ドキュメント更新

- 元 plan `2026-05-12-timeline-full-responsive.md` の Phase 2 セクションに 「← 本 spec で置換」 を追記
- README / CHANGELOG 更新 (任意)

---

## 4. テスト計画

### vitest (既存)
- `calculator.test.ts` の `getColumnCssVar` 等 → CSS 変数名のみ確認なので影響なし

### Playwright (既存 + 強化)
- `playwright/timeline-responsive.spec.ts` の 5 viewport snapshot:
  - 1366 / 1489 / 1920 / 2560 / 3840
  - 各 viewport で **開発者画面と同じ要素サイズ**になっていることを確認
  - 1366 のみ min クランプで縮小、 それ以外は 1489 と同サイズが期待値

### 手動確認
- 実機テスト (可能なら 1366 ノート + 1080p デスクトップ + ultrawide)
- 開発者環境 (4K + 200% + text 130%) で「ちょうど」 と感じる見え方を保持

---

## 5. 議論履歴

### 2026-05-12 LoPo 旧 plan (= 元案)
- 列幅 clamp の max を base × 1.4〜1.6 で設定 (上下伸縮)
- Phase 2 で font rem 化計画

### 2026-05-12 AllMarks 側で思想統一議論 (Booklage Claude session)
- Windows OS テキストサイズ設定が px text にも影響することを実機 + WebSearch で確認
- 業界実践 (Stripe / Linear / Notion / 2026 best practice) と整合確認
- ユーザー要望「私が見ている画面を MAX とする」 → clamp max を base に統一
- rem 完全不使用 + container max-width 追加 → 思想統合

### 2026-05-12 本 spec (= 修正案)
- LoPo plan の Phase 1 を「max = base」 に修正、 Phase 2 を px ベース clamp に置換
- container max-width を LP / Modal に追加
- アプリ内 text size 設定をアクセシビリティ代替として将来追加

---

## 6. 参照

- 全プロジェクト共通思想: `C:\Users\masay\.claude\design-philosophy-sizing.md`
- グローバル CLAUDE.md: `C:\Users\masay\.claude\CLAUDE.md` (「サイズ設計思想」 セクション)
- LoPo 元 plan: `docs/superpowers/plans/2026-05-12-timeline-full-responsive.md`
- 関連 design doc: `docs/superpowers/specs/2026-04-02-design-tokens-font-size.md` / `2026-04-02-typography-overhaul-design.md`

---

## 7. LoPo Claude (別 session) への引き継ぎメッセージ

LoPo 側 Claude Code session に以下をユーザー経由で伝言:

> 別プロジェクト (AllMarks/Booklage) 側で全プロジェクト共通の sizing 思想を策定しました。 LoPo の plan に影響あり、 修正必須です。
>
> 1. `/clear` で session reset (新しい `~/.claude/CLAUDE.md` を読み込む)
> 2. `C:\Users\masay\.claude\design-philosophy-sizing.md` を Read tool で読む
> 3. `C:\Users\masay\Desktop\FF14Sim\docs\superpowers\specs\2026-05-12-sizing-philosophy-alignment.md` を Read tool で読む (本 spec)
> 4. 既存 plan `docs/superpowers/plans/2026-05-12-timeline-full-responsive.md` の Phase 1 / Phase 2 を本 spec の方針に合わせて実装または修正
>
> 核心: clamp の max を base に統一 (= 上限固定、 ultrawide で要素拡大せず余白拡大)、 font は rem 不使用で px ベース clamp、 container max-width 1489px。
