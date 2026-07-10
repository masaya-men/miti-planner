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

### 🅿 棚上げ: スプシ取込スマホ / 「あらゆるスプシ対応」(2026-06-30 ユーザー判断)
- 有名スプシ=TRUE/FALSEマトリクス+アイコン画像でスマホ貼付は構造的に不可(実機実証)。URL直読みも対応フォーマットは広がらない。**「あらゆるスプシ対応」は棚上げ**(汎用パーサは別プロジェクト級)。
- スマホでは取込UI自体を非表示化済(2026-06-30・PC入口は維持)。詳細=[[project_spreadsheet_mobile_grid]]

## 現在の状態 (次セッションはここから読む)

- **🆕🏠 ハウジング登録UI 連続修正 本番反映済 (main `087d81bc`・2026-07-10)**。詳細/引き継ぎ=`docs/.private/2026-07-10-housing-small-fixes.md`。
  済=こまごま7件(#1-#7)/タイトル任意化/コメント文言/ツアー動くマップ/住所自動入力の誤検出2件/チェックパネルのキー衝突バグ/重複の赤化/ハニー主アクション統一(.housing-btn-primary をグラデ+影の正典へ)/ログイン案内のトンマナ化+中央寄せ/「登録の流れ」を右カラムへ移設/地図の全周ヴィネット。
- **🆕📐 plot→size 表と住所抽出v2** (詳細=`docs/.private/2026-07-10-plot-size-table-and-address-v2.md`)
  - **✅ 確定表を `src/data/housing/wardPlotSizes.ts` 化 + `getPlotSize(area, plot)`** (commit `0781d4cf`)。回帰ガード3系統(構造不変条件 / 全10マップの outline 面積 300/300 / 行き方本文260件との一致)をテストで固定。**表の再調査は不要**。
  - **✅ 🐛行き方本文のサイズ誤記を修正**: Mist plot30・plot60 / Shirogane plot8・plot38 の「Ｌハウス」→「Ｍハウス」 (生成元 CSV を直して再生成)。private メモは本街2件だけ挙げていたが、拡張街のミラー2件も同じ誤記だった。
  - **✅ size 自動導出 + 住所抽出v2 完了** (commit `92a7769e`)。A案採用=size 欄は disabled の自動判定 (ハニーの auto-filled 表示は維持)。`validateAddress` に `mismatch_with_plot` を足してサーバー側でも保証。og-fetch が本文テキストを返し、`extractHousingAddressFromPage` が候補を採点して最良の1行を採る。**要本番確認 (ユーザー)**。
  - **✅ 住所誤爆を辞書側で根治** (commit `28cb3e94`)。原因は `masterData.ts` の DC/鯖 alias に「4文字未満のASCII略称」が63件 (`Man`/`Had`/`Ex`…、うち31件が英単語と衝突。`Mat` は Mateus鯖 と Materia DC の両方に登録され自己矛盾) 入っていたこと。**パーサは表記ゆれデータしか見ていない。汚れていたのは辞書**。→ 63件削除 + `masterDataAliases.test.ts` で再登録を機械的に禁止 → 文脈ゲート/質フィルタ/`opts` 引数を全撤去 (パーサ 95行減)。エリアの `Gob`→Goblet 等は実在するので残す。
  - **✅ Firestore `/master/servers` を同期済** (2026-07-10・`npx tsx scripts/seed-servers.ts`)。⚠ 発見: **住所抽出は静的 `masterData.ts` を直 import、他画面は Firestore (`useServerData`)** の二重系。`/admin` の alias 編集は住所抽出に**反映されない**。同期前の Firestore は `housingAreas` が旧 `name_jp` 形式で、`AdminServers.tsx` の `area.name[lang]` と噛み合っていなかった (= /admin サーバー画面が壊れていた)。
  - **✅ ゴブレット拡張街 (plot 31-60) の行き方 30件を追加**。これで全300区画に行き方が入った。**📌 Google スプレッドシートは引退。`src/data/housing/directions-src/*.csv` が唯一の正典** (2026-07-10 ユーザー確定。スプシには修正前の誤記が残るので再エクスポート禁止)。直すときは CSV を編集 → `node scripts/parse-ward-directions.mjs`。データの正しさは 2 本のテストが機械的に守る (本文の S/M/L が区画の実サイズと一致 / エーテライト名が実際に地図上に存在)。
  - **🟡 既知の限界 (低優先)**: `extractHousingAddressFromPage` の候補上限 400 で、本文が **134 行を超える**ページから隣接3行窓が切り捨てられる。通常は本文全体の候補が安全網になるが、長文にDC/サーバー語が散ると安全網も `ambiguity` で沈む。実運用 (housingsnap の数行) では顕在化しない。
- **💰 Firebaseコスト対策**: ①App Check TTL 7日 ✅ / ④`/api/popular` `.select()` 射影 ✅ (`a451791c`)。**②reCAPTCHA v3切替=保留 → 2026-07-12 09:00 に自動フォローで効果測定→提案**。詳細=memory [[project_firebase_cost_reduction]]。
- **6/22〜30 本番反映済の大物(数値入力Phase1/MM:SS/共同編集重さA/メモURL/stgy/スプシ取込一式/ローカルデータ安全性 等)**: 詳細全て→[TODO_COMPLETED.md](./TODO_COMPLETED.md)。**残**=数値入力 Phase 2(admin49件・マスタ書込リスクで保留)/スプシ後追い候補(「A or B」自動分割/`no_phases`理由非表示/skipped amber トークン化/途中取込spec§7)/6/20残(進捗スマホ記録/FFLogs Phase1.5再アンカー/リビデ非対象=回復要否・HP経時追跡)。
- **🟢🗓 Vercel Pro→Hobby: 実測で Hobby 安全確認済(6/20・全指標2倍以上余裕)**。**7/11 前に Dashboard→Billing→Plan で Hobby へ**(1クリック・可逆)。⚠将来ハウジングを広告つき公開する時は Hobby 商用禁止に抵触→Pro 復帰 or 別デプロイ分離を判断。詳細実測値→TODO_COMPLETED。
- **🔴 緊急対応フォロー(機能): 自己対処できる管理画面**: ①緊急キルスイッチ(Firestore フラグで保存停止+メンテ表示・再デプロイ不要) ②データ健康ダッシュボード(軽減0×イベント有を監視) ③/admin 内に緊急手順書。(2026-06-16 データ破壊バグ根治2件+PITR復旧は完了→COMPLETED。監視=collab で稀に単発軽減が同期取り合いで落ちる一過性グリッチ・再現せず)
- **🔴 完成・push済・要実機確認(ユーザー)**: 管理画面リデザイン全18ルート(`npm run dev:admin`で目視=ヘッダー/2カラム/ウィザード4本/フォント) / スマホ最適化A+共有タブ(2026-06-15~16本番=共有2択・部屋発行・パーティ自動・Lv80 DB/星天交差1チャージ/深謀遠慮)。
- **🔵 進捗お祝い試作** = `feat/progress-celebration-proto` 温存(未マージ・本番非露出)。`npm run dev:progress`→/miti。
- **🔍 FFLogs 残(デプロイ済要検証)**: ①全滅(ワイプ)ログ=pull URL(`#fight=N`)で検証+キルログ回帰(`selectFight`・specs 2026-04-05-fflogs-import-v2) ②トークン502=どのキーがなぜ落ちるか特定(`fflogsTokenFailover`)。
- **同期安定化** Step1+2+① デプロイ済(墓標ソフトデリート+マージ)。残=Step3 unload確実化(updatePlan の読んでから書く廃止)/墓標GC cron。詳細=docs/.private/2026-06-03-realtime-collab-and-sync-notes.md。
- **中優先=動画CFエッジキャッシュ**: Worker で full mp4→Cache API→Range slice 206(アプリ変更ゼロ)。Range×cache は地雷=seek 検証必須([[reference_vercel_edge_range_cache]])。
- **方針(2026-05-27)**: 1セッション1タスクで丁寧に/デザインは1つずつ実機。LICENSE 追加しない([[feedback_lopo_license_stance]])。

---

## ハウジング (α公開後の主軸)

- **📝「完成→リリース」機能ダンプ(8件)**=`docs/.private/2026-07-08-housing-release-feature-braindump.md`。✅済=①ツアー終了オーバーレイ / ②詳細パネル一本化 / ⑤テーマ切替演出 / ⑧autocomplete off。⑦住所取得は**「既に動作」判定が誤り**だった (og:description は truncate される→上記「現在の状態」の残②)。**残る大物(要 brainstorming)**=③ハウジンガーPF+専用ページ / ④探す地図表示(ワード淡発光+hoverサムネ・保留マップビュー復活) / ⑥住所登録なし一時ツアー。
- **次優先**: ①「通報」文言全体見直し ②§3.8 残検証(重複 drop でツアー自動追加+トースト/単独 listing で section 非表示) ③「📅1ヶ月以上更新なし」バッジ ④通知 listingTitleSnapshot を `formatHousingAddress` 経由へ ⑤split-tweet 対応(画像ツイ+住所リプ別 URL・設計書§8)
- **その後**: 既存テスト物件一掃+コールドスタート(ユーザー作業)→アプデ告知(#59+ハウジングα)。**保留**=マップビュー(リストで完結・非ブロッカー)。
- **Phase 3 残/#60**: UI コンポーネント test 追従(HousingRegister系)/カードデザイン刷新(Allmarks風)/マップ実データ化+`APARTMENT_SPOT[area]`/ko・zh 翻訳実値。
- **タグ仕様全面刷新**(詳細=docs/.private/2026-05-27-tag-system-redesign.md): 公式FF14+シーズン+個人タグ(1人1タグ)の3カテゴリ・軽量モデ。
- **リッチメディア化**: 複数画像+動画埋め込み+ビューポート内自動再生(**CSP に video.twimg.com 必須**・最大3本)・Allmarks 知見流用。
- **通報モデ業界水準ロードマップ**(詳細=docs/.private/2026-05-26-housing-moderation-roadmap.md): Audit log/30日物理削除cron/異議申し立てUI/BAN自動化/NSFW高優先キュー(severity:'high' 既付与だが /admin 並び未反映)/Reporter scoring。
- **細かい**: `fieldState.confirm()` バグ/AddressFields renderBadge prop 化/photo `alt`/SNS rate limiting/通知✕磨き/ツアー同期 Firestore 化。

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
