# LoPo 開発ToDo

## 進行中
- [ ] Twitter(X) ログイン — OAuth 2.0 API作成済み。X側で「問題が発生しました」エラー。X Developer Portalの設定（App Type等）要確認
- [ ] ログインメニュー — クリック型+ツールチップ、ログアウト赤字化・多言語対応済み。デプロイ後に見た目確認
- [ ] Discord/Twitter アイコン・表示名 — postMessageでプロフィール情報を渡してupdateProfileする対応中

## 未着手
- [ ] デバッグ用コード削除（Discord APIのスタックトレース出力、本番前に削除）
- [ ] SA法オートプランナー改善
- [ ] 動的OGP共有システム

## アイデア・やりたいこと
- ログイン体験をプロレベルに — Miramiruのようなスマートなログインフロー。体験を損なわないUI（モーダル、成功メッセージ等）
- トップページからもログイン可能にする — ヘッダーのログインボタンはプランナーページのみ？トップにも配置
- メール+パスワードログインも将来的に検討？

## 完了
- [x] Google ログイン
- [x] Discord ログイン（2026-03-23 解決: firebase-admin v13 モジュラーimport）
- [x] Service Worker の /api/ 除外
- [x] ログインメニュー ホバー→クリック型に変更
- [x] デバッグ用 alert 全削除
- [x] Discord/Twitter 共通 OAuth ポップアップヘルパー統合
- [x] Vercel環境変数にTwitterキー追加

## 技術メモ
- Vercel無料プラン: 月10万関数実行 / Firebase無料: 月5万アクティブユーザーまでOK
- Twitter OAuth 1.0a（Firebase直接）は X無料プランで非対応 → OAuth 2.0 + Vercel API方式
- firebase-admin v13 は `import * as admin` ではなく `firebase-admin/app` + `firebase-admin/auth` を使う
- .env.local に全シークレット保管済み
