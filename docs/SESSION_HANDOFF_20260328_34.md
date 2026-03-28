# セッション引き継ぎ書（2026-03-28 第34セッション）

> **このファイルは、メモリやコンテキストが完全にリセットされた場合でも、次のセッションが完璧に開始できるよう詳細に記述されている。**

---

## ★ セッション開始時の必須作業（最重要 — 絶対にスキップしない）

**CLAUDE.md に全ルールが書かれている。必ず最初に読むこと。**

### 毎回必ず読むファイル（タスクに着手する前に全て読み終えること）
1. `docs/TODO.md` — タスク管理・進捗・設計方針（最重要）
2. `docs/TECH_NOTES.md` — 技術的な落とし穴と解決策
3. `docs/管理基盤設計書.md` — Phase 0-4完了済み。Phase 5はハウジング用（未着手）
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

## 今回のセッション（第34セッション）で完了したこと

### 1. 管理者向け運営マニュアル
- `docs/ADMIN_OPERATIONS_MANUAL.md` を新規作成
- 管理画面の全ページの操作手順、Firebase Console操作、トラブルシューティング、定期メンテナンスチェックリスト
- 非エンジニアが迷わず運営できるレベルの文書

### 2. バグ修正（3件）

| バグ | ファイル | 修正内容 |
|------|---------|---------|
| AA設定のInfoアイコンがライトモードで見えない | `src/components/AASettingsPopover.tsx` | `text-app-text-muted` → `text-app-text-sec` |
| パルス設定のカラースライダーはみ出し | `src/components/PulseSettings.tsx` | `overflow-hidden` 追加 + `getValueFromX` でサム幅14px考慮 |
| パーティ編成のSELECTテキストが白背景に白文字 | `src/components/PartySettingsModal.tsx` | `text-white/40` → `text-app-text-muted` |

### 3. Discord通知刷新
- **GitHub Commit Webhook → 廃止**（ユーザーがDiscord側で削除済み）
- **管理画面でのデータ更新 → ユーザー向け#アップデートに自動通知**
  - コンテンツ追加時: 「🗺️ 新コンテンツ追加: M5S が追加されました」
  - スキル変更時: 差分検出で「📝 ホーリーシェルトロン — 軽減率 15%→18%」
  - ステータス更新時: 新パッチ追加のみ通知
- **Vercel環境変数 `DISCORD_UPDATE_WEBHOOK_URL` 追加済み**
- **修正ファイル**: `src/lib/discordWebhook.ts`, `api/admin/contents/index.ts`, `api/admin/templates/index.ts`

### 4. CSVエクスポート
- サイドバーのアクティブプラン横に `⋮` メニューを追加
- 「CSVダウンロード」で軽減表データをBOM付きUTF-8 CSVとしてダウンロード
- 内容: 時間, 技名, ダメージ, タイプ, 対象, 適用中の軽減（ジョブ名: スキル名）
- **新規ファイル**: `src/utils/csvExporter.ts`
- **修正ファイル**: `src/components/Sidebar.tsx`, `src/locales/ja.json`, `src/locales/en.json`

### 5. その他
- `ADMIN_REFERENCE.md`: FirebaseプランSpark→Blaze修正
- `docs/TODO.md`: 4つのアイデア追記（軽減配置アニメ、AA追加フロー刷新、Discord通知、CSVエクスポート）

---

## 公開までの進捗

```
全体: █████████████████░░░ 約80%完了
```

### 残りのタスク（優先順）
1. **軽減配置時のフィードバックアニメーション** — 配置時に効果範囲を一瞬アニメ表示、D&D中は効果終了イベントをツールチップ表示
2. **AA追加モードのフロー刷新** — フローティングバー（選択共有/削除UIパターン流用）で統合フロー。マウス追従ツールチップは不採用
3. **デザイン改善 + アクセントカラー** — モーダル・画面のライトモード修正含む
4. **パフォーマンス最適化** — React.memo / useMemo（全視覚変更後）
5. **public/icons/ 削除** — 2.1MB削減（最後に実施）

### 評価済みアイデアの要点（第34セッション議論結果）
- **軽減配置アニメ**: 実装推奨。まず配置時アニメ→後でD&D連携の2段階で。パフォーマンス注意（バイナリサーチ推奨）
- **AA追加フロー**: 実装推奨。フローティングアクションバー（Sidebar.tsx L1110のパターン）を流用。「一括AA追加」も将来検討
- **Discord通知**: 完了。管理画面連携に切替済み
- **CSVエクスポート**: 完了。CSV最小限で実装。Sheets API連携は不要

---

## 管理者ログイン情報
- ADMIN_SECRET: Vercel環境変数に設定済み
- 管理者UID: `（旧管理者UID）`（Googleログイン）
- 管理画面URL: https://lopoly.app/admin
- reCAPTCHAキーID: `6LcHepssAAAAAF1yKkvARnm7Gpx3_bxbyN9iLTnV`
- Discord Webhook（管理者向け）: Vercel環境変数 `DISCORD_ADMIN_WEBHOOK_URL`
- Discord Webhook（ユーザー向け#アップデート）: Vercel環境変数 `DISCORD_UPDATE_WEBHOOK_URL`
- Firebase Storage: `lopo-7793e.firebasestorage.app`（US-CENTRAL1）
- Firebase プラン: Blaze（従量課金、予算アラート500円）

## 既知のコンソールエラー（未対応・既存）
- `<button> cannot be a descendant of <button>` — サイドバーのContentTreeItem内
- `<path> attribute d: Expected number` — SVGパスにcalc()や%が入っている箇所
- `THREE.Clock非推奨警告` — THREE.Timerに移行が必要（動作には影響なし）

## Vercel関数制限
- Hobby プラン: **12関数が上限**（現在12/12）
- 新規APIファイル追加不可。既存エンドポイントに統合する方式
