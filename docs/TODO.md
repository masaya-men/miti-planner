# LoPo 開発 ToDo

> **維持ルール (必読)**:
> - **100 行以内を目標**に維持
> - 完了タスクは即 [TODO_COMPLETED.md](./TODO_COMPLETED.md) へ移動
> - 大きな設計議論 / 詳細未確定の議題は `docs/.private/YYYY-MM-DD-{topic}.md` に集約
> - 確定済み設計方針は [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md)、 管理者手順は [ADMIN_SETUP.md](./ADMIN_SETUP.md)
> - **セッション終了時に必ず本ファイルの行数を確認 → 超過していたら整理**

---

## 次の作業順 (2026-07-01 更新)
1. **🔴ハウジング全面再構築(全7ページ+シェル・ページ単位再デザイン)**。ブランチ=`feat/housing-rebuild-foundation-browse`(ローカルのみ・未merge/未push)。spec/plan=`docs/superpowers/{specs,plans}/2026-07-01-housing-*`、台帳=`.superpowers/sdd/progress.md`、議論=`docs/.private/2026-07-01-housing-tour-rebuild.md`。
   - **✅完了(→[TODO_COMPLETED.md](./TODO_COMPLETED.md))**: 土台+シェル / 探す(質感A案) / お気に入り(Task2〜8・最終レビュー opus=Critical/Important なし)。build緑・ローカルのみ。⚠**merge保留**=公開導線のため登録ページ完成まで(現状本番影響ゼロ)。
   - **🟢(b)登録ページ本体=Task1〜16 コード完了・最終ブランチレビュー✅ Ready to merge:Yes(2026-07-02)**。HEAD=`4b53b134`・作業ツリーclean・build EXIT0・vitest 2432 PASS(既知legacy5のみ)。台帳=`.superpowers/sdd/progress.md`。**⛔merge/push/deployは下記ユーザー作業の通過まで保留**(新機能ゲート)。
     - 内容: タイトル+公開設定(公開/非公開+任意の公開終了日時=遅延評価)+土地ミニマップ(全10マップ)+ライブステッパー/入力チェック/重複チェック(非公開は匿名件数のみ)+SNS/OGP住所自動入力+オートセーブ(復元でSNS再取得)+編集モーダル拡張。非公開はFirestoreルールで実隠蔽。
     - **🔴残ユーザー作業(順序厳守・詳細は台帳)**: ①実画面ゲート(`npm run dev`→/housing/register 目視) ②エンドユーザー実機(公開/非公開1件ずつ登録→反映/隠蔽/期限失効を確認) ③`firebase deploy --only firestore:indexes`(実機確認の前に・非破壊) ④rules deploy(merge後・**emulator/実機で非公開ガード検証してから**・自動テスト無し)。backfill済(28件)。
     - OK後: merge解禁→(c)ツアー中ナビ(M2〜)。保留の小UX(お気に入り「外す」でトレイ残留=台帳Task5 Minor)。
   - 既知の残: 中央カード静止(生きたカード段階2は後日)/ビュー切替[一覧/マップ/ルート]は地図M1配線時に復活/legacy TopBar・HousingWorkspace5件failは撤去予定(回帰でない)。
2. **軽減編集タイムラプスのSNS投稿**(大物・要brainstorming)

### 🅿 棚上げ: スプシ取込スマホ / 「あらゆるスプシ対応」(2026-06-30 ユーザー判断)
- 原因確定=有名スプシは**TRUE/FALSEマトリクス**で、ジョブ/スキルは**アイコン画像+隠し行**。スマホ貼付(text/plain)は構造的に不可(実機TSVで実証)。
- 検討した「スプシURL直読み」は**入力手段を変えるだけで対応フォーマットは広がらない**(matrix は有名スプシ構造ハードコード/grid は手動マッピング)。表向き「スプレッドシートから取り込む」は実態より広く読める。
- **方針=「あらゆるスプシ対応」を本命ゴールとして棚上げ**(汎用パーサ/自動マッピングは別プロジェクト級)。当面 URL直読みは作らない。
- **スマホでは取込UI自体を非表示**にした(2026-06-30・Timeline.tsx の MobileBottomSheet からボタン撤去。PC入口は維持)。[[project_spreadsheet_mobile_grid]]

## 現在の状態 (次セッションはここから読む)

- **🆕 2026-06-29〜30 本番反映済(完了詳細→[TODO_COMPLETED.md](./TODO_COMPLETED.md))**: ①**数値入力の業界水準化 Phase 1**(共通部品 NumericInput/TimeInput 新設→EventForm/AASettings/PartyStatus/BoundaryEditModal 移行・旧FormattedNumberInput撤去) ②**イベント時刻の MM:SS 入力対応**(`6:15`/裸秒・4言語・formatTime負値修正) ③**共同編集の重さA根治**(カーソル隔離)+**メモURLリンク化#1**+**/stgy(PS5リモプ貼付)**。**残=数値入力 Phase 2**(admin49件・マスタ書込リスクで保留)。
- **✅ スプシ取込一式・取込フローv2・列グリッド取込(自作対応§9.7)・見切れ攻撃名マーキー・ローカルデータ安全性・PiP攻撃ドリブン化・iOS非ログイン安全性 等(6/22〜6/26 本番済・実機OK)**: 詳細全て→[TODO_COMPLETED.md](./TODO_COMPLETED.md)。**後追い候補**=スプシ「A or B」自動分割→altName / ウィザード`no_phases`理由非表示 / skipped amber→トークン化 / ②途中取込(spec§7)。**6/20残**=進捗スマホ記録/FFLogs Phase1.5再アンカー/リビデ非対象=回復要否・HP経時追跡。
- **🟢🗓 Vercel Pro→Hobby: 実測完了→Hobby 安全 (2026-06-20)**: 課金API実測(6/12-19)= Edge Requests ピーク 16,127/日(6/12・閾値33Kの48%)・平均9,178/日(月換算275K=枠の27.5%)・直近土日(6/14-15)も約40%。Function Inv/転送量も全て5-6%。**全指標2倍以上の余裕**で減少傾向。7/11 前に Dashboard→Billing→Plan で Hobby へ(1クリック・可逆)→次月 Pro 課金回避。**ユーザー確認済(6/20)=ハウジング未公開・広告未稼働→今すぐ Hobby OK**。team=pro 確認済(user 表示は northstar で hobby と出るが課金は team)。⚠**将来トリガー**: ハウジングを広告つき公開する時に Hobby 商用禁止へ抵触→その時 Pro 復帰 or ハウジング別デプロイ分離を判断。それまで Hobby は一時節約。
- **🔴 緊急対応フォロー(機能): 自己対処できる管理画面**: ①緊急キルスイッチ(Firestore フラグで保存停止+メンテ表示・再デプロイ不要) ②データ健康ダッシュボード(軽減0×イベント有を監視) ③/admin 内に緊急手順書。(2026-06-16 データ破壊バグ根治2件+PITR復旧は完了→COMPLETED。監視=collab で稀に単発軽減が同期取り合いで落ちる一過性グリッチ・再現せず)
- **🔴 完成・push済・要実機確認(ユーザー)**: 管理画面リデザイン全18ルート(`npm run dev:admin`で目視=ヘッダー/2カラム/ウィザード4本/フォント) / スマホ最適化A+共有タブ(2026-06-15~16本番=共有2択・部屋発行・パーティ自動・Lv80 DB/星天交差1チャージ/深謀遠慮)。
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

## #59 残課題 (公開後OK)

- ESLint `react-hooks/rules-of-hooks` 有効化(hook違反→React #310 本番真っ白・tscは通る) / 「表を展開する」click 394ms(全展開レンダー) / メモリ振れ600-800MB(DOM 73,060個・将来 react-window)

---

## 既知の残課題 (中規模・別セッションで設計から)

- **スプシ取込スマホ=貼付方式は本番済だが実シート取込不可(状態は↑現在の状態/作業順#1)**。残設計課題: ②フェーズ貼付ガイド/未貼付ガード ③全選択コピーの図解(優先低)。[[project_spreadsheet_mobile_grid]]

- **ローカルデータ安全性=✅本番済(6/25 `13b081c5`)→現在の状態。残C(任意)**=localStorage→IndexedDB移行(容量・堅牢性。Safari7日消去はIDBでも起きるのでA併用前提)。spec/plan=`docs/superpowers/{specs,plans}/2026-06-25-local-data-safety*`。
- **同期不安定**(2026-04-29): 軽減配置→タブ閉→別端末で消失等の複合症状
- **ローカル削除→即同期で復活**(2026-04-28): `deletePlan` の `_deletedPlanIds` 漏れ
- **共同編集 再接続時の「一部欠け」消失**(2026-06-18・先送り合意): 離脱前復帰で自分の直前ドロー等だけ欠けた状態を返し空上書き防御(まるごと空のみ保護)をすり抜け。直しA(離脱側=確定待ち・安価)/B(再接続側=補完・根本)。詳細=docs/.private/2026-06-18-collab-reconnect-partial-loss.md。Undo 機能とは別件。
- **EventModal 計算肥大**(`handleCalculate`分割+calculator.ts共通化) / **CRIT 倍率ステータス連動**(`getCritMultiplier(level)`+IL切替UI)
- **Timeline 描画 120FPS**(2026-05-14): 要素多いと 8.33ms 超え

---

## バグ・不具合 (要修正)

- **🔮 8.0スキル大幅変更の改修準備**(リボーン/エボルブモード追加予定→スキルシステム改修・大物・情報出揃い次第。着手時brainstorming。詳細=docs/.private/2026-06-20-skill-modeling-notes.md)。**🔵将来=スキル効果解決の窓口統一**=level+mode→正効果に解決する関数1つに集約し全~30箇所を通す(同id版違いバグの真の根治・コードのきれい。2026-06-22`_base`化が第一歩。競合resourceTracker/CD recastRow/計算calculator 未配線・autoPlanner配線済)。**ここに畳む候補(2026-06-30判断・価値低)**=スプシ取込で技名をコンテンツlevelの版に解決(例 シャドウヴィジル→Lv80はシャドウウォール)。単発実装は非推奨(スキル線リンクがデータに無く窓口統一が前提・発動はユーザーの取り違えのみ)。※リビデ正確モデル化①と表展開トグル③は2026-06-20完了(COMPLETED)。
- **低(動作影響なし)**: FFLogs 英語ログ/無敵反映/オートプラン同一技/パルス設定スライダー/ヘッダー縦罫線
- **テスト(既存failure・本番無影響)**: `TopBar.test.tsx` 4件+`HousingWorkspace.test.tsx` 1件(2026-06-03〜・FFLogs修正前から)。HousingWorkspace は jsdom の youtube-nocookie 実 fetch→abort 環境依存・TopBar は要調査。
- **Phase 2 follow-up**: api/popular `viewCount` 削除/en・ko privacy_section1_auto_items bullet バグ/`MitigationSheet.copyPlan` POST 失敗時 localStorage 残留
- **🆕 共同編集の実使用バグ**(`docs/.private/2026-06-26-collab-issues-observed.md`): A.重い=✅本番実機OK(2026-06-29・カーソル隔離。**残=全行未仮想化#59は別タスク**) / **C.ドット数≠実人数=🟦見送り(低優先)**(多すぎ方向。詳細→.private) / D.モーダル画面外=✅本番済(6/26)。B(カーソル暴れ)はAに統合。
- **🆕 削除済み共有リンクの表示**(2026-06-25 後回し・方針確定): 削除した共同編集リンク(`/collab/:token`)を開くと空タイムライン。**狭いプライバシー窓あり**(休眠中に削除→次に開いた人だけ削除前の中身が一度見える)。**方針=A案(deletePlan 成功後に部屋を revoke→中身ごと再接続拒否+「失効」表示)で確定・今後分のみ有効・急ぎ不要**。詳細・実装スケッチ=`docs/.private/2026-06-25-deleted-share-link-notice.md`。

---

## 未着手・将来計画

- 多言語: ハウジング言語対応/AA 名統一
- UI/モバイル: モーダルアニメ/スマホ・タブレット最適化/SVG アイコンアニメ/紹介 PV
- **❌ 表の情報列固定(横スクロール)** — 2026-06-18 実装したが撤回済(再着手しない): sticky は窓を狭めるとドリフト・完全解消は2パネル化(高リスク)・価値に見合わず。再挑戦は sheetWidth と固定機構の分離(B案)前提(詳細→COMPLETED)。
- インフラ: shared_plans クリーンアップ(**2026-06-25 ユーザー近々対応希望**=「表を共有」リンクのサーバー残骸GC・バックアップとは別件)/CSP unsafe-inline/Sentry/**collab使用量 自動監視→Discord通知 cron**(公開時はA=今のまま[部屋8〜20席+冬眠+COLLAB_DISABLED 手動+$0自動停止]・コスト青天井無し。Bの運用ツール群は公開後追加・2026-06-12決定)
- 新機能: Floating Timeline(Tauri v2)/FFLogs 精度/SA 法改善/詠唱バー注釈/public/icons/削除/ハウジング split-tweet
- デッドコード: Lenis 削除/ハウジング背景動画の画面サイズ別出し分け

---

## 知財防御 (2026-05-27 確定)

LICENSE 追加しない([[feedback_lopo_license_stance]])。真の防御=data+コミュニティ+継続運用。将来「読まれにくく」投資するなら計算ロジックの WebAssembly 化(Rust→wasm)がコスパ最良(UX 犠牲ゼロ・工数1-数週間)。β以降に検討。server 化は 70-200ms 劣化で見送り。

---

## アイデア / 並行 / バックログ

- **✅ PS5リモプ貼り付けUI=/stgy 本番稼働**: スマホ→PS5の共有コード貼り付けは**90字以内が必須**(リモプのキーボード制限。超過で「無効な文字」)。既定170→**88字**・上限90に修正(2026-06-30 実機OK)。コード=`src/lib/strategyCode.ts`。角カッコ`[ ]`はコードの一部として残す。複数`[stgy:...]`は1個ずつ処理(将来まとめ対応の余地)。
- アイデア: メモのURL→**YouTube等その場再生(iframe・サムネ方式)**(クリック開きは✅済→上記#1)・こだわりトップ・配置アニメ・OCR・横型タイムライン・Gemma AI
- **🆕 機能ブラッシュアップ案9件**(詳細=docs/.private/2026-06-15-feature-ideas-batch.md): ①同時刻3+イベント ②スマホ/タブレット最適化(残=ボトムナビ/FAB) ③軽減競合逆方向警告(✅実装済) ④MAXHP-10%でダメージ黄 ⑤Logsインポート上書き/追記(✅本番済2026-06-20) ⑥有名スプシ取込(✅実装完了2026-06-21=上記🟣・要実機確認) ⑦敵攻撃 or(2択) ⑧管理画面 攻撃ID保持で任意言語翻訳(GUID保持済=ほぼ実装済・仕上げのみ) ⑨メモに動画URL→iframe。⑥は実装完了(要実機確認)。取り込み導線チューザー統合は将来。**🆕列グリッド取込(自作スプシ対応)§9.7=✅本番デプロイ済(6/25 `85bb7d8c`)→上記「現在の状態」。spec/plan=`docs/superpowers/{specs/2026-06-24-spreadsheet-grid-import-design.md§9.7,plans/2026-06-24-spreadsheet-grid-import-v97-ux.md}`。**
- **🆕 Wiki型タイムライン共同編集**(大物・詳細=docs/.private/2026-06-16-wiki-collaborative-timeline.md): ログインユーザー皆で1コンテンツを Wiki 編集(オーナーロック可)。既存 collab 資産活用+公開編集モデルは別設計。⑧を先に効かせると相性良。着手時 brainstorming。
- **🆕 共同編集の部屋に「日程調整」**(ブレスト一部合意済・詳細=docs/.private/2026-06-16-collab-fixed-group-scheduling.md): collab ON 時だけ調整さん方式(候補日×メンバー○×△)。識別=名前自由入力(PII なし)・閲覧者も回答可。Phase2 で攻略進捗バー/作戦ボード温存。次=brainstorming 継続→spec。
- **🆕 軽減編集タイムラプスのSNS投稿**(大物・要brainstorming。2026-06-30 調査+試作で方向確定): クリアまでの試行錯誤をGIF化→SNS(#BuildInPublic・バイラル狙い「これどこで作った→LoPo」)。**履歴蓄積は容易**=add/remove/updateMitigation が全部 `pushHistory()` 経由→`{時刻,snapshot}`を別バッファ記録するだけ(PlanData/HistorySnapshotは素のJSON・loadSnapshotで復元可)。**❌抽象帯グラフ(自前canvas描画)は却下**=ユーザー「実画面で見せないとLoPoと分からない」→**実画面ベース必須**(html2canvas or getDisplayMedia等・DOM描画なので要検討)。GIFで十分(尺短・超高速→最後にCLEAR)。古い表は「完成形の組み上がり」のみ可(本物の試行錯誤は録画機構導入後)。既存録画ブランチ(pip-timeline-recorder/VideoRecorderModal)は**YouTube入力補助で流用不可**と判明。試作=scratchpad(帯グラフ版・却下)。
- 方針: コンテンツ追加=`add-content`→`seed-contents.ts`/スキル正本=Firestore/SNS タグ `#LoPo #FF14 #BuildInPublic #AISelection`
- 並行: マイコラージュ(収益化・28日まで凍結)/ハウジングは MUL 対象外で広告 OK
- バックログ: npm audit/a11y/SE 利用規約/GDPR/SEO/FFLogs アイコン/MTST 分け/みんなの軽減表
- **リアルタイム共同編集 ①〜⑤・④ 全完了(2026-06-14 一般公開・本番稼働)** — 正典=memory `project_realtime_collab_status`、実装ログ=COMPLETED。**残=カーソル ON/OFF UI 改修(低優先)**: トグルが枠外はみ出る→状態テキスト明示(PresenceControls/CursorOptInModal)。

<!-- When compacting, always preserve: 現在のタスク、変更中のファイルパス、本ファイルの「現在の状態」セクション -->
