# LoPo 開発 ToDo

> **維持ルール (必読)**:
> - **100 行以内を目標**に維持
> - 完了タスクは即 [TODO_COMPLETED.md](./TODO_COMPLETED.md) へ移動
> - 大きな設計議論 / 詳細未確定の議題は `docs/.private/YYYY-MM-DD-{topic}.md` に集約
> - 確定済み設計方針は [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md)、 管理者手順は [ADMIN_SETUP.md](./ADMIN_SETUP.md)
> - **セッション終了時に必ず本ファイルの行数を確認 → 超過していたら整理**

---

## ✅ データ破壊バグ 緊急対応 (2026-06-16) — 根治2件デプロイ済 + PITR復旧完了・PITRオフ済

**根治2件 本番デプロイ済 (main eb1e49b)**: ①非collab=保存先を持ち主(`_loadedPlanId`)に固定(`persistWorkingStore`/`commitNewPlan`)で他プラン破壊を根治(455cc20/23eb334/5e18a33) ②collab=create冒頭で `useCollabSessionStore.disconnect()` してから初期化(別部屋への委譲全消しを根治・collabCreateGuard.test.ts)。詳細は git log + [TODO_COMPLETED.md] 参照。

**PITR切り分け＆復旧 完了 (2026-06-16)**:
- PITR を一時ON(earliestVersionTime=**06-16 04:44 UTC=13:44 JST**)。**復元可は有効化後に空化した被害のみ**と判明。正しい過去読み=**read-only tx + readTime**(getAllは無効。memory `reference_firestore_pitr_disabled`)。新規スクリプト: `probe-pitr-timeline.ts`/`sweep-pitr-losses.ts`/`restore-from-pitr.ts`/`set-pitr.ts`。
- 切り分け結果(直近3件): **固定 plan_31aee72d=15:32 JST に197軽減を一発全消し→PITR直前版(v459)で完全復旧** ✅(書込前backup=docs/.private/backups/)。UMAD ×2(plan_6b3fe52e/plan_e136a1fb)は**境界前に空化+兄弟コピー無し→復元不能**(本人再構築のみ)。
- **全件スイープで境界後の新規被害=残0**(取りこぼし無し)。兄弟復元 HIGH=0/REVIEW=5(別戦闘疑いで方針どおりスキップ=本人自己復旧)。
- 後始末済: **PITRオフ**(コスト停止・日次/週次バックアップは残置) / **recovery-0608 削除済**(課金停止)。

**監視項目(低優先)**: collabで稀に単発軽減が同期取り合いで落ちる一過性グリッチ。再現せず。再発したらYjs同期堅牢化。

**🔴 フォロー最優先(機能・次セッション)**: **自己対処できる管理画面**=①緊急キルスイッチ(Firestoreフラグ=キャッシュ客にも即効・再デプロイ/ドメイン削除不要で保存停止+メンテ表示) ②データ健康ダッシュボード(軽減0×イベント有を監視) ③/admin内に緊急手順書。ユーザーが私無しで止められる状態に。

---

## 現在の状態 (次セッションはここから読む)

- **✅ 2026-06-17 軽減競合の双方向警告+画面外ガイド矢印 完成・main マージ&本番デプロイ済**: 機能アイデア③。同じ軽減のCD被りを `findSameSkillCdConflicts`(resourceTracker)で常に派生検出→競合アイコンを黄色脈動(既存 `animate-conflict-pulse`)。前方向(既存CD中に重ねる)も**赤の見た目のままクリック解放**(`conflictOverride`)。**ドラッグも競合位置へ許可**(`ALLOW_DRAG_INTO_CONFLICT=true`・false で旧ブロック復活=保持済み)。競合相手が画面外なら**列中央の上端∧/下端∨にシェブロン矢印**(`ConflictOffscreenArrows`)+クリックで自動スクロール(PCのみ)。「置いた時は既存の相手だけ光る」=`lastPlacedMitigationId`(セッションのみ)で除外、開き直すと両方(自己責任)。dev列幅スライダーも撤去。設計=specs/2026-06-17-mitigation-conflict-bidirectional-warning-design.md / 計画=plans/同名。全48競合テスト+build緑。**🔴 残=本番実機確認(ユーザー)**: 配置/ドラッグ両方で競合脈動+矢印、解消で自動消滅、ライトモードの矢印。
- **🔵 進捗お祝い試作は `feat/progress-celebration-proto` に温存(未マージ・本番非露出)**: 軌跡=青い発光玉+パルス風の短い尾(一定速度・PERIOD4-8秒クランプ)まで実装。次やるなら記録UX/統計/スケジュール or クリア踏破演出。`npm run dev:progress`→/miti。
- **✅ 2026-06-17 管理画面リデザイン 全18ルート完了 (branch `feat/mobile-bottom-nav-redesign`・未push・ビルド/AdminPageテスト緑)**: 共通シェル `AdminPage`(固定ヘッダー=ページ名+件数+主要操作 / 本文だけスクロール・装飾なし=A案)へ全14ナビページ移行+ウィザード4本は外側スクロール容器化。管理画面のみフォント M PLUS 1(`[data-admin-page]`スコープ・本体不変)。AdminLayout main を `overflow-hidden flex-col` 化(各ページが自前スクロール)。サンドボックスのクラッシュ(type付きtemplates横取り)も修正。設計=specs/2026-06-17-admin-redesign-design.md / 計画=plans/2026-06-17-admin-redesign.md。**🔴 残=本番デプロイ後の実機確認(ユーザー)**: ①ヘッダーが詰まらないか= backups/logs(フィルタ)・translations(保存+進捗)・ugc(検索) ②2カラムのスクロール= skills/servers ③ウィザード4本のスクロール ④全ページ固定ヘッダー/フォント。**フォロー(低)**: AdminStats/AdminSkills の見出しは直書き文字列(既存i18n負債・別途キー化) / サンドボックスの data 系ページ fixtures 未整備(stats等は読み込みエラー表示=想定)。
- **✅ 2026-06-16 管理画面サンドボックス(開発専用ツール)完成 (branch `feat/mobile-bottom-nav-redesign`・全8タスクTDD・未push)**: 管理画面をデプロイ/ログイン無し・本番非接触でローカル確認する道具。`npm run dev:admin` で起動→`/admin/templates` が60件ダミー入りで表示(ログイン不要)。通常 `npm run dev` はログイン要求(暴発なし)・本番ビルドは dead-code 除去で開発コード0(dist実測確認済)。実装本体=`src/dev/sandboxMode.ts`+`src/dev/adminSandbox/`(fixtures/store/mockApi/bootstrap)、本体改変3箇所(apiClient分岐/useAuthStore認証スキップ/main.tsx起動)は全て `import.meta.env.DEV && isAdminSandbox()` ガード付き。設計=specs/2026-06-16-admin-sandbox-design.md / 計画=plans/2026-06-16-admin-sandbox.md / 詳細 memory `reference_admin_sandbox`。(この道具で上記リデザインを実施済)。
- **✅ 2026-06-16 バグ修正3件 (branch `feat/mobile-bottom-nav-redesign`)**:
  - **【本命・ユーザー報告】軽減追加モーダルでチャージ技のリキャストが出ない (push済 or 本コミット)**: 表クリックで出る `MitigationSelector` で、通常技は「CD残○○s」が出るのにチャージ技(星天交差/ディヴァインベニゾン等)は秒数が一切出なかった。真因=`validateMitigationPlacement`([resourceTracker.ts](../src/utils/resourceTracker.ts))のチャージ分岐が早期returnし通常CD表示経路を通らない+実効1チャージ(Lv88未満)では文言ゼロで原因不明だった。**A案で修正**: 新設 `getTimeUntilNextCharge` で次チャージ秒数算出→ effMax=1は通常技と同じ「CD残○○s」/ effMax≥2はバッジ維持+回復中は「次チャージ○○s」(1/2=配置可・中立色併記、0/2=配置不可・メッセージ)。`requires`(窓)系は対象外。i18n `next_charge_in` 4言語追加。全recast系チャージ技に一貫適用(タンクのオブレーション等含む)。TDD: chargeLevelGate.test.ts に4ケース追加=11緑。**スクショ確認は初回チュートリアル多重オーバーレイで自動化困難=未取得→実機確認はユーザー**。
  - **リキャスト行(ヘッダー)クロックが配置直後に出ない (push済)**: ※当初これを報告バグと誤認して修正。実在の別バグなので残置。下記バグ欄 ✅ 参照(Timeline.tsx syncRecastRow)。
  - **スマホ通知モーダルがメニューシート裏に隠れて既読不可 (push済)**: `SystemNotificationModal` の z `z-[100]`→`z-[9999]`(シート z-301/ナビ z-400 の上へ)。PCは常設サイドバーから開くので可視、スマホはメニューシート内ベルから開くため裏に隠れていた。Playwright(モバイルvp+実Firestore通知)で前面表示+既読ボタン可動を確認。

- **✅ スマホ最適化 A(ボトムナビ再設計)+ 共有タブ B + 追加修正 完了・本番反映済 (2026-06-15〜16・main `150bf34`〜)**: ナビ5タブ化(メニュー/インポート/カンペ/共有/ログイン)・ツール→インポートシート・Undo/Redo常設・パーティ/自動ボタンのメニュー集約・MY JOBハイライトトグル・☕支援可視化(MobileBottomSheet `fillContent`)・共有タブ(`useShareFlow` 1ソース化・PCミラー)・初回ガイド文言更新。スキルデータ=チャージのレベルゲート(`chargeMinLevel:88` DB/星天交差)+学者「深謀遠慮」追加(seed済・手順 memory `reference_skill_add_rollout`)。「共同編集2択が出ない」=バグ無し(未ログインはコピー直行が設計通り [shareView.ts:11](../src/lib/collab/shareView.ts#L11))で決着。設計=specs/2026-06-15-mobile-optimization-design.md・2026-06-16-mobile-share-tab-design.md。詳細ログ→[TODO_COMPLETED.md] 移行候補。
  - **🔴 残=本番スマホ総点検**(ユーザー実機・デプロイ&seed済): ①共有タブ(**ログイン状態で**2択→一緒に編集→部屋発行)②パーティ/自動ボタン③ガイド文言④Lv80コンテンツでDB・星天交差が1チャージ⑤深謀遠慮の表示⑥③参加ヘッダー(以前からのデプロイ後確認分)。
- **✅ 2026-06-15 セッション分 本番反映・実機OK**: 挑発タンクスイッチ / 通知ベル(赤ドット + 折りたたみ時ハンドルにベル) / タイムライン種別クリックループ・デバフ軽減不可・赤箱 / 支援ページ刷新 / 共同編集 公開後サニティ。全て本番デプロイ済・ユーザー実機確認済。詳細=[TODO_COMPLETED.md](./TODO_COMPLETED.md)。
- **✅ Cloudflare 前段化 本番稼働中 (2026-06-12)**: apex `lopoly.app` を orange 化・静的のみ Cache Rule・全検証緑(SSL Full strict / CF-RAY出る / /assets・manifest・registerSW は MISS→HIT / /api・/sw.js は DYNAMIC素通し)。原因=急増 × PWA で1訪問十数個の静的リクエスト。詳細=[TODO_COMPLETED.md](./TODO_COMPLETED.md) + [docs/.private/2026-06-12-cloudflare-fronting-handoff.md](./.private/2026-06-12-cloudflare-fronting-handoff.md) + memory `project_cloudflare_caching_priority`。
- **📊 Edge Requests 実測完了 (2026-06-15・Vercel 課金API `/v1/billing/charges` FOCUS 形式で取得・手順 memory `reference_vercel_billing_usage_api`)**: Cloudflare前段化で **555,869/日(06-11)→ 約1万/日**(06-13=9,560 / 06-14=11,289)に激減=約40〜50分の1。**33K/日閾値を大きく下回り(約10K/日・月換算313K=Hobby 1M枠の約31%)、約3倍の余裕**。Function Invocations 約1,800/日・Fast Data Transfer ほぼ0 も無料枠内。Edge Requests cost は$0(Pro枠内・超過課金なし)。**結論=Hobby に戻して安全。** 急増再来時も前段あり3倍まで余裕、超えそうなら Pro 再upは即時。
  - **🗓 ユーザー判断=今週末(6/20-21)の動向を見てから下げる。【セッション開始時にこの行を見たら最優先で実行】= 上記 memory `reference_vercel_billing_usage_api` の手順で Edge Requests を再実測し、週末トラフィックでも 33K/日以下なら「Pro→Hobby ダウングレードして安全」と提案する。** 操作自体はユーザーが Vercel Dashboard→Settings→Billing→Plan で実施(1クリック可逆)。
  - **⏰ 課金サイクル=6/11〜約7/12(Pro料金記録が7/11-13で日割り終了=次回更新は7月中旬)。7/11 より前に下げれば次の月額を回避。週末判断で十分間に合う。**
- **ブランチ(その他作業)**: main (origin と同期済)。直近の完了は [TODO_COMPLETED.md](./TODO_COMPLETED.md) 参照 (動画モーダル / OGP・memo / YouTubeライブ / Cloudflare Worker)。
- **✅ 同期安定化 Step1+2+① デプロイ済 (2026-06-03 本セッション)**: 業界水準ソフトデリート(墓標)+墓標ベースマージ+同期インテント永続化を TDD で実装・本番投入。「別端末で消失/削除→復活/リロードで一瞬復活」を根治。**実機検証=Step1+2 OK (消失/復活なし) / ①は"一瞬復活ちらつき消滅"を要確認**。Firestoreルールはデプロイ済。新規 `src/lib/mergePlans.ts`・`src/store/planPersist.ts`、`planService.ts`/`usePlanStore.ts` 改修。詳細・残タスクは **[docs/.private/2026-06-03-realtime-collab-and-sync-notes.md](./.private/2026-06-03-realtime-collab-and-sync-notes.md) Phase5+6**。残=**Step3 unload確実化**(updatePlanの読んでから書く廃止・トレードオフ要設計) / 墓標GC cron。**Step4=共同編集はブレスト完了→設計書化済**(下記バックログ参照。onSnapshot単独でなくYjs+Durable Objectsの本格Cに格上げ)。共同編集本体はコスト有界化ゲート後。
- **🔍 デプロイ済・要実機検証 (残)**: ① **FFLogs 全滅(ワイプ)ログ** = 全滅ログの pull URL (`#fight=N` 付き) で実機検証 + 既存キルログ回帰 (`src/api/fflogs.ts` `selectFight`、設計 specs `2026-04-05-fflogs-import-v2.md`) ② **FFLogs トークン 502** = どのキーがなぜ落ちてるか特定 (vercel logs tail で 401/429/5xx 判別→必要なら本番メインキー差し替え、`src/lib/fflogsTokenFailover.ts`)。
- **中優先フォローアップ=動画 CF エッジキャッシュ**: コスト緊急性は否定済 (月13万訪問でも約¥2,200)。目的は レイテンシ/堅牢性/Twitter 取得回数削減。実装=Worker で full mp4 取得→Cache API→Range slice で 206 (アプリ変更ゼロ)。**Range×cache は hotfix21 地雷=seek 検証必須** ([[reference_vercel_edge_range_cache]])。
- **方針 (2026-05-27 確定)**: **α 公開期限撤回**、 1 セッション 1 タスクで丁寧に進める。 **デザインは 1 つずつ実機を見ながら一緒に** (大規模一括はしない、 2026-05-28 ユーザー再確認)。 画像も動画も全部「外部 URL 直接 + 画面内自動再生」 に統一。 詳細 memory `project_housing_phase_status`
- **次セッション最優先**:
  1. **本セッション分の実機確認** ← デプロイ後。 (a) 画像 aspectRatio: localhost or 本番で Twitter 写真ツイ登録 → カードが写真の縦横比で表示・スクロールでガタつかないか (縦長→縦長カード)。 既存 listing は寸法なしで自然比フォールバック、 **新規登録のみ CLS ゼロ**。 (b) リデザイン全体 / フィルター chip rectangle 化 / 各モーダルの新ガラス感
  2. **「通報」 文言全体見直し** (他箇所まとめて。 自発的通報モーダルは文脈上 OK)
  3. **§3.8 残りの実機検証** (重複 drop でツアー自動追加 + トースト / 単独 listing で section 非表示)
  4. **Phase 2-6 「📅 1 ヶ月以上更新なし」 バッジ** (前々セッション hook 再利用)
  5. **通知 UI/UX 磨き**: listingTitleSnapshot が addressKey raw → `formatHousingAddress` 経由へ
  6. **split-tweet 対応** (画像ツイ + 住所リプ別 URL、 設計書 §8、 論点詰めてから)
- **その後**: 既存テスト物件一掃 + コールドスタート (ユーザー作業) → アプデ告知 (#59 + ハウジング α)
- **保留**: マップビュー実装は止まっている (ユーザー認識済、 リストビューで完結する設計なのでリリースブロッカーではない)。
- **LICENSE は追加しない方針** (memory `feedback_lopo_license_stance`)

---

## Claude 並行作業 (ユーザー実機確認中に進める安全タスク)

- **テスト追従** (フォーム改修で確実に落ちるもの): `HousingRegisterAddressFields` / `HousingRegisterView` / `HousingRegisterModal` / `SystemNotificationBar` (#59 title 仕様)
- **アプデ告知文 最終化**: 前セッションでドラフト提示済 (Discord ja のみ + システム通知 ja/en、 ko/zh は ja コピー)、 公開タイミングはユーザー判断待ち
- いずれもユーザー操作不要、 Claude が prod を壊さず進められる

---

## #59 残課題 (新規発見、 公開後対応 OK)

- **ESLint `react-hooks/rules-of-hooks` 有効化** (今回 hook 違反 → React #310 で本番真っ白事故。 build (tsc) は通ってしまう、 ESLint で push 前検出したい)
- **「表を展開する」 click handler 394ms 重い** (#59 計測ログから判明、 別ボトルネック。 フェーズ全展開時の React レンダー時間)
- **メモリ振れ 600-800MB の本質改善** (DOM 73,060 個由来、 将来仮想化 react-window で対処。 sticky/行またぎ調整必要で大改修)

---

## ハウジング Phase 3 残り (α 公開後対応)

- **#60 残課題**: UI コンポーネント test 追従 (HousingRegisterAddressFields / HousingRegisterView / HousingRegisterModal — フォーム改修で確実に落ちる) / カードデザイン本格刷新 (Allmarks 風) / マップ実データ化 + `APARTMENT_SPOT[area]` 定義 / ko/zh の翻訳実値
- **タグ仕様全面刷新** (2026-05-27 ユーザー発案、 詳細は [docs/.private/2026-05-27-tag-system-redesign.md](./.private/2026-05-27-tag-system-redesign.md)): ①公式 FF14 タグ + ②シーズン/主要イベント + ③個人タグ (1 ユーザー 1 タグ制約) の 3 カテゴリ構成。 「好きなハウジンガーの家だけのツアー」 が組める文化的価値が中核。 軽量モデレーション (通報→削除依頼→無対応で自動非表示)
- ④ **リッチメディア化** (複数画像 + 動画埋め込み + ビューポート内自動再生): Allmarks 知見流用 (memory `reference_allmarks_mycollage`)。 ①複数画像をホバー/全切り替えで閲覧 ②詳細で動画埋め込み (**CSP に video.twimg.com 追加必須**) ③ビューポート内自動再生=動画最大3本/画像は性能制約なく全切り替え
- **通報モデ業界水準ロードマップ** (2026-05-26 確定、 詳細 [docs/.private/2026-05-26-housing-moderation-roadmap.md](./.private/2026-05-26-housing-moderation-roadmap.md)。 6 月以降開発空き対策で詳細別ファイル化):
  1. **Audit log** (誰がいつ誰の通報をどう処理したか記録、 法的トラブル + サポート問い合わせ予防、 1 ヶ月以内推奨)
  2. **30 日物理削除 cron** (Phase 3 既載、 法的「削除依頼から 30 日以内に削除」 約束するなら必須、 1 ヶ月以内推奨)
  3. **異議申し立てアプリ内 UI** (現状 Discord 連絡限定 → Discord 持ってない人を排除、 2-3 ヶ月以内)
  4. **BAN ポリシー自動化** (累積 N 回通報されて却下されない物件は強制 BAN 等、 2-3 ヶ月以内)
  5. **NSFW/griefing 高優先度キュー** (`severity: 'high'` は既に通報側で付与済 ([_reportListingHandler.ts:77](../api/housing/_reportListingHandler.ts)) だが /admin の並び順に反映されてない、 1-2 ヶ月以内)
  6. **Reporter scoring** (信頼性低い reporter の通報を weight 下げる、 嫌がらせ通報の自動希釈、 3-6 ヶ月以内)
- **HousingCardExpanded 撤去判断** / ツアー同期 Firestore 化 / Cloudflare 前段化
- 細かい修正: `fieldState.confirm()` バグ、 dead code 撤去、 AddressFields renderBadge prop 化、 photo `alt`、 SNS rate limiting、 通知 ✕ の見た目磨き

---

## 知財防御 (2026-05-27 方針確定)

LICENSE 追加は**しない** (memory `feedback_lopo_license_stance`)。 真の防御 = data + コミュニティ + 継続運用。 もし将来「読まれにくくする」 投資をするなら **計算ロジックの WebAssembly 化 (Rust → wasm)** がコスパ最良 (= UX 犠牲ゼロ、 minify JS よりリバース困難、 工数 1-数週間)。 β 以降の余裕で検討。 server 化は 70-200ms 体感劣化で見送り。

---

## 既知の残課題 (中規模、 別セッションで設計から)

- **同期不安定** (2026-04-29): 軽減配置→タブ閉→別端末で消失等の複合症状
- **ローカル削除→即同期で復活** (2026-04-28): `deletePlan` の `_deletedPlanIds` 漏れ
- **EventModal 計算肥大**: `handleCalculate` 分割 + calculator.ts と共通化
- **CRIT 倍率ステータス連動**: `getCritMultiplier(level)` + IL 切替 UI
- **Timeline 描画 120FPS** (2026-05-14): 要素多いと 8.33ms 超え

---

## バグ・不具合 (要修正)

- **✅ 根治実装完了 (2026-06-12・branch `feat/collab-yjs-binary-persistence`・push/deploy 保留)**: 旧🔴データ破壊バグ「キャッシュ全消し desync で空スナップショットが非空プランを上書き→Firestore 伝播」を業界標準パターンで根治。根本原因=plan.data と mitigation-storage の**二重 localStorage が desync** + 書込/読込ガードの**非対称**(書込は currentPlanId 非null のみ条件・空チェック無し / 起動時に currentPlanId の data を空 miti へ読込む経路が無い)。修正=**①空上書きガード**(`updatePlan` 中央経路で「非空データを空データで上書きしない」= `src/lib/isEmptyPlanData.ts`・[usePlanStore.ts:152](../src/store/usePlanStore.ts#L152)) + **②起動時ブートストラップ**(hydration gate・`src/lib/bootstrapMitigation.ts`・Layout マウントで desync 検出時に plan.data を miti へ復元)。両者は Zustand persist の non-empty check / hydration gate (Redux PersistGate 相当) の標準。TDD: isEmptyPlanData 6 + 空上書きガード 6 + bootstrap 5 緑。全1653緑(既知5のみ)/build EXIT=0。**復旧済データ**=墓標 06-10 の 129 軽減を `scripts/restore-fixed-plan.ts` で復元済。残=③PITR 有効化検討(任意)。
- **✅ リキャスト行(ヘッダー)のクロックが配置直後に出ない 根治 (2026-06-16・push済)**: ※当初ユーザー報告(モーダルのリキャスト)と取り違えて着手した別バグ。実在するので残置。真因=`RecastRow.update()` がスクロール時とスクロール effect マウント時しか呼ばれず、配置 effect の deps([Timeline.tsx](../src/components/Timeline.tsx) syncRecastRow 効果)に `timelineMitigations` が無かった→新規配置アイコンはデフォルト `--cd-display:none` のまま、スクロールするまで出ない。**修正=`syncRecastRow` を useCallback 抽出し `timelineMitigations` 変化時にも即再同期**。Playwright実機で「配置直後スクロール無し」→修正前 disp=none/修正後 disp=flex を確認。recastRow.test.ts にチャージ技ケース追加。**ユーザー報告の本命(モーダルのリキャスト)は上の「現在の状態」3件目を参照**。
- **低 (動作影響なし)**: FFLogs 英語ログ / 無敵反映 / オートプラン同一技 / パルス設定スライダー / ヘッダー縦罫線
- **テスト (既存failure・本番無影響)**: `src/__tests__/housing/TopBar.test.tsx` 4件 + `HousingWorkspace.test.tsx` 1件が落ちる (2026-06-03 確認、FFLogs修正前から存在)。HousingWorkspace は jsdom が youtube-nocookie embed を実 fetch→abort する環境依存。TopBar は要調査。
- **Phase 2 follow-up**: api/popular の `viewCount` 削除 / en/ko privacy_section1_auto_items bullet バグ / `MitigationSheet.copyPlan` POST 失敗時 localStorage 残留

---

## 未着手・将来計画

- 多言語: ハウジング言語対応 / AA 名統一
- UI/モバイル: モーダルアニメ / スマホ・タブレット最適化 / SVG アイコンアニメ / 紹介 PV
- インフラ: shared_plans クリーンアップ / CSP unsafe-inline / Sentry / Cloudflare 前段 / **collab使用量 自動監視→Discord通知 cron**(公開時はA=今のまま[部屋8〜20席+冬眠+緊急停止COLLAB_DISABLED手動+$0自動停止]で行く・コスト青天井リスク無し。Bの監視cron他「素人でも管理できる運用ツール群」は公開後に後追い追加・2026-06-12決定)
- 新機能: Floating Timeline (Tauri v2) / FFLogs 精度 / SA 法改善 / 詠唱バー注釈 / public/icons/ 削除 / **ハウジング split-tweet 対応** (画像ツイ + 住所リプ別 URL、 設計書 §8)
- デッドコード: Lenis 削除 / ハウジング背景動画の画面サイズ別出し分け

---

## アイデア / プロジェクト方針 / 並行 / バックログ

- アイデア: YouTube 埋込/導線、 こだわりトップ、 配置アニメ、 OCR、 横型タイムライン、 Gemma AI
- **🆕 機能ブラッシュアップ案 9 件 (2026-06-15 ユーザー投下、 詳細=[docs/.private/2026-06-15-feature-ideas-batch.md](./.private/2026-06-15-feature-ideas-batch.md))**: ①同時刻3+イベント ②スマホ/タブレット最適化(**✅(a)対象指定スキル/鼓舞コピーの選択UI欠落バグ=修正済・local実機OK・push/deploy保留** / 残=ボトムナビ/FAB) ③軽減競合の逆方向警告アニメ ④MAXHP-10%ギリギリでダメージ黄色 ⑤Logsインポート 上書き/追記選択 ⑥有名スプシ取込(法務論点・大物) ⑦敵攻撃の or(2択)対応 ⑧管理画面 攻撃ID保持で任意言語スタート翻訳 ⑨メモに動画URL→YouTube/Twitch iframe。 **インポート系⑤⑥⑧は入口再設計でまとめる方針。着手順は要相談**
- **🆕 Wiki型タイムライン共同編集 (2026-06-16 ユーザー投下・大物・詳細=[docs/.private/2026-06-16-wiki-collaborative-timeline.md](./.private/2026-06-16-wiki-collaborative-timeline.md))**: タイムライン作成が大変 + 自動テンプレ蓄積案が機能せず → **ログインユーザー皆で 1 コンテンツのタイムラインを Wiki 的に編集**(オーナーはロック可)。既存 collab(Yjs)資産を活用しつつ「公開編集モデル」は別設計。論点=荒らし対策(履歴/版管理/承認)・発見性・攻撃ID紐づけ(⑧と同基盤)・軽減は個人コピーに分離?。**⑧(攻撃ID保持)を先に効かせると相性良。着手時 brainstorming**
- **🆕 共同編集の部屋に「日程調整」(2026-06-16 ユーザー投下・ブレスト一部合意済・詳細=[docs/.private/2026-06-16-collab-fixed-group-scheduling.md](./.private/2026-06-16-collab-fixed-group-scheduling.md))**: 共同編集 ON 時だけ、固定メンバーと**調整さん方式の日程調整**(候補日×メンバーで○×△)を部屋の中で。**合意済**=核は日程調整に絞る/識別は名前自由入力(PII保存なし・閲覧者も回答可・端末記憶)/ゲートは collab ON。Phase2 で**攻略進捗バー・作戦ボード**温存。次セッション=brainstorming 継続(論点: データ所在=roomToken / realtime+Firestore恒久 / 候補日作成権限 / 確定フロー)→ spec。
- 方針: コンテンツ追加 = `add-content` → `seed-contents.ts`、 スキル正本 = Firestore、 SNS ハッシュタグ `#LoPo #FF14 #BuildInPublic #AISelection`
- 並行: マイコラージュ (収益化、 28 日まで凍結 / リリース後再開) / ハウジングは MUL 対象外で広告 OK
- バックログ: npm audit / a11y / SE 利用規約 / GDPR / SEO / FFLogs アイコン / MTST 分け / みんなの軽減表
- **✅ リアルタイム共同編集 段取り①〜⑤・④ 全完了 (2026-06-14 一般公開・本番稼働)**: Yjs(CRDT)+Cloudflare Durable Objects。部屋発行/失効/再発行・編集ログイン必須/閲覧誰でも・PlanData全要素ライブ同期・presence roster・P2Pカーソル(オプトイン)まで完成。**段取り別の実装ログ詳細は [TODO_COMPLETED.md](./TODO_COMPLETED.md) へ移動済**。現行の正典ステータスは memory `project_realtime_collab_status`。
  - **🎨 残=カーソル ON/OFF UI 改修(低優先・2026-06-12 ユーザー)**: トグルボタンが枠外にはみ出る→「オンにする/オフにする」状態テキスト明示に。PresenceControls/CursorOptInModal 周辺。
<!-- When compacting, always preserve: 現在のタスク、変更中のファイルパス、本ファイルの「現在の状態」セクション -->
