# LoPo 開発 ToDo

> **維持ルール (必読)**:
> - **100 行以内を目標**に維持 (旧目標 50 → 現実的に 100 に緩和、 ただし可能なら 50 を目指す)
> - 完了タスクは即 [TODO_COMPLETED.md](./TODO_COMPLETED.md) へ移動
> - 大きな設計議論 / 詳細未確定の議題は `docs/.private/YYYY-MM-DD-{topic}.md` に集約
> - 確定済み設計方針は [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md)、 管理者手順は [ADMIN_SETUP.md](./ADMIN_SETUP.md)
> - **セッション終了時に必ず本ファイルの行数を確認 → 超過していたら整理**

---

## 現在の状態 (次セッションはここから読む)

- **ブランチ**: main 直接
- **最新本番デプロイ**: セッション 19 末 (占星術師ドロー chain prompt 完成)
- **注意**: ENFORCE_APP_CHECK=true、 Vercel 関数 9/12、 月 100 ビルド制限
- **軽減アプリ: 完成・公開済み** (2026-04-13 完成ツイート済み)

---

## 次セッション最優先

1. **ハウジング Sub-spec 2B** (Gallery & Search) — 並行プロジェクト、 lopoly.app/housing 統合方針

---

## 相談したい (次セッションで着手検討)

- **SEO レベル 2**: LP の Hero サブタイトル・カード説明に日本語キーワード。 デザイン変更伴うため英語ミニマリスト美学との両立を相談
- **SEO 効果計測**: Search Console 未導入。 導入すれば実流入キーワードを把握可

---

## 既知の残課題 (中規模、 別セッションで設計から)

- **同期不安定** (2026-04-29 報告): 軽減配置直後にタブを閉じて別端末で開くと出ない / 同期競合コピー / PC データが古い状態に戻る等の複合症状。 根本対応案: (1) sendBeacon ベース独自同期 (2) `syncDirtyPlans` 競合判定見直し (3) PULL 時にバージョン番号併用
- **ローカル削除→即同期で復活 潜在バグ** (2026-04-28): `deletePlan` が `ownerId === 'local'` のとき `_deletedPlanIds` に追加しない。 修正: 同期成功後にローカル `ownerId` を `uid` に書き換え
- **EventModal 計算ロジック責務肥大**: `handleCalculate` を `applyHealingIncrease` / `applyMitigationFilters` / `applyShieldCalc` 等に分割。 calculator.ts と重複部分は将来共通化
- **CRIT 倍率のステータス連動**: 現状 `CRIT_MULTIPLIER = 1.60` 固定 → `getCritMultiplier(level, ilv?)` 関数化 + IL 切替 UI

---

## バグ・不具合 (要修正)

- **中**: ラベル名が管理画面で取得できない (スプシヘッダー問題?)
- **低 (動作影響なし)**: FFLogs インポート英語ログ / 無敵反映 / オートプラン同一技 / パルス設定スライダー初期位置 / ヘッダー縦罫線サブピクセル
- **Phase 2 follow-up (優先度低)**: api/popular の `viewCount` 削除 / en/ko privacy_section1_auto_items の bullet 分割バグ / `MitigationSheet.copyPlan` の POST 失敗時 localStorage 残留

---

## 未着手・将来計画

- **多言語**: ハウジングツアーページ言語対応、 AA 名統一 (英語・中韓も "AA" に)
- **UI / モバイル**: モーダル出現アニメ (スプリング物理ベース、 設計書あり)、 スマホ最適化、 タブレット対応
- **インフラ**: shared_plans クリーンアップ (logoBase64 残留)、 CSP unsafe-inline 除去 (β後)、 Sentry 等エラー監視、 認証プライバシー / Firestore パス検証
- **新機能 (将来)**: Floating Timeline (PiP, Tauri v2)、 FFLogs 精度向上、 ハウジングツアープランナー、 SA 法オートプラン改善、 詠唱バー注釈、 public/icons/ 削除 (バンドル -2.1MB)
- **UI 改善 (検討中)**: SVG アイコンアニメ、 紹介 PV 動画 (CapCut/DaVinci)

---

## アイデア・やりたいこと

YouTube 埋め込み / こだわりトップページ (AI デザイン NG) / 軽減配置フィードバックアニメ / オートプラン精度改善 (スプシ教師データ) / YouTube 導線 (ジョブ別スキル回し動画) / スクショ OCR / 管理画面 FFLogs インポート / 横型タイムライン + 音ゲーモード (PiP) / Gemma 搭載 AI 機能

### 多言語リファレンス URL (zh/ko 翻訳作業用)

- 韓国語: https://guide.ff14.co.kr/job/paladin/1?type=E#pve
- 中国語: https://actff1.web.sdo.com/project/20190917jobguid/index.html#/index

---

## プロジェクト方針

- **スキルデータ管理**: Firestore = 正本 (管理画面が正規ワークフロー)、 mockData.ts = フォールバック + テスト + 初期 seed、 seed-skills-stats.ts = マージ型 (Firestore のみのスキルは保持)
- **SNS Build in Public**: 進捗時に JP+EN ツイート案を提案 (ツリー形式、 "Translated by AI" 付記)、 ハッシュタグ `#LoPo #FF14 #BuildInPublic #AISelection`

---

## 並行プロジェクト

- **マイコラージュ (収益化アプリ、 別プロジェクト)**: ユーザー優先指示継続、 並行進行
- **ハウジングツアー** (lopoly.app/housing 統合、 MUL 対象外で広告 OK): Sub-spec 2A 完了、 2B (Gallery & Search) 着手予定、 詳細は memory `project_lopo_mul_constraint.md`

---

## バックログ

運用 (npm audit / a11y / SE 利用規約 / GDPR / SEO) / 検討中 (FFLogs アイコン、 チートシート MTST 分け、 フェーズスペース、 テンプレ日本語名、 みんなの軽減表、 軽減モーダルサイズ)

<!-- When compacting, always preserve: 現在のタスク、変更中のファイルパス、本ファイルの「現在の状態」セクション -->
