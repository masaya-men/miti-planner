# LoPo 開発ToDo

> 完了済みタスクは [TODO_COMPLETED.md](./TODO_COMPLETED.md) に移動済み
> 確定した設計方針は [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md) を参照
> 管理者手順は [ADMIN_SETUP.md](./ADMIN_SETUP.md) を参照

---

## 現在の状態（次セッションはここから読む）

- **ブランチ**: main直接
- **注意**: ENFORCE_APP_CHECK=true、Vercel関数8/12、月100ビルド制限
- **軽減アプリ: 完成・公開済み（2026-04-13 完成ツイート済み）**
- 残タスクはバグ修正・多言語・将来機能のみ（下記参照）

### 🔴 次セッション最優先: OGP 画像が X で表示されない問題の最終解決

**状況**: X 上で OGP 画像カードが画像なしの summary card で表示される問題。
このセッション内で 6 commit 投入したが完全解決に至らず。

**解決策の計画書（次セッションで実装）**:
[docs/superpowers/plans/2026-04-18-ogp-static-cache-with-auto-cleanup.md](./superpowers/plans/2026-04-18-ogp-static-cache-with-auto-cleanup.md)

**方針**: Lazy 生成 + Firebase Storage 永続キャッシュ + Vercel Cron 自動クリーンアップ
- URL: `lopoly.app/og/{hash}.png`（同一オリジン静的画像、/api/ 非経由）
- 重複排除: imageHash で同内容は 1 ファイル
- 自動クリーンアップ: 週次 Cron で 30 日未使用を削除
- 工数: 約 3 時間
- 制約: 既存機能を壊さない、ハードコーディング禁止、後方互換維持

**このセッションで本番投入済みの 6 commits**:
- `461023e` showLogo フラグ伝播
- `675b1ca` クエリパラメータ順序統一
- `6dd7249` 多層防御（showTitle 永続化、サーバー側プリウォーム、favicon バンドル化）
- `c35cc3c` robots.txt で /api/og 許可（X クローラーブロック解除）
- `9ee744e` og:url 修正
- `628f526` logoHash で内容バージョン付与（モーダル内ロゴ更新時の CDN 陳腐化対策）

### 次にやること（OGP 解決の後）
- **Phase 2 本番観察（デプロイ直後）**
  - `scripts/_tmp_check_viewcount.ts` で top10 を一度スナップショット（copyCount, viewCount）
  - 本番で人気ボタン→ボトムシート→コピーまで実行 → Firestore `shared_plans/{id}.copyCountByDay` に今日のキーが増えることを確認
  - 別ブラウザ/シークレットでも同様にコピー → 匿名IDで重複排除されていることを確認（同一ブラウザから2回コピー → copyCount が1しか増えない）
  - `/privacy` を4言語で切り替えて「匿名ID集計」「日別コピー集計」文言が出ることを確認
- **Phase 3（Phase 2 本番確認後）**
  - 管理画面 featured 設定UI。プランは Phase 2 本番確認後に作成
- **フェーズ表示の最後のフェーズが壊れて見える件（未着手・要設計）**
  - 前セッションで一度着手したが複雑・影響範囲大のため撤回
  - `ensurePhaseEndTimes` が最後フェーズに `startTime+1` を設定する根本原因あり
  - `addPhase`の`containingPhase`判定・`BoundaryEditModal` 等多数参照あり
  - セッション初頭に**一緒に安全な計画**を立ててから着手
- **今セッションの完了事項**（2026-04-17）
  - ✅ ボトムシートUX改善（初期ロード全面スピナー + コピー進捗実値・パルス・最低400ms、本番確認済み）
  - ✅ 通知音パス修正（FFXIV_SE/FFXIV_Notification.mp3 へ更新）
  - ✅ 野良主流ランキング再設計: 設計書 + Phase 1/Phase 2 実装プラン作成
  - ✅ 野良主流ランキング Phase 1: viewCount 自己強化ループ止血（`/api/share?preview=true` 実装、ボトムシート側フラグ付与、PopularPageは対象なし）
  - ✅ 野良主流ランキング Phase 2: 匿名ID集計 + 日別バケット旬ランキング + featured活性化 + ポリシー4言語更新（Task 1-12 + レビュー指摘 fix 2件、151/151 テスト通過）
  - ✅ ボトムシート初期タブ選択修正（Reactバッチ更新問題）
  - ✅ ライトモード時ジョブ移行モーダル背景色修正
  - ✅ タンクLBスキル追加（Lv1/2/3 × 4ジョブ、アイコン3種、Firestore+Storage同期）
  - ✅ feedback_icon_firebase_upload.md メモリ追加（アイコン追加時はStorageアップロード必須）
- 残り: shared_plansテストデータをFirebase Consoleで削除 → 正式な1件を共有
- デプロイ確認: サイレント圧縮の実動作（2026-04-20以降に確認）
- ハウジングツアープランナー着手（別プロジェクト作業後に開始)

### Phase 2 後の follow-up（優先度低・時間あるとき）
- [ ] `api/popular/index.ts` `mapDoc` と `PopularEntry` 型の `viewCount` フィールドは Phase 2 以降未使用 → 削除整理
- [ ] en/ko の `privacy_section1_auto_items` 既存翻訳でインラインコンマが bullet 分割される pre-existing バグ（Phase 2 で追加した末尾項目は影響なし、既存項目のみ軽微表示崩れ）
- [ ] `PopularPage.tsx` `handleCopyAllRank` の localStorage persist がループ外（途中でタブ閉じると client dedupe list が保存されない、匿名ID サーバ側 dedup でカバー済み・影響軽微）

---

## バグ・不具合（要修正）

### 中
- [ ] ラベル名が管理画面で取得できない（スプシヘッダー問題？）
- [ ] TS5.9互換: mockData.ts等のインポートパスに拡張子が必要（3件）

### 低（動作影響なし・エッジケース）
- [ ] FFLogsインポート: 英語主言語ログで言語取得できない
- [ ] FFLogsインポート: 無敵/リビングデッド中ダメージの反映
- [ ] オートプラン: 無敵はなるべく同じ技に使いたい
- [ ] パルス設定: カスタムカラーのスライダー初期位置が端に寄る（軽微）

---

## 未着手（次にやる���と）

### 多言語
- [ ] ハウジングツアーページの言語対応

### その他
- [ ] AA名統一: 英語も"AA"に変更（中韓も同様）
- [ ] モーダル出現アニメーション改善（スプリング物理ベース、設計書あり）
- [ ] 本番動作確認（ギミックグループ・フェーズ編集・翻訳伝播・ダメージインポート）
- [ ] shared_plansクリーンアップ（アカウント削除時logoBase64残留）
- [ ] CSP unsafe-inline除去（β後、reCAPTCHA/Firebase Auth依存）
- [ ] エラー監視（Sentry無料枠 or Discord Webhook）
- [ ] スマホ対応追加改善（モーダル最適化、タブレット）
- [ ] セキュリティ: 認証方式のプライバシー調査（メアド保存範囲・Anonymous認証検討）
- [ ] セキュリティ: localStorage認証トークン / Google Fonts SRI / Firestoreパス検証

## 未着手（将来）

### 新機能
- Floating Timeline (PiP): Tauri v2が現実的。Document PiP APIでは透過不可
- FFLogsインポート精度向上: 敵攻撃データ取得、テンプレート昇格、API制限解除申請
- ハウジングツアープランナー（要件定義済み、Pretext採用決定）
- SA法オートプランナー改善 / AI APIでオートプラン
- 詠唱バー注釈機能 / チートシートモード検討
- public/icons/ 削除（バンドル2.1MB削減）

## UI改善（検討中）
- [ ] アイコンアニメーション化（SVGアニメ、FFLogsボタン等）
- [ ] みんなの軽減表: 機能の位置づけ再検討（規約更新は不要と判断済み — 既存共有プランのランキング表示のみ、新たなデータ収集なし）
- [ ] 紹介PV動画: CapCut/DaVinci Resolveでの制作を検討

## アイデア・やりたいこと
- YouTube埋め込み / こだわりのトップページ（AIデザインNG）
- 軽減配置時のフィードバックアニメーション / UI温度感改善
- オートプラン精度改善（スプシ教師データ・スコアリングモデル）
- YouTube導線: ジョブごとにスキル回し動画URL設定→アイコン表示
- スクショOCR: ゲーム画面から軽減自動読み取り
- 管理画面FFLogsインポート（テンプレート作成効率化）
- 横型タイムライン＋音ゲーモード（PiP）
- Gemma搭載AI機能

### 多言語リファレンスURL（zh/ko翻訳作業用）
- 韓国語: https://guide.ff14.co.kr/job/paladin/1?type=E#pve
- 中国語: https://actff1.web.sdo.com/project/20190917jobguid/index.html#/index

## バックログ（運用・品質・検討中）
- [ ] 運用: npm audit定期確認 / a11y / SE利用規約 / GDPR / SEO
- [ ] 検討中: FFLogsアイコン / チートシートMTST分け / フェーズスペース / テンプレ日本語名 / みんなの軽減表 / 軽減モーダルサイズ

## プロジェクト方針

### スキルデータ管理
- **正本: Firestore**（管理画面から追加・編集するのが正規ワークフロー）
- **mockData.ts**: フォールバック + テスト用 + 初期seed用
- **seed-skills-stats.ts**: マージ型（Firestoreのみのスキルは保持）
- スキル追加は管理画面で完結。将来的にFirestore→mockData.tsのexportスクリプト

### SNS Build in Public
- 進捗時にJP+ENツイート案を提案（ツリー形式、"Translated by AI" 付記）
- #LoPo #FF14 #BuildInPublic #AISelection
