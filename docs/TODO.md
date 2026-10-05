# LoPo 開発 ToDo

> **維持ルール (必読)**:
> - **100 行以内を目標**に維持
> - 完了タスクは即 [TODO_COMPLETED.md](./TODO_COMPLETED.md) へ移動
> - 大きな設計議論 / 詳細未確定の議題は `docs/.private/YYYY-MM-DD-{topic}.md` に集約
> - 確定済み設計方針は [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md)、 管理者手順は [ADMIN_SETUP.md](./ADMIN_SETUP.md)
> - **セッション終了時に必ず本ファイルの行数を確認 → 超過していたら整理**

---

## 次の作業順 (2026-09-02 更新)

DEV変更後はハードリロード([[reference_dev_editor_hmr_hardreload]])。

1. **軍事SF(MIL-SPEC)テーマ + スプシモード = 1つの大型アップデート(ユーザー本命)**。**worktree で隔離**して両方作り、揃ったらまとめて main へ1本化・push(2026-09-02 masaya 決定)。
   - **① MIL-SPEC テーマ**: brainstorm済み・**設計書=`docs/superpowers/specs/2026-09-02-military-theme-design.md`** / **実装計画=`docs/superpowers/plans/2026-09-02-military-theme.md`**。`using-git-worktrees` → Phase 0 Task 0.1 から `subagent-driven-development`。Phase 0 Task 0.7 が masaya の見た目承認ゲート。参考画像=`docs/.private/theme-refs/`。論点 memory [[project_sf_military_theme]]。
   - **② 軽減表スプシモード**(①の後・同じ worktree)。全テーマにトークン経由。要 brainstorm→spec→plan。議論=`docs/.private/2026-08-05-collab-header-and-spreadsheet-mode.md`。WIP中は両方 dev ガード(`localStorage 'milspec-preview'`)、マージ時に公開。
2. **🆕 スケジュール管理 + ロット管理(固定PT運営)** — ①②の直後(masaya 2026-09-04)。要brainstorming。形態 A(軽減表collab内の1機能)or B(別アプリ+プラン紐付け)未定。日程調整アイデア(2026-06-16)を吸収検討。詳細=`docs/.private/2026-09-04-schedule-and-loot-management-idea.md`。
3. **軽減編集タイムラプスのSNS投稿**(大物・要brainstorming・中断)。実機で**タイムラインDOMキャプチャがハング**・原因未特定で保留。詳細=`docs/.private/2026-08-27-mitigation-timelapse-sns-share-design.md`。
4. **Wiki型タイムライン共同編集**(大物)。着手前にアイデア⑧「攻撃ID保持で任意言語翻訳」を先に。詳細=`docs/.private/2026-06-16-wiki-collaborative-timeline.md`。

## 現在の状態 (次セッションはここから読む)
### 🟢 2026-09-04 X OGPカード不具合 = デプロイ済(`280da74d`)。診断=`docs/.private/2026-09-04-housing-ogp-card-x-timing-fix.md`。**残=実機確認のみ**: 次の新規登録ツイートで一発で出るか(出なければ登録→通知の間隔を空ける方向)。既存壊れは `?x=1` で貼り直し。⚠フロント変更デプロイ後は CF「すべてパージ」必須([[reference_cf_cache_housing_ogp_pages]])。
### 🟢 2026-09-28 同じ秒に3つ以上の攻撃+行の高さ可変(1段25px・アイコン24px・「+」ボタン・FFLogs同秒ずらし廃止・スマホの帯を最後のカードの下端−1pxまで)= 本番反映済(ブランチ `feat/multi-attack-rows` を origin/main へ fast-forward)。ユーザーのローカル確認OK。設計書=`docs/superpowers/specs/2026-09-26-multi-attack-rows-design.md` / 決定ログ=`docs/.private/2026-09-26-multi-attack-rows.md`。**残**=CF パージ後の実機確認。次の段階=同秒内の並べ替え(表示順と計算順を揃えるか要相談)。
### 🔴 次セッション最優先 = MIL-SPEC を完成(2026-09-28 ユーザー決定の順番: **MIL-SPEC → 全体の高速化・軽量化 → 高速化のルール化**=以後のアプリは最初から軽く)。再開手順: `milspec-polish` は origin/main より20件遅れ(同秒3攻撃・高速化①を含む)→ まず origin/main を取り込み(表のファイル1つで小さな食い違い見込み)→ SP2(表)設計を新しい行の作り(行の高さ可変・N段・「+」・行の外枠/中身の分割)で再点検 → そのブランチの TODO.md から再開。MIL-SPEC は後の高速化を難しくしない作りに(行ごとの重い効果=ぼかし/大きな影/常時アニメを避ける)、出す前に perf-tools で重さを測る。
### 🟠 その次 = 全体の高速化・軽量化(軽減表+ハウジングをまとめて)。最後に軽く作る決まり+「新画面は本番ビルドで測ってから出す」を `.claude/rules/` に書く。進め方案=①主要画面を同じ方法で計測(本番ビルド・普通/遅いPC)②効果×手間で優先順位③小分けに出す。**計測ツール一式+測り方の罠=`docs/.private/perf-tools/README.md`**。既知の候補: ⓐ行を足すと「中身が潰れる→行が0.075秒で広がる→アイコンが0.2秒で遅れて追いつく」(行の `duration-75`・アイコンの `duration-200` が高さ/位置にも効く副作用)→ 余計な動きを消す+足した攻撃を0.8秒ハイライト(案提示済・要承認・自分の追加だけ光らせるか要確認) ⓑ軽減の配置・移動でも全行描き直し(行が timelineMitigations/phases を直接購読) ⓒダメージ再計算で攻撃のある行が全部描き直し(damageMap が毎回新しいオブジェクト) ⓓ見えている行だけ描く方式(大きな表・遅いPC・DOM 7万要素) ⓔハウジングは未計測。**済=高速化①(2026-09-28 本番反映)**: 行ごとのダメージ配列が毎回新しく memo 比較をすり抜け全行描き直し(2026-02 から)→ 比較を全 props・配列は中身で/行に渡す関数を参照固定/PC の行を外枠と中身に分割。描き直す行 1511→73・本番(隠すOFF) 0.36→0.26秒・隠すON(既定) 約0.1秒。
### 🟡 MIL-SPEC 全体ブラッシュアップ = ブランチ `milspec-polish`(最新状況は**そのブランチの TODO.md**)。モック最新 v11(`docs/.private/theme-refs/milspec-v11-full.html`)の masaya FB 待ち。SP1 は main マージ済み(2026-09-08)。⚠ **手元の main は origin/main と分岐**(MIL-SPEC の未公開 13 件あり・origin/main 側に Ko-fi 停止/サイドバー余白/同秒3攻撃)。MIL-SPEC を push する前に必ず origin/main を取り込むこと(手元 main をそのまま push しない)。
### 🟡 2026-10-05 AI クローラー対策+AI 検索対応 = 本番反映済(`128da9d2`・AIO 52→72点)。第2弾: /about「運営について」新設(フッター・軽減表/MIL-SPEC の規約メニューの特商法枠を差し替え)・JSON-LD を種類別ブロック+dateModified(ビルド日)・プライバシー/規約から X ログインとメール窓口を削除(窓口=Discord+X の DM)・**寄付は SE 条件 2026-09-16 改訂で明文 NG のため緩和を当てにせず全撤去**(/support・/commercial はトップへ転送・Ko-fi 導線/フラグ/文言削除。プライバシーは「受付を終了しました」の一文だけ残す)。Ko-fi アカウントは masaya が削除済(X に Ko-fi 記載はもともと無し)・本番で5言語×7ページに寄付/特商法/メール窓口の残りが無いことを確認済。/about に「寄付について」(改訂の出典リンク+お礼)・プライバシーから /about へリンク。**Discord 告知は MIL-SPEC 公開時のアップデート告知にまとめる**(運営について新設・寄付終了と経緯・プライバシー更新・AI 検索対応)。**残**: ②CF パージ→AIO 再診断 ③AllMarks も同じ考え方で(別リポ) ④ソフト404(存在しない URL が 200)は別タスク。robots.txt(学習専用11種拒否/検索・回答用6種許可)・トップ専用の canonical/JSON-LD/ボット向け静的本文(index.html の `seo:top-only` 区間。ビルドで区間を除いた `app.html` を作り / 以外は全部これ・api/share の4ハンドラーも app.html を取得)・紹介文5言語をポータル表現に・`public/llms.txt` 新規(以前「ある」と出たのは存在しない URL も 200 で土台を返す誤検知)・sitemap に /housing /stgy。**デプロイ後**: CF すべてパージ → `curl` で / に h1、/miti に canonical 無しを確認 → AIO 再診断(前回52点)・家ページの X カードが崩れていないか確認。既存不具合: `MilspecChrome.test.tsx` 1件は main でも単独で落ちる。
### 🟢 2026-09-01 ハウジング新着通知の絞り込み + 登録時トグル = デプロイ済。**残=本番で: トグル表示/デフォルトON / ON登録→通知来る / OFF・住所非公開→来ない を確認 → テスト物件削除**。設計書2026-08-28。
### 🟡 8/20〜9/1 ハウジング一括=本番反映済(詳細 COMPLETED)。**残**: Discord告知下書き `docs/.private/2026-09-01-discord-update-draft.md` を masaya が投稿予定(v2確定)/ Allmarksリージョン混在は未検証 / カード最適化Phase1・「トップ」再タップスクロール=実機確認のみ。
### 🟡 SEOソフト404対策: CF Cache Rule は `/housing/(listing|housinger|tour)/` `/h/` 追加済(2026-09-04)。**残**: `/share/*` の CF ルール検討 / Search Console 再検査+インデックス登録。
**🟡 優先度低**: ハウジンガーページが全物件共通の1個のversionカウンタ参照 → 他人の物件編集で自分のハウジンガーCDNキャッシュが割れる。改善案=専用versionカウンタ分離。／ **ハウジンガーOGPカード**=完成扱い(2026-08-17)、`.claude/worktrees/housinger-ogp-card-redesign` の未コミット3差分は不採用・**触らない**(worktree remove ロック中・実害なし)。
### ✅ 直近の本番反映・確認済み: マイページ/複数投稿URL Batch2/編集画像管理/探すランダム化+初心者タグ/コストハードニング+実機FB9件/P0-P3耐性+住所非公開/big3(7-13)+競合コピー修正/D住所ゲート/旧UI掃除/ツアースマホ#1#2#3(`68e13644`+`482e9a94`・iPhone確認OK)。詳細=TODO_COMPLETED.md。
### 🟡 ハウジング中期タスク(2026-07-20 棚卸し)
- 🎨 詳細ページ紹介文レイアウト改善(ブレスト保留・未実装): 設計書=`docs/superpowers/specs/2026-07-20-housing-detail-description-hover-reveal-design.md`(3行クランプ+ホバー全文)。/ e PF レイアウト調整(共有ボタンのみ実装済・admin タグ生ID軽微残)。
- 🏠 公開前 残タスク(網羅=`docs/.private/2026-07-15-housing-release-remaining-tasks.md`): ブロッカー=①モデレ判断待ち(要brainstorming)②Discord告知③中韓後追い(用語CSV=`docs/.private/2026-07-17-housing-terms-ja-en-ko-zh.csv`)。忘れず=最初の家でもDCテレポ案内/30日物理削除cron(listing用)/GCPコスト実測→G5。

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

- **🆕 vitestフルスイート実行が途中で本当にハングする(2026-08-10再確認)**: パイプ起因の見かけ上のハングとは別に、ドキュメント通りの安全な手順(ファイル出力・`npm test`)でも約160秒CPU消費した後に完全停止する実例を確認。[[reference_vitest_vmthreads_hang]]記載の「vmThreadsが実タイマーを残すテストを終了できない」根因が未解決のまま残っている(App Check起因分は対処済だが別のテストが同様の実タイマーを残している疑い)。ユーザー判断: 今すぐ深掘りせず別セッションで着手。対応時は該当メモリの「未解決の根治候補(forks復活/Node LTS降格)」から検討。それまでは全体テストの代わりに変更ファイルに絞った実行で運用する。**2026-09-28 追記**: 全体テストは約24秒で完走するようになった(3回)が、`src/__tests__/housing/HousingerPage.test.tsx` が全体実行のときだけ時々 1 件落ちる(2回・毎回違うテスト・単独では 23/23 合格・自動選択の非同期待ち不足の疑い)。同日 `aee9107b` で通常の全体テストがまた固まった → `npx vitest run --pool=forks` は完走(550/551・落ちたのは `MilspecChrome.test.tsx` 1件=単独では合格)。
- **#59 残(公開後OK)**: ESLint `react-hooks/rules-of-hooks` 有効化(hook違反→React #310 本番真っ白・tscは通る) / 「表を展開する」click 394ms(全展開レンダー) / メモリ振れ600-800MB(DOM 73,060個・将来 react-window)
- **🅿 スプシ取込スマホ/「あらゆるスプシ対応」=棚上げ(2026-06-30 ユーザー判断・スマホは取込UI非表示化済)**: 残設計課題=②フェーズ貼付ガイド/未貼付ガード ③全選択コピーの図解(優先低)。[[project_spreadsheet_mobile_grid]]
- **旧・同期バグ2件**: 同期不安定(2026-04-29 軽減配置→タブ閉→別端末で消失等の複合症状) / ローカル削除→即同期で復活(2026-04-28 `deletePlan` の `_deletedPlanIds` 漏れ)
- **共同編集 再接続時の「一部欠け」消失**(2026-06-18・先送り合意): 離脱前復帰で自分の直前ドロー等だけ欠けた状態を返し空上書き防御(まるごと空のみ保護)をすり抜け。直しA(離脱側=確定待ち・安価)/B(再接続側=補完・根本)。詳細=docs/.private/2026-06-18-collab-reconnect-partial-loss.md。Undo 機能とは別件。
- **計算/描画**: EventModal 計算肥大(`handleCalculate`分割+calculator.ts共通化) / CRIT 倍率ステータス連動(`getCritMultiplier(level)`+IL切替UI) / Timeline 描画 120FPS(要素多いと 8.33ms 超え)

---

## バグ・不具合 (要修正)

- **✅ 2026-09-04 ハウジングツアー スマホ実機観察(masaya)**: #1 Allmarks見切れ / #2 開始ボタン押せない / #3 住所消失・PC見た目 = 全て修正・デプロイ・実機OK(`68e13644`+`482e9a94`)。#4 スレッドツイート読取=却下(API必須)。**残**=Safari タブ破棄耐性(Layer2 = store persist・別判断)。詳細=`docs/.private/2026-09-04-housing-tour-mobile-observations.md`。

- **🆕 2026-08-14実機報告2件(未調査)**: ①メモ機能(表中に自由記述)がスマホの共同編集表で表示されている(`MemoOverlay`にモバイル非表示条件が無い、新規作成操作のみモバイル無効化されていた可能性)。②モバイル軽減表「連動」エフェクト表示、指を離す前に(スクロール中のはずなのに)アイコン表示へ勝手に戻ることがある(スクロール重さ起因の取りこぼしの可能性、要検証)。
- **🔮 8.0スキル大幅変更の改修準備**(リボーン/エボルブモード追加予定→スキルシステム改修・大物・情報出揃い次第。着手時brainstorming。詳細=docs/.private/2026-06-20-skill-modeling-notes.md)。**🔵将来=スキル効果解決の窓口統一**=level+mode→正効果に解決する関数1つに集約し全~30箇所を通す(同id版違いバグの真の根治・コードのきれい。2026-06-22`_base`化が第一歩。競合resourceTracker/CD recastRow/計算calculator 未配線・autoPlanner配線済)。**ここに畳む候補(2026-06-30判断・価値低)**=スプシ取込で技名をコンテンツlevelの版に解決(例 シャドウヴィジル→Lv80はシャドウウォール)。単発実装は非推奨(スキル線リンクがデータに無く窓口統一が前提・発動はユーザーの取り違えのみ)。※リビデ正確モデル化①と表展開トグル③は2026-06-20完了(COMPLETED)。
- **低(動作影響なし)**: FFLogs 英語ログ/無敵反映/オートプラン同一技/パルス設定スライダー/ヘッダー縦罫線
- **Phase 2 follow-up**: api/popular `viewCount` 削除/en・ko privacy_section1_auto_items bullet バグ/`MitigationSheet.copyPlan` POST 失敗時 localStorage 残留 (既知legacyテスト失敗5件=TopBar4+HousingWorkspace1は撤去予定・非アクション)。**🆕 EphemeralAddPanel.test 7件失敗(2026-07-17発見・環境依存)**: happy-domが:3000へ実fetch(ECONNREFUSED)・devサーバー起動中のみ緑だった疑い。d77ca25f時点でも同一失敗=直近変更と無関係を切り分け済。要モック修正。
- **🆕 共同編集の残**(詳細→`.private/2026-06-26-collab-issues-observed.md` / `2026-06-25-deleted-share-link-notice.md`): 実使用バグ A重い/Dモーダル=✅本番済・C ドット数≠実人数=🟦見送り(残=全行未仮想化#59は別タスク) / 削除済み共有リンクの空TL(狭いプライバシー窓・方針A案=deletePlan後revoke+「失効」表示で確定・今後分のみ・急ぎ不要)。

---

## 未着手・将来計画

- 多言語/UI: ハウジング言語対応・AA 名統一 / モーダルアニメ・スマホ+タブレット最適化・SVG アイコンアニメ・紹介 PV / 共同編集カーソル ON/OFF トグルが枠外はみ出る(状態テキスト明示・低優先)
- インフラ: shared_plans クリーンアップ(**2026-06-25 ユーザー近々対応希望**=「表を共有」リンクのサーバー残骸GC・バックアップとは別件)/CSP unsafe-inline/Sentry/**collab使用量 自動監視→Discord通知 cron**(公開時はA=今のまま[部屋8〜20席+冬眠+COLLAB_DISABLED 手動+$0自動停止]・コスト青天井無し。Bの運用ツール群は公開後追加・2026-06-12決定)
- 新機能/デッドコード: Floating Timeline(Tauri v2)/FFLogs 精度/SA 法改善/詠唱バー注釈/public/icons/削除/ハウジング split-tweet // Lenis 削除/ハウジング背景動画の画面サイズ別出し分け
- ⛔ **再着手しない**: 表の情報列固定(横スクロール・2026-06-18 撤回。詳細→COMPLETED) / LICENSE 追加([[feedback_lopo_license_stance]]・真の防御=data+コミュニティ+継続運用、投資するなら計算ロジックの wasm 化) / **ボス2体区間の個別デバフ軽減指定**(2026-08-12ユーザー判断・見送り。現状データモデルに敵/ボスの概念が無く、型定義・EventModal・Timeline描画・resourceTracker競合判定・collab同期・スプシ取込に横断的な改修が要る大規模案件と判明したため)

---

## アイデア / 並行 / バックログ

- **新着ハウジングのツイート下書き通知**(本番稼働中・設計書=`docs/superpowers/specs/2026-08-28-housing-new-listing-tweet-draft-notification-design.md`)。通知対象=公開かつ「Xでの紹介を許可」ON のみ(住所非公開/許可OFFは来ないのが正常・2026-09-29夜の12件連続登録は全件これで通知なし=取りこぼしではないと確認済)。**連続登録時のツイート方針(2026-09-30 masaya 合意)**: 同じ人の連続登録=その人のハウジンガーページを紹介するまとめツイート1本 / 別々の人が重なった=1件ずつ紹介のまま1日1〜2件ずつ間をあける。将来案=同じ人の連続登録を通知側でまとめ下書きにする(未着手)。既知の小弱点=Webhook失敗時は送り直しなし(ログのみ)。
- **🆕 ツアーPiP機能**(ユーザー発案2026-07-18・要brainstorming): ツアー中に小窓(Picture-in-Picture)で操作。表示=次の目的地の画像(オンオフ可・デフォルトオフ)/住所/コメント/ナビ/前へ/見学開始(押下でタイマー表示)/次へ(最後は完了)。**超簡易モード**=ボタン3つだけ表示に切替可。技術注意: Document PiP APIはPC Chrome系のみ・iOS Safari非対応→スマホの代替表現要設計。
- アイデア: メモのURL→**YouTube等その場再生(iframe・サムネ方式)**(クリック開きは✅済)・こだわりトップ・配置アニメ・OCR・横型タイムライン・Gemma AI
- **機能ブラッシュアップ案9件**(詳細=docs/.private/2026-06-15-feature-ideas-batch.md)。✅済=③軽減競合逆方向警告 / ⑤Logsインポート上書き・追記 / ⑥有名スプシ取込 (+列グリッド取込 §9.7 `85bb7d8c`)。**残**=①同時刻3+イベント ②スマホ/タブレット最適化(ボトムナビ/FAB・ボトムナビの透け視認性改善=ハウジング側で不透明化済みの型を移植[2026-07-16]) ④MAXHP-10%でダメージ黄 ⑦敵攻撃 or(2択) ⑧管理画面 攻撃ID保持で任意言語翻訳(GUID保持済・仕上げのみ) ⑨メモに動画URL→iframe。取り込み導線チューザー統合は将来。
- **🆕 Wiki型タイムライン共同編集**(大物・詳細=docs/.private/2026-06-16-wiki-collaborative-timeline.md): ログインユーザー皆で1コンテンツを Wiki 編集(オーナーロック可)。既存 collab 資産活用+公開編集モデルは別設計。⑧を先に効かせると相性良。着手時 brainstorming。
- **🆕 共同編集の部屋に「日程調整」**(ブレスト一部合意済・詳細=docs/.private/2026-06-16-collab-fixed-group-scheduling.md): collab ON 時だけ調整さん方式(候補日×メンバー○×△)。識別=名前自由入力(PII なし)・閲覧者も回答可。Phase2 で攻略進捗バー/作戦ボード温存。次=brainstorming 継続→spec。
- YouTube概要欄住所自動入力は2026-08-17実装・08-18不具合修正・本番反映済み(→TODO_COMPLETED.md)。副産物の気づき: `parseHousingFromText`は「Alexander」「Carbuncle」等、実在サーバー名と同じ単語が別文脈(討伐名/ミニオン名等)で使われると別DC跨ぎの誤爆で全項目が空欄になる既知の安全動作あり(2026-07-10に個別対応から辞書側不変条件の方針へ切替済み、[[feedback_no_speculative_alias_data]])。将来の一般改善案として「タイトル【】部分を抽出対象から除外」が考えられるが、Twitter/OGP/YouTube共通の中心ロジックに触るため別タスク扱い。
- 方針: コンテンツ追加=`add-content`→`seed-contents.ts`/スキル正本=Firestore/SNS タグ `#LoPo #FF14 #BuildInPublic #AISelection`
- 並行: マイコラージュ(収益化・28日まで凍結)/ハウジングは MUL 対象外で広告 OK
- バックログ: npm audit/a11y/SE 利用規約/GDPR/FFLogs アイコン/MTST 分け/みんなの軽減表/ローカルデータ IndexedDB 移行(任意・Safari7日消去はIDBでも起きるので A 併用前提)

<!-- When compacting, always preserve: 現在のタスク、変更中のファイルパス、本ファイルの「現在の状態」セクション -->
