# Phase B-1.5: 共有 URL 自動取り込み 設計書

**作成日**: 2026-05-09
**ステータス**: ドラフト → 承認待ち → 実装プラン作成
**設計対象**: `/share/:shareId` のランディング体験を「リッチプレビュー → 1 タップで取り込み + 上限到達時の整理 UX」に刷新する。

---

## 1. 背景と目的

### 1.1 現状

`/share/:shareId` を踏むと `SharePage.tsx` が全画面で開き、 中身を読む → 「自分のプランにコピー」ボタンを押す → ローカルに `ownerId='local'` で `addPlan` する流れ。 「閲覧専用モード」と「コピー後フロー」の意味付けが曖昧で、 摩擦が多い。 ユーザーから「コピーボタン廃止、 踏んだら自然に自分のものとして開く体験にしたい」の要望。

### 1.2 目的

共有 URL を踏んだ瞬間に **既存の野良主流ボトムシート (`MitigationSheet.tsx`) と完全に同じ UI / UX 体系** でプレビューを見せ、 1 タップで自分の軽減表として取り込めるようにする。 上限到達時 (5/5 件 or 50/50 件) には **重ねシート** で既存軽減表を整理 → 自動再開する「Resumable interrupted task with in-context cleanup」パターンを実装。

### 1.3 副次効果

- 既存野良主流ボトムシートにも上限到達時の重ねシート整理 UX が乗る (今は無言トーストだけ)
- LocalImportDialog の「次回から表示しない」チェックボックス問題も同時に解消

---

## 2. スコープ (触る箇所 / 触らない箇所)

### 2.1 触る箇所

| 領域 | 内容 |
|---|---|
| `SharePage.tsx` | 完全置換。 新ボトムシート起動 + URL → `/miti` 遷移 |
| 新規 `ShareImportSheet.tsx` | 共有軽減表のリッチプレビュー + チェック取り込み UI (野良主流ボトムシート流) |
| 新規 `LimitResolutionSheet.tsx` | 上限到達時の整理シート (チェック削除一括) |
| 新規 `useShareImportFlow.ts` (仮) | 取り込みフロー全体の orchestration store (zustand) |
| 新規 `executeShareImport.ts` (仮) | 1 件ずつ順次取り込み + 上限ヒット時 callback で重ねシート起動 |
| `usePlanStore.syncToFirestore` | 引数 `onlyPlanIds?: string[]` を追加 (指定時のみ同期、 未指定なら従来通り全件) |
| `LocalImportDialog.tsx` | 「次回から表示しない」チェックボックス削除 |
| `Layout.tsx` | LocalImportDialog 自動表示の `dontShow` 判定削除 (毎回表示に変更) |
| `i18n` (4 言語) | 新規キー追加 (`share_import.*`, `limit_resolution.*`)、 `local_import.dont_show_again` 削除 |

### 2.2 触らない箇所 (ここを触らないことが「壊さない」最大の保険)

| 領域 | 理由 |
|---|---|
| `usePlanStore.addPlan` | 過去 4 回の致命バグ修正の `ownerId='' → 'local'` 正規化ガード絶対維持 |
| `usePlanStore` の `_dirtyPlanIds` 管理ロジック | 既存同期メカニズムをそのまま使う |
| `usePlanStore.fetchAndMerge` | `ownerId='local'` 保護ロジック維持 |
| `planService.createPlan / updatePlan / deletePlan` | 既存 Firestore I/O はそのまま、 引数追加もしない |
| `MitigationSheet.tsx` の `copyPlan` | 野良主流ボトムシートのコピー機能はそのまま (既に正しく動いている) |
| `LocalImportDialog.executeLocalImport` | Phase B-1 Rev3 で確定した取り込み実行ロジックはそのまま |
| `silentCompressStale` / `getStalePlanIds` | Phase B-1 Rev3 の真因解決を尊重、 触らない |
| `App Check` / 認証フロー | Phase B-1 Rev3 の forceRefresh パターンをそのまま使う |

### 2.3 「新しい同期パスを 1 個も増やさない」原則

`syncToFirestore` への引数追加 (`onlyPlanIds`) は新しいパスではなく、 既存メカニズムへの **絞り込み引数追加** のみ。 未指定時の挙動は完全互換、 指定時は `_dirtyPlanIds` の中から該当 ID だけ処理する filter を 1 行追加するだけ。

### 2.4 設計違反の定義

下記 7 点を 1 つでも触ったら本設計違反。 実装時は git diff で必ず 0 行確認:
- `usePlanStore.addPlan` 関数本体
- `usePlanStore` の `_dirtyPlanIds` / `_deletedPlanIds` 操作ロジック
- `usePlanStore.fetchAndMerge` 関数本体
- `planService.createPlan` / `updatePlan` / `deletePlan` 関数本体
- `MitigationSheet.tsx` の `copyPlan` / `runCopy` 関数
- `LocalImportDialog.executeLocalImport` 関数本体
- `silentCompressStale` / `getStalePlanIds`

---

## 3. ユーザー体験 (フロー)

### 3.1 単一軽減表の取り込み (典型ケース)

1. ユーザーが Twitter 等で `https://lopoly.app/share/{shareId}` を踏む
2. アプリが `/miti` にナビゲート + `ShareImportSheet` をボトムシートで起動
3. ボトムシート右側 (`MitigationSheetPreview` 流用) に共有軽減表のプレビューが即座に表示される
4. 下部に「取り込む」ボタン (大きく、 青ハイライト)
5. ユーザーが「取り込む」を押下
6. 動作別 3 段階インジケーター (上限チェック ✓ / 端末保存 ✓ / サーバー保存 ✓) が見える
7. 完了 → ボトムシートが閉じる → MitiPlannerPage に新しい軽減表が選択された状態で表示

### 3.2 バンドル複数の取り込み (応用ケース)

1〜3. 単一と同じ
4. ボトムシート左側に **軽減表カードのチェックリスト** (既定全 ON)、 右側にプレビュー
5. カード本体クリックでプレビュー切替、 チェックボックスで取り込み対象 ON/OFF
6. 下部「N 件を取り込む」ボタン (チェック数を反映)
7. 押下 → 全体進捗バー + 各件の動作別 3 段階インジケーターが順次見える
8. 完了 → ボトムシート閉じる → 最後に取り込んだ軽減表が選択された状態で MitiPlannerPage 表示

### 3.3 上限到達時の整理 (重ねシート)

例: ユーザーが既に「絶もうひとつの未来」を 5/5 件持っていて、 共有 URL の P2 を取り込もうとした瞬間:

1. P2 の上限チェック → ❌ 上限ヒット
2. **重ねシート** (`LimitResolutionSheet`) が下から滑り込んで `ShareImportSheet` の上に重なる
3. 重ねシート左側にユーザーの既存 5 件のカード (チェックボックス付き)、 右側にプレビュー
4. ユーザーがチェックを 1 つ以上付ける → 下部「N 件削除して再開」ボタン活性化
5. 押下 → 削除フェーズ動作別インジケーター (端末削除 ✓ / サーバー削除 ✓ / 容量空き表示)
6. 削除完了 → 重ねシート閉じる → 元の `ShareImportSheet` で P2 取り込みが自動再開

ユーザーが重ねシートを「キャンセル」(× ボタン) した場合: P2 以降の取り込みはスキップ、 P1 までで完了 (前半は既に保存済み)。

### 3.4 完了後の遷移

- 取り込み 1 件完了: その軽減表を `setCurrentPlanId` でアクティブにして MitiPlannerPage 表示
- 取り込み複数完了: 最後に成功した軽減表をアクティブにして MitiPlannerPage 表示
- 完全キャンセル (1 件も取り込まれない): MitiPlannerPage の現在のアクティブ軽減表のまま (元の状態)

---

## 4. UI 設計

### 4.1 `ShareImportSheet` (新ボトムシート)

野良主流ボトムシート (`MitigationSheet.tsx`) と完全に同じレイアウト・同じ z-index・同じ glass-tier 適用。 違うのは中身だけ。

```
┌──── ShareImportSheet (z-index: 99991) ──────────────┐
│  共有された軽減表 (3件・絶もうひとつの未来)               │
├──────────────────┬───────────────────────────────┤
│ ☑ ▶ P2 終了後     │                               │
│   最終更新 2日前   │   MitigationSheetPreview      │
│ ─────────────── │   (軽減タイムライン)             │
│ ☑   P3 P4 後半   │                               │
│   最終更新 2日前   │                               │
│ ─────────────── │                               │
│ ☑   ガード範囲    │                               │
│   最終更新 2日前   │                               │
├──────────────────┴───────────────────────────────┤
│              [ 3 件を取り込む ]                       │
└──────────────────────────────────────────────────┘
```

**操作ルール**:
- 単一軽減表のときは左カラム非表示、 右プレビュー全幅、 footer は「取り込む」のみ
- カード本体クリック = プレビュー切替 (チェック状態は変えない)
- チェックボックス = 取り込み対象 ON/OFF
- カード行の左 24px 以内がチェックエリア、 それ以外がプレビュー切替エリア
- 既定全件 ON、 footer ボタンには動的に「N 件を取り込む」

### 4.2 `LimitResolutionSheet` (重ねシート)

```
┌──── LimitResolutionSheet (z-index: 99993) ──────────┐
│  絶もうひとつの未来は既に 5/5 件です。                  │
│  整理する軽減表をチェック → 残り N 件取り込めます        │
├──────────────────┬───────────────────────────────┤
│ ☑ ▶ 学者試行     │                               │
│   2ヶ月前         │   MitigationSheetPreview      │
│ ─────────────── │   (軽減タイムライン)             │
│ ☐   P1 P2終了後  │                               │
│   2日前           │                               │
│ ─────────────── │                               │
│ ☐   P3 P4 後半   │                               │
│   5日前           │                               │
│ ...                                              │
├──────────────────┴───────────────────────────────┤
│  1 件選択中           [ 1 件削除して再開 ]          │
└──────────────────────────────────────────────────┘
```

**z-index**: 99993 (野良主流ボトムシートの 99991 より 1 段上、 既存 ConfirmDialog 99999 より下)。

**ソート順**: 「最後に開いた日」古い順 (使われていない軽減表が上に来る = 削除候補が見つけやすい)

**「N 件削除して再開」ボタン**: チェック数 ≥ 必要削除数のときのみ活性化。 チェック数 0 のときはグレーアウト。

**キャンセル方法**: 右上 × ボタン or Escape キー。 キャンセル時は元の取り込みフローも中断 (重ねシートが必要だった件以降スキップ)

### 4.3 動作別インジケーター

各件の取り込み中、 軽減表カード内に縦に積み上がる:

```
┌─────────────────────────────────────────┐
│ P2 P3 P4 後半                           │
│   ✓  上限 OK                            │
│   ✓  あなたの端末に保存しました           │
│   ⚪ サーバーに保存しています...          │
└─────────────────────────────────────────┘
```

**最低待機時間** (実処理が早く終わってもユーザーに見せる時間):

| 段階 | 最低待機 | 理由 |
|---|---|---|
| 上限チェック | 400ms | 純粋関数、 ほぼ即時、 でも目で確認できる速度に |
| 端末保存 | 600ms | localStorage 書き込み、 即時、 ✓ を見てもらう時間 |
| サーバー保存 | 800ms | Firestore 通信、 実際の応答時間に近い、 でも超早い場合は引き伸ばす |

**失敗時の表現**:
- 端末保存失敗: ⚠ + 赤文字「端末への保存に失敗しました」(極稀、 retry button)
- サーバー保存失敗: ⚠ + 黄文字「サーバー保存に失敗しました (端末には保存済みです、 後で自動で再試行します)」 → 次の件に進む
- 削除失敗: ⚠ + 赤文字「削除に失敗しました (再試行してください)」 → ユーザーが retry button

### 4.4 削除フェーズの動作別インジケーター

```
┌─────────────────────────────────────────┐
│ a (古い軽減表)                           │
│   ✓  あなたの端末から削除しました         │
│   ⚪ サーバーから削除しています...         │
└─────────────────────────────────────────┘
       ↓ 完了後
┌─────────────────────────────────────────┐
│ a                                        │
│   ✓  あなたの端末から削除しました         │
│   ✓  サーバーから削除しました            │
│   ✓  容量空きました (4/5)               │
└─────────────────────────────────────────┘
```

最低待機時間: 端末削除 400ms / サーバー削除 600ms / 容量表示 400ms

### 4.5 LocalImportDialog の修正

既存 `LocalImportDialog.tsx` から:
- 「次回から表示しない」チェックボックス UI 削除 ([L508-520 付近](src/components/LocalImportDialog.tsx#L508))
- `dontShow` state とその setter 削除
- localStorage キー `lopo_local_import_dont_show` の参照を削除 (キー自体は既存ユーザー影響回避のため localStorage に残置 = ただ読まなくなるだけ)

`Layout.tsx` から:
- `dontShow` 判定 (`localStorage.getItem('lopo_local_import_dont_show') === 'true'`) を削除 ([L482-501 付近](src/components/Layout.tsx#L482))
- `localPlanCount > 0` だけで自動表示判定する

`useLocalImportDialog.ts` から:
- `ignoreDontShow` パラメータを削除 (常に毎回表示なので意味なくなる)

i18n 4 言語から `local_import.dont_show_again` キー削除。

---

## 5. 技術実装

### 5.1 ルーティング

`App.tsx` の `<Route path="/share/:shareId" element={<SharePage />} />` はそのまま。 `SharePage.tsx` の中身を書き換える:

```typescript
// SharePage.tsx (擬似コード)
function SharePage() {
  const { shareId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (!shareId) return;
    // 1. ボトムシートを起動 (loading 状態で即座に開く = 一瞬の白画面を避ける)
    useShareImportFlow.getState().start(shareId);
    // 2. /miti にナビゲート (history replace で戻るボタン挙動を保護)
    //    → MitiPlannerPage がマウントされた瞬間、 既にシートが loading 状態で開いている
    navigate('/miti', { replace: true });
  }, [shareId]);

  return null; // ナビゲート完了後すぐ MitiPlannerPage に切り替わる
}
```

**順序が重要**: シート起動を先、 ナビゲートを後にすることで、 MitiPlannerPage マウント時に既にシートが loading 状態 → ユーザーが一瞬の白画面を見ることがない。

`MitiPlannerPage` (or `Layout`) から `useShareImportFlow` を購読して、 起動状態なら `<ShareImportSheet />` を描画。

### 5.2 取り込みフロー orchestration

```typescript
// src/store/useShareImportFlow.ts (新規)
interface ShareImportFlowState {
  status: 'idle' | 'loading' | 'preview' | 'importing' | 'limit_hit' | 'done' | 'error';
  shareId: string | null;
  sharedData: SharedData | null;
  selectedPlanIds: Set<string>; // バンドルのとき選択中のプラン id
  progressMap: Map<string, ProgressEvent>;
  limitContext: { contentId: string; neededCount: number; planId: string } | null;

  start: (shareId: string) => Promise<void>;
  toggleSelect: (planId: string) => void;
  setSelected: (planIds: Set<string>) => void;
  startImport: () => Promise<void>;
  resolveLimitHit: (deletedIds: string[]) => Promise<void>;
  cancelLimitHit: () => void;
  close: () => void;
}
```

### 5.3 取り込み実行ロジック (`executeShareImport`)

`plansToImport` は **単一・バンドル両方を統一形式で扱う**。 単一共有 URL なら長さ 1 の配列、 バンドルなら長さ N の配列。 `SharedData` から取り出す前処理 (既存 `isBundle(data)` 判定の流用) で normalize する。

```typescript
// 統一形式: ShareImportItem
interface ShareImportItem {
  sourceShareId: string;        // この URL の shareId (重複検出用)
  contentId: string;
  title: string;
  planData: PlanData;           // mitigation store snapshot
  sourcePlanId?: string;        // バンドル内の元 plan id (ログ用)
}

// 単一: [{ sourceShareId, contentId, title, planData }]
// バンドル: [{ ..., sourcePlanId: 'p1' }, { ..., sourcePlanId: 'p2' }, ...]

// src/lib/executeShareImport.ts (新規)
async function executeShareImport(
  plansToImport: ShareImportItem[],
  uid: string | null,
  displayName: string,
  onProgress: (event: ProgressEvent) => void,
  onLimitHit: (params: { contentId: string; neededCount: number; planId: string }) => Promise<'resolved' | 'cancelled'>,
): Promise<ImportResult[]> {
  const results: ImportResult[] = [];
  for (const sharedPlan of plansToImport) {
    // 1. 上限チェック (純粋関数)
    onProgress({ planId: sharedPlan.id, stage: 'check', status: 'in_progress' });
    await delay(400);
    const limitResult = checkPlanLimit(usePlanStore.getState().plans, sharedPlan.contentId);
    if (limitResult.exceeded) {
      const decision = await onLimitHit({
        contentId: sharedPlan.contentId,
        neededCount: 1,
        planId: sharedPlan.id,
      });
      if (decision === 'cancelled') {
        results.push({ planId: sharedPlan.id, status: 'cancelled' });
        onProgress({ planId: sharedPlan.id, stage: 'check', status: 'cancelled' });
        continue;
      }
      // resolved: 削除完了後、 再度上限チェック → 通っているはず
    }
    onProgress({ planId: sharedPlan.id, stage: 'check', status: 'success' });

    // 2. 端末保存 (addPlan、 ownerId='local' で正規化される)
    onProgress({ planId: sharedPlan.id, stage: 'local', status: 'in_progress' });
    const newPlan: SavedPlan = buildNewPlan(sharedPlan); // ownerId: 'local'
    usePlanStore.getState().addPlan(newPlan);
    await delay(600);
    onProgress({ planId: sharedPlan.id, stage: 'local', status: 'success' });

    // 3. サーバー保存 (即時 force sync、 ログイン中のみ)
    if (uid) {
      onProgress({ planId: sharedPlan.id, stage: 'server', status: 'in_progress' });
      try {
        await usePlanStore.getState().syncToFirestore({ force: true, onlyPlanIds: [newPlan.id] });
        await delay(800);
        onProgress({ planId: sharedPlan.id, stage: 'server', status: 'success' });
      } catch (err) {
        await delay(400);
        onProgress({ planId: sharedPlan.id, stage: 'server', status: 'failed', error: String(err) });
        // 端末には残っているので continue (次の件へ)
      }
    } else {
      // 非ログイン: サーバー保存スキップ (ローカルのみ、 後でログイン時に LocalImportDialog で取り込まれる)
      onProgress({ planId: sharedPlan.id, stage: 'server', status: 'skipped' });
    }

    results.push({ planId: sharedPlan.id, newId: newPlan.id, status: 'success' });
  }
  return results;
}
```

### 5.4 `syncToFirestore` 拡張

既存 `usePlanStore.syncToFirestore` のシグネチャを:

```typescript
syncToFirestore: async ({ force = false, onlyPlanIds }: { force?: boolean; onlyPlanIds?: string[] } = {}) => {
  // ...
  let dirtyIdsToProcess = Array.from(get()._dirtyPlanIds);
  if (onlyPlanIds) {
    dirtyIdsToProcess = dirtyIdsToProcess.filter(id => onlyPlanIds.includes(id));
  }
  // 以下、 既存ロジックそのまま
}
```

未指定時の挙動は完全互換。 既存の呼び出し元 (タブ切替・ページ離脱・5分インターバル) は影響なし。

### 5.5 削除実行 (重ねシートから)

```typescript
async function executePlanDeletions(
  planIds: string[],
  uid: string | null,
  contentId: string,
  onProgress: (event: DeleteProgressEvent) => void,
): Promise<void> {
  for (const planId of planIds) {
    onProgress({ planId, stage: 'local_delete', status: 'in_progress' });
    await delay(400);
    if (uid) {
      // ログイン中: deleteFromFirestore (ローカル + Firestore)
      try {
        await usePlanStore.getState().deleteFromFirestore(planId, uid, contentId);
        onProgress({ planId, stage: 'local_delete', status: 'success' });
        onProgress({ planId, stage: 'server_delete', status: 'in_progress' });
        await delay(600);
        onProgress({ planId, stage: 'server_delete', status: 'success' });
      } catch (err) {
        onProgress({ planId, stage: 'server_delete', status: 'failed', error: String(err) });
        // 失敗したら整理フローを止めて、 ユーザーに retry button
        throw err;
      }
    } else {
      // 非ログイン: deletePlan のみ (ローカル削除)
      usePlanStore.getState().deletePlan(planId);
      onProgress({ planId, stage: 'local_delete', status: 'success' });
      onProgress({ planId, stage: 'server_delete', status: 'skipped' });
    }
  }
}
```

### 5.6 shareId 重複検出

既存 localStorage `lopo_copied_shares` (popular カウント増加防止用) をそのまま流用。 `ShareImportSheet` 起動時に:

```typescript
const copiedShares: string[] = JSON.parse(localStorage.getItem('lopo_copied_shares') || '[]');
const isAlreadyCopied = copiedShares.includes(shareId);
```

`isAlreadyCopied === true` のとき: 軽減表カードに「✓ 取り込み済み」バッジを薄く表示。 ボタンは活性のまま (再取り込みは禁止しない、 ユーザーが望むなら可能)。

### 5.7 純粋関数 `checkPlanLimit`

```typescript
// src/utils/planLimitChecker.ts (新規)
export interface PlanLimitCheckResult {
  exceeded: boolean;
  reason?: 'max_total' | 'max_per_content';
  current: number;
  max: number;
}

export function checkPlanLimit(
  plans: SavedPlan[],
  contentId: string,
): PlanLimitCheckResult {
  const totalCount = plans.length;
  if (totalCount >= PLAN_LIMITS.MAX_TOTAL_PLANS) {
    return { exceeded: true, reason: 'max_total', current: totalCount, max: PLAN_LIMITS.MAX_TOTAL_PLANS };
  }
  const contentCount = plans.filter(p => p.contentId === contentId).length;
  if (contentCount >= PLAN_LIMITS.MAX_PLANS_PER_CONTENT) {
    return { exceeded: true, reason: 'max_per_content', current: contentCount, max: PLAN_LIMITS.MAX_PLANS_PER_CONTENT };
  }
  return { exceeded: false, current: contentCount, max: PLAN_LIMITS.MAX_PLANS_PER_CONTENT };
}
```

vitest で 6 ケース以上 (上限なし / コンテンツ別 5/5 / 総 50/50 / 同時 / 0 件 / 境界) をカバー。

---

## 6. データ保護とリスク管理

### 6.1 トリプル防御の維持

| 防御層 | 機能 | 維持/改善 |
|---|---|---|
| 第 1 層 | `addPlan` 入口の `ownerId='' → 'local'` 正規化ガード | 維持 |
| 第 2 層 | `_dirtyPlanIds` の自動再試行 (5分 / タブ切替 / 離脱) | 維持 |
| 第 3 層 | `fetchAndMerge` の `ownerId='local'` 保護 | 維持 |

新たに追加: **即時サーバー保存 (best effort)** = 第 0 層的なポジション。 失敗しても第 2 層・第 3 層が拾うので、 既存防御は完全に温存される。

### 6.2 「前半だけ保存」の構造的不可能性

各件の取り込みは独立した「上限チェック → 端末保存 → サーバー保存」のシーケンスで完結する。 P1 完了後に P2 で詰まっても、 P1 は既に Firestore に書き込み済み。 重ねシートの削除も `await` で完了を待ってから次に進むので、 「削除されてないのに再取り込み」も起きない。

### 6.3 既存ボトムシート `MitigationSheet` の挙動を一切変えない

`MitigationSheet.tsx` の `copyPlan` 関数や `runCopy` ロジックは触らない。 既存の野良主流ボトムシートからのコピーは今までと完全に同じ挙動を維持。

### 6.4 既存同期メカニズムへの影響

`syncToFirestore` への `onlyPlanIds` 引数追加は、 既存呼び出し元 (引数なし) では完全互換。 引数を渡すのは新規 `executeShareImport` のみ。 既存のフロー (5 分インターバル同期、 タブ切替、 ページ離脱) は変更影響を受けない。

### 6.5 既存 LocalImportDialog の影響範囲

「次回から表示しない」チェックボックスの削除は、 既存ユーザーが localStorage に保存した `lopo_local_import_dont_show=true` の値があっても **無視されるだけ** (キーは削除しない)。 つまり既存のチェック済みユーザーも次回ログイン時から自動表示される。 これは仕様変更なので i18n 周りで「より親切になりました」的な軽い文言調整があっても良い (任意)。

`executeLocalImport` 自体は触らないので、 取り込み実行ロジック (Phase B-1 Rev3 で確定したもの) はそのまま機能する。

---

## 7. 多言語 (i18n)

### 7.1 追加キー (4 言語: ja / en / ko / zh)

```yaml
share_import:
  title: "共有された軽減表"
  title_bundle: "共有された軽減表 ({{count}}件)"
  loading: "読み込んでいます..."
  not_found: "この共有 URL は見つかりませんでした"
  error: "読み込みに失敗しました"
  already_copied_badge: "取り込み済み"
  button_import_single: "取り込む"
  button_import_count: "{{count}} 件を取り込む"
  progress_check: "上限を確認しています..."
  progress_check_ok: "上限 OK"
  progress_local: "あなたの端末に保存しています..."
  progress_local_ok: "あなたの端末に保存しました"
  progress_server: "サーバーに保存しています..."
  progress_server_ok: "サーバーに保存しました"
  progress_server_failed: "サーバー保存に失敗しました (端末には保存済みです、 後で自動で再試行します)"
  progress_local_failed: "端末への保存に失敗しました"
  done_summary: "{{count}} 件の軽減表を取り込みました"
  cancelled_some: "{{cancelled}} 件キャンセルされました"

limit_resolution:
  title_per_content: "{{contentName}} は既に {{current}}/{{max}} 件です"
  title_total: "総上限 {{current}}/{{max}} 件に達しています"
  body: "整理する軽減表をチェックしてください。 残り {{count}} 件取り込めます。"
  card_label_last_opened: "最終 {{date}}"
  selection_count: "{{count}} 件選択中"
  button_delete_and_resume: "{{count}} 件削除して再開"
  button_delete_and_resume_disabled: "削除する軽減表をチェックしてください"
  button_cancel: "キャンセル"
  delete_progress_local: "あなたの端末から削除しています..."
  delete_progress_local_ok: "あなたの端末から削除しました"
  delete_progress_server: "サーバーから削除しています..."
  delete_progress_server_ok: "サーバーから削除しました"
  delete_capacity_freed: "容量空きました ({{current}}/{{max}})"
  delete_failed: "削除に失敗しました"
  resume_message: "{{count}} 件の取り込みを再開します"
```

### 7.2 削除キー (4 言語)

- `local_import.dont_show_again` (チェックボックス廃止)
- `local_import.copy_to_mine` (もし存在すれば、 用途次第)

### 7.3 用語ルール厳守

memory `feedback_terminology_keigen_hyou.md` に従い:
- ja「軽減表」/ en「mitigation sheet」/「sheet」(短縮可) / ko「경감표」/ zh「减伤表」
- 「プラン」「plan」は使わない (機能名「軽減プランナー / オートプラン」のみ許容)

---

## 8. テスト戦略

### 8.1 純粋関数

| 関数 | テストケース数 | カバー内容 |
|---|---|---|
| `checkPlanLimit` | 7+ | 上限なし / コンテンツ別 5/5 / 総 50/50 / 同時 / 0 件 / 境界 / 異 contentId |
| `parsePlanLimitError` | 既存 7 | 流用 |
| `buildNewPlan` (sharedPlan → SavedPlan) | 4+ | id 生成 / ownerId='local' / title フォールバック / contentId 継承 |

### 8.2 Store action

| 関数 | テストケース数 | mock 対象 |
|---|---|---|
| `executeShareImport` | 6+ | Firestore (createPlan / deletePlan)、 タイマー (delay) advance |
| `executePlanDeletions` | 4+ | Firestore (deleteFromFirestore) |
| `useShareImportFlow.startImport` | 5+ | 単一 / バンドル / 上限ヒット / キャンセル / 全成功 |
| `syncToFirestore({ onlyPlanIds })` | 3+ | 引数あり/なし、 該当なし、 該当あり |

### 8.3 UI コンポーネント (testing-library + happy-dom)

| コンポーネント | テストケース数 | 主要シナリオ |
|---|---|---|
| `ShareImportSheet` | 8+ | 単一表示 / バンドル表示 / チェック ON/OFF / プレビュー切替 / ボタン disabled / 進捗インジケーター |
| `LimitResolutionSheet` | 6+ | 5/5 表示 / チェック数連動 / 削除ボタン disabled / 並び順 / キャンセル |

### 8.4 E2E (Playwright)

| シナリオ | 主要アサート |
|---|---|
| 共有 URL 単一 → 取り込み → MitiPlannerPage 表示 | URL 遷移、 シート表示、 ボタン押下、 完了後の画面遷移 |
| バンドル 3 件 → 全件取り込み | 進捗バー、 全件 ✓、 最後の軽減表がアクティブ |
| 上限ヒット → 重ねシート → 削除 → 再開 | 重ねシート起動、 削除完了、 自動再開、 全件取り込み完了 |
| 重ねシートでキャンセル | 部分完了、 元の画面に戻る |
| 既に取り込み済み URL → 再訪 | 「取り込み済み」バッジ表示 |

### 8.5 リグレッション (既存機能)

| 既存機能 | アサート |
|---|---|
| 野良主流ボトムシート copyPlan | 既存のトースト挙動が変わらない (今回は触らない) |
| LocalImportDialog 自動表示 | ローカル軽減表が 1 件以上で毎回ログイン時に開く |
| `_dirtyPlanIds` 自動同期 (5分 / タブ切替) | onlyPlanIds 未指定で従来通り全件処理 |
| `fetchAndMerge` の ownerId='local' 保護 | 触らないので既存テストがそのまま通る |

---

## 9. リリース計画

### 9.1 1 PR / 1 デプロイ

Phase B-1.5 全体を 1 つの PR に集約 (commit は機能単位で複数) → 用語修正 + リグレッションテスト + Phase B-1.5 をまとめて push + Vercel デプロイ。 Vercel 月 100 ビルド枠を節約。

### 9.2 デプロイ前チェックリスト

- [ ] `npm run build` 成功 (Vercel tsc 厳格モード対応)
- [ ] `vitest run` 全件 PASS (既存 487 + 新規)
- [ ] Playwright E2E 全シナリオ PASS
- [ ] `tsc --noEmit` clean
- [ ] 用語チェック (「プラン」が新規 i18n キーに混入していない)
- [ ] 既存ボトムシート `MitigationSheet.tsx` に変更 0 行 (diff チェック)

### 9.3 デプロイ後実機検証チェックリスト

- [ ] ログイン中: 単一共有 URL 踏む → ボトムシート表示 → 取り込む → 即時サーバー保存 ✓ → 別端末でも見える
- [ ] 非ログイン: 単一共有 URL 踏む → ボトムシート表示 → 取り込む → ローカル保存 ✓ → ログイン後 LocalImportDialog で取り込める
- [ ] バンドル 3 件 → 全件取り込み → 進捗 ✓
- [ ] 上限到達 → 重ねシート → 削除 → 再開 → 完了
- [ ] LocalImportDialog: チェックボックス消えている、 毎回自動表示される、 取り込み完了で次回出ない
- [ ] 既存野良主流ボトムシート: コピー挙動が変わっていない
- [ ] 4 言語確認 (ja / en / ko / zh)
- [ ] スマホ (iOS / Android) でボトムシート / 重ねシート操作確認

---

## 10. 後続タスク (B-1.5 完了後)

引き継ぎサマリ準拠:
1. 診断ログ撤去 (`src/utils/debugLog.ts` + 各所 `dlog` 呼び出し、 `scripts/inspect-user-plans.ts` は残す)
2. 表エリアスムーズスクロール (Lenis 等で Timeline をスムーズに)
3. Phase B-2 (Discord ↔ X アカウントリンク、 自前マッピング `account_links/{provider:id}` 方式)

---

## 11. 既知の未対応リスク (本設計のスコープ外)

引き継ぎサマリ「同期不安定 (2026-04-29 報告)」は本 Phase B-1.5 のスコープ外。 既存の `syncToFirestore` メカニズム自体に内在する問題で、 Phase B-1.5 はその上に乗るだけ。 将来別タスクで sendBeacon ベースの同期エンドポイント新設、 `syncDirtyPlans` の競合判定見直し、 PULL 時の上書き条件にバージョン番号併用、 などで対処する。 Phase B-1.5 は同期不安定問題を悪化させない (新しい同期パスを 1 つも増やさないため)。

---

## 12. ファイル変更一覧 (実装プラン作成のヒント)

| ファイル | 状態 | 内容 |
|---|---|---|
| `src/components/SharePage.tsx` | 書き換え | 中身を `useShareImportFlow.start(shareId)` 呼び出し + `/miti` ナビゲートに |
| `src/components/ShareImportSheet.tsx` | 新規 | 共有軽減表のリッチプレビュー + チェック取り込み UI |
| `src/components/LimitResolutionSheet.tsx` | 新規 | 上限到達時の整理シート (チェック削除一括) |
| `src/components/SharePlanCard.tsx` | 新規 (任意) | カード行コンポーネント (左カラム再利用) |
| `src/components/ShareImportProgressIndicator.tsx` | 新規 (任意) | 動作別 3 段階インジケーター |
| `src/store/useShareImportFlow.ts` | 新規 | 取り込みフロー orchestration zustand store |
| `src/lib/executeShareImport.ts` | 新規 | 1 件ずつ順次取り込み + 上限ヒット callback |
| `src/lib/executePlanDeletions.ts` | 新規 | 重ねシートからの削除実行 |
| `src/utils/planLimitChecker.ts` | 新規 | `checkPlanLimit` 純粋関数 |
| `src/store/usePlanStore.ts` | 拡張 | `syncToFirestore` に `onlyPlanIds` 引数追加 |
| `src/components/LocalImportDialog.tsx` | 修正 | 「次回から表示しない」チェック削除 |
| `src/store/useLocalImportDialog.ts` | 修正 | `ignoreDontShow` パラメータ削除 |
| `src/components/Layout.tsx` | 修正 | 自動表示判定の `dontShow` 削除 |
| `src/i18n/locales/ja.ts` (+en/ko/zh) | 拡張 | `share_import.*` / `limit_resolution.*` 追加、 `local_import.dont_show_again` 削除 |
| `src/components/__tests__/*.test.tsx` | 新規 | 上記新規コンポーネントのテスト |
| `src/lib/__tests__/*.test.ts` | 新規 | executeShareImport / executePlanDeletions / checkPlanLimit のテスト |
| `e2e/share-import.spec.ts` | 新規 (任意) | Playwright E2E |

---

## 13. 設計合意のキーポイント (再掲)

ユーザーとの brainstorming で確定した方針:
1. 大枠 = **A 一気に**: Phase B-1.5 を 1 spec / 1 PR で完成体まで持っていく
2. URL 踏んだ瞬間 = **B 1 タップ確定**: ボトムシートでプレビュー → 「取り込む」ボタン押下で取り込み
3. バンドル取り込み = **B チェック一括**: 既定全 ON のチェックリスト + 「N 件を取り込む」一括ボタン (プレビューも見られる)
4. 上限到達時 = **B チェック削除一括**: 重ねシートで既存軽減表をチェック → 「N 件削除して再開」一括ボタン
5. LocalImportDialog 改善 = **チェック廃止 + 毎回表示**: ローカル軽減表が残っている限り毎回自動表示 (取り込み完了で消える性質を活用)
6. 即時サーバー保存 = **採用**: 各件で即時 force sync、 失敗時は既存 dirty 同期にフォールバック
7. 動作別 3 段階インジケーター = **採用**: 上限チェック / 端末保存 / サーバー保存 を分けて表示、 最低待機時間で目で追える速度に
8. 既存野良主流ボトムシート = **触らない**: 既に正しく動いている、 「壊さない」原則の中核
9. 既存同期メカニズム = **触らない**: 引数追加のみで、 既存呼び出し元への影響ゼロ
10. データ保護 = **トリプル防御 + 即時保存** で多層化
