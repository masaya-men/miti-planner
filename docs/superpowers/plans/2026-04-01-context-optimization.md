# コンテキスト最適化 — 恒久的トークン削減計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** セッション開始時のトークン消費を~17,000から~2,500に削減し、今後も自動的に低く保つ仕組みを構築する

**Architecture:** TODO.mdを3分割（タスク/設計方針/管理手順）、TECH_NOTESとCLAUDE.mdのルールを`.claude/rules/`に条件付きロード化、Hooksで自動コンテキスト注入、メモリの大掃除

**Tech Stack:** Claude Code settings.json, .claude/rules/, .claudeignore, Hooks (SessionStart/PreCompact)

---

## ファイル構成（変更前 → 変更後）

### 新規作成
| ファイル | 責務 |
|---|---|
| `.claude/rules/css-rules.md` | backdrop-filter/conic-gradient のCSS禁止事項（`paths: **/*.css, **/*.tsx`） |
| `.claude/rules/ui-design.md` | UIデザイン禁止リスト + 色ルール（`paths: src/components/**`） |
| `.claude/rules/i18n.md` | 多言語対応ルール（`paths: src/**/*.{ts,tsx}`） |
| `.claude/rules/session-workflow.md` | セッション開始/終了の手順（pathsなし = 常時ロード） |
| `docs/DESIGN_DECISIONS.md` | TODO.mdから分離した確定済み設計方針 |
| `docs/ADMIN_SETUP.md` | TODO.mdから分離した管理者手順書 |
| `.claudeignore` | ファイル探索の除外設定 |

### 変更
| ファイル | 変更内容 |
|---|---|
| `CLAUDE.md` | 83行 → ~35行に圧縮。ルールをrules/に移動、ドキュメントリストを削除 |
| `docs/TODO.md` | 390行 → ~50行。設計方針/手順/完了タスクを分離、先頭に「現在の状態」追加 |
| `.claude/settings.local.json` | Hooks追加 + AUTOCOMPACT設定 |

### 削除
| ファイル | 理由 |
|---|---|
| `docs/TECH_NOTES.md` | `.claude/rules/css-rules.md` に統合 |
| `docs/SESSION_HANDOFF_20260401_65.md` | TODO.md先頭に統合、引き継ぎ書という仕組み自体を廃止 |
| メモリ14ファイル | 重複・陳腐化（詳細はTask 7） |

---

### Task 1: .claudeignore を作成

**Files:**
- Create: `.claudeignore`

- [ ] **Step 1: .claudeignore を作成**

```
node_modules/
dist/
.next/
*.lock
*.log
.vercel/
.claude/worktrees/
docs/superpowers/plans/
docs/superpowers/specs/
docs/TODO_COMPLETED.md
```

計画書・仕様書・完了済みタスクはClaudeが自発的に探索する必要がない（必要時にパスを指定して読めばよい）。

- [ ] **Step 2: コミット**

```bash
git add .claudeignore
git commit -m "chore: .claudeignore を追加してファイル探索のトークン浪費を防止"
```

---

### Task 2: .claude/rules/ にパス限定ルールを作成

**Files:**
- Create: `.claude/rules/css-rules.md`
- Create: `.claude/rules/ui-design.md`
- Create: `.claude/rules/i18n.md`
- Create: `.claude/rules/session-workflow.md`

- [ ] **Step 1: css-rules.md を作成**

```markdown
---
paths:
  - "**/*.css"
  - "src/**/*.tsx"
---

# CSSルール

## backdrop-filter 禁止
`backdrop-filter: blur(...)` を直接書くな。Tailwind v4のLightning CSSがビルド時に削除する。
必ず `--tw-backdrop-blur` 変数パターンを使うこと。

```css
/* NG */
backdrop-filter: blur(12px);

/* OK */
--tw-backdrop-blur: blur(12px);
-webkit-backdrop-filter: var(--tw-backdrop-blur,) var(--tw-backdrop-brightness,) var(--tw-backdrop-contrast,) var(--tw-backdrop-grayscale,) var(--tw-backdrop-hue-rotate,) var(--tw-backdrop-invert,) var(--tw-backdrop-opacity,) var(--tw-backdrop-saturate,) var(--tw-backdrop-sepia,);
backdrop-filter: var(--tw-backdrop-blur,) var(--tw-backdrop-brightness,) var(--tw-backdrop-contrast,) var(--tw-backdrop-grayscale,) var(--tw-backdrop-hue-rotate,) var(--tw-backdrop-invert,) var(--tw-backdrop-opacity,) var(--tw-backdrop-saturate,) var(--tw-backdrop-sepia,);
```

## conic-gradient 回転要素
`::before` のサイズは `%` ではなく `200vmax` で正方形にすること。`%` は親要素の縦横比で歪む。

## clip-path: path() 禁止
ブラウザ互換性が低い。SVG evenodd方式を使う。
```

- [ ] **Step 2: ui-design.md を作成**

```markdown
---
paths:
  - "src/components/**"
  - "src/index.css"
---

# UIデザインルール

## 色のルール
全UI要素に白と黒のみ使用。既存テーマ変数（app-text, app-bg等）の白黒はOK。
例外: 警告系→黄色、削除・危険系→赤、OK・先に進む系→青（第42セッション確定）

## AIっぽいデザイン禁止
- AIグラデーション禁止（青→紫）
- Interフォント禁止
- Lucideアイコンのみの使用禁止（他も検討）
- shadcnデフォルトそのまま禁止（カスタマイズして使う）

## マウス追従UI禁止
onMouseMoveの高頻度イベント + state更新のパフォーマンスコストが大きい。固定位置UIで代替する。

## デザイン変更の承認フロー
UIの見た目に影響する変更は、勝手に適用せず必ずユーザーに確認してから。
(1) 現状確認 → (2) 変更案のプレビュー/説明 → (3) ユーザー承認 → (4) 実装
```

- [ ] **Step 3: i18n.md を作成**

```markdown
---
paths:
  - "src/**/*.ts"
  - "src/**/*.tsx"
  - "src/locales/**"
---

# 多言語対応ルール

UIテキストは必ず i18n キー経由で表示すること。ハードコーディング禁止。
英語モードで表示が崩れないか常に確認すること。
```

- [ ] **Step 4: session-workflow.md を作成（pathsなし = 常時ロード）**

```markdown
# セッションワークフロー

## 開始時
1. `docs/TODO.md` を読む — これだけで現在の状態・タスク・注意事項がわかる
2. 他のドキュメントは該当タスクに着手するときに読む

## 作業中
- 会話で決まったアイデア・方針・設計判断は即座に `docs/TODO.md` に追記する
- 完了タスクは `docs/TODO_COMPLETED.md` に移動（本当に完了しているかコードで確認してから）
- TODO.mdは常に50行以内を目標に保つ

## 終了時
1. TODO.md先頭の「現在の状態」セクションを更新
2. コミット → push → デプロイまでセットで完了
3. ユーザーに引き継ぎメッセージを出力（次セッションの最初にコピペできる形式）
   - 変更したファイル一覧、次の最優先タスク、docs/TODO.md読め指示

## コンパクション時の保持指示
When compacting, always preserve: 現在のタスク、変更中のファイルパス、TODO.mdの「現在の状態」セクション内容
```

- [ ] **Step 5: コミット**

```bash
git add .claude/rules/
git commit -m "chore: .claude/rules/ にパス限定ルールを作成（条件付きロード化）"
```

---

### Task 3: TECH_NOTES.md を廃止

**Files:**
- Delete: `docs/TECH_NOTES.md`

- [ ] **Step 1: TECH_NOTES.md を削除**

内容は Task 2 の `css-rules.md` に統合済み。

```bash
git rm docs/TECH_NOTES.md
```

- [ ] **Step 2: コミット**

```bash
git commit -m "chore: TECH_NOTES.md を廃止（.claude/rules/css-rules.md に統合）"
```

---

### Task 4: TODO.md を3分割

**Files:**
- Create: `docs/DESIGN_DECISIONS.md`
- Create: `docs/ADMIN_SETUP.md`
- Modify: `docs/TODO.md` (390行 → ~50行)

- [ ] **Step 1: DESIGN_DECISIONS.md を作成**

TODO.mdの以下のセクションを移動:
- 「確定した設計方針（2026-03-28 第27セッション追記）」〜「確定した設計方針（2026-03-24）」（218行目〜339行目）
- 「βテスト前の優先順位」（41行目〜46行目）
- 「フッター統一ルール」（211行目〜216行目）
- 「マネタイズ方針」（187行目〜191行目）
- 「ログイン/保存/共有の仕様」（181行目〜185行目）

ファイル先頭に以下のヘッダーを付ける:
```markdown
# 確定した設計方針

> このファイルは実装済みの設計方針を記録している。新しい機能に着手するときに該当セクションを参照すること。
> 毎セッション読む必要はない。

---
```

- [ ] **Step 2: ADMIN_SETUP.md を作成**

TODO.mdの以下のセクションを移動:
- 「管理者ログイン手順（初回セットアップ）」（346行目〜379行目）
- 「技術メモ」（381行目〜390行目）

ファイル先頭に以下のヘッダーを付ける:
```markdown
# 管理者セットアップ & 技術メモ

> 管理系の作業時のみ参照。毎セッション読む必要はない。

---
```

- [ ] **Step 3: TODO.md を圧縮・再構成**

新しいTODO.mdの構造:

```markdown
# LoPo 開発ToDo

> 完了済みタスクは [TODO_COMPLETED.md](./TODO_COMPLETED.md) に移動済み
> 確定した設計方針は [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md) を参照
> 管理者手順は [ADMIN_SETUP.md](./ADMIN_SETUP.md) を参照

---

## 現在の状態（次セッションはここから読む）

- **ブランチ**: `feature/tutorial-overhaul`（mainにはまだマージしていない）
- **最優先**: PartyAutoFill.tsx の自動埋めアニメーション修正
- **次**: PillFly.tsx のピル飛行演出ブラッシュアップ
- **その後**: feature/tutorial-overhaul を main にマージ → デプロイ
- **注意**: ENFORCE_APP_CHECK=true が本番有効、管理者UID: （.env.local参照）、Vercel関数7/12

---

## バグ
（現在のバグセクションをそのまま維持 — 4行）

## 進行中
（チュートリアル刷新の残り問題のみ — 簡潔に）

## 未着手（次にやること）
- Stripe/Ko-fi フッター法的リンクまとめ
- shared_plansクリーンアップ
- CSP unsafe-inline除去（β後）
- テスト基盤（planService.ts等）
- エラー監視（Sentry or Discord Webhook）

## 未着手（将来）
（現在の「未着手（機能・将来）」を簡潔に — 1行1項目、説明なし）

## アイデア・やりたいこと
（現在のアイデアセクションを簡潔に — 1行1項目、説明なし。詳細が必要なら別ファイルへのリンク）

## セキュリティ残課題
（未完了の4件のみ — 各1行）

## 運用・品質基盤
（未完了のみ — 各1行）
```

ポイント:
- 各項目は1行。説明は削除するか、どうしても必要なら2行目にインデントで追記
- 完了済み（✅マーク）は全てTODO_COMPLETED.mdに移動
- 「βテスト前の優先順位」等の完了項目混在セクションは整理

- [ ] **Step 4: コミット**

```bash
git add docs/TODO.md docs/DESIGN_DECISIONS.md docs/ADMIN_SETUP.md
git commit -m "refactor: TODO.mdを3分割（設計方針・管理手順を分離、50行以内に圧縮）"
```

---

### Task 5: 引き継ぎ書を廃止

**Files:**
- Delete: `docs/SESSION_HANDOFF_20260401_65.md`

- [ ] **Step 1: 引き継ぎ書を削除**

TODO.md先頭の「現在の状態」セクションが引き継ぎ書の役割を果たすため、別ファイルは不要。

```bash
git rm docs/SESSION_HANDOFF_20260401_65.md
```

- [ ] **Step 2: コミット**

```bash
git commit -m "chore: 引き継ぎ書を廃止（TODO.md先頭の「現在の状態」に統合）"
```

---

### Task 6: CLAUDE.md を ~35行に圧縮

**Files:**
- Modify: `CLAUDE.md` (83行 → ~35行)

- [ ] **Step 1: CLAUDE.md を書き換え**

新しいCLAUDE.md:

```markdown
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
```

- [ ] **Step 2: コミット**

```bash
git add CLAUDE.md
git commit -m "refactor: CLAUDE.mdを35行に圧縮（ルールをrules/に分離、ドキュメントリスト簡素化）"
```

---

### Task 7: メモリファイル大掃除（22 → 8ファイル）

**Files:**
- Delete: 14 memory files
- Modify: `MEMORY.md`
- Merge: `feedback_approval.md` + `feedback_autonomous.md` → `feedback_autonomous.md`
- Merge: `feedback_deploy.md` + `feedback_deploy_on_handoff.md` → `feedback_deploy.md`

- [ ] **Step 1: 削除するファイル（コード/docsから導出可能）**

| ファイル | 削除理由 |
|---|---|
| `project_todo.md` | TODO.mdと完全重複。CLAUDE.mdにも「TODO.md読め」と書いてある |
| `project_user_flow.md` | DESIGN_DECISIONS.mdに移動済み |
| `project_plan_core_upgrade.md` | `docs/CORE_UPGRADE_PLAN.md` と完全重複（4.7KB） |
| `project_autoplanner_current.md` | コードから導出可能。古い分析 |
| `project_domain.md` | TODO.mdの技術メモ→ADMIN_SETUP.mdに記載済み |
| `project_discord.md` | 同上 |
| `project_service_name.md` | コード・UIから自明 |
| `project_template_generation.md` | コードから導出可能 |
| `feedback_language.md` | CLAUDE.mdに「常に日本語」と明記済み |
| `feedback_read_docs_first.md` | session-workflow.mdに統合済み |
| `feedback_use_skills.md` | CLAUDE.mdに「スキル使用」セクションとして統合済み |
| `feedback_todo_priority.md` | session-workflow.mdに統合済み |

- [ ] **Step 2: 統合するファイル**

**feedback_approval.md + feedback_autonomous.md → feedback_autonomous.md:**
```markdown
---
name: 自律的に進める
description: 技術的な確認不要・許可不要で自律的に進める。意図の深掘りだけする。
type: feedback
---

技術的な確認（コミット・プッシュ・デプロイ・設定変更）は許可不要で進める。

**Why:** ユーザーは非エンジニアなので技術的な判断を求められても困る。確認の往復で時間が無駄になる。
**How to apply:** ユーザーの意図に関わる選択（デザインの方向性、機能の優先順位）だけ確認。それ以外は自分で判断して実行。
```

**feedback_deploy.md + feedback_deploy_on_handoff.md → feedback_deploy.md:**
```markdown
---
name: デプロイは自発的に
description: 切りの良いタイミングで自発的にデプロイ。引き継ぎ時はcommit→push→デプロイまでセット。
type: feedback
---

作業の切りのいいタイミングで自発的にcommit & push。引き継ぎ時は必ずデプロイまで完了させる。

**Why:** ユーザーはデプロイを毎回指示したくない。コミットだけして終わると本番に反映されず混乱する。
**How to apply:** 機能実装やバグ修正がビルド通ったらpushまでやる。セッション終了時は必ずpush + Vercelデプロイ確認。
```

- [ ] **Step 3: 残すファイル一覧（8ファイル）**

| ファイル | 理由 |
|---|---|
| `MEMORY.md` | 索引（必須） |
| `user_profile.md` | ユーザー属性（非エンジニア） |
| `feedback_autonomous.md` | 統合版（許可不要 + 意図深掘り） |
| `feedback_collaboration.md` | 協働スタイル |
| `feedback_deploy.md` | 統合版（デプロイ + 引き継ぎ） |
| `feedback_design_approval.md` | デザイン承認フロー |
| `feedback_session_management.md` | セッション管理 |
| `feedback_no_mouse_tooltip.md` | マウス追従UI禁止 |

- [ ] **Step 4: MEMORY.md を更新**

```markdown
# Memory Index

- [user_profile.md](user_profile.md) — 非エンジニア。説明は平易に。
- [feedback_autonomous.md](feedback_autonomous.md) — 許可不要で自律的に進める。意図の深掘りだけする。
- [feedback_collaboration.md](feedback_collaboration.md) — 深掘り質問で一緒に進める。ハードコーディングしない。
- [feedback_deploy.md](feedback_deploy.md) — 頃合いを見てデプロイ。引き継ぎ時はpush+デプロイまでセット。
- [feedback_design_approval.md](feedback_design_approval.md) — デザイン変更は必ず相談→承認→実装。
- [feedback_session_management.md](feedback_session_management.md) — 長い会話は固まるので切りの良いところで区切る。
- [feedback_no_mouse_tooltip.md](feedback_no_mouse_tooltip.md) — マウス追従UIはパフォーマンス理由で不採用。
```

- [ ] **Step 5: ファイル削除・書き換えを実行**

削除:
```bash
rm feedback_approval.md feedback_deploy_on_handoff.md feedback_language.md feedback_read_docs_first.md feedback_use_skills.md feedback_todo_priority.md project_todo.md project_user_flow.md project_plan_core_upgrade.md project_autoplanner_current.md project_domain.md project_discord.md project_service_name.md project_template_generation.md
```

（メモリファイルはgit管理外なのでコミット不要）

---

### Task 8: Hooks を設定（SessionStart + PreCompact）

**Files:**
- Modify: `.claude/settings.local.json`

- [ ] **Step 1: settings.local.json を更新**

```json
{
  "permissions": {
    "allow": [
      "Bash(gh auth:*)",
      "Bash(npm run:*)",
      "Bash(node scripts/generate-templates.mjs --content m12s_p2)",
      "Bash(npm install:*)",
      "Bash(npx skills:*)",
      "Bash(npx tsc:*)"
    ]
  },
  "hooks": {
    "SessionStart": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "echo '=== Git Status ===' && git branch --show-current && git log --oneline -3 && echo '=== 未コミット変更 ===' && git status --short"
          }
        ]
      }
    ],
    "PreCompact": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "echo '=== 保持すべき情報 ===' && head -20 docs/TODO.md && echo '=== 変更中ファイル ===' && git diff --name-only"
          }
        ]
      }
    ]
  },
  "env": {
    "CLAUDE_AUTOCOMPACT_PCT_OVERRIDE": "75"
  }
}
```

- [ ] **Step 2: コミット**

```bash
git add .claude/settings.local.json
git commit -m "chore: SessionStart/PreCompact Hooks + AUTOCOMPACT 75% 設定を追加"
```

---

### Task 9: 全体検証

- [ ] **Step 1: トークン消費の確認**

新しいセッション開始時に自動ロードされるもの:
- `CLAUDE.md` (~35行, ~800トークン)
- `.claude/rules/session-workflow.md` (pathsなし, ~400トークン)
- `MEMORY.md` (~8行, ~200トークン)
- SessionStart Hook出力 (~100トークン)
- **合計: ~1,500トークン**（現在の~17,000から91%削減）

条件付きロード（該当ファイル操作時のみ）:
- `css-rules.md` — CSS/TSX編集時
- `ui-design.md` — コンポーネント編集時
- `i18n.md` — TS/TSX編集時

TODO.md読み込み時（セッション開始直後）:
- ~50行, ~800トークン（現在の~10,000から92%削減）

- [ ] **Step 2: CLAUDE.md、TODO.md、rules/ の整合性チェック**

以下を確認:
- CLAUDE.mdにあったルールがrules/に漏れなく移動されたか
- TODO.mdにあった設計方針がDESIGN_DECISIONS.mdに漏れなく移動されたか
- 引き継ぎ書の重要情報がTODO.md先頭に反映されたか

- [ ] **Step 3: 最終コミット**

```bash
git add -A
git commit -m "docs: コンテキスト最適化完了 — セッション開始トークン91%削減"
```
