# CLAUDE.md

## 言語
常に日本語で会話・コメント・ドキュメント生成する。

## セッション開始時
`docs/TODO.md` を読む。他のドキュメントは該当タスクに着手するときに読む。
詳細なワークフローは `.claude/rules/session-workflow.md` を参照。

## 会話中の記録
アイデア・方針・設計判断は即座に `docs/TODO.md` に追記する。指示されなくても自動的にやること。

## スキル（skill）の使用
- 新機能 → `brainstorming` → `writing-plans` → `subagent-driven-development`
- バグ修正 → `systematic-debugging`
- コードレビュー → `requesting-code-review`
- 設計書がある場合 → `writing-plans` から開始
- 迷ったら使う。スキップしない。

## 重要ドキュメント（該当タスク着手時に読む）
- `docs/DESIGN_DECISIONS.md` — 確定済み設計方針
- `docs/ADMIN_SETUP.md` — 管理者手順・技術メモ
- `docs/管理基盤設計書.md` — Firestore移行設計
- `docs/GRAPL_PROJECT_PLAN.md` — 全体ロードマップ
- 他の設計書は `docs/` 内を検索

## セキュリティ（パブリックリポジトリ — 違反厳禁）
このリポジトリは公開されている。以下を絶対に守ること。

### コミット禁止
- APIキー、トークン、シークレット、Webhook URL、秘密鍵の実値
- Firebase UID、Discord UID 等の管理者識別子
- メールアドレス、電話番号、その他個人情報
- `.env*` ファイル（.gitignoreで除外済みだが二重確認）

### 安全な参照方法
- 環境変数名のみ記載OK（例: `process.env.DISCORD_CLIENT_SECRET`）
- プレースホルダー使用OK（例: `WEBHOOK_URL=（Discord Webhook URL）`）
- 実値が必要な場合は `.env.local` または `ADMIN_REFERENCE.md`（gitignore済み）に記載

### 新規ファイル・ドキュメント作成時
- 設計書・計画書にシークレットの実値を書かない
- コード例には必ず環境変数参照またはプレースホルダーを使う
- コミット前に `git diff --cached` でシークレット混入がないか確認

## ルール（自動適用）
CSS・UIデザイン・i18nのルールは `.claude/rules/` に定義済み。
該当ファイルを編集すると自動的にロードされる。

When compacting, always preserve: 現在のタスク、変更中のファイルパス、docs/TODO.mdの「現在の状態」内容。
