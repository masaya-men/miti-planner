# セッション引き継ぎ書（2026-03-28 第27セッション）

> **このファイルは、メモリやコンテキストが完全にリセットされた場合でも、次のセッションが完璧に開始できるよう詳細に記述されている。**

---

## ★ セッション開始時の必須作業

**CLAUDE.md に全ルールが書かれている。必ず最初に読むこと。** 以下はその要約:

### 毎回必ず読むファイル
1. `docs/TODO.md` — タスク管理・進捗・設計方針（最重要）
2. `docs/TECH_NOTES.md` — 技術的な落とし穴と解決策
3. 最新の `docs/SESSION_HANDOFF_*.md` — このファイル

### 今回の最重要ドキュメント
- **`docs/管理基盤設計書.md`** — 管理基盤・マスターデータFirestore移行の完全な設計書（1040行）。次セッション以降の実装はこの設計書に従う

### 関連タスクに着手するときだけ読むファイル
`docs/GRAPL_PROJECT_PLAN.md`, `docs/Firebase設計書.md`, `docs/CORE_UPGRADE_PLAN.md`, `docs/高精度オートプラン・アルゴリズム仕様書.md`, `docs/計算ロジック（マルチレベル対応）設計方針.md`, `docs/マスタデータ（データベース）設計方針.md`, `docs/多言語対応（i18n）アーキテクチャ設計方針.md`, `docs/チュートリアル（オンボーディング）機能設計方針.md`, `docs/miti-planner-requirements.md`, `docs/FUTURE_EVENT_DND.md`, `docs/housing-tour-planner-requirements.md`

---

## プロジェクト概要（メモリ消失時のため）

- **サービス名**: LoPo（ロポ）— FF14軽減プランナー
- **本番URL**: https://lopoly.app/
- **リポジトリ**: https://github.com/masaya-men/miti-planner
- **技術スタック**: React 19 + TypeScript + Vite 7 + Tailwind CSS v4 + Zustand + Firebase + Vercel
- **Discord**: https://discord.gg/V288kfPFMG
- **Ko-fi**: https://ko-fi.com/lopoly

### ユーザーについて
- **非エンジニア**。説明は平易に。技術的な確認は不要で、意図の深掘りだけする
- 許可不要でどんどん進めてOK。ただしデザイン変更は必ず相談→承認→実装の流れ
- 常に**日本語**で会話する。コメント・ドキュメントも日本語
- 長い会話は固まるので切りの良いところで区切る
- TODO更新は完了マークより**方針・アイデア・決定事項の記録が最優先**

### 重要なルール
- **色のルール**: UIデザイン整え中。現在は白黒のみ（アクセントカラーは次の検討事項）
- **i18n**: UIテキストは必ずi18nキー経由。ハードコーディング禁止
- **CSS**: `backdrop-filter: blur(...)` を直接書くな → `--tw-backdrop-blur` 変数パターンを使う（docs/TECH_NOTES.md参照）
- **AIデザイン禁止**: AIグラデーション、Interフォント、Lucideアイコンのみ、shadcnデフォルトそのまま → 全部禁止

---

## 今回のセッション（第27セッション）で完了したこと

### 管理基盤・マスターデータFirestore移行 設計書の作成

**コードは一切書いていない。設計と議論のセッション。**

ユーザーとの詳細な議論を経て、以下を包括する設計書を作成:

1. **全ゲームデータの棚卸し** — コンテンツ定義(63件)・テンプレート(25件)・ジョブ(21)・スキル(97)・ステータス・アイコン(127枚)・DC/サーバー・表記揺れ・ラベル等、更新が必要な全データの特定と影響ファイルの洗い出し

2. **Firestoreコレクション設計** — `/master/config`, `/master/contents`, `/master/skills`, `/master/stats`, `/master/servers`, `/templates/{contentId}` の具体的なドキュメント構造

3. **キャッシュ戦略** — アプリ起動時にバージョン番号確認→変更時のみ再取得→localStorage+メモリキャッシュ。操作中のFirestoreアクセスゼロ

4. **コスト見積もり** — DAU 3,000で無料枠の47〜77%。マスターデータを1ドキュメントにまとめることで読み取り回数を最適化

5. **管理画面設計** — `/admin` ルート、Custom Claims認証、コンテンツ/テンプレート/スキル/ステータス/DC/サーバー/アイコンの全管理機能

6. **テンプレート自動生成** — FFLogsインポート→発見フェーズ(14日)→ロック→人気プラン昇格(管理者承認制)

7. **セキュリティ** — Firebase App Check + APIレート制限 + 監査ログ + BAN機能の3層防御

8. **5フェーズの実装計画** — Phase 0(安全基盤) → Phase 1(コンテンツ・テンプレート) → Phase 2(自動テンプレート) → Phase 3(スキル・ステータス) → Phase 4(アイコン・共有データ)

9. **付随機能** — プラン複製機能（ワンクリックコピー）、GoogleログインPWA対応（standalone時のみredirect）

10. **ハウジングツアーとの共有設計** — DC/サーバー/タグデータの共有、管理画面のセクション分け

### 議論で決まった重要な方針

- **コンテンツのグルーピングロジック**（contentRegistry.tsのハードコード）をデータ化する（seriesIdフィールドをFirestoreのコンテンツ定義に持たせる）
- **管理者通知にDiscord Webhook**を使う（テンプレート自動登録・昇格候補・不正検知）
- **管理操作の自動バックアップ**（保存前のデータを自動退避、管理画面から1クリック復元）
- **ローカル開発は本番Firestoreに読み取り専用接続**（静的ファイルはフォールバック用として残す）
- **アイコンはFirebase Storage + Vercelエッジキャッシュ**で配信（無料枠に余裕あり）
- **プラン複製**: サイドバーのプラン名横にコピーアイコン、ツールチップ「すぐ下にコピーを作成」、ワンクリックで直下に複製
- **GoogleログインPWA対応**: `display-mode: standalone` 時のみ `signInWithRedirect` に切り替え（PC版は変更なし）

---

## 変更したファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `docs/管理基盤設計書.md` | **新規作成** — 管理基盤・Firestore移行の完全設計書（1040行） |
| `docs/superpowers/specs/2026-03-28-admin-master-data-platform-design.md` | 同上（superpowers specs用コピー） |
| `CLAUDE.md` | 必読リストに管理基盤設計書を追加 |
| `docs/TODO.md` | 第27セッション完了分・設計方針追記・次セッション予定更新 |
| `docs/TODO_COMPLETED.md` | 第26セッション完了タスク移動 |

---

## ★ 次回の最優先タスク

1. **管理基盤 Phase 0 実装開始** — `docs/管理基盤設計書.md` のPhase 0に従って実装
   - 管理者ロール導入（Firebase Custom Claims）
   - 管理画面の骨組み（`/admin` ルート + 認証ガード）
   - Firebase App Check導入
   - Vercel APIレート制限ミドルウェア
   - 監査ログ基盤
   - フィーチャーフラグ基盤
   - GoogleログインPWA対応
   - プラン複製機能

2. **モーダルの見やすさ向上** — 各モーダルの視認性・統一感を改善

3. **アクセントカラーの導入** — 白黒ベースが整ったので次のステップ（必ずユーザーと相談）

4. **Stripe審査結果確認** — 追加情報提出済み（2026-03-27）

---

## 現在のアーキテクチャ概要（メモリ消失時のため）

### 主要ファイル
| 用途 | ファイル |
|------|---------|
| 状態管理（全データ） | `src/store/useMitigationStore.ts` |
| プラン管理 | `src/store/usePlanStore.ts` |
| テーマ・言語 | `src/store/useThemeStore.ts` |
| 認証 | `src/store/useAuthStore.ts` |
| 型定義 | `src/types/index.ts` |
| Firebase型 | `src/types/firebase.ts` |
| コンテンツ登録 | `src/data/contentRegistry.ts` |
| コンテンツデータ | `src/data/contents.json` |
| スキルデータ | `src/data/mockData.ts` |
| Firestore同期 | `src/lib/planService.ts` |
| ルーティング | `src/App.tsx` |
| メインページ | `src/MitiPlannerPage.tsx` |
| サイドバー | `src/components/Sidebar.tsx` |
| ヘッダー | `src/components/ConsolidatedHeader.tsx` |
| レイアウト | `src/components/Layout.tsx` |
| タイムライン | `src/components/Timeline.tsx` |
| i18n日本語 | `src/locales/ja.json` |
| i18n英語 | `src/locales/en.json` |

### 保存の仕組み（2層構造）
- **1層: localStorage** — 500msデバウンス即保存（zustand persist）
- **2層: Firestore** — ページ離脱/タブ非表示/プラン切替/ログアウト時のみ（ログインユーザー限定）

### デプロイ
- Vercel: `git push` で自動デプロイ
- 本番: https://lopoly.app/

---

## 既知のコンソールエラー（未対応・既存）
- `<button> cannot be a descendant of <button>` — サイドバーのContentTreeItem内（既存バグ）
- `<path> attribute d: Expected number` — SVGパスにcalc()や%が入っている箇所（既存バグ）
- `THREE.Clock非推奨警告` — THREE.Timerに移行が必要（動作には影響なし）

---

## セッション終了時のクリーンアップルール（CLAUDE.mdに記載済み）
1. 古い引き継ぎ書削除（最新1つだけ残す）
2. TODO.mdの完了タスクをTODO_COMPLETED.mdに移動（コードで裏取りしてから）
3. 軽微な整理（取り消し線・空行重複）
4. 引き継ぎ用メッセージをチャットに出力（ユーザーがコピペできる形で）
