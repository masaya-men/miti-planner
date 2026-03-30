# パフォーマンス最適化（React.memo + Zustandセレクタ + Layout分割）設計書

> **制約: 既存の機能・UI・UXは一切変更しない。裏側の効率化のみ。**

---

## 背景

アプリ全体の動作が重い問題がある。原因は不要な再レンダリングの多発。
推定60-70%のレンダリングが無駄に行われている。

### 現状の問題

1. **React.memoがほぼ未使用** — SlotItem（PartySettingsModal内）1箇所のみ
2. **Zustandセレクタが非最適** — オブジェクト/配列の参照が毎回変わり不要な再描画を引き起こす
3. **Layout.tsxが巨大** — 980行に5ストア依存。MobileHeader(165行)、MobilePartySettings(700行)がネスト

---

## 最適化対象

### 1. React.memoでラップするコンポーネント

| コンポーネント | ファイル | 効果 |
|---|---|---|
| TimelineRow | src/components/TimelineRow.tsx | イベント1個の変更で全行再描画 → 該当行のみ |
| MitigationItem | src/components/Timeline.tsx内 | 軽減操作で全アイコン再描画 → 該当のみ |
| ContentTreeItem | src/components/Sidebar.tsx内 | プラン変更で全項目再描画 → 該当のみ |
| SaveIndicator | src/components/ConsolidatedHeader.tsx内 | 親ヘッダーの再描画に巻き込まれない |
| CheatSheetView | src/components/CheatSheetView.tsx | タイムライン操作時に巻き込まれない |

### 2. useCallback追加箇所

Timeline.tsx、Sidebar.tsx、ConsolidatedHeader.tsx内のイベントハンドラ（onClick等）で、
インライン関数 `() => ...` を `useCallback` でラップし、子コンポーネントのReact.memoが効くようにする。

### 3. Zustandセレクタ最適化

`useShallow` を使い、オブジェクト/配列セレクタの参照安定化を行う。

対象ストア:
- useMitigationStore（Timeline.tsx: 22+セレクタ）
- usePlanStore（Sidebar.tsx: plans配列）
- 各コンポーネントの複数プロパティ同時取得箇所

### 4. インラインstyleオブジェクトの安定化

Timeline.tsx、ConsolidatedHeader.tsx内の `style={{...}}` パターンを
`useMemo` で参照を安定化させる。見た目は完全に同一。

### 5. Layout.tsxの分割

| 切り出すパーツ | 切り出し先 | 行数目安 |
|---|---|---|
| MobileHeader | src/components/MobileHeader.tsx | ~165行 |
| MobilePartySettings | src/components/MobilePartySettings.tsx | ~700行 |

切り出し後もLayout.tsxから同じように呼び出す。画面構成は変わらない。

---

## やらないこと

- 見た目の変更（CSS、色、レイアウト、フォント等）
- 機能の追加・削除
- ユーザー操作フローの変更
- コンポーネントのAPI（props）変更（内部最適化のみ）
- ファイル構造の大改造（必要最小限の分割のみ）

---

## 安全策

- 各ステップ後に `npx tsc --noEmit` でビルド確認
- 全ステップ完了後に `npm run build` で本番ビルド確認
- 開発サーバーで手動動作確認（タイムライン操作、サイドバー操作、モーダル開閉等）

---

## 期待効果

- サイドバー開閉・ヘッダー操作の応答速度向上
- タイムライン上での軽減配置・移動の応答速度向上
- 全体的な操作の「もっさり感」の軽減
