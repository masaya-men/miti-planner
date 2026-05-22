# LoPo 開発 ToDo

> **維持ルール (必読)**:
> - **100 行以内を目標**に維持
> - 完了タスクは即 [TODO_COMPLETED.md](./TODO_COMPLETED.md) へ移動
> - 大きな設計議論 / 詳細未確定の議題は `docs/.private/YYYY-MM-DD-{topic}.md` に集約
> - 確定済み設計方針は [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md)、 管理者手順は [ADMIN_SETUP.md](./ADMIN_SETUP.md)
> - **セッション終了時に必ず本ファイルの行数を確認 → 超過していたら整理**

---

## 現在の状態 (次セッションはここから読む)

- **ブランチ**: main (push 済・デプロイ済)、 セッション #51〜#52 で **③ SNS 画像ライフサイクルの Task 1〜9 を全実装・デプロイ + 複合インデックス deploy 済 + 🔍実機 (A)(B) 検証完了**。 Task7 (D)purge / Task8 (C)開いた時チェック (toast+自動クローズ+一覧除去) / Task9 (E)毎日4:00UTC cron。 全体 vitest 1038 pass・tsc・build green。 (A)(B)=登録→プレビュー/一覧カードサムネ/詳細すべてに画像表示 OK (初回「出ない」真因は PWA 旧JSキャッシュ、コード修正不要)
- **次セッション最優先**: **③ の残り 🔍実機 (C)(D)(E) 検証** をユーザーと: (C) テスト用ツイートで登録→X でツイート削除→1〜2分後に物件を開く→toast「元の投稿が削除…」+自動クローズ+一覧除去 / 生存ツイートは誤削除しない。 (E) cron は手動なら Vercel `CRON_SECRET` 要 (sensitive、ユーザー提示) or 毎日自動。 ⚠(C)はツイート確認を最大1h edge キャッシュ→直後だと即削除されない場合あり (バグでない、cron が確実に掃除)。 完了後プランの「完了後」節 (TODO_COMPLETED 移動・残課題整理) を実施
- **#51 完了**: Task1 共有 `tweetSyndication.ts`(生存確認)+tweet-meta DRY化 / Task2 `HousingListing` に `tweetId`/`lastTweetCheckAt` / Task3 `validateImage`+`buildListingImageFields`(純関数) / Task4 フォーム→onSubmit に画像URL同梱 (`HousingRegisterSnsUrlField`/`HousingRegisterForm`)
- **#51 重要な学び (テスト基盤)**: 「RUN」のまま固まる/node ゾンビ化の真因は **vmThreads (昨日 Node v24 で forks 不可→採用) が実タイマー残すテストを終了不能**。フォーム全体を submit まで駆動する happy-dom テストは置かない (純関数ユニット+実機でカバー)。安全な実行手順は memory `reference_vitest_vmthreads_hang` 厳守 (パイプ禁止/必ずファイル出力+ハードタイムアウト/再実行しない)。基盤根治(forks復活 or Node v22)は要相談で別途
- **完了 (#50)**: ② **kebab(…) 削除も一覧へ即反映** (`HousingActionBar` に `onDeleted` 追加→ route で `store.remove`+通知一掃、 バナー経由と挙動統一)。 **削除済み/非公開カードクリックで toast 案内** (`housing.detail.unavailable`、 今まで無言で閉じてた)。 **新規登録した物件を中央一覧へ即反映** (リロード不要、 `store.fetchAndUpsert(id)` + `service.getListingById(id)`、 編集/削除と責務統一)。 **テスト基盤根治**: vitest が App Check の reCAPTCHA 通信で teardown ハング→ゾンビ化していたのを `MODE==='test'` スキップで解消 (memory `reference_vitest_appcheck_teardown`、 これまで全 suite が固まってた主因)
- **実機検証済 (#50)**: 新規登録→リロードせず中央に出る / kebab 削除→リロードせず中央から消える / 削除済みカード→toast 案内
- **注意**: en/ko/zh i18n の新キーは ja 値コピー (en 翻訳は従来どおり後追い)。 `.env.local` の `FIREBASE_PRIVATE_KEY` が**改行潰れで壊れ→ローカル admin SDK 不可** (本番は正常、 `vercel env pull` で修復可)。 デプロイは **git push(main) で lopoly.app に自動反映** (手動 alias 不要、 memory `reference_vercel_git_autodeploy`)。 vitest は pool='vmThreads' 厳守
- **本番データ**: housing_listings は実物件のみ (偽データ投入しない方針)。 通報モデレーションの **/admin 復帰 UI は未実装** (現状 reset 手段が無い→自己復帰フローで代替)。 リリース準備は `docs/housing-release-checklist.md`

---

## 次セッション最優先: Phase 3 ③ (SNS 画像ライフサイクル)

**最初のコマンド (コピペ)**:
> `docs/TODO.md` を読んで。 Phase 3 は #50 で ① + ② + 通報モデレーション一式まで実機 OK。 次は ③ SNS 画像表示+ツイート連動ライフサイクル (設計書済→ `writing-plans`→実装)。 1 件ずつ実機確認で。

### Phase 3 残り

- ③ **SNS 画像表示+ツイート連動** (プラン: `docs/superpowers/plans/2026-05-21-housing-sns-image-lifecycle-plan.md`): **Task1〜6 + 実機(A)(B) 完了**。 残り **Task7 (D)purge → Task8 (C)開いた時チェック → Task9 (E)cron**
- ④ **ハウジング リッチメディア化** (③ Task7〜9 完了後に着手・要 brainstorming→spec): Allmarks=マイコラージュ の perf 知見を流用 (memory `reference_allmarks_mycollage`)。 ①複数画像をホバー/全切り替えで閲覧 ②詳細で動画埋め込み再生 (**CSP に video.twimg.com 追加必須**) ③ビューポート内カード自動再生=**動画は最大3本スポットライト式 / 画像は性能制約なく全切り替え**。 現状は photos[0] 1枚のみ保存→複数画像+動画URLの保存拡張が前提
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
