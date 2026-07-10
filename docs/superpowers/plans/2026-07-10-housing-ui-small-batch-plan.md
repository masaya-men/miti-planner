# ハウジング小物UI束 実装計画 (フッター刷新 + リップル + 通知トンマナ点検)

> 2026-07-10 全体相談で確定。独立した 3 タスク。1 件ずつ実装 → ユーザーがローカル目視 → 次へ。
> `/housing` 配下 = housing-design.md 準拠 (色/寸法トークン必須・色付き alert 箱/装飾ピル禁止)。

## Task 1: フッター (StatusBar) 刷新

- 対象: `src/components/housing/workspace/StatusBar.tsx` (+ `src/styles/housing.css` の `.housing-status` 系)
- 現状: 左 = BUILD SHA / LAT 31.41・LON 22.07 (固定ダミー) / THEME、右 = STOPS 0/7 (ダミー) / FPS 60 (ダミー) / 言語。
- **確定仕様**:
  - 残す: テーマ表示 (右) / 言語スイッチャー JA EN KO ZH (右)
  - 消す: BUILD 表示 / LAT・LON / STOPS / FPS
  - 左に置く: `© 2026 LoPo` + プライバシーポリシー (`/privacy`) + 利用規約 (`/terms`) + Ko-fi リンク
- 実装詳細:
  - BUILD SHA は UI から消すが**診断価値を残す**: housing シェル起動時に `console.info('[housing] build', __HOUSING_BUILD__)`
    を 1 回出す (PWA 新旧バンドル判別の現地計器だった経緯が StatusBar.tsx:6-9 コメントにある)。
  - `/privacy` `/terms` は既存ルート (`src/App.tsx:120-121`)。ハウジングから離脱してツアー状態を失わないよう
    **新しいタブで開く** (`target="_blank" rel="noopener"`)。
  - Ko-fi URL は `src/components/SupportPage.tsx:10` に `https://ko-fi.com/lopoly` がハードコード済み。
    **共有定数に昇格** (例 `src/constants/external.ts` の `KOFI_URL`) し、SupportPage と StatusBar の両方が参照。
  - 文言は i18n キー (4 言語): コピーライトは `© 2026 LoPo` 固定表記で可 (キー化は年の更新を考え
    `housing.workspace.statusbar.copyright` に西暦を埋め込まず動的年 or 定数)。リンクラベルは
    既存の legal 系キーがあれば流用、なければ新設。
  - 不要になった statusbar キー (build_label/lat_label/lon_label/stops_label/fps_label) を 4 言語から削除。
  - レイアウトは現行の `.housing-status` 2 グループ構造を維持 (余白リズム・ヘアライントーン)。
- 検証: 4 言語で折返し崩れなし / light・dark 両テーマ / リンク新規タブ / console に build 出力。

## Task 2: クリックリップル (「ツアーに追加」+「あなたの作品を登録する」)

- 対象ボタン:
  - `src/components/housing/browse/ListingCard.tsx` の「ツアーに追加」ボタン
  - `src/components/housing/workspace/RegisterCTA.tsx` の「あなたの作品を登録する」ボタン
- 実装: 共有フック `useRipple` (または `RippleButton`) を housing 配下の共有場所に新設。
  ユーザー提供サンプル (クリック座標から円が scale(0)→scale(3)・0.6s ease-out で拡散消滅、
  ripples 配列 state + 650ms 後に掃除) をベースにする。変更点:
  - **色はハードコード禁止**: `rgba(255,138,0,0.4)` は使わず、`src/styles/housing.css` の
    `.housing-workspace` トークン群に `--housing-ripple` (ハニー系の alpha 変種) を新設して参照。
  - `@keyframes` と `.ripple` CSS も housing.css に置く (コンポーネント内 style タグ禁止)。
  - `prefers-reduced-motion: reduce` ではリップル自体を生成しない。
  - ボタンに `position: relative; overflow: hidden` が必要 → 既存の影/focus ring/角丸を壊さないか
    実機で確認 (特に ListingCard のボタンは枠線スタイル)。
  - アンマウント時に残タイマーで setState しない (cleanup or ref ガード)。
- テスト: フック単体 (クリックで ripple 追加 → 時間経過で除去 / reduced-motion で生成なし)。
  見た目は実機目視 (ユーザー画面 DPR 2.58)。

## Task 3: 通知 UI のトンマナ点検 (質感A案追従)

- 対象: `src/components/housing/notifications/` の
  `NotificationBell.tsx` / `NotificationDropdown.tsx` / `NotificationItem.tsx` と、
  通知から遷移して内容を見る画面 (reason 別ガイド表示・`useHousingDetail.ts` 経由の詳細側表示)。
- 点検チェックリスト (housing-design.md「質感A案」):
  1. パネル面が `--housing-panel-bg` 系の濃紺フラットか (旧・透けすぎガラスが残っていないか)
  2. 色付き alert 箱 (色地 + 左縦線) を使っていないか → ヘアライン + `--housing-text-mute` の静かな注記へ
  3. 装飾 999px ピル / honey gradient / 過剰 glow がないか (機能要素のバッジ・未読ドットは維持)
  4. 縦積み要素の余白が 0px 密着していないか (コンテナ gap で統一リズム)
  5. 色/font-size/影のハードコードがないか (`rgb(` `rgba(` `#hex` `px;` を該当ファイルで grep)
  6. ハニー = 主アクション / 青 = 選択・進行 の 2 アクセント体系に反していないか
- 進め方: まず**現状スクショを撮って逸脱箇所を列挙 → ユーザーに見せて合意 → 修正**
  (見た目の変更なので勝手に直さない)。逸脱ゼロなら「点検済み・変更なし」で完了報告。
- root 直下に出すモーダルがあるなら `--housing-*` トークン定義セレクタへの追加漏れに注意
  (memory `reference_housing_root_modal_tokens`)。

## 受け入れ基準

- フッター: ダミー数値が消え、法的リンク + Ko-fi + © が 4 言語・両テーマで自然に収まる。
- リップル: 2 ボタンで発火・多連打でも破綻なし・reduced-motion で無効・トークン経由の色。
- 通知: チェックリスト 6 項目すべて「適合」または「修正済み」。

## やらないこと

- StatusBar への新機能追加 (Stops 実数化など) — ダミーの削除のみ
- リップルの全ボタン展開 (指名された 2 箇所のみ。評判が良ければ別途)
- 通知の機能変更 (既読/削除ロジック等はトンマナのみ)
