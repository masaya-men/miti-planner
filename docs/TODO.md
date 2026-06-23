# LoPo 開発 ToDo

> **維持ルール (必読)**:
> - **100 行以内を目標**に維持
> - 完了タスクは即 [TODO_COMPLETED.md](./TODO_COMPLETED.md) へ移動
> - 大きな設計議論 / 詳細未確定の議題は `docs/.private/YYYY-MM-DD-{topic}.md` に集約
> - 確定済み設計方針は [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md)、 管理者手順は [ADMIN_SETUP.md](./ADMIN_SETUP.md)
> - **セッション終了時に必ず本ファイルの行数を確認 → 超過していたら整理**

---

## 現在の状態 (次セッションはここから読む)

- **✅ スプシ取り込み一式=本番デプロイ済(2026-06-22・main `a6af27c0`・Vercel success)**: スプシ取込(忠実性根治6件)+①Phase列→ラベル化&フェーズ名入力 ②パーティ枠ユーザー全選択(未選択赤+作成ブロック) +マスターデータ同id版違いバグ修正(`_base`化・Firestore dataVersion146済) +ドロップダウン▼被り修正 +取り込み導線をImportMenu1つに統一(FF Logs/スプシ選択)。feat ブランチは削除済(マージ済)。詳細=`.superpowers/sdd/progress.md`「🟣改修2件 SDD ledger」。**フォローアップ**: スプシ action の「A or B」自動分割→altName(=⑦の後追い・下記)。マントラ取込直後だけ競合が光らない一過性(リロードで解消・既知軽微)。
- **✅ ⑦敵攻撃 or(2択攻撃)=本番デプロイ済(2026-06-23・main `6471e816`)**: `altName`で「A or B」表示+EventForm or欄UX+カンペ除外(挑発/エーテルフロー/ドロー系/アーサリースター)+未使用CheatSheetView削除。詳細→[TODO_COMPLETED.md](./TODO_COMPLETED.md)。**後追い**=スプシ「A or B」自動分割→altName / 攻撃名見切れマーキー。
- **✅ スプシ取込バグ修正一式=本番デプロイ済(2026-06-23・main `ca98bd32`)**: Bug①collab no-op根治(`commitImportedPlan.ts`)/Bug②末尾フェーズ黙殺防止/作成不可理由の明示(未追加=黄・パーティ未割当=赤)。詳細→[TODO_COMPLETED.md](./TODO_COMPLETED.md)。
- **🟣 取込フロー v2前半(①+③)=実装完了・実機確認待ち(ブランチ `feat/import-flow-v2-phase1`・未merge/未push)**: 全6タスク+最終レビューfix完了。tsc0/build成功/対象テスト37緑。spec=`docs/superpowers/specs/2026-06-23-import-flow-v2-phase1-design.md` / plan=`docs/superpowers/plans/...phase1.md`。実装=`contentSelection.ts`(NewPlanと共通化)/`importWithLimitCheck.ts`(満杯ゲート=既存`LimitResolutionSheet`流用)/`LimitResolutionSheet`マウントをLayout一元化/取込モーダルにコンテンツ選択UI+onImport async/Timeline配線(誤紐付け根治)。**最終レビューでCritical=満杯解消後にshare取込storeのstatus汚染で空ShareImportSheetが幽霊化→fix済(commit47d1aa54・shareWasIdleガードでclose()復帰+回帰テスト2)+独立再レビュー clean**。**ユーザー実機テストで2バグ→fix済**: ①コンテンツpicker未プリセレクト(取込/旧来プランはcategory/level無し)→`resolveInitialSelection()`でcontentId優先復元 ②取込先に別コンテンツ選択しても確定時に現在コンテンツへ巻戻り→初期化effectを「開いた瞬間のみ」(dep[isOpen]+ref)に限定(操作中の自動保存/同期がplans再生成→defaultSelection再計算→effect再実行が原因)。**次=ユーザーが`npm run dev`で再確認(取込先別コンテンツ選択→正しい棚/§3-E #2#3#5)→OKで merge+push(=本番自動デプロイ)**。②途中取込はspec§7繰り越し・別タスク。
- **✅ 2026-06-20 完了(詳細→[TODO_COMPLETED.md](./TODO_COMPLETED.md))**: リビデ正確モデル化 / FFLogsインポート取り込みモード+共同編集進捗同期 / アクアヴェール recast 90→60(main・mockData)。**残**=進捗スマホ記録/FFLogs Phase1.5再アンカー+Phase2スプシ取込⑥/リビデ非対象=回復要否・HP経時追跡。
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

## Claude 並行作業 (安全タスク)

- テスト追従(フォーム改修で落ちる): `HousingRegisterAddressFields`/`HousingRegisterView`/`HousingRegisterModal`/`SystemNotificationBar`(#59 title)
- アプデ告知文 最終化(Discord ja + システム通知 ja/en、ko/zh は ja コピー)・公開タイミングはユーザー判断待ち

---

## #59 残課題 (公開後OK)

- ESLint `react-hooks/rules-of-hooks` 有効化(hook違反→React #310 本番真っ白・tscは通る) / 「表を展開する」click 394ms(全展開レンダー) / メモリ振れ600-800MB(DOM 73,060個・将来 react-window)

---

## 既知の残課題 (中規模・別セッションで設計から)

- **同期不安定**(2026-04-29): 軽減配置→タブ閉→別端末で消失等の複合症状
- **ローカル削除→即同期で復活**(2026-04-28): `deletePlan` の `_deletedPlanIds` 漏れ
- **共同編集 再接続時の「一部欠け」消失**(2026-06-18・先送り合意): 離脱前復帰で自分の直前ドロー等だけ欠けた状態を返し空上書き防御(まるごと空のみ保護)をすり抜け。直しA(離脱側=確定待ち・安価)/B(再接続側=補完・根本)。詳細=docs/.private/2026-06-18-collab-reconnect-partial-loss.md。Undo 機能とは別件。
- **EventModal 計算肥大**(`handleCalculate`分割+calculator.ts共通化) / **CRIT 倍率ステータス連動**(`getCritMultiplier(level)`+IL切替UI)
- **Timeline 描画 120FPS**(2026-05-14): 要素多いと 8.33ms 超え

---

## バグ・不具合 (要修正)

- **🔮 8.0スキル大幅変更の改修準備**(リボーン/エボルブモード追加予定→スキルシステム改修・大物・情報出揃い次第。着手時brainstorming。詳細=docs/.private/2026-06-20-skill-modeling-notes.md)。**🔵将来=スキル効果解決の窓口統一**=level+mode→正効果に解決する関数1つに集約し全~30箇所を通す(同id版違いバグの真の根治・コードのきれい。2026-06-22`_base`化が第一歩。競合resourceTracker/CD recastRow/計算calculator 未配線・autoPlanner配線済)。※リビデ正確モデル化①と表展開トグル③は2026-06-20完了(COMPLETED)。
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
- **🆕 機能ブラッシュアップ案9件**(詳細=docs/.private/2026-06-15-feature-ideas-batch.md): ①同時刻3+イベント ②スマホ/タブレット最適化(残=ボトムナビ/FAB) ③軽減競合逆方向警告(✅実装済) ④MAXHP-10%でダメージ黄 ⑤Logsインポート上書き/追記(✅本番済2026-06-20) ⑥有名スプシ取込(✅実装完了2026-06-21=上記🟣・要実機確認) ⑦敵攻撃 or(2択) ⑧管理画面 攻撃ID保持で任意言語翻訳(GUID保持済=ほぼ実装済・仕上げのみ) ⑨メモに動画URL→iframe。⑥は実装完了(要実機確認)。取り込み導線チューザー統合は将来。
- **🆕 Wiki型タイムライン共同編集**(大物・詳細=docs/.private/2026-06-16-wiki-collaborative-timeline.md): ログインユーザー皆で1コンテンツを Wiki 編集(オーナーロック可)。既存 collab 資産活用+公開編集モデルは別設計。⑧を先に効かせると相性良。着手時 brainstorming。
- **🆕 共同編集の部屋に「日程調整」**(ブレスト一部合意済・詳細=docs/.private/2026-06-16-collab-fixed-group-scheduling.md): collab ON 時だけ調整さん方式(候補日×メンバー○×△)。識別=名前自由入力(PII なし)・閲覧者も回答可。Phase2 で攻略進捗バー/作戦ボード温存。次=brainstorming 継続→spec。
- **🆕 軽減編集タイムラプスの SNS 投稿**(2026-06-20 ユーザー発案・大物・要brainstorming): クリアまで軽減を置く/消す/ずらす試行錯誤の過程をタイムラプス動画化→SNS 投稿(#BuildInPublic 宣伝＋楽しい機能・お祝い機能と連動)。核心=編集履歴(過去状態の列)をどう溜めるか(Undo履歴はリロードで消える→節目スナップショット/収録ボタン)。動画化はffmpeg.wasm回避でアプリ内リプレイ録画も可。**既存ブランチ `feat/pip-timeline-recorder`/`feat/progress-celebration-proto` の収録系地ならしを流用できる可能性(中身未確認・着手時調査)**。
- 方針: コンテンツ追加=`add-content`→`seed-contents.ts`/スキル正本=Firestore/SNS タグ `#LoPo #FF14 #BuildInPublic #AISelection`
- 並行: マイコラージュ(収益化・28日まで凍結)/ハウジングは MUL 対象外で広告 OK
- バックログ: npm audit/a11y/SE 利用規約/GDPR/SEO/FFLogs アイコン/MTST 分け/みんなの軽減表
- **リアルタイム共同編集 ①〜⑤・④ 全完了(2026-06-14 一般公開・本番稼働)** — 正典=memory `project_realtime_collab_status`、実装ログ=COMPLETED。**残=カーソル ON/OFF UI 改修(低優先)**: トグルが枠外はみ出る→状態テキスト明示(PresenceControls/CursorOptInModal)。

<!-- When compacting, always preserve: 現在のタスク、変更中のファイルパス、本ファイルの「現在の状態」セクション -->
