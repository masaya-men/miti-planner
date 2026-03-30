# Pretext LP演出強化 — 設計書

> 日付: 2026-03-31（第59セッション）

## 概要

ランディングページの全4セクションに[@chenglou/pretext](https://github.com/chenglou/pretext)を導入し、DOMを使わないテキスト測定によるタイポグラフィ演出を追加する。

**方針:** 全セクション分を`feature/pretext-lp`ブランチで実装し、実際の動作を確認してから採用するセクションを決定する。不採用分は`main`に戻すだけでOK。

## Pretextとは

- DOMの`getBoundingClientRect()`を使わずに、純粋な算術計算でテキストの幅・高さ・行レイアウトを算出するライブラリ
- 数KB、計算は約0.09ms
- `prepare(text, font)` → `layout(prepared, width, lineHeight)` の2ステップ

## セクション別設計

### 1. HeroSection — パーティクル集合アニメーション

**演出:**
- ページロード時、150万パーティクルが散乱状態から「LoPo」の文字形状に集合
- マウスを近づけると局所的に崩壊 → 離れると再集合
- スクロールで文字形状が崩壊してグリッドに戻りながらフェードアウト

**Pretextの役割:**
- 「LoPo」テキストの各文字のバウンディングボックスを`prepare()`で取得
- 文字領域を均等にサンプリングしてパーティクルの目標座標（ターゲット位置）を生成
- リサイズ時も`layout()`の再計算のみでDOM測定不要

**実装方針:**
- `LandingScene.tsx`のシェーダーに`uTextTarget`テクスチャ（またはデータテクスチャ）を追加
  - 各パーティクルに対応するターゲット座標をテクスチャに格納
  - `uFormProgress` uniform（0.0〜1.0）でグリッド⇔文字形状をLerp
- `HeroSection.tsx`からPretextでテキスト座標を計算し、LandingSceneに渡す
- 既存のアメーバ揺らぎ・マウス押し退けはそのまま維持（加算合成）
- スクロール連動: 既存のScrollTrigger pinの中で`uFormProgress`を1.0→0.0にアニメーション

**既存コードへの影響:**
- `LandingScene.tsx`: シェーダー修正（targetテクスチャ追加、Lerp追加）、uniform追加
- `HeroSection.tsx`: Pretext計算追加、LandingSceneとのデータ共有

### 2. MitiSection — テキストフロー演出

**演出:**
- スクロールでモックアップが画面に入ると、内部のテキスト（技名・時間）が上から順にタイプインするように表示
- 軽減バーの幅もテキスト幅に合わせて動的に伸びる
- 「動いているアプリ」感の演出

**Pretextの役割:**
- モックアップ内の各テキスト行の幅を事前計算
- テキスト幅に基づいて軽減バーの目標幅を決定（DOM測定なし）

**実装方針:**
- 各行にGSAPのstaggerアニメーション（clipPath + opacity）をスクロール連動で適用
- Pretextで計算した幅を使って、バーのwidthをアニメーション
- 既存のモックアップ構造（プレースホルダーバー）はテキスト付きに置換

**既存コードへの影響:**
- `MitiSection.tsx`: モックアップ内容の書き換え、テキストフローアニメーション追加

### 3. FeaturesSection — エディトリアル・マガジンレイアウト

**演出:**
- 現在の縦1列・左右交互配置から、雑誌見開きの2カラムグリッドに変更
- グリッドの区切り線でエディトリアル感を演出
- スクロールで各セルが順次ワイプイン

**Pretextの役割:**
- 各フィーチャーの説明テキストの高さを事前計算
- リサイズ時にグリッドセルの高さをDOM測定なしで即座に再計算
- 全セルの高さを揃えるための最大値計算

**実装方針:**
- レイアウトをCSS Gridの2x2に変更
- 区切り線をborderで追加
- スクロールアニメーションは既存のGSAP ScrollTriggerを継続使用（triggerをrow→cell単位に変更）
- モバイルでは1カラムにフォールバック

**既存コードへの影響:**
- `FeaturesSection.tsx`: レイアウト構造の変更（HTML/CSS）、アニメーションのtrigger調整

### 4. CTASection — パーティクル再集合

**演出:**
- ヒーローで崩壊したパーティクルが「始めよう。」の文字形状に再集合
- ページの最初（LoPo）と最後（始めよう）で対称的な演出 → 物語のあるページ体験

**Pretextの役割:**
- 「始めよう。」テキストの形状座標を計算（Heroと同じ手法）

**実装方針:**
- LandingScene.tsxに2つ目のテクスチャターゲット（`uTextTargetCTA`）を追加
- スクロール位置に応じてHeroターゲット→グリッド→CTAターゲットを切り替え
- CTAセクションのScrollTriggerで`uFormProgress`を0.0→1.0に戻す

**既存コードへの影響:**
- `LandingScene.tsx`: CTAターゲットテクスチャ追加、スクロール連動のターゲット切り替え
- `CTASection.tsx`: Pretext計算追加、LandingSceneとのデータ共有

## 技術的な注意事項

### パフォーマンス
- Pretextの計算は初回のみ（`prepare()`）、以後は`layout()`で0.09ms
- パーティクルのターゲット座標はDataTextureとしてGPUに一度だけ送信
- 既存のパーティクルシステム（150万粒）のフレームレートに影響なし

### バンドルサイズ
- Pretextは数KB（gzip後）
- Three.jsやGSAPと比較して無視できるサイズ

### フォント
- Pretextの`prepare()`はブラウザにフォントがロードされた後に実行する必要がある
- `document.fonts.ready`を待ってから計算

### モバイル対応
- Heroパーティクル: モバイルでは50万粒（既存設定を維持）
- FeaturesSection: モバイルでは1カラムにフォールバック
- テキスト形状のサンプリング密度をモバイルでは下げる

### i18n
- 「LoPo」はロゴなので言語に依存しない
- 「始めよう。」は`t('portal.cta.heading')`で取得 → Pretextで動的に計算
- 英語版では異なるテキスト幅になるが、Pretextが自動的に対応

## ブランチ戦略

1. `main`から`feature/pretext-lp`ブランチを作成
2. 全4セクションを実装
3. `npm run dev`で動作確認
4. ユーザーが採用セクションを決定
5. 不採用セクションのコードを除去してからmainにマージ（または全採用）

## 依存パッケージ

```
npm install @chenglou/pretext
```
