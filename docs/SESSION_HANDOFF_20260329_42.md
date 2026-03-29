# セッション引き継ぎ書（2026-03-29 第42セッション）

> **このファイルは、メモリやコンテキストが完全にリセットされた場合でも、次のセッションが完璧に開始できるよう詳細に記述されている。**

---

## ★ セッション開始時の必須作業（最重要 — 絶対にスキップしない）

**CLAUDE.md に全ルールが書かれている。必ず最初に読むこと。**

### 毎回必ず読むファイル（タスクに着手する前に全て読み終えること）
1. `docs/TODO.md` — タスク管理・進捗・設計方針（最重要）
2. `docs/TECH_NOTES.md` — 技術的な落とし穴と解決策
3. 最新の `docs/SESSION_HANDOFF_*.md` — このファイル

### ⚠️ 過去の失敗パターン（繰り返さないこと）
- **設計書を読まずにバグ修正に飛びつく**
- **Skillを使わずに実装を始める**
- **`replace_all` で意図しない箇所まで置換してしまう**
- **Zustandストア内でハードコーディングした日本語メッセージ**
- **backdrop-filterを直書きする（Lightning CSSに削除される）→ TECH_NOTES.md参照**
- **glass-tier3の`!important`を無視してTailwindクラスで上書きしようとする**

---

## プロジェクト概要

- **サービス名**: LoPo（ロポ）— FF14プレイヤー向けツールポータル
- **本番URL**: https://lopoly.app/
- **管理画面**: https://lopoly.app/admin
- **技術スタック**: React 19 + TypeScript + Vite 7 + Tailwind CSS v4 + Zustand + Firebase + Vercel
- **Discord**: https://discord.gg/V288kfPFMG
- **Ko-fi**: https://ko-fi.com/lopoly

---

## 今回のセッション（第42セッション）で完了したこと

### 1. アクセントカラー導入

**方針（確定 2026-03-29）:**
- OK/進む系 → 青（blue）
- 削除/危険系 → 赤（red）
- 警告 → 黄（amber）

**実装内容:**
- `src/index.css`: CSS変数でblue/red/amberを定義（dark/light両対応）
- `tailwind.config.js`: `app.blue`, `app.red`, `app.amber` 等をTailwindに登録
- `@theme` ブロック: Tailwind v4用マッピング追加

**適用したコンポーネント:**
| ファイル | 変更内容 |
|---------|---------|
| ConfirmDialog.tsx | danger=赤、warning=amber（CSS変数化） |
| PhaseModal.tsx | 削除ボタン→赤、確認ボタン→青、ヘッダーbg-black/40→bg-app-surface2/40 |
| LoginModal.tsx | ログアウトボタン→赤CSS変数 |
| FFLogsImportModal.tsx | エラー→赤、警告→amber、フェッチ/インポートボタン→青 |
| NewPlanModal.tsx | 作成ボタン→青、件数制限警告→赤/amber |
| SaveDialog.tsx | 保存ボタン→青 |
| EventModal.tsx | 保存ボタン→青、削除ボタン→赤CSS変数 |
| Sidebar.tsx | 共有ボタン→青、削除ボタン→赤、削除確認ボタン→赤 |
| PartySettingsModal.tsx | ジョブ削除→赤+角丸正方形（星マークと統一） |
| ClearMitigationsPopover.tsx | 全削除ボタン→赤CSS変数+rounded-xl追加 |

### 2. ツールチップ反転表示

- `src/components/ui/Tooltip.tsx`: `glass-tier3 tooltip-invert` クラスを適用
- `src/index.css`: `.tooltip-invert` でglass-tier3のCSS変数を逆テーマ値に上書き
  - ダーク時: 白80%背景 + blur20px
  - ライト時: 黒80%背景 + blur20px
- テキスト色は `color: var(--color-text-on-accent)` で反転

### 3. パルス設定のlocalStorage永続化

- `src/components/GridOverlay.tsx`: `savePulseSettings()` / `loadSavedSettings()` を追加
  - キー: `lopo-pulse-settings`
  - grid, pulse, visual の3グループを保存
  - 起動時にlocalStorageから読み込み→デフォルト値にフォールバック
- `src/components/PulseSettings.tsx`: 全update関数に `savePulseSettings()` 追加

### 4. その他の改善

- MitigationSelector: `glass-panel` → `glass-tier3`（グラスモーフィズム復活）
- PartyStatusPopover: `text-white` ハードコード → `text-app-text` テーマ変数化
- 人気ページ: 「ランキング」文言を削除（JA/EN両方）

---

## 変更したファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `src/index.css` | アクセントカラーCSS変数、tooltip-invertクラス、glass-modalクラス |
| `tailwind.config.js` | app.blue/red/amber等のTailwindマッピング |
| `src/components/ConfirmDialog.tsx` | アクセントカラー適用 |
| `src/components/PhaseModal.tsx` | 同上 |
| `src/components/LoginModal.tsx` | 同上 |
| `src/components/FFLogsImportModal.tsx` | 同上 |
| `src/components/NewPlanModal.tsx` | 同上 |
| `src/components/SaveDialog.tsx` | 同上 |
| `src/components/EventModal.tsx` | 同上 |
| `src/components/Sidebar.tsx` | 共有/削除ボタン、削除確認モーダル |
| `src/components/PartySettingsModal.tsx` | ジョブ削除ボタン |
| `src/components/ClearMitigationsPopover.tsx` | 全削除ボタン角丸+赤CSS変数 |
| `src/components/ui/Tooltip.tsx` | テーマ反転表示 |
| `src/components/GridOverlay.tsx` | パルス設定永続化 |
| `src/components/PulseSettings.tsx` | 同上 |
| `src/components/MitigationSelector.tsx` | glass-panel→glass-tier3 |
| `src/components/PartyStatusPopover.tsx` | text-white→text-app-text |
| `src/locales/ja.json` | 「ランキング」削除 |
| `src/locales/en.json` | "rankings" 削除 |
| `docs/TODO.md` | 第42セッション反映 |

---

## ★ 最優先タスク（第43セッション）

### 1. ライトモードのモーダル背景改善（最重要・未完了）

**問題:** ライトモードでglass-tier3のモーダルが透明すぎて後ろが丸見え。ダークモードは問題なし。

**対象コンポーネント:**
- PartySettingsModal（パーティ設定）
- PartyStatusPopover（ステータス設定）
- ShareModal（共有モーダル）
- LoginModal（ログインモーダル）
- ConfirmDialog（削除確認モーダル）
- Sidebar内の削除確認モーダル

**重要な技術的制約:**
- `glass-tier3` は `background: transparent !important` を使っている
- **TailwindクラスではCSS的に上書きできない**（`bg-app-bg/95` は無効）
- **正しいアプローチ**: CSS変数 `--glass-tier3-bg` をライトモード時のみ上書きする
- **ダークモードは絶対に変更しない**（サイドバー・ヘッダーの美しさを破壊するため）
- `backdrop-filter` を直書きしないこと（Lightning CSSに消される）→ TECH_NOTES.md参照

**参考: EventModalが綺麗に見える理由:**
EventModalは `glass-tier3` の上に子要素で `bg-app-surface2` を重ねて実質不透明にしている。

**提案されていた方式:**
```css
.theme-light .glass-modal {
  --glass-tier3-bg: rgba(255, 255, 255, 0.95);
}
```
各モーダルのコンテナに `glass-modal` クラスを追加。ダークモードには一切影響しない。

### 2. パフォーマンス最適化（視覚変更完了後）
### 3. public/icons/ 削除（バンドル2.1MB削減）

---

## 公開までの進捗

```
全体: ████████████████████████░ 約95%完了
```

---

## 管理者ログイン情報
- ADMIN_SECRET: Vercel環境変数に設定済み
- 管理者UID: `（旧管理者UID）`（Googleログイン）
- 管理画面URL: https://lopoly.app/admin
- reCAPTCHAキーID: `6LcHepssAAAAAF1yKkvARnm7Gpx3_bxbyN9iLTnV`
- Discord Webhook（管理者向け → MainDiscord）: Vercel環境変数 `DISCORD_ADMIN_WEBHOOK_URL`
- Discord Bot Token: lopo-botリポジトリの.env + Wispbyteの.env
- Firebase Storage: `lopo-7793e.firebasestorage.app`（US-CENTRAL1）
- Firebase プラン: Blaze（従量課金、予算アラート500円）
- Wispbyteアカウント: lopoly.contact@gmail.com

## 既知のコンソールエラー（未対応・既存）
- `<button> cannot be a descendant of <button>` — サイドバーのContentTreeItem内
- `<path> attribute d: Expected number` — SVGパスにcalc()や%が入っている箇所
- `THREE.Clock非推奨警告` — THREE.Timerに移行が必要（動作には影響なし）

## Vercel関数制限
- Hobby プラン: **12関数が上限**（現在12/12）
- 新規APIファイル追加不可。既存エンドポイントに統合する方式
