# LoPo 開発 ToDo

> **維持ルール (必読)**:
> - **100 行以内を目標**に維持 (旧目標 50 → 現実的に 100 に緩和、 ただし可能なら 50 を目指す)
> - 完了タスクは即 [TODO_COMPLETED.md](./TODO_COMPLETED.md) へ移動
> - 大きな設計議論 / 詳細未確定の議題は `docs/.private/YYYY-MM-DD-{topic}.md` に集約
> - 確定済み設計方針は [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md)、 管理者手順は [ADMIN_SETUP.md](./ADMIN_SETUP.md)
> - **セッション終了時に必ず本ファイルの行数を確認 → 超過していたら整理**

---

## 現在の状態 (次セッションはここから読む)

- **ブランチ**: main、 push 済 (origin と同期)
- **最新本番デプロイ**: セッション 31 (2026-05-18) で Plan B 補強 + D + E + 実機 iterate を含む 9 commits push、 Vercel 自動デプロイ中
- **注意**: ENFORCE_APP_CHECK=true、 **Vercel 関数 10/12**、 月 100 ビルド (今日 9 消費 → 残り 91)
- **セッション 31 成果 (2026-05-18)**:
  - **Plan B バグ修正**: TopBar に左右パネルトグル (lucide PanelLeftClose/Open、 ツアー中右トグル disabled、 設計書 §3.3 追記)
  - **Plan D 完成**: useAutoScroll + RightPanelListItem + AutoScrollList + ShareTourButton + TourKeyboardController (Enter/Space/Arrow) + TourProgressList (scrollIntoView) + RightPanel (mode 切替)
  - **Plan E 完成**: sortByAddress + useMarqueeSelection + FavoriteCard + FavoritesListPane (Shift/Ctrl/矩形) + TourBuilderPane + MannerNoticeDialog + FavoritesModal (92vw × 88vh) + ♡ overlay を中央カード/マップ bubble に追加 + 左→右 DnD (DndContext を modal level、 prefix id 衝突回避、 DragOverlay + snapCenterToCursor)
  - **iterate 対応**: marquee 発動エリア拡大 (ignoreSelector) + 「全部回る」 staging アニメ + autoScroll=false + motion.div layout 削除 (sortable 衝突解消) + 「すべて削除」 ボタン + exit duration 短縮
  - i18n: housing.workspace.{tour, favorites, tour_builder, manner, panels.right_title_tour} を 4 言語追加
  - housing.css に Plan D/E 用 class 計 50+ 追加 (すべて既存 token 経由、 ハードコード zero)
  - **820 tests pass** (Session 30 から +49)、 production build OK
- **新ルール (物理ファイル反映済)**: `/housing` 配下は LoPo 既存 UI デザイン制約 (白黒のみ / Inter 禁止 / honey 色禁止) **対象外**。 `.claude/rules/housing-design.md` がトリガー
- **方針**: 1 ページ完結 Adaptive Workspace。 マップは Phase 2 で本実装。 iterate-first

---

## 次セッション最優先: Plan F (Finishing) 着手

セッション 31 でユーザー実機確認済、 基本動作 OK。 細かいブラッシュアップは Plan F 完了後にまとめて対応する合意。

**Plan F スコープ** (`docs/superpowers/plans/2026-05-18-housing-sub-spec-2b-plan-f-finishing.md`):
- 登録モーダル接続 (現状は legacy hash route)
- ルーティング (`/housing/p/{id}` / `/housing/tour/{id}` の着地時挙動)
- a11y 仕上げ + reduced-motion 対応
- Playwright E2E (パネル開閉 / フィルタ / マップ↔Pinterest / ツアー実行など §13.3 全網羅)
- 親仕様 (`2026-05-07-housing-tour-phase1-design.md`) §7-11 改訂

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
- デッドコード: Lenis (`useSmoothScroll.ts` + テスト + `data-lenis-prevent` 属性 + 依存) 削除でバンドル減

---

## アイデア / プロジェクト方針 / 並行 / バックログ

- アイデア: YouTube 埋込/導線、 こだわりトップ、 配置アニメ、 OCR、 横型タイムライン、 Gemma AI
- 方針: コンテンツ追加 = `add-content` → `seed-contents.ts`、 スキル正本 = Firestore、 SNS ハッシュタグ `#LoPo #FF14 #BuildInPublic #AISelection`
- 並行: マイコラージュ (収益化、 優先) / ハウジングは MUL 対象外で広告 OK (memory `project_lopo_mul_constraint.md`)
- バックログ: npm audit / a11y / SE 利用規約 / GDPR / SEO / FFLogs アイコン / MTST 分け / フェーズスペース / みんなの軽減表

<!-- When compacting, always preserve: 現在のタスク、変更中のファイルパス、本ファイルの「現在の状態」セクション -->
