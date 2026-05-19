# LoPo 開発 ToDo

> **維持ルール (必読)**:
> - **100 行以内を目標**に維持 (旧目標 50 → 現実的に 100 に緩和、 ただし可能なら 50 を目指す)
> - 完了タスクは即 [TODO_COMPLETED.md](./TODO_COMPLETED.md) へ移動
> - 大きな設計議論 / 詳細未確定の議題は `docs/.private/YYYY-MM-DD-{topic}.md` に集約
> - 確定済み設計方針は [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md)、 管理者手順は [ADMIN_SETUP.md](./ADMIN_SETUP.md)
> - **セッション終了時に必ず本ファイルの行数を確認 → 超過していたら整理**

---

## 現在の状態 (次セッションはここから読む)

- **ブランチ**: main、 セッション #38 で大規模リファクタ 4 commit 連発、 **push + Vercel デプロイ完了済み**
- **セッション #38 (2026-05-19)**: Phase 2A 検証中に判明した「中身まったく見えない」「タグが長すぎる」 を根本対応
  - (1) **新モーダル本番未反映**: `/housing` の `HousingWorkspace` が旧 `HousingRegisterModal` を import したままだった → `HousingRegisterFormModal` に差し替え
  - (2) **新モーダル CSS 未定義** (初版): overlay / content / header 系クラスが housing.css に無く透明状態 → 一次対応で 121 行追加
  - (3) **panel chrome 統一**: ワークスペース中央パネル (CenterArea を包む `LiquidGlassPanel`) と同じ panel chrome (4 corner highlights + SVG displacement filter + housing-panel-head) を使う共通ラッパー `HousingPanelModal` を新規追加。 `HousingRegisterFormModal` と `FavoritesModal` を全部これでラップ。 backdrop 0.72、 パネル背景 `rgba(8,12,20,0.78)` + border-radius 18px。 確認モーダルは z-index 60 で 2 層重ね
  - (4) **モーダル中身もハウジングトンマナ化**: `.housing-input` / `.housing-textarea` / `.housing-label` / `.housing-register-form` / `.housing-register-form-footer` の form 基礎 CSS が**そもそも未定義**だったため新規追加 (=「中身が見えない」 の主因はこれ)。 select の▼はハニーゴールドで自前描画。 `HousingRegisterDescriptionField` の `text-app-*` を housing 系に置換。 `HousingRegisterTagPicker` は 147 タグ flex-wrap → 選択 chips + 検索 + カテゴリタブ + 高さ固定 200px に再設計 (モーダル縦伸びを止める)。 確認モーダルは `<pre>{JSON.stringify}</pre>` → `<dl>` 構造化表示に整形。 i18n 4 言語に `tag_search_placeholder` / `tag_no_results` / `tag_pick_hint` / `tags` / `room_number` / `parent_house_size` を追加
  - **Playwright 検証 (1920×1080)**: panel chrome 出現 + 中身段が縞状に視認できる + タグピッカー高さ固定で全体コンパクト 確認済み。 細部 (タブ文字 / chips / 検索) は縮小で潰れるため**実機高 DPI 目視必須**
- **積み残し (Phase 2A polish、 次セッションでも可)**:
  - (a) `HousingRegisterView.tsx` の最終撤去 (現在 dead code 状態)
  - (b) AddressFields の `renderBadge` prop 化 (現状 RegisterForm が dc/server/area/ward/plot を inline 再実装)
  - (c) tweet 取得の rate limiting (現状 unlimited)
  - (d) photo `alt` 属性のアクセシビリティ向上 (現状 `alt=""`)
  - (e) 旧 `workspace/HousingRegisterModal.tsx` 撤去 (新モーダルに差し替え済み、 dead code 状態)
  - (f) **確認モーダルの内容整形**: 現状 `<pre>{JSON.stringify(confirmValues, null, 2)}</pre>` で開発用 dump がそのまま出る ([HousingRegisterFormModal.tsx:70-72](src/components/housing/register/HousingRegisterFormModal.tsx#L70-L72))。 ハウジングトンマナで人間用の確認サマリに整形必要
- **次に必要なログイン UX 整備 (別タスク)**: ハウジング画面の登録ボタンは現在「未ログインでも新フォームが直接開く」 状態。 理想形 = (1) Workspace TopBar 右上に「いつも通りのログインボタン」 配置、 (2) ハウジングトンマナ (動画背景 + ガラス + ハニーゴールド) の LoginModal を用意 (現 `LoginModal` は LoPo 白黒風)、 (3) 登録ボタン押下 → 登録モーダルが背後に開く (操作不能) + ログインモーダルが手前にスタック表示。 既存 `LoginModal` の流用可否は実装時に判断。
- **並行進行中**: ユーザー側で「完璧ループの夜景動画」 を毎日試作中
- **注意**: ENFORCE_APP_CHECK=true、 **Vercel 関数 11/12**、 月 100 ビルド

---

## 次セッション最優先: 登録モーダルの **デザイン・体験の大幅見直し**

セッション 38 で「動作する状態」 までは到達 (文字 UI が見える、 サイズボタンが押せる、 isReadyToSubmit が機能)。 ただし**ユーザー本人レビューで「デザイン・体験含めて大幅に直すべき」** と明言。 具体課題:
- ✅ バッジ + 確認ボタンの意味 / 配置が不明瞭 ("勝手にチェック入っていた・押しても変わらない")
- 自動入力 → 手動修正の UX フロー全体の再設計が必要
- モーダルの情報密度・グルーピング・余白
- 確認モーダル (`<dl>` 整形済みだが UX 的に最終ではない)
- 他、 本人が細部を見て指摘した点があれば順次

並行して: ハウジング画面ログイン UX 整備 (TopBar 右上ログインボタン + ハウジング版 LoginModal + 2 層モーダル) も別タスクで残っている。

## 次セッション次優先 (Phase 2A 完了後)

Cloudflare 前段化 (DNS 切替 30 分、 動画 2K 化への布石) → Phase 2B (マップ Figma 書き起こし + 30 軒位置データ + マップクリック登録、 モーダル本体は流用) → Phase 3 (物件詳細ページ + 通報 UI 分離 + 家主異議申し立て + マップ確認モーダル + ツアーリアルタイム同期 = Cloudflare 全面移行が前提)

## 次セッション次優先 (Phase 2 完了後)

Phase 3: 物件詳細ページ (関連登録表示、 `findChambersInPlot` / `findHouseForChamber` / `findApartmentRoomsInWard` 使用) + 通報 UI 分離 (「ちがった」 1 タップ / 「報告」 理由選択) + 家主異議申し立て (「これは私の家です」 → 運営連絡先) + Phase 1 設計書 (2026-05-07) §4.2/§4.3/§6.1/§6.5/§7/§9.3 改訂

---

## ブラッシュアップ後回しリスト (Plan F 完了後に着手、 忘れない)

- お気に入りモーダル ツアービルダー: スプリング / バウンス / カード押しのけアニメ (FLIP layout を sortable と両立させる工夫が必要)
- 「全部回る」 staging のアニメ視認性向上 (現状 700ms で見えづらい)
- × ボタンの反応速度 (現状 0.12s exit でもまだ気になる)
- 「すべて削除」 ボタンの位置 / hover 調整
- マップ bubble の ♡ ホバー時表示 (設計書 §4.4 厳密準拠)
- TopBar トグルの配置 / 見た目調整

**(将来検討) XIVAuth (FF14 キャラ連携)** — ハウジング登録の本人確認に有用、 ただし XIVAuth 自体の安定性を 3-6 ヶ月様子見

**(Phase 2 で着手)** マップ Figma 書き起こし + 30 軒位置データ + マップクリック登録 + 個室・アパート問題 (`docs/.private/2026-05-17-housing-room-types-design.md`)

---

## 相談したい (次セッションで着手検討)

- **SEO レベル 2**: LP の Hero サブタイトル・カード説明に日本語キーワード。 デザイン変更伴うため英語ミニマリスト美学との両立を相談
- **SEO 効果計測**: Search Console 未導入。 導入すれば実流入キーワードを把握可

---

## 既知の残課題 (中規模、 別セッションで設計から)

- **同期不安定** (2026-04-29): 軽減配置→タブ閉→別端末で消失等の複合症状。 対応案: sendBeacon / `syncDirtyPlans` 競合判定 / PULL バージョン番号
- **ローカル削除→即同期で復活** (2026-04-28): `deletePlan` が `ownerId === 'local'` で `_deletedPlanIds` 漏れ。 Plan v4 `_createdLoggedIn` 後の再評価必要
- **EventModal 計算肥大**: `handleCalculate` 分割 + calculator.ts と共通化
- **CRIT 倍率ステータス連動**: `CRIT_MULTIPLIER` 固定 → `getCritMultiplier(level)` + IL 切替 UI
- **Timeline 描画 120FPS** (2026-05-14): 要素多いと 8.33ms 超え。 DevTools プロファイル / `will-change` / 仮想スクロール / RAF throttle

---

## バグ・不具合 (要修正)

- **中**: ラベル名が管理画面で取得できない (スプシヘッダー問題?)
- **低 (動作影響なし)**: FFLogs インポート英語ログ / 無敵反映 / オートプラン同一技 / パルス設定スライダー初期位置 / ヘッダー縦罫線サブピクセル
- **Phase 2 follow-up (優先度低)**: api/popular の `viewCount` 削除 / en/ko privacy_section1_auto_items の bullet 分割バグ / `MitigationSheet.copyPlan` の POST 失敗時 localStorage 残留

---

## 未着手・将来計画

- 多言語: ハウジング言語対応 / AA 名統一
- UI/モバイル: モーダルアニメ / スマホ・タブレット最適化 / SVG アイコンアニメ / 紹介 PV
- インフラ: shared_plans クリーンアップ / CSP unsafe-inline 除去 / Sentry / 認証プライバシー
- 新機能: Floating Timeline (Tauri v2) / FFLogs 精度 / SA 法改善 / 詠唱バー注釈 / public/icons/ 削除
- ハウジング: 背景動画の画面サイズ別出し分け (`<source media>` で大画面に 2K、 帯域節約。 素材は 2560×1440 で既にあり)
- インフラ: **Cloudflare を Vercel の前段に置く** (無料 / 帯域無制限化) → これ実装すれば動画を高画質 (2K) や無加工美麗版にしても Vercel 帯域は消費されない。 DNS を Cloudflare に切替 + キャッシュルール設定で完了 (30 分作業)
- デッドコード: Lenis (`useSmoothScroll.ts` + テスト + `data-lenis-prevent` 属性 + 依存) 削除でバンドル減

---

## アイデア / プロジェクト方針 / 並行 / バックログ

- アイデア: YouTube 埋込/導線、 こだわりトップ、 配置アニメ、 OCR、 横型タイムライン、 Gemma AI
- 方針: コンテンツ追加 = `add-content` → `seed-contents.ts`、 スキル正本 = Firestore、 SNS ハッシュタグ `#LoPo #FF14 #BuildInPublic #AISelection`
- 並行: マイコラージュ (収益化、 優先) / ハウジングは MUL 対象外で広告 OK (memory `project_lopo_mul_constraint.md`)
- バックログ: npm audit / a11y / SE 利用規約 / GDPR / SEO / FFLogs アイコン / MTST 分け / フェーズスペース / みんなの軽減表

<!-- When compacting, always preserve: 現在のタスク、変更中のファイルパス、本ファイルの「現在の状態」セクション -->
