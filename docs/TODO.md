# LoPo 開発 ToDo

> **維持ルール (必読)**:
> - **100 行以内を目標**に維持
> - 完了タスクは即 [TODO_COMPLETED.md](./TODO_COMPLETED.md) へ移動
> - 大きな設計議論 / 詳細未確定の議題は `docs/.private/YYYY-MM-DD-{topic}.md` に集約
> - 確定済み設計方針は [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md)、 管理者手順は [ADMIN_SETUP.md](./ADMIN_SETUP.md)
> - **セッション終了時に必ず本ファイルの行数を確認 → 超過していたら整理**

---

## 現在の状態 (次セッションはここから読む)

- **ブランチ**: main、 セッション #43 (2026-05-20) で **ハウジング ログイン UI 整備の修正完了** (経路 B フロー修正 + 文言改善)
- **完了 (#42)**: ハウジング ログイン UI 6 項目 (戦略 B: housing 専用 UI + hook 共通化)
- **完了 (#43)**: 経路 B (登録モーダル → ログイン誘導) 動作修正、 hash 化説明文言改善、 X (Twitter) 削除 (4 言語の利用規約等)
- **方針確定 (#43)**: 次セッションは「マップ書き起こし以外」 のハウジングツアー機能を一気に進める。 マップ (Phase 2B) は後回し
- **注意**: 本人の avatar.webp + team-logo.jpg が前回 migration バグで Storage 消失 → HousingAccountModal の avatar 編集 UI 経由で再アップロード可能
- **注意**: vitest pool='vmThreads' に再採用 (Node v24 で forks 動作不可、 memory `reference_vitest_pool_firebase.md` 更新済)。 全テスト並列実行はハング懸念、 個別ファイル run で対応
- **注意**: ENFORCE_APP_CHECK=true、 **Vercel 関数 11/12**、 月 100 ビルド

---

## 次セッション最優先: マップ以外を全部終わらせる

**最初に設計議論 (15-30 分)** で下記 1-6 の優先順位とスコープ確認、 その後実装に入る。

1. **Phase 3 通報フロー**: 「ちがった」 ボタン → 登録者にアプリ内通知 (通報者匿名)、 虚偽通報の異議申し立ては Discord 経由
2. **Phase 3 物件詳細ページ**: `/housing/listing/:id` の個別ページ
3. **Phase 3 家主編集・削除 UI**: 自分の登録は必ず編集・削除可能に
4. **ツアー同期 Firestore 化**: 現状 localStorage のみ → Firestore 同期 (UI 表示はマップ完成で揃う)
5. **Cloudflare 前段化** (DNS 切替 30 分、 Discord OAuth 影響なし要検証)
6. **細かい修正**: `fieldState.confirm()` バグ、 旧 workspace/HousingRegisterModal.tsx の dead code 撤去、 AddressFields の renderBadge prop 化、 tweet 取得の rate limiting、 photo `alt` 属性、 SNS rate limiting

### 後回し (Phase 2B、 マップ着手時)

- マップ Figma 書き起こし (道中央線 + 交差点ノード = 既存設計通り、 ジャンプは特殊エッジ cost 割引)
- 30 軒位置データ
- マップクリック登録 + ノード/エッジオーサリングツール
- 5 時間程度の地道作業 (10 マップ × ~130 件のクリック) を覚悟

### UI 整え時にまとめて対応 (旧ブラッシュアップ後回しリスト統合)

- TopBar ログイン/アバター サイズ違い (問題 6)、 未ログイン登録モーダルの背低違和感
- 登録モーダル UX 磨き (✅ バッジ警告色化 / checklist アニメ / 確認モーダル整形)
- お気に入りモーダル ツアービルダー アニメ、 「全部回る」 staging 視認性、 マップ bubble ♡ ホバー時表示、 TopBar トグル配置
- ハウジング全体 i18n の en/ko/zh 翻訳追加 (今回 ja のみ先行追加済、 値を埋めるだけ)
- スマホ最適化
- **(将来検討)** XIVAuth (FF14 キャラ連携) — 安定性を 3-6 ヶ月様子見

**Phase 3 通報フロー仕様 (2026-05-19 確定)**:
- 自分の登録は編集・削除を必ず可能に
- 「ちがった」 押下 → 登録者にアプリ内通知 (通報者 ID は渡さない)
- 虚偽通報の異議申し立ては LoPo Discord サーバーで運営 DM 受付 → 管理画面で `reportCount` を 0 リセット
- 上記すべて + ハウジング関連の運営作業全般 (BAN / 強制削除 / quota リセット 等含む) は `/admin` で完結 (memory `feedback_housing_admin_complete.md` 参照)

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
