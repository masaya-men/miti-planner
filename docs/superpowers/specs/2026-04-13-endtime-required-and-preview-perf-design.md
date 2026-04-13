# endTime必須化 + プレビュー120fps化 設計書

## 背景

### 問題1: endTimeオプショナルによるコード散在
Phase/Label型の`endTime`がオプショナル（`endTime?: number`）のため、「実際の終了時刻」を計算するeffectiveEndTimeロジックがTimeline.tsx内に5箇所散在し、フォールバックが微妙に異なる。バグリスクが高く、コードの見通しが悪い。

### 問題2: プレビューの描画性能
開始/終了時間選択モードでのホバープレビューが`previewEndTime` React stateを経由するため、マウス移動のたびにTimeline全体が再レンダリングされる。数百行のTimelineRowにpropsが伝播し、仮想DOM diffが走る。120fps（8.3ms/フレーム）に到底収まらない。

## スコープ

1. **endTime必須化** — 型変更、マイグレーション、effectiveEndTime計算の一掃
2. **プレビュー120fps化** — React state廃止、DOM直接操作でゼロ再レンダリング

## 設計方針

- 空白期間（フェーズ間の隙間）は許容する
- 既存データはマイグレーション時に一括補完
- プレビューはReactレンダリングサイクルを完全バイパス

---

## 1. 型変更

### `src/types/index.ts`

```typescript
// Phase: endTimeを必須に
export interface Phase {
    id: string;
    name: LocalizedString;
    startTime: number;
    endTime: number;
}

// Label: endTimeを必須に
export interface Label {
    id: string;
    name: LocalizedString;
    startTime: number;
    endTime: number;
}
```

TypeScriptコンパイラが`?.`や`?? `や`!== undefined`チェックを不要と警告する箇所を順次削除。

---

## 2. マイグレーション

### `src/utils/phaseMigration.ts`

`migratePhases()`の出力で、endTimeが未定義のフェーズにendTimeを補完する：

- フェーズN（最後以外）: `endTime = phases[N+1].startTime`（次フェーズの開始時刻）
- 最終フェーズ: `endTime`を呼び出し元が指定するか、デフォルト値（fightDuration等）を使用

### `src/utils/labelMigration.ts`

`migrateLabels()`の出力で、endTimeが未定義のラベルにendTimeを補完する：

- ラベN（最後以外）: `endTime = labels[N+1].startTime`
- 最終ラベル: フェーズ終端 or タイムライン最大時刻 + 1

### テスト拡張

既存テスト（`phaseMigration.test.ts`, `labelMigration.test.ts`）に以下を追加：
- endTimeが未定義のデータ → 補完されることを検証
- 最終要素のendTime計算が正しいことを検証
- 既にendTimeを持つデータ → そのまま維持されることを検証

---

## 3. effectiveEndTime計算の一掃（Timeline.tsx）

### 箇所1-2: モーダル表示用（handlePhaseEdit / handleLabelEdit）

```typescript
// Before: 3段階フォールバック
const effectiveEndTime = phase.endTime ?? nextPhase?.startTime
    ?? (Math.max(...timelineEvents.map(e => e.time), phase.startTime) + 10);

// After: そのまま使う
const endTime = phase.endTime;
```

### 箇所3-4: フェーズ/ラベル描画用

```typescript
// Before: endTime有無で分岐 + フォールバック + nextPhaseクリップ
const endTime = phase.endTime !== undefined
    ? Math.min(phase.endTime + 1, nextPhase?.startTime ?? Infinity)
    : nextPhase?.startTime ?? (Math.max(...timelineEvents.map(e => e.time), 0) + 10);

// After: 単純な+1（inclusive→exclusive変換）のみ
const endTime = phase.endTime + 1;
```

### 箇所5: 軽減コンパクト表示

変更なし（endTimeとは無関係、軽減スキルのduration計算）。

---

## 4. Storeアクション更新（useMitigationStore.ts）

### addPhase / addLabel
新規追加時にendTimeを必ずセット：
- 次の要素が存在する場合: `endTime = 次の要素のstartTime`
- 最後の要素の場合: `endTime = fightDuration` または適切なデフォルト

### updatePhaseEndTime / updateLabelEndTime
`endTime !== undefined`のガード削除。ロジック簡素化。

### updatePhaseStartTime / updateLabelStartTime
`endTime !== undefined`のガード削除。

### 空白作成ロジック
既存: `endTime: undefined`にして空白を作る → 変更: `endTime`を明示的な値（元のstartTime）に設定して空白を表現。

---

## 5. プレビュー120fps化

### 廃止するもの
- `previewEndTime` useState（Timeline.tsx L604）
- `throttledSetPreviewEndTime` useCallback（L607-621）
- TimelineRow / MobileTimelineRowの`previewEndTime` prop
- TimelineRow内の`isHighlighted` / `isLabelHighlighted`計算
- MobileTimelineRow内の同様の計算

### 新設するもの

#### DOM直接操作のハイライト関数（Timeline.tsx内）
```typescript
const updatePreviewHighlight = useCallback((time: number | null) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // 前回のハイライトをクリア
    container.querySelectorAll('.preview-highlight')
        .forEach(el => el.classList.remove('preview-highlight'));

    if (time === null || (!timelineSelectMode && !labelSelectMode)) return;

    const mode = timelineSelectMode || labelSelectMode!;
    const min = Math.min(mode.startTime, time);
    const max = Math.max(mode.startTime, time);

    // 範囲内の行にクラスを付与
    container.querySelectorAll('[data-time-row]').forEach(el => {
        const t = Number(el.getAttribute('data-time-row'));
        if (t >= min && t <= max) {
            el.classList.add('preview-highlight');
        }
    });

    // オーバーレイ位置も直接更新
    if (overlayRef.current) {
        const offsetTime = showPreStart ? -10 : 0;
        const startTime = Math.max(Math.min(mode.startTime, time), offsetTime);
        const endTime = Math.max(Math.max(mode.startTime, time) + 1, offsetTime);
        const startY = timeToYMap.get(startTime) ?? ((startTime - offsetTime) * pixelsPerSecond);
        const endY = timeToYMap.get(endTime) ?? ((endTime - offsetTime) * pixelsPerSecond);
        const height = Math.max(0, endY - startY);
        overlayRef.current.style.top = `${startY}px`;
        overlayRef.current.style.height = `${height}px`;
        overlayRef.current.style.display = height > 0 ? 'block' : 'none';
    }
}, [timelineSelectMode, labelSelectMode, showPreStart, pixelsPerSecond]);
```

#### rAF直結のホバーハンドラ
```typescript
const handlePreviewHover = useCallback((time: number) => {
    previewEndTimeRef.current = time;
    if (previewRafRef.current === null) {
        previewRafRef.current = requestAnimationFrame(() => {
            updatePreviewHighlight(previewEndTimeRef.current);
            previewRafRef.current = null;
        });
    }
}, [updatePreviewHighlight]);
```

#### CSSクラス（`src/index.css`）
```css
/* フェーズ列のハイライト */
.preview-highlight > div:first-child {
    background-color: var(--color-blue-dim, rgba(59, 130, 246, 0.1));
}
/* ラベル列のハイライト */
.preview-highlight > div:nth-child(2) {
    background-color: var(--color-blue-dim, rgba(59, 130, 246, 0.1));
}
```

#### オーバーレイdiv
既存のpreviewEndTime依存の条件付きレンダリング → 常時レンダリング（`display: none`で非表示）のrefベース管理に変更。

### クリーンアップ
選択モード終了時（`setTimelineSelectMode(null)` / `setLabelSelectMode(null)`時）に：
- `updatePreviewHighlight(null)` を呼んで全ハイライトをクリア
- `overlayRef.current.style.display = 'none'`

---

## 6. パフォーマンス効果

| 指標 | Before | After |
|------|--------|-------|
| プレビュー1回の処理 | React再レンダリング（数ms〜数十ms） | DOM操作のみ（0.1ms以下） |
| React再レンダリング回数/ホバー | 1回（Timeline全体） | 0回 |
| TimelineRow props変更 | 全行でpreviewEndTime更新 | propsから削除、変更なし |
| 120fps対応 | 不可能（8.3ms超過） | 十分余裕あり |

---

## 7. 影響範囲

### 変更ファイル
| ファイル | 変更内容 |
|---------|---------|
| `src/types/index.ts` | Phase/Label型のendTimeを必須化 |
| `src/utils/phaseMigration.ts` | endTime補完ロジック追加 |
| `src/utils/labelMigration.ts` | endTime補完ロジック追加 |
| `src/utils/__tests__/phaseMigration.test.ts` | endTime補完のテスト追加 |
| `src/utils/__tests__/labelMigration.test.ts` | endTime補完のテスト追加 |
| `src/store/useMitigationStore.ts` | Storeアクション簡素化 |
| `src/components/Timeline.tsx` | effectiveEndTime一掃 + プレビューDOM直接化 |
| `src/components/TimelineRow.tsx` | previewEndTime prop削除、highlight計算削除 |
| `src/components/MobileTimelineRow.tsx` | previewEndTime prop削除、highlight計算削除 |
| `src/index.css` | `.preview-highlight`クラス追加 |

### 変更しないもの
- BoundaryEditModal.tsx（endTimeは呼び出し元から渡される、内部ロジック変更なし）
- Firestoreのデータ構造（読み込み時にマイグレーションで補完）
- 翻訳ファイル
