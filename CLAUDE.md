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

## ルール（自動適用）
CSS・UIデザイン・i18nのルールは `.claude/rules/` に定義済み。
該当ファイルを編集すると自動的にロードされる。

When compacting, always preserve: 現在のタスク、変更中のファイルパス、docs/TODO.mdの「現在の状態」内容。
