# SegmentButton コンポーネント設計書

## 概要

排他選択のボタン群を、スライドする背景インジケーター + スプリングアニメーション付きのセグメントボタンに統一する。

参考: [CSSのlinear()でUIが軽快になる！スプリングアニメーション活用術](https://ics.media/entry/260402/)

## 対象箇所

### Phase 1: EventModal（3箇所）
| 箇所 | 選択肢 | アイコン | 備考 |
|---|---|---|---|
| damageType | 魔法/物理/回避不可 (3) | あり（type_*.png） | |
| target | AoE/MT/ST (3) | なし | |
| inputMode | 逆算/直接入力 (2) | あり（Calculatorアイコン） | |

### Phase 2: Sidebar（2箇所）
| 箇所 | 選択肢 | アイコン | 備考 |
|---|---|---|---|
| Level | 100/90/80/70 (4) | なし | 既にグループ化済み |
| Category | ALL+種類 (5-6, 動的) | なし | 横スクロール対応、選択肢数が動的 |

## コンポーネント設計

### ファイル配置
`src/components/ui/SegmentButton.tsx`

### Props インターフェース
```typescript
interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: string | React.ReactNode; // URL文字列またはReactコンポーネント
}

interface SegmentButtonProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;   // 外側のラッパーに追加クラス
  size?: 'sm' | 'md';   // sm: サイドバー用、md: モーダル用（デフォルト）
}
```

### HTML構造
```html
<div class="segment-wrapper">           <!-- position: relative, flex -->
  <div class="segment-indicator" />     <!-- position: absolute, スライドする背景 -->
  <button class="segment-option" />     <!-- position: relative, z-10 -->
  <button class="segment-option" />
  <button class="segment-option" />
</div>
```

### アニメーション仕組み

1. `segment-indicator` は `position: absolute` で配置
2. 幅は `width: calc(100% / オプション数)` で均等分割
3. クリック時に CSS変数 `--segment-index` を更新（0, 1, 2...）
4. `transform: translateX(calc(var(--segment-index) * 100%))` で移動
5. `transition: transform var(--duration-normal) var(--ease-spring-bouncy)` でバネ動作
6. JSはクリック時に `--segment-index` をセットするだけ。アニメーション中のJS処理はゼロ

### 使用する既存デザイントークン
```css
/* 既に index.css に定義済み — 新規追加不要 */
--ease-spring-bouncy    /* バネのイージング曲線 */
--duration-normal: 250ms /* アニメーション時間 */

/* アクセシビリティ（既に定義済み） */
@media (prefers-reduced-motion: reduce) → duration: 0ms
```

### スタイリング

**ラッパー:**
- `bg-glass-card/80 rounded-lg p-0.5 border border-glass-border` （サイドバーの既存スタイルに合わせる）

**インジケーター（スライドする背景）:**
- `bg-app-text rounded-md` （既存の選択状態スタイルと一致）
- `shadow-lg` で浮き上がり感

**ボタン（通常）:**
- `text-app-text` 、背景透明
- `cursor-pointer`

**ボタン（選択中）:**
- `text-app-bg font-bold` （インジケーター上のテキスト）
- `transition: color var(--duration-fast)` でテキスト色もスムーズに変化

## 適用方法

各箇所で既存のボタン群を `<SegmentButton>` に1:1置換する。state管理は変更しない。

### EventModal: damageType（置換前→後）
```tsx
// Before: 個別ボタン群
<div className="flex gap-1.5">
  {damageTypes.map(item => (
    <button onClick={() => setDamageType(item.type)}>...</button>
  ))}
</div>

// After: SegmentButton
<SegmentButton
  options={damageTypes.map(item => ({
    value: item.type,
    label: item.label,
    icon: item.icon,
  }))}
  value={damageType}
  onChange={setDamageType}
/>
```

### Sidebar: Level（置換前→後）
```tsx
// Before: グループ化ボタン+区切り線
<div className="flex items-center bg-glass-card/80 ...">
  {LEVEL_TIERS.map((level, i) => (
    <>
      {i > 0 && <div className="w-px h-3 ..." />}
      <button onClick={() => setActiveLevel(level)}>...</button>
    </>
  ))}
</div>

// After: SegmentButton
<SegmentButton
  options={LEVEL_TIERS.map(l => ({ value: String(l), label: String(l) }))}
  value={String(activeLevel)}
  onChange={v => setActiveLevel(Number(v) as ContentLevel)}
  size="sm"
/>
```

### Sidebar: Category
- 選択肢数が動的（5-6個）
- 横スクロール対応が必要: ラッパーに `overflow-x-auto` を維持
- `className` prop で `overflow-x-auto` を渡す

## テスト方針

- 既存のEventModalテスト、Sidebarテストが引き続きパスすることを確認
- SegmentButton単体のユニットテストは不要（表示のみのUIコンポーネント）
- ビルド成功 + 全テストパス + 目視確認で完了

## スコープ外
- AASettingsPopover のボタン群（将来的に同じコンポーネントで対応可能だが今回は含めない）
- アイコンのアニメーション（将来検討）
- サウンドフィードバック
