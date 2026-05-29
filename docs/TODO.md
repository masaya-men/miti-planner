# LoPo 開発 ToDo

> **維持ルール (必読)**:
> - **100 行以内を目標**に維持
> - 完了タスクは即 [TODO_COMPLETED.md](./TODO_COMPLETED.md) へ移動
> - 大きな設計議論 / 詳細未確定の議題は `docs/.private/YYYY-MM-DD-{topic}.md` に集約
> - 確定済み設計方針は [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md)、 管理者手順は [ADMIN_SETUP.md](./ADMIN_SETUP.md)
> - **セッション終了時に必ず本ファイルの行数を確認 → 超過していたら整理**

---

## 現在の状態 (次セッションはここから読む)

- **ブランチ**: main。 2026-05-29 本セッション push 済 (Vercel 自動デプロイ): 検索撤去+ロゴ→トップ / 管理→直前画面 / **カード masonry+windowing+FLIP 刷新 (4列上限・隙間なし・横スクロール禁止)** / **ギャラリー動画 ambient 一時 OFF (転送止血)**。 計画 [docs/.private/2026-05-28-housing-masonry-reflow-plan.md](./.private/2026-05-28-housing-masonry-reflow-plan.md)。
- **🚨 公開前 最重要 (2026-05-29)**: **Twitter 動画プロキシを Cloudflare Worker (`media.lopoly.app` 仮) に移設** = Vercel egress ゼロ化。brainstorming 完了・**採用=専用 Worker (案①)**、本体 lopoly.app は Vercel 据置・**案②前段キャッシュは不採用**。YouTube は iframe で既にゼロ・対象外。設計書 [specs/2026-05-29-housing-video-cf-worker-design.md](./superpowers/specs/2026-05-29-housing-video-cf-worker-design.md)。次=writing-plans→実装。memory `project_cloudflare_caching_priority`
- **方針 (2026-05-27 確定)**: **α 公開期限撤回**、 1 セッション 1 タスクで丁寧に進める。 **デザインは 1 つずつ実機を見ながら一緒に** (大規模一括はしない、 2026-05-28 ユーザー再確認)。 画像も動画も全部「外部 URL 直接 + 画面内自動再生」 に統一。 詳細 memory `project_housing_phase_status`
- **直近完了 ✅** (2026-05-28、 詳細 [TODO_COMPLETED.md](./TODO_COMPLETED.md) 末尾): ハウジングリデザイン + カード AllMarks 風 (masonry) + **画像 aspectRatio で CLS ゼロ化** (8 タスク push 済、 計画 [docs/.private/2026-05-28-housing-image-aspect-ratio-plan.md](./.private/2026-05-28-housing-image-aspect-ratio-plan.md)) + dev vite proxy。 memory `feedback_housing_no_ai_pills` / `reference_vite_dev_api_proxy`
- **次セッション最優先**:
  1. **本セッション分の実機確認** ← デプロイ後。 (a) 画像 aspectRatio: localhost or 本番で Twitter 写真ツイ登録 → カードが写真の縦横比で表示・スクロールでガタつかないか (縦長→縦長カード)。 既存 listing は寸法なしで自然比フォールバック、 **新規登録のみ CLS ゼロ**。 (b) リデザイン全体 / フィルター chip rectangle 化 / 各モーダルの新ガラス感
  2. **「通報」 文言全体見直し** (他箇所まとめて。 自発的通報モーダルは文脈上 OK)
  3. **§3.8 残りの実機検証** (重複 drop でツアー自動追加 + トースト / 単独 listing で section 非表示)
  4. **Phase 2-6 「📅 1 ヶ月以上更新なし」 バッジ** (前々セッション hook 再利用)
  5. **通知 UI/UX 磨き**: listingTitleSnapshot が addressKey raw → `formatHousingAddress` 経由へ
  6. **split-tweet 対応** (画像ツイ + 住所リプ別 URL、 設計書 §8、 論点詰めてから)
- **その後**: 既存テスト物件一掃 + コールドスタート (ユーザー作業) → アプデ告知 (#59 + ハウジング α)
- **保留**: マップビュー実装は止まっている (ユーザー認識済、 リストビューで完結する設計なのでリリースブロッカーではない)。 ※Cloudflare は「保留」から **公開前最重要** に格上げ (上記参照)
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
