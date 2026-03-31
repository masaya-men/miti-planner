# LoPo 開発ToDo

> 完了済みタスクは [TODO_COMPLETED.md](./TODO_COMPLETED.md) に移動済み
> 確定した設計方針は [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md) を参照
> 管理者手順は [ADMIN_SETUP.md](./ADMIN_SETUP.md) を参照

---

## 現在の状態（次セッションはここから読む）

- **ブランチ**: `feature/tutorial-overhaul`（mainにはまだマージしていない）
- **最優先**: PartyAutoFill.tsx の自動埋めアニメーション修正（DOMからスロット/アイコンを見つけられていない）
- **次**: PillFly.tsx のピル飛行演出ブラッシュアップ（CHECK→ジャンプ→着地のタイミング改善）
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

## セキュリティ残課題
- [ ] localStorage認証トークンリスク（XSS対策で多層防御）
- [ ] Google Fonts SRI不可（CSP style-srcで代替防御済み）
- [ ] Firestoreパスフォーマット検証（admin専用のため影響限定的）
- [ ] クライアント側バッチ削除の中断リスク

## 運用・品質基盤
- [ ] npm audit 定期確認
- [ ] アクセシビリティ（キーボード操作・スクリーンリーダー・色覚多様性）
- [ ] SE素材利用規約の準拠確認
- [ ] GDPR対応
- [ ] SEO確認（meta description、構造化データ）

## 継続検討（方針未確定）
- FFLogsボタンにFFLogsアイコン
- チートシートのMTST分け
- フェーズ概念がないコンテンツのスペース処理
- テンプレート日本語攻撃名
- 「みんなの軽減表」の配置場所
- 軽減選択モーダルの画面サイズ対応
