# 表エリアスムーズスクロール導入 設計書

**作成日**: 2026-05-11
**ステータス**: ドラフト → 承認待ち → 実装プラン作成
**前提**: 軽減表 (Timeline) のホイールスクロールがネイティブのままで「ガタつく」 体感がある。 ユーザーは別プロジェクト booklage で Lenis + 自前スプリングの組合せを実装・実機検証済。 同じ哲学を LoPo に移植する。

---

## 1. 背景と目的

### 1.1 現状の課題

1. **Timeline 縦スクロールがガタつく**: 行密度が高い軽減表で、 ホイール 1 段ごとに「カクッ」 と止まる体感が UX のリッチさを下げている。
2. **LP / その他静的ページも同様**: 完成度を上げる余地がある。
3. **サイドバー縦スクロール (コンテンツリスト)** も同様。

### 1.2 目的

PC 環境で、 全画面の縦スクロールをスルッと滑らかに減速する触り心地に統一する。 スマホ / アクセシビリティ配慮環境はネイティブ動作を維持。 booklage で実機検証済の設定値・実装を流用することで、 ゼロからチューニングする手間を省く。

### 1.3 スコープ外 (明示)

| 対象 | 理由 |
|---|---|
| Timeline 横スクロール | Lenis は基本単軸。 縦+横の二軸補間はライブラリ標準対応外、 自前で書くとコスト跳ね上がるため不採用 |
| スマホ全般 (iOS / Android) | ネイティブ慣性スクロールが既に最適。 JS で補間すると逆に UX 悪化 |
| ボトムシート全般 (MitigationSheet / ShareImportSheet / LimitResolutionSheet / LocalImportDialog / EventModal / PartySettingsModal) | 縦の長さが短く恩恵小。 Phase B-1.5 で仕上げたばかりで触るとデグレリスク |
| 共有プレビュー / ImportProgressOverlay / SharePlanCard | 最近追加した UI、 触らない |
| `prefers-reduced-motion: reduce` 環境 | アクセシビリティ尊重で全 OFF |
| 全モーダル open 中の Lenis 一時停止 | 現状 LoPo は body スクロールロックしておらず、 Lenis 導入で挙動悪化しない。 必要になれば後付け可 |
| 動的なウィンドウサイズ変更時の再判定 | 現実にユーザーが PC ⇄ スマホ幅を切替える場面が稀、 YAGNI |

---

## 2. スコープ (触る箇所 / 触らない箇所)

### 2.1 触る箇所

| 領域 | 内容 |
|---|---|
| 新規 `src/lib/scroll/useSmoothScroll.ts` | booklage の同名ファイルをほぼコピー (Lenis 起動 hook、 `'use client'` 削除のみ調整)、 ~40 行 |
| 新規 `src/lib/scroll/useSmoothWheelScroll.ts` | booklage の同名ファイルをコピー + 「外部 scrollTop 変動検知 → 内部 state リセット」 10 行追加、 ~130 + 10 行 |
| `src/App.tsx` | 全 Route の最上位コンポーネント (`Routes` を持つ App) で `useSmoothScroll()` を 1 行呼ぶ。 これで LP / /miti / /support / /privacy / /terms / /commercial / /housing / /admin すべてに Lenis が効く |
| `src/components/Timeline.tsx` | `scrollContainerRef` に `useSmoothWheelScroll(scrollContainerRef)` を 1 行追加 |
| `src/components/Sidebar.tsx` | 4 か所の `flex-1 overflow-y-auto` div それぞれに `useRef` + `useSmoothWheelScroll(ref)` 適用 |
| `package.json` | `lenis` 依存追加 (1 行) |

### 2.2 触らない箇所 (0 行 diff 維持)

| 領域 | 理由 |
|---|---|
| すべてのボトムシート / モーダル | スコープ外 (1.3 参照) |
| 既存 `window.scrollTo` 3 か所 (Layout / LegalPage) | Lenis の自動 hijack で挙動互換 |
| 既存 `scrollIntoView` 4 か所 (LocalImportDialog / PartySettingsModal / TutorialOverlay / TypewriterFill) | モーダル内 overflow で完結 or 影響範囲限定 |
| Timeline 内 `scrollContainerRef.current.scrollTo({behavior:'smooth'})` 多数 | 自前スプリングは wheel のみ捕捉、 JS scrollTo は素通り。 外部 scrollTop 変動検知で自前 state 整合性も保つ |
| `handleScrollSync` (Timeline スクロールイベント受け) | scroll イベントは Lenis / 自前スプリング両方とも発火するので動作互換 |
| `usePlanStore`, `planService`, `silentCompressStale`, `checkPlanLimit`, `buildShareImportItems`, `MitigationSheet`, `LocalImportDialog`, `ShareImportSheet`, `LimitResolutionSheet`, `useShareImportFlow` | スクロール導入と無関係 |

---

## 3. 設計詳細

### 3.1 全体構成

```
┌────────────────────────────────────────────────────┐
│  App.tsx (Routes の親 = 全ページ最上位)             │
│  └── useSmoothScroll()  ← Lenis (document mode)     │
│                                                     │
│  /miti, /lp, /support, /privacy, /terms, /commercial│
│  /housing, /admin など全ページのウィンドウ縦が補間   │
│                                                     │
│  ┌──────────────┐  ┌──────────────────────────┐   │
│  │ Sidebar      │  │ Timeline                  │   │
│  │ ├ overflow A │  │ scrollContainerRef       │   │
│  │ ├ overflow B │  │ useSmoothWheelScroll(ref) │   │
│  │ ├ overflow C │  │ ※ 横はネイティブ維持       │   │
│  │ └ overflow D │  │                           │   │
│  │ 各 ref ごとに │  └──────────────────────────┘   │
│  │ useSmoothWheel│                                  │
│  │ Scroll(ref)   │                                  │
│  └──────────────┘                                  │
└────────────────────────────────────────────────────┘
```

### 3.2 `useSmoothScroll` (Lenis 起動 hook)

**ロジック**:
1. `isSmoothScrollSupported()` で PC + 非 reduce-motion 環境かチェック → false なら早期 return (Lenis 起動せず)
2. `new Lenis({ duration: 1.2, easing: easeOutExpo, touchMultiplier: 2 })`
3. `requestAnimationFrame` ループで `lenis.raf(time)` を毎フレーム呼ぶ
4. unmount 時に `lenis.destroy()` で cleanup

**設定値 (booklage 流用)**:
- `duration: 1.2` (秒)
- `easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t))` (easeOutExpo)
- `touchMultiplier: 2` (タッチ環境で動かない設定だが念のため booklage と同値)
- `wheelMultiplier`: デフォルト 1
- `lerp`: 未指定 (duration mode)

### 3.3 `useSmoothWheelScroll` (自前スプリング hook)

**ロジック (booklage 由来)**:
1. `isSmoothScrollSupported()` で PC + 非 reduce-motion 環境かチェック → false なら早期 return
2. `wheel` イベント listener を `{ passive: false }` で element に attach
3. ホイール発生時、 `deltaY` を `targetDy` accumulator に積算
4. `requestAnimationFrame` で critical-damped spring を 1 ステップずつ計算 → `el.scrollTop` を更新
5. **`deltaX` は無視** → 横スクロールはネイティブ動作
6. 境界 (`scrollTop=0` で deltaY<0、 または `scrollTop=max` で deltaY>0) では `preventDefault` を呼ばず、 親に伝播
7. **LoPo 追加**: scroll イベントで `el.scrollTop` の急変 (>10px / 想定外の jump) を検知したら内部 spring state をリセット → JS 経由の `scrollTo({behavior:'smooth'})` との干渉防止

**設定値 (booklage 流用)**:
- `stiffness: 200` (Sidebar / Timeline 共通)
- `damping: 2 * sqrt(stiffness)` (critical = 振動なし)
- `MAX_DT: 0.05` (秒、 60Hz 想定で 3 フレーム以内に clamp)

### 3.4 純粋関数の切り出し

テスト容易性のため、 hook 内部から 3 つの純粋関数を切り出す:

| 関数 | シグネチャ | 役割 |
|---|---|---|
| `isSmoothScrollSupported(win: Window)` | `Window → boolean` | matchMedia で PC + 非 reduce-motion 環境か判定 |
| `isAtScrollBoundary(scrollTop, scrollHeight, clientHeight, deltaY)` | `4 numbers → 'top' | 'bottom' | null` | 境界判定 (preventDefault 通すかどうか) |
| `springStep(state, dt, stiffness, damping)` | `SpringState, 3 numbers → { state, atRest }` | スプリング 1 ステップ計算 |

これらは `src/lib/scroll/smoothScrollLogic.ts` に切り出して個別 vitest で検証。

### 3.5 PC/スマホ判定の詳細

```ts
function isSmoothScrollSupported(win: Window): boolean {
  if (typeof win.matchMedia !== 'function') return false;  // SSR / 古い環境
  if (win.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  if (!win.matchMedia('(hover: hover) and (pointer: fine)').matches) return false;
  return true;
}
```

- ✅ デスクトップ PC / ノート PC / トラックパッド付 Mac → true
- ✅ Surface などタッチ + マウス両対応 PC → true
- ❌ iPhone / iPad / Android スマホ → false
- ❌ OS 「視差効果を減らす」 ON 環境 → false

判定は hook 初期化時 1 回のみ実行。 後からウィンドウサイズを変えても再判定しない (YAGNI)。

### 3.6 既存 `scrollTo` / `scrollIntoView` との互換性

| 場所 | 種別 | 動作 |
|---|---|---|
| `Layout.tsx:120/133`, `LegalPage.tsx:308` | `window.scrollTo(0, 0)` (即時) | Lenis が `window.scrollTo` を自動 hijack → 即時ジャンプ |
| `LocalImportDialog.tsx:161`, `PartySettingsModal.tsx:454` | `scrollIntoView({behavior:'smooth'})` (モーダル内) | モーダル内 overflow で完結、 影響なし |
| `Sidebar.tsx:1630` | `scrollIntoView({behavior:'smooth'})` (Sidebar 内) | Sidebar は自前スプリング対象。 native `scrollIntoView` で scrollTop 急変 → スプリング内 scroll イベント検知で state リセット |
| `Timeline.tsx 複数か所` | `scrollContainerRef.current.scrollTo({top, behavior:'smooth'})` | 同じく自前スプリング対象、 同じ仕組みで干渉回避 |
| `tutorial/TutorialOverlay.tsx:154`, `TypewriterFill.tsx:126` | `scrollIntoView({behavior:'smooth'})` (各種要素) | 大半は Timeline / Sidebar 内、 上記と同様に state リセットでカバー。 window スクロール伴う場合は Lenis 経由で動作 |

「外部 scrollTop 変動検知 → state リセット」 は次のように動く:

```ts
// spring step が scrollTop を書く度に lastAppliedScrollTop を更新する。
// scroll イベントで現在値が lastAppliedScrollTop と乖離していれば
// = 自分以外 (native scrollTo / scrollIntoView) が書き換えた、 と判定。
let lastAppliedScrollTop = el.scrollTop;
const onScroll = () => {
  const current = el.scrollTop;
  if (Math.abs(current - lastAppliedScrollTop) > 10) {
    stateRef.current = { targetDy: 0, velY: 0, lastTime: 0 };
  }
  lastAppliedScrollTop = current;
};
el.addEventListener('scroll', onScroll, { passive: true });
```

### 3.7 バンドルサイズ影響

- `lenis` パッケージ: gzip 3KB 程度
- 自前スプリング: 140 行のソース、 gzip 1KB 未満
- 合計影響: 4KB 程度 = 誤差レベル

---

## 4. テスト戦略

### 4.1 純粋関数 vitest (新規 14 件)

| 関数 | テスト件数 | 内容 |
|---|---|---|
| `isSmoothScrollSupported` | 5 件 | PC環境 / スマホ環境 / reduce-motion ON / matchMedia 未対応 / PC+reduce-motion |
| `isAtScrollBoundary` | 5 件 | top で上向き / bottom で下向き / 中間 / max<=0 (スクロール不能) / 境界ちょうど |
| `springStep` | 4 件 | 通常更新 / 静止判定 (atRest true) / dt clamp (>MAX_DT) / 0 入力で no-op |

### 4.2 Hook 統合テスト (新規 5 件)

| Hook | テスト件数 | 内容 |
|---|---|---|
| `useSmoothScroll` | 2 件 | reduce-motion で Lenis 未生成 / 通常時 cleanup で destroy 呼ばれる |
| `useSmoothWheelScroll` | 3 件 | wheel で scrollTop 変化 / 境界で preventDefault 呼ばない / 外部 scrollTop 急変で state リセット |

### 4.3 既存 589 件への影響

- 全件 PASS 維持 (触らない)
- 新規 19 件追加 → 計 608 件目安

### 4.4 必要 mock

- `window.matchMedia`: jsdom で未実装 → vitest setup で polyfill (既存 `vitest.setup.ts` に追加)
- `Lenis` クラス: 実物使用 (軽量、 mock 不要)
- `requestAnimationFrame`: vitest fake timers + `advanceTimersByTime`

### 4.5 実機検証チェックリスト (Vercel デプロイ後にユーザーが試す)

1. LP をホイールでスクロール → スルッと減速、 着地が滑らか
2. /miti でサイドバーをホイール → 同上
3. /miti で Timeline をホイール → 同上 (縦のみ)
4. Timeline をトラックパッド横スワイプ → ネイティブ動作、 変化なし (横は補間しない)
5. /miti でボトムシート (MitigationSheet 等) を開いてホイール → 元の挙動のまま、 シート内縦スクロールはネイティブ
6. iPhone Safari / Android Chrome で全画面 → ネイティブ慣性のまま、 変化なし
7. OS 「視差効果を減らす」 を ON → 全画面でネイティブ、 アニメなし
8. Timeline でイベント中心スクロール (再生ボタン、 tutorial 等) → 既存挙動互換
9. ページ遷移 (LP → /miti、 /miti → /support) → scrollTop が即時 0 に戻る (既存挙動互換)
10. PC のホイールを高速回転 → 短時間で目的の行に到達、 「待たされ感」 なし

---

## 5. リスクと対策

| リスク | 確率 | 影響度 | 対策 |
|---|---|---|---|
| Sidebar の 4 つの `overflow-y-auto` div で ref + hook 適用パターンが既存実装と衝突 | 低 | 中 | hook は ref が null なら何もしないので、 タブ切替で表示要素が変わっても問題なし。 実装時に動作確認 |
| 自前スプリング進行中に JS `scrollTo` が呼ばれて挙動が変 | 中 | 低 | 「外部 scrollTop 変動検知 → state リセット」 で対処済 |
| Lenis (document mode) が `framer-motion` の `layout` アニメと干渉 | 低 | 中 | LoPo の framer-motion はモーダル内のみで使われており、 document スクロールには影響しない |
| `prefers-reduced-motion` 判定漏れ | 低 | 中 (アクセシビリティ違反) | `isSmoothScrollSupported` で必ずチェック、 vitest で検証 |
| 一部の古い Android Chromium タブレットで `(hover: hover)` が誤判定 | 低 | 低 | 動かないだけで悪化はしない。 ユーザー報告あれば後付け対応 |
| Vite HMR で Lenis インスタンスがリークする | 低 | 低 | `useEffect` cleanup で `lenis.destroy()` 呼ぶ実装、 booklage で実証済 |

---

## 6. ロールバック手順

問題が発生した場合:

1. `App.tsx` の `useSmoothScroll()` 行を 1 行コメントアウト → Lenis 起動停止
2. `Timeline.tsx` / `Sidebar.tsx` の `useSmoothWheelScroll(ref)` 行をコメントアウト → 自前スプリング停止
3. これで全ページがネイティブ動作に戻る (3 か所のコメントアウトで完全ロールバック)

git revert で commit を戻すのも 1 PR 範囲なので簡単。

---

## 7. 実装プラン (writing-plans skill で詳細化予定)

おおまかな順序:

1. **Task 1**: `lenis` 依存追加 + `useSmoothScroll.ts` + `smoothScrollLogic.ts` (純粋関数) 作成 + 純粋関数の vitest
2. **Task 2**: `useSmoothWheelScroll.ts` 作成 (booklage コピー + 外部 scrollTop 変動検知追加) + 純粋関数の追加 vitest
3. **Task 3**: Hook 統合テスト (5 件)
4. **Task 4**: `App.tsx` に `useSmoothScroll()` 配線
5. **Task 5**: `Timeline.tsx` に `useSmoothWheelScroll` 配線
6. **Task 6**: `Sidebar.tsx` の 4 か所に ref + hook 配線
7. **Task 7**: vitest 全件 PASS + tsc clean + vite build success 確認
8. **Task 8**: push + Vercel デプロイ + 実機検証チェックリスト

---

## 8. 参考

- booklage 該当ファイル: `lib/scroll/useSmoothScroll.ts`, `lib/scroll/useSmoothWheelScroll.ts` (master branch)
- Lenis 公式: https://github.com/darkroomengineering/lenis
- LoPo 既存スクロール参照: [Timeline.tsx:2211-2218](../../../src/components/Timeline.tsx#L2211), [Sidebar.tsx:1284-1417](../../../src/components/Sidebar.tsx#L1284)
