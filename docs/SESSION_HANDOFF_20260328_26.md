# セッション引き継ぎ書（2026-03-28 第26セッション）

> **このファイルは、メモリやコンテキストが完全にリセットされた場合でも、次のセッションが完璧に開始できるよう詳細に記述されている。**

---

## ★ セッション開始時の必須作業

**CLAUDE.md に全ルールが書かれている。必ず最初に読むこと。** 以下はその要約:

### 毎回必ず読むファイル
1. `docs/TODO.md` — タスク管理・進捗・設計方針（最重要）
2. `docs/TECH_NOTES.md` — 技術的な落とし穴と解決策
3. 最新の `docs/SESSION_HANDOFF_*.md` — このファイル

### 関連タスクに着手するときだけ読むファイル
`docs/GRAPL_PROJECT_PLAN.md`, `docs/Firebase設計書.md`, `docs/CORE_UPGRADE_PLAN.md`, `docs/高精度オートプラン・アルゴリズム仕様書.md`, `docs/計算ロジック（マルチレベル対応）設計方針.md`, `docs/マスタデータ（データベース）設計方針.md`, `docs/多言語対応（i18n）アーキテクチャ設計方針.md`, `docs/チュートリアル（オンボーディング）機能設計方針.md`, `docs/miti-planner-requirements.md`, `docs/FUTURE_EVENT_DND.md`, `docs/housing-tour-planner-requirements.md`

### 今回変更したコード（次セッションで必ず読むこと）
- `src/i18n.ts` — getSavedLanguage()追加
- `src/types/index.ts` — SavedPlanにcategory追加
- `src/components/NewPlanModal.tsx` — 全面改修
- `src/components/Sidebar.tsx` — ホバーアニメーション + FreePlanSection新設
- `src/lib/planService.ts` — Firestore保存/復元にcategory対応

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

## 今回のセッション（第26セッション）で完了したこと

### 1. コンテキスト最適化（AI品質向上）
- CLAUDE.mdの必読リストを「毎回必須（3ファイル）」と「必要時参照（10ファイル）」に2層化
- 古い引き継ぎ書4件削除（最新1件のみ保持ルールを確立）
- TODO.mdの完了タスク（第22〜25セッション分）をTODO_COMPLETED.mdに移動
- **セッション終了時のクリーンアップルール**をCLAUDE.mdに追加
- **引き継ぎ用メッセージ出力ルール**をCLAUDE.mdに追加

### 2. サイドバーボタンのホバーアニメーション追加
- ヘッダーのボタンには白黒反転+scale-95があったがサイドバーには無かった
- **ボタン群**（新規作成・まとめて共有・選択削除）: `hover:bg-app-text hover:border-app-text hover:text-app-bg active:scale-95`
- **カテゴリタブ**（ALL・零式・絶等）: 同上
- **レベルタブ**（100/90/80/70）: `active:scale-95`
- **ツリー要素**（コンテンツ行・プラン行・シリーズ行等）: `active:scale-[0.98]`（控えめ）
- ヘッダーの共通スタイル定義: `ConsolidatedHeader.tsx` の `hoverInvert`, `iconBtnBase`, `pillBtnBase` を参照

### 3. 言語設定ページ間引き継ぎバグ修正
- **問題**: 人気ページ（/popular）を開くとUI言語が日本語に戻る
- **原因**: `src/i18n.ts` が `lng: 'ja'` ハードコードで、react-i18next自体はlocalStorageに言語を保存していなかった
- **修正**: `getSavedLanguage()` 関数を追加。i18n初期化時にlocalStorage の `theme-storage` キー（useThemeStoreのzustand persist）から `contentLanguage` を読み取り
- テーマは元々zustand persistで引き継がれていたので問題なし

### 4. ダンジョン・レイド・その他のプラン作成対応
**問題**: `contents.json` に `savage` と `ultimate` しかなく、ダンジョン等で新規作成すると全部「カスタム」行きになっていた

**解決方針（ユーザーと相談して確定）:**
- 零式・絶はcontents.jsonのデータから選択（従来通り）
- ダンジョン・レイド・その他はユーザーが名前を自由入力（データ管理の手間を省く）
- 入力した名前がcontentIdとtitleの両方になる（1回の入力で2度手間なし）

**実装:**
- `src/types/index.ts`: SavedPlanに `category?: ContentCategory` フィールド追加
- `src/components/NewPlanModal.tsx`: 全面改修
  - レベル・カテゴリを**未選択スタート**に変更（全カテゴリ共通）
  - 「任意」ラベル削除
  - 零式・絶: コンテンツ選択をドロップダウンから**1列フラットリスト**に変更
  - ダンジョン/レイド/その他: **プラン名入力欄のみ表示**
  - **Enterキー**で作成実行
  - 未入力項目があれば案内メッセージ表示 + 作成ボタン無効
- `src/components/Sidebar.tsx`:
  - **FreePlanSection**コンポーネント新設（ダンジョン/レイド/その他のプラン表示用）
  - カテゴリフィルター対応（「零式」タブではフリープラン非表示）
  - 複数選択（共有/削除）対応
  - ペンシルボタンで名前変更対応
  - 左インジケーター・ホバー・クリック感も零式/絶と同等
- `src/lib/planService.ts`: Firestore保存/復元にcategoryフィールド追加（toFirestoreCreate, toFirestoreUpdate, fromFirestore）
- `src/locales/ja.json` / `en.json`: 新規i18nキー6件追加

---

## 変更したファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `CLAUDE.md` | 必読リスト2層化、セッション終了時クリーンアップルール追加、引き継ぎメッセージ出力ルール追加 |
| `src/i18n.ts` | getSavedLanguage() で localStorage から言語復元 |
| `src/types/index.ts` | SavedPlan に `category?: ContentCategory` 追加 |
| `src/components/NewPlanModal.tsx` | 未選択スタート、フラットリスト、フリー入力、Enter対応、案内表示 |
| `src/components/Sidebar.tsx` | ホバーアニメーション追加、FreePlanSection新設、カテゴリフィルター対応 |
| `src/lib/planService.ts` | Firestore保存/復元にcategoryフィールド追加 |
| `src/locales/ja.json` | 新規i18nキー6件（select_level, select_category, select_content, enter_name, free_name_placeholder, select_level_first） |
| `src/locales/en.json` | 同上の英語版 |
| `docs/TODO.md` | 今セッション完了分・設計方針追記・次セッション予定更新 |
| `docs/TODO_COMPLETED.md` | 第22〜25セッション完了タスク移動 |

---

## ★ 次回の最優先タスク

1. **モーダルの見やすさ向上** — 各モーダル（EventModal, PartySettings, FFLogsImport等）の視認性・統一感を改善。glass-tier3ベースで統一されているが個別調整が必要
2. **アクセントカラーの導入** — 白黒ベースのデザインが完成したので、次のステップとしてアクセントカラーを検討・導入。**必ずユーザーと相談してから実装すること**
3. **Stripe審査結果確認** — 追加情報提出済み（2026-03-27）。まだ審査中
4. **パフォーマンス最適化** — 全視覚変更が終わった後に最後にやる（React.memo / useMemo）
5. **管理用テンプレート登録機能** — 公開前必須

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
