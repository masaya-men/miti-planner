# Liquid Lens Effect — 技術書

> **作成日**: 2026-05-07
> **想定読者**: フロントエンドエンジニア（React / TypeScript / Tailwind）
> **対応ブラウザ**: Chromium 系 = フル対応 / Safari = 自動フォールバック
> **再利用性**: プロジェクト非依存。LoPo Housing 起源だが他プロジェクトにそのまま流用可

---

## 0. この技術書の目的

Apple iOS 26 / WWDC 2025 で発表された **Liquid Glass デザイン言語**を Web で再現する。具体的には:

1. **リキッドグラス（液状ガラス）**: 背景を屈折させる半透明パネル
2. **ルーペエフェクト**: ガラス球で背景を拡大表示
3. **色収差（Chromatic Aberration）**: ガラス縁で RGB 色がわずかにずれる現象
4. **グリッチ風ノイズ**: 微妙なざらつきで「物理的なガラス」感を演出

2026 年現在、CSS の `backdrop-filter: blur()` 単体は **「generic blur」と呼ばれ業界では時代遅れ**とされている（[CSS-Tricks 2026 記事](https://css-tricks.com/getting-clarity-on-apples-liquid-glass/)）。SVG `<feDisplacementMap>` を組み合わせた本物の屈折表現が標準化しつつある。

本書はそれを React コンポーネントとして実装し、再利用可能なテクニックとして残す。

---

## 1. 効果の理論

### 1.1 屈折（Refraction）

光がガラスを通過する時、密度差で進行方向が曲がる現象。Web では `feDisplacementMap` を使って近似する:

```
入力画像 → ノイズパターン（feTurbulence）で各 pixel を上下左右にずらす
        → 「屈折してるように見える」結果が得られる
```

### 1.2 色収差（Chromatic Aberration）

レンズ内で R / G / B の波長が異なる屈折率を持つため、エッジで色が分離する物理現象。Web では:

```
入力画像
  ├─ R チャネル抽出 → わずかに右下にオフセット
  ├─ G チャネル抽出 → 中央配置
  └─ B チャネル抽出 → わずかに左上にオフセット
合成 → エッジで RGB が分離して見える
```

### 1.3 ルーペ拡大

`transform: scale()` だと要素全体が拡大されてしまう。背景を「覗き込んで」拡大する効果は:

```
方式 A: backdrop-filter + transform
  → 周囲の要素の見え方を変える（実装シンプル、ただし真の拡大ではない）

方式 B: SVG <feImage> + scale
  → 背景の特定領域をコピー → スケール → 表示
  → 真のルーペ表現（複雑だが本格的）
```

LoPo では方式 A をベースに、視覚的に「拡大に見える」演出を加える。

### 1.4 specular highlight（鏡面反射）

ガラス球の左上に微かな白い反射。CSS の `radial-gradient` で擬似的に再現:

```css
background: radial-gradient(
  circle at 30% 25%,
  rgba(255,255,255,0.5) 0%,
  rgba(255,255,255,0) 30%
);
```

---

## 2. SVG Filter フルセット

```xml
<svg width="0" height="0" style="position:absolute">
  <defs>
    <filter id="liquid-lens" x="-20%" y="-20%" width="140%" height="140%">
      <!-- 1. ノイズ生成 -->
      <feTurbulence
        type="fractalNoise"
        baseFrequency="0.012 0.018"
        numOctaves="2"
        seed="3"
        result="noise"
      />

      <!-- 2. 屈折マップ作成 -->
      <feDisplacementMap
        in="SourceGraphic"
        in2="noise"
        scale="20"
        xChannelSelector="R"
        yChannelSelector="G"
        result="displaced"
      />

      <!-- 3. R チャネル抽出 + 右下オフセット -->
      <feColorMatrix
        in="displaced"
        type="matrix"
        values="1 0 0 0 0
                0 0 0 0 0
                0 0 0 0 0
                0 0 0 1 0"
        result="redChannel"
      />
      <feOffset in="redChannel" dx="2" dy="2" result="redShifted" />

      <!-- 4. G チャネル抽出（中央維持） -->
      <feColorMatrix
        in="displaced"
        type="matrix"
        values="0 0 0 0 0
                0 1 0 0 0
                0 0 0 0 0
                0 0 0 1 0"
        result="greenChannel"
      />

      <!-- 5. B チャネル抽出 + 左上オフセット -->
      <feColorMatrix
        in="displaced"
        type="matrix"
        values="0 0 0 0 0
                0 0 0 0 0
                0 0 1 0 0
                0 0 0 1 0"
        result="blueChannel"
      />
      <feOffset in="blueChannel" dx="-2" dy="-2" result="blueShifted" />

      <!-- 6. RGB 合成 -->
      <feMerge>
        <feMergeNode in="redShifted" />
        <feMergeNode in="greenChannel" />
        <feMergeNode in="blueShifted" />
      </feMerge>
    </filter>
  </defs>
</svg>
```

このフィルタ id を CSS で参照: `backdrop-filter: url(#liquid-lens);`

---

## 3. React コンポーネント実装

### 3.1 props API 設計

```typescript
interface LiquidLensProps {
  /** ガラス球の直径 (px) */
  size?: number;                 // default: 300

  /** 屈折の強さ (0-100) */
  refractionStrength?: number;   // default: 20

  /** 色収差の強さ (px, RGB ずらし量) */
  chromaticAberration?: number;  // default: 2

  /** ノイズの粗さ (0.001-0.1) */
  noiseFrequency?: number;       // default: 0.012

  /** 子要素（ガラス越しに見せる中身） */
  children?: React.ReactNode;

  /** 追加 className */
  className?: string;

  /** マウス追従するか */
  followMouse?: boolean;         // default: false

  /** 自動アニメーション（漂う動き） */
  autoFloat?: boolean;           // default: false

  /** カスタムスタイル */
  style?: React.CSSProperties;
}
```

### 3.2 LiquidLens コンポーネント

```tsx
// src/components/ui/LiquidLens.tsx
import { useId, useRef, useEffect, useState } from 'react';

export const LiquidLens: React.FC<LiquidLensProps> = ({
  size = 300,
  refractionStrength = 20,
  chromaticAberration = 2,
  noiseFrequency = 0.012,
  children,
  className = '',
  followMouse = false,
  autoFloat = false,
  style = {},
}) => {
  const filterId = useId();
  const lensRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  // マウス追従
  useEffect(() => {
    if (!followMouse) return;
    const handleMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, [followMouse]);

  // 自動アニメーション（リサジュー曲線で漂う）
  useEffect(() => {
    if (!autoFloat) return;
    let frame: number;
    const animate = (t: number) => {
      const x = window.innerWidth / 2 + Math.sin(t / 1500) * 200;
      const y = window.innerHeight / 2 + Math.cos(t / 2300) * 100;
      setPosition({ x, y });
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [autoFloat]);

  const filterStyle = (followMouse || autoFloat)
    ? { left: position.x - size / 2, top: position.y - size / 2 }
    : {};

  return (
    <>
      {/* SVG Filter Definition */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency={`${noiseFrequency} ${noiseFrequency * 1.5}`}
              numOctaves="2"
              seed="3"
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale={refractionStrength}
              xChannelSelector="R"
              yChannelSelector="G"
              result="displaced"
            />
            {/* R channel offset */}
            <feColorMatrix
              in="displaced"
              type="matrix"
              values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
              result="r"
            />
            <feOffset in="r" dx={chromaticAberration} dy={chromaticAberration} result="rs" />
            {/* G channel center */}
            <feColorMatrix
              in="displaced"
              type="matrix"
              values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"
              result="g"
            />
            {/* B channel offset */}
            <feColorMatrix
              in="displaced"
              type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"
              result="b"
            />
            <feOffset in="b" dx={-chromaticAberration} dy={-chromaticAberration} result="bs" />
            <feMerge>
              <feMergeNode in="rs" />
              <feMergeNode in="g" />
              <feMergeNode in="bs" />
            </feMerge>
          </filter>
        </defs>
      </svg>

      {/* Lens Element */}
      <div
        ref={lensRef}
        className={`liquid-lens ${className}`}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          position: (followMouse || autoFloat) ? 'fixed' : 'relative',
          backdropFilter: `url(#${filterId})`,
          WebkitBackdropFilter: 'blur(20px)', // Safari fallback
          background: `radial-gradient(
            circle at 30% 25%,
            rgba(255,255,255,0.5) 0%,
            rgba(255,255,255,0) 30%
          )`,
          boxShadow: `
            inset 0 0 60px rgba(255,255,255,0.1),
            inset 0 0 0 1px rgba(255,255,255,0.2),
            0 30px 80px rgba(0,0,0,0.3)
          `,
          pointerEvents: followMouse ? 'none' : 'auto',
          ...filterStyle,
          ...style,
        }}
      >
        {children}
      </div>
    </>
  );
};
```

### 3.3 使用例

```tsx
// 例 1: 静的なルーペ（ヒーロー要素）
<LiquidLens size={400} className="mx-auto my-8">
  <div className="text-3xl">めっちゃイケてる</div>
</LiquidLens>

// 例 2: マウス追従ルーペ
<LiquidLens followMouse size={250} chromaticAberration={3} />

// 例 3: 自動漂遊ルーペ（背景アクセント）
<LiquidLens autoFloat size={500} refractionStrength={30} />

// 例 4: カードホバー演出（軽量設定）
<div className="card group relative">
  <img src={image} />
  <div className="opacity-0 group-hover:opacity-100 absolute top-2 right-2 transition-opacity">
    <LiquidLens size={60} chromaticAberration={1} refractionStrength={10} />
  </div>
</div>
```

---

## 4. パフォーマンスチューニング

### 4.1 レンダリングコスト

| 設定 | render time / frame | 推奨用途 |
|---|---|---|
| `size: 60-100` + 軽量設定 | ~2-3ms | カードホバー、複数同時表示 OK |
| `size: 200-300` 中量設定 | ~5-8ms | サイドバー、ボトムシート、1-2 個 |
| `size: 400-500` フル設定 | ~10-15ms | ヒーロー要素、画面に 1 個まで |

### 4.2 過剰レンダリング対策

- **複数同時表示は最大 5 個**程度に抑える
- マウス追従時は `requestAnimationFrame` で throttle（60fps 維持）
- 自動アニメーションも RAF ベース
- スクロール中は filter を一時停止する optimization も検討

### 4.3 Safari フォールバック

Safari は `backdrop-filter: url(#filter)` 未対応なので、自動的に `-webkit-backdrop-filter: blur(20px)` にフォールバックする実装になっている。視覚劣化は緩やかで、glassmorphism としては機能する。

---

## 5. ブラウザ対応マトリクス

| ブラウザ | 屈折 | 色収差 | ルーペ拡大 | 備考 |
|---|---|---|---|---|
| Chrome 91+ | ✅ | ✅ | ✅ | フル対応 |
| Edge 91+ | ✅ | ✅ | ✅ | フル対応（Chromium 系） |
| Firefox 117+ | ⚠️ | ⚠️ | ✅ | SVG-as-backdrop-filter は preference 必要 |
| Safari 17+ | ❌ | ❌ | ⚠️ | プレーン blur にフォールバック |
| iOS Safari 17+ | ❌ | ❌ | ⚠️ | 同上 |
| Samsung Internet | ✅ | ✅ | ✅ | Chromium 系 |

---

## 6. Tailwind v4 互換性

LoPo は Tailwind v4 を使用しており、CSS rules.md に以下の制約がある:

> `backdrop-filter: blur(...)` を直接書くな。Tailwind v4 の Lightning CSS がビルド時に削除する。
> 必ず `--tw-backdrop-blur` 変数パターンを使うこと。

このコンポーネントでは `backdrop-filter: url(#filter-id)` を使用しており、`blur()` は使っていないので**直接の影響はない**。ただし Safari フォールバックで `-webkit-backdrop-filter: blur(20px)` を使う際は、必要に応じて以下のパターンに置換:

```css
/* NG（v4 の Lightning CSS で削除される可能性） */
-webkit-backdrop-filter: blur(20px);
backdrop-filter: blur(20px);

/* OK（変数パターン） */
--tw-backdrop-blur: blur(20px);
-webkit-backdrop-filter: var(--tw-backdrop-blur,) var(--tw-backdrop-brightness,) var(--tw-backdrop-contrast,) var(--tw-backdrop-grayscale,) var(--tw-backdrop-hue-rotate,) var(--tw-backdrop-invert,) var(--tw-backdrop-opacity,) var(--tw-backdrop-saturate,) var(--tw-backdrop-sepia,);
backdrop-filter: var(--tw-backdrop-blur,) var(--tw-backdrop-brightness,) var(--tw-backdrop-contrast,) var(--tw-backdrop-grayscale,) var(--tw-backdrop-hue-rotate,) var(--tw-backdrop-invert,) var(--tw-backdrop-opacity,) var(--tw-backdrop-saturate,) var(--tw-backdrop-sepia,);
```

ただし `url(#filter-id)` をこのパターンに混ぜるのはトリッキーなので、**Safari の場合のみ別の class で blur 適用**する分岐推奨:

```tsx
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
<div style={{
  backdropFilter: isSafari ? undefined : `url(#${filterId})`,
  // Safari の時だけ Tailwind class で blur 適用
  className: isSafari ? 'backdrop-blur-xl' : '',
}} />
```

---

## 7. アクセシビリティ

- **prefers-reduced-motion 対応**: 自動アニメ・マウス追従は OFF にする

```tsx
const prefersReduced = useMediaQuery('(prefers-reduced-motion: reduce)');
<LiquidLens
  followMouse={!prefersReduced}
  autoFloat={!prefersReduced}
  // ...
/>
```

- **コントラスト**: ガラスエフェクトの上に文字を載せる場合、文字色は背景明度から自動切替（YIQ 輝度判定）
- **スクリーンリーダー**: `aria-hidden="true"` を付けて読み上げ対象から外す（純粋な装飾用途なため）

---

## 8. トラブルシューティング

### 症状: フィルタが効いてない / ガラスが透明

**原因**: SVG filter id が衝突 or DOM 順序問題

**対策**: `useId()` で id 自動生成、SVG を必ず `<LiquidLens>` 内部で同居させる（外部で定義すると read 順序のせいで失敗するケースあり）

### 症状: パフォーマンス劣化（fps 30 以下）

**原因**: 複数同時表示 / size 過大 / refractionStrength 過大

**対策**:
- size を抑える（200 以下推奨）
- numOctaves を 2→1 に減らす
- 同時表示数を制限（5 以下）
- Chrome DevTools Performance で計測 → ボトルネック特定

### 症状: Safari でクラッシュ / 真っ白

**原因**: `backdrop-filter: url(...)` を Safari が無視 → 副作用で background が透けすぎる

**対策**: Safari 検出して別クラス適用 (§6 参照)

### 症状: モバイルで重い

**原因**: GPU 性能不足

**対策**:
- モバイル時は色収差を 0 にする（`chromaticAberration={0}`）
- noiseFrequency を上げて細かい計算を減らす
- そもそもモバイルは LiquidLens を簡易 glassmorphism に置換

```tsx
const isMobile = useMediaQuery('(max-width: 768px)');
{isMobile ? (
  <div className="bg-white/20 backdrop-blur-md rounded-full" />
) : (
  <LiquidLens size={300} />
)}
```

---

## 9. 別プロジェクトへの流用手順

1. このファイル全体をコピー
2. `src/components/ui/LiquidLens.tsx` を新規プロジェクトに配置
3. Tailwind v4 互換性 (§6) を確認
4. 必要に応じて `useMediaQuery` フックを実装（Tailwind の `useBreakpoint` 等で代用可）
5. 利用箇所で `<LiquidLens>` をインポート

依存パッケージ: React のみ。SVG / CSS は標準 API のみ使用。

---

## 10. 参考資料

- [Liquid Glass in the Browser: Refraction with CSS and SVG (kube.io)](https://kube.io/blog/liquid-glass-css-svg/)
- [Liquid Glass in CSS (and SVG) (Medium ekino-france)](https://medium.com/ekino-france/liquid-glass-in-css-and-svg-839985fcb88d)
- [GitHub - nikdelvin/liquid-glass](https://github.com/nikdelvin/liquid-glass)
- [Liquid Glass: Definitive Guide 2026 (Lucky Graphics)](https://lucky.graphics/learn/liquid-glass-css-glassmorphism-tutorial/)
- [Recreating Apple's Liquid Glass with CSS and SVG (LogRocket)](https://blog.logrocket.com/how-create-liquid-glass-effects-css-and-svg/)
- [Getting Clarity on Apple's Liquid Glass (CSS-Tricks)](https://css-tricks.com/getting-clarity-on-apples-liquid-glass/)
- [16 CSS Liquid Glass Effects (FreeFrontend)](https://freefrontend.com/css-liquid-glass/)
- [feDisplacementMap (MDN)](https://developer.mozilla.org/en-US/docs/Web/SVG/Element/feDisplacementMap)
- [feColorMatrix (MDN)](https://developer.mozilla.org/en-US/docs/Web/SVG/Element/feColorMatrix)
- [backdrop-filter (MDN)](https://developer.mozilla.org/en-US/docs/Web/CSS/backdrop-filter)

---

## 11. 改訂履歴

| 日付 | 変更内容 |
|---|---|
| 2026-05-07 | 初版作成、LoPo Housing Phase 1 と並行で執筆 |
