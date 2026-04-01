# LoPo 開発ToDo

> 完了済みタスクは [TODO_COMPLETED.md](./TODO_COMPLETED.md) に移動済み
> 確定した設計方針は [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md) を参照
> 管理者手順は [ADMIN_SETUP.md](./ADMIN_SETUP.md) を参照

---

## 現在の状態（次セッションはここから読む）

- **ブランチ**: main直接 → push+デプロイ待ち
- **今回の作業**: テンプレート管理画面リデザイン実装完了
- **完了済み**: スプレッドシート型エディター・プラン昇格・スプシ読み込み・FFLogs翻訳取得・API拡張・コードレビュー修正
- **注意**: ENFORCE_APP_CHECK=true が本番有効、管理者UID: （旧管理者UID）、Vercel関数7/12、Vercel月100ビルド制限
- **次のタスク**: 本番で動作確認 → 管理画面の本格テスト
- **設計書**: `docs/superpowers/specs/2026-04-01-template-editor-redesign.md`
- **実装計画**: `docs/superpowers/plans/2026-04-01-template-editor-redesign.md`
- **βフィードバック**: `docs/BETA_FEEDBACK.md` に整理済み
- **既知の制限**: フェーズ列は読み取り専用（時間変更でフェーズが連動）、FFLogs翻訳はキルログのみ対応

---

## バグ
- [ ] LP: THREE.Clock非推奨警告 — THREE.Timerに移行（動作影響なし）
- [ ] FFLogsインポート: 英語主言語ログで言語取得できない（後回し）
- [ ] FFLogsインポート: 無敵/リビングデッド中ダメージの反映（後回し）
- [ ] オートプラン: 無敵はなるべく同じ技に使いたい

## 進行中
- [x] テンプレート管理画面リデザイン（実装完了、本番動作確認待ち）

## 未着手（次にやること）
- [ ] 管理画面の本格テスト（全ページ・ウィザード・API、本番公開前に実施）
- [ ] shared_plansクリーンアップ（アカウント削除時logoBase64残留）
- [ ] CSP unsafe-inline除去（β後、reCAPTCHA/Firebase Auth依存）
- [ ] テスト基盤（planService.ts等の純粋関数から）
- [ ] エラー監視（Sentry無料枠 or Discord Webhook）
- [ ] ヒールスキル追加（テトラ、ディグニティ等のoGCDヒール）
- [ ] スマホ対応追加改善（モーダル最適化、タブレット）

## 未着手（将来）
- [ ] 古いプランの自動アーカイブ（30件超過時）
- [ ] SA法オートプランナー改善
- [ ] 詠唱バー注釈機能
- [ ] AI APIでオートプラン
- [ ] ハウジングツアープランナー（要件定義済み、Pretext採用決定）
- [ ] public/icons/ 削除（バンドル2.1MB削減）
- [ ] チートシートモード検討

## アイデア・やりたいこと
- YouTube埋め込み（LP・ハウジングツアー）
- こだわりのトップページ（AIデザインNG）
- 軽減配置時のフィードバックアニメーション
- UI全般の温度感・アニメーション改善
- メール+パスワードログイン検討

## バックログ（セキュリティ・運用・品質・検討中）
- [ ] セキュリティ: localStorage認証トークン / Google Fonts SRI / Firestoreパス検証 / バッチ削除中断
- [ ] 運用: npm audit定期確認 / a11y / SE利用規約 / GDPR / SEO
- [ ] 検討中: FFLogsアイコン / チートシートMTST分け / フェーズスペース / テンプレ日本語名 / みんなの軽減表 / 軽減モーダルサイズ
