# ハウジング お気に入りページ + 質感土台A案 設計書 (2026-07-01)

> 第2スパン。ブランチ = `feat/housing-rebuild-foundation-browse` の続き。
> 正典ビジュアル = 参考UI画像3 (`C:/Users/masay/Downloads/HousingTour_theme/…23_06_55 (3).png` = お気に入り)。
> 質感 = 現モックアップから「参考UIへ寄せる」方向へA案更新 (ユーザー承認済 2026-07-01)。
> ユーザーは本書を読まない。実画面で確認する。本書はClaudeの道しるべ。

## ゴール
1. **質感土台A案** を先に「探す」ページに適用し、実画面で確認できる状態にする。
2. その落ち着いた土台の上に **お気に入りページ** (`/housing/favorites`) を新規実装する。
3. 完成時、「探す」「お気に入り」の2枚がトンマナ一致し、参考UIの洗練度に近づく。

---

## パートA — 質感土台A案 (全ページ共通・先に探すへ適用)

### 意図
参考UIが読みやすいのは「フラットで落ち着いた濃紺の面の上にコンテンツが乗る」から。現状は
`LiquidGlassPanel` (SVG変位 edge160/scale49) + `SceneryVideo` が主張し、一覧の視認性を食う。
**世界観 (動画背景 + ハニーゴールド) は署名として残す**が、後退させて主役をコンテンツにする。

### 変更点 (housing.css のトークン中心・ハードコード禁止)
1. **動画背景を後退**: `SceneryVideo` の上に載る暗幕 (scrim) を濃くする。既存 scrim トークンを引き上げる or 新規 `--housing-scene-scrim` を追加。動画は「薄く効くアンビエント」に。
2. **パネルのグラスを弱める**: `LiquidGlassPanel` の変位・光沢を弱め、面をより不透明・落ち着いた濃紺へ。
   - 対応方針: BrowsePage 等が使う `LiquidGlassPanel` の `scale`/`edge` を下げる or パネル背景トークン
     (`--housing-panel-bg` 系) の不透明度を上げる。**どちらで達成するかは実装時に現CSSを読んで決定** (憶測しない)。
   - 目標: 参考UI級に本文テキストが読めるコントラスト。ガラスは「縁 + わずかな透け」程度。
3. **2アクセント体系を明文化**: **ハニー = 主アクション** (ツアー開始 / 公開する / ロゴ / アクティブタブ)、
   **青 = 選択・進行・リンク** (チェック選択 / 進捗リング / ステップ番号)。参考UIと一致。既存トークンで表現。

### 適用範囲と検証
- まず「探す」(`BrowsePage`) に適用 → 実画面でユーザー確認 (声かけ)。
- OK後、お気に入りページは最初からこの土台で組む。
- ルール整合: `housing-design.md` の「モックアップが質感の正典」から**意図的に外れる**変更。承認済につき、
  実装後に `housing-design.md` の質感条項へ「A案 = 参考UI寄せ (glass弱め + scrim強め + 2アクセント)」を追記する。

---

## パートB — お気に入りページ (`/housing/favorites`)

### ルート / シェル
- 既存 `HousingShell` の `<Outlet/>` 子ルートとして `FavoritesPage` を追加 (探すと同じ枠組み)。
- タブバー (`TabBar`) の「お気に入り」を `ComingSoonPage` から `FavoritesPage` に差し替え。

### レイアウト (3カラム・参考UI画像3準拠)
```
[左 240px]          [中央 flex]                        [右 320px]
はじめての方へ       ヘッダー: お気に入り (N件) + 並び替え   ツアートレイ
 1 保存する          タブ: すべて / 最近追加                 推定時間 (暫定)
 2 選択する          一括バー: すべて選択/選択解除/           ルートを最適化 (暫定/後日)
 3 ツアー化する       すべてツアー追加/選択だけ追加/外す        番号付きリスト (削除/DnD)
ワンポイント          グリッド: FavoriteGridCard[]             選択した家でツアー開始
広告枠(最小・予約)     ページネーション                        下書きとして保存
                                                            広告枠(最小・予約)
```

### コンポーネント設計 (小さく・単一責務)
- **`FavoritesPage`** (pages/): データ取得 (favorites store × listings store) + 3カラム構成 + 状態
  (選択 Set / トレイ ids / タブ / ページ) のオーケストレーション。
- **`FavoritesOnboarding`** (favorites/): 左「はじめての方へ」3ステップ (教育のみ・✅進捗ではない = [[feedback_form_ux_progress]] 遵守)。
- **`FavoritesGrid`** (favorites/): 中央グリッド。`FavoriteGridCard` を並べる。空状態を持つ。
- **`FavoriteGridCard`** (favorites/): `ListingCard` にチェックボックス選択を足した派生。
  - **再利用方針**: `ListingCard` を拡張 (optional `selectable`/`selected`/`onToggleSelect` props) して1本化するのが望ましい。
    実装時に ListingCard を読み、破壊せず prop 追加で対応 (探すページの見た目は不変を保証)。
- **`FavoritesBulkBar`** (favorites/): 一括アクション行 (すべて選択 / 選択解除 / すべてツアー追加 / 選択だけ追加 / お気に入りから外す)。
- **`FavoritesTabs`** (favorites/): すべて / 最近追加 の2タブ。
- **右トレイ**: 既存 `TourTray` (browse/) を昇格して共有。番号 + 削除 + 開始は既存済。
  - 推定時間・ルート最適化・下書き保存は**枠 + 暫定表示**のみ (実距離/最適化は M2)。
    まず「選択した家でツアー開始」を確実に配線。

### インタラクション (確定方針)
- **選択とトレイは別物**: チェック = 一時的な複数選択。トレイへは**明示ボタン**でのみ入る
  (選択だけ追加 / すべて追加 / カードの+ボタン)。既存 FavoritesModal の意図的設計を踏襲
  (`FavoritesModal.tsx:203-207`「click-selecting … does NOT bleed into the tour builder」)。
- **選択手段**: チェックボックス (主・初心者向け明示)。既存の Ctrl/Shift/マーキー選択ロジック
  (`FavoritesListPane` / `useMarqueeSelection`) は温存可なら再利用、コスト高ければチェックボックス優先で後日。
- **重複自動追加**: トレイ投入時に §3.8 `expandTourWithDuplicates` を通す (既存踏襲・1トースト通知)。
- **ツアー開始**: `setListings(trayIds) → start() → enterTourMode() → navigate('/housing/tour')` (BrowsePage と同一)。
  マナー通知 (`MannerNoticeDialog`) は既存踏襲で挟む。

### タブのデータ根拠 (確認済)
- `useHousingFavoritesStore` = `ids: string[]` (localStorage・timestamp無し)。
- **すべて** = ids を住所ソート (`sortByAddress`) 表示。**最近追加** = ids 逆順 (add で末尾 push のため)。
- **コレクション / ツアー候補** = データモデル未実装 → **今回出さない** (将来スパン)。

### 広告 (確定 = 最小の予約枠)
- 左・右に `AdSlot` を最小で予約 (探すと同じ)。将来収入余地を確保、今は場所取りのみ。

---

## i18n
- 新規文言は `housing.favorites.*` 名前空間で ja/en/ko/zh の4言語 parity 必須 ([[feedback_locale_json_textual_edit]] = 該当ブロックのみ textual 編集)。
- 既存 `housing.workspace.favorites.*` の流用可能キーは再利用。

## テスト
- `FavoritesPage`: 空状態 / 選択→一括バー活性 / 選択だけ追加でトレイに入る / タブ切替で並び変わる / 開始で store 反映。
- `FavoriteGridCard` (or 拡張 ListingCard): 選択トグル・♡トグルが独立して動く。
- 回帰: 探すページの `ListingCard` 見た目・挙動が不変 (prop 追加の非破壊)。
- build (`npm run build`) + vitest 緑、ハードコード grep 監査 (rgb/rgba/#hex/px) クリア。

## 非目標 (YAGNI・今回やらない)
- 実ルート距離計算 / 効率スコア / ルート最適化の本実装 (= M2 ツアーを組む)。
- コレクション / ツアー候補タブ。
- 生きたカード段階2 (動画 spotlight)。
- スマホ対応 (= M6)。PCレイアウト先行。

## 完了の定義
- `/housing/favorites` が参考UI相当の3カラムで立ち、実お気に入りデータで選択→トレイ→ツアー開始まで通る。
- 「探す」「お気に入り」の質感がA案で一致し、実画面でユーザーOK。
- merge はまだしない (登録ページ完成まで保留 = TODO の既定方針)。
