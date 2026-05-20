# LoPo 開発 ToDo

> **維持ルール (必読)**:
> - **100 行以内を目標**に維持
> - 完了タスクは即 [TODO_COMPLETED.md](./TODO_COMPLETED.md) へ移動
> - 大きな設計議論 / 詳細未確定の議題は `docs/.private/YYYY-MM-DD-{topic}.md` に集約
> - 確定済み設計方針は [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md)、 管理者手順は [ADMIN_SETUP.md](./ADMIN_SETUP.md)
> - **セッション終了時に必ず本ファイルの行数を確認 → 超過していたら整理**

---

## 現在の状態 (次セッションはここから読む)

- **ブランチ**: main、 セッション #44 (2026-05-21) で **Phase 3 設計確定 + spec 完成** (plan / 実装は次セッション)
- **完了 (#44)**: ハウジング Phase 3 (家主編集削除・物件詳細表示・通報フロー) を業界水準準拠で設計。 spec を `docs/superpowers/specs/2026-05-20-housing-phase3-design.md` に記録。 ローカルコミット 2 本残し (push 未)
- **方針確定 (#44)**: 動く骨組み優先、 業界水準は必ず守る、 UI 細部磨きは別フェーズ。 詳細モーダルは Intercepting Routes、 通報は reason 5 択 + reason 別ガイド、 通知は TopBar bell + ドロップダウン、 削除は soft delete
- **注意**: 本人の avatar.webp + team-logo.jpg が前回 migration バグで Storage 消失 → HousingAccountModal の avatar 編集 UI 経由で再アップロード可能
- **注意**: vitest pool='vmThreads' に再採用 (Node v24 で forks 動作不可、 memory `reference_vitest_pool_firebase.md` 更新済)。 全テスト並列実行はハング懸念、 個別ファイル run で対応
- **注意**: ENFORCE_APP_CHECK=true、 **Vercel 関数 11/12**、 月 100 ビルド

---

## 次セッション最優先: Phase 3 plan 作成 + 実装

**最初のコマンド (コピペ)**:
> `docs/superpowers/specs/2026-05-20-housing-phase3-design.md` を読んで、 writing-plans skill で plan を `docs/superpowers/plans/2026-05-21-housing-phase3-plan.md` に書いて。 ローカルコミット 2 本残ってるので忘れず push もセットで。

実装順序 (spec §10 より):
1. **基盤**: 型追加 (`HousingListing.deletedAt`, `HousingNotification`) + Firestore Rules + 一覧クエリ `deletedAt == null` フィルタ
2. **Sub-spec 3-A 編集削除**: update/delete API + HousingEditModal (登録モーダル拡張) + DeleteConfirm + Kebab
3. **Sub-spec 3-B 詳細表示**: DetailContent / Modal / Layout + Intercepting Routes + ActionBar / PhotoGallery / ShareButton + OGP
4. **Sub-spec 3-C 通報フロー**: report API + ReportModal + 通知 API 2 本 + NotificationBell / Dropdown + ReportGuideModal
5. i18n (ja 先行)、 動作確認、 まとめてコミット 5-7 本 + push + デプロイ

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
