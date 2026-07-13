# 登録ステッパー静的化 + 進行連動オートスクロール + 画像/SNS 見出しコピー改善 設計 (2026-07-13)

## 背景・問題

前タスクで登録ページ左のステッパー (`RegisterStepperNav`) を「円周進捗リング」に刷新した。
本番実画面でユーザーが 2 点を指摘:

1. **展開方式が進捗リングを無駄に難しくしている**: いまはアクティブなステップだけ説明文が
   `grid-template-rows: 0fr → 1fr` で開閉する。スクロールでアクティブが変わるたびに丸の位置が
   上下し、リング区間を毎回測り直すため、進捗の塗りが安定しない。
2. **「画像・SNS URL」見出しが意味不明** / URL 欄の文言が X・YouTube だけ列挙で、実際は対応済みの
   ハウジングスナップ等が対象外に見える。動画対応 (YouTube / 動画付きツイート) も打ち出せていない。

## 目的

- 説明文の開閉をやめ、**全ステップの説明文を常時表示**してレイアウトを固定 → リング進捗が素直に合う。
- 説明文で縦に伸びて**見切れる画面**向けに、スクロールバーではなく **進行 (progress 0..1) に連動した
  自動スクロール + 端フェード**でアクティブ行を追わせる。
- 画像/SNS セクションの**見出し・ラベル・プレースホルダー・補足**を、意味が通り・対応範囲を狭く
  見せない文言へ改善 (4 言語)。動画対応を「誤解のない範囲で」明示。

## 設計

### A. 説明文の常時表示 (展開廃止)

- `.housing-register-stepper-desc-wrap` の `grid-template-rows: 0fr` (折りたたみ) と
  `.is-active` 時 `1fr` の開閉をやめ、**常に `1fr` (=全ステップ説明文を常時表示)** にする。
  開閉トランジション (`transition: grid-template-rows`) と `@media reduce` の該当ルールも撤去。
- アクティブ表現は**従来どおり青枠ハイライト** (`.housing-register-stepper-item.is-active` の
  背景/枠) のみ残す。高さは変えない。
- 結果、各丸の中心 y は開閉で動かなくなる。リングの測定 (ResizeObserver) は**初回とウィンドウ
  リサイズ時だけ**意味を持つ (挙動は現状のまま・再測定が不要になるだけで害はない)。

### B. 進行連動オートスクロール + 端フェード

左パネルは既に `.housing-register-left-scroll` (`flex:1`・現状 `overflow-y:auto` のスクロールバー)
の中にステッパー `nav` のみを持つ (残数バーはスクロール外・下端固定)。これを次に変える:

- **`.housing-register-left-scroll`**: `overflow-y: auto` → **`overflow: hidden`** (スクロールバー撤去)。
- **ステッパー `nav` (`.housing-register-stepper`)** をこの領域の高さに合わせて満たし
  (`flex: 1 1 auto; min-height: 0`)、内部に**ビューポート + スクローラ**を持たせる:
  - `.housing-register-stepper-viewport` — `height:100%; overflow:hidden`。**中身が器を超えるときだけ**
    `mask-image: linear-gradient(to bottom, transparent 0, #000 <fade>, #000 calc(100% - <fade>), transparent 100%)`
    で上下端フェード (`data-overflow="true"` 属性で切替。収まる画面では mask なし=端が欠けない)。
  - `.housing-register-stepper-body` (SVG リング + `ol` リスト) を **`transform: translateY(-scrollY)`** で動かす。
    SVG とリストは同じ body の子なので**一緒にスクロール**し、丸中心の body 相対座標は不変
    (=リングの再測定不要・リングとリストがズレない)。
- **スクロール量 (純関数・TDD 対象)**:

  ```
  computeStepperScroll(progress: number, contentH: number, viewportH: number): number
  ```

  - `overflow = max(0, contentH - viewportH)`
  - `scrollY = clamp(progress, 0, 1) * overflow`
  - `contentH <= viewportH` (収まる) なら `overflow = 0` → `scrollY = 0` (動かない)。
  - `contentH`/`viewportH`/負値/NaN 安全 (ゼロ・負は 0 に丸め)。

  進捗 0→1 に比例して body を上へ送る = フォームを下へスクロールするとステッパーも同じだけ送られ、
  アクティブ行が視野内に保たれる。既存 `progress` prop をそのまま流用 (リングと同一ソース=完全同期)。
- **測定**: 既存 `useLayoutEffect` + `ResizeObserver` を拡張し、`contentH` = body の実高さ、
  `viewportH` = viewport の高さを測る。`scrollY` と `data-overflow` を反映する。

### C. 画像/SNS セクションのコピー改善 (4 言語)

ユーザー承認済みの差し替え (日本語。en/ko/zh は同義で揃える):

| キー | 現在 (ja) | 変更後 (ja) |
|---|---|---|
| `housing.register.step.media` (ステッパー見出し) | 画像・SNS URL | **SNS投稿・サイトから自動入力** |
| `housing.register.section_media` (セクション h2) | 画像・SNS URL | **SNS投稿・サイトから自動入力** |
| `housing.register.step_desc.media` (説明文・常時表示) | X (Twitter) やハウジングスナップの URL を貼ると、写真と住所を自動で取り込みます | **住所が書いてあるSNS投稿やサイトのURLを貼ると、写真と住所の自動入力を試みます** |
| `housing.register.snsUrl.label` | SNS URL（任意・Twitter / YouTube） | **投稿・サイトのURL（任意）** |
| `housing.register.snsUrl.placeholder` | https://x.com/.../status/... または https://youtu.be/... | **URLを貼ってください** |
| `housing.register.snsUrl.help` (**新規**・URL 欄の下) | (なし) | **X(旧Twitter)・YouTube・ハウジングスナップなどに対応。動画付きの投稿もOKです** |

- **`snsUrl.help` を新規追加**し、`HousingRegisterSnsUrlField` の `<input>` 直後に
  `.housing-register-sns-url-help` (グレー小文字の静かな注記・箱にしない=`feedback_housing_no_ai_pills`) で表示。
- **誤解防止**: 「動画付きの投稿も OK」= 動画 URL (ツイート/YouTube) が使える意。**「アップロード」「埋め込める」
  は書かない** (動画の直接アップロードは不可のため)。サービス列挙は補足だけ・末尾「など」で排他に見せない。
  `snsUrl.error.invalid` (対応 URL 一覧) は既存のまま変更しない。

## スコープ

- `src/lib/housing/stepperScroll.ts` (新規・純関数 `computeStepperScroll`) + テスト。
- `src/components/housing/register/RegisterStepperNav.tsx` — viewport/scroller 構造 + translateY + data-overflow 反映。
- `src/components/housing/register/HousingRegisterSnsUrlField.tsx` — placeholder はキー据置 (値のみ i18n 変更)、
  `snsUrl.help` の注記を `<input>` 直後に追加。
- `src/styles/housing.css` — desc 常時表示化 / viewport・fade / help 注記スタイル / `.housing-register-left-scroll` overflow。
- `src/locales/{ja,en,ko,zh}.json` — 上表のキー (該当ブロックだけ textual 編集・4 言語 parity)。

## 非スコープ

- リング自体の描画方式 (前タスクで確定・変更しない)。
- 画像アップロード機能や対応サービスの追加 (コピーのみ・機能は現状維持)。
- 他ページ (ツアー等) のステッパー。

## テスト観点

- `computeStepperScroll`: progress=0→0 / progress=1→overflow / 中間=比例 / contentH<=viewportH→0 /
  負値・NaN・0 安全。
- `RegisterStepperNav`: 全ステップの説明文 (`step_desc.*`) が**常に**表示される (アクティブ以外も) /
  progress を上げると body の translateY (または CSS 変数) が増える (happy-dom は getBoundingClientRect を
  スタブして contentH/viewportH を与える) / 既存回帰 (done✓/active青/onJump/リング dashoffset)。
- コピー: `RegisterSectionMedia`/`HousingRegisterSnsUrlField` が新キーを描画 (label/placeholder/help)。
- 4 言語 parity: 追加/変更キーが ja/en/ko/zh に揃っている。
