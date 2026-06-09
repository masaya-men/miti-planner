# LoPo 開発 ToDo

> **維持ルール (必読)**:
> - **100 行以内を目標**に維持
> - 完了タスクは即 [TODO_COMPLETED.md](./TODO_COMPLETED.md) へ移動
> - 大きな設計議論 / 詳細未確定の議題は `docs/.private/YYYY-MM-DD-{topic}.md` に集約
> - 確定済み設計方針は [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md)、 管理者手順は [ADMIN_SETUP.md](./ADMIN_SETUP.md)
> - **セッション終了時に必ず本ファイルの行数を確認 → 超過していたら整理**

---

## 現在の状態 (次セッションはここから読む)

- **ブランチ**: main (origin と同期済)。直近の完了は [TODO_COMPLETED.md](./TODO_COMPLETED.md) 参照 (動画モーダル / OGP・memo / YouTubeライブ / Cloudflare Worker)。
- **✅ Vercel デプロイ失敗ブロッカー=解決済・本番反映完了 (2026-06-08)**: 根因=**Hobby の Node Serverless 12個上限**(直近Ready=12個ぴったり/Error=room.ts追加で13個・Edge4個は対象外)。修正=`api/collab/{load,save,room}.ts`→`index.ts`1関数統合(housing等と同型・本体無変更)+`vercel.json` rewriteで旧URL維持(ワーカー無改修)。Node 13→11個。push `2c74a3c`→`lopo-r0zqim9ke` **Ready**・本番スモーク全緑(トップ200/load 401/dispatch 400)。**⑤-1+⑤-2a 本番反映済(UI非露出で休眠・ユーザー影響ゼロ)**。詳細=[docs/.private/2026-06-08-vercel-deploy-blocker-handoff.md](./.private/2026-06-08-vercel-deploy-blocker-handoff.md)。**未反映の docs commit はローカルのみ(ビルド枠節約・次の機能pushに同梱)**。次の collab=⑤-2b(満員拒否)→⑤-3(クライアントUI+実データ往復E2E)。
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

- **中**: ラベル名が管理画面で取得できない (スプシヘッダー問題?)
- **低 (動作影響なし)**: FFLogs 英語ログ / 無敵反映 / オートプラン同一技 / パルス設定スライダー / ヘッダー縦罫線
- **テスト (既存failure・本番無影響)**: `src/__tests__/housing/TopBar.test.tsx` 4件 + `HousingWorkspace.test.tsx` 1件が落ちる (2026-06-03 確認、FFLogs修正前から存在)。HousingWorkspace は jsdom が youtube-nocookie embed を実 fetch→abort する環境依存。TopBar は要調査。
- **Phase 2 follow-up**: api/popular の `viewCount` 削除 / en/ko privacy_section1_auto_items bullet バグ / `MitigationSheet.copyPlan` POST 失敗時 localStorage 残留

---

## 未着手・将来計画

- 多言語: ハウジング言語対応 / AA 名統一
- UI/モバイル: モーダルアニメ / スマホ・タブレット最適化 / SVG アイコンアニメ / 紹介 PV
- インフラ: shared_plans クリーンアップ / CSP unsafe-inline / Sentry / Cloudflare 前段
- 新機能: Floating Timeline (Tauri v2) / FFLogs 精度 / SA 法改善 / 詠唱バー注釈 / public/icons/ 削除 / **ハウジング split-tweet 対応** (画像ツイ + 住所リプ別 URL、 設計書 §8)
- デッドコード: Lenis 削除 / ハウジング背景動画の画面サイズ別出し分け

---

## アイデア / プロジェクト方針 / 並行 / バックログ

- アイデア: YouTube 埋込/導線、 こだわりトップ、 配置アニメ、 OCR、 横型タイムライン、 Gemma AI
- 方針: コンテンツ追加 = `add-content` → `seed-contents.ts`、 スキル正本 = Firestore、 SNS ハッシュタグ `#LoPo #FF14 #BuildInPublic #AISelection`
- 並行: マイコラージュ (収益化、 28 日まで凍結 / リリース後再開) / ハウジングは MUL 対象外で広告 OK
- バックログ: npm audit / a11y / SE 利用規約 / GDPR / SEO / FFLogs アイコン / MTST 分け / みんなの軽減表
- **リアルタイム共同編集 (✅段取り①=部屋+WS骨組み 本番デプロイ済→次は段取り②)**: 1軽減表を複数人同時編集。方式確定=**Yjs(CRDT)+Cloudflare Durable Objects (ライブラリは y-partyserver/partyserver。PartyKit CLI は買収され後継)**、カーソル=P2Pで$0、保存=Firestoreへ間引き書き戻し。**Workers無料プラン$0ハードストップ前提でコスト有界化**(編集8席/閲覧20/同時30/緊急停止)。**DOは無料枠要件でSQLite-backed (new_sqlite_classes) 必須**。設計書=[specs/2026-06-03-realtime-collab-design.md](./superpowers/specs/2026-06-03-realtime-collab-design.md) / 段取り①計画=[plans/2026-06-03-realtime-collab-step1-room-skeleton.md](./superpowers/plans/2026-06-03-realtime-collab-step1-room-skeleton.md)。**段取り①実装=`workers/collab/` (本体src/非干渉・別Worker)、本番=https://lopo-collab.masaya-maeno0106.workers.dev (空の部屋。本体未統合なのでユーザー影響ゼロ)、5テスト緑**。**✅段取り②-a 同期エンジン main マージ済(2026-06-04)=[plans/2026-06-04-realtime-collab-stage2a-mitigations-sync.md](./superpowers/plans/2026-06-04-realtime-collab-stage2a-mitigations-sync.md)**(設計書 [specs/...2a-design.md](./superpowers/specs/2026-06-04-realtime-collab-stage2a-mitigations-sync-design.md) §9 改訂が正典)。**休眠状態=UI入口なし・collabProvider未import→本番bundle非混入・ユーザー影響ゼロ**。サーバ `Room`=`YServer`化+`hibernate:true`($0)+在室数`getConnections()`+index.tsで`x-partykit-room`フォールバック。実機確認済(本番node 2クライアントで同期/late-join/同時add両方残る + 2ブラウザで双方向ドラッグ同期)。クライアント=`src/lib/collab/`(変換+collabProvider:cascade込みhandlers+observeDeep)、store委譲分岐(yjs非依存)、Firestore自動保存抑制。⚠onLoad/onSave未実装=全員退室で揮発(③で恒久保存)。⚠usePlanStoreテストは複数同時実行でvmThreads汚染失敗(単独緑・②-a前から既存・無関係)。
- **✅段取り③(Firestore恒久保存)本番稼働(2026-06-04)=[plans/2026-06-04-realtime-collab-stage3-firestore-persistence.md](./superpowers/plans/2026-06-04-realtime-collab-stage3-firestore-persistence.md)**(設計書 [specs/...stage3...design.md](./superpowers/specs/2026-06-04-realtime-collab-stage3-firestore-persistence-design.md))。方式=**案B(DOはVercel受付係 `/api/collab/load`・`/api/collab/save` に委譲・共有シークレット認証・既存保存ロジック再利用)**。DO `onLoad`(seed)/`onSave`(debounce 5s/15s)/`onClose`(最後の退室でflush)+**破壊保存ガード**+**墓標ガード(削除が勝つ)**。seedはサーバー(onLoad)が正→client seed撤去。room鍵=plan IDのまま(分離は⑤)。テスト=純粋9+変換3+HTTP7+既存6 全緑・build緑。**✅Task10本番稼働=secret(Vercel prod sensitive+Cloudflare wrangler secret同値)+`wrangler deploy`済・本番スモーク全緑**(load正secret→200/誤→401・Yjs sync成立・onLoad空seed・破壊保存ガードphantom無)。⚠**踏んだ罠=api/相対importの`.js`拡張子漏れで本番500**(修正済・memory `reference_vercel_api_esm_js_extension`)。⚠**初回syncレイテンシ**(onLoad fetch待ち・⑤で「接続中」表示)。**🔴残=実データ往復検証**(実プランseed→編集→保存→再接続残存)は実在軽減表に触れない方針+秘密鍵pull不可で今は不可→**⑤入口後にユーザー2ブラウザで実機確認**。UI非表示継続。
- **段取り⑤(③の後)=共同編集の実入口 [設計書化済 2026-06-05・⑤を3分割]=[specs/2026-06-05-...stage5-collab-entry-design.md](./superpowers/specs/2026-06-05-realtime-collab-stage5-collab-entry-design.md)**: 核心=共有はコピーで別ID化([MitigationSheet.tsx:209](./../src/components/MitigationSheet.tsx#L209))→現状plan ID部屋鍵では繋がれない。解消=**`collabRooms/{roomToken}`対応表(token→planId)**。確定方針=常設リンク(案A・無期限)/**オーナーのみ失効・再発行・配布**/最大人数(既定8=フルパーティ)/緊急停止/**編集ログイン必須(段階導入・公開条件にサーバ認証含む)**/ジョイナーは一時ビュー(自分の一覧に増えない)/注意=初回モーダル+常時赤バナー/パスワード無し。コピー共有(ShareModal)無傷。**完成までUI一切非表示厳守**。順序: ③→⑤→②-b→②-c。
  - **✅⑤-1=ルーム解決層 main マージ済(2026-06-05)**: `collabRooms` token→planId 解決(`_roomLogic.ts`:resolveRoom/clamp)+load/save の roomToken 対応(planId 経路維持で③非破壊)+緊急停止`COLLAB_DISABLED=1`(ADMIN_SETUP記載)。
  - **✅⑤-2a=ルーム管理API+ワーカー結線 実装済(2026-06-05・ブランチ`feat/collab-stage5-2a-room-management-api`要マージ)=[plans/...stage5-2a...md](./superpowers/plans/2026-06-05-realtime-collab-stage5-2a-room-management-api.md)**: `/api/collab/room`(`_roomManageLogic.ts`純検証+`room.ts`ハンドラ・**ID Token認証→`plans.ownerId===uid`照合**→collabRooms発行/失効/再発行/上限・create冪等は`activeCollabRoomToken`逆引き・緊急停止503)+`collabPersistence.ts`を roomToken 送信化(load/save は⑤-1対応済)。9+13テスト緑/build緑/root非破壊(1427緑)。全タスクspec/品質レビュー済。
  - **✅⑤-2b=満員拒否 実装・worker デプロイ済(2026-06-08・ブランチ`feat/collab-stage5-2b-capacity-rejection`要マージ)=[plans/...stage5-2b...md](./superpowers/plans/2026-06-08-realtime-collab-stage5-2b-capacity-rejection.md)**: **方式=案B**(max を DO `ctx.storage` にonLoadでキャッシュ→`/count`が`{count,max}`→worker `onBeforeConnect`が接続前に1往復で照合し満員は403・fail-open)。案A(毎接続Firestore)は不採用=onBeforeConnectは自動再接続毎に走り稀でない+count往復は必須なので案A=案B+無駄読取と確定。`collabCapacity.ts`純ロジック分離。worker 24テスト緑/root非干渉(1427緑)/worker型緑。本番スモーク緑(`/count`→`{count:0,max:8}`)。満員の本番E2Eは実roomToken要で⑤-3統合。**休眠(UI入口なし)継続**。
  - **✅⑤-3a=オーナー入口UI 実装済(2026-06-08・ブランチ`feat/collab-stage5-3a-owner-entry` held・UI非露出)**: 共有2択+ルーム発行/人数/失効/再発行+表ツールバー常設チップ+`startCollabSession`roomToken化+オーナーパネル(i18n4言語)+SYSTEM_MAX 28→20。root1445緑/worker24緑/build緑。設計書[specs/...stage5-3a...md](./superpowers/specs/2026-06-08-realtime-collab-stage5-3a-owner-entry-design.md)/計画[plans/...stage5-3a...md](./superpowers/plans/2026-06-08-realtime-collab-stage5-3a-owner-entry.md)。push/mainマージ/deployは⑤-3完成+承認まで保留。
  - **🔀順番B決定(2026-06-08)=[docs/.private/2026-06-08-collab-roadmap-order-B-decision.md](./.private/2026-06-08-collab-roadmap-order-B-decision.md)**: 理想へ足場なし最短到達のため②-b(全PlanDataライブ同期)を②-b-1(軽量要素)/②-b-2(partyMembers)に2分割→その上に⑤-3b(ジョイナー閲覧)→⑤-3c(ログイン編集)→④(presence)。
  - **✅②-b-1=軽量PlanData同期(events/phases/labels/memos/設定)・main dormant完了(2026-06-08)**: 詳細は memory `project_realtime_collab_status` と [specs/...stage2b1...](./superpowers/specs/2026-06-08-realtime-collab-stage2b1-plandata-sync-design.md)/[plans/...stage2b1...](./superpowers/plans/2026-06-08-realtime-collab-stage2b1-plandata-sync.md)。
  - **✅②-b-2=partyMembersライブ同期+ジョブ変更カスケード 実装済(2026-06-09・ブランチ`feat/collab-stage2b2-partymembers-sync`・UI非露出dormant・push/deploy保留)**: partyMembersを新Y.Arrayキーでid単位同期(computedValuesは受信側でローカル再計算)。ジョブ変更カスケード(setMemberJob/changeMemberJobWithMitigations/updatePartyBulk)+bulk mitigation3種(clearMitigationsByMember/clearAllMitigations/applyAutoPlan)を委譲化。**新ハンドラ`batch(ops)`** でpartyMembers+mitigationsを1 transaction原子反映(`PlanArrayKey`に partyMembers/timelineMitigations追加・②-a無改変共存)。ソロ計算はcompute*純関数に抽出しソロ/collab共有(DRY)。restoreFromSnapshot no-opガード追加。worker/Vercel永続化にpartyMembers授受追加。root1474緑(既知5失敗のみ)/worker33緑/build緑。設計[specs/...stage2b2...](./superpowers/specs/2026-06-09-realtime-collab-stage2b2-partymembers-sync-design.md)/計画[plans/...stage2b2...](./superpowers/plans/2026-06-09-realtime-collab-stage2b2-partymembers-sync.md)。**PlanData全要素ライブ同期エンジン完成**。
  - **📝⑤-3b=ジョイナー読み取り専用ライブビュー 設計+計画 committed・実装未着手(2026-06-09)**: `/collab/:roomToken`で部屋を読取専用ライブ表示(編集解禁は⑤-3c)。設計[specs/...stage5-3b...](./superpowers/specs/2026-06-09-realtime-collab-stage5-3b-joiner-view-design.md)/計画[plans/...stage5-3b...](./superpowers/plans/2026-06-09-realtime-collab-stage5-3b-joiner-view.md)(全11タスク Task0-10)。**次セッション=⑤-3bをTask0(ブランチ統合)から実装**。詳細・設計判断は memory `project_realtime_collab_status`。
- **次の最優先候補=同期安定化の原因特定**: 既知症状(別端末で消失/削除復活)の犯人特定。手がかり4点 (時計ズレ判定/まるごと上書き/削除復活/カウンター desync) は上記 .private に記載。共同編集の前提でもある
<!-- When compacting, always preserve: 現在のタスク、変更中のファイルパス、本ファイルの「現在の状態」セクション -->
