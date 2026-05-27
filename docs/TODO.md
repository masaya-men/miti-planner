# LoPo 開発 ToDo

> **維持ルール (必読)**:
> - **100 行以内を目標**に維持
> - 完了タスクは即 [TODO_COMPLETED.md](./TODO_COMPLETED.md) へ移動
> - 大きな設計議論 / 詳細未確定の議題は `docs/.private/YYYY-MM-DD-{topic}.md` に集約
> - 確定済み設計方針は [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md)、 管理者手順は [ADMIN_SETUP.md](./ADMIN_SETUP.md)
> - **セッション終了時に必ず本ファイルの行数を確認 → 超過していたら整理**

---

## 現在の状態 (次セッションはここから読む)

- **ブランチ**: main。 本セッション 6 commit push 予定 (Phase 2-5 sort)。
- **方針 (2026-05-27 確定)**: **5/28 α 公開期限を撤回**、 1 セッション 1 タスクで丁寧に進める。 画像も動画も全部「外部 URL 直接 + 画面内自動再生」 に統一。 詳細 memory `project_housing_phase_status`
- **直近完了 ✅** (詳細設計 → [.private 設計書](./.private/2026-05-27-housing-video-3frame-and-phase2.md)):
  - Phase 2-5 同 addressKey 内 lastConfirmedAt desc 2 段 sort (= 案 A ストア層対応) — vitest 1287 + tsc + build pass、 実機未検証 (ユーザー判断でスキップ)
  - 派生: Phase 2-1 配線漏れ修正 (galleryAdapter が addressKey を pass-through していなかった)
  - Phase 2-1〜2-4 + 動画 3 フレーム + バグ修正群 (詳細は TODO_COMPLETED.md)
- **次セッション最優先** (= 設計書通り順次):
  1. **新要望 3 点を Phase 2-6/2-7 に統合** (= 重複の自動掃除シナリオ、 設計書 §3.8): 詳細モーダル内の重複一覧表示 / 長押し報告 (誤爆対策、 1.5-2 秒) / ツアー自動追加 (個別削除可否要詰め)
  2. **Phase 2-6 「📅 1 ヶ月以上更新なし」 バッジ + 「ちがった」 ボタン**: 重複時のみ表示、 4 カード variant に追加
  3. **Phase 2-7 重複時 1 撃 hide**: _reportListingHandler に同 addressKey 他 listing 存在判定 + 閾値 1
  4. **通知 UI/UX 磨き** (Phase 2-4 後の課題、 ユーザー指摘 2026-05-27): listingTitleSnapshot が addressKey raw (例「Mana|Pandaemonium|Mist|W1|B1|A25」) で出てしまう → `formatHousingAddress` 経由の表示用住所をスナップショットすべき。 通知ドロップダウンのレイアウト全般も後で刷新
  5. **split-tweet 対応** (画像ツイ + 住所リプ別 URL、 設計書 §8、 ユーザーと論点詰めてから)
- **その後**: 既存テスト物件一掃 + コールドスタート (ユーザー作業) → アプデ告知 (#59 + ハウジング α)
- **保留**: Cloudflare 議論は外部 URL 化で意味変わる→将来再検討
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
