# LoPo 開発 ToDo

> **維持ルール (必読)**:
> - **100 行以内を目標**に維持
> - 完了タスクは即 [TODO_COMPLETED.md](./TODO_COMPLETED.md) へ移動
> - 大きな設計議論 / 詳細未確定の議題は `docs/.private/YYYY-MM-DD-{topic}.md` に集約
> - 確定済み設計方針は [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md)、 管理者手順は [ADMIN_SETUP.md](./ADMIN_SETUP.md)
> - **セッション終了時に必ず本ファイルの行数を確認 → 超過していたら整理**

---

## 次の作業順 (2026-07-10 更新)

DEV変更後はハードリロード([[reference_dev_editor_hmr_hardreload]])。

1. **🔴 ハウジング次の着手順(2026-07-24決定・24日再整理)**: ①コスト面 = ✅**完了**(Twitter動画0化は既に本番稼働済みと判明・画像Storage egress対策は設計書`docs/superpowers/specs/2026-07-24-housing-image-cloudflare-cache-design.md`通り実装+本番デプロイ+既存79件231枚の移行まで完了。Cloudflareキャッシュ動作確認済み。**数日後にFirebase使用状況で効果測定予定**) ②**マイページ作成 = ✅完了・本番デプロイ・ユーザー実機確認OK(2026-07-24)**。詳細=TODO_COMPLETED.md ③タグAND検索機能(要brainstorming) ④繁体字対応(要brainstorming) ⑤YouTube概要欄住所自動入力(API自体は無料・1日1万クエリ枠で問題なしと判明済み) ⑥30日物理削除cron実装(housing_listingsに家主削除済みだが未物理削除のドキュメントが38件残存確認・実害小だが公開前に直したい) ⑦運営からのアップデート告知をハウジング側にも(既存の通知ベルマーク活用・要brainstorming)。全項目の詳細=`docs/.private/2026-07-23-housing-task-inventory.md`。
2. **軽減編集タイムラプスのSNS投稿**(大物・要brainstorming)

## 現在の状態 (次セッションはここから読む)
### ✅ ②マイページ作成 = 本番デプロイ・ユーザー実機確認OK(2026-07-24)
詳細=TODO_COMPLETED.md。
### 🟡 マイページ ブラッシュアップ = 実装済・デプロイ待ち(2026-07-24)
実機FB一巡目(4件)→デプロイ前に指摘され二巡目で追加修正。①右カラムのみ内部スクロール化(ツールバー「N件/並び替え」は固定、カードだけスクロール。**1回目は panel 全体スクロールに直してしまい誤り**→左列 sticky 廃止+align-items:stretch+右列だけ overflow-y:auto に修正) ②名前横の鉛筆→その場で名前編集+アイコンに変更バッジ ③アイコン変更モーダルを LoPo 共通版(白黒トーン)から housing 独自トンマナの新規 `HousingAvatarCropModal.tsx` に差し替え(HousingAccountModal.tsx 側も統一) ④「ハウジンガー公開」説明文+表示名タグ注記(4言語) ⑤「ひとこと」欄 textarea 化(自動拡大) ⑥「まとめてツアー」ボタンは本人閲覧時は非表示(他人の家を見学する機能のため) ⑦「公開をやめる」ボタン文言を「ハウジンガー公開をやめる」に明確化(4言語)。型チェック/ビルド/既存テスト/Playwright実機スクロール検証まで完了。②③⑤(ログイン必須部分)は本番デプロイ後にユーザー実機確認予定。**次セッション最優先候補**=③タグAND検索機能(要brainstorming)。
### ✅ ハウジング全タスク棚卸し完了(2026-07-23)
全項目=`docs/.private/2026-07-23-housing-task-inventory.md`。**棚卸しで判明した食い違い**: ③ハウジンガーPF/④探す地図/⑥住所登録なし一時ツアーは「要brainstorming未着手」扱いだったが、実際はコード確認済みで実装済み(big3にマージ済み)→表記修正済み。片付け漏れの3worktree(housinger-profile/browse-map/ephemeral-tour)はユーザー確認の上で削除済み。**ユーザー確認により以下も完了と判明**(棚卸し時点の記載が古かった): 実機確認待ちチェックリスト全項目/Goblet拡張街directions空文字バグ/管理画面左メニュースクロール不可/地図・ツアーUI4件(枠線・吹き出し位置等)。新アイデアは4件に(④2026-07-23追加=LoPo全体で繁体字対応): ①速度改善は要Lighthouse計測(未実施) ②コストはTwitter動画0化+画像Storage egress実測に統合 ③タグAND検索は新機能のため次回brainstorming対象 ④繁体字対応も新機能のため次回brainstorming対象。

### ✅ 複数投稿URL登録機能 (Batch2) = 本番デプロイ・ユーザー実機確認OK(2026-07-22)
全12タスク+最終レビュー完了・mainにmerge・push済み(merge commit `d079e53a`)。Vercel自動デプロイが一時反応しなかった件は自然復旧、本番チェックリスト全項目OK。詳細=TODO_COMPLETED.md。

### ✅ ハウジング編集ページ画像管理機能 (Plan A+B) = 完成・本番反映・ユーザー実機確認OK(2026-07-21)
削除・並び替え・追加+登録方法(アップロード⇔URL)切替。mainにmerge・push済み(commit `b45c93ae`)。最終レビューでCriticalバグ1件(SNS再貼り替え時の古いデータ混入)発見・修正済み。詳細=TODO_COMPLETED.md。

### 🔴 次セッション最優先1.5: Twitter動画のコストを0にする(2026-07-21・Batch2ブレスト中に発覚・最優先1と2の後に着手)
Batch2設計中に判明: **Twitter動画だけはLoPoサーバー経由でコストがかかる**(画像は`<img src>`外部直リンクで完全無料、YouTubeも`<iframe youtube-nocookie.com/embed>`直埋め込みで完全無料)。Twitter動画のみ`api/tweet-video.ts`がプロキシしており、キャッシュも明示的に無効(`Cache-Control: private, max-age=0`、`tweet-video.ts:122`)。一覧の「生きたカード」用3コマ抽出(`useTweetVideoFrames.ts`)はタブ内メモリキャッシュのみ(ページリロードで消える・他ユーザーと共有されない)なので、動画オンリー投稿が一覧に表示されるたび+誰かが動画再生するたび、閲覧のたびにLoPo経由でTwitterから転送し直している。TODO.mdの「動画CFエッジキャッシュ」(l.54)は未着手。ユーザー要望: **このコストを絶対に0にしたい**(2026-07-21明言)。対応候補(未検討・要brainstorming): ①CFエッジキャッシュ実装 ②YouTube優先を強く推奨する導線 ③その他。現状維持=動画は1物件1本のまま(複数化は見送り、Batch2でも変更なし)。

### ✅ 実機フィードバック3件(2026-07-21・ブレスト完了) = 全項目 実装・main反映済み・実機確認OK(2026-07-23)
1+3. 探すページの表示順ランダム化+一覧スクロール位置復元。2. 初心者向けタグ「ハウジング若葉」。詳細=TODO_COMPLETED.md。

### 🔴 次セッション優先(2026-07-20 更新)
00. ✅ **コスト・ハードニング全部+実機FB9件中②③⑥⑦⑧⑨+ボタン高さ統一/スマホ下端余白/お気に入りアニメ強化、全部本番反映済み・ユーザー実機OK(2026-07-20)**。詳細=TODO_COMPLETED。残=上記「次の作業順」⑤参照。
0-1. 🎨 **詳細ページ紹介文レイアウト改善(ブレスト途中で保留)**: 設計書=`docs/superpowers/specs/2026-07-20-housing-detail-description-hover-reveal-design.md`(3行クランプ+ホバー/フォーカスで全文カード表示)。ユーザーが「もう少しちゃんと考えたい」で次回持ち越し・未実装。
0. 🏠 **ハウジング公開前 残タスク**(網羅=`docs/.private/2026-07-15-housing-release-remaining-tasks.md`):
   - ✅ スマホ対応+実機FB第2〜8弾+**中韓対応=全部実装・本番反映・シード済(2026-07-18)**。詳細=TODO_COMPLETED。裁定待ち2件(クリア挙動変更の追認/season_christmas訳)は次回確認。
   - **公開前ブロッカー**: ①**モデレ判断待ち(要brainstorming・規模感=うまくいけば数百人〜それ以上とユーザー回答2026-07-17)**=/admin で通報一覧+非表示/強制非公開/個別却下(物件・人・個人タグ)+閾値自動非表示は可。**未実装(公開後対応)=BAN/quota永久0/一括削除/物理削除cron**([AdminHousingReports.tsx:9])→hide運用で公開か最低限BAN追加かユーザー判断。②**Discord告知**(ツアー公開・P3住所非公開も併記)。③**中韓=後追いなるはや**(専用DC/鯖/ワードデータ依存・JA/ENブロッカー外。用語CSV=`docs/.private/2026-07-17-housing-terms-ja-en-ko-zh.csv`)。**地域分離は検証済(2026-07-17)**: 現状KR/CN鯖はマスター非存在=混在不可能。ツアー地域ガード(canAddToTour/tourRegionConflict・全追加経路+開始時二重)が実装済でKR/CN追加時も自動適用。対応時の注意=(a)Region型拡張時にOCE例外へ巻き込まない (b)APIのdc実在検証を追加([housingValidation.ts:99]は空チェックのみ)。
   - **残TODO(公開後でも可)**: ①OGPカードのデザイン作り込み=ハウジンガー+ツアー招待URLの両方(「LoPoのハウジングからの共有」と一目で分かるブランド感へ品質最大化・後日ちゃんと設計) ②アバターWebP勢のPNG変換(現状はイニシャル表示)。
   - **忘れず(ユーザー指摘)**: 最初の家でもDCテレポ案内 / 30日物理削除cron(公開後・listing用) / 数日後=GCPコスト実測→G5。
1. ✅ **P0-P3 耐性+住所非公開=本番稼働(2026-07-15・G7完全通過)**。残作業なし(Discord告知含め対応済み・2026-07-23確認)。詳細=`.superpowers/sdd/progress.md`+`.private/2026-07-14-*`・[[project_housing_scale_hardening]]。
2. ✅ **c 削除時の即反映バグ** = 対応済み確認(2026-07-23コード確認: `useHousingListingsStore.ts`の`remove`が`myListings`もfilter済み)。
3. 🎨 **e PF レイアウト調整** (ユーザーが詳細を後述・一緒に詰める。今回は共有ボタンのみ実装)。admin タグ生ID(軽微) も残。
4. 🧹 **旧UI意匠掃除+文言 (2026-07-14 気づき・細かい・別バッチ)**: ①登録タイトル欄 autoComplete=off(履歴サジェスト抑止・URL欄と同型) ②通報モーダル ③通知ドロップダウン(✕が枠外) ④削除確認モーダル = 各々 housing トンマナへ(honey/generic 撤去・[[feedback_housing_no_ai_pills]]) ⑤ヘッダー「ツアー中」→「ツアー」 ⑥ツアー空状態「ツアーがまだ始まっていません」→「探す・お気に入りから行きたいハウジングを選んでツアーを始めましょう！」(探す追加・要文言確定) ⑦「＋住所から追加」→全箇所「＋LoPoに登録せずに追加」(要文言確定)。 ⑧✅探すページの動画カード再生中タイトル消え=修正済(caption を z-content 層へ・本番反映)。

### big3(7-13)+競合コピー修正=✅本番反映済 → 詳細 [TODO_COMPLETED.md](./TODO_COMPLETED.md)。**残(ユーザー実機)**=PF/⑤横断検索 checklist `.private/2026-07-12-big3-release-verification-checklist.md` B+⑤節。**保留**=②建物タイプ切替がたつき(`0e07d7e1`効かず・要systematic-debugging)。

### ✅ D 住所確認ゲート強化 = 対応済み(2026-07-23確認)
死にコード撤去(HousingRegisterAddressFields/ParentHouseSizeField)含め対応済み。詳細=`docs/.private/2026-07-23-housing-task-inventory.md`。
- **6/22〜30 本番反映済の大物(数値入力Phase1/MM:SS/共同編集重さA/メモURL/stgy/スプシ取込一式/ローカルデータ安全性 等)**: 詳細全て→[TODO_COMPLETED.md](./TODO_COMPLETED.md)。**残**=数値入力 Phase 2(admin49件・マスタ書込リスクで保留)/スプシ後追い候補(「A or B」自動分割/`no_phases`理由非表示/skipped amber トークン化/途中取込spec§7)/6/20残(進捗スマホ記録/FFLogs Phase1.5再アンカー/リビデ非対象=回復要否・HP経時追跡)。
- **🔴 緊急対応フォロー(機能): 自己対処できる管理画面**: ①緊急キルスイッチ(Firestore フラグで保存停止+メンテ表示・再デプロイ不要) ②データ健康ダッシュボード(軽減0×イベント有を監視) ③/admin 内に緊急手順書。(2026-06-16 データ破壊バグ根治2件+PITR復旧は完了→COMPLETED。監視=collab で稀に単発軽減が同期取り合いで落ちる一過性グリッチ・再現せず)
- **デプロイ済・残検証/中優先backlog**: FFLogs残(①全滅ログ pull URL`#fight=N`検証+キルログ回帰`selectFight`/②トークン502 `fflogsTokenFailover`特定・specs 2026-04-05-fflogs-import-v2)/同期安定化 残=Step3 unload確実化(updatePlan読んでから書く廃止)+墓標GC cron(詳細=`.private/2026-06-03-realtime-collab-and-sync-notes.md`)/動画CFエッジキャッシュ(Worker full mp4→Cache API→Range slice 206・Range×cacheはseek検証必須[[reference_vercel_edge_range_cache]])/**軽減表の更新配信トースト**(自動reload禁止・要相談)。

---

## ハウジング (α公開後の主軸)

**全タスク一覧は `docs/.private/2026-07-23-housing-task-inventory.md`(2026-07-23棚卸し・07-23ユーザーレビュー反映済み)に集約**。ユーザーレビューで判明: 地図・ツアーUI/D住所確認ゲート/削除即反映バグ/Discord告知/Ko-fiリンク/旧UI意匠掃除 等、多数の項目が実は対応済みだった(古い議論メモに基づく記載ミス)。**残っているのは主に**: 公開前ブロッカー(モデレBAN/監査ログ/中韓翻訳=方針縮小してサイズ表記のみ訳出でOKに決定)/ 中規模要brainstorming数件(詳細ページ紹介文・詐称対策)/ モデレーションロードマップ本体/ 新アイデア4件(速度・コスト・タグ検索・繁体字対応)の着手判断。

- **🆕 初回設定モーダル(ユーザー指摘2026-07-19)**: 軽減表は初回ログインで名前/アイコン設定モーダルが出るためステータス完備、ハウジング側は初回設定が無いため新規ユーザーがいきなり編集しようとすると弾かれる(ensureUserDocumentで応急修正済=TODO_COMPLETED参照だが根本UXは未対応)。**軽減表と同じ作りをハウジングのトンマナ(フォント/色)に合わせるだけで最小工数**とユーザー提案。

---

## 既知の残課題 (中規模・別セッションで設計から)

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

- **🆕 繁体字対応**(ユーザー発案2026-07-23・要brainstorming): LoPo全体(軽減表+ハウジング)で繁体字(台湾・香港向け)に対応するかを検討。現状`src/locales/`はja/en/ko/zh(簡体字)の4つのみで繁体字は無し。新規locale追加になるため、着手前に対象範囲(軽減表のみ先行/ハウジング同時か)を要相談。ハウジングは繁体字話者のプレイ地域がKR/CNのような専用DC分離を要するかも含めて検討要(現状のzhはCNサーバー地域向け)。
- **🆕 ツアーPiP機能**(ユーザー発案2026-07-18・要brainstorming): ツアー中に小窓(Picture-in-Picture)で操作。表示=次の目的地の画像(オンオフ可・デフォルトオフ)/住所/コメント/ナビ/前へ/見学開始(押下でタイマー表示)/次へ(最後は完了)。**超簡易モード**=ボタン3つだけ表示に切替可。技術注意: Document PiP APIはPC Chrome系のみ・iOS Safari非対応→スマホの代替表現要設計。
- アイデア: メモのURL→**YouTube等その場再生(iframe・サムネ方式)**(クリック開きは✅済)・こだわりトップ・配置アニメ・OCR・横型タイムライン・Gemma AI
- **機能ブラッシュアップ案9件**(詳細=docs/.private/2026-06-15-feature-ideas-batch.md)。✅済=③軽減競合逆方向警告 / ⑤Logsインポート上書き・追記 / ⑥有名スプシ取込 (+列グリッド取込 §9.7 `85bb7d8c`)。**残**=①同時刻3+イベント ②スマホ/タブレット最適化(ボトムナビ/FAB・ボトムナビの透け視認性改善=ハウジング側で不透明化済みの型を移植[2026-07-16]) ④MAXHP-10%でダメージ黄 ⑦敵攻撃 or(2択) ⑧管理画面 攻撃ID保持で任意言語翻訳(GUID保持済・仕上げのみ) ⑨メモに動画URL→iframe。取り込み導線チューザー統合は将来。
- **🆕 Wiki型タイムライン共同編集**(大物・詳細=docs/.private/2026-06-16-wiki-collaborative-timeline.md): ログインユーザー皆で1コンテンツを Wiki 編集(オーナーロック可)。既存 collab 資産活用+公開編集モデルは別設計。⑧を先に効かせると相性良。着手時 brainstorming。
- **🆕 共同編集の部屋に「日程調整」**(ブレスト一部合意済・詳細=docs/.private/2026-06-16-collab-fixed-group-scheduling.md): collab ON 時だけ調整さん方式(候補日×メンバー○×△)。識別=名前自由入力(PII なし)・閲覧者も回答可。Phase2 で攻略進捗バー/作戦ボード温存。次=brainstorming 継続→spec。
- 方針: コンテンツ追加=`add-content`→`seed-contents.ts`/スキル正本=Firestore/SNS タグ `#LoPo #FF14 #BuildInPublic #AISelection`
- 並行: マイコラージュ(収益化・28日まで凍結)/ハウジングは MUL 対象外で広告 OK
- バックログ: npm audit/a11y/SE 利用規約/GDPR/SEO/FFLogs アイコン/MTST 分け/みんなの軽減表/ローカルデータ IndexedDB 移行(任意・Safari7日消去はIDBでも起きるので A 併用前提)

<!-- When compacting, always preserve: 現在のタスク、変更中のファイルパス、本ファイルの「現在の状態」セクション -->
