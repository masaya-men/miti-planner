# LoPo 開発 ToDo

> **維持ルール (必読)**:
> - **100 行以内を目標**に維持
> - 完了タスクは即 [TODO_COMPLETED.md](./TODO_COMPLETED.md) へ移動
> - 大きな設計議論 / 詳細未確定の議題は `docs/.private/YYYY-MM-DD-{topic}.md` に集約
> - 確定済み設計方針は [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md)、 管理者手順は [ADMIN_SETUP.md](./ADMIN_SETUP.md)
> - **セッション終了時に必ず本ファイルの行数を確認 → 超過していたら整理**

---

## 現在の状態 (次セッションはここから読む)

- **ブランチ**: main。 2026-05-27 セッション #60 で **ハウジング α 公開向け 5/27 開発デー一括完了 → デプロイ予定** (詳細は [TODO_COMPLETED.md](./TODO_COMPLETED.md) #60)。 アパート対応 (apartmentBuilding 1/2) + 多言語化 (masterData 案 B ネスト) + マップ→list デフォルト + /admin 通報モデ案 B + register/update API バグ修正。 typecheck + 純関数 vitest 40/40 pass + build 6.67s 成功済
- **次セッション最優先 (ハウジング 5/28 23:59 α 公開強行)**: 本番デプロイ後、 ユーザーが本番で実機確認 (アパート登録 / 家登録 / /admin 通報モデ)。 不具合あれば修正 → 最終 push → アプデ告知

---

## ハウジング 5/28 検証+追い込みデー

1. **本番実機確認** (Claude が dev では Discord OAuth 不可なので本番でユーザー操作): アパート登録 (号棟 1/2 + 部屋番号) / 家登録 / 言語切替で住所表記確認 / /admin/housing-reports の動作確認
2. **実機 E2E** (2 アカ通報フロー: 通報→ベル→reason 別ガイド→編集/削除→Not found)
3. 検証で発覚バグ修正、 ユーザーがコールドスタート用に物件登録
4. 最終 push + **アプデ告知**: #59 軽減表分 + ハウジング α 公開 (まとめて 1 投稿 or 分割)

**リスク**: バッファゼロ。 1 件想定外バグ出たら 29 日朝にスライド許容。 マイコラージュは 28 日まで凍結

---

## アプデ告知保留

軽減表メモ機能 + perf + 磨きをまとめた告知文ドラフトは前セッションで提示済 (Discord ja のみ + システム通知 ja/en、 ko/zh は ja コピー)。 ハウジング α 公開と同時タイミングか別か要判断

---

## #59 残課題 (新規発見、 公開後対応 OK)

- **SystemNotificationBar.test.tsx を title のみ仕様に追従更新** (現状古い title+body 期待で fail する可能性)
- **ESLint `react-hooks/rules-of-hooks` 有効化** (今回 hook 違反 → React #310 で本番真っ白事故。 build (tsc) は通ってしまう、 ESLint で push 前検出したい)
- **「表を展開する」 click handler 394ms 重い** (#59 計測ログから判明、 別ボトルネック。 フェーズ全展開時の React レンダー時間)
- **メモリ振れ 600-800MB の本質改善** (DOM 73,060 個由来、 将来仮想化 react-window で対処。 sticky/行またぎ調整必要で大改修)

---

## ハウジング Phase 3 残り (α 公開後対応)

- **#60 残課題**: UI コンポーネント test 追従 (HousingRegisterAddressFields / HousingRegisterView / HousingRegisterModal — フォーム改修で確実に落ちる) / カードデザイン本格刷新 (Allmarks 風) / マップ実データ化 + `APARTMENT_SPOT[area]` 定義 / ko/zh の翻訳実値
- **タグ仕様全面刷新** (2026-05-27 ユーザー発案、 詳細は [docs/.private/2026-05-27-tag-system-redesign.md](./.private/2026-05-27-tag-system-redesign.md)): ①公式 FF14 タグ + ②シーズン/主要イベント + ③個人タグ (1 ユーザー 1 タグ制約) の 3 カテゴリ構成。 「好きなハウジンガーの家だけのツアー」 が組める文化的価値が中核。 軽量モデレーション (通報→削除依頼→無対応で自動非表示)
- ④ **リッチメディア化** (複数画像 + 動画埋め込み + ビューポート内自動再生): Allmarks 知見流用 (memory `reference_allmarks_mycollage`)。 ①複数画像をホバー/全切り替えで閲覧 ②詳細で動画埋め込み (**CSP に video.twimg.com 追加必須**) ③ビューポート内自動再生=動画最大3本/画像は性能制約なく全切り替え
- **通報モデの穴**: /admin の復帰 (isHidden→false) / BAN UI、 異議申し立てアプリ内 UI、 nsfw/griefing 管理者通知、 30 日後物理削除 cron
- **HousingCardExpanded 撤去判断** / ツアー同期 Firestore 化 / Cloudflare 前段化
- 細かい修正: `fieldState.confirm()` バグ、 dead code 撤去、 AddressFields renderBadge prop 化、 photo `alt`、 SNS rate limiting、 通知 ✕ の見た目磨き

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
- 新機能: Floating Timeline (Tauri v2) / FFLogs 精度 / SA 法改善 / 詠唱バー注釈 / public/icons/ 削除
- デッドコード: Lenis 削除 / ハウジング背景動画の画面サイズ別出し分け

---

## アイデア / プロジェクト方針 / 並行 / バックログ

- アイデア: YouTube 埋込/導線、 こだわりトップ、 配置アニメ、 OCR、 横型タイムライン、 Gemma AI
- 方針: コンテンツ追加 = `add-content` → `seed-contents.ts`、 スキル正本 = Firestore、 SNS ハッシュタグ `#LoPo #FF14 #BuildInPublic #AISelection`
- 並行: マイコラージュ (収益化、 28 日まで凍結 / リリース後再開) / ハウジングは MUL 対象外で広告 OK
- バックログ: npm audit / a11y / SE 利用規約 / GDPR / SEO / FFLogs アイコン / MTST 分け / みんなの軽減表
<!-- When compacting, always preserve: 現在のタスク、変更中のファイルパス、本ファイルの「現在の状態」セクション -->
