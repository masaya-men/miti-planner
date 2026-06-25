# iOS 非ログインユーザー向けローカルデータ安全性の強化 — 設計書

作成: 2026-06-25 / 状態: 設計確定（ユーザー承認済み）

## 背景・目的
ローカル保存のみ（非ログイン）の iOS Safari ユーザーは、ITP により約7日でローカルデータが消えうる最高リスク層。
現状の安全性案内には2つの穴がある:

1. **警告が iPhone でほぼ見られない**: 案内バー（[LocalDataSafetyBar](../../../src/components/LocalDataSafetyBar.tsx)）はサイドバー内にあり、モバイルではハンバーガーメニュー（[Layout.tsx:641](../../../src/components/Layout.tsx#L641) の MobileBottomSheet）を開いた時しか表示されない。メニューを開かない大半の iPhone ユーザーには届かない。
2. **バックアップの「ダウンロード」が iOS で不発**: [backupService.ts](../../../src/utils/backupService.ts) の `downloadBackupFile` は `<a download>` + 即時 `revokeObjectURL` で、iOS Safari（特にホーム画面アプリ）ではファイル保存されずタブで開くだけになりがち。警告しても守る手段が壊れている。

目的: **iOS 非ログインユーザーに確実に警告を届け、かつその場で実際に動くバックアップ手段を提供する。**

## 現状の事実（実コードで確認済み）
- 案内バーはサイドバー内 → モバイルはメニュー内のみ。Sidebar は PC（`hidden md:block`）とモバイルメニュー内の2箇所でマウントされる。
- `downloadBackupFile` は `a.click()` 直後に `URL.revokeObjectURL` を呼ぶ footgun を含む。
- 復元（[BackupRestoreModal](../../../src/components/BackupRestoreModal.tsx)）は**既に「貼り付け」と「ファイル選択」両対応**。今回は変更不要。
- 書き出し（[BackupExportModal](../../../src/components/BackupExportModal.tsx)）は JSON 全文を `<textarea value={json}>` に常時描画（186-191行）→ 巨大データでスマホが固まる懸念。
- `seen` フラグ（[useLocalSafetySeenStore](../../../src/store/useLocalSafetySeenStore.ts)）は localStorage 永続（赤バッジ＝要確認の既読管理）。
- チュートリアル進行中は `useTutorialStore` の `isActive`（[Layout.tsx:103](../../../src/components/Layout.tsx#L103)）。
- 「共有」には2系統あり、本設計が使うのは**①OS の Web Share のみ**。②アプリの「表を共有」リンク（`/api/share` → `/share/:id`・[ShareModal.tsx:118-128](../../../src/components/ShareModal.tsx#L118-L128)・サーバー保存あり）とは**完全に別物**で本設計では一切使わない。

## 設計

### A. 確実な警告（iOS 自動ポップ）
- **新コンポーネント `LocalDataSafetyAutoPrompt`** を `Layout` の最上位に**常時マウント**（サイドバー/メニューの外）。モバイルでもメニュー非依存で確実に動く。
- **自動表示条件**を純粋関数に切り出してテスト可能にする:
  ```ts
  // src/utils/localSafetyAutoPrompt.ts
  export function shouldAutoPromptLocalSafety(p: {
    isIOS: boolean; isLoggedIn: boolean; planCount: number; seen: boolean; tutorialActive: boolean;
  }): boolean {
    return p.isIOS && !p.isLoggedIn && p.planCount > 0 && !p.seen && !p.tutorialActive;
  }
  ```
- コンポーネントは `user`（useAuthStore）/`plans.length`（usePlanStore）/`seen`+`markSeen`（useLocalSafetySeenStore）/`isActive`（useTutorialStore）を購読し、`useEffect` で条件成立時に **モーダルを1回だけ自動オープン → `markSeen()`**（= 二度目以降は出ない・localStorage 永続。未読ドットも整合して消える）。`isIOS` は既存判定（[LocalDataSafetyModal.tsx:12-13](../../../src/components/LocalDataSafetyModal.tsx#L12-L13)）と同じUA判定を共通ヘルパ化して再利用。
- 表示するモーダルは既存 [LocalDataSafetyModal](../../../src/components/LocalDataSafetyModal.tsx) を流用（iOS ヒント＋バックアップ＋ログイン導線が既にある）。CTA の「バックアップ」用に **自分専用の `BackupExportModal` インスタンス**を持つ（自己完結）。
- 既存の控えめバー（LocalDataSafetyBar）は**変更しない**。自動ポップは iOS への上乗せ。
- `isLoggedIn` は `user !== null` で判定。

### B. iOS で実際に動くバックアップ（全プラン・ローカル完結）
**重要前提**: バックアップは「選択した全プランを1個の JSON にまとめた」もの。Web Share は**その1ファイルを OS 共有シートに渡すだけ**で、URL を作らず・サーバーに何も上げず・ゴミも残さない。per-plan ではなく全プランまとめて保存できる。

- [backupService.ts](../../../src/utils/backupService.ts):
  - **`shareBackupFile(json, filename)` を新設**:
    ```ts
    export async function shareBackupFile(
      json: string, filename: string,
    ): Promise<'shared' | 'cancelled' | 'unsupported' | 'failed'> {
      try {
        if (typeof navigator === 'undefined' || !navigator.canShare || !navigator.share) return 'unsupported';
        const file = new File([json], filename, { type: 'application/json' });
        if (!navigator.canShare({ files: [file] })) return 'unsupported';
        await navigator.share({ files: [file], title: filename });
        return 'shared';
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'; // ユーザーが共有シートを閉じた
        return 'failed';
      }
    }
    ```
  - **`downloadBackupFile` の revoke バグ修正**: `<a>` を DOM に append → click → `setTimeout(() => { revokeObjectURL; remove }, 10000)` に変更（即時 revoke をやめる）。
- [BackupExportModal](../../../src/components/BackupExportModal.tsx):
  - 保存ボタンを環境で出し分け: **iOS → 「共有」**（`shareBackupFile`。`unsupported`/`failed` 時は `downloadBackupFile` にフォールバック＋トースト。`cancelled` は何もしない。`shared` は成功トースト）。**PC → 「ダウンロード」**（従来）。
  - **「コピー」は両環境で常時**（小規模向けの保険。コピー→復元欄に貼り付け）。
  - **巨大データ対策**: `json.length` が閾値（`LARGE_BACKUP_CHARS = 100_000`）超なら **textarea に全文を描画しない**（代わりに件数・容量の要約を表示）。Copy/Share/Download ボタンは生きたまま（Copy は `navigator.clipboard.writeText(json)` を使い、textarea select フォールバックは小規模時のみ）。これで膨大データでも画面が固まらない。
  - このコンポーネントはサイドバーと自動ポップの両方が使う → 両方で同時に直る。

### 復元側
- 変更なし（貼り付け＋ファイル選択で iOS の Share 保存ファイルも読める）。

## データフロー
```
[警告] Layout マウント
  → LocalDataSafetyAutoPrompt（常時マウント・最上位）
  → shouldAutoPromptLocalSafety(iOS,!login,planCount>0,!seen,!tutorial) === true
  → LocalDataSafetyModal 自動オープン + markSeen()（1回限り）
  → モーダル内「バックアップ」→ 自前 BackupExportModal

[バックアップ] BackupExportModal
  → createBackupJson(選択プラン)  // 全プラン入り1ファイル・個人情報strip(既存)
  → iOS: shareBackupFile() →(失敗時) downloadBackupFile()
     PC : downloadBackupFile()
     共通: handleCopy()（clipboard）
  → 巨大時は textarea 全文描画をスキップ
```

## 影響範囲 / 非対象
- 変更: `src/utils/backupService.ts`（share追加・download修正）、`src/components/BackupExportModal.tsx`（ボタン出し分け・巨大対策）、`src/components/Layout.tsx`（AutoPrompt マウント）、i18n 4言語。
- 新規: `src/components/LocalDataSafetyAutoPrompt.tsx`、`src/utils/localSafetyAutoPrompt.ts`（純粋関数）、`src/utils/isIOS.ts`（共通UA判定・既存 modal からも参照）。
- **非対象（別タスク）**: ②アプリ「表を共有」リンクのサーバー残骸 GC（`shared_plans` クリーンアップ。2026-06-25 ユーザーが近々対応希望と表明。TODO.md インフラ欄に記録済み）。本バックアップとは無関係。
- 復元 UI、ダメージ計算、他画面には触らない。

## テスト方針（TDD）
- **`shouldAutoPromptLocalSafety` 単体**: iOS×非ログイン×表あり×未読×非チュートリアル のみ true。各条件を1つずつ false にすると false（5パターン）。
- **`shareBackupFile` 単体**（`navigator` をモック）:
  - `canShare`/`share` 非実装 → `'unsupported'`
  - `canShare({files})===false` → `'unsupported'`
  - `share` 解決 → `'shared'`（`navigator.share` が File 入りで呼ばれる）
  - `share` が AbortError reject → `'cancelled'`
  - `share` がその他 reject → `'failed'`
- **`downloadBackupFile`**: 即時 revoke しない（`URL.revokeObjectURL` が同期的に呼ばれない）ことを fake timers で確認。
- ビュー（BackupExportModal の出し分け・巨大時 textarea 非描画）は実機/簡易レンダリングで確認。

## 実機検証（実装後・本番投入前）
- iPhone Safari・非ログイン・表あり: 起動で警告モーダルが**1回**自動表示 → 閉じると再表示されない。
- モーダルの「バックアップ」→「共有」→「ファイルに保存」で .json が保存できる（全プラン入り）。
- 「コピー」→ 復元の貼り付けで戻せる。保存した .json を「ファイル選択」で復元できる。
- 大量プランでも書き出し画面が固まらない。
- PC: 従来どおり「ダウンロード」。チュートリアル中は自動ポップしない。ログインすると自動ポップしない。
