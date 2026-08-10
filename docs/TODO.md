# LoPo 開発 ToDo

> **維持ルール (必読)**:
> - **100 行以内を目標**に維持
> - 完了タスクは即 [TODO_COMPLETED.md](./TODO_COMPLETED.md) へ移動
> - 大きな設計議論 / 詳細未確定の議題は `docs/.private/YYYY-MM-DD-{topic}.md` に集約
> - 確定済み設計方針は [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md)、 管理者手順は [ADMIN_SETUP.md](./ADMIN_SETUP.md)
> - **セッション終了時に必ず本ファイルの行数を確認 → 超過していたら整理**

---

## 次の作業順 (2026-08-08 更新)

DEV変更後はハードリロード([[reference_dev_editor_hmr_hardreload]])。

0. **🔴 ハウジング次の着手順(2026-07-24決定)**: ①コスト面=✅完了 ②マイページ作成=✅完了 ③タグAND検索=✅完了 ④繁体字対応=✅完了 ⑤OGPカード作り込み=✅完了(本番push・実機確認OK・抽選頻度チューニング済) ⑥タグ検索UX向上(個人タグ廃止・ownerUidベース化)=✅完了(2026-08-04本番デプロイ)。詳細=`docs/.private/2026-07-23-housing-task-inventory.md`。
1. **軽減編集タイムラプスのSNS投稿**(大物・要brainstorming)
2. **🆕 共同編集参加者のヘッダー開閉解禁 → 軽減表スプシモード**(いずれも大物・2026-08-05ブレスト済・**最高モデルを潤沢に使えるときに着手**、着手順は①→②固定)。ブレスト内容・確定設計・未解決論点は全て`docs/.private/2026-08-05-collab-header-and-spreadsheet-mode.md`に記録済み。着手時は同ファイルを土台にbrainstormingスキルで設計書化からやり直す。

## 現在の状態 (次セッションはここから読む)
### 🟡 セラフィズム自動変化まわり、ユーザー実機テストで小さい不具合を継続発見中(2026-08-10)。見つかった分は都度修正しているが、**まとめて出揃うまで push しない方針**(ユーザー指示)。ローカルには未pushコミットあり。下書き・進捗・告知文は `docs/.private/2026-08-10-scholar-collab-update-draft.md` に集約済み(このファイルだけ見れば続きから再開できる)。
- 修正済(未push): 展開戦術がマニフェステーションのバリアを自動リンクできない不具合(`resolveShieldLinks`未統一が原因)。※「マニフェステーションへの自動変化」機能自体は本番デプロイ済み、これは別の技(展開戦術)がその変化後のバリアを追従できない不具合の修正。
- 修正済(未push・告知対象外・スコープ外便乗): スマホFAB/Undo・Redoボタンの視認性改善/メモ入力ボックスが画面端で見えなくなる不具合をfixed+portal化で修正(共同編集参加者側も同時に直った)。
- 次: ユーザーからの追加報告を待って同様に修正 → 出揃ったらまとめて push+デプロイ → 告知文最終化・投稿はユーザー側。
### ✅ ツアー追加フィードバックアニメーション(2026-08-10・実装完了・ローカル実機確認OK・未push)
探すページのカード/詳細ページの「ツアーに追加」ボタンに、成功時のチェックマーク演出+「追加済み」トグル状態、失敗時(別リージョン)のボタン単体シェイク+吹き出しを実装。設計書=`docs/superpowers/specs/2026-08-10-housing-tour-add-feedback-design.md`・実装計画=`docs/superpowers/plans/2026-08-10-housing-tour-add-feedback.md`。サブエージェント方式(7タスク+最終全体差分レビュー)で実装、本物のバグ計5件検出・修正(hookの未使用import/エラーメッセージ残留、吹き出しrefの型エラー、色トークンがdocument.body配下で未解決、画面端クランプ漏れ、トレイ削除時のピン残留)。既存2ファイル(BrowsePage/FavoritesPageの旧トースト前提テスト)も新仕様に更新済み。ユーザーがローカルで実機確認しOK、**さらに細部のブラッシュアップを継続予定**(次セッション)。まだ未push。
### 🟡 ハウジングツアーの不具合修正(2026-08-10・上記と別件・未push)
非ログインユーザーが「みんなを招待」でツアーリンクを発行しようとすると、汎用エラートースト(「招待リンクの発行に失敗しました」)だけが出てログインが必要なことが伝わらず、原因不明の失敗に見えていた不具合を修正。招待発行はログイン必須の仕様(`createSharedTour`)自体は変更せず、未ログイン時は既に用意されていたログイン案内(`HousingLoginPrompt context="tour"`)に表示を差し替えて、原因がユーザーにわかるようにした。テスト2件追加・実機相当確認済み。
- ログイン必須の理由(ユーザー確認済み・維持で決定): 招待リンクは発行するたびに参加者とリアルタイム同期する「生きたセッション」を作るため、誰でも無制限に発行できると悪用・コスト増につながる。ログインで発行者を識別し「1人1件まで」等の上限を効かせている(設計=`docs/superpowers/specs/2026-07-15-shared-tour-sync-design.md`§9、閾値=`docs/.private/2026-07-15-shared-tour-hardening.md`)。参加する側(リンクを開くだけ)はログイン不要のまま変更なし。
- 案内文言の修正: `login_prompt.tour.lead` の仮文言を実態(誰でも発行できると悪用されるおそれ)に合わせて5言語とも修正(承認済み)。
- UX改善・新機能(承認済み・コミット済み): 住所追加パネルsticky footer化+Enter送信/ツアー中パネルに登録者アイコン名前表示/現在地カードにお気に入りハート追加/DC・ワールド跨ぎ案内を実操作+区画名+区番号+視線誘導アニメ+強調表示+住所2段化+拡張街バッジで強化。詳細・文言before/after → `docs/.private/2026-08-10-tour-crossing-wording-revision.md`。
- 経路データ修正(コミット済み): エンピレアム21号地(本家・拡張街=51号地)の自動計算ナビが最短でなかった件、`/housing/dev/routes`でユーザーが手直し保存。[[project_housing_tour_route_fix_policy]]どおり個別override方式。同様の報告が来たら同じ手順(devサーバー起動→ツールで直してもらう→保存後git diffで反映件数確認→コミット)で対応。
- バグ修正(コミット済み): ハウジンガーページ「まとめてツアー」が既存ツアートレイを上書きしていた不具合を、トレイ+この人の家をマージする形に修正(BrowsePage.commitStartと同型)。全開始経路(5箇所)を洗い出し他に同種バグ無しを確認済み。
- 著作権表記追加(コミット済み・ユーザー指摘): ハウジンガーページのシェアOGPカード(`api/og/_housingerCard.ts`)にSQUARE ENIX著作権表記を追加。grid/sidebar/写真無し/緊急フォールバックの全パターン対象、テスト2件追加。
### ✅ 2026-08-05セッション完了分(詳細→TODO_COMPLETED.md): ランパートLv94回復効果アップ追加/ハウジングのモバイル表示ズレ修正/技の版違い(_v2)表示順バグ修正/サモン・セラフィム中のフェイブレッシング・エーテルパクト使用不可制約追加。全て本番デプロイ済み(ハウジングの表示ズレのみ実機確認は次回)。
### ✅ 2026-08-04セッション完了分(詳細→TODO_COMPLETED.md): タグ検索UX向上(個人タグ廃止・ownerUidベース化・本番デプロイ済)/OGPカード抽選頻度チューニング(本番デプロイ済)
### 📤 Discordアップデート告知 = 下書き完成・投稿待ち(ユーザー側アクション)
下書き=`docs/.private/2026-08-04-discord-housing-update-draft.md`(複数投稿URL登録/編集ページ画像管理/表示順ランダム化+初心者タグ/タグAND検索/繁体字対応/OGPカード新デザイン/タグ検索UX向上、計7件。マイページ作成は別便で告知済みのため除外)。ユーザー確認・投稿待ちのみ(Claudeからは直接投稿しない)。
**🟡 優先度低・後回し確定**: ハウジンガーページが全物件共通の1個のversionカウンタを見ているため、無関係な他ユーザーの物件編集でも自分のハウジンガーページのCDNキャッシュが割れる。改善案=ハウジンガー専用versionカウンタ分離。/ `.claude/worktrees/housinger-ogp-card-redesign`が前回セッションの残プロセスにロックされ`git worktree remove`失敗中(実害なし・ウィンドウを閉じてから削除)。
未対応の別件(2026-07-31分・zh-Hant固有ではない・詳細→TODO_COMPLETED.md): housing.*の日本語取りこぼし(en/ko/zh各約100件)/スプシ取込プレビューのzh-Hant未対応/コンテンツdmuのko欠落。
### ✅ 直近の本番反映・棚卸し(詳細は全てTODO_COMPLETED.md / `.private/2026-07-23-housing-task-inventory.md`)
マイページ作成/複数投稿URL登録Batch2/編集ページ画像管理/探すページ表示順ランダム化+初心者タグ/コスト・ハードニング+実機FB9件/P0-P3耐性+住所非公開/big3(7-13)+競合コピー修正/D住所確認ゲート強化/旧UI意匠掃除、全て本番反映・確認済み。

### 🔴 次セッション優先(2026-07-20 更新・大半確認済みのため圧縮)
0-1. 🎨 **詳細ページ紹介文レイアウト改善(ブレスト保留中・未実装)**: 設計書=`docs/superpowers/specs/2026-07-20-housing-detail-description-hover-reveal-design.md`(3行クランプ+ホバーで全文表示)。
0. 🏠 **ハウジング公開前 残タスク**(網羅=`docs/.private/2026-07-15-housing-release-remaining-tasks.md`): **公開前ブロッカー**=①モデレ判断待ち(要brainstorming)②Discord告知③中韓後追い(用語CSV=`docs/.private/2026-07-17-housing-terms-ja-en-ko-zh.csv`)。**忘れず**=最初の家でもDCテレポ案内/30日物理削除cron(listing用)/GCPコスト実測→G5。
3. 🎨 **e PF レイアウト調整**(ユーザーと詳細を詰める。今回は共有ボタンのみ実装済み)。admin タグ生ID(軽微)も残。

### big3(7-13)+競合コピー修正=✅本番反映済 → 詳細 [TODO_COMPLETED.md](./TODO_COMPLETED.md)。**残(ユーザー実機)**=PF/⑤横断検索 checklist `.private/2026-07-12-big3-release-verification-checklist.md` B+⑤節。**保留**=②建物タイプ切替がたつき(`0e07d7e1`効かず・要systematic-debugging)。
- **6/22〜30 本番反映済の大物(数値入力Phase1/MM:SS/共同編集重さA/メモURL/stgy/スプシ取込一式/ローカルデータ安全性 等)**: 詳細全て→[TODO_COMPLETED.md](./TODO_COMPLETED.md)。**残**=数値入力 Phase 2(admin49件・マスタ書込リスクで保留)/スプシ後追い候補(「A or B」自動分割/`no_phases`理由非表示/skipped amber トークン化/途中取込spec§7)/6/20残(進捗スマホ記録/FFLogs Phase1.5再アンカー/リビデ非対象=回復要否・HP経時追跡)。
- **🔴 緊急対応フォロー(機能): 自己対処できる管理画面**: ①緊急キルスイッチ(Firestore フラグで保存停止+メンテ表示・再デプロイ不要) ②データ健康ダッシュボード(軽減0×イベント有を監視) ③/admin 内に緊急手順書。(2026-06-16 データ破壊バグ根治2件+PITR復旧は完了→COMPLETED。監視=collab で稀に単発軽減が同期取り合いで落ちる一過性グリッチ・再現せず)
- **デプロイ済・残検証/中優先backlog**: FFLogs残(①全滅ログ pull URL`#fight=N`検証+キルログ回帰`selectFight`/②トークン502 `fflogsTokenFailover`特定・specs 2026-04-05-fflogs-import-v2)/同期安定化 残=Step3 unload確実化(updatePlan読んでから書く廃止)+墓標GC cron(詳細=`.private/2026-06-03-realtime-collab-and-sync-notes.md`)/動画CFエッジキャッシュ(Worker full mp4→Cache API→Range slice 206・Range×cacheはseek検証必須[[reference_vercel_edge_range_cache]])/**軽減表の更新配信トースト**(自動reload禁止・要相談)。

---

## ハウジング (α公開後の主軸)

**全タスク一覧は `docs/.private/2026-07-23-housing-task-inventory.md`(2026-07-23棚卸し・07-23ユーザーレビュー反映済み)に集約**。ユーザーレビューで判明: 地図・ツアーUI/D住所確認ゲート/削除即反映バグ/Discord告知/Ko-fiリンク/旧UI意匠掃除 等、多数の項目が実は対応済みだった(古い議論メモに基づく記載ミス)。**残っているのは主に**: 公開前ブロッカー(モデレBAN/監査ログ/中韓翻訳=方針縮小してサイズ表記のみ訳出でOKに決定)/ 中規模要brainstorming数件(詳細ページ紹介文・詐称対策)/ モデレーションロードマップ本体/ 新アイデア4件(速度・コスト・タグ検索・繁体字対応)の着手判断。

- **🆕 初回設定モーダル(ユーザー指摘2026-07-19)**: 軽減表は初回ログインで名前/アイコン設定モーダルが出るためステータス完備、ハウジング側は初回設定が無いため新規ユーザーがいきなり編集しようとすると弾かれる(ensureUserDocumentで応急修正済=TODO_COMPLETED参照だが根本UXは未対応)。**軽減表と同じ作りをハウジングのトンマナ(フォント/色)に合わせるだけで最小工数**とユーザー提案。

---

## 既知の残課題 (中規模・別セッションで設計から)

- **🆕 vitestフルスイート実行が途中で本当にハングする(2026-08-10再確認)**: パイプ起因の見かけ上のハングとは別に、ドキュメント通りの安全な手順(ファイル出力・`npm test`)でも約160秒CPU消費した後に完全停止する実例を確認。[[reference_vitest_vmthreads_hang]]記載の「vmThreadsが実タイマーを残すテストを終了できない」根因が未解決のまま残っている(App Check起因分は対処済だが別のテストが同様の実タイマーを残している疑い)。ユーザー判断: 今すぐ深掘りせず別セッションで着手。対応時は該当メモリの「未解決の根治候補(forks復活/Node LTS降格)」から検討。それまでは全体テストの代わりに変更ファイルに絞った実行で運用する。
- **#59 残(公開後OK)**: ESLint `react-hooks/rules-of-hooks` 有効化(hook違反→React #310 本番真っ白・tscは通る) / 「表を展開する」click 394ms(全展開レンダー) / メモリ振れ600-800MB(DOM 73,060個・将来 react-window)
- **🅿 スプシ取込スマホ/「あらゆるスプシ対応」=棚上げ(2026-06-30 ユーザー判断・スマホは取込UI非表示化済)**: 残設計課題=②フェーズ貼付ガイド/未貼付ガード ③全選択コピーの図解(優先低)。[[project_spreadsheet_mobile_grid]]
- **旧・同期バグ2件**: 同期不安定(2026-04-29 軽減配置→タブ閉→別端末で消失等の複合症状) / ローカル削除→即同期で復活(2026-04-28 `deletePlan` の `_deletedPlanIds` 漏れ)
- **共同編集 再接続時の「一部欠け」消失**(2026-06-18・先送り合意): 離脱前復帰で自分の直前ドロー等だけ欠けた状態を返し空上書き防御(まるごと空のみ保護)をすり抜け。直しA(離脱側=確定待ち・安価)/B(再接続側=補完・根本)。詳細=docs/.private/2026-06-18-collab-reconnect-partial-loss.md。Undo 機能とは別件。
- **計算/描画**: EventModal 計算肥大(`handleCalculate`分割+calculator.ts共通化) / CRIT 倍率ステータス連動(`getCritMultiplier(level)`+IL切替UI) / Timeline 描画 120FPS(要素多いと 8.33ms 超え)

---

## バグ・不具合 (要修正)

- **🔮 8.0スキル大幅変更の改修準備**(リボーン/エボルブモード追加予定→スキルシステム改修・大物・情報出揃い次第。着手時brainstorming。詳細=docs/.private/2026-06-20-skill-modeling-notes.md)。**🔵将来=スキル効果解決の窓口統一**=level+mode→正効果に解決する関数1つに集約し全~30箇所を通す(同id版違いバグの真の根治・コードのきれい。2026-06-22`_base`化が第一歩。競合resourceTracker/CD recastRow/計算calculator 未配線・autoPlanner配線済)。**ここに畳む候補(2026-06-30判断・価値低)**=スプシ取込で技名をコンテンツlevelの版に解決(例 シャドウヴィジル→Lv80はシャドウウォール)。単発実装は非推奨(スキル線リンクがデータに無く窓口統一が前提・発動はユーザーの取り違えのみ)。※リビデ正確モデル化①と表展開トグル③は2026-06-20完了(COMPLETED)。
- **低(動作影響なし)**: FFLogs 英語ログ/無敵反映/オートプラン同一技/パルス設定スライダー/ヘッダー縦罫線
- **Phase 2 follow-up**: api/popular `viewCount` 削除/en・ko privacy_section1_auto_items bullet バグ/`MitigationSheet.copyPlan` POST 失敗時 localStorage 残留 (既知legacyテスト失敗5件=TopBar4+HousingWorkspace1は撤去予定・非アクション)。**🆕 EphemeralAddPanel.test 7件失敗(2026-07-17発見・環境依存)**: happy-domが:3000へ実fetch(ECONNREFUSED)・devサーバー起動中のみ緑だった疑い。d77ca25f時点でも同一失敗=直近変更と無関係を切り分け済。要モック修正。
- **🆕 共同編集の残**(詳細→`.private/2026-06-26-collab-issues-observed.md` / `2026-06-25-deleted-share-link-notice.md`): 実使用バグ A重い/Dモーダル=✅本番済・C ドット数≠実人数=🟦見送り(残=全行未仮想化#59は別タスク) / 削除済み共有リンクの空TL(狭いプライバシー窓・方針A案=deletePlan後revoke+「失効」表示で確定・今後分のみ・急ぎ不要)。

---

## 未着手・将来計画

- 多言語/UI: ハウジング言語対応・AA 名統一 / モーダルアニメ・スマホ+タブレット最適化・SVG アイコンアニメ・紹介 PV / 共同編集カーソル ON/OFF トグルが枠外はみ出る(状態テキスト明示・低優先)
- インフラ: shared_plans クリーンアップ(**2026-06-25 ユーザー近々対応希望**=「表を共有」リンクのサーバー残骸GC・バックアップとは別件)/CSP unsafe-inline/Sentry/**collab使用量 自動監視→Discord通知 cron**(公開時はA=今のまま[部屋8〜20席+冬眠+COLLAB_DISABLED 手動+$0自動停止]・コスト青天井無し。Bの運用ツール群は公開後追加・2026-06-12決定)
- 新機能/デッドコード: Floating Timeline(Tauri v2)/FFLogs 精度/SA 法改善/詠唱バー注釈/public/icons/削除/ハウジング split-tweet // Lenis 削除/ハウジング背景動画の画面サイズ別出し分け
- ⛔ **再着手しない**: 表の情報列固定(横スクロール・2026-06-18 撤回。詳細→COMPLETED) / LICENSE 追加([[feedback_lopo_license_stance]]・真の防御=data+コミュニティ+継続運用、投資するなら計算ロジックの wasm 化)

---

## アイデア / 並行 / バックログ

- **🆕 ツアーPiP機能**(ユーザー発案2026-07-18・要brainstorming): ツアー中に小窓(Picture-in-Picture)で操作。表示=次の目的地の画像(オンオフ可・デフォルトオフ)/住所/コメント/ナビ/前へ/見学開始(押下でタイマー表示)/次へ(最後は完了)。**超簡易モード**=ボタン3つだけ表示に切替可。技術注意: Document PiP APIはPC Chrome系のみ・iOS Safari非対応→スマホの代替表現要設計。
- アイデア: メモのURL→**YouTube等その場再生(iframe・サムネ方式)**(クリック開きは✅済)・こだわりトップ・配置アニメ・OCR・横型タイムライン・Gemma AI
- **機能ブラッシュアップ案9件**(詳細=docs/.private/2026-06-15-feature-ideas-batch.md)。✅済=③軽減競合逆方向警告 / ⑤Logsインポート上書き・追記 / ⑥有名スプシ取込 (+列グリッド取込 §9.7 `85bb7d8c`)。**残**=①同時刻3+イベント ②スマホ/タブレット最適化(ボトムナビ/FAB・ボトムナビの透け視認性改善=ハウジング側で不透明化済みの型を移植[2026-07-16]) ④MAXHP-10%でダメージ黄 ⑦敵攻撃 or(2択) ⑧管理画面 攻撃ID保持で任意言語翻訳(GUID保持済・仕上げのみ) ⑨メモに動画URL→iframe。取り込み導線チューザー統合は将来。
- **🆕 Wiki型タイムライン共同編集**(大物・詳細=docs/.private/2026-06-16-wiki-collaborative-timeline.md): ログインユーザー皆で1コンテンツを Wiki 編集(オーナーロック可)。既存 collab 資産活用+公開編集モデルは別設計。⑧を先に効かせると相性良。着手時 brainstorming。
- **🆕 共同編集の部屋に「日程調整」**(ブレスト一部合意済・詳細=docs/.private/2026-06-16-collab-fixed-group-scheduling.md): collab ON 時だけ調整さん方式(候補日×メンバー○×△)。識別=名前自由入力(PII なし)・閲覧者も回答可。Phase2 で攻略進捗バー/作戦ボード温存。次=brainstorming 継続→spec。
- 方針: コンテンツ追加=`add-content`→`seed-contents.ts`/スキル正本=Firestore/SNS タグ `#LoPo #FF14 #BuildInPublic #AISelection`
- 並行: マイコラージュ(収益化・28日まで凍結)/ハウジングは MUL 対象外で広告 OK
- バックログ: npm audit/a11y/SE 利用規約/GDPR/SEO/FFLogs アイコン/MTST 分け/みんなの軽減表/ローカルデータ IndexedDB 移行(任意・Safari7日消去はIDBでも起きるので A 併用前提)

<!-- When compacting, always preserve: 現在のタスク、変更中のファイルパス、本ファイルの「現在の状態」セクション -->
