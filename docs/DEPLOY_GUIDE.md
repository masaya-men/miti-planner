# LoPo デプロイ・更新ガイド（非エンジニア向け）

このドキュメントは、AIの力を借りられなくなった場合に備えた手順書です。

---

## 全体の流れ

```
コードを変更 → コミット → プッシュ → 自動でデプロイ＆Discord通知
```

- **デプロイ（公開）**: Vercelが自動でやってくれる。プッシュするだけ。
- **Discord通知**: GitHub Actionsが自動でやってくれる。feat:/fix:のコミットだけ通知される。

---

## 1. 変更をコミットする

VSCodeのターミナル（Ctrl+`）で以下を入力：

```bash
# 変更したファイルを確認
git status

# 全ファイルをステージング（コミット対象にする）
git add -A

# コミット（変更の記録を作る）
git commit -m "fix: ここに変更内容を日本語で書く"
```

### コミットメッセージのルール

メッセージの先頭に種類をつける：

| 先頭 | 意味 | Discord通知 |
|------|------|------------|
| `feat:` | 新機能を追加した | ✅ 通知される |
| `fix:` | バグを修正した | ✅ 通知される |
| `chore:` | 裏方の整理（ユーザーに見えない） | ❌ 通知されない |
| `docs:` | ドキュメントだけ変更した | ❌ 通知されない |

例：
```bash
git commit -m "feat: 新しいボスのテンプレートを追加"
git commit -m "fix: スマホでボタンが押せない問題を修正"
git commit -m "chore: 不要ファイルを削除"
```

---

## 2. プッシュする（公開する）

```bash
git push
```

これだけで：
1. **Vercel** がコードを受け取って、数分で https://lopoly.app/ に反映される
2. **GitHub Actions** がコミットメッセージを見て、feat:/fix: なら Discord に通知を送る

---

## 3. うまくいかないとき

### 「git pushできない」
```bash
# まずpullしてから再度push
git pull --rebase
git push
```

### 「変更を全部取り消したい」
```bash
# 直前のコミットを取り消す（変更はファイルに残る）
git reset --soft HEAD~1
```

### 「デプロイが失敗した」
- https://vercel.com/dashboard を開いて、Deploymentsタブでエラーを確認
- 大抵はコードのエラー。修正してもう一度プッシュすればOK

### 「Discord通知が来ない」
- コミットメッセージが `feat:` か `fix:` で始まっているか確認
- https://github.com/masaya-men/miti-planner/actions を開いてワークフローの実行結果を確認

---

## 重要なURL一覧

| サービス | URL | 用途 |
|---------|-----|------|
| LoPo本番 | https://lopoly.app/ | 公開中のアプリ |
| Vercel | https://vercel.com/dashboard | デプロイ状況の確認 |
| GitHub | https://github.com/masaya-men/miti-planner | ソースコード管理 |
| GitHub Actions | https://github.com/masaya-men/miti-planner/actions | 自動処理の実行状況 |
| Firebase Console | https://console.firebase.google.com/ | データベース・認証管理 |

---

## 環境の準備（別のPCで作業する場合）

```bash
# リポジトリをダウンロード
git clone https://github.com/masaya-men/miti-planner.git
cd miti-planner

# パッケージをインストール
npm install

# ローカルで動かす（確認用）
npm run dev
# → ブラウザで localhost:5173 を開く

# 本番用にビルド（エラーチェック）
npm run build
```

`.env.local` ファイルはGitHubにはないので、バックアップから復元する必要があります。
