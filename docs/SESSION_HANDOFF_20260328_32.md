# セッション引き継ぎ書（2026-03-28 第32セッション）

> **このファイルは、メモリやコンテキストが完全にリセットされた場合でも、次のセッションが完璧に開始できるよう詳細に記述されている。**

---

## ★ セッション開始時の必須作業（最重要 — 絶対にスキップしない）

**CLAUDE.md に全ルールが書かれている。必ず最初に読むこと。**

### 毎回必ず読むファイル（タスクに着手する前に全て読み終えること）
1. `docs/TODO.md` — タスク管理・進捗・設計方針（最重要）
2. `docs/TECH_NOTES.md` — 技術的な落とし穴と解決策
3. **`docs/管理基盤設計書.md`** — Phase 0-3完了済み、Phase 4以降はこれに従って実装する
4. 最新の `docs/SESSION_HANDOFF_*.md` — このファイル

### ⚠️ 過去の失敗パターン（繰り返さないこと）
- **設計書を読まずにバグ修正に飛びつく**
- **Skillを使わずに実装を始める**

---

## プロジェクト概要

- **サービス名**: LoPo（ロポ）— FF14軽減プランナー
- **本番URL**: https://lopoly.app/
- **管理画面**: https://lopoly.app/admin
- **技術スタック**: React 19 + TypeScript + Vite 7 + Tailwind CSS v4 + Zustand + Firebase + Vercel
- **Discord**: https://discord.gg/V288kfPFMG
- **Ko-fi**: https://ko-fi.com/lopoly

---

## 管理基盤設計書の進捗（Phase 0〜5）

```
Phase 0: 安全基盤                    ██████████ 100% ✅ 完了
Phase 1: コンテンツ・テンプレート      ██████████ 100% ✅ 完了
Phase 2: 自動テンプレート・昇格        ██████████ 100% ✅ 完了
Phase 3: スキル・ステータスFirestore化  ██████████ 100% ✅ コード完了（第32セッション）
  → シードスクリプト実行 + デプロイ + 動作確認が残っている
Phase 4: アイコン・共有データ          ░░░░░░░░░░   0% ← Phase 3確認後
Phase 5: ハウジング管理機能の準備      ░░░░░░░░░░   0%
```

---

## 今回のセッション（第32セッション）で完了したこと

### Phase 3: スキル・ステータスのFirestore化（全12タスク完了）

**新規ファイル:**
| ファイル | 内容 |
|---------|------|
| `src/hooks/useSkillsData.ts` | スキル・ステータスデータへのアクセスフック（Reactフック + 非Reactゲッター） |
| `src/components/admin/AdminSkills.tsx` | スキル管理画面（ジョブ→スキル編集） |
| `src/components/admin/AdminStats.tsx` | ステータス管理画面（レベル補正 + パッチ別ステータス） |
| `scripts/seed-skills-stats.ts` | Firestoreシードスクリプト（`npx tsx` で実行） |
| `docs/superpowers/plans/2026-03-28-phase3-skills-stats-firestore.md` | Phase 3実装計画書 |

**修正ファイル（主要なもの）:**
| ファイル | 変更内容 |
|---------|---------|
| `src/types/index.ts` | `LevelModifier`, `TemplateStats` 型を追加 |
| `src/store/useMasterDataStore.ts` | `MasterSkills`, `MasterStats` 型 + ストアに skills/stats フィールド追加 |
| `src/hooks/useMasterData.ts` | skills/stats のフェッチ + 静的フォールバック追加 |
| `src/store/useMitigationStore.ts` | 静的import → `getXxxFromStore()` に全置換 |
| `src/utils/calculator.ts` | `LEVEL_MODIFIERS` → ストア経由 |
| `src/utils/autoPlanner.ts` | `MITIGATIONS` → ストア経由 |
| `api/admin/templates/index.ts` | `?type=skills` / `?type=stats` CRUD追加 |
| `src/components/admin/AdminLayout.tsx` | スキル・ステータスナビ追加 |
| `src/App.tsx` | `/admin/skills`, `/admin/stats` ルート追加 |
| `src/locales/ja.json`, `en.json` | admin.skills, admin.stats キー追加 |

**消費元移行（15ファイル）:**
Timeline, TimelineRow, MitigationSelector, EventModal, PartySettingsModal, JobPicker, Layout, PopularPage, CheatSheetView, ClearMitigationsPopover, PartyStatusPopover, resourceTracker, jobMigration, useTutorialStore, debug_calc

**アーキテクチャ:**
```
起動時: useMasterDataInit()
  → Firestore /master/config (1 read)
  → バージョン一致: localStorageキャッシュ使用 (0 reads)
  → バージョン不一致: /master/contents + /master/skills + /master/stats を並列取得 (3 reads)
  → キャッシュ保存 → ストアに setData()

操作時: 全コンポーネント・ユーティリティ
  → useSkillsData.ts 経由でストアから取得（Firestoreアクセス0回）
  → ストア未初期化時は静的ファイルにフォールバック

管理画面:
  → GET /api/admin/templates?type=skills → master/skills 取得
  → PUT /api/admin/templates (type=skills) → バックアップ + 更新 + dataVersion++
  → GET /api/admin/templates?type=stats → master/stats 取得
  → PUT /api/admin/templates (type=stats) → バックアップ + 更新 + dataVersion++
```

---

## ★ 次回の最優先タスク

### 1. Phase 3 デプロイ作業（最優先）

**順番:**
1. **シードスクリプト実行**: `npx tsx scripts/seed-skills-stats.ts`
   - .env.local にFirebase認証情報が必要
   - Firestore に `/master/skills` と `/master/stats` が作成される
   - dataVersion がインクリメントされる
2. **デプロイ**: Vercelに自動デプロイ or `vercel --prod`
3. **動作確認チェックリスト**:
   - [ ] アプリ起動時にコンソールエラーなし
   - [ ] タイムライン正常表示
   - [ ] ジョブ選択で全ジョブ表示
   - [ ] 軽減スキル選択が動作
   - [ ] レベル変更でステータス切替
   - [ ] オートプラン動作
   - [ ] FFLogsインポート動作
   - [ ] `/admin/skills` でスキル一覧表示
   - [ ] `/admin/stats` でステータス一覧表示
   - [ ] 管理画面でスキル編集→保存成功
   - [ ] 保存後リロードで変更反映

### 2. Phase 4: アイコン・共有データ（Phase 3確認後）
### 3. バグ修正残り（後回しOK）
### 4. デザイン改善 + アクセントカラー（管理基盤完了後）
### 5. パフォーマンス最適化（最後）

---

## 管理者ログイン情報
- ADMIN_SECRET: Vercel環境変数に設定済み
- 管理者UID: `（旧管理者UID）`（Googleログイン）
- 管理画面URL: https://lopoly.app/admin
- reCAPTCHAキーID: `6LcHepssAAAAAF1yKkvARnm7Gpx3_bxbyN9iLTnV`
- Discord Webhook: Vercel環境変数 `DISCORD_ADMIN_WEBHOOK_URL` に設定済み

## 既知のコンソールエラー（未対応・既存）
- `<button> cannot be a descendant of <button>` — サイドバーのContentTreeItem内
- `<path> attribute d: Expected number` — SVGパスにcalc()や%が入っている箇所
- `THREE.Clock非推奨警告` — THREE.Timerに移行が必要（動作には影響なし）

## Vercel関数制限
- Hobby プラン: **12関数が上限**（現在12/12）
- 新規APIファイル追加不可。既存エンドポイントに統合する方式
- Phase 3 では `api/admin/templates/index.ts` に `?type=skills` / `?type=stats` を統合済み
