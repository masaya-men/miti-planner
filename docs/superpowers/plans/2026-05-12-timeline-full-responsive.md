# タイムライン全レスポンシブ化 (C 案) 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** タイムラインの固定 px 列幅 (T/H=125 / DPS=50 等) を CSS clamp + vw + rem ベースに置き換え、 ユーザーの 1489 環境を基準値としつつ 1366 〜 3840 の全 viewport で proportionally に整った表示を実現する。

**Architecture:** 列幅・カウンタ列・PHASE/LABEL/TIME/MECHANIC ヘッダ列を全て CSS カスタムプロパティ化し、 `clamp(MIN, Nvw, MAX)` で定義。 JSX 側は `style={{ width: 'var(--col-th-w)' }}` を経由する。 軽減アイコンの px 座標が必要な箇所 (`memberLayout` / `MAX_LEFT`) は DOM 計測 (`offsetLeft` / `offsetWidth`) に切り替え、 JS 側に px ハードコーディングを残さない。 フォントとスペーシングは別フェーズで rem 化 (個人のアクセシビリティ 130% 設定を尊重)。

**Tech Stack:** React 18 + TypeScript / Tailwind v4 / CSS カスタムプロパティ + clamp() / ResizeObserver / Playwright (回帰スナップショット) / vitest

---

## Design Decisions

### アンカー viewport は 1489 (ユーザー本人)

ユーザー実環境は 27" 4K + Windows 拡縮 200% + アクセシビリティテキスト 130% = **CSS 1489 / DPR 2.58**。 既存の固定 px 値 (T/H=125 / DPS=50 等) はこの 1489 でちょうど良いバランスに調整済み。 今後の clamp() 数式は **「1489 で現在と完全一致」 を必須条件** とし、 そこから 8.395vw 換算で上下に伸縮させる。

### スケーリング戦略 — vw アンカー + clamp 境界

| viewport | 1366 | 1489 (本人) | 1920 (多数派) | 2560 (27"4K@150%) | 3840 (native) |
|----------|------|-------------|---------------|-------------------|----------------|
| 想定ユーザー像 | 1366 ノート | アクセシビリティ高めの 4K | 24" 1080p / 24"4K@200% | 27"4K@150% | 32"+ 4K native |
| T/H 列幅 | 110px (min クランプ) | 125px ← 基準 | 161px | 180px (max クランプ) | 180px |
| DPS 列幅 | 45px (min クランプ) | 50px ← 基準 | 65px | 80px (max クランプ) | 80px |

**clamp 値:**
- `--col-th-w: clamp(110px, 8.395vw, 180px)` (125 ÷ 1489 = 0.08395)
- `--col-dps-w: clamp(45px, 3.358vw, 80px)` (50 ÷ 1489 = 0.03358)

**注意点:**
- 1366 は LoPo がまだサポート対象としているノート PC 想定。 min は「許容できる最小」 として安全弁
- max を緩く取ると 3840 で過剰に広くなる。 180/80 は「8 人パーティが快適に並ぶ最大幅」 として決定
- DPR は CSS の vw 計算に影響しないため、 ユーザー本人 (DPR 2.58) でも 8.395vw = 125px のまま安定

### ヘッダ列も同じスケール則を適用

固定 PHASE/LABEL/TIME/MECHANIC/RAW/TAKEN 列も clamp+vw 化。 1489 基準で:

| 列名 | 現状 px (md:) | 1489 換算 vw | clamp 式 |
|------|---------------|--------------|----------|
| PHASE | 60 | 4.030vw | `clamp(48px, 4.030vw, 80px)` |
| LABEL | 50 | 3.358vw | `clamp(40px, 3.358vw, 70px)` |
| TIME | 60 | 4.030vw | `clamp(48px, 4.030vw, 80px)` |
| MECHANIC | 200 | 13.432vw | `clamp(160px, 13.432vw, 280px)` |
| RAW | 100 | 6.716vw | `clamp(80px, 6.716vw, 140px)` |
| TAKEN | 100 | 6.716vw | `clamp(80px, 6.716vw, 140px)` |

合計 (固定列, 1489): 60+50+60+200+100+100 = **570px** ← 現状の `currentLeft = 570` ハードコーディングと一致

### モバイル列はスコープ外

スマホ列 (PHASE=24 / LABEL=24 / TIME=36 / MECHANIC=flex-1 / RAW=50 / TAKEN=50) は本タスクのスコープ外。 モバイルはそもそも viewport が狭く clamp の min 域で固まる + UX が PC と異なるため、 別途検討する。 媒体クエリ `@media (min-width: 768px)` で PC 用 CSS 変数のみを切り替える。

### memberLayout の px 累積を DOM 計測に置換

[Timeline.tsx:1840-1849](src/components/Timeline.tsx#L1840-L1849) の `useMemo` は `currentLeft = 570 + Σ(widths)` で各メンバー列の left 座標を JS で累積している。 これは CSS clamp() の結果を JS が知るすべがないため矛盾する。

**新方針:**
- ヘッダー行 (`headerRef` 配下) に各メンバー列の `ref` を取得
- `useEffect` + `ResizeObserver` で `offsetLeft` / `offsetWidth` を観測
- `useState<Map<string, { left: number; width: number }>>` に格納

これにより JS は CSS clamp() の実測値を取得でき、 軽減アイコンの絶対配置 (`assignedPositions`) も正しく追従する。

### getColumnWidth の API 変更

現状 `getColumnWidth(role: string): number` を 2 関数に分割:
- `getColumnCssVar(role: string): string` — CSS expression を返す (`'var(--col-th-w)'`)
- `getMeasuredColumnWidth(memberId, memberLayout)`: メンバー固有の実測 px を返す (memberLayout の Map から取得)

軽減アイコンの `MAX_LEFT = colWidth - 24` 計算 ([Timeline.tsx:2648-2649](src/components/Timeline.tsx#L2648-L2649)) は後者を使う。

### フォント・スペーシング rem 化は Phase 2 (別タスク)

本プランの主スコープは「列幅レスポンシブ化」。 フォント (`--font-size-*` の 10/11/12px ハードコーディング) と spacing は影響範囲が広い (LP・モーダル・サイドバー全部) ため、 まずは列幅だけ完走させてから別プランで進める。

---

## File Structure

### 修正対象ファイル

| ファイル | 責務 | 変更内容 |
|---------|------|---------|
| `src/index.css` | 全体 CSS トークン定義 | `:root` に列幅 CSS 変数を追加 (PC 用 media query 内) |
| `src/utils/calculator.ts` | スキル計算 + 列幅 helper | `getColumnWidth` を `getColumnCssVar` にリネーム & API 変更。 px 数値を返さない |
| `src/components/Timeline.tsx` | タイムライン本体 | (1) JSX の `w-[Npx] md:w-[Mpx]` を全部 `style={{ width: var(--col-*) }}` に置換 (2) `memberLayout` を `useState` + `useEffect` + `ResizeObserver` に書き換え (3) `MAX_LEFT` 計算を memberLayout 実測値ベースに |
| `src/utils/__tests__/calculator.test.ts` | calculator 単体テスト | `getColumnWidth` の固定値テストを `getColumnCssVar` の CSS expression テストに置換 |

### 新規ファイル

| ファイル | 責務 |
|---------|------|
| `src/components/__tests__/Timeline.layout.test.tsx` | memberLayout の DOM 計測ロジック単体テスト (jsdom) |
| `playwright/timeline-responsive.spec.ts` | 5 viewport (1366/1489/1920/2560/3840) のスナップショット回帰 |

### 参考: 現状の列幅マップ

| 場所 | 用途 | 現状 px |
|------|------|---------|
| [Timeline.tsx:1899](src/components/Timeline.tsx#L1899) | control bar PHASE+LABEL+TIME chunk | `md:w-[170px]` |
| [Timeline.tsx:2076](src/components/Timeline.tsx#L2076) | PHASE 列 | `md:w-[60px]` |
| [Timeline.tsx:2090](src/components/Timeline.tsx#L2090) | PHASE 列 (collapsed) | `min-w-[16px] max-w-[16px]` |
| [Timeline.tsx:2112](src/components/Timeline.tsx#L2112) | LABEL 列 | `md:w-[50px]` |
| [Timeline.tsx:2125](src/components/Timeline.tsx#L2125) | LABEL 列 (collapsed) | `min-w-[16px] max-w-[16px]` |
| [Timeline.tsx:2138](src/components/Timeline.tsx#L2138) | TIME 列 | `md:w-[60px]` |
| [Timeline.tsx:2148](src/components/Timeline.tsx#L2148) | MECHANIC 列 | `md:w-[200px]` |
| [Timeline.tsx:2160](src/components/Timeline.tsx#L2160) | RAW 列 | `md:w-[100px]` |
| [Timeline.tsx:2164](src/components/Timeline.tsx#L2164) | TAKEN 列 | `md:w-[100px]` |
| [Timeline.tsx:2172](src/components/Timeline.tsx#L2172) | パーティメンバー列 (header) | inline `width: ${getColumnWidth(role)}px` |
| [Timeline.tsx:2479](src/components/Timeline.tsx#L2479) | PHASE 列 (フェーズ表示用 overlay) | `md:w-[60px]` |
| [Timeline.tsx:2532-2533](src/components/Timeline.tsx#L2532-L2533) | LABEL 列 left+w (フェーズ overlay) | `left-[60px] w-[50px]` (collapsed: `left-[16px]`) |
| [Timeline.tsx:2559-2561](src/components/Timeline.tsx#L2559-L2561) | LABEL 列 (gimmick row) | 同上 |
| [Timeline.tsx:1841](src/components/Timeline.tsx#L1841) | `currentLeft = 570` | (60+50+60+200+100+100=570) |
| [Timeline.tsx:1844](src/components/Timeline.tsx#L1844) | メンバー列幅累積 | `getColumnWidth(m.role)` |
| [Timeline.tsx:2648](src/components/Timeline.tsx#L2648) | 軽減アイコン MAX_LEFT 計算 | `getColumnWidth(member.role)` |

ボディ行 (各時間軸セル) の列幅も同じパターンで揃える必要がある (Header の class と一致しないとずれる)。 タスク中で全件 grep して洗い出す。

---

## Task 1: CSS 変数の追加

**Files:**
- Modify: `src/index.css:95-200` (ダーク `:root` ブロック)
- Modify: `src/index.css:270-380` (ライト `.theme-light` ブロック — 値は共通でも宣言は両方必要かは要確認)

- [ ] **Step 1: 現状の CSS 変数定義箇所を確認**

Run: `grep -n "font-size-base\|@media (min-width: 768px)" src/index.css | head -20`

- [ ] **Step 2: ダークテーマ `:root` ブロック内に列幅変数を追加**

[src/index.css:95-100](src/index.css#L95) 付近の `:root, .theme-dark` ブロックに以下を **モバイルデフォルト値で** 追加 (font-size トークン群の直後あたり):

```css
/* === タイムライン列幅トークン (1489 基準で 8.395vw / 4.030vw / 3.358vw) === */
/* モバイル既定値 — 768px 未満ではこの px がそのまま使われる */
--col-phase-w: 24px;
--col-label-w: 24px;
--col-time-w: 36px;
--col-mechanic-w: 100%; /* モバイルは flex-1 相当 */
--col-counter-w: 50px;  /* RAW / TAKEN 共通 */
--col-th-w: 0px;        /* モバイルではパーティ列を表示しない */
--col-dps-w: 0px;
--col-member-start: 0px; /* メンバー列の開始 left */
--col-phase-collapsed-w: 16px;
--col-label-collapsed-w: 16px;
```

- [ ] **Step 3: PC 用 (`min-width: 768px`) media query 内で上書き**

`src/index.css` の末尾、 もし既存の `@media (min-width: 768px)` ブロックがあればそこへ、 なければ新規追加 (グローバルスタイルとして `:root` を上書き):

```css
@media (min-width: 768px) {
  :root,
  .theme-dark,
  .theme-light {
    --col-phase-w: clamp(48px, 4.030vw, 80px);
    --col-label-w: clamp(40px, 3.358vw, 70px);
    --col-time-w: clamp(48px, 4.030vw, 80px);
    --col-mechanic-w: clamp(160px, 13.432vw, 280px);
    --col-counter-w: clamp(80px, 6.716vw, 140px);
    --col-th-w: clamp(110px, 8.395vw, 180px);
    --col-dps-w: clamp(45px, 3.358vw, 80px);
    /* メンバー列開始位置 = PHASE + LABEL + TIME + MECHANIC + RAW + TAKEN */
    --col-member-start: calc(var(--col-phase-w) + var(--col-label-w) + var(--col-time-w) + var(--col-mechanic-w) + var(--col-counter-w) + var(--col-counter-w));
    --col-phase-collapsed-w: 16px;
    --col-label-collapsed-w: 16px;
  }
}
```

注意: ライトテーマも同じ値を共有するため、 `.theme-light` も含める。 ダーク・ライトで列幅を変える必要は今のところない。

- [ ] **Step 4: ビルドで構文エラーがないこと確認**

Run: `rtk npm run build 2>&1 | tail -30`
Expected: 既存と同じ「✓ built in NNms」 出力。 CSS エラーなし

- [ ] **Step 5: コミット**

```bash
rtk git add src/index.css
rtk git commit -m "$(cat <<'EOF'
feat(css): タイムライン列幅トークン (clamp+vw) を index.css に追加

- PC (md:): 1489 基準で 8.395vw / 4.030vw / 3.358vw / 6.716vw / 13.432vw
- 軽減/MECHANIC は clamp(min, Nvw, max) で 1366-3840 を快適にカバー
- モバイル既定値はモバイルレイアウト維持のため固定 px のまま
- メンバー列開始 --col-member-start も calc() で計算

これ自体ではまだ JSX は未差し替えのため見た目は無変化。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: calculator.ts の API 変更

**Files:**
- Modify: `src/utils/calculator.ts:20-24`
- Test: `src/utils/__tests__/calculator.test.ts:121-130`

- [ ] **Step 1: 失敗するテストを書く (TDD)**

[src/utils/__tests__/calculator.test.ts:121-130](src/utils/__tests__/calculator.test.ts#L121) を全面差し替え:

```typescript
describe('getColumnCssVar', () => {
  it('タンクは var(--col-th-w) を返す', () => {
    expect(getColumnCssVar('tank')).toBe('var(--col-th-w)');
  });

  it('ヒーラーは var(--col-th-w) を返す', () => {
    expect(getColumnCssVar('healer')).toBe('var(--col-th-w)');
  });

  it('DPS (および未知ロール) は var(--col-dps-w) を返す', () => {
    expect(getColumnCssVar('dps')).toBe('var(--col-dps-w)');
    expect(getColumnCssVar('unknown')).toBe('var(--col-dps-w)');
  });
});
```

import 文も `getColumnWidth` → `getColumnCssVar` に置換。

- [ ] **Step 2: テストが失敗することを確認**

Run: `rtk npx vitest run src/utils/__tests__/calculator.test.ts`
Expected: `getColumnCssVar is not exported` でテストファイル全体が import エラー

- [ ] **Step 3: calculator.ts を変更**

[src/utils/calculator.ts:20-24](src/utils/calculator.ts#L20) を以下に差し替え:

```typescript
// CSS expression for column widths (defined in src/index.css)
export const getColumnCssVar = (role: string): string => {
    if (role === 'tank' || role === 'healer') return 'var(--col-th-w)';
    return 'var(--col-dps-w)';
};
```

旧 `getColumnWidth` は **削除しない**。 代わりに deprecated 注釈を付けて当面残し、 後続タスクで全呼び出しを置換していく:

```typescript
/**
 * @deprecated Use getColumnCssVar for CSS, or measured layout from memberLayout for px.
 * px 累積に依存していたコードを段階的に移行するため当面残置。
 */
export const getColumnWidth = (role: string): number => {
    if (role === 'tank' || role === 'healer') return 125;
    return 50;
};
```

- [ ] **Step 4: テスト通過確認**

Run: `rtk npx vitest run src/utils/__tests__/calculator.test.ts`
Expected: PASS (getColumnCssVar 3 件 + 既存 getColumnWidth 互換テストも残す場合は計 5 件)

旧 `getColumnWidth` の互換テストも残すなら [calculator.test.ts:121-130](src/utils/__tests__/calculator.test.ts#L121) はそのままにし、 新テストを追記する形にする。 deprecated 注釈との一貫性を保つには互換テストは削除しても可。 判断: **削除して新テストだけにする** (deprecated 関数を積極的にテスト維持する理由がない)。

- [ ] **Step 5: コミット**

```bash
rtk git add src/utils/calculator.ts src/utils/__tests__/calculator.test.ts
rtk git commit -m "$(cat <<'EOF'
feat(calculator): getColumnCssVar 追加 + getColumnWidth deprecated

- 新 getColumnCssVar(role): CSS 'var(--col-th-w)' / 'var(--col-dps-w)' を返す
- 旧 getColumnWidth(role): @deprecated 注釈付きで残置 (Timeline.tsx の段階移行用)
- テスト 3 件 PASS、 旧テスト削除

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Timeline.tsx 固定列の JSX 移行 (ヘッダー + コントロールバー)

**Files:**
- Modify: `src/components/Timeline.tsx:1897-1899` (control bar 170px chunk)
- Modify: `src/components/Timeline.tsx:2076-2167` (header PHASE/LABEL/TIME/MECHANIC/RAW/TAKEN 列)
- Modify: `src/components/Timeline.tsx:2169-2209` (パーティメンバー列 header)

- [ ] **Step 1: control bar の 170px chunk を CSS 変数化**

Task 1 で `--col-member-start` を `calc(var(--col-phase-w) + var(--col-label-w) + var(--col-time-w) + var(--col-mechanic-w) + var(--col-counter-w) + var(--col-counter-w))` として定義済みだが、 control bar は MECHANIC + counter を含まないため、 専用変数を Task 1 に追加: `--col-header-chunk-w` (PHASE+LABEL+TIME 合計)。

まず [src/index.css](src/index.css) の `@media (min-width: 768px) :root` ブロックに追記:

```css
--col-header-chunk-w: calc(var(--col-phase-w) + var(--col-label-w) + var(--col-time-w));
```

モバイル側 `:root` にもデフォルト:
```css
--col-header-chunk-w: 30px;  /* モバイル既定値 */
```

そして [Timeline.tsx:1899](src/components/Timeline.tsx#L1899) を以下に置換:

```tsx
<div className="w-[var(--col-header-chunk-w)] min-w-[var(--col-header-chunk-w)] flex-none flex items-center px-1 md:px-2 h-full">
```

旧 `w-[30px] min-w-[30px] md:w-[170px] md:min-w-[170px]` を 1 変数に圧縮。 Tailwind v4 では `w-[var(--col-header-chunk-w)]` という arbitrary value 内 CSS 変数参照が標準サポートされている。

- [ ] **Step 2: header PHASE 列を置換**

[Timeline.tsx:2076](src/components/Timeline.tsx#L2076) と [Timeline.tsx:2090](src/components/Timeline.tsx#L2090):

```tsx
{/* expanded */}
className={`${mobileLabelInPhaseSlot ? 'hidden md:flex' : 'flex'} w-[24px] min-w-[24px] md:w-[var(--col-phase-w)] md:min-w-[var(--col-phase-w)] md:max-w-[var(--col-phase-w)] flex-none border-r ...`}

{/* collapsed */}
className="w-[var(--col-phase-collapsed-w)] min-w-[var(--col-phase-collapsed-w)] max-w-[var(--col-phase-collapsed-w)] flex-none border-r ..."
```

旧 `md:w-[60px] md:min-w-[60px] md:max-w-[60px]` を `md:w-[var(--col-phase-w)] md:min-w-[var(--col-phase-w)] md:max-w-[var(--col-phase-w)]` に書き換え。 collapsed の `w-[16px] min-w-[16px] max-w-[16px]` は `var(--col-phase-collapsed-w)` に。

- [ ] **Step 3: header LABEL 列を置換**

[Timeline.tsx:2112](src/components/Timeline.tsx#L2112):
- 旧 `md:w-[50px] md:min-w-[50px] md:max-w-[50px]` → `md:w-[var(--col-label-w)] md:min-w-[var(--col-label-w)] md:max-w-[var(--col-label-w)]`

[Timeline.tsx:2125](src/components/Timeline.tsx#L2125) (collapsed):
- 旧 `w-[16px] min-w-[16px] max-w-[16px]` → `w-[var(--col-label-collapsed-w)] min-w-[var(--col-label-collapsed-w)] max-w-[var(--col-label-collapsed-w)]`

- [ ] **Step 4: header TIME 列を置換**

[Timeline.tsx:2138](src/components/Timeline.tsx#L2138):
- 旧 `md:w-[60px] md:min-w-[60px] md:max-w-[60px]` → `md:w-[var(--col-time-w)] md:min-w-[var(--col-time-w)] md:max-w-[var(--col-time-w)]`

- [ ] **Step 5: header MECHANIC 列を置換**

[Timeline.tsx:2148](src/components/Timeline.tsx#L2148):
- 旧 `md:w-[200px] md:min-w-[200px] md:max-w-[200px]` → `md:w-[var(--col-mechanic-w)] md:min-w-[var(--col-mechanic-w)] md:max-w-[var(--col-mechanic-w)]`

- [ ] **Step 6: header RAW / TAKEN 列を置換**

[Timeline.tsx:2160](src/components/Timeline.tsx#L2160), [Timeline.tsx:2164](src/components/Timeline.tsx#L2164) (2 箇所同じパターン):
- 旧 `w-[50px] min-w-[50px] md:w-[100px] md:min-w-[100px] md:max-w-[100px]` → `w-[var(--col-counter-w)] min-w-[var(--col-counter-w)] md:w-[var(--col-counter-w)] md:min-w-[var(--col-counter-w)] md:max-w-[var(--col-counter-w)]`

注意: モバイル `--col-counter-w` が `50px`、 PC は `clamp(...)` の値となるため、 同じ変数で両 viewport を吸収できる (Step 1 で設定済み)。

- [ ] **Step 7: パーティメンバー列 header を置換**

[Timeline.tsx:2172](src/components/Timeline.tsx#L2172):
- 旧 `style={{ width: '${getColumnWidth(member.role)}px', minWidth: ..., maxWidth: ... }}` → `style={{ width: getColumnCssVar(member.role), minWidth: getColumnCssVar(member.role), maxWidth: getColumnCssVar(member.role) }}`

import 文の追加 (上部):
```tsx
import { getColumnCssVar } from '../utils/calculator';
```

旧 `getColumnWidth` import は **残す** (Task 4 まで他箇所で使う)。

- [ ] **Step 8: ボディ行 (ベース行 + ベース overlay) の固定列を置換**

[Timeline.tsx:2479](src/components/Timeline.tsx#L2479) (PHASE 列 overlay):
- 旧 `md:w-[60px]` → `md:w-[var(--col-phase-w)]`

[Timeline.tsx:2532-2533](src/components/Timeline.tsx#L2532-L2533), [Timeline.tsx:2559-2561](src/components/Timeline.tsx#L2559-L2561) (LABEL 列 left+w 計算):

```tsx
{/* 旧 */}
? `hidden md:block ${phaseColumnCollapsed ? 'left-[16px]' : 'left-[60px]'} w-[50px]`
{/* 新 */}
? `hidden md:block ${phaseColumnCollapsed ? 'left-[var(--col-phase-collapsed-w)]' : 'left-[var(--col-phase-w)]'} w-[var(--col-label-w)]`
```

collapsed の `md:left-[16px]` → `md:left-[var(--col-phase-collapsed-w)]`、 `md:left-[60px]` → `md:left-[var(--col-phase-w)]`、 `md:w-[50px]` → `md:w-[var(--col-label-w)]` を全件置換。

- [ ] **Step 9: ボディ行に同じ列構造が出てこないか grep で確認**

Run: `grep -n 'w-\[60px\]\|w-\[50px\]\|w-\[200px\]\|w-\[100px\]\|w-\[125px\]\|w-\[170px\]\|left-\[60px\]\|left-\[16px\]' src/components/Timeline.tsx`

ヒットした箇所すべてが Step 2-8 で対応済みか確認。 漏れがあれば追加で置換。

- [ ] **Step 10: ビルド + vitest + 手動目視**

```bash
rtk npm run build 2>&1 | tail -10
rtk npx vitest run 2>&1 | tail -10
```

Expected: build PASS、 633/633 PASS

ブラウザ確認: 開発サーバ起動 (`rtk npm run dev`) → ブラウザで以下を chrome devtools の responsive モードで切替:

| viewport | tank 列実測 | DPS 列実測 |
|----------|-------------|-------------|
| 1366 × 768 | 約 114px (clamp min 寄り) | 約 46px (clamp min 寄り) |
| 1489 × 800 | **125px** (基準値、必須) | **50px** (基準値、必須) |
| 1920 × 1080 | 約 161px | 約 65px |
| 2560 × 1440 | 180px (max でクランプ) | 約 86px → 80px (max) |
| 3840 × 2160 | 180px (max) | 80px (max) |

**致命検証ポイント**: 1489 で 125/50 が正確に出ていれば成功。 ずれていれば clamp 式の小数点を見直す。

ただしこの時点ではまだ memberLayout が px 累積のままなので、 軽減アイコンの絶対配置が列とずれる可能性が高い。 **Task 4 まではアイコン位置のずれは想定内**。

- [ ] **Step 11: コミット (memberLayout 未対応のため作業中状態を明示)**

```bash
rtk git add src/components/Timeline.tsx
rtk git commit -m "$(cat <<'EOF'
refactor(Timeline): 固定列の JSX を CSS 変数化 (memberLayout は未着手)

- header / control bar / body overlay の w-[Npx] md:w-[Mpx] を全て var(--col-*-w) に
- パーティメンバー列 header は getColumnCssVar(role) inline style
- ボディ行の left-[60px] / left-[16px] / w-[50px] も var() に置換 (LABEL overlay)

注意: memberLayout の px 累積 (1841 行目) は次タスク。 軽減アイコンの絶対位置はまだ
1489 以外でずれる。 Task 4 完了後に同期する。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: memberLayout の DOM 計測化

**Files:**
- Modify: `src/components/Timeline.tsx:1840-1849` (memberLayout useMemo)
- Modify: `src/components/Timeline.tsx:2169-2209` (header member 列に ref 付与)
- Modify: `src/components/Timeline.tsx:2645-2649` (軽減アイコン MAX_LEFT 計算)
- Test: `src/components/__tests__/Timeline.layout.test.tsx` (新規)

- [ ] **Step 1: 失敗するテスト (jsdom + offsetLeft mock)**

`src/components/__tests__/Timeline.layout.test.tsx` を新規作成:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMeasuredMemberLayout } from '../Timeline.layoutHooks';

vi.mock('../../lib/firebase', () => ({ db: {}, auth: {}, storage: {}, analytics: Promise.resolve(null), appCheck: null }));

describe('useMeasuredMemberLayout', () => {
  let mockRefs: Map<string, { offsetLeft: number; offsetWidth: number }>;

  beforeEach(() => {
    mockRefs = new Map([
      ['MT', { offsetLeft: 570, offsetWidth: 125 }],
      ['H1', { offsetLeft: 695, offsetWidth: 125 }],
      ['D1', { offsetLeft: 820, offsetWidth: 50 }],
    ]);
  });

  it('refs から left/width を読み Map に格納', () => {
    const { result } = renderHook(() =>
      useMeasuredMemberLayout([
        { id: 'MT', el: mockRefs.get('MT') as any },
        { id: 'H1', el: mockRefs.get('H1') as any },
        { id: 'D1', el: mockRefs.get('D1') as any },
      ])
    );

    act(() => {});

    expect(result.current.get('MT')).toEqual({ left: 570, width: 125 });
    expect(result.current.get('H1')).toEqual({ left: 695, width: 125 });
    expect(result.current.get('D1')).toEqual({ left: 820, width: 50 });
  });

  it('ResizeObserver 発火で再計測', () => {
    const observers: ResizeObserverCallback[] = [];
    (global as any).ResizeObserver = class {
      constructor(cb: ResizeObserverCallback) { observers.push(cb); }
      observe() {}
      disconnect() {}
    };

    const { result } = renderHook(() =>
      useMeasuredMemberLayout([{ id: 'MT', el: mockRefs.get('MT') as any }])
    );

    // viewport change: offsetWidth が変わる
    (mockRefs.get('MT') as any).offsetWidth = 180;
    act(() => observers[0]?.([], {} as ResizeObserver));

    expect(result.current.get('MT')).toEqual({ left: 570, width: 180 });
  });
});
```

注意: `useMeasuredMemberLayout` フックを次ステップで実装する。 まずテストが失敗するのを確認。

Run: `rtk npx vitest run src/components/__tests__/Timeline.layout.test.tsx`
Expected: FAIL — `Cannot find module '../Timeline.layoutHooks'`

- [ ] **Step 2: 計測フックを新規ファイルに切り出し**

`src/components/Timeline.layoutHooks.ts` を新規作成:

```typescript
import { useState, useEffect, useRef } from 'react';

export interface MemberRefEntry {
  id: string;
  el: HTMLElement | null;
}

export interface MemberLayoutEntry {
  left: number;
  width: number;
}

/**
 * パーティメンバー列ヘッダー DOM から offsetLeft / offsetWidth を測定し、
 * ResizeObserver で viewport 変化に追従する。
 *
 * CSS clamp() で計算された列幅を JS から知るための唯一の正解パス。
 */
export const useMeasuredMemberLayout = (
  entries: MemberRefEntry[],
): Map<string, MemberLayoutEntry> => {
  const [layout, setLayout] = useState<Map<string, MemberLayoutEntry>>(() => new Map());
  const observerRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    const compute = () => {
      const next = new Map<string, MemberLayoutEntry>();
      for (const { id, el } of entries) {
        if (!el) continue;
        next.set(id, { left: el.offsetLeft, width: el.offsetWidth });
      }
      setLayout(next);
    };

    compute();

    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => compute());
    observerRef.current = ro;
    for (const { el } of entries) {
      if (el) ro.observe(el);
    }
    // 追加でウィンドウリサイズ (viewport 変化で clamp 値が動く) も観測
    window.addEventListener('resize', compute);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', compute);
    };
  }, [entries]);

  return layout;
};
```

注意: `entries` は ref が解決された後に変わる。 親で `useMemo` 化して安定参照にする必要あり。

- [ ] **Step 3: テスト通過確認**

Run: `rtk npx vitest run src/components/__tests__/Timeline.layout.test.tsx`
Expected: 2 PASS

- [ ] **Step 4: Timeline.tsx で header member 列に ref 付与**

[Timeline.tsx](src/components/Timeline.tsx) のコンポーネント先頭付近に:

```typescript
const memberHeaderRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
```

[Timeline.tsx:2169-2209](src/components/Timeline.tsx#L2169) の `sortedPartyMembers.map((member, index) => ( ... ))` の最上位 div に:

```tsx
<div
    key={member.id}
    ref={(el) => { memberHeaderRefs.current.set(member.id, el); }}
    style={{ width: getColumnCssVar(member.role), minWidth: getColumnCssVar(member.role), maxWidth: getColumnCssVar(member.role) }}
    ...
>
```

- [ ] **Step 5: memberLayout を計測ベースに置換**

[Timeline.tsx:1840-1849](src/components/Timeline.tsx#L1840) の `useMemo` を削除し、 代わりに:

```typescript
import { useMeasuredMemberLayout } from './Timeline.layoutHooks';

// sortedPartyMembers の id 配列が変わったときだけ refs を再評価
const memberRefEntries = useMemo(
    () => sortedPartyMembers.map(m => ({ id: m.id, el: memberHeaderRefs.current.get(m.id) ?? null })),
    [sortedPartyMembers],
);
const memberLayout = useMeasuredMemberLayout(memberRefEntries);
```

問題: `memberHeaderRefs.current.get(m.id)` は初回レンダリング時はまだ null。 `useEffect` 内の `compute()` が再実行されるためには ref が変わったタイミングで `setEntries` を呼ぶか、 `useLayoutEffect` で再計測する必要がある。

**シンプル化案**:
- `useMeasuredMemberLayout` の引数を refs Map にし、 子 ref callback で `setVersion(v => v + 1)` を発火する形に
- もしくは `useLayoutEffect` で `memberLayout` を `useState` 管理し、 ref が all 解決後に一度だけ計測する

設計判断: **ref callback で version state を進める方式** を採用。

```typescript
const [refVersion, setRefVersion] = useState(0);
const memberHeaderRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

// ref callback: 値が変わったら refVersion を更新
const setMemberHeaderRef = useCallback((id: string, el: HTMLDivElement | null) => {
    const prev = memberHeaderRefs.current.get(id);
    if (prev !== el) {
        memberHeaderRefs.current.set(id, el);
        setRefVersion(v => v + 1);
    }
}, []);

const memberRefEntries = useMemo(
    () => sortedPartyMembers.map(m => ({ id: m.id, el: memberHeaderRefs.current.get(m.id) ?? null })),
    [sortedPartyMembers, refVersion],
);
const memberLayout = useMeasuredMemberLayout(memberRefEntries);
```

そして JSX:
```tsx
ref={(el) => setMemberHeaderRef(member.id, el)}
```

- [ ] **Step 6: 軽減アイコン MAX_LEFT 計算を memberLayout 実測値ベースに**

[Timeline.tsx:2645-2649](src/components/Timeline.tsx#L2645) を以下に置換:

```tsx
const member = partyMembers.find(m => m.id === ownerMitigations[0]?.ownerId);
const layout = memberLayout.get(ownerMitigations[0]?.ownerId);
const colStart = layout?.left ?? 0;
const colWidth = layout?.width ?? (member?.role === 'tank' || member?.role === 'healer' ? 125 : 50); // フォールバック (初回レンダリング時)
const MAX_LEFT = colWidth - 24;
```

旧 `const colWidth = member ? getColumnWidth(member.role) : 50;` を削除し、 layout 実測値からとる。 layout 未取得時は安全なフォールバック値 (125/50) を使う。

- [ ] **Step 7: 旧 getColumnWidth import を削除**

[Timeline.tsx](src/components/Timeline.tsx) の import 文から `getColumnWidth` を除き、 `getColumnCssVar` のみにする。 (Task 2 で deprecated 注釈を付けたが、 もはや呼び出し元がなくなる。)

calculator.ts の `getColumnWidth` 自体は削除しない (公開 API なので他から呼ばれているかもしれないため Task 8 で確認後に判断)。

- [ ] **Step 8: 全 vitest + build**

```bash
rtk npx vitest run 2>&1 | tail -10
rtk npm run build 2>&1 | tail -10
```

Expected: 633+2=635 PASS、 build SUCCESS

- [ ] **Step 9: ブラウザ実測**

`rtk npm run dev` → 4 viewport で確認:

1. 1489 (本人): 軽減アイコンが列内に収まる (MAX_LEFT = 125-24 = 101 / DPS は 50-24 = 26)。 アイコン位置と列ヘッダー左端が一致する
2. 1920: tank 列 161px / DPS 65px。 アイコンが新しい列幅に追従し、 列内に収まる
3. 2560: tank 180 (max クランプ) / DPS 80 (max)
4. 1366: tank 114 / DPS 46。 アイコンも収まる

window.resize ハンドラーで動的にも追従するか devtools で width をドラッグして確認。

- [ ] **Step 10: コミット**

```bash
rtk git add src/components/Timeline.tsx src/components/Timeline.layoutHooks.ts src/components/__tests__/Timeline.layout.test.tsx
rtk git commit -m "$(cat <<'EOF'
refactor(Timeline): memberLayout を DOM 計測 (offsetLeft/Width) に置換

- useMeasuredMemberLayout フックを Timeline.layoutHooks.ts に切り出し
- ResizeObserver + window.resize で clamp() viewport 変化に追従
- 軽減アイコン MAX_LEFT 計算も layout.width 実測値ベースに
- 旧 px 累積 useMemo 削除、 旧 getColumnWidth import 削除
- jsdom テスト 2 件 (refs 読み + ResizeObserver 発火)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 旧 getColumnWidth 削除 + 全件 grep 確認

**Files:**
- Modify: `src/utils/calculator.ts` (deprecated 削除)

- [ ] **Step 1: 全リポジトリで getColumnWidth 呼び出し確認**

Run: `grep -rn 'getColumnWidth' src/ --include='*.ts' --include='*.tsx'`

期待: 1 件のみ (`calculator.ts` 内の定義行)。 もし他で呼ばれていたら個別に Task 4 と同様のパターンで置換する。

- [ ] **Step 2: 定義削除**

[src/utils/calculator.ts](src/utils/calculator.ts) から旧 `getColumnWidth` 関数 + コメントを削除。 残るのは `getColumnCssVar` のみ。

- [ ] **Step 3: tsc + vitest**

```bash
rtk npx tsc --noEmit 2>&1 | tail -10
rtk npx vitest run 2>&1 | tail -5
```

Expected: error なし、 全 PASS

- [ ] **Step 4: コミット**

```bash
rtk git add src/utils/calculator.ts
rtk git commit -m "$(cat <<'EOF'
chore(calculator): deprecated getColumnWidth 削除

Task 4 で全呼び出しを getColumnCssVar / memberLayout 実測に置換済み。
unused なので削除。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Playwright スナップショット回帰テスト

**Files:**
- Create: `playwright/timeline-responsive.spec.ts`

- [ ] **Step 1: Playwright 設定の確認**

Run: `cat playwright.config.ts 2>/dev/null | head -30 || echo "playwright config not found"`

config がない場合は、 既存の Playwright テスト構造を確認:
Run: `find . -name 'playwright*' -not -path '*/node_modules/*' 2>/dev/null | head`

- [ ] **Step 2: テストファイル作成**

`playwright/timeline-responsive.spec.ts`:

```typescript
import { test, expect, devices } from '@playwright/test';

const VIEWPORTS = [
  { name: '1366-laptop', width: 1366, height: 768, dpr: 1 },
  { name: '1489-user-actual', width: 1489, height: 679, dpr: 2.58 },
  { name: '1920-majority', width: 1920, height: 1080, dpr: 1 },
  { name: '2560-27inch-4k-150', width: 2560, height: 1440, dpr: 1.5 },
  { name: '3840-native-4k', width: 3840, height: 2160, dpr: 1 },
];

const EXPECTED_TH_WIDTH: Record<string, number> = {
  '1366-laptop': 114,        // clamp min 寄り (1366 * 0.08395 = 114.7)
  '1489-user-actual': 125,   // 基準値 (絶対に 125)
  '1920-majority': 161,      // 1920 * 0.08395 = 161.18
  '2560-27inch-4k-150': 180, // max クランプ (2560 * 0.08395 = 214.9 > 180)
  '3840-native-4k': 180,     // max クランプ
};

const EXPECTED_DPS_WIDTH: Record<string, number> = {
  '1366-laptop': 46,         // clamp min 寄り (1366 * 0.03358 = 45.87)
  '1489-user-actual': 50,    // 基準値
  '1920-majority': 64,       // 1920 * 0.03358 = 64.47
  '2560-27inch-4k-150': 80,  // max クランプ
  '3840-native-4k': 80,
};

for (const vp of VIEWPORTS) {
  test(`column widths at ${vp.name}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dpr });
    const page = await ctx.newPage();
    await page.goto('http://localhost:5173/');

    // 標準パーティ (8 人) を表示するためのプラン作成: コンテンツ未選択でも
    // useMitigationStore 初期化時にデフォルト 8 人 (MT/ST/H1/H2/D1/D2/D3/D4) が生成される。
    // ヘッダーのパーティメンバー列が描画されたら測定可能。
    await page.waitForSelector('[data-member-role="tank"]', { state: 'attached', timeout: 5000 });
    // CSS clamp() の resize 反映待ち (1 フレーム)
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r(null))));

    const tank = await page.locator('[data-member-role="tank"]').first();
    const tankBox = await tank.boundingBox();
    expect(tankBox?.width).toBeCloseTo(EXPECTED_TH_WIDTH[vp.name], 0); // ±1px 許容

    const dps = await page.locator('[data-member-role="dps"]').first();
    const dpsBox = await dps.boundingBox();
    expect(dpsBox?.width).toBeCloseTo(EXPECTED_DPS_WIDTH[vp.name], 0);

    // 1489 だけは絶対値での厳格検証
    if (vp.name === '1489-user-actual') {
      expect(tankBox?.width).toBe(125);
      expect(dpsBox?.width).toBe(50);
    }

    await page.screenshot({ path: `playwright/__screenshots__/timeline-${vp.name}.png`, fullPage: false });
    await ctx.close();
  });
}
```

注意: `data-member-role` 属性は Timeline.tsx の各メンバー列 div に新規追加が必要 (テスタビリティ目的)。

[Timeline.tsx:2169-2209](src/components/Timeline.tsx#L2169) のメンバー列 div に:
```tsx
data-member-role={member.role}
```

を追加 (まだ未実装の場合)。

- [ ] **Step 3: data-member-role 属性追加 + テスト実行**

```tsx
<div
    key={member.id}
    data-member-role={member.role}
    data-member-id={member.id}
    ref={(el) => setMemberHeaderRef(member.id, el)}
    ...
>
```

Run dev server + test:
```bash
rtk npm run dev &  # バックグラウンド
sleep 5
rtk npx playwright test timeline-responsive
```

Expected: 5 viewport の `expect(tankBox?.width).toBeCloseTo(...)` 全件 PASS。 1489 は 125/50 厳密一致

- [ ] **Step 4: コミット**

```bash
rtk git add playwright/timeline-responsive.spec.ts src/components/Timeline.tsx
rtk git commit -m "$(cat <<'EOF'
test(playwright): タイムライン列幅レスポンシブ回帰テスト

- 5 viewport (1366/1489/1920/2560/3840) で T/H / DPS 列幅を検証
- 1489 (本人環境) は 125/50 の厳密一致を必須
- data-member-role 属性を Timeline.tsx 各メンバー列に追加

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: 最終ビルド + 全テスト + 引き継ぎメモ

- [ ] **Step 1: 全テスト**

```bash
rtk npm run build 2>&1 | tail -10
rtk npx vitest run 2>&1 | tail -10
rtk npx tsc --noEmit 2>&1 | tail -10
```

Expected: 全件 PASS

- [ ] **Step 2: docs/TODO.md 更新**

[docs/TODO.md](docs/TODO.md) の「現在の状態」 セクションに以下を追記:

```markdown
- **【完了 2026-MM-DD タイムライン列幅レスポンシブ化 (C 案 第 1 弾)】**:
  - 列幅 (T/H / DPS / PHASE / LABEL / TIME / MECHANIC / RAW / TAKEN) を CSS clamp+vw 化
  - memberLayout を DOM 計測 (offsetLeft/Width + ResizeObserver) に置換
  - 1489 (本人) で 125/50 維持、 1920 で 161/65、 2560 で 180/80
  - Playwright 5 viewport 回帰テスト追加
  - 残タスク (Phase 2): フォント (--font-size-*) と spacing の rem 化
```

- [ ] **Step 3: コミット (TODO 更新分)**

```bash
rtk git add docs/TODO.md
rtk git commit -m "docs(todo): タイムライン列幅レスポンシブ化 (C 案 第 1 弾) 完了記録"
```

- [ ] **Step 4: push**

```bash
rtk git push
```

Vercel 自動デプロイされる。 デプロイ後、 ユーザー本人環境 (1489) と多数派環境 (1920) の 2 つでブラウザから動作確認。

---

## Phase 2 (別プラン) — フォント・スペーシング rem 化

本プランの完了後、 以下を別プランとして起こす:

- `--font-size-*` を `clamp(min-rem, Nvw, max-rem)` に
- 各種 padding / gap を rem に
- LP / モーダル / サイドバーへの波及確認

スコープが LoPo 全体に及ぶため、 タイムライン以外のページ (LP / マイページ / 管理画面) のスクリーンショット回帰も併せて準備する必要がある。

---

## Self-Review チェックリスト

- [x] **Spec coverage**: C 案で挙がっていた 6 つのタッチ範囲 (calculator.ts / Timeline.tsx:1840 / Timeline.tsx:2648 / フォントサイズ / spacing / calculator.test.ts) すべて Task 化済み。 フォント・spacing は Phase 2 で明示的に切り出し
- [x] **Placeholder スキャン**: TBD / TODO / implement later なし。 clamp 値は計算根拠付きで具体的に提示
- [x] **Type consistency**: `getColumnCssVar` のシグネチャ `(role: string) => string` は Task 2 / 3 で一貫。 `memberLayout` の型 `Map<string, { left: number; width: number }>` も Task 4 で統一
- [x] **モバイル考慮**: `@media (min-width: 768px)` でのみ PC 用 clamp() を適用。 既定値はモバイル固定 px のまま
- [x] **DPR 影響**: clamp + vw は CSS 論理 px ベースのため DPR の影響を受けない (本人 DPR 2.58 / 多数派 DPR 1 でも同じ計算結果)
- [x] **テスト戦略**: vitest (calculator unit / layoutHooks hook) + Playwright (viewport 別 e2e) の 2 層。 1489 厳密検証 + 他 4 viewport は ±1px tolerance

---

## 実行オプション

このプランは保存済み (`docs/superpowers/plans/2026-05-12-timeline-full-responsive.md`)。 次セッションで以下のいずれかで実行する:

**1. Subagent-Driven (推奨)** — `superpowers:subagent-driven-development` で Task ごとに fresh subagent 起動、 2 段階レビュー。 中間検証ポイントが多いため適している

**2. Inline Execution** — `superpowers:executing-plans` で同セッション内バッチ実行。 Playwright 回帰までを通しで走らせたい場合
