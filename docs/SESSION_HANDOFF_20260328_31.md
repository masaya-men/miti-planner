# セッション引き継ぎ書（2026-03-28 第31セッション）

> **このファイルは、メモリやコンテキストが完全にリセットされた場合でも、次のセッションが完璧に開始できるよう詳細に記述されている。**

---

## ★ セッション開始時の必須作業（最重要 — 絶対にスキップしない）

**CLAUDE.md に全ルールが書かれている。必ず最初に読むこと。**

### 毎回必ず読むファイル（タスクに着手する前に全て読み終えること）
1. `docs/TODO.md` — タスク管理・進捗・設計方針（最重要）
2. `docs/TECH_NOTES.md` — 技術的な落とし穴と解決策
3. **`docs/管理基盤設計書.md`** — **Phase 0-2完了済み、Phase 3以降はこれに従って実装する。必ず読む。過去に何度も読み忘れが発生している。**
4. 最新の `docs/SESSION_HANDOFF_*.md` — このファイル

### ⚠️ 過去の失敗パターン（繰り返さないこと）
- **設計書を読まずにバグ修正に飛びつく** — 「実行可能なタスクを見つけた瞬間にコンテキスト構築をスキップする」バイアスがある。管理基盤設計書は毎セッション読むべき重要文書。
- **Skillを使わずに実装を始める** — CLAUDE.mdに明記: brainstorming → writing-plans → 実装の流れ。既に設計書がある場合は writing-plans から開始OK。

### 必ずSkillを使う場面
- **新機能の実装** → `brainstorming` → `writing-plans` → `subagent-driven-development`
- **バグ修正** → `systematic-debugging`
- **コードレビュー** → `requesting-code-review`
- **既に設計書がある場合** → `writing-plans` から開始OK

---

## プロジェクト概要（メモリ消失時のため）

- **サービス名**: LoPo（ロポ）— FF14軽減プランナー
- **本番URL**: https://lopoly.app/
- **管理画面**: https://lopoly.app/admin
- **技術スタック**: React 19 + TypeScript + Vite 7 + Tailwind CSS v4 + Zustand + Firebase + Vercel
- **Discord**: https://discord.gg/V288kfPFMG
- **Ko-fi**: https://ko-fi.com/lopoly

### ユーザーについて
- **非エンジニア**。説明は平易に。技術的な確認は不要で、意図の深掘りだけする
- 許可不要でどんどん進めてOK。ただし**デザイン変更は必ず相談→承認→実装**の流れ
- 常に**日本語**で会話する。コメント・ドキュメントも日本語
- 長い会話は固まるので切りの良いところで区切る
- **実装前に必ずskillを使う**（brainstorming→writing-plans→実装）

---

## 管理基盤設計書の進捗（Phase 0〜5）

```
Phase 0: 安全基盤                    ██████████ 100% ✅ 完了
  管理者ロール、管理画面骨組み、App Check、
  レート制限、監査ログ、プラン複製

Phase 1: コンテンツ・テンプレート      ██████████ 100% ✅ 完了
  Firestoreコレクション、シード、キャッシュ、
  contentRegistry書き換え、管理画面UI

Phase 2: 自動テンプレート・昇格        ██████████ 100% ✅ 完了（第31セッション）
  FFLogs→テンプレート自動登録、品質チェック、
  発見/安定フェーズ、copyCount重複排除、
  人気プラン昇格、Discord通知、管理画面UI

Phase 3: スキル・ステータスFirestore化  ░░░░░░░░░░   0% ← 次はここ
  ジョブ・スキル・ステータスをFirestoreに移行
  → 新ジョブ追加・スキル変更がブラウザから可能に
  → 影響ファイル17件（mockData.ts消費元11件+stats消費元6件）

Phase 4: アイコン・共有データ          ░░░░░░░░░░   0%
  Firebase Storage、アイコン移行、DC/サーバー管理

Phase 5: ハウジング管理機能の準備      ░░░░░░░░░░   0%
  モデレーション基盤、通報管理
```

---

## 今回のセッション（第31セッション）で完了したこと

### Phase 2: 自動テンプレート + 人気プラン昇格（全10タスク完了）

**新規ファイル:**
| ファイル | 内容 |
|---------|------|
| `src/lib/discordWebhook.ts` | Discord Webhook送信ヘルパー |
| `api/template/auto-register/index.ts` | テンプレート自動登録API（品質チェック+発見フェーズ14日） |
| `api/template/promote/index.ts` | 人気プラン昇格承認API |
| `src/components/admin/AdminConfig.tsx` | 閾値設定UI |
| `docs/superpowers/plans/2026-03-28-phase2-auto-template-promotion.md` | Phase 2実装計画書 |

**修正ファイル:**
| ファイル | 変更内容 |
|---------|---------|
| `src/components/FFLogsImportModal.tsx` | インポート成功時にバックグラウンドで自動登録呼び出し |
| `api/popular/index.ts` | copyCount重複排除（copiedByサブコレクション）+ 昇格候補チェック + Discord通知 |
| `api/admin/templates/index.ts` | テンプレートロック/アンロック操作 + config管理統合 |
| `api/admin/set-role.ts` | admin/verify機能を統合 |
| `src/components/admin/AdminTemplates.tsx` | ロック/昇格候補UI追加 |
| `src/components/admin/AdminLayout.tsx` | 設定タブ追加 |
| `src/App.tsx` | `/admin/config` ルート追加 |
| `src/components/PopularPage.tsx` | `CONTENT_DEFINITIONS` → `getContentDefinitions()` |
| `src/data/contentRegistry.ts` | `getContentDefinitions()` をexport |
| `firestore.rules` | copiedByサブコレクションルール追加（デプロイ済み） |

### バグ修正（一部未完了）
| バグ | 状態 |
|-----|------|
| 星マーク（ライトモード） | ✅ 修正済み（SELECTテキストは別バグ） |
| AA設定アイコン（ライトモード） | ⚠️ 一部修正済みだが直りきっていない |
| パルススライダーはみ出し | ⚠️ calcクランプ修正済みだが直りきっていない |
| `text-app-text-secondary` → `text-app-text-sec` | ✅ 8ファイル20箇所修正済み |

### Vercel Hobby 12関数制限への対応
- `api/webhook/discord/` → `src/lib/discordWebhook.ts` に移動（ヘルパーであってAPIではない）
- `api/admin/config/` → `api/admin/templates/` に統合（`?type=config`）
- `api/admin/verify.ts` → `api/admin/set-role.ts` に統合（GETハンドラー追加）

### 環境変数追加
- `DISCORD_ADMIN_WEBHOOK_URL` — Vercel（Production + Development）+ `.env.local`

---

## ★ 次回の最優先タスク

確定方針「**視覚的な変更を全部終えてから最後にパフォーマンス最適化**」に従い:

1. **管理基盤Phase 3: スキル・ステータスのFirestore化**（最重要）
   - Phase 0-2が完了した今、流れを止めずにPhase 3に進む
   - 新ジョブ追加・スキル効果変更がブラウザから可能になる（公開前に必須）
   - 影響ファイル17件（mockData.ts消費元11件 + stats消費元6件）
   - 設計書 → `docs/管理基盤設計書.md` セクション11 Phase 3
   - **Skillを使う**: `writing-plans` → `subagent-driven-development`
2. **管理基盤Phase 4: アイコン・共有データ**（Phase 3完了後）
   - Firebase Storage、アイコン移行、DC/サーバー管理
3. **バグ修正（後回しでOK — 動作には影響なし）**
   - AA設定アイコン: まだライトモードで見えない部分がある
   - パルススライダー: まだはみ出している
   - パーティ編成のSELECTテキスト: ライトモードで真っ白
4. **モーダル・画面のデザイン改善 + アクセントカラー**（管理基盤完了後）
5. **パフォーマンス最適化**（全ての視覚変更後）

---

## 既知のコンソールエラー（未対応・既存）
- `<button> cannot be a descendant of <button>` — サイドバーのContentTreeItem内
- `<path> attribute d: Expected number` — SVGパスにcalc()や%が入っている箇所
- `THREE.Clock非推奨警告` — THREE.Timerに移行が必要（動作には影響なし）

---

## 管理者ログイン情報
- ADMIN_SECRET: Vercel環境変数に設定済み
- 管理者UID: `（旧管理者UID）`（Googleログイン）
- 管理画面URL: https://lopoly.app/admin
- reCAPTCHAキーID: `6LcHepssAAAAAF1yKkvARnm7Gpx3_bxbyN9iLTnV`
- Discord Webhook: Vercel環境変数 `DISCORD_ADMIN_WEBHOOK_URL` に設定済み
