# LoPo 開発 ToDo

> **維持ルール (必読)**:
> - **100 行以内を目標**に維持
> - 完了タスクは即 [TODO_COMPLETED.md](./TODO_COMPLETED.md) へ移動
> - 大きな設計議論 / 詳細未確定の議題は `docs/.private/YYYY-MM-DD-{topic}.md` に集約
> - 確定済み設計方針は [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md)、 管理者手順は [ADMIN_SETUP.md](./ADMIN_SETUP.md)
> - **セッション終了時に必ず本ファイルの行数を確認 → 超過していたら整理**

---

## 現在の状態 (次セッションはここから読む)

- **ブランチ**: main。 セッション #55 (2026-05-25) で **通知バッジ v1 モーダル UI 確定+本実装まで完了** (push 待ち)。 確定仕様: **360 × 420 完全固定 / ヘッダー (タイトル+×) 外側固定 / 内側スクロールボックス (本文+日付、 薄枠+薄背景で「箱の中の箱」 視覚化) / ラベル「過去の通知や最新情報は」 をボタン上 / 1 行フッター X (Twitter) | Discord | spacer | [既読にする]**。 `src/components/SystemNotificationModal.tsx` 反映済、 vitest 3/3 pass、 npm run build EXIT=0 (i18next dynamic-vs-static 警告は既存)。 mockup HTML `docs/.private/system-notif-mockup.html` も同レイアウト (CASE 1=現状 / CASE 2=確定案 / CASE 3=スクロール検証、 gitignore 領域 残置)
- **#55 通知バッジ 残り作業**: commit → push (lopoly.app 自動デプロイ) → 本番で通知バー押下 → モーダル開き実機確認 (DPR 2.58 / CSS 1489) → 違和感なければ通知機能完成宣言
- **#54 マップ残作業 (ユーザー or 後追い)**: (1) Figma で全 31 家の目の前 Node 追加 (plot 26/27/28 = エーテライト直結家も道なりに) (2) 拡張街マップ SVG 5 エリア×表裏=10 SVG (3) エーテライト出発点の動的切替 (現状 `START_NODE='node_1'` 固定、 家→最寄りエーテライト mapping 要) (4) plot bbox サイズを JSON 化してアピール矩形を家サイズ別に。 詳細は `docs/housing-map-authoring-guide.md` §7
- **#54 通知バッジ 将来拡張**: ko/zh 翻訳 / 通知ジャンル分け / 本文中リンク / 既読端末間同期 / Web Push / 予約投稿。 詳細は `docs/superpowers/specs/2026-05-25-system-notifications-design.md` §9
- **#52 重要バグ修正2件 (既存)**: (1) 自動入力が再適用され区など手動編集が巻き戻る→取得結果(data)ごと1回だけ親へ渡すガード。 (2) **削除済みツイートは syndication が 404 でなく 200+`{__typename:TweetTombstone}` を返す**→`checkTweetStatus` を tombstone/unavailable/user欠落対応、 開いた時チェックは edge キャッシュ回避で purge 直接呼び (memory `reference_tweet_deleted_tombstone`)
- **次セッション最優先**: ハウジング側はユーザーが Figma で家前 Node 追加 + 拡張街マップ作成を並行で実施。 Claude 側は **軽減表アプリのブラッシュアップ** (具体タスクはユーザー指定)
- **#51 重要な学び (テスト基盤)**: 「RUN」のまま固まる/node ゾンビ化の真因は **vmThreads (昨日 Node v24 で forks 不可→採用) が実タイマー残すテストを終了不能**。フォーム全体を submit まで駆動する happy-dom テストは置かない (純関数ユニット+実機でカバー)。安全な実行手順は memory `reference_vitest_vmthreads_hang` 厳守 (パイプ禁止/必ずファイル出力+ハードタイムアウト/再実行しない)。基盤根治(forks復活 or Node v22)は要相談で別途
- **完了 (#50)**: ② **kebab(…) 削除も一覧へ即反映** (`HousingActionBar` に `onDeleted` 追加→ route で `store.remove`+通知一掃、 バナー経由と挙動統一)。 **削除済み/非公開カードクリックで toast 案内** (`housing.detail.unavailable`、 今まで無言で閉じてた)。 **新規登録した物件を中央一覧へ即反映** (リロード不要、 `store.fetchAndUpsert(id)` + `service.getListingById(id)`、 編集/削除と責務統一)。 **テスト基盤根治**: vitest が App Check の reCAPTCHA 通信で teardown ハング→ゾンビ化していたのを `MODE==='test'` スキップで解消 (memory `reference_vitest_appcheck_teardown`、 これまで全 suite が固まってた主因)
- **実機検証済 (#50)**: 新規登録→リロードせず中央に出る / kebab 削除→リロードせず中央から消える / 削除済みカード→toast 案内
- **注意**: en/ko/zh i18n の新キーは ja 値コピー (en 翻訳は従来どおり後追い)。 `.env.local` の `FIREBASE_PRIVATE_KEY` が**改行潰れで壊れ→ローカル admin SDK 不可** (本番は正常、 `vercel env pull` で修復可)。 デプロイは **git push(main) で lopoly.app に自動反映** (手動 alias 不要、 memory `reference_vercel_git_autodeploy`)。 vitest は pool='vmThreads' 厳守
- **本番データ**: housing_listings は実物件のみ (偽データ投入しない方針)。 通報モデレーションの **/admin 復帰 UI は未実装** (現状 reset 手段が無い→自己復帰フローで代替)。 リリース準備は `docs/housing-release-checklist.md`

---

## 次セッション最優先: 運営通知バッジ機能のモーダルサイズ詰め → 完成宣言

**最初のコマンド (コピペ)**:
> `docs/TODO.md` を読んで。 セッション #55 で通知モーダルサイズ詰めを mockup HTML で議論し、 「トンマナ現状維持 / width だけ 520→360 / 高さ内容ベース + max-h クランプ」 まで方針確定済み。 ただし実機 (DPR 2.58 + 実ブラウザ) での体感確認はまだ。 まず `docs/.private/system-notif-mockup.html` を実機ブラウザで開いて 360 の体感を一緒に確認 → 必要なら微調整 → `SystemNotificationModal.tsx` に適用 → vitest+build → push → 通知機能完成宣言。 並行でユーザーは Figma で家前 Node 追加 + 拡張街マップ作成を進めている。

### Phase 3 残り

- ③ **SNS 画像表示+ツイート連動**: **完了 (Task1〜9・実機 A〜D・cron デプロイ済、 2026-05-22、 詳細は TODO_COMPLETED)**。 残 UX 改善は「現在の状態」のⓐⓑ
- ④ **ハウジング リッチメディア化** (③ Task7〜9 完了後に着手・要 brainstorming→spec): Allmarks=マイコラージュ の perf 知見を流用 (memory `reference_allmarks_mycollage`)。 ①複数画像をホバー/全切り替えで閲覧 ②詳細で動画埋め込み再生 (**CSP に video.twimg.com 追加必須**) ③ビューポート内カード自動再生=**動画は最大3本スポットライト式 / 画像は性能制約なく全切り替え**。 現状は photos[0] 1枚のみ保存→複数画像+動画URLの保存拡張が前提
- **通報モデレーションの穴**: /admin の復帰(reset)/BAN UI が未実装。 異議申し立てアプリ内 UI、 nsfw/griefing 管理者通知、 30 日後物理削除 cron も未
- **HousingCardExpanded 撤去判断** / ツアー同期 Firestore 化 / Cloudflare 前段化
- 細かい修正: `fieldState.confirm()` バグ、 dead code 撤去、 AddressFields renderBadge prop 化、 photo `alt`、 SNS rate limiting、 通知 ✕ の見た目磨き
- ハウジング i18n の en 翻訳 (公開言語=日英、 現状 ja 値コピー。 中韓は DC 分離で後追い)

### 後回し (Phase 2B、 マップ着手時) — マップだけ実データ化が未了

- マップビューは現状 **sampleWardLayout の mock 配置のまま** (実物件に地図座標が無いため、 MOCK_LISTINGS 表示)。 デフォルトビューが map なので、 ランディングは sample デモが見える。 **→ 作り方ガイド `docs/housing-map-authoring-guide.md` 参照** (要点: FF14 はエリア内 ward 共通レイアウトなので「エリアごとの plot→座標表(1〜60)＋アパート棟座標」だけで全物件を置ける。 道中央線/ノードグラフはツアー動線用で物件配置には不要)。 map 完成までデフォルトビューを list にするかも要検討

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

- **アパート/個室 対応 (新機能・要 spec、 2026-05-22 決定)**: 現状アパートは登録できるが [galleryAdapter.ts:16] が plot/size 無しを除外→一覧/マップに出ない (登録成功なのに消える罠。 ストア upsert/詳細でも同 adapter)。 **決定モデル: アパート = 区 + 号棟(1 or 2)**。 番地欄をアパート選択時「号棟(1/2)」入力に切替 (i18n ja:号棟 / en:Building / ko:동 / zh:号楼)。 作業: ①フォーム 番地↔号棟 切替＋REQUIRED_FIELDS を size 別に ②validateAddress アパートを号棟(1/2)へ (現行 roomNumber 1-90 から変更) ③galleryAdapter にアパートを含める ④カード表示 (plot 無し) ⑤マップ配置 (plot 座標無し→区固定位置 or list のみ)。 +400(invalid_draft) の UI 誤表示「ネットワーク確認」も修正。 **③ SNS 検証(C)(D) を先に完了させてから着手**
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
