# 軽減アイコンの「左から飛んでくる」 現象修正 設計書

最終更新: 2026-05-12 セッション 16 末

## 背景

ハードリロード (Ctrl+Shift+R)、 もしくは他のページから miti ページに戻ってきた時、 軽減アイコンが画面左端 (x=0) から正位置にジャンプして見える「飛び」 現象が発生している。 ユーザーの理想は **「ページが見えた瞬間にアイコンがすでに正位置にある」** 状態 (= 飛びもアニメーションも無く静かに表示)。

### 発生条件 (実機検証済)

- **A**: ハードリロード後の初回表示 ← 発生
- **B**: 他のページから miti に戻る ← 発生
- **C**: サイドバーでプラン切替 ← **発生しない**
- **D**: ブラウザの別タブから miti タブ復帰 ← 発生しない

## 真因

`src/components/Timeline.layoutHooks.ts` の `useMeasuredMemberLayout` が **`useEffect` で memberLayout を計測**している。 React の lifecycle で `useEffect` は **paint 後**に実行されるため:

1. 1 pass 目 render: `useState(() => new Map())` の空 Map で `memberLayout` を初期化
2. `Timeline.tsx` のアイコン配置ロジックで `colStart = layout?.left ?? 0` → **colStart = 0 で描画**
3. ブラウザが画面に paint (= ユーザーには「アイコンが画面左端 x=0 に出現」 が見える)
4. paint 後に `useEffect` が実行 → `el.offsetLeft` で計測 → `setLayout`
5. 2 pass 目 render: 新 `memberLayout` で正位置へジャンプ (= 飛びの完成)

C (プラン切替) で発生しない理由は、 Timeline コンポーネントが unmount されず `memberLayout` の Map が継続的に保持されているため。 A/B は新規マウントで Map がリセットされる。

セッション 16 で `MitigationItem` に `layoutReady` prop を追加し、 `visibility: hidden` で 1 フレーム隠す対応を入れたが、 本番では Firebase 初期化 + Plan データロード等で paint タイミングが揺らぐため不安定。

## 採用設計 (案 A)

**`useEffect` を `useLayoutEffect` に変更**するだけで真因の根本治療が可能。

### なぜ useLayoutEffect で解決するか

React の lifecycle:
- `useEffect`: render → DOM 更新 → **paint** → useEffect
- `useLayoutEffect`: render → DOM 更新 → useLayoutEffect → **paint**

つまり `useLayoutEffect` 内で `setState` を呼ぶと、 React は **paint 前**に同期的に再 render を実行 → 新 state で 2 pass 目を完了 → その結果のみが paint される。

結果として:
1. 1 pass 目 render (空 Map): アイコンが colStart=0 で配置準備
2. DOM 更新 (refs attach)
3. `useLayoutEffect` 実行 → 計測 → `setState`
4. React が同期再 render (2 pass 目): 新 memberLayout で正位置に配置準備
5. **paint** (= 2 pass 目の結果のみが画面に出る)

ユーザーには 1 pass 目の「colStart=0」 状態は paint されないので見えない → **「最初から正位置」** に見える。

### 変更ファイル

`src/components/Timeline.layoutHooks.ts` の 1 箇所:

```diff
-import { useState, useEffect } from 'react';
+import { useState, useLayoutEffect } from 'react';

 export const useMeasuredMemberLayout = (...) => {
   const [layout, setLayout] = useState(...);

-  useEffect(() => {
+  useLayoutEffect(() => {
     // 計測ロジック (変更なし)
   }, [entries]);

   return layout;
 };
```

### 既存の `layoutReady` visibility 制御は保険として維持

セッション 16 で追加した `MitigationItem` の `layoutReady` prop + `visibility: hidden` ロジックはそのまま残す:

- 通常時: useLayoutEffect で 1 pass 内に layout 確定 → layoutReady=true で 2 pass paint
- エッジケース時 (例: Firebase ロード遅延 + 列構成変化等): visibility:hidden が保険として発動

paint されない 1 pass 目に `visibility:hidden` が適用されても視覚影響ゼロ。 二重防御として安全。

## パフォーマンス影響

- `useLayoutEffect` は paint を block する。 中身は **8 要素の DOM 計測のみ** (offsetLeft / offsetWidth 読込)
- 実測コスト: 1ms 未満 (= 1 フレーム 16ms から見れば誤差レベル)
- GPU compositing への影響なし
- React の警告 (`useLayoutEffect cannot be performed during server rendering`) は SSR を使っていないため無視可

## React 公式ドキュメント根拠

> If you need to perform side effects that should happen before the browser paints the screen (e.g., DOM mutations or measurements), useLayoutEffect should be used instead of useEffect.

本ケースはまさに「paint 前に DOM 計測を行いたい」 ケースで、 useLayoutEffect の教科書的適用。

## 影響範囲

- `src/components/Timeline.layoutHooks.ts` の 1 行のみ
- `Timeline.tsx` 本体は無変更
- `MitigationItem` の `layoutReady` prop は無変更 (保険として維持)
- 既存テスト 636 件は変更不要 (動作は同じ、 タイミングだけ早まる)

## 検証方法

1. **vitest 636/636 PASS** (既存テスト維持確認)
2. **tsc clean** (型エラーなし)
3. **production build ✓**
4. **本番デプロイ後の実機確認**:
   - ハードリロード後にアイコンが「すでに置かれている」 状態か (= 飛びなし)
   - 他のページから miti に戻った時も同様
   - プラン切替 / タブ切替で従来通り

## リスクと考慮事項

| リスク | 対応 |
|---|---|
| useLayoutEffect が SSR で警告を出す | LoPo は SPA、 SSR なし → 無視可 |
| 計測対象の DOM 要素が増えた場合の block 時間 | FF14 パーティ 8 人固定で増えない、 影響なし |
| `entries` の依存配列で再計測が頻発 | 既存と同じ依存配列 (= 動作は変わらない) |
| 既存 `layoutReady` visibility 制御との干渉 | 保険として維持、 通常時は発動しない |

## 却下した代替案

### 案 B: フェードイン (opacity 0 → 1)
- ユーザーの理想「すでに置かれている」 と乖離 (フェードイン期間が見える)
- 案 A で根本治療できるなら不要

### 案 C: A + B 組合せ
- ユーザーの理想「アニメなし」 と乖離
- 案 A だけで完璧に解決するため過剰

## 期待される効果

- A (ハードリロード) / B (別ページから戻る) の飛び現象が **完全に消失**
- ユーザー体験: 「ページが見えた瞬間にアイコンが正位置にある」
- パフォーマンス影響: 体感ゼロ (1ms 未満の計測コスト)
- 既存機能への副作用: なし

## 次のステップ

writing-plans skill で実装プランを作成 → 実装 → vitest/tsc/build 検証 → push。
