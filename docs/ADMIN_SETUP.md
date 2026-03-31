# 管理者セットアップ & 技術メモ

> 管理系の作業時のみ参照。毎セッション読む必要はない。

---

## 管理者ログイン手順（初回セットアップ）

### 準備
1. **Vercelに環境変数`ADMIN_SECRET`を追加**
   - Vercelダッシュボード → Settings → Environment Variables
   - 名前: `ADMIN_SECRET`
   - 値: 長いランダム文字列（例: 32文字以上の英数字）
   - 対象: Production, Preview, Development すべてにチェック
   - 追加後、再デプロイが必要（Settings → Deployments → 最新を Redeploy）

2. **自分のFirebase UIDを確認**
   - Firebase Console → Authentication → Users → 自分のメールアドレスの行のUID列をコピー

### 管理者ロール設定
3. **ターミナルから以下のコマンドを実行**（UIDとsecretを自分のものに置き換える）
```bash
curl -X POST "https://lopoly.app/api/admin?resource=role" \
  -H "Content-Type: application/json" \
  -d '{"uid":"ここにFirebase UID","role":"admin","secret":"ここにADMIN_SECRET"}'
```
   - 成功: `{"success":true,"uid":"...","role":"admin"}`
   - 失敗: `{"error":"Unauthorized"}` → secretが間違っている

4. **ブラウザでログインし直す**（Custom Claimsの反映にはトークン更新が必要）
   - ログアウト → 再ログイン
   - または: 1時間待つ（トークンの自動更新）

5. **管理画面にアクセス**
   - https://lopoly.app/admin にアクセス → ダッシュボードが表示されれば成功

### トラブルシューティング
- `/admin`にアクセスしてもトップページにリダイレクトされる → ログアウト→再ログインを試す
- curlで403が返る → `ADMIN_SECRET`の値がVercelの環境変数と一致しているか確認
- curlで500が返る → Vercelのログ（Functions タブ）でエラー内容を確認

---

## 技術メモ
- Vercel無料プラン: 月10万関数実行 / Firebase無料: 月5万アクティブユーザーまでOK
- Twitter OAuth 2.0 + Vercel API方式
- firebase-admin v13 は モジュラーimport
- .env.local に全シークレット保管済み
- 本番URL: https://lopoly.app/
- Discord: https://discord.gg/z7uypbJSnN
- Ko-fi: https://ko-fi.com/lopoly
- **backdrop-filterは直書き禁止** → docs/TECH_NOTES.md参照
- **conic-gradientの回転要素は200vmax正方形にすること** → docs/TECH_NOTES.md参照
