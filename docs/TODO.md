# LoPo 開発ToDo

> 完了済みタスクは [TODO_COMPLETED.md](./TODO_COMPLETED.md) に移動済み
> 確定した設計方針は [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md) を参照
> 管理者手順は [ADMIN_SETUP.md](./ADMIN_SETUP.md) を参照

---

## 現在の状態（次セッションはここから読む）

- **ブランチ**: `feature/tutorial-overhaul`（mainにはまだマージしていない）
- **今回の作業**: コンテキスト最適化（CLAUDE.md圧縮、TODO.md 3分割、rules/作成、Hooks設定、メモリ整理）+ チュートリアルバグ修正4件
- **最優先**: PartyAutoFill.tsx の自動埋めアニメーション修正（DOMからスロット/アイコンを見つけられていない）
- **次**: チュートリアル全体を `npm run dev` で通し確認（STEP1→2のローディング待ち、STEP11のピル位置修正が正しく動くか）
- **その後**: feature/tutorial-overhaul を main にマージ → デプロイ
- **注意**: ENFORCE_APP_CHECK=true が本番有効、管理者UID: （旧管理者UID）、Vercel関数7/12

---

## バグ
- [ ] LP: THREE.Clock非推奨警告 — THREE.Timerに移行（動作影響なし）
- [ ] FFLogsインポート: 英語主言語ログで言語取得できない（後回し）
- [ ] FFLogsインポート: 無敵/リビングデッド中ダメージの反映（後回し）
- [ ] オートプラン: 無敵はなるべく同じ技に使いたい

## 進行中
- [ ] チュートリアル全面刷新 — `feature/tutorial-overhaul`ブランチ。残り: PartyAutoFill修正 + PillFlyブラッシュアップ

## 未着手（次にやること）
- [ ] フッター法的リンクまとめ（プライバシー・利用規約・特商法をドロップダウン化）
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
