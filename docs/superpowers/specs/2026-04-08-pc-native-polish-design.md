# PC版ネイティブポリッシュ設計書

> LoPo PC版の見た目・操作感をネイティブアプリ品質に引き上げる。
> テーブル構造・軽減ロジック・計算エンジンは一切変更しない。

## 参考資料

- [CSSのlinear()によるスプリングアニメーション活用法 — ICS MEDIA](https://ics.media/entry/260402/)
- スマホリデザイン設計書: `docs/superpowers/plans/2026-04-08-mobile-native-redesign.md`

## 方針

- **段階的アプローチ**: Phase 1（色・質感）→ Phase 2（モーション）→ Phase 3（レイアウト微調整）
- **各Phase後にデプロイ確認** — 壊れたらすぐ巻き戻せる
- **120fps死守** — CSS transition / `linear()` ベース、framer-motionは最小限
- **CSS変数（デザイントークン）で管理** — 値の変更は1箇所、全コンポーネントに反映
- **不変**: TimelineRow/MobileTimelineRowの列構成、軽減配置ロジック、calculator.ts、ストア、データフロー

---

## Phase 1: 色・質感

### 変更対象
- `src/index.css` のCSS変数のみ

### ダークテーマ

| 変数 | 現在 | 変更後 | 理由 |
|------|------|--------|------|
| `--color-bg-primary` | `#000000` | `#0F0F10` | Linear風。ほぼ黒だが微妙に柔らかく高級感 |
| `--color-bg-secondary` | `#000000` | `#0F0F10` | 主背景と統一 |
| `--color-bg-tertiary` | `#0a0a0a` | `#161618` | カード・パネル。主背景との差を維持 |
| `--color-text-primary` | `#ffffff` | `#F0F0F0` | 純白→わずかに柔らかく。目の疲れ軽減 |
| `--color-border` | `rgba(255,255,255,0.22)` | `rgba(255,255,255,0.10)` | ボーダーを控えめに。高級感UP |

### ライトテーマ

| 変数 | 現在 | 変更後 | 理由 |
|------|------|--------|------|
| `--color-bg-primary` | `#ffffff` | `#FAFAFA` | Modern白。カードが白で浮く構成 |
| `--color-bg-tertiary` | `#f5f5f5` | `#ffffff` | カード背景が白→背景FAFAFAとの差でカード浮遊感 |
| `--color-text-primary` | `#000000` | `#171717` | 純黒→Vercel風ダークグレー |
| `--color-border` | `rgba(0,0,0,1)` | `rgba(0,0,0,0.10)` | **最大の印象変化**。真っ黒ボーダー→薄グレー |

### glassmorphism調整

| Tier | 変更 |
|------|------|
| tier1 (背景パネル) | ダーク: bg `rgba(255,255,255,0.04)` → `rgba(255,255,255,0.03)` |
| tier2 (ヘッダー/サイドバー) | ボーダー透過度をborder変数に連動 |
| tier3 (モーダル) | shadow をわずかにソフト化: `0 12px 48px rgba(0,0,0,0.4)` → `0 16px 48px rgba(0,0,0,0.3)` |

### ライトテーマのglassmorphism

| Tier | 変更 |
|------|------|
| 全Tier | ボーダーを `rgba(0,0,0,1)` 系から `rgba(0,0,0,0.06〜0.12)` に統一 |
| tier3 | shadow: `box-shadow: 0 8px 32px rgba(0,0,0,0.08)` に繊細化 |

---

## Phase 2: モーション（マイクロインタラクション）

### 方針
- **CSS `linear()` 関数でspringカーブを定義** — ICS MEDIA記事の手法
- CSS変数に登録して全コンポーネントで再利用
- framer-motionは既存使用箇所のspring値統一のみ（新規追加しない）
- `prefers-reduced-motion` 尊重

### CSS spring変数の新設（`src/index.css`）

```css
:root {
  /* spring easing — CSS linear() で表現 */
  --ease-spring: linear(
    0, 0.009, 0.035 2.1%, 0.141, 0.281 6.7%, 0.723 12.9%,
    0.938 16.7%, 1.017, 1.077, 1.121, 1.149 24.3%,
    1.159, 1.163, 1.161, 1.154 29.9%, 1.129 32.8%,
    1.051 39.6%, 1.017 43.1%, 0.991, 0.977 51%,
    0.974 53.8%, 0.975 57.1%, 0.997 69.8%, 1.003 76.9%, 1
  );
  --ease-spring-gentle: linear(
    0, 0.007, 0.029 2.2%, 0.118, 0.24 7.1%, 0.621 13.8%,
    0.818 17.7%, 0.904, 0.967, 1.01, 1.037 25.4%,
    1.051, 1.058, 1.06, 1.056 31.2%, 1.042 34%,
    0.997 42%, 0.977 47.1%, 0.972 51.3%, 0.973 55.5%,
    0.993 71.7%, 1.001 78.9%, 1
  );

  /* duration */
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-modal: 300ms;

  /* scale */
  --scale-press: 0.96;
  --scale-hover: 1.04;
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --ease-spring: ease;
    --ease-spring-gentle: ease;
    --duration-fast: 0ms;
    --duration-normal: 0ms;
    --duration-modal: 0ms;
  }
}
```

### 適用対象

| 対象 | 現在 | 変更後 |
|------|------|--------|
| **ボタン press** | `active:scale-95`（即時） | `transition: transform var(--duration-fast) var(--ease-spring)` + `active:scale-[0.96]` |
| **モーダル登場** | `opacity 0→1, scale 0.95→1, duration-200` | `transition: var(--duration-modal) var(--ease-spring)` でバネ感 |
| **ポップオーバー登場** | 同上 | `scale 0.96→1` + `var(--ease-spring)` で「ポッ」と出現 |
| **ツールチップ** | `transition-opacity` のみ | `scale 0.96→1 + opacity` + `var(--ease-spring)` |
| **ヘッダー開閉** | framer-motion `stiffness:300, damping:30` | spring値を `SPRING.default`（400/28）に統一 |
| **サイドバー開閉** | CSS `transition-all duration-300` | `var(--duration-modal) var(--ease-spring)` |
| **ホバー時アイコン** | `hover:scale-110` | `hover:scale-[1.04]`（控えめ）+ `transition: transform var(--duration-fast) var(--ease-spring)` |
| **TimelineRow右ボタン** | `opacity-0 → group-hover:opacity-100` | 同上 + `translateY(2px)→0` で下から浮き上がり |
| **Toastアニメ** | 現在の出現方法 | `translateY(8px)→0 + scale 0.96→1` + `var(--ease-spring)` |

### Tailwindユーティリティクラスの追加検討

```css
/* btn-spring: ボタン共通のpress+hover感 */
.btn-spring {
  transition: transform var(--duration-fast) var(--ease-spring);
}
.btn-spring:active {
  transform: scale(var(--scale-press));
}
```

既存の `btn-tactile` クラスがあるので、それを拡張する形が自然。

---

## Phase 3: レイアウト微調整

### 3-1. テーブルのglass-panel → 画面いっぱい化

**現在**: タイムラインテーブルが `glass-panel` の角丸四角に囲まれて中央にこじんまり。
**変更**: テーブルを画面いっぱいに広げ、ヘッダー/サイドバーの下に透けて見えるようにする。

- `glass-panel` のborder-radius、padding を除去（PC版のみ）
- テーブルがサイドバー右端〜画面右端まで占有
- ヘッダーとサイドバーの `backdrop-filter: blur()` が効いて、テーブルが下に透ける
- **スマホでも同様**（TODO.mdのフィードバック「表が角丸四角でこじんまり」の修正と共通）

### 3-2. ヘッダーの質感向上

- ツールバーボタン群にspring付きhover/press
- 折りたたみハンドルのアニメーションを `var(--ease-spring)` に統一
- ボタン間の区切り線のコントラストを薄く（ボーダー変数に連動）

### 3-3. サイドバーの質感向上

- プラン選択行のhoverにspring scale
- 選択中プランのインジケーターを左ボーダー `2px solid blue` → `3px` + spring遷移
- セクション見出しのタイポグラフィ微調整（letter-spacing, opacity）

### 3-4. モーダル・ポップオーバー共通

- 全モーダルの登場/退場にPhase 2のspring easingを適用
- backdrop（オーバーレイ暗転）の `transition-opacity` を `var(--duration-modal)` に統一
- 角丸を `rounded-xl`（12px）→ `rounded-2xl`（16px）に微増（より柔らかく）

---

## 同時に修正するスマホフィードバック

Phase 1〜3 と並行して修正。PC改善と共通の変更（色・glass-panel）を活用。

| 項目 | 対応 |
|------|------|
| 長押し時テキスト選択 | 操作可能要素に `user-select: none; -webkit-touch-callout: none` |
| ヘッダーのコンテンツ名 | スマホでは非表示 or 1行省略+タップで展開 |
| 表のglass-panel | Phase 3-1 でPC/スマホ共通で画面いっぱい化 |
| FAB言語切替 | 言語マーク押下→左にspring展開セレクター |
| D&D時テキスト選択 | `touch-action: none; user-select: none` 追加 |
| ジョブピッカー常時表示 | MobilePartySettings でジョブピッカーを常時表示に変更 |
| PC版ヘッダーハンドル/SyncButtonずれ | リグレッション修正 |

---

## 変更しないもの

- TimelineRow / MobileTimelineRow の列構成・セル幅
- 軽減配置ロジック（validateMitigationPlacement等）
- calculator.ts（ダメージ計算・HP計算）
- useMitigationStore / usePlanStore のデータフロー
- Firestore同期ロジック
- テスト（116テスト全パスを維持）
- フォント（Rajdhani, M PLUS 1）

---

## 将来のTODO（今回スコープ外）

- コマンドパレット（Ctrl+K）
- タブ型プラン切替
- サイドバーのアイコンレール圧縮
- データビジュアライゼーション改善
