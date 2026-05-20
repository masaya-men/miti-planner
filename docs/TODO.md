# LoPo 開発 ToDo

> **維持ルール (必読)**:
> - **100 行以内を目標**に維持
> - 完了タスクは即 [TODO_COMPLETED.md](./TODO_COMPLETED.md) へ移動
> - 大きな設計議論 / 詳細未確定の議題は `docs/.private/YYYY-MM-DD-{topic}.md` に集約
> - 確定済み設計方針は [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md)、 管理者手順は [ADMIN_SETUP.md](./ADMIN_SETUP.md)
> - **セッション終了時に必ず本ファイルの行数を確認 → 超過していたら整理**

---

## 現在の状態 (次セッションはここから読む)

- **ブランチ**: main、 セッション #45 (2026-05-21) で **Phase 3 plan 作成 + Group A/B 実装まで完了**。 push 未、 **ローカルコミット 9 本残** (前回 3 本 + 今回 6 本)
- **完了 (#45)**: Phase 3 plan を `docs/superpowers/plans/2026-05-21-housing-phase3-plan.md` に作成 (25 タスク、 6 commit グループ構成)。 Group A (基盤: 型 + Rules + i18n) + Group B (編集削除: API 2 本 + Modal/Confirm/Kebab UI) を実装、 全テスト 47/47 pass、 build OK
- **方針確定 (#45)**: spec §2.1 の Intercepting Routes は本プロジェクト (Vite SPA) では使えないため **react-router background-location パターン**で代替。 `deletedAt` (家主削除) と `isHidden` (運営非表示) は役割分離。 API テストは見送り (既存パターンなし)、 React 側は TDD で網羅
- **注意**: Rules の deletedAt 改竄防止 fix を追加済 (commit c7cdf25)。 Firestore Rules はまだデプロイ未 (Group F の Task 23 で実施予定)
- **注意**: vitest pool='vmThreads' のまま (変更厳禁)
- **注意**: ENFORCE_APP_CHECK=true、 **Vercel 関数 11/12**、 月 100 ビルド

---

## 次セッション最優先: Phase 3 残り (Group C/D/E/F)

**最初のコマンド (コピペ)**:
> `docs/superpowers/plans/2026-05-21-housing-phase3-plan.md` を読んで、 subagent-driven-development で Group C 以降を実装。 ローカルコミット 9 本残ってるので最後に push + Vercel デプロイ + Firestore Rules デプロイまでセット。

進捗 (plan の Task 番号):
- ✅ Group A: Task 1-3 + 10 (基盤・型・Rules・i18n)
- ✅ Group B: Task 4-9 (編集/削除 API + UI)
- ⏳ Group C: Task 11-14 (詳細表示: DetailContent / Modal / Layout / ActionBar / PhotoGallery / ShareButton + background-location ルート)
- ⏳ Group D: Task 17-18 (通知 API 2 本 + Bell / Dropdown / Item / useNotifications)
- ⏳ Group E: Task 15-16 + 19 (通報 API + ReportModal + ReportGuideModal + 通知遷移時の自動オープン)
- ⏳ Group F: Task 20-25 (動作確認 + tsc/build + Firestore Rules デプロイ + push + Vercel デプロイ)

### Phase 3 残り (今回スコープ外、 plan 完了後別セッション)

- ツアー同期 Firestore 化 (TODO 旧 4)
- Cloudflare 前段化 (TODO 旧 5)
- 細かい修正: `fieldState.confirm()` バグ、 旧 dead code 撤去、 AddressFields renderBadge prop 化、 tweet 取得 rate limiting、 photo `alt` 属性、 SNS rate limiting (TODO 旧 6)
- 30 日後物理削除 cron、 異議申し立てアプリ内 UI、 nsfw/griefing 管理者通知

### 後回し (Phase 2B、 マップ着手時)

- マップ Figma 書き起こし (道中央線 + 交差点ノード)、 30 軒位置データ、 マップクリック登録、 ノード/エッジオーサリングツール (5 時間程度の地道作業)

### UI 整え時にまとめて対応

- TopBar ログイン/アバター サイズ違い、 未ログイン登録モーダル背低違和感、 登録モーダル UX 磨き、 ✅ バッジ警告色化、 お気に入りモーダル ツアービルダー アニメ、 ハウジング i18n の en/ko/zh 翻訳追加 (ja のみ先行)、 スマホ最適化、 **(将来検討)** XIVAuth

---

## 相談したい

- **SEO レベル 2**: LP の Hero サブタイトル・カード説明に日本語キーワード (デザインとの両立相談)
- **SEO 効果計測**: Search Console 未導入

---

## 既知の残課題 (中規模、 別セッションで設計から)

- **同期不安定** (2026-04-29): 軽減配置→タブ閉→別端末で消失等の複合症状
- **ローカル削除→即同期で復活** (2026-04-28): `deletePlan` の `_deletedPlanIds` 漏れ
- **EventModal 計算肥大**: `handleCalculate` 分割 + calculator.ts と共通化
- **CRIT 倍率ステータス連動**: `getCritMultiplier(level)` + IL 切替 UI
- **Timeline 描画 120FPS** (2026-05-14): 要素多いと 8.33ms 超え

---

## バグ・不具合 (要修正)

- **中**: ラベル名が管理画面で取得できない (スプシヘッダー問題?)
- **低 (動作影響なし)**: FFLogs 英語ログ / 無敵反映 / オートプラン同一技 / パルス設定スライダー / ヘッダー縦罫線
- **Phase 2 follow-up**: api/popular の `viewCount` 削除 / en/ko privacy_section1_auto_items bullet バグ / `MitigationSheet.copyPlan` POST 失敗時 localStorage 残留

---

## 未着手・将来計画

- 多言語: ハウジング言語対応 / AA 名統一
- UI/モバイル: モーダルアニメ / スマホ・タブレット最適化 / SVG アイコンアニメ / 紹介 PV
- インフラ: shared_plans クリーンアップ / CSP unsafe-inline / Sentry / Cloudflare 前段 / 認証プライバシー (← Step 1 完了で大幅前進)
- 新機能: Floating Timeline (Tauri v2) / FFLogs 精度 / SA 法改善 / 詠唱バー注釈 / public/icons/ 削除
- デッドコード: Lenis (`useSmoothScroll.ts`) 削除でバンドル減 / ハウジング背景動画の画面サイズ別出し分け

---

## アイデア / プロジェクト方針 / 並行 / バックログ

- アイデア: YouTube 埋込/導線、 こだわりトップ、 配置アニメ、 OCR、 横型タイムライン、 Gemma AI
- 方針: コンテンツ追加 = `add-content` → `seed-contents.ts`、 スキル正本 = Firestore、 SNS ハッシュタグ `#LoPo #FF14 #BuildInPublic #AISelection`
- 並行: マイコラージュ (収益化、 優先) / ハウジングは MUL 対象外で広告 OK (memory `project_lopo_mul_constraint.md`)
- バックログ: npm audit / a11y / SE 利用規約 / GDPR / SEO / FFLogs アイコン / MTST 分け / みんなの軽減表
<!-- When compacting, always preserve: 現在のタスク、変更中のファイルパス、本ファイルの「現在の状態」セクション -->
