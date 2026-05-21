# LoPo 開発 ToDo

> **維持ルール (必読)**:
> - **100 行以内を目標**に維持
> - 完了タスクは即 [TODO_COMPLETED.md](./TODO_COMPLETED.md) へ移動
> - 大きな設計議論 / 詳細未確定の議題は `docs/.private/YYYY-MM-DD-{topic}.md` に集約
> - 確定済み設計方針は [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md)、 管理者手順は [ADMIN_SETUP.md](./ADMIN_SETUP.md)
> - **セッション終了時に必ず本ファイルの行数を確認 → 超過していたら整理**

---

## 現在の状態 (次セッションはここから読む)

- **ブランチ**: main、 セッション #48 (2026-05-21) で **Phase 3 実機 E2E を実施 → 不具合を順次修正** (通報→通知→案内→解決まで動作確認済)
- **完了 (#48)**: (1) Phase 3 の API ミューテーション(通報/編集/削除/通知既読)が **App Check ヘッダ未送信で本番 403** → 共有ヘルパー `src/lib/housingAuthHeaders.ts` (`buildHousingHeaders`) に App Check+認証を一元化し全経路修正。 (2) 通報の reason 別案内を **別モーダル重ね→詳細モーダル内バナー** に作り替え (スタッキング崩れ根絶、 `HousingReportGuideModal` 削除、 `HousingDetailContent` に `reportNotice` バナー)。 (3) 通知は「読んだだけ/一括既読」では消さず、 **解決アクション(誤りとして却下/異議/削除)で read=解決**。 「すべて既読」とクリック既読化を撤去
- **実機検証済**: 通報送信成功 → 家主に通知到達 → 通知クリックで詳細内バナー表示 → 「これは誤り(却下)」で解決(バッジ消える)
- **次セッション最優先 (Phase 3 仕上げ・要ログイン)**: ① 編集→保存で**自動解決＋詳細に即反映** (今は編集しても通知残る/閉じ開きしないと反映されない)、 ② **削除後に一覧から即消す＋フィードバック** (今はリロードまで残る・クリックしても無反応)、 ③ **画像が出ない**: 登録が `imageMode:'none'` 固定でツイート画像を保存していない (`api/housing/_registerListingHandler.ts:93`)。 draft→保存→表示を繋ぐ (やや大きめ)
- **方針確定**: /api/housing クライアントは必ず `buildHousingHeaders` 経由 (memory `reference_housing_appcheck_headers`)。 通報案内は詳細内バナー(重ねない)。 読んだだけでは解決しない
- **注意**: vitest 全 suite は firebase appcheck teardown ハング (テストは pass)。 pool='vmThreads' 厳守。 ENFORCE_APP_CHECK=true。 housing 系テストは housingAuthHeaders/firebase をモックして実 firebase ロード回避
- **本番データ**: housing_listings は実物件 1 件のみ (偽データ投入しない方針)。 リリース準備は `docs/housing-release-checklist.md`、 マップ作業は `docs/housing-map-todo.md` (SVG前提・行き方シート反映、 masaya 本人作業)

---

## 次セッション最優先: Phase 3 仕上げ (3 件)

**最初のコマンド (コピペ)**:
> `docs/TODO.md` を読んで。 Phase 3 の通報→通知→詳細内バナー→解決は #48 で実機 OK。 次は ① 編集→保存で自動解決＋詳細に即反映、 ② 削除後に一覧から即消す＋フィードバック、 ③ 登録時にツイート画像を保存(今 imageMode:'none' 固定で No image)。 1 件ずつ実機確認で。

### Phase 3 残り

- ① **編集の即反映＋解決**: `HousingEditModal` に onSaved を足し、 保存成功で詳細 listing を再 fetch (即反映) + 関連通報を markRead (解決)
- ② **削除後の一覧更新**: 削除成功で `useHousingListingsStore` から該当物件を除去 (remove メソッド追加) + 削除済みカードクリック時に toast。 今はリロードまで残る
- ③ **画像保存**: 登録が `imageMode:'none'` 固定 (`_registerListingHandler.ts:93`)。 SNS 抽出した画像 (postUrl/ogImageUrl, imageMode='sns') を draft→保存→表示まで繋ぐ
- **HousingCardExpanded 撤去判断** / ツアー同期 Firestore 化 / Cloudflare 前段化
- 細かい修正: `fieldState.confirm()` バグ、 dead code 撤去、 AddressFields renderBadge prop 化、 photo `alt`、 SNS rate limiting
- 30 日後物理削除 cron、 異議申し立てアプリ内 UI、 nsfw/griefing 管理者通知
- ハウジング i18n の en 翻訳 (公開言語=日英、 現状 ja 値コピー。 中韓は DC 分離で後追い)

### 後回し (Phase 2B、 マップ着手時) — マップだけ実データ化が未了

- マップビューは現状 **sampleWardLayout の mock 配置のまま** (実物件に地図座標が無いため)。 デフォルトビューが map なので、 ランディングは sample デモが見える。 **要検討**: 実マップ座標オーサリング (道中央線 + 交差点ノード + 軒位置データ + マップクリック登録 + ノード/エッジツール)、 または map 完成までデフォルトビューを list にするか

### UI 整え時にまとめて対応

- TopBar ログイン/アバター サイズ違い、 未ログイン登録モーダル背低違和感、 登録モーダル UX 磨き、 ✅ バッジ警告色化、 お気に入りモーダル ツアービルダー アニメ、 ハウジング i18n の en/ko/zh 翻訳追加 (ja のみ先行)、 スマホ最適化、 **(将来検討)** XIVAuth

---

## 相談したい

- **SEO レベル 2**: LP の Hero サブタイトル・カード説明に日本語キーワード (デザインとの両立相談)
- **SEO 効果計測**: Search Console 未導入

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
- インフラ: shared_plans クリーンアップ / CSP unsafe-inline / Sentry / Cloudflare 前段 / 認証プライバシー (← Step 1 完了で大幅前進)
- 新機能: Floating Timeline (Tauri v2) / FFLogs 精度 / SA 法改善 / 詠唱バー注釈 / public/icons/ 削除
- デッドコード: Lenis (`useSmoothScroll.ts`) 削除でバンドル減 / ハウジング背景動画の画面サイズ別出し分け

---

## アイデア / プロジェクト方針 / 並行 / バックログ

- アイデア: YouTube 埋込/導線、 こだわりトップ、 配置アニメ、 OCR、 横型タイムライン、 Gemma AI
- 方針: コンテンツ追加 = `add-content` → `seed-contents.ts`、 スキル正本 = Firestore、 SNS ハッシュタグ `#LoPo #FF14 #BuildInPublic #AISelection`
- 並行: マイコラージュ (収益化、 優先) / ハウジングは MUL 対象外で広告 OK (memory `project_lopo_mul_constraint.md`)
- バックログ: npm audit / a11y / SE 利用規約 / GDPR / SEO / FFLogs アイコン / MTST 分け / みんなの軽減表
<!-- When compacting, always preserve: 現在のタスク、変更中のファイルパス、本ファイルの「現在の状態」セクション -->
