# Phase B-1.5 polish: ShareImportSheet UI/UX 仕上げ 設計書

**作成日**: 2026-05-09
**ステータス**: ドラフト → 承認待ち → 実装プラン作成
**前提**: Phase B-1.5 (共有 URL 自動取り込み) 本体は既に実装・デプロイ済 (HEAD: e0f5981)。 ユーザー実機検証で機能面 OK 確認後、 本 spec は UI/UX polish と総上限事前判定を担当する。

---

## 1. 背景と目的

### 1.1 現状の課題 (実機検証フィードバック 2026-05-09)

機能面は問題なく動作しているが、 体感的に以下が引っかかる:

1. **単一 URL のときレイアウトが寂しい**: `isBundle = items.length > 1` で左カラム描画を判定しているため、 単一プラン共有のときは右側に preview が広がるだけで、 取り込み中インジケーターも視覚化されない。 バンドルのときと体験が断絶している。
2. **左カラムが情報不足**: 現状は `plan.title` (= プラン名) のみ。 「これがどのコンテンツの軽減表なのか」 が一目で分からない。
3. **取り込み中の表示が地味**: テキスト 3 段 (`✓ 上限OK / ✓ 端末保存 / ✓ サーバー保存`) が読みにくく「動いてる感」 が薄い。 LocalImportDialog ではすでに B2 sweep アニメ (青グラデが左→右に充填) が好評。
4. **上限ヒット時に LimitResolutionSheet が突然立ち上がる**: 「どのカードが原因なのか」 を認識する間がない。
5. **削除中の演出も地味**: テキスト 3 段 (`端末から削除... / サーバーから削除... / 容量を確保`) で達成感が薄い。
6. **シート起動時の動きが直線的**: `y=100% → y=0` の 1 段スプリングだけで、 「読み込み中→データ来た」 の意味づけが消えている。
7. **総上限 50 件は事前判定したい**: 現状は `checkPlanLimit` で 1 件ずつヒットさせる。 バンドル取り込み時に「合計 N 件 + 既存 M 件 > 50」 を最初にまとめて知らせたい。
8. **キャンセルできない**: ShareImportSheet Footer に取り込みボタンしかなく、 「やめたい」 ときバックドロップ click か ESC しか手段がない (実機ユーザーが今日気づいた追加要望)。

### 1.2 目的

ShareImportSheet と LimitResolutionSheet の UI/UX を全面 polish して **野良主流ボトムシート (`MitigationSheet.tsx`) と完全に同じアニメ感 / 統一レイアウト** にする。 加えて総上限の事前判定を入れて「1 件ずつ削除して」 のリピート摩擦を消す。

### 1.3 スコープ外

- **#8 既存タブ再利用 (PWA 挙動)** は技術的に Chrome の新タブ open を完全防止できないと判明 (Discord → OS URL handler → Chrome 新タブ open のフローに JS 介入余地なし)。 既存タブで取り込み実行 + 新タブを `window.close()` で閉じる SW 実装は半解決止まりのため、 Spec 1 ではやらない判断。
- 取り込み本体 (`executeShareImport` の Firestore 同期 / `addPlan` / `syncToFirestore` 等) は触らない。
- `MitigationSheet`, `LocalImportDialog`, `usePlanStore`, `planService` の本体ロジックは触らない。

---

## 2. スコープ (触る箇所 / 触らない箇所)

### 2.1 触る箇所

| 領域 | 内容 |
|---|---|
| `src/components/ShareImportSheet.tsx` | レイアウト統一 (#1)、 `layout` prop アニメ (#6)、 キャンセルボタン追加 (新規)、 spring 値統一 |
| `src/components/LimitResolutionSheet.tsx` | レイアウト統一 (#4)、 sweep アニメ赤 (#5)、 max_total モード対応 (#7)、 spring 値統一 |
| `src/components/SharePlanCard.tsx` | subtitle 表示 (#2)、 sweep オーバーレイ呼び出し (#3, #5)、 上限ヒット時の赤背景フラグ (#4)、 退場アニメ (#5) |
| 新規 `src/components/SweepOverlay.tsx` | LocalImportDialog の `renderSweep` をコンポーネント化、 ShareImportSheet / LimitResolutionSheet で共有 |
| `src/components/ShareImportProgressIndicator.tsx` | **削除** (sweep に置き換わるため不要) |
| `src/lib/executeShareImport.ts` | 総上限事前判定 (#7)、 per_content limit hit 時に「赤背景 → 800ms wait → 重ねシート」 シーケンスを発火 |
| `src/lib/shareImportTypes.ts` | `LimitContext.reason` フィールド追加 |
| `src/store/useShareImportFlow.ts` | `setRedFlag(planId)` action 追加 (#4 の赤背景制御)、 `setStatus` の中で必要な state 整合 |
| `src/locales/{ja,en,ko,zh}.json` | 不要キー削除 (progress_*, delete_progress_*, delete_capacity_freed)、 新規キー追加 (button_cancel, title_total, body_total) |

### 2.2 触らない箇所 (0 行 diff 維持)

| 領域 | 理由 |
|---|---|
| `src/store/usePlanStore.ts` 全体 | Phase B-1.5 で確定した addPlan / syncToFirestore / fetchAndMerge を維持 |
| `src/lib/planService.ts` | 既存 Firestore I/O 維持 |
| `src/utils/silentCompressStale.ts` | Phase B-1 真因解決の修正を維持 |
| `src/utils/checkPlanLimit.ts` | 純粋関数、 事前判定は executeShareImport 側で同関数を別文脈で呼ぶだけ |
| `src/components/MitigationSheet.tsx` | 野良主流シートは既に完成、 アニメ参照元のみ |
| `src/components/LocalImportDialog.tsx` 本体 | sweep util を抽出する際、 `renderSweep` 関数だけ削除 + import で代替。 機能ロジックは無触 |
| `src/lib/buildShareImportItems.ts` | 既存パース維持 |

---

## 3. 設計詳細

### 3.1 レイアウト統一 (#1, #4, #5)

**変更前**: ShareImportSheet は `isBundle = items.length > 1` で左カラム描画を分岐。 LimitResolutionSheet は preview を `hidden md:block` で mobile 非表示。

**変更後**: 3 つすべてが「左狭リスト + 右広 preview」 の同一レイアウト。

```
┌─ Sheet ─────────────────────────────┐
│ Header (タイトル + 説明)            │
├──────────────┬──────────────────────┤
│ List         │ Preview              │
│ (140px md:   │ (flex-1)             │
│  200px)      │                      │
│              │                      │
│ [SharePlanCard]                     │
│ [SharePlanCard]                     │
│              │                      │
├──────────────┴──────────────────────┤
│ Footer (件数 - キャンセル - 取り込み)│
└─────────────────────────────────────┘
```

- **ShareImportSheet**: 単一プランでも左カラムを描画 (リストには 1 行だけ表示)。 `isBundle` の **レイアウト分岐は撤去** し、 常に flex row レイアウト。 `isBundle = items.length > 1` の値自体は Footer の「件数表示の出し分け」 にのみ残す。
- **LimitResolutionSheet**: `hidden md:block` を撤去 → mobile でも preview 表示。 mobile では preview がコンパクトに見えるよう、 max-h を min(40vh, 240px) に制限 (sheet の 90vh 内で「リスト 50% + preview 40% + footer」 が崩れない)。
- **Sheet の max-h**: ShareImportSheet / LimitResolutionSheet とも `max-h-[90vh]`。 内部の List / Preview が個別に `overflow-y-auto`。
- 単一時の Footer: 件数表示は不要 (`isBundle ? 件数 : spacer`)、 キャンセルと取り込みボタンだけ右寄せ。

### 3.2 SharePlanCard の情報拡充 (#2)

**変更前**: `title` のみ表示。

**変更後**: discriminated union で「コンテンツ名 (主) + プラン名 (副)」 の 2 行表示。

```typescript
type SharePlanCardProps = {
  contentLabel: string;     // ← 新規: コンテンツ名 (主)
  planTitle: string;        // ← 既存 title をリネーム
  isActive: boolean;
  badge?: ReactNode;
  onClickRow: () => void;
  isRedFlagged?: boolean;   // ← 新規: 上限ヒット時の赤背景フラグ
  isExiting?: boolean;      // ← 新規: 削除完了後の退場アニメフラグ
  sweepStatus?: 'idle' | 'active' | 'success' | 'failed';  // ← 新規: sweep 状態
  sweepColor?: 'blue' | 'red';  // ← 新規: 青 (取り込み) / 赤 (削除)
  children?: ReactNode;
} & CheckboxProps;
```

- **コンテンツ名取得**: `contentRegistry.getContentById(plan.contentId)` → `getPhaseName(content.name, i18n.language)` で言語フォールバック (ja → ko フォールバック含む既存ロジック)。
- **表示順**: タイトル位置 (font-bold text-app-md) に **コンテンツ名**、 subtitle 位置 (text-app-sm text-app-text-muted) に **プラン名**。 mobile 140px 幅でも truncate で潰れない。
- **赤背景**: `isRedFlagged` true のとき `bg-app-red/15 border-app-red/40` に切り替え (#4)。
- **退場アニメ**: `isExiting` true のとき motion.div で `opacity: 1 → 0, scale: 1 → 0.95, height: auto → 0` (300ms ease-in)。 LayoutGroup でリストの詰めを framer-motion 自動アニメ (#5)。

### 3.3 Sweep オーバーレイの共通化 (#3, #5)

**新規**: `src/components/SweepOverlay.tsx`

```typescript
interface SweepOverlayProps {
  status: 'idle' | 'active' | 'success' | 'failed';
  color: 'blue' | 'red';
  durationMs?: number;  // default 1200
}
```

LocalImportDialog の `renderSweep` をコンポーネント化。 LocalImportDialog 側は `<SweepOverlay status={...} color="blue" />` に置き換え。 SharePlanCard 内で `sweepStatus` が undefined でなければ render する。

**廃止**: `src/components/ShareImportProgressIndicator.tsx` ファイルごと削除。 `__tests__/ShareImportProgressIndicator.test.tsx` も削除。

**LimitResolutionSheet の 3 ステージテキスト** (`delete_progress_local_ok` 等) も廃止。 sweep 1 本に統合 (削除 stage 進行に応じて status を `active → success` に切り替え)。 失敗時は `failed` で sweep 赤継続。

### 3.4 上限ヒット時の演出 (#4)

`executeShareImport` で per_content limit を検知したときのシーケンス:

```
1. setRedFlag(planId)         // 該当カードを赤背景に切り替え
2. await sleep(800ms)          // ユーザーが「このカードが原因」と認知する間
3. setLimitContext({...})      // LimitResolutionSheet を立ち上げ
```

- 定数: `LIMIT_HIT_REVEAL_DELAY_MS = 800`
- `useShareImportFlow` に `redFlaggedPlanIds: Set<string>` state + `setRedFlag(id)` action 追加。 close 時にクリア。
- LimitResolutionSheet が解消 (`resolved`) したら、 `clearRedFlag(id)` で元の見た目に戻す → 取り込み再開。

### 3.5 シート 2 段階アニメ (#6)

野良主流 (MitigationSheet) のアニメ値:
```typescript
transition={{ type: 'spring', stiffness: 300, damping: 28 }}
```

これを ShareImportSheet と LimitResolutionSheet 両方に **統一**。 さらに `motion.div` に `layout` prop を追加することで、 内容が `loading → preview` に切り替わって高さが伸びる際、 framer-motion が自動で滑らかにアニメ。

```jsx
<motion.div
  layout                                // ← 高さ拡張アニメ
  initial={{ y: '100%' }}
  animate={{ y: 0 }}
  exit={{ y: '100%' }}
  transition={{
    type: 'spring',
    stiffness: 300,
    damping: 28,
    layout: { type: 'spring', stiffness: 300, damping: 28 },  // 高さ変化アニメも spring に揃える
  }}
>
  {/* status === 'loading' のときは短い body */}
  {/* status === 'preview' 以降は長い body */}
</motion.div>
```

**注意**: `layout` prop は子要素の position 自動アニメも引き起こすため、 sheet 直下の `motion.div` 1 個にのみ付与する。 子要素は通常の `<div>` で十分。 `transition.layout` を明示しないと layout 変化はデフォルト ease になり「ぐっと引き上がる」 spring 感が出ない。

体感の流れ:
1. **起動**: 画面外 → loading 用の短いシート (タイトル + 「読み込み中…」のみ) で停まる
2. **API 応答後**: status が `loading → preview` になり、 中身がリスト + preview + footer に拡張 → `layout` prop が高さ変化を spring アニメで滑らかにつなぐ → 「ぐっと引き上がる」 ように見える
3. **完了 / キャンセル**: y=0 → y=100% の 1 段スプリングで一発引っ込み (現状維持)

### 3.6 総上限事前判定 (#7)

`executeShareImport.ts` の冒頭でバンドル全体の事前チェック:

```typescript
export async function executeShareImport(items, ...) {
  const existingTotal = usePlanStore.getState().plans.length;
  const importTotal = items.length;
  if (existingTotal + importTotal > PLAN_LIMITS.MAX_TOTAL_PLANS) {
    const neededCount = (existingTotal + importTotal) - PLAN_LIMITS.MAX_TOTAL_PLANS;
    const decision = await new Promise(resolve =>
      onLimitHit({
        reason: 'max_total',
        contentId: null,
        neededCount,
        planId: null,
        resolve,
      })
    );
    if (decision === 'cancelled') return;
    // resolved → 削除済みなので再度件数チェック (再帰防止: 1 回のみ)
  }
  // 以下、 既存の per_content チェックループ
}
```

`LimitContext` の型拡張:
```typescript
interface LimitContext {
  reason: 'max_per_content' | 'max_total';   // ← 新規
  contentId: string | null;                  // max_total 時は null
  neededCount: number;                       // 解消に必要な削除件数
  planId: string | null;                     // max_total 時は null
  resolve: (decision: 'resolved' | 'cancelled') => void;
}
```

`LimitResolutionSheet` は `reason === 'max_total'` のとき:
- **タイトル**: `t('limit_resolution.title_total', { current, max, needed })`
  - 例 (ja): "全体上限 50 件に達しました (現在 50 件、 N 件削除してください)"
- **本文**: `t('limit_resolution.body_total', { count: neededCount })`
- **リスト**: `usePlanStore.plans` を `updatedAt` 古い順で全件表示 (= **全コンテンツ横断**)。 `targetPlans` の useMemo を `reason` で分岐:
  ```typescript
  const targetPlans = useMemo(() => {
    if (!limitContext) return [];
    const all = plans.slice().sort((a, b) => (a.updatedAt ?? 0) - (b.updatedAt ?? 0));
    if (limitContext.reason === 'max_total') return all;
    return all.filter(p => p.contentId === limitContext.contentId);
  }, [plans, limitContext]);
  ```
- SharePlanCard には `contentLabel` も含めて表示 (横断表示なので「どのコンテンツの何ていうプランか」 が分からないと選べない、 これは #2 と整合)。

### 3.7 キャンセルボタン (新規)

ShareImportSheet Footer に追加:

```jsx
<div className="px-5 py-3 ...">
  {isBundle ? <span>{件数表示}</span> : <span /* spacer */ />}
  <div className="flex items-center gap-2">
    <button onClick={close} disabled={status !== 'preview'} aria-label="...">
      {t('share_import.button_cancel')}
    </button>
    <button onClick={handleImport} disabled={selectedCount === 0 || status !== 'preview'} aria-label="...">
      {取り込みボタン文言}
    </button>
  </div>
</div>
```

LimitResolutionSheet と並びを揃える (件数 - キャンセル - 取り込み)。 `status === 'preview'` のときだけ enabled、 `loading / importing / done` では disabled。

---

## 4. i18n 変更

### 4.1 廃止キー (4 言語)

```
share_import.progress_check
share_import.progress_check_ok
share_import.progress_local
share_import.progress_local_ok
share_import.progress_local_failed
share_import.progress_server
share_import.progress_server_ok
share_import.progress_server_failed
limit_resolution.delete_progress_local
limit_resolution.delete_progress_local_ok
limit_resolution.delete_progress_server
limit_resolution.delete_progress_server_ok
limit_resolution.delete_capacity_freed
limit_resolution.delete_failed
```

### 4.2 新規キー (4 言語)

```
share_import.button_cancel             "キャンセル" / "Cancel" / "취소" / "取消"
limit_resolution.title_total           "全体上限 {{max}} 件に達しました (現在 {{current}} 件)"
limit_resolution.body_total            "{{count}} 件削除すると取り込みを再開します"
```

既存キー `limit_resolution.title_per_content` / `body` は残す (per_content 用)。

---

## 5. 型変更

### 5.1 `src/lib/shareImportTypes.ts`

```typescript
// LimitContext を拡張
export interface LimitContext {
  reason: 'max_per_content' | 'max_total';   // 新規
  contentId: string | null;                  // max_total 時は null
  neededCount: number;
  planId: string | null;                     // max_total 時は null
  resolve: (decision: 'resolved' | 'cancelled') => void;
}
```

### 5.2 `src/store/useShareImportFlow.ts`

```typescript
interface ShareImportFlowState {
  // ... 既存
  redFlaggedPlanIds: Set<string>;            // 新規
  setRedFlag: (planId: string) => void;      // 新規
  clearRedFlag: (planId: string) => void;    // 新規
}
```

`close()` 内で `redFlaggedPlanIds` を空 Set にリセット。

### 5.3 `src/components/SharePlanCard.tsx`

3.2 セクション参照。 `title` → `contentLabel` + `planTitle` にリネーム。 既存呼び出し元 (ShareImportSheet, LimitResolutionSheet) を全部書き換え。

---

## 6. テスト方針

### 6.1 既存テストの更新

| ファイル | 更新内容 |
|---|---|
| `src/components/__tests__/ShareImportSheet.test.tsx` | isBundle 撤去、 単一でも左カラム描画 assert、 キャンセルボタン assert、 button_cancel i18n key 利用 |
| `src/components/__tests__/LimitResolutionSheet.test.tsx` | mobile preview 表示 assert (`hidden md:block` 撤去確認)、 max_total モードの全件表示、 sweep 赤の表示 |
| `src/components/__tests__/SharePlanCard.test.tsx` | contentLabel + planTitle の 2 行表示、 isRedFlagged / isExiting / sweepStatus props |

### 6.2 削除するテスト

`src/components/__tests__/ShareImportProgressIndicator.test.tsx` ファイルごと削除。

### 6.3 新規テスト

- `src/components/__tests__/SweepOverlay.test.tsx` (3-4 件): status / color の組み合わせで render 確認
- `src/lib/__tests__/executeShareImport.test.ts` 既存に追加 (3 件):
  - 総上限事前判定: `existing + import > 50` のとき `onLimitHit` が `reason: 'max_total'` で呼ばれる
  - 事前判定が `cancelled` のときは何も取り込まれない
  - 事前判定が `resolved` のときは per_content ループに進む
- `src/store/__tests__/useShareImportFlow.test.ts` 既存に追加 (2 件):
  - `setRedFlag(id)` で `redFlaggedPlanIds` に追加される
  - `close()` で `redFlaggedPlanIds` がリセットされる

### 6.4 E2E (Playwright)

任意 (Phase B-1.5 同様、 実 shareId 必須なので別タスクで対応可)。

---

## 7. アニメ・タイミング定数

| 名前 | 値 | 場所 |
|---|---|---|
| `SWEEP_DURATION_MS` | 1200 | `SweepOverlay.tsx` (デフォルト) |
| `LIMIT_HIT_REVEAL_DELAY_MS` | 800 | `executeShareImport.ts` |
| Sheet spring | `stiffness: 300, damping: 28` | ShareImportSheet, LimitResolutionSheet (= MitigationSheet と統一) |
| Card exit | `opacity 1→0, scale 1→0.95, 300ms ease-in` | SharePlanCard |
| Sweep success icon drop-in | `scale 0.4→1, opacity 0→1, 360ms cubic-bezier(0.34, 1.56, 0.64, 1)` | SweepOverlay (LocalImportDialog 既存と同じ) |

---

## 8. 後方互換性

- `LimitContext` 型拡張に伴い、 既存の per_content 用呼び出し (executeShareImport 側) は `reason: 'max_per_content'` を明示的に渡すように更新。 1 ファイル修正で済む。
- `ShareImportProgressIndicator` 削除に伴う import エラーは ShareImportSheet 内のみ。 検索して全削除。
- i18n キー削除時は `pnpm tsc --noEmit` で参照漏れを検出。

---

## 9. リスクと緩和

| リスク | 緩和策 |
|---|---|
| `layout` prop が他の motion.div の position をぐらつかせる | motion.div は sheet 全体に 1 個。 子要素は通常の div で十分。 ぐらつきは sheet の高さ拡張だけに限定される |
| Sweep アニメと layout アニメが衝突する | sweep は `position: absolute` のオーバーレイ、 layout は親要素の高さ。 別レイヤなので干渉しない |
| 全コンテンツ横断リストで 50 件並ぶと長い | リストは `overflow-y-auto`、 sheet max-h-[90vh] でスクロールに任せる。 古い順なので「削除候補が見つけやすい」 性質維持 |
| キャンセルボタン押下で limitContext が残る (stuck) | `close()` 内の既存「未解決 Promise を cancelled で resolve」 ガードで対応済み |

---

## 10. 実装順序の方針 (writing-plans 用ヒント)

1. 型変更 (`shareImportTypes.ts` LimitContext) と i18n 4 言語キー追加・削除
2. `SweepOverlay.tsx` 新設 + 単体テスト
3. `SharePlanCard.tsx` props 拡張 + 単体テスト更新
4. `useShareImportFlow.ts` redFlag state 追加 + 単体テスト
5. `executeShareImport.ts` 総上限事前判定 + 赤背景 800ms シーケンス + 単体テスト
6. `LimitResolutionSheet.tsx` レイアウト統一 + max_total モード + sweep 赤
7. `ShareImportSheet.tsx` レイアウト統一 + キャンセル + layout prop
8. `LocalImportDialog.tsx` を SweepOverlay に置き換え (renderSweep 削除)
9. `ShareImportProgressIndicator.tsx` + テスト削除
10. 全 vitest PASS / tsc clean / build clean / 触らない箇所 0 行 diff 検証
11. push + Vercel デプロイ → 実機検証

---

## 11. 完了条件

- [ ] 553 vitest + 新規 PASS
- [ ] tsc --noEmit clean
- [ ] pnpm run build clean
- [ ] 触らない箇所 (§2.2) 全部 0 行 diff
- [ ] 実機検証: 単一・バンドル両方で sweep 動作 / 赤背景 + 重ねシート / max_total ヒット時の事前判定 / キャンセルボタン / 削除カードフェードアウト / シート起動 layout 拡張アニメ
