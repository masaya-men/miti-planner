# LoPo 開発 ToDo

> **維持ルール (必読)**:
> - **100 行以内を目標**に維持
> - 完了タスクは即 [TODO_COMPLETED.md](./TODO_COMPLETED.md) へ移動
> - 大きな設計議論 / 詳細未確定の議題は `docs/.private/YYYY-MM-DD-{topic}.md` に集約
> - 確定済み設計方針は [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md)、 管理者手順は [ADMIN_SETUP.md](./ADMIN_SETUP.md)
> - **セッション終了時に必ず本ファイルの行数を確認 → 超過していたら整理**

---

## 次の作業順 (2026-07-10 更新)

**ハウジングのブランチは全部 main にマージ済・origin/main に push 済** (2026-07-10 に `git merge-base --is-ancestor` で検証)。`feat/housing-tour-panel-restructure` / `feat/housing-rebuild-foundation-browse` / `feat/housing-small-fixes` はいずれも**未マージではない**。ローカルのブランチ参照は消して良い。実装内容の詳細 → [TODO_COMPLETED.md](./TODO_COMPLETED.md) + memory [[project_housing_phase_status]]。DEV変更後はハードリロード([[reference_dev_editor_hmr_hardreload]])。

1. **🔴 ハウジング公開前の残タスク** (spec/plan=`docs/superpowers/…2026-07-01-housing-*`、議論=`.private/2026-07-01-housing-tour-rebuild.md`、台帳=`.superpowers/sdd/progress.md`)
   - **実機確認待ち(ユーザー)**: ①本番でログイン→**編集を1周**(ログイン本番専用でローカル不可) ②登録URL欄 autoComplete=off ③期限6/30→シークレットNotFound ④旧テスト物件を詳細…メニューから削除 ⑤カード新デザイン本番確認。
   - **ツアー地図の残 UI 4件** (マージ済だが未着手): ①B4「目的の家に行き方」吹き出し(家側) ②経路を家の縁で終端(刺さり解消) ③家と道の枠線根治 ④地図クロスフェード再挑戦(ズームイン破綻で revert 済・現行 dip・code=`c905d8c4`)。
   - **その他残**: D7(過去日時注記・要相談)/D8(全ボタン押下feedback)/カードのスマホ対応/**軽減表の更新配信トースト**(自動reload禁止・要相談)/残デザイン(NotFound見た目/詳細トンマナ/B3赤Node)/生きたカード follow-up(詳細peers配線・representativeImage 3重複撤去・`useIsScrolling` が body overflow:hidden で非発火)。
   - 理想=共有ツアー同期は別PJ(`docs/.private/2026-07-08-synced-shared-tour-vision.md`)。
2. **軽減編集タイムラプスのSNS投稿**(大物・要brainstorming)

### 🅿 棚上げ: スプシ取込スマホ / 「あらゆるスプシ対応」(2026-06-30 ユーザー判断・スマホは取込UI非表示化済・詳細=[[project_spreadsheet_mobile_grid]])

## 現在の状態 (次セッションはここから読む)
### ✅ 直近本番検証済: round1+round2(21項目・7-13) + P0+P1大規模耐性ハードニング(7-14・CF全ルールHIT実測・実機G2全PASS)。プライバシー=`personal_<hex>`はHMAC一方向ハッシュ。round2詳細=`.private/2026-07-13-register-production-test-feedback.md`。
### 🔴 次セッション最優先 (検証で判明+新アイデア)
1. 🔴🔴 **ハウジング大規模耐性ハードニング + 住所非公開機能** (超大物・設計完成・承認済)
   - 「住所非公開の画像」が「100万人でつぶれない・請求ゼロ」要求で大規模programに拡大・承認済。Phase= P0(緊急耐性)/P1(housing読み経路刷新)/P1-M(miti同型・共同編集ありで慎重)/P2(認証コスト削減)/P3(住所非公開)。
   - **全フェーズ実行計画=完成・レビュー済**: `docs/.private/2026-07-14-housing-hardening-orchestration.md` (統括指示書=司令塔Opusの入口・§3.5にP1↔P3境界の確定ルール) + P0/P1/P1-M/P2/P3 各計画 (`2026-07-14-housing-p{0,1,1m,2,3}-*.md`・全てTDD・deviation付)。司令塔=subagent-driven-development。推奨順 P0→P1→P1-M→P2→P3。各ゲートG2〜G7でユーザー実機停止。
   - **✅ P0(緊急耐性)+✅ P1(公開読み窓口化+rulesロック)=本番稼働**(7-14・build/test緑3285・opus最終レビュー済[admin/cron版bump漏れ1件検出→修正])。**✅ CF全ルール稼働**(メディア/窓口`/api/housing/public`/HTML60秒=全てHIT実測・sw.jsバイパス維持でPWA無傷)。**⚠Vercel Hobby 12関数上限**に当たり窓口を`api/housing`ルータへ畳んで解決(c3135486・[[reference_vercel_hobby_function_limit]]・恒久策A適用済/B=Node census後統合)。動画カード再生中タイトル消えも修正済。**🔵P1送りbacklog**: tweet-video 25MB Range回避 / popular top-200窓の新着抑制。 **🎉P1-M(miti補強)=完了・本番稼働**(2026-07-15): 窓口を`api/template`へfold(`?action=public-*`)+client移行(通知poll/テンプレ窓口fetch)+**rulesロック本番反映**(匿名の system_notifications/templates list 直読み→403実測・窓口Admin SDKは200維持)+**CFキャッシュ`miti-public-window-cache`実測HIT**(id別キャッシュ・promoteはDYNAMIC)。G3実機=共同編集2タブ/共有/admin/匿名 全OK・通知poll UX承認。④アカ削除=コード裏取り済([useAuthStore.ts:194-207]がowner限定read)でruntime保留(捨て垢できたら1回)。follow-up(非ブロッキング): `__.*__`予約IDが500(実ID無害)/s-maxageはVercel除去→CFは max-age代替([[reference_vercel_cf_window_caching]])。ops=`.private/2026-07-14-p1m-dashboard-ops.md`。
   - **✅ P2(認証コスト削減)=完了・本番稼働(2026-07-15)**: App Check を eager→遅延初期化 + 匿名到達4窓口(popular GET/POST・search・share POST/PUT)を App Check 免除。匿名閲覧で reCAPTCHA ゼロ・書込/ログインのみ発火。全SDDゲート+G4実機通過(最終Opusレビューで匿名3経路403回帰検出→fix、G4実機で share の initial-throttle 検出→systematic-debugging で share免除に根治)。教訓=[[reference_appcheck_lazy_enumerate_anon_endpoints]]。残=数日後のGCP支出実測→G5(Firestore App Check強制・ユーザーコンソール)。詳細=`.superpowers/sdd/progress.md`。
   - **🛑 P3(住所非公開`unlisted`)=コード完成・全レビュー通過・マージ可能・デプロイ手前で停止(2026-07-15)**: ブランチ`feat/housing-unlisted-visibility`(9コミット・未マージ/未push/未デプロイ・main未変更)。「画像は見せる・住所は守る」triple protection(窓口射影=P1既存/rules get public限定/表示フォールバック)+逆引き封じ(check-duplicate)+多重防御(canViewListing/HousingDetailMap)。全8Task+§3.5確定1/2 実装・build+全テスト緑(436files 3346pass)。Task5 Opus住所レビュー(Critical2件→Task6で閉じ)+最終whole-branch Opusレビュー(check-duplicate逆引きオラクル検出→fix済)。**次セッション=①ユーザー希望の登録画面UI調整を同ブランチで実装(何を調整するか要ヒアリング)→②rules先行deploy+merge/push→③Claude curlネットG7+ユーザー実機G7(住所文字ゼロ)+3択見た目→④Discord告知**。手順詳細=`.superpowers/sdd/progress.md`「🎯P3コード完成」節。G6 wording=決定済。
   - **⚠ セキュリティ: 公開前の脆弱性を含むため設計書・敵対監査は全て `docs/.private/2026-07-14-*` に格納(公開リポに穴の地図を出さない)。修正デプロイ後にサニタイズ版を公開可。** 詳細・優先順・ダッシュ確認は .private + memory [[project_housing_scale_hardening]]。
2. 🔧 **c 削除時の即反映バグ** (小): `remove(id)` が `myListings` を消さず削除後もリロードまで探すに残る([useHousingListingsStore.ts:95])。`removeMine` 追加で Firestore読み取り0で即反映(登録 upsert と同型)。↑private doc に詳細。
3. 🎨 **e PF レイアウト調整** (ユーザーが詳細を後述・一緒に詰める。今回は共有ボタンのみ実装)。J マイページ(brainstorming) / admin タグ生ID(軽微) も残。
4. 🧹 **旧UI意匠掃除+文言 (2026-07-14 気づき・細かい・別バッチ)**: ①登録タイトル欄 autoComplete=off(履歴サジェスト抑止・URL欄と同型) ②通報モーダル ③通知ドロップダウン(✕が枠外) ④削除確認モーダル = 各々 housing トンマナへ(honey/generic 撤去・[[feedback_housing_no_ai_pills]]) ⑤ヘッダー「ツアー中」→「ツアー」 ⑥ツアー空状態「ツアーがまだ始まっていません」→「探す・お気に入りから行きたいハウジングを選んでツアーを始めましょう！」(探す追加・要文言確定) ⑦「＋住所から追加」→全箇所「＋LoPoに登録せずに追加」(要文言確定)。 ⑧✅探すページの動画カード再生中タイトル消え=修正済(caption を z-content 層へ・本番反映)。

### big3(7-13)+競合コピー修正=✅本番反映済 → 詳細 [TODO_COMPLETED.md](./TODO_COMPLETED.md)。**残(ユーザー実機)**=PF/⑤横断検索 checklist `.private/2026-07-12-big3-release-verification-checklist.md` B+⑤節。**保留**=②建物タイプ切替がたつき(`0e07d7e1`効かず・要systematic-debugging)。

### 🔴 D 住所確認ゲート強化 (要 brainstorming・上の「残」のD)
「自動/手動問わず必ず住所を確認させる」。先読み=`docs/.private/2026-07-10-address-confirmation-gate.md`。要点=送信ゲートは`validateAddress().ok`のみで「見たか」を問わない・`fieldState.confirm()`到達不能・死にコード撤去(HousingRegisterAddressFields/ParentHouseSizeField)+部屋区分chip「家」2か所も同時に。(plot→size表/住所抽出v2/行き方整備は本番反映済→COMPLETED。要点=辞書に略称足すな[[feedback_no_speculative_alias_data]]・行き方正典=directions-src/*.csv[[reference_housing_directions_csv_canonical]])
- **💰 Firebaseコスト対策**: ①App Check TTL 7日 ✅ / ④`/api/popular` `.select()` 射影 ✅。**②reCAPTCHA v3切替=保留 → オーナーに効果確認手順を案内済(GCPでassessment数/費用確認→月1万無料枠内ならv3不要、超過ならv3提案)。オーナー確認結果待ち**。詳細=memory [[project_firebase_cost_reduction]]。
- **6/22〜30 本番反映済の大物(数値入力Phase1/MM:SS/共同編集重さA/メモURL/stgy/スプシ取込一式/ローカルデータ安全性 等)**: 詳細全て→[TODO_COMPLETED.md](./TODO_COMPLETED.md)。**残**=数値入力 Phase 2(admin49件・マスタ書込リスクで保留)/スプシ後追い候補(「A or B」自動分割/`no_phases`理由非表示/skipped amber トークン化/途中取込spec§7)/6/20残(進捗スマホ記録/FFLogs Phase1.5再アンカー/リビデ非対象=回復要否・HP経時追跡)。
- **🔴 緊急対応フォロー(機能): 自己対処できる管理画面**: ①緊急キルスイッチ(Firestore フラグで保存停止+メンテ表示・再デプロイ不要) ②データ健康ダッシュボード(軽減0×イベント有を監視) ③/admin 内に緊急手順書。(2026-06-16 データ破壊バグ根治2件+PITR復旧は完了→COMPLETED。監視=collab で稀に単発軽減が同期取り合いで落ちる一過性グリッチ・再現せず)
- **デプロイ済・残検証/中優先backlog**: FFLogs残(①全滅ログ pull URL`#fight=N`検証+キルログ回帰`selectFight`/②トークン502 `fflogsTokenFailover`特定・specs 2026-04-05-fflogs-import-v2)/同期安定化 残=Step3 unload確実化(updatePlan読んでから書く廃止)+墓標GC cron(詳細=`.private/2026-06-03-realtime-collab-and-sync-notes.md`)/動画CFエッジキャッシュ(Worker full mp4→Cache API→Range slice 206・Range×cacheはseek検証必須[[reference_vercel_edge_range_cache]])。

---

## ハウジング (α公開後の主軸)

- **📝「完成→リリース」機能ダンプ(8件)**=`docs/.private/2026-07-08-housing-release-feature-braindump.md`。✅済=①ツアー終了オーバーレイ / ②詳細パネル一本化 / ⑤テーマ切替演出 / ⑧autocomplete off。⑦住所取得は**「既に動作」判定が誤り**だった (og:description は truncate される→上記「現在の状態」の残②)。**残る大物(要 brainstorming)**=③ハウジンガーPF+専用ページ / ④探す地図表示(ワード淡発光+hoverサムネ・保留マップビュー復活) / ⑥住所登録なし一時ツアー。
- **次優先**: ①「通報」文言全体見直し ②§3.8 残検証(重複 drop でツアー自動追加+トースト/単独 listing で section 非表示) ③「📅1ヶ月以上更新なし」バッジ ④通知 listingTitleSnapshot を `formatHousingAddress` 経由へ ⑤split-tweet 対応(画像ツイ+住所リプ別 URL・設計書§8)
- **その後**: 既存テスト物件一掃+コールドスタート(ユーザー作業)→アプデ告知(#59+ハウジングα)。**保留**=マップビュー(リストで完結・非ブロッカー)。
- **Phase 3 残/#60**: UI コンポーネント test 追従(HousingRegister系)/カードデザイン刷新(Allmarks風)/マップ実データ化+`APARTMENT_SPOT[area]`/ko・zh 翻訳実値。
- **タグ仕様全面刷新**: **計画書化済み**→`docs/superpowers/plans/2026-07-10-housing-tag-overhaul-plan.md` (公式23+季節12+テーマ12+個人1人1個・軽量モデ。設計原本=.private/2026-05-27-tag-system-redesign.md)。
- **リッチメディア化**: 複数画像+動画埋め込み+ビューポート内自動再生(**CSP に video.twimg.com 必須**・最大3本)・Allmarks 知見流用。
- **通報モデ業界水準ロードマップ**(詳細=docs/.private/2026-05-26-housing-moderation-roadmap.md): Audit log/30日物理削除cron/異議申し立てUI/BAN自動化/NSFW高優先キュー(severity:'high' 既付与だが /admin 並び未反映)/Reporter scoring。
- **細かい**: photo `alt`/SNS rate limiting/通知✕磨き/ツアー同期 Firestore 化。(fieldState.confirm バグと死にコード撤去は登録ページ改善計画書に吸収済み)

---

## 既知の残課題 (中規模・別セッションで設計から)

- **#59 残(公開後OK)**: ESLint `react-hooks/rules-of-hooks` 有効化(hook違反→React #310 本番真っ白・tscは通る) / 「表を展開する」click 394ms(全展開レンダー) / メモリ振れ600-800MB(DOM 73,060個・将来 react-window)
- **スプシ取込スマホ** (棚上げ済↑): 残設計課題=②フェーズ貼付ガイド/未貼付ガード ③全選択コピーの図解(優先低)。[[project_spreadsheet_mobile_grid]]
- **旧・同期バグ2件**: 同期不安定(2026-04-29 軽減配置→タブ閉→別端末で消失等の複合症状) / ローカル削除→即同期で復活(2026-04-28 `deletePlan` の `_deletedPlanIds` 漏れ)
- **共同編集 再接続時の「一部欠け」消失**(2026-06-18・先送り合意): 離脱前復帰で自分の直前ドロー等だけ欠けた状態を返し空上書き防御(まるごと空のみ保護)をすり抜け。直しA(離脱側=確定待ち・安価)/B(再接続側=補完・根本)。詳細=docs/.private/2026-06-18-collab-reconnect-partial-loss.md。Undo 機能とは別件。
- **計算/描画**: EventModal 計算肥大(`handleCalculate`分割+calculator.ts共通化) / CRIT 倍率ステータス連動(`getCritMultiplier(level)`+IL切替UI) / Timeline 描画 120FPS(要素多いと 8.33ms 超え)

---

## バグ・不具合 (要修正)

- **🔮 8.0スキル大幅変更の改修準備**(リボーン/エボルブモード追加予定→スキルシステム改修・大物・情報出揃い次第。着手時brainstorming。詳細=docs/.private/2026-06-20-skill-modeling-notes.md)。**🔵将来=スキル効果解決の窓口統一**=level+mode→正効果に解決する関数1つに集約し全~30箇所を通す(同id版違いバグの真の根治・コードのきれい。2026-06-22`_base`化が第一歩。競合resourceTracker/CD recastRow/計算calculator 未配線・autoPlanner配線済)。**ここに畳む候補(2026-06-30判断・価値低)**=スプシ取込で技名をコンテンツlevelの版に解決(例 シャドウヴィジル→Lv80はシャドウウォール)。単発実装は非推奨(スキル線リンクがデータに無く窓口統一が前提・発動はユーザーの取り違えのみ)。※リビデ正確モデル化①と表展開トグル③は2026-06-20完了(COMPLETED)。
- **低(動作影響なし)**: FFLogs 英語ログ/無敵反映/オートプラン同一技/パルス設定スライダー/ヘッダー縦罫線
- **Phase 2 follow-up**: api/popular `viewCount` 削除/en・ko privacy_section1_auto_items bullet バグ/`MitigationSheet.copyPlan` POST 失敗時 localStorage 残留 (既知legacyテスト失敗5件=TopBar4+HousingWorkspace1は撤去予定・非アクション)
- **🆕 共同編集の残**(詳細→`.private/2026-06-26-collab-issues-observed.md` / `2026-06-25-deleted-share-link-notice.md`): 実使用バグ A重い/Dモーダル=✅本番済・C ドット数≠実人数=🟦見送り(残=全行未仮想化#59は別タスク) / 削除済み共有リンクの空TL(狭いプライバシー窓・方針A案=deletePlan後revoke+「失効」表示で確定・今後分のみ・急ぎ不要)。

---

## 未着手・将来計画

- 多言語/UI: ハウジング言語対応・AA 名統一 / モーダルアニメ・スマホ+タブレット最適化・SVG アイコンアニメ・紹介 PV / 共同編集カーソル ON/OFF トグルが枠外はみ出る(状態テキスト明示・低優先)
- インフラ: shared_plans クリーンアップ(**2026-06-25 ユーザー近々対応希望**=「表を共有」リンクのサーバー残骸GC・バックアップとは別件)/CSP unsafe-inline/Sentry/**collab使用量 自動監視→Discord通知 cron**(公開時はA=今のまま[部屋8〜20席+冬眠+COLLAB_DISABLED 手動+$0自動停止]・コスト青天井無し。Bの運用ツール群は公開後追加・2026-06-12決定)
- 新機能/デッドコード: Floating Timeline(Tauri v2)/FFLogs 精度/SA 法改善/詠唱バー注釈/public/icons/削除/ハウジング split-tweet // Lenis 削除/ハウジング背景動画の画面サイズ別出し分け
- ⛔ **再着手しない**: 表の情報列固定(横スクロール・2026-06-18 撤回。詳細→COMPLETED) / LICENSE 追加([[feedback_lopo_license_stance]]・真の防御=data+コミュニティ+継続運用、投資するなら計算ロジックの wasm 化)

---

## アイデア / 並行 / バックログ

- アイデア: メモのURL→**YouTube等その場再生(iframe・サムネ方式)**(クリック開きは✅済)・こだわりトップ・配置アニメ・OCR・横型タイムライン・Gemma AI
- **機能ブラッシュアップ案9件**(詳細=docs/.private/2026-06-15-feature-ideas-batch.md)。✅済=③軽減競合逆方向警告 / ⑤Logsインポート上書き・追記 / ⑥有名スプシ取込 (+列グリッド取込 §9.7 `85bb7d8c`)。**残**=①同時刻3+イベント ②スマホ/タブレット最適化(ボトムナビ/FAB) ④MAXHP-10%でダメージ黄 ⑦敵攻撃 or(2択) ⑧管理画面 攻撃ID保持で任意言語翻訳(GUID保持済・仕上げのみ) ⑨メモに動画URL→iframe。取り込み導線チューザー統合は将来。
- **🆕 Wiki型タイムライン共同編集**(大物・詳細=docs/.private/2026-06-16-wiki-collaborative-timeline.md): ログインユーザー皆で1コンテンツを Wiki 編集(オーナーロック可)。既存 collab 資産活用+公開編集モデルは別設計。⑧を先に効かせると相性良。着手時 brainstorming。
- **🆕 共同編集の部屋に「日程調整」**(ブレスト一部合意済・詳細=docs/.private/2026-06-16-collab-fixed-group-scheduling.md): collab ON 時だけ調整さん方式(候補日×メンバー○×△)。識別=名前自由入力(PII なし)・閲覧者も回答可。Phase2 で攻略進捗バー/作戦ボード温存。次=brainstorming 継続→spec。
- 方針: コンテンツ追加=`add-content`→`seed-contents.ts`/スキル正本=Firestore/SNS タグ `#LoPo #FF14 #BuildInPublic #AISelection`
- 並行: マイコラージュ(収益化・28日まで凍結)/ハウジングは MUL 対象外で広告 OK
- バックログ: npm audit/a11y/SE 利用規約/GDPR/SEO/FFLogs アイコン/MTST 分け/みんなの軽減表/ローカルデータ IndexedDB 移行(任意・Safari7日消去はIDBでも起きるので A 併用前提)

<!-- When compacting, always preserve: 現在のタスク、変更中のファイルパス、本ファイルの「現在の状態」セクション -->
