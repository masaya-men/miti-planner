# LoPo 開発 ToDo

> **維持ルール (必読)**:
> - **100 行以内を目標**に維持
> - 完了タスクは即 [TODO_COMPLETED.md](./TODO_COMPLETED.md) へ移動
> - 大きな設計議論 / 詳細未確定の議題は `docs/.private/YYYY-MM-DD-{topic}.md` に集約
> - 確定済み設計方針は [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md)、 管理者手順は [ADMIN_SETUP.md](./ADMIN_SETUP.md)
> - **セッション終了時に必ず本ファイルの行数を確認 → 超過していたら整理**

---

## 現在の状態 (次セッションはここから読む)

- **✅ スマホ最適化 A(ボトムナビ再設計)全9タスク完了 (2026-06-15・ブランチ `feat/mobile-bottom-nav-redesign`・全コミット済・未push・デプロイ未・実機OK)**: 設計メモ=[specs/2026-06-15-mobile-optimization-design.md](./superpowers/specs/2026-06-15-mobile-optimization-design.md) / **実装計画=[plans/2026-06-15-mobile-bottom-nav-redesign.md](./superpowers/plans/2026-06-15-mobile-bottom-nav-redesign.md)**。前段の個別修正①〜④(対象選択バグ/チュートリアルFキー/C参加ヘッダー/D FAB背景)は別コミットで済(③本番確認はデプロイ後)。**次=B 共有配布フロー設計(別ブレスト)→ A+B 完了でまとめて push/デプロイ**(Vercelビルド節約+C本番確認)。
  - **済+実機OK**: Task1 i18nキー4言語 / Task2+3 ナビ5タブ化(メニュー/インポート/カンペ/共有/ログイン)+Layout配線+共有シート枠(中身はBで実装・今は"Coming soon")【実機①OK】 / Task4 ツール→インポートシート(FFLogs"FF Logs"+みんなの軽減表のみ・文言キー化)【②OK】 / Task5 Undo/Redoを FAB左に横並び常設+チュートリアル中は隠す【③OK】 / Task6 メニューにパーティ/軽減自動組み立てボタン集約(fullWidth限定)【④OK】 / Task7 パーティシートで「自分のジョブを設定」の下に「自分のジョブをハイライト」トグル(Eye+スイッチ・i18nキー化)【⑥⑦OK】。
  - **✅ ⑤ メニューの☕支援不可視を解決(候補②採用・Playwright計測で確認・push/deploy保留)**: MobileBottomSheet に `fillContent` prop 追加([MobileBottomSheet.tsx](../src/components/MobileBottomSheet.tsx))=シート高さを確定値にし内側スクロール/`pb-20` を外して子(Sidebar)が自前 flex で高さ・スクロール管理。**根本原因=シートが `max-height` のみで高さ未確定→flex item が percentage 解決の基準にならず `h-full` チェーンが auto に潰れ、シート全体がスクロール**(前回の h-full 追加 fix が効かなかった理由)。計測=修正前 scrollHeight 1133/支援が可視域の約598px下 → 修正後 支援 top 761(可視・内部リストスクロール中も固定)。**併せてメニュー高さを 70vh→ほぼ全画面 calc に拡大**(コンテンツ可視域最大化・課金圧低減、ユーザー要望)。バックアップ/復元はスマホでも動作(中央モーダル z-9999・コピー/DL・復元)を確認済。build EXIT 0 / vitest 既知5失敗のみ。**実機確認待ち**。
  - **✅ Task8 FABからカンペ項目撤去済**(カンペはナビ昇格・未使用 import 除去・Playwright計測でカンペ出現=ナビの1件のみ確認)。**✅ Task9 総合確認済**: build EXIT 0 / vitest 既知5失敗のみ(TopBar4+HousingWorkspace1) / ボトムナビ4言語OK(ja メニュー/インポート/カンペ/共有/ログイン・en Menu/Import/Cue/Share/Login・ko 메뉴/가져오기/치트시트/공유/로그인・zh 菜单/导入/速查表/分享/登录)。
  - **確定済の設計判断(承認済・実装で踏襲)**: パーティ編成は既存シート維持しメニューのボタンから開く / MY JOBは旧ナビから撤去しパーティシートのトグルへ / Undo/Redoは案ア(横並び)/ 共有タブはA時点では枠のみ / 支援は下部。本番未デプロイなので中間状態のユーザー露出なし。
- **✅ スマホ共有タブ B 完了 (2026-06-16・同ブランチ・push/deploy保留)**: 設計書=[specs/2026-06-16-mobile-share-tab-design.md](./superpowers/specs/2026-06-16-mobile-share-tab-design.md)。共有タブ=現在プラン1つの共有(複数まとめて共有はメニュー側のまま)・PC共有判定をミラー。`useShareFlow` フックに共有状態機械を抽出(PC ShareButtons から逐語移植・1ソース化)/ ShareButtons 薄リファクタ(PC挙動不変)/ `OwnerCollabPanel` に `hideCursor`(スマホでカーソル共有UI非表示)/ `MobileShareController` がナビから flow 起動 / 純粋ロジック+テスト7件。build EXIT 0・vitest 既知5+新規7緑・yjs遅延チャンク維持・スマホ実機でコピー共有起動OK。**collab は 2026-06-14 一般公開済み**(旧メモリの「held」は stale)。**次=A+B まとめて push/デプロイ(ユーザーGO待ち)**=`git push origin HEAD:main`(Vercel自動デプロイ)→ ③本番確認 + スマホ実機総点検。
- **✅ 2026-06-16 追加修正(同ブランチ・push/deploy保留・コミット済)**:
  - **パーティ編成ボタン → メニューのタイトルバー右(×の左)へ常設**(MobileBottomSheet に `headerAction` slot・body重複撤去)。**軽減自動組み立て → ボタンバー右の空きへ移動+短縮文言「自動」**(`mitigation.auto_plan_short` i18n4言語追加)。実機OK。
  - **スマホ初回ガイド(`MobileGuide`)文言を新ナビに更新(②④のみ・PC不変)**: ②パーティ=メニュー右上ボタン / ④ツール廃止→「インポート」+メニュー「自動」(アイコン Wrench→CloudDownload)。`mobile_guide.*` は MobileGuide.tsx 専用キーなので PC チュートリアル無影響。
  - **✅ スキルデータ修正+追加(本体・公式確認済・TDD)**: ①**チャージのレベルゲート**=`Mitigation.chargeMinLevel` 新設。resourceTracker が現在のコンテンツ level を見て `level<chargeMinLevel` で実効1チャージに。ディヴァインベニゾン/星天交差に `chargeMinLevel:88`(Lv88特性)。**ID変更なし=既存プラン非破壊・レベル連動で自動的に正しくなる**。全チャージスキル監査済(漏れはこの2つのみ・他4つは正しい)。②**学者「深謀遠慮」追加**(Lv62/45s/45s/回復力800/エーテルフロー・回復系・アイコン `public/icons/Excogitation.png`)。chargeLevelGate.test.ts 6緑 / build EXIT 0 / 既知5失敗のみ。
  - **⚠ スキル変更は Firestore seed しないと反映されない(UI変更と違いローカルプレビュー不可)**。dry-run 確認済=mock↔Firestore は id 同期(新規は excogitation のみ)・**seed は master/* のみ書きユーザープランに非接触(構造的に安全)**。**デプロイ時 seed 手順**: (1)`seed-icons`(アイコン) (2)`seed-skills-stats`(ADDITIVE=excogitation追加) (3)`seed-charge-min-level --commit`(chargeMinLevel 狙い撃ち・force-overwrite不使用)。
  - **🚀 残=ユーザーGO待ちの本番反映**: `rtk git push origin HEAD:main` → Vercel自動デプロイ → 上記 seed 3手順 → 本番でスマホ総点検(共有タブ/パーティ・自動ボタン/ガイド文言/Lv80でDB・星天が1チャージ/深謀遠慮表示)。
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
- **中**: ラベル名が管理画面で取得できない (スプシヘッダー問題?)
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
- 方針: コンテンツ追加 = `add-content` → `seed-contents.ts`、 スキル正本 = Firestore、 SNS ハッシュタグ `#LoPo #FF14 #BuildInPublic #AISelection`
- 並行: マイコラージュ (収益化、 28 日まで凍結 / リリース後再開) / ハウジングは MUL 対象外で広告 OK
- バックログ: npm audit / a11y / SE 利用規約 / GDPR / SEO / FFLogs アイコン / MTST 分け / みんなの軽減表
- **リアルタイム共同編集 (✅段取り①=部屋+WS骨組み 本番デプロイ済→次は段取り②)**: 1軽減表を複数人同時編集。方式確定=**Yjs(CRDT)+Cloudflare Durable Objects (ライブラリは y-partyserver/partyserver。PartyKit CLI は買収され後継)**、カーソル=P2Pで$0、保存=Firestoreへ間引き書き戻し。**Workers無料プラン$0ハードストップ前提でコスト有界化**(編集8席/閲覧20/同時30/緊急停止)。**DOは無料枠要件でSQLite-backed (new_sqlite_classes) 必須**。設計書=[specs/2026-06-03-realtime-collab-design.md](./superpowers/specs/2026-06-03-realtime-collab-design.md) / 段取り①計画=[plans/2026-06-03-realtime-collab-step1-room-skeleton.md](./superpowers/plans/2026-06-03-realtime-collab-step1-room-skeleton.md)。**段取り①実装=`workers/collab/` (本体src/非干渉・別Worker)、本番=https://lopo-collab.masaya-maeno0106.workers.dev (空の部屋。本体未統合なのでユーザー影響ゼロ)、5テスト緑**。**✅段取り②-a 同期エンジン main マージ済(2026-06-04)=[plans/2026-06-04-realtime-collab-stage2a-mitigations-sync.md](./superpowers/plans/2026-06-04-realtime-collab-stage2a-mitigations-sync.md)**(設計書 [specs/...2a-design.md](./superpowers/specs/2026-06-04-realtime-collab-stage2a-mitigations-sync-design.md) §9 改訂が正典)。**休眠状態=UI入口なし・collabProvider未import→本番bundle非混入・ユーザー影響ゼロ**。サーバ `Room`=`YServer`化+`hibernate:true`($0)+在室数`getConnections()`+index.tsで`x-partykit-room`フォールバック。実機確認済(本番node 2クライアントで同期/late-join/同時add両方残る + 2ブラウザで双方向ドラッグ同期)。クライアント=`src/lib/collab/`(変換+collabProvider:cascade込みhandlers+observeDeep)、store委譲分岐(yjs非依存)、Firestore自動保存抑制。⚠onLoad/onSave未実装=全員退室で揮発(③で恒久保存)。⚠usePlanStoreテストは複数同時実行でvmThreads汚染失敗(単独緑・②-a前から既存・無関係)。
- **✅段取り③(Firestore恒久保存)本番稼働(2026-06-04)=[plans/2026-06-04-realtime-collab-stage3-firestore-persistence.md](./superpowers/plans/2026-06-04-realtime-collab-stage3-firestore-persistence.md)**(設計書 [specs/...stage3...design.md](./superpowers/specs/2026-06-04-realtime-collab-stage3-firestore-persistence-design.md))。方式=**案B(DOはVercel受付係 `/api/collab/load`・`/api/collab/save` に委譲・共有シークレット認証・既存保存ロジック再利用)**。DO `onLoad`(seed)/`onSave`(debounce 5s/15s)/`onClose`(最後の退室でflush)+**破壊保存ガード**+**墓標ガード(削除が勝つ)**。seedはサーバー(onLoad)が正→client seed撤去。room鍵=plan IDのまま(分離は⑤)。テスト=純粋9+変換3+HTTP7+既存6 全緑・build緑。**✅Task10本番稼働=secret(Vercel prod sensitive+Cloudflare wrangler secret同値)+`wrangler deploy`済・本番スモーク全緑**(load正secret→200/誤→401・Yjs sync成立・onLoad空seed・破壊保存ガードphantom無)。⚠**踏んだ罠=api/相対importの`.js`拡張子漏れで本番500**(修正済・memory `reference_vercel_api_esm_js_extension`)。⚠**初回syncレイテンシ**(onLoad fetch待ち・⑤で「接続中」表示)。**🔴残=実データ往復検証**(実プランseed→編集→保存→再接続残存)は実在軽減表に触れない方針+秘密鍵pull不可で今は不可→**⑤入口後にユーザー2ブラウザで実機確認**。UI非表示継続。
- **段取り⑤(③の後)=共同編集の実入口 [設計書化済 2026-06-05・⑤を3分割]=[specs/2026-06-05-...stage5-collab-entry-design.md](./superpowers/specs/2026-06-05-realtime-collab-stage5-collab-entry-design.md)**: 核心=共有はコピーで別ID化([MitigationSheet.tsx:209](./../src/components/MitigationSheet.tsx#L209))→現状plan ID部屋鍵では繋がれない。解消=**`collabRooms/{roomToken}`対応表(token→planId)**。確定方針=常設リンク(案A・無期限)/**オーナーのみ失効・再発行・配布**/最大人数(既定8=フルパーティ)/緊急停止/**編集ログイン必須(段階導入・公開条件にサーバ認証含む)**/ジョイナーは一時ビュー(自分の一覧に増えない)/注意=初回モーダル+常時赤バナー/パスワード無し。コピー共有(ShareModal)無傷。**完成までUI一切非表示厳守**。順序: ③→⑤→②-b→②-c。
  - **✅⑤-1/⑤-2a/⑤-2b 完了(2026-06-05〜08・本番反映 or branch held・詳細 memory `project_realtime_collab_status`+各 specs/plans)**: ⑤-1=ルーム解決層(`_roomLogic` token→planId・`COLLAB_DISABLED`緊急停止) / ⑤-2a=ルーム管理API(`/api/collab?action=room`・IDトークン+ownerId照合・発行/失効/再発行/上限) / ⑤-2b=満員拒否(`onBeforeConnect`で`/count`照合・fail-open・`collabCapacity.ts`純ロジック)。
  - **✅⑤-3a=オーナー入口UI 実装済(2026-06-08・ブランチ`feat/collab-stage5-3a-owner-entry` held・UI非露出)**: 共有2択+ルーム発行/人数/失効/再発行+表ツールバー常設チップ+`startCollabSession`roomToken化+オーナーパネル(i18n4言語)+SYSTEM_MAX 28→20。root1445緑/worker24緑/build緑。設計書[specs/...stage5-3a...md](./superpowers/specs/2026-06-08-realtime-collab-stage5-3a-owner-entry-design.md)/計画[plans/...stage5-3a...md](./superpowers/plans/2026-06-08-realtime-collab-stage5-3a-owner-entry.md)。push/mainマージ/deployは⑤-3完成+承認まで保留。
  - **🔀順番B決定(2026-06-08)=[docs/.private/2026-06-08-collab-roadmap-order-B-decision.md](./.private/2026-06-08-collab-roadmap-order-B-decision.md)**: 理想へ足場なし最短到達のため②-b(全PlanDataライブ同期)を②-b-1(軽量要素)/②-b-2(partyMembers)に2分割→その上に⑤-3b(ジョイナー閲覧)→⑤-3c(ログイン編集)→④(presence)。
  - **✅②-b-1=軽量PlanData同期(events/phases/labels/memos/設定)・main dormant完了(2026-06-08)**: 詳細は memory `project_realtime_collab_status` と [specs/...stage2b1...](./superpowers/specs/2026-06-08-realtime-collab-stage2b1-plandata-sync-design.md)/[plans/...stage2b1...](./superpowers/plans/2026-06-08-realtime-collab-stage2b1-plandata-sync.md)。
  - **✅②-b-2=partyMembersライブ同期+ジョブ変更カスケード 実装済(2026-06-09・ブランチ`feat/collab-stage2b2-partymembers-sync`・UI非露出dormant・push/deploy保留)**: partyMembersを新Y.Arrayキーでid単位同期(computedValuesは受信側でローカル再計算)。ジョブ変更カスケード(setMemberJob/changeMemberJobWithMitigations/updatePartyBulk)+bulk mitigation3種(clearMitigationsByMember/clearAllMitigations/applyAutoPlan)を委譲化。**新ハンドラ`batch(ops)`** でpartyMembers+mitigationsを1 transaction原子反映(`PlanArrayKey`に partyMembers/timelineMitigations追加・②-a無改変共存)。ソロ計算はcompute*純関数に抽出しソロ/collab共有(DRY)。restoreFromSnapshot no-opガード追加。worker/Vercel永続化にpartyMembers授受追加。root1474緑(既知5失敗のみ)/worker33緑/build緑。設計[specs/...stage2b2...](./superpowers/specs/2026-06-09-realtime-collab-stage2b2-partymembers-sync-design.md)/計画[plans/...stage2b2...](./superpowers/plans/2026-06-09-realtime-collab-stage2b2-partymembers-sync.md)。**PlanData全要素ライブ同期エンジン完成**。
  - **✅⑤-3b=ジョイナー読み取り専用ライブビュー 実装完了(2026-06-09・ブランチ`feat/collab-stage5-3b-joiner-view`・UI非露出held・push/deploy保留)**: `/collab/:roomToken`(lazy chunk)で部屋を読取専用ライブ表示。contentIdをseed配送(load top-level→worker planMeta META_CONTENT_ID→client readContentId・save非対象)。`startCollabSession(roomToken,{readOnly})`+`applyRoomToStore`(readOnlyはenterCollabMode呼ばず購読のみ)。漏洩防止2層=①専用ページがLayout自動保存を通らない②`_collabReadonly`でlocalStorage persist skip+退室時rehydrate(**順序肝**:rehydrate→readonly解除で部屋データ書戻し回避)。Timeline=contentIdフォールバック(resolveContentId)+全mutationハンドラ早期return(readOnlyRef)+undo/redo/clear無効化。状態表示=接続中/無効/満員(joinerView・i18n4言語)。root1510緑(既知5)/worker34緑/build緑/yjsは遅延chunk維持。設計[specs/...stage5-3b...](./superpowers/specs/2026-06-09-realtime-collab-stage5-3b-joiner-view-design.md)/計画[plans/...stage5-3b...](./superpowers/plans/2026-06-09-realtime-collab-stage5-3b-joiner-view.md)。詳細・設計判断は memory `project_realtime_collab_status`。
  - **✅⑤-3c=注意UI+ログインゲート+編集解禁(クライアントゲート版) 実装完了(2026-06-09・ブランチ`feat/collab-stage5-3c-edit-unlock`・UI非露出held・push/deploy保留)**: ジョイナーが部屋ごとフル警告に同意+ログインで編集解禁(サーバ側編集認証は④/公開直前=非ゴール)。確定判断=①persist skip(自分のlocalStorage保護)と canEdit(=ログイン&&部屋ごと同意)を分離②同意は roomToken キー(別固定Pは再警告)③オーナー名=発行時その場ラベル(collabRooms.label・空欄は汎用・PII/ホールなし・contentIdと同型seed・save非対象)。実装=`CollabJoinerPage`を2 useEffect分離(効果A=persist skip+enter+rehydrate→readonly順cleanup・deps[roomToken] / 効果B=WSセッション readOnly=!canEdit・canEdit切替で張り直し・deps[roomToken,canEdit])+警告モーダル/赤バナー(状態別CTA login/consent/edit)+`computeCanEdit`/`isJoinerReadonly(roomToken,canEdit)`/`hasCollabEditConsent`(roomTokenキーlocalStorage)+OwnerCollabPanelに任意ラベル欄。エンジン=ownerLabel seed(load→worker planMeta→client readOwnerLabel→onOwnerLabel・additive)。root1535緑(既知5=TopBar4+HousingWorkspace1のみ)/worker35緑/build緑/yjs遅延chunk維持。設計[specs/...stage5-3c...](./superpowers/specs/2026-06-09-realtime-collab-stage5-3c-edit-unlock-design.md)/計画[plans/...stage5-3c...](./superpowers/plans/2026-06-09-realtime-collab-stage5-3c-edit-unlock.md)。詳細・設計判断は memory `project_realtime_collab_status`。
  - **✅④-a=サーバ側編集認証 実装完了(2026-06-10・ブランチ`feat/collab-stage4a-server-edit-auth`・UI非露出held・push/deploy保留)**: ④を④-a(認証=公開ゲート)/④-b(P2Pカーソル)に分割。方式=**Vercel受付係 verify委譲**(`/api/collab?action=verify`・Firebase Admin verifyIdToken・接続時1回で$0維持)。client が provider params で IDトークン送付→worker fetchハンドラで WS upgrade のみ in-place 認可(詐称ヘッダ除去+fail-closed)→DO `isReadOnly`override で未認証接続の書込をサーバ破棄。罠2件: onBeforeConnectのRequest返しはDO名前バインドを壊す(in-placeで回避)/`.dev.vars`がworkerテスト破壊(削除)。root collab85緑/worker45緑/build緑。設計=specs/2026-06-10-...stage4a.../計画=plans/2026-06-10-...stage4a...。**次=④-b(下記)**。
  - **✅④-b 設計完了 + ④-b-1(presence roster)実装完了(2026-06-10・ブランチ`feat/collab-stage4b1-presence-roster`・UI非露出held・push/deploy保留)**: ④-b=presence/カーソル。設計=ハイブリッド2ch([specs/...stage4b...](./superpowers/specs/2026-06-10-realtime-collab-stage4b-presence-cursors-design.md))=**roster は既存WS awareness で全員に確実配信 / 動くカーソルのみ P2P でメーター外($0)**。座標は既存 Memo の`(timeSec,xRatio)`流用。実名なし(ジョブアイコン+自動配色)。描画は高頻度setState禁止ルール遵守(ref+rAF+transform+ease補間)。**④-b-1=roster のみ実装**([plans/...stage4b1...](./superpowers/plans/2026-06-10-realtime-collab-stage4b1-presence-roster.md)・クライアントのみサーバ改修ゼロ):`presence.ts`(colorForClient/buildRoster/wirePresence・yjs非依存テスト)+`useCollabPresenceStore`+collabProvider結線(provider.awareness)+ツールバーチップ実人数+オーナーパネル参加者リスト(色/編集・閲覧バッジ・i18n4言語)。17テスト緑/build緑/yjs遅延境界維持/最終レビューAPPROVED。**✅④-b-2(P2P live カーソル)実装完了(2026-06-10・branch `feat/collab-stage4b2-live-cursors`・held)**: spike確定=signaling=既存WS awareness相乗り(新DO/migration/npm依存ゼロ)+ライブラリ=自前最小WebRTCメッシュ(y-webrtc不採用=自前signalingサーバ要+捨てdoc重)。プライバシー=既定OFFオプトイン+ON時IP正直説明(modal)+OFFで即接続クローズ+IP非保存+P2Pは cursorEnabled同士のみ。座標=既存Memo coords流用(タイムライン上のみ)。描画=transform直書き+rAF lerp(高頻度setState禁止遵守)。新規=cursorInterp/cursorTransport/cursorSignal/cursorMesh(注入式TDD)/cursorPeer(実RTC)/CursorOverlay/PresenceControls/CursorOptInModal/useRemoteCursorsStore/useCursorSendStore。設計=specs/2026-06-10-...stage4b2.../計画=plans/2026-06-10-...stage4b2。全15タスク+ジョブ自己選択UI配線(JobPicker流用・カーソルにジョブアイコン)+ジョイナーページにもPresenceControls(双方向)+最終レビュー(誤フォールバック2件修正)。root1574緑(既知5失敗のみ)/build緑/yjs遅延境界維持。**次=⑤-3d 統合プレビュー実機検証(2ブラウザ・login要)**=awareness viewerブロードキャスト確認/Hz・ease実測/ジョイナー浮遊UI見た目確認/プライバシーポリシー追記。 **🎨 カーソル ON/OFF UI 改修要望(2026-06-12 ユーザー)**: 現状トグルボタンが枠外にはみ出る不具合。→「オンにする」ボタン→押すと「オフにする」に変化＋近くに注釈「今はカーソルの共有が ON です」を常時表示(状態テキスト明示=業界水準)。PresenceControls/CursorOptInModal 周辺(④-b-2)。
- **次の最優先候補=同期安定化の原因特定**: 既知症状(別端末で消失/削除復活)の犯人特定。手がかり4点 (時計ズレ判定/まるごと上書き/削除復活/カウンター desync) は上記 .private に記載。共同編集の前提でもある
<!-- When compacting, always preserve: 現在のタスク、変更中のファイルパス、本ファイルの「現在の状態」セクション -->
