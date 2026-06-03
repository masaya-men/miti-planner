# LoPo 開発 ToDo

> **維持ルール (必読)**:
> - **100 行以内を目標**に維持
> - 完了タスクは即 [TODO_COMPLETED.md](./TODO_COMPLETED.md) へ移動
> - 大きな設計議論 / 詳細未確定の議題は `docs/.private/YYYY-MM-DD-{topic}.md` に集約
> - 確定済み設計方針は [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md)、 管理者手順は [ADMIN_SETUP.md](./ADMIN_SETUP.md)
> - **セッション終了時に必ず本ファイルの行数を確認 → 超過していたら整理**

---

## 現在の状態 (次セッションはここから読む)

- **ブランチ**: main。 2026-06-02 本セッション: **動画埋め込み式モーダル `VideoRecorderModal` 実装→本番投入・実機検証済 (完了)**。subagent-driven-development で全7タスク (CSP `www.youtube.com` / i18n 4言語 / `parseYouTubeId` 10テスト / `useYouTubePlayer` / モーダル本体 / Timeline 連携 + **`PipRecorder` 撤去**)。公開後 UI 改善も反映済 (`36c356c`): 白基調復活(`--share-modal-bg`)/モーダル拡大(1400px・左flex-3)/ヘッダ撤去(×フロート)/軽減グリッド pip 6列拡大/**ストップウォッチ rAF 滑らか化(動画位置基準維持・500ms 再同期)**。本番で CSP live・実再生・滑らか表示・i18n 全確認済。既存編集フロー(EventForm variant='modal')は無改変。
- **本セッション後半の修正 (全デプロイ済)**: ① OGP 障害2件 — `/api/og` ルート衝突 (ハウジング取得器を `/api/og-fetch` 分離) / `CONTENT_META` 二重管理→`contents.json` 自動生成 (ただし **Vercel Node Function は JSON import 不可で FUNCTION_INVOCATION_FAILED → `contentsOgpData.ts` TS定数化で解決**、`node scripts/generate-ogp-data.mjs` で再生成運用) ② **メモ leak** = 新規プラン作成が前プランの `memos` を引継ぎ (リセット4箇所 `loadSnapshot({...getSnapshot(),…})` が memos 消し忘れ) → `memos:[]` 追加 + 回帰テスト ③ `/assets/*` immutable 1年キャッシュ。
- **✅ FFLogs 全滅(ワイプ)ログ対応 (2026-06-03 実装・要実機検証)**: 従来キル専用だったのを全 pull 対応に。`src/api/fflogs.ts` のみ変更=① fight 取得 `killType: Kills`→`Encounters` ② 選択ロジックを純粋関数 `selectFight(fights, fightId)` 抽出 (id指定→該当pull / 未指定→最後の撃破あればそれ無ければ最後のpull) + `resolveFight` を薄ラッパ化。mapper・テンプレ自動登録 (`!kill` を既にサーバが弾く)・UI・i18n は無改変。バッジ不要 (ユーザー判断)。selectFight 6テスト緑・build緑・mapper回帰15緑。設計=specs `2026-04-05-fflogs-import-v2.md` 追記。**残=デプロイ後に全滅ログの pull URL (`#fight=N` 付き) で実機検証 + 既存キルログ回帰**。A案 (pull選択UIは作らずURLの#fightに委ねる)。
- **✅ FFLogs トークン 502 修正 (2026-06-03 デプロイ済)**: `/api/fflogs/token` が 502 でインポート不可だった。根本原因=5キーのラウンドロビンが「1キー選んで失敗したら即502」でフェイルオーバー無し (冗長化が機能してなかった)。本番メインキー(index0=コールドスタートで先頭)が失効/不調の疑い。修正=純粋ヘルパ `src/lib/fflogsTokenFailover.ts` 新設、全キー順に試し最初の成功を返す/全滅時のみ502/失敗キーは `console.error(key #N,status,body)` で記録。TDD5テスト緑。**残=どのキーがなぜ落ちてるか特定 (デプロイ後 vercel logs tail しつつ再現→401/429/5xx判別→必要なら本番メインキー差し替え)**。
- **✅ YouTube ライブ配信対応 (2026-06-02 完了・実機確認済)**: `parseYouTubeId` の path 正規表現に `live` を1語追加 (`embed|shorts|v|live`)、`youtube.test.ts` に2ケース追加。時刻ロジック・UI・`useYouTubePlayer` は無改変 (相対方式なので真ライブでもVODでも動く)。CSP 追加不要。設計追記=specs `2026-06-02-video-recorder-modal-design.md` §11。prod 実機で参考URL検証OK。→ TODO_COMPLETED.md へ移動予定。
- **動画モーダル 残フォロー (低優先・任意)**: ① 埋め込み不可/年齢制限動画の誘導UI (現状YouTube枠内エラーのみ) ② モバイル対応 (現状PC専用・設計上対象外、ユーザー「いずれ」) ③ モーダルは閉じても state 保持で再開時に前動画が残る (仕様判断保留・実害なし)。設計=specs/計画=plans の `2026-06-02-video-recorder-modal*`。
- **✅ Cloudflare Worker 移設 完了 (2026-05-29)**: Twitter 動画 → `media.lopoly.app` (Worker `lopo-media-proxy`) 経由で **Vercel egress ゼロ化**。env `VITE_MEDIA_PROXY_BASE_URL`=`https://media.lopoly.app` で制御 (Vercel 本番に設定済、外せば即ロールバック)、ambient 復帰済。worker コード=`workers/media-proxy/`。設計/計画=specs|plans の `2026-05-29-housing-video-cf-worker`。memory `project_cloudflare_caching_priority`
- **中優先フォローアップ=動画 CF エッジキャッシュ**: 実測でコスト緊急性は否定 (2026-05-29 Playwright 計測: フル再生3req/再再生1req(browser cache)/フレーム抽出5req、frameCache でセッション内再抽出ゼロ。月13万訪問でも約¥2,200)。よって**コスト目的ではなく レイテンシ/堅牢性/Twitter 取得回数削減**のため。実装=Worker で full mp4 取得→Cache API→Range slice で 206 (アプリ側変更ゼロ・worker 1ファイル)。**Range×cache は hotfix21 地雷=seek 検証必須**、検証は `C:\Users\masay\AppData\Local\Temp\playwright-media-cost.js` 流用可 ([[reference_vercel_edge_range_cache]])。
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
<!-- When compacting, always preserve: 現在のタスク、変更中のファイルパス、本ファイルの「現在の状態」セクション -->
