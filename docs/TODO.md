# LoPo 開発 ToDo

> **維持ルール (必読)**:
> - **100 行以内を目標**に維持
> - 完了タスクは即 [TODO_COMPLETED.md](./TODO_COMPLETED.md) へ移動
> - 大きな設計議論 / 詳細未確定の議題は `docs/.private/YYYY-MM-DD-{topic}.md` に集約
> - 確定済み設計方針は [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md)、 管理者手順は [ADMIN_SETUP.md](./ADMIN_SETUP.md)
> - **セッション終了時に必ず本ファイルの行数を確認 → 超過していたら整理**

---

## 現在の状態 (次セッションはここから読む)

- **ブランチ**: main、 セッション #49 (2026-05-21) で **Phase 3 仕上げ実機 E2E** → ① 完了 + 実機で発見した複数バグ修正 + 通報モデレーションを実用化。 全て実機確認済・本番反映済
- **完了 (#49)**: ① **編集→詳細即反映＋通報自動解決** (onSaved/onListingUpdated を詳細チェーンに配線)。 **Fix A** 家主は自分の**非表示(通報3件 isHidden)物件を通知から開ける** (操作不能を解消、 `canViewListing` 純粋関数)。 **Fix B** 編集で**中央一覧カード即反映** (`useHousingListingsStore` に upsert/remove)。 **Fix C** 解決した通報通知を**削除** (リスト/バッジから消える、 `delete-notification`)。 通知ベルに**個別削除 ✕**。 **通報自己復帰フロー** (却下/編集で非表示解除、 自己復帰は `MAX_SELF_RESTORE=1` 回まで→超過は Discord 異議=管理者対応で占有対策、 `resolve-report` ハンドラ)。 **削除ダイアログが出ないバグ修正** (root 直下の housing モーダルが `--housing-*` トークン未解決→ z-index/背景無効で透明化、 `.housing-modal-backdrop` をトークン定義セレクタに追加)
- **実機検証済**: 非表示物件を通知から開ける / 編集で詳細&一覧カード即反映 / 却下で通知消える / ✕ で通知消える / 削除ダイアログ表示→削除→一覧から即消える
- **次セッション最優先**: **②残り** (ActionBar=kebab 削除も `store.remove` 連携 / 削除済みカードをクリックした時の toast 案内)。 → **③ SNS 画像表示＋ツイート連動ライフサイクル**: 設計書済 (`docs/superpowers/specs/2026-05-21-housing-sns-image-lifecycle-design.md`) を `writing-plans`→実装。 画像は CDN 直リンク(保存しない)、 ツイート削除で物件 soft delete (開いた時チェック+ローリングバッチ cron、 10万件対応)
- **注意**: en/ko/zh i18n の新キーは ja 値コピー (en 翻訳は従来どおり後追い)。 `.env.local` の `FIREBASE_PRIVATE_KEY` が**改行潰れで壊れ→ローカル admin SDK 不可** (本番は正常、 `vercel env pull` で修復可)。 デプロイは **git push 後に `vercel alias set <newest-ready> lopoly.app`** で本番ドメイン張替 (memory `reference_vercel_git_autodeploy`)。 vitest 全 suite は firebase teardown ハング (test は pass)、 pool='vmThreads' 厳守
- **本番データ**: housing_listings は実物件のみ (偽データ投入しない方針)。 通報モデレーションの **/admin 復帰 UI は未実装** (現状 reset 手段が無い→自己復帰フローで代替)。 リリース準備は `docs/housing-release-checklist.md`

---

## 次セッション最優先: Phase 3 仕上げ (② 残り → ③)

**最初のコマンド (コピペ)**:
> `docs/TODO.md` を読んで。 Phase 3 は #49 で ① + 通報モデレーション一式まで実機 OK。 次は ② の残り (kebab 削除も一覧から即消す + 削除済みカードクリック時の toast)、 そのあと ③ SNS 画像表示+ツイート連動ライフサイクル (設計書済→ writing-plans→実装)。 1 件ずつ実機確認で。

### Phase 3 残り

- ② **残り**: 詳細バナー経由の削除は一覧反映済 (route の `onConfirmDelete` で `store.remove`)。 **kebab (`HousingActionBar`) 経由の削除も `store.remove` 連携** + **削除済み/存在しないカードをクリックした時の toast 案内** (今は静かに閉じるだけ)
- ③ **SNS 画像表示+ツイート連動**: 設計書 `docs/superpowers/specs/2026-05-21-housing-sns-image-lifecycle-design.md` を `writing-plans`→実装。 (A) フォームが取得済みのツイート画像 URL を登録 API へ通す+ `imageMode:'none'` 決め打ち廃止 (`_registerListingHandler.ts:93`)、 (B) CDN 直リンク表示、 (C) 開いた時のツイート生存チェック、 (D) サーバ検証つき削除、 (E) ローリングバッチ cron (10万件対応)
- **通報モデレーションの穴**: /admin の復帰(reset)/BAN UI が未実装。 異議申し立てアプリ内 UI、 nsfw/griefing 管理者通知、 30 日後物理削除 cron も未
- **HousingCardExpanded 撤去判断** / ツアー同期 Firestore 化 / Cloudflare 前段化
- 細かい修正: `fieldState.confirm()` バグ、 dead code 撤去、 AddressFields renderBadge prop 化、 photo `alt`、 SNS rate limiting、 通知 ✕ の見た目磨き
- ハウジング i18n の en 翻訳 (公開言語=日英、 現状 ja 値コピー。 中韓は DC 分離で後追い)

### 後回し (Phase 2B、 マップ着手時) — マップだけ実データ化が未了

- マップビューは現状 **sampleWardLayout の mock 配置のまま** (実物件に地図座標が無いため)。 デフォルトビューが map なので、 ランディングは sample デモが見える。 **要検討**: 実マップ座標オーサリング (道中央線 + 交差点ノード + 軒位置データ + マップクリック登録 + ノード/エッジツール)、 または map 完成までデフォルトビューを list にするか

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
