# LoPo 開発 ToDo

> **維持ルール (必読)**:
> - **100 行以内を目標**に維持
> - 完了タスクは即 [TODO_COMPLETED.md](./TODO_COMPLETED.md) へ移動
> - 大きな設計議論 / 詳細未確定の議題は `docs/.private/YYYY-MM-DD-{topic}.md` に集約
> - 確定済み設計方針は [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md)、 管理者手順は [ADMIN_SETUP.md](./ADMIN_SETUP.md)
> - **セッション終了時に必ず本ファイルの行数を確認 → 超過していたら整理**

---

## 現在の状態 (次セッションはここから読む)

- **✅ 2026-06-20 共同編集中の進捗同期(Plan2) + 他参加者打点トースト 本番公開・2タブ実機OK**: 進捗打点を memos と同じ Yjs レーン(`progressPoints`)で匿名 union 同期・Firestore はネスト `data.progress.*`。多エージェント敵対監査で Critical 2件(setMeta が表データ破損 / 旧形式 id 欠落点消滅)を根治・回帰テストで表非破壊を永久ロック。詳細→[TODO_COMPLETED.md](./TODO_COMPLETED.md)。**残=スマホからの進捗記録(別タスク)** / defer Minor 群(COMPLETED 記載)。
- **🔴🗓 最優先(時間依存・週末): Vercel Pro→Hobby ダウングレード判断**: 週末(6/20-21)の Edge Requests を memory `reference_vercel_billing_usage_api` 手順で再実測 → 33K/日以下なら「Hobby に戻して安全」と提案。Cloudflare 前段化で約1万/日(枠の約31%)・3倍余裕。課金サイクル 6/11〜約7/12、**7/11 前に下げれば次月額回避**。操作はユーザーが Dashboard→Billing→Plan で1クリック(可逆)。
- **🔴 緊急対応フォロー(機能): 自己対処できる管理画面**: ①緊急キルスイッチ(Firestore フラグで保存停止+メンテ表示・再デプロイ不要) ②データ健康ダッシュボード(軽減0×イベント有を監視) ③/admin 内に緊急手順書。(2026-06-16 データ破壊バグ根治2件+PITR復旧は完了→COMPLETED。監視=collab で稀に単発軽減が同期取り合いで落ちる一過性グリッチ・再現せず)
- **⚠ ブランチ要確認**: `feat/mobile-bottom-nav-redesign`(管理画面リデザイン/サンドボックス/バグ修正3件)がローカル一覧から消失。コミットは git 内に残存(管理画面=609fab9〜826d1c8)。main マージ済か/別ブランチ退避か/dangling か要特定(`git log --all --oneline --grep=AdminPage`)。ユーザー認識=管理画面/スマホ最適化は未完成。
- **🔴 デプロイ済 or 完成・要実機確認(ユーザー)**:
  - 管理画面リデザイン全18ルート(branch 未push・**要 push 後**): ヘッダー詰まり/2カラムスクロール/ウィザード4本/フォント。サンドボックス=`npm run dev:admin`。
  - 双方向競合警告+画面外矢印(2026-06-17 デプロイ済): 配置/ドラッグで脈動+矢印/解消で消滅/ライトモード矢印。
  - スマホ最適化A+共有タブ(2026-06-15~16 本番反映済): 共有2択→部屋発行/パーティ自動ボタン/Lv80 で DB・星天交差1チャージ/深謀遠慮表示。
- **🔵 進捗お祝い試作** = `feat/progress-celebration-proto` 温存(未マージ・本番非露出)。`npm run dev:progress`→/miti。
- **🔍 FFLogs 残(デプロイ済要検証)**: ①全滅(ワイプ)ログ=pull URL(`#fight=N`)で検証+キルログ回帰(`selectFight`・specs 2026-04-05-fflogs-import-v2) ②トークン502=どのキーがなぜ落ちるか特定(`fflogsTokenFailover`)。
- **同期安定化** Step1+2+① デプロイ済(墓標ソフトデリート+マージ)。残=Step3 unload確実化(updatePlan の読んでから書く廃止)/墓標GC cron。詳細=docs/.private/2026-06-03-realtime-collab-and-sync-notes.md。
- **中優先=動画CFエッジキャッシュ**: Worker で full mp4→Cache API→Range slice 206(アプリ変更ゼロ)。Range×cache は地雷=seek 検証必須([[reference_vercel_edge_range_cache]])。
- **方針(2026-05-27)**: 1セッション1タスクで丁寧に/デザインは1つずつ実機。LICENSE 追加しない([[feedback_lopo_license_stance]])。

---

## ハウジング (α公開後の主軸)

- **次優先**: ①本セッション分実機確認(新規登録で画像 aspectRatio CLS ゼロ/リデザイン全体/フィルター chip 矩形化/各モーダルのガラス感) ②「通報」文言全体見直し ③§3.8 残検証(重複 drop でツアー自動追加+トースト/単独 listing で section 非表示) ④「📅1ヶ月以上更新なし」バッジ ⑤通知 listingTitleSnapshot を `formatHousingAddress` 経由へ ⑥split-tweet 対応(画像ツイ+住所リプ別 URL・設計書§8)
- **その後**: 既存テスト物件一掃+コールドスタート(ユーザー作業)→アプデ告知(#59+ハウジングα)。**保留**=マップビュー(リストで完結・非ブロッカー)。
- **Phase 3 残/#60**: UI コンポーネント test 追従(HousingRegister系)/カードデザイン刷新(Allmarks風)/マップ実データ化+`APARTMENT_SPOT[area]`/ko・zh 翻訳実値。
- **タグ仕様全面刷新**(詳細=docs/.private/2026-05-27-tag-system-redesign.md): 公式FF14+シーズン+個人タグ(1人1タグ)の3カテゴリ・軽量モデ。
- **リッチメディア化**: 複数画像+動画埋め込み+ビューポート内自動再生(**CSP に video.twimg.com 必須**・最大3本)・Allmarks 知見流用。
- **通報モデ業界水準ロードマップ**(詳細=docs/.private/2026-05-26-housing-moderation-roadmap.md): Audit log/30日物理削除cron/異議申し立てUI/BAN自動化/NSFW高優先キュー(severity:'high' 既付与だが /admin 並び未反映)/Reporter scoring。
- **細かい**: `fieldState.confirm()` バグ/dead code 撤去/AddressFields renderBadge prop 化/photo `alt`/SNS rate limiting/通知✕磨き/HousingCardExpanded 撤去判断/ツアー同期 Firestore 化。

---

## Claude 並行作業 (安全タスク)

- テスト追従(フォーム改修で落ちる): `HousingRegisterAddressFields`/`HousingRegisterView`/`HousingRegisterModal`/`SystemNotificationBar`(#59 title)
- アプデ告知文 最終化(Discord ja + システム通知 ja/en、ko/zh は ja コピー)・公開タイミングはユーザー判断待ち

---

## #59 残課題 (公開後OK)

- ESLint `react-hooks/rules-of-hooks` 有効化(hook 違反→React #310 本番真っ白事故・tsc は通る)
- 「表を展開する」click handler 394ms(フェーズ全展開時の React レンダー)
- メモリ振れ 600-800MB(DOM 73,060個由来・将来 react-window 仮想化)

---

## 既知の残課題 (中規模・別セッションで設計から)

- **同期不安定**(2026-04-29): 軽減配置→タブ閉→別端末で消失等の複合症状
- **ローカル削除→即同期で復活**(2026-04-28): `deletePlan` の `_deletedPlanIds` 漏れ
- **共同編集 再接続時の「一部欠け」消失**(2026-06-18・先送り合意): 離脱前復帰で自分の直前ドロー等だけ欠けた状態を返し空上書き防御(まるごと空のみ保護)をすり抜け。直しA(離脱側=確定待ち・安価)/B(再接続側=補完・根本)。詳細=docs/.private/2026-06-18-collab-reconnect-partial-loss.md。Undo 機能とは別件。
- **EventModal 計算肥大**: `handleCalculate` 分割+calculator.ts 共通化
- **CRIT 倍率ステータス連動**: `getCritMultiplier(level)`+IL 切替 UI
- **Timeline 描画 120FPS**(2026-05-14): 要素多いと 8.33ms 超え

---

## バグ・不具合 (要修正)

- **低(動作影響なし)**: FFLogs 英語ログ/無敵反映/オートプラン同一技/パルス設定スライダー/ヘッダー縦罫線
- **テスト(既存failure・本番無影響)**: `TopBar.test.tsx` 4件+`HousingWorkspace.test.tsx` 1件(2026-06-03〜・FFLogs修正前から)。HousingWorkspace は jsdom の youtube-nocookie 実 fetch→abort 環境依存・TopBar は要調査。
- **Phase 2 follow-up**: api/popular `viewCount` 削除/en・ko privacy_section1_auto_items bullet バグ/`MitigationSheet.copyPlan` POST 失敗時 localStorage 残留

---

## 未着手・将来計画

- 多言語: ハウジング言語対応/AA 名統一
- UI/モバイル: モーダルアニメ/スマホ・タブレット最適化/SVG アイコンアニメ/紹介 PV
- **❌ 表の情報列固定(横スクロール)** — 2026-06-18 実装したが撤回済(再着手しない): sticky は窓を狭めるとドリフト・完全解消は2パネル化(高リスク)・価値に見合わず。再挑戦は sheetWidth と固定機構の分離(B案)前提(詳細→COMPLETED)。
- インフラ: shared_plans クリーンアップ/CSP unsafe-inline/Sentry/**collab使用量 自動監視→Discord通知 cron**(公開時はA=今のまま[部屋8〜20席+冬眠+COLLAB_DISABLED 手動+$0自動停止]・コスト青天井無し。Bの運用ツール群は公開後追加・2026-06-12決定)
- 新機能: Floating Timeline(Tauri v2)/FFLogs 精度/SA 法改善/詠唱バー注釈/public/icons/削除/ハウジング split-tweet
- デッドコード: Lenis 削除/ハウジング背景動画の画面サイズ別出し分け

---

## 知財防御 (2026-05-27 確定)

LICENSE 追加しない([[feedback_lopo_license_stance]])。真の防御=data+コミュニティ+継続運用。将来「読まれにくく」投資するなら計算ロジックの WebAssembly 化(Rust→wasm)がコスパ最良(UX 犠牲ゼロ・工数1-数週間)。β以降に検討。server 化は 70-200ms 劣化で見送り。

---

## アイデア / 並行 / バックログ

- アイデア: YouTube 埋込/導線・こだわりトップ・配置アニメ・OCR・横型タイムライン・Gemma AI
- **🆕 機能ブラッシュアップ案9件**(詳細=docs/.private/2026-06-15-feature-ideas-batch.md): ①同時刻3+イベント ②スマホ/タブレット最適化(残=ボトムナビ/FAB) ③軽減競合逆方向警告(✅実装済) ④MAXHP-10%でダメージ黄 ⑤Logsインポート上書き/追記 ⑥有名スプシ取込(法務・大物) ⑦敵攻撃 or(2択) ⑧管理画面 攻撃ID保持で任意言語翻訳 ⑨メモに動画URL→iframe。インポート系⑤⑥⑧は入口再設計でまとめる。
- **🆕 Wiki型タイムライン共同編集**(大物・詳細=docs/.private/2026-06-16-wiki-collaborative-timeline.md): ログインユーザー皆で1コンテンツを Wiki 編集(オーナーロック可)。既存 collab 資産活用+公開編集モデルは別設計。⑧を先に効かせると相性良。着手時 brainstorming。
- **🆕 共同編集の部屋に「日程調整」**(ブレスト一部合意済・詳細=docs/.private/2026-06-16-collab-fixed-group-scheduling.md): collab ON 時だけ調整さん方式(候補日×メンバー○×△)。識別=名前自由入力(PII なし)・閲覧者も回答可。Phase2 で攻略進捗バー/作戦ボード温存。次=brainstorming 継続→spec。
- 方針: コンテンツ追加=`add-content`→`seed-contents.ts`/スキル正本=Firestore/SNS タグ `#LoPo #FF14 #BuildInPublic #AISelection`
- 並行: マイコラージュ(収益化・28日まで凍結)/ハウジングは MUL 対象外で広告 OK
- バックログ: npm audit/a11y/SE 利用規約/GDPR/SEO/FFLogs アイコン/MTST 分け/みんなの軽減表
- **リアルタイム共同編集 ①〜⑤・④ 全完了(2026-06-14 一般公開・本番稼働)** — 正典=memory `project_realtime_collab_status`、実装ログ=COMPLETED。**残=カーソル ON/OFF UI 改修(低優先)**: トグルが枠外はみ出る→状態テキスト明示(PresenceControls/CursorOptInModal)。

<!-- When compacting, always preserve: 現在のタスク、変更中のファイルパス、本ファイルの「現在の状態」セクション -->
