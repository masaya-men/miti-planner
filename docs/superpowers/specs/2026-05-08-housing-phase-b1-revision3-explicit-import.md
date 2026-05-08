# Phase B-1 Revision 3 設計: 明示的取り込み + 進捗インジケーター

**作成日**: 2026-05-08
**前段**: Revision 2 が App Check トークン初期化タイミングと相性が悪く、ログイン直後の silent upload が `permission-denied` で全滅 → サイレントにデータロスする重大バグが発覚。設計を全面刷新。

## 設計哲学

- **ローカル / サーバー分離**: ローカルにあるものは「あなたの私物」、サーバーにあるものは「アカウントに紐づくデータ」。取り込み = ローカルからサーバーへの「移動」。
- **明示的なユーザー操作で書き込み開始**: ログイン直後の暗黙書き込みは廃止。ダイアログの「取り込む」ボタン押下まで Firestore は書かない。これにより App Check トークンの初期化を待つ意味が無くなる（ユーザー操作するころには確実に揃っている）。
- **進捗の可視化**: 取り込み中は 1 件ずつ「アップロード中 → 完了 / 失敗」のアイコンで状態を見せる。失敗時は再試行可能。
- **データロス防止**: 失敗したプランは `ownerId='local'` のままローカルに残る。ユーザーが諦めるまで消えない。

## ユーザーフロー

### A. 新規ユーザー / クリーン状態

1. 非ログインで M9S 2 件 + M10S 1 件作成（ローカル）
2. ログインボタン → Discord OAuth → 戻ってくる
3. **ローディングオーバーレイ**: migrate（fetchUserPlans + マージ）が完了するまで表示
4. ローディング消失と同時に**取り込みダイアログ表示**（ユーザーの操作タイミングは 0）
5. 3 件全チェック ON 状態 → 「取り込む」押下
6. ダイアログ内で 1 件ずつ進捗表示（M10S ⏳ → ✓ / M9S #1 ⏳ → ✓ / M9S #2 ⏳ → ✓）
7. 全成功 → ダイアログ自動クローズ + 「3 件取り込みました」トースト
8. サイドバーには 3 件、すべて `ownerId=uid` で表示

### B. 一部失敗時

5-6. M10S 成功、M9S 1 件失敗 (例: ネットワーク断)
7. ダイアログ残る + 失敗件数 + 「再試行」ボタン
8. ユーザーが「再試行」押下 → 失敗分のみ再アップロード
9. 諦めて「閉じる」 → 失敗プランは `ownerId='local'` のまま残る

### C. 既存ユーザー（律儀パターン）

1. ローカル M10S 取り込み済み（`ownerId=uid`、Firestore に保存済み）
2. プラン名や中身を編集 → 自動同期で Firestore に最新が保存
3. ログアウト → `ownerId=uid` のプランはローカルから消える、`ownerId='local'` のものだけ残る
4. 再ログイン → fetchUserPlans でクラウドから最新 M10S 取得 → サイドバーに表示
5. ローカルに `ownerId='local'` プランが無いので **ダイアログは出ない**

## 実装変更点

### `src/lib/planService.ts`

- `migrateLocalPlansToFirestore`:
  - **撤去**: `localOnly` の `createPlan` ループ。`uploadedIds` を返すロジック全廃
  - **戻り値変更**: `{ merged, dirtyIds }`（`uploadedIds` 削除）
  - 残す: `repairPlanCounts` / `fetchUserPlans` / マージロジック / ローカルが新しいプランの `updatePlan` 書き戻し

### `src/store/usePlanStore.ts`

- フィールド `_lastUploadedLocalIds` を**削除**
- `migrateOnLogin`: 戻り値変更に追従、`_lastUploadedLocalIds` の set を削除
- 既存 `prepareLocalImport`: アップロード処理を削除し、**`ownerId='local'` のプラン ID を返すだけ**に簡素化
- 既存 `applyLocalImportSelection`: **削除**（uncheck = サーバー削除のロジックは廃止）
- **新規 action `executeLocalImport(uid, displayName, planIds, onProgress)`**:
  - `planIds` を 1 件ずつ順次 `planService.createPlan` で書き込み
  - 各プランの完了で `onProgress({ id, status })` コールバック
  - 成功時: state 内の該当プランの `ownerId` を `'local'` → `uid` に書き換え
  - 戻り値: `{ id, status: 'success' | 'failed', error? }[]`
- 既存 `addPlan`: 変更なし
- 既存 `migrateOnLogin` の `_dirtyPlanIds` クリア（fix 7833011）: **維持**（並行 sync 抑制目的、Rev3 でも有効）

### `src/components/LocalImportDialog.tsx`

- Props 変更:
  - 削除: `onConfirm`, `onCancel`, `ignoreDontShow`
  - 追加: `onImport(planIds: string[])`, `onClose()`, `onRetryFailed(planIds: string[])`, `dontShowSupported: boolean`
- 内部状態:
  - `phase: 'idle' | 'uploading' | 'done'`
  - `progressMap: Map<planId, 'pending' | 'uploading' | 'success' | 'failed'>`
- UI:
  - phase=idle: 既存どおり（チェックボックス + ボタン）
  - phase=uploading: チェックボックスを進捗アイコンに置き換え、キャンセルボタン無効化、「閉じる」ボタン非表示
  - phase=done (全成功): 自動クローズ + サマリトースト
  - phase=done (一部失敗): エラー件数 + 「再試行」ボタン + 「閉じる」（諦める）

### `src/store/useLocalImportDialog.ts`

- 簡素化: `targetPlanIds` 削除、`isOpen` / `ignoreDontShow` / `open(params)` / `close()` のみ

### `src/components/Layout.tsx`

- 自動トリガー条件変更:
  - 旧: `usePlanStore.getState()._lastUploadedLocalIds.length > 0 && !dontShow`
  - 新: `usePlanStore.getState().plans.some(p => p.ownerId === 'local') && !dontShow`
- ハンドラ刷新:
  - `handleLocalImportConfirm` → `handleLocalImport`: `executeLocalImport` を呼び、進捗を progress state に流す
  - `handleLocalImportCancel` → `handleLocalImportClose`: 単に `close()` + `dontShow` 保存
- **新規ローディングオーバーレイ**: state `isImportPreparing` で「migrate + fetch + ダイアログ表示準備」中を覆う
  - effect 開始時 `setIsImportPreparing(true)`
  - ダイアログ open OR 「ローカルプラン無し」確定時 `setIsImportPreparing(false)`
  - オーバーレイは `isAuthRedirecting` と並列して表示可能

### `src/components/LoginModal.tsx`

- 「ローカルプランを取り込む (N件)」ボタン:
  - 旧: `prepareLocalImport` でアップロードしてからダイアログ
  - 新: 単にダイアログを open するだけ（アップロードはダイアログ内で起きる）

### `src/store/useAuthStore.ts`

- `signOut`:
  - 旧: 全プランワイプ + `localStorage.removeItem('plan-storage')`
  - 新: `ownerId='local'` のプランのみ保持、`ownerId=uid` のプランは除外
  - `localStorage.removeItem('plan-storage')` も**廃止**（zustand persist が新しい state を上書き保存する）
  - `mitigation-storage` は削除維持（current plan が消える可能性があるので）
  - `currentPlanId`: 残ったプランに含まれていなければ `null` にセット

### i18n (4 言語)

新規キー:
- `local_import.uploading_n_of_m`: "{{current}} / {{total}} 件アップロード中..."
- `local_import.success_summary`: "{{count}} 件取り込みました"
- `local_import.partial_failure`: "{{success}} 件成功 / {{failed}} 件失敗"
- `local_import.retry_failed`: "失敗分を再試行"
- `local_import.close`: "閉じる"

既存キー文言調整（subtitle、help_text）: ユーザー目線の動作に合わせて文章微調整。

### テスト

- `LocalImportDialog.test.tsx`: 全面書き換え（新 props / phase 状態 / 進捗 UI）
- 新規 `usePlanStore.executeLocalImport` のユニットテスト: 成功 / 失敗 / 部分成功 / state 反映
- 既存 `useAuthStore.test.ts`: signOut で local プラン保持の検証追加

## 既存修正コミットの扱い

- `15de127` UUID: 維持
- `7833011` `_dirtyPlanIds` クリア + `_isSyncing=true`: 維持（並行 sync 抑制は Rev3 でも有効）
- `92d42f0` チュートリアル `!hasAnyPlan` ガード: 維持

## 診断ログ (`284a2c5`) の扱い

実装中も役立つので**残す**。Rev3 全機能が実機検証 OK になったら、別コミットで削除。

## リスク・懸念

- **未取り込みプランの累積**: ユーザーが毎回ダイアログをキャンセルしていると、ローカルプランが蓄積。`PLAN_LIMITS.MAX_TOTAL_PLANS=50` のローカル制限は無いので技術的には無限に積めてしまう。ただしユーザー側の認知負荷で自然に整理されるはず。
- **`signOut` で local プランを残すと、複数アカウント切り替えで「前のアカウントのローカル化されたプラン」が次のアカウントで取り込み候補に出る**: 仕様としては OK（ユーザーの私物なので）。ただし誤操作で他人のアカウントに上げないよう、ダイアログでチェックを慎重に外せる UI（既に提供）が重要。

## 工数見積もり

実装 4-6 時間 + 実機検証ループ 1-2 ラウンド。1 セッションで完了見込み。
