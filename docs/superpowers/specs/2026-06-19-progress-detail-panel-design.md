# 進捗詳細パネル 設計書（進捗HUDの仕上げ）

- 日付: 2026-06-19
- ブランチ: `feat/progress-tracking-hud`
- 位置づけ: 進捗HUD イテレーション2 の最後の機能。これで進捗HUDを「納得いく完成」とする。
- 関連: [2026-06-18 イテレーション2 作業ログ](../../.private/2026-06-18-progress-hud-iteration2.md) / 共有除外の敵対監査は別タスクで完了済（progress/memos は共有から除外＝個人状態は他人に渡らない）。

---

## 1. 目的とスコープ

### 解決する課題
今の記録ドロワーは「到達点を記録する」ことはできるが、**記録した点を後から見返す・整理する場所が無い**。光の道に丸が乗るだけで、「いつ・どこまで行ったか」の履歴は見られず、誤記録の個別修正や一括クリアもできない。

### この設計で作るもの
記録ドロワーの最下部の**シェブロン**から下方向に伸びる**進捗詳細パネル**。記録した到達点が**新しい順**にリスト表示され、各点に**ひとことメモ**を付けられ、**個別削除**と**全消去**ができる。これにより「進捗の一括リセット」も詳細パネルの中に自然に収まる。

### 非ゴール（今回やらない）
- スマホ記録まわりの入口再設計（ボトムシート内には詳細パネルを出すが、入口の作り替えは次フェーズ）
- 共同編集（collab）での進捗同期（次フェーズ）
- CLEAR!/👑 と 活動日数/時間 の仕様変更（現状維持。詳細パネルは「到達点の履歴」だけを扱う）

---

## 2. 確定した仕様（ユーザー承認済み・visual companion で選定）

1. **入口**: 記録ドロワー下端中央に**ゆるい角度の下向きシェブロン**（chevron B＝なだらか）。クリックで詳細パネルを開閉。開いている間はシェブロンが上向き（⌃）。右下の「↶（直前を1つ取り消す）」はそのまま残す。
2. **開き方**: ドロワーの箱が**下方向に伸びる**アニメーション（既存ドロワーのモーションと一貫）。詳細パネルの高さは**固定上限**、**リスト部分だけ内部スクロール**。
3. **リスト1行（採用＝ミニバー付き・B案）**:
   - 1行目: ●（点）＋ **フェーズ名** ＋（最高到達点の行に）「最高」バッジ ＋ **メモ**（斜体・1行省略つき／空なら「＋メモ」／クリックでその場が入力欄）
   - 2行目: **ミニ到達バー** — **％** — **日時**（右）
   - 右端ガター: **ゴミ箱アイコン**（2行ぶんの縦中央・左に細い仕切り線）。**PCはホバーで出現（ホバー時は赤）／スマホは常時表示**。
4. **メモ**: 各到達点に任意のひとことメモ。インライン編集（クリック→同じ場所が入力欄）、空にすれば消える。`ProgressPoint` に `note?` を追加。
5. **削除**:
   - 個別: ゴミ箱 → **即削除＋「元に戻す」インラインUndo**（数秒・その行の場所に表示／再挿入で復元）。
   - 全消去: フッターのボタン → **確認ダイアログ**（既存 `ConfirmDialog`・件数表示・「元に戻せません」）→ キャンセル / 全部消す。**消す範囲＝到達点の履歴だけ**（CLEAR!👑 と 活動日数/時間 は残す）。
6. **見出し/フッター**: 見出し「到達の記録 (N)」。フッターに「全消去」（中央・ゴミ箱アイコン併記）。
7. **並び順**: **新しい記録が上**（新しい順）。
8. **空状態**: 記録ゼロのとき「まだ記録がありません」＋「タイムラインの到達時間をクリックで記録」のヒント。

---

## 3. データモデルの変更

[src/types/index.ts](../../../src/types/index.ts)

```ts
export interface ProgressPoint {
    ts: number;          // 既存: 記録時刻(Date.now())。日時表示にそのまま使える
    reachedPos: number;  // 既存: 到達したタイムライン秒
    note?: string;       // ★追加: 任意のひとことメモ。未設定は undefined
}
```

- `PlanProgress` は変更なし（`{ points, cleared, activeDays?, activeHours? }`）。
- **後方互換**: `note` は optional。既存の点は `undefined` のまま安全。
- **正規化**: [normalizeProgress](../../../src/lib/progressLogic.ts) は points 配列をそのまま通すため `note` は保持される（変更不要・テストで担保）。

### プライバシー（重要・監査済みと整合）
`progress` は共有/コピー時に丸ごと除去される（`stripSharedPersonalData`）。よって**メモ(note)も含め、進捗は他人に一切渡らない**。詳細パネルのメモを増やしても共有面の新たなリスクはゼロ（監査結果と一致）。

---

## 4. ストアのアクション（[src/store/useMitigationStore.ts](../../../src/store/useMitigationStore.ts)）

既存（再利用）:
- `removeProgressPoint(index)` … 個別削除に流用。
- `recordReachedPoint(sec)` … 既存の記録。

新規:
- `setProgressPointNote(index: number, note: string): void`
  - 該当点の `note` を更新。空文字は `note` を削除（undefined 化）。collab readonly はブロック（既存パターン踏襲）。
- `clearAllProgressPoints(): void`
  - `progress.points` を `[]` にする。**`cleared` / `activeDays` / `activeHours` は触らない**。collab readonly はブロック。

> いずれも `set((state) => ({ progress: { ...state.progress, ... } }))` の既存パターンに従う（[useMitigationStore.ts:1595-1611](../../../src/store/useMitigationStore.ts#L1595) と同形）。

---

## 5. 純粋ロジック（[src/lib/progressLogic.ts](../../../src/lib/progressLogic.ts)）

新規（テスト対象）:
- `phaseAtTime(phases, sec): { name } | null`
  - `sec` を含むフェーズ（`startTime <= sec` の最後のフェーズ）を返す。フェーズが無い/前なら `null`。
- `pointPercent(reachedPos, totalSec): number`
  - `reachedPos / totalSec * 100` を 0〜100 に丸めクランプ（`computeProgressPercent` のクランプと同じ式を1点用に）。
- `formatClock(sec): string`
  - `m:ss` 整形。phaseAtTime が null のときの行ラベル（「3:45 地点」）と日時以外のフォールバックに使う。

表示ロジック:
- 行のラベル = `phaseAtTime` があれば `getPhaseName(phase.name, lang)`、無ければ `formatClock(reachedPos) + ' 地点'`。
- 行のバー/％ = `pointPercent(reachedPos, total)`（total = timelineEvents の最大 time）。
- 「最高」バッジ = `points` 中 `reachedPos` 最大の点（同値なら最初の1つ）。
- 日時 = `ts` を「今日 HH:mm / 昨日 HH:mm / M/D HH:mm」で表示する小ヘルパー（`makeDayKey` の JST 補正を流用）。

---

## 6. コンポーネント構成

新規（[src/components/progress/](../../../src/components/progress/) 配下）:
- **`ProgressDetailPanel.tsx`** … 詳細パネル本体。見出し「到達の記録(N)」＋リスト（スクロール領域）＋フッター「全消去」＋空状態。全消去の `ConfirmDialog` 制御もここ。インラインUndo（pending な削除1件）もここで保持。
- **`ProgressHistoryRow.tsx`** … 1行（B案レイアウト：フェーズ名/最高/メモ＝1行目、バー/％/日時＝2行目、右ガターのゴミ箱）。メモのインライン編集状態を内部に持つ。

> ⚠ **index の扱い（データロスト防止の要）**: 表示は新しい順だが `progress.points` は追記（時系列）順で保存される。削除/メモ更新/Undo再挿入は必ず **points 配列内の実 index** を使う（表示順インデックスをそのまま `removeProgressPoint` に渡さない）。各行に実 index を渡し、表示は `[...points].reverse()` 等で行うが操作は実 index 経由にする。

改修:
- **`ProgressRecordPanel.tsx`** … 下端中央にシェブロン（B角度）を追加。開閉 state（`detailOpen`、ローカル useState）を持ち、`<ProgressDetailPanel />` を条件レンダー。PC は箱が下に伸びる演出、スマホ（MobileBottomSheet）はシート内にリストを展開。`UndoLastPointButton`（↶）は現状維持（右下）。
- シェブロンは lucide の標準より**浅い角度**にしたいので、`polyline points="5 10.5 14 14.5 23 10.5"`（viewBox 28×24）相当の**自作 SVG**を使う（chevron B）。

再利用:
- **`ConfirmDialog`**（[src/components/ConfirmDialog.tsx](../../../src/components/ConfirmDialog.tsx)）… 全消去確認。`variant='danger'`、`title`/`message`/`confirmLabel`/`cancelLabel` を i18n で渡す。
- **`getPhaseName`** / **`useThemeStore().contentLanguage`** … フェーズ名のローカライズ（PhaseRoad と同じ）。

> 「元に戻す」トーストは既存 `showToast`（[Toast.tsx:17](../../../src/components/Toast.tsx#L17)）が**アクションボタン非対応**のため使わない。代わりに**削除した行の場所にインラインUndo帯**（「1件削除しました ・ 元に戻す」）を数秒出す方式にする（自己完結・共有Toastを改変しない）。

---

## 7. 主要インタラクション / データフロー

- **開閉**: シェブロン click → `detailOpen` トグル → パネルが下に伸びる（~220ms ease-out、リストは `max-height` 内スクロール）。記録モード（recordMode）は開閉で変えない。
- **メモ編集**: メモ（または「＋メモ」）click → その場が `<input>` に → blur/Enter で `setProgressPointNote(index, value.trim())`（空なら note 削除）。Esc で取消。
- **個別削除**: ゴミ箱 click → 削除対象 `{point, index}` を保持 → `removeProgressPoint(index)` → その行位置にUndo帯を表示（~5秒）。
  - 「元に戻す」click → 保持していた点を元の index に再挿入（`appendProgressPoint` 相当の splice）→ Undo帯を消す。
  - 5秒経過 or 別の削除 or パネル/ドロワーを閉じる → Undo確定（pending 破棄）。pending は同時に1件のみ。
- **全消去**: フッター click → `ConfirmDialog` open（message に件数）→ 確定で `clearAllProgressPoints()` → ダイアログ閉。
- **空状態**: `points.length === 0` のとき、リストの代わりにヒント文。全消去ボタンは非表示（消すものが無い）。

---

## 8. ビジュアル仕様（[.claude/rules/DESIGN.md](../../../.claude/rules/DESIGN.md) 準拠）

- 色はトークン経由（ハードコード禁止）。バー/％/点/最高バッジ＝進捗の機能色＝**青系トークン**（`--app-blue` 等。既存HUDの光の道/パルスが既に水色系で、進捗＝青は一貫）。削除＝赤トークン（`--app-red`）。
- ドロワー本体は light で白基調（既存 `--share-modal-bg`）。詳細パネルも同じ面の続きとして描く。
- ゴミ箱＝lucide `Trash2`。シェブロン＝自作 SVG（浅い角度・水色グロー）。
- 行は2行・密度高め（情報密度の哲学）。メモは1行省略（`text-overflow: ellipsis`）。
- アニメーション規約: 開閉 ~200ms ease-out、ボタン `active:scale-95`、ホバー `transition-all duration-200`。
- モック（確定）: `.superpowers/brainstorm/3666-1781850285/content/panel-assembled.html`（組み上がり）/ `row-delete-affordance.html` / `chevron-angle.html`。

---

## 9. i18n（[.claude/rules/i18n.md](../../../.claude/rules/i18n.md)・ja/en/ko/zh 必須）

新規キー（`progress.*`）:
- `detail_title`（「到達の記録」）/ 件数は `detail_title` + (N) で組む
- `add_memo`（「＋メモ」）/ `memo_placeholder`
- `clear_all`（「全消去」）
- `clear_all_confirm_title` / `clear_all_confirm_message`（「到達記録 {{count}} 件をすべて消します。元に戻せません。」）/ `clear_all_confirm_ok`（「全部消す」）
- `deleted_one`（「1件削除しました」）/ `undo`（「元に戻す」）
- `empty_title`（「まだ記録がありません」）/ `empty_hint`
- `reach_at_clock`（「{{clock}} 地点」フォールバック）
- ゴミ箱 aria-label `delete_record`（「この記録を削除」）

---

## 10. テスト（TDD）

純粋ロジック（vitest・必須）:
- `phaseAtTime`: フェーズ前/境界/最終フェーズ/フェーズ無し → 正しいフェーズ or null
- `pointPercent`: 0、total以下、total超過、total=0 → 0〜100クランプ
- `formatClock`: 0、59、60、3661 など
- `setProgressPointNote`: 設定/空文字でundefined化/範囲外indexで無変化/collab readonlyでブロック
- `clearAllProgressPoints`: points が [] / cleared・activeDays・activeHours は不変 / collab readonly でブロック
- `normalizeProgress`: note 付き points を保持（回帰）

コンポーネント挙動（最小）:
- 行: 最高バッジが最大点に付く / メモ click で input 化 / ゴミ箱 click で removeProgressPoint(index) 呼ぶ
- パネル: 全消去 click で ConfirmDialog 表示 → 確定で clearAllProgressPoints / 空状態でリスト非表示
- Undo: 削除後に再挿入で元の並びに戻る

---

## 11. エッジケース / 留意点

- **記録モード中の操作**: 詳細パネル内クリックはタイムラインに当たらないので誤記録しない。記録確定（タイムラインclick）はドロワーごと閉じる既存挙動のまま（閉じると詳細も畳む）。
- **長いメモ**: 1行省略（…）。ツールチップ等のフル表示は今回スコープ外（必要なら別途）。
- **フェーズ未定義のプラン**: 行ラベルは `formatClock + 地点` にフォールバック（クラッシュしない）。
- **モバイル**: MobileBottomSheet 内にリスト展開。ゴミ箱は常時表示。シートが既にスクロールするため、リストの内部スクロールはPC優先（モバイルはシートスクロールに委ねてよい）。
- **collab 閲覧者(readonly)**: メモ編集・削除・全消去はブロック（記録と同じガード）。
- **データロスト観点**: 進捗はアプリのUndo/Redo対象外（[useMitigationStore.ts:704](../../../src/store/useMitigationStore.ts#L704)）。削除の保険はインラインUndo（個別）と確認ダイアログ（全消去）で個別に担保する。

---

## 12. 実装順（writing-plans で詳細化）

1. 型変更（`ProgressPoint.note`）＋ 純粋ロジック（phaseAtTime/pointPercent/formatClock）＋テスト
2. ストアアクション（setProgressPointNote/clearAllProgressPoints）＋テスト
3. `ProgressHistoryRow`（行・メモ編集・ゴミ箱）＋テスト
4. `ProgressDetailPanel`（リスト・空状態・全消去 ConfirmDialog・インラインUndo）＋テスト
5. `ProgressRecordPanel` 改修（シェブロン B・開閉・PC伸長/モバイル展開）
6. i18n 4言語追加
7. ビルド（`npm run build`）＋ `vitest run` 緑確認 → 実機総点検（A/B/C/D＋4言語＋記録モードON/OFF回帰＋collab viewer）
