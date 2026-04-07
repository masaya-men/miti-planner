# LoPo 開発ToDo

> 完了済みタスクは [TODO_COMPLETED.md](./TODO_COMPLETED.md) に移動済み
> 確定した設計方針は [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md) を参照
> 管理者手順は [ADMIN_SETUP.md](./ADMIN_SETUP.md) を参照

---

## 現在の状態（次セッションはここから読む）

- **ブランチ**: main直接
- **最優先**: Phase/Label startTime統一リファクタリング（段階2: ラベル Label[]化）
- **設計書**: `docs/superpowers/specs/2026-04-07-phase-label-starttime-design.md`
- **段階1完了**: フェーズstartTime化（11タスク全完了、ビルド・105テスト通過）
- **未push**: 前セッション4件 + 今セッション11件（計15件のコミット）
- **注意**: ENFORCE_APP_CHECK=true、Vercel関数7/12、月100ビルド制限
- **同期設計**: 5分クールダウン(自動のみ)、初回editは即push、タブ切替/離脱/手動は即push、競合時は両版コピー保存

### 今回の作業内容（段階1完了）
- Phase型を `{ id, name: LocalizedString, startTime, endTime? }` に変更
- 旧Phase→新Phase変換関数 `migratePhases` 実装（テスト9件）
- useMitigationStoreのPhase操作をstartTimeベースに更新
- BoundaryEditModal新規作成（多言語入力+終端時間変更+TL選択、フェーズ・ラベル共用）
- Timeline.tsx/TimelineRow.tsxのフェーズ描画・操作をstartTimeベースに更新
- TL選択モード（ハイライト付き終端時間選択）実装
- HeaderPhaseDropdownをstartTimeベースに更新
- FFLogsMapper・テンプレート変換をstartTime+LocalizedStringに更新
- 既存テスト全更新（105テスト全パス）
- PhaseModal.tsx削除、デバッグログ削除、AdminGuardバイパス削除

### 次セッションでやること
1. まとめてpush（ビルド1回で済ませる）
2. 本番動作確認（フェーズ表示・編集・FFLogsインポート）
3. 段階2（ラベル Label[]化）の実装計画作成
4. 段階2実装

---

## バグ・不具合（要修正）

### 中（特定環境・管理者向け）
- [x] ~~テンプレート手動登録の反映が大幅に遅延する~~ 解消済み
- [ ] ラベル名が管理画面で取得できない（スプシヘッダー問題？）
- [x] ラベル分裂 → Phase/Labelリファクタリングで根本解決予定
- [x] テンプレートエディタ空ラベル編集不可 → undefinedマッチ修正済み

### FFLogs残課題
- [ ] DSRフェーズ: フェーズ区切り・ボス名が正しくない（テンプレート対応予定、一旦無視）
- [ ] 英語ログ警告: 未確認

### 低（動作影響なし・エッジケース）
- [ ] FFLogsインポート: 英語主言語ログで言語取得できない
- [ ] FFLogsインポート: 無敵/リビングデッド中ダメージの反映
- [ ] オートプラン: 無敵はなるべく同じ技に使いたい
- [ ] パルス設定: カスタムカラーのスライダー初期位置が端に寄る（軽微）

---

## 未着手（次にやること）

### Phase/Label リファクタリング（進行中）
- [x] 設計書作成・承認
- [x] 段階1（フェーズ）実装計画作成
- [x] 段階1 実装（11タスク完了、ビルド・テスト通過）
- [ ] 段階2（ラベル）計画作成・実装

### 多言語
- [ ] コンテンツ名・軽減モーダル等のデータ系zh/ko対応（LocalizedString拡張）
- [ ] コンテンツ種類ボタン・コンテンツ名の中韓翻訳
- [ ] ランディングページのLangToggle（2言語→4言語対応）
- [ ] ハウジングツアーページの言語対応

### 管理画面改善
- [ ] AA名統一: 英語も"AA"に変更（中韓も同様）

### その他
- [ ] 本番動作確認（ギミックグループ・フェーズ編集・翻訳伝播・ダメージインポート）
- [ ] shared_plansクリーンアップ（アカウント削除時logoBase64残留）
- [ ] CSP unsafe-inline除去（β後、reCAPTCHA/Firebase Auth依存）
- [x] テスト基盤（98テスト、コア関数カバー済み）
- [ ] エラー監視（Sentry無料枠 or Discord Webhook）
- [ ] ヒールスキル追加（テトラ、ディグニティ等のoGCDヒール）
- [ ] スマホ対応追加改善（モーダル最適化、タブレット）
- [ ] セキュリティ: 認証方式のプライバシー調査（メアド保存範囲・Anonymous認証検討）
- [ ] セキュリティ: localStorage認証トークン / Google Fonts SRI / Firestoreパス検証

## 未着手（将来）

### 新機能: Floating Timeline (PiP)
- Document Picture-in-Picture APIで別窓タイムライン表示
- 自分のジョブだけの軽減を簡潔表示、フルパーティ表示も選択可能
- 透過対応でゲーム画面に重ねて表示

### FFLogsインポート精度向上
- 敵の全攻撃データを取得→自動判定の精度を上げる
- テンプレート昇格: 完璧なタイムラインを管理者承認でテンプレート化
- FFLogs API制限解除申請（Public化後に検討）
- FFLogsへコンタクト: API制限解除 + ロゴ/アイコン使用許可の問い合わせ（Public化済み）

### その他
- [ ] 古いプランの自動アーカイブ（30件超過時）
- [ ] SA法オートプランナー改善
- [ ] 詠唱バー注釈機能
- [ ] AI APIでオートプラン
- [ ] ハウジングツアープランナー（要件定義済み、Pretext採用決定）
- [ ] public/icons/ 削除（バンドル2.1MB削減）
- [ ] チートシートモード検討

## アイデア・やりたいこと
- YouTube埋め込み（LP・ハウジングツアー・軽減表内に解説動画への導線）
- こだわりのトップページ（AIデザインNG）
- 軽減配置時のフィードバックアニメーション
- UI全般の温度感・アニメーション改善
- オートプラン精度改善（スプシ教師データ・スコアリングモデル）
- YouTube導線: ジョブごとにスキル回し動画URL設定→軽減表にアイコン表示
- ストラテジーボード連携（保留）

## バックログ（運用・品質・検討中）
- [ ] 運用: npm audit定期確認 / a11y / SE利用規約 / GDPR / SEO
- [ ] 検討中: FFLogsアイコン / チートシートMTST分け / フェーズスペース / テンプレ日本語名 / みんなの軽減表 / 軽減モーダルサイズ

## プロジェクト方針
### SNS Build in Public
- 進捗時にJP+ENツイート案を提案（ツリー形式、"Translated by AI" 付記）
- #LoPo #FF14 #BuildInPublic #AISelection
