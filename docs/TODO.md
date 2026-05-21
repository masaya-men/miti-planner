# LoPo 開発 ToDo

> **維持ルール (必読)**:
> - **100 行以内を目標**に維持
> - 完了タスクは即 [TODO_COMPLETED.md](./TODO_COMPLETED.md) へ移動
> - 大きな設計議論 / 詳細未確定の議題は `docs/.private/YYYY-MM-DD-{topic}.md` に集約
> - 確定済み設計方針は [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md)、 管理者手順は [ADMIN_SETUP.md](./ADMIN_SETUP.md)
> - **セッション終了時に必ず本ファイルの行数を確認 → 超過していたら整理**

---

## 現在の状態 (次セッションはここから読む)

- **ブランチ**: main、 セッション #46 (2026-05-21) で **Phase 3 を全実装完了** (Group C/D/E/F)。 Firestore Rules デプロイ済、 push + Vercel デプロイ実施
- **完了 (#46)**: Group C 詳細表示 (DetailContent/Modal/Layout/Page/ActionBar/PhotoGallery/ShareButton + background-location ルート、 旧 inline expand 廃止) / Group D 通報フロー (report API + ReportModal + GuideModal) + 通知 (list/mark-read API + Bell/Dropdown/Item/useNotifications) / ActionBar→ReportModal 接続 fix / 既存 CenterArea・routes テストを新遷移仕様に追従 / Firestore Rules デプロイ (`firebase deploy --only firestore:rules` 成功)。 housing テスト 325 pass / 0 fail、 build + tsc OK
- **方針確定**: Intercepting Routes は Vite SPA で不可 → **react-router background-location パターン**で代替。 `deletedAt` (家主削除) と `isHidden` (運営非表示) は役割分離。 API テストは見送り (既存パターンなし)、 React 側は TDD で網羅
- **動く骨組みの注意**: 詳細表示は **Firestore から id で fetch する設計**。 一覧は MockListing (mock データ) なのでカードから飛ぶと Firestore に該当 doc が無く「Not found」 (= 背景に戻る) になる。 実データ連携は次フェーズ。 編集/削除/通報/通知は実 Firestore doc があれば動作
- **未確認 (次セッションで実機確認推奨)**: 通報→通知ベル→reason 別ガイド→編集/削除 の E2E フロー (Task 21 のブラウザ手動確認は未実施)
- **注意**: vitest 全 suite は firebase appcheck の teardown でハングする既知の環境問題あり (テスト自体は pass)。 vitest pool='vmThreads' のまま (変更厳禁)
- **注意**: ENFORCE_APP_CHECK=true、 新ハンドラ 3 本は `api/housing/index.ts` の action ルーティング経由なので **Vercel 関数本数は増えない** (9 関数のまま)、 月 100 ビルド

---

## 次セッション最優先: Phase 3 実機確認 + 実データ連携

**最初のコマンド (コピペ)**:
> `docs/TODO.md` を読んで。 Phase 3 (詳細表示・編集削除・通報・通知) は実装完了済。 まず Task 21 のブラウザ手動確認 (通報→通知ベル→ガイド→編集/削除 の E2E) を実機でやって、 次に一覧の MockListing → 実 Firestore 連携を検討。

### Phase 3 残り (実装完了後の積み残し)

- **実機 E2E 確認** (最優先): 通報→通知ベル→reason 別ガイド→編集/削除 フロー。 2 アカウント必要 (家主 + 通報者)
- **一覧の実データ連携**: 現状一覧は MockListing。 詳細/編集/削除/通報は実 Firestore doc 前提なので、 一覧を Firestore listing に繋ぐと全フロー実動する
- **HousingCardExpanded 撤去判断**: inline expand 廃止で未使用化。 完全削除して良いか確認
- ツアー同期 Firestore 化 / Cloudflare 前段化
- 細かい修正: `fieldState.confirm()` バグ、 旧 dead code 撤去、 AddressFields renderBadge prop 化、 tweet 取得 rate limiting、 photo `alt` 属性、 SNS rate limiting
- 30 日後物理削除 cron、 異議申し立てアプリ内 UI、 nsfw/griefing 管理者通知
- ハウジング i18n の en/ko/zh 翻訳 (現状 ja 値コピー)

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
