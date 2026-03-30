# Pretext LP演出強化 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ランディングページ全4セクションにPretextベースのタイポグラフィ演出を追加し、唯一無二のLP体験を実現する

**Architecture:** Pretextでテキストメトリクスを計算 → オフスクリーンCanvasでテキスト形状をサンプリング → Three.jsのDataTextureとしてパーティクルターゲット座標をGPUに送信。各セクションは独立して動作し、最終的に採用/不採用を選択可能。

**Tech Stack:** @chenglou/pretext, Three.js (既存), GSAP (既存), React 19 (既存)

---

## ファイル構成

| ファイル | 操作 | 責務 |
|---------|------|------|
| `src/lib/textParticles.ts` | 新規 | Pretext + Canvas → パーティクルターゲット座標生成ユーティリティ |
| `src/components/landing/LandingScene.tsx` | 修正 | シェーダーにターゲット座標Lerp追加、ref API公開 |
| `src/components/landing/HeroSection.tsx` | 修正 | Pretext計算、LandingSceneへのターゲット注入 |
| `src/components/landing/MitiSection.tsx` | 修正 | モックアップ内テキストフロー演出 |
| `src/components/landing/FeaturesSection.tsx` | 修正 | 2カラムエディトリアルグリッド |
| `src/components/landing/CTASection.tsx` | 修正 | パーティクル再集合演出 |
| `src/components/landing/LandingPage.tsx` | 修正 | LandingSceneのref管理 |

---

### Task 1: セットアップ — ブランチ作成とPretext導入

**Files:**
- Modify: `package.json`

- [ ] **Step 1: featureブランチ作成**

```bash
git checkout -b feature/pretext-lp
```

- [ ] **Step 2: Pretextをインストール**

```bash
npm install @chenglou/pretext
```

- [ ] **Step 3: devサーバーが起動することを確認**

```bash
npm run dev
```

ブラウザで `http://localhost:5173` を開き、現在のLPが正常に表示されることを確認。

- [ ] **Step 4: コミット**

```bash
git add package.json package-lock.json
git commit -m "chore: install @chenglou/pretext for LP typography effects"
```

---

### Task 2: テキスト→パーティクル座標ユーティリティ

**Files:**
- Create: `src/lib/textParticles.ts`

- [ ] **Step 1: textParticles.ts を作成**

テキストをオフスクリーンCanvasに描画し、不透明ピクセルの座標をサンプリングしてパーティクルのターゲット位置を生成するユーティリティ。

```typescript
/**
 * テキスト形状からパーティクルのターゲット座標を生成する
 *
 * 1. Pretextでテキストのバウンディングボックスを取得
 * 2. オフスクリーンCanvasにテキストを描画
 * 3. ピクセルデータから不透明ピクセルの座標をサンプリング
 * 4. Three.jsのワールド座標に変換して返す
 */
import { prepare, layout } from '@chenglou/pretext';

export interface TextParticleTargets {
  /** ターゲット座標配列 (x, y ペア) — パーティクル数分 */
  positions: Float32Array;
  /** テキストの実際の幅（ワールド座標） */
  textWidth: number;
  /** テキストの実際の高さ（ワールド座標） */
  textHeight: number;
}

/**
 * テキストからパーティクルターゲット座標を生成
 *
 * @param text - 描画するテキスト（例: "LoPo"）
 * @param font - CSSフォント指定（例: "900 120px 'M PLUS 1'"）
 * @param particleCount - ターゲット座標を生成するパーティクル数
 * @param viewWidth - ビューの幅（ワールド座標）
 * @param viewHeight - ビューの高さ（ワールド座標）
 */
export function generateTextTargets(
  text: string,
  font: string,
  particleCount: number,
  viewWidth: number,
  viewHeight: number,
): TextParticleTargets {
  // Pretextでテキストメトリクスを取得
  const prepared = prepare(text, font);
  const metrics = layout(prepared, 9999, 1.0); // 1行想定

  // オフスクリーンCanvasにテキストを描画
  const scale = 2; // 解像度倍率
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  // テキスト幅を実測（Canvasのmeasureで正確な値を取得）
  ctx.font = font;
  const measured = ctx.measureText(text);
  const textPixelWidth = measured.width;
  const textPixelHeight = metrics.height || parseInt(font.match(/(\d+)px/)?.[1] || '120', 10);

  canvas.width = Math.ceil(textPixelWidth * scale);
  canvas.height = Math.ceil(textPixelHeight * 1.4 * scale); // 上下マージン

  ctx.font = font;
  ctx.fillStyle = 'white';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, canvas.height / (2 * scale) * scale);

  // ピクセルデータからサンプリング
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;

  // 不透明ピクセルの座標を収集
  const opaquePixels: Array<[number, number]> = [];
  for (let y = 0; y < canvas.height; y += 2) {
    for (let x = 0; x < canvas.width; x += 2) {
      const i = (y * canvas.width + x) * 4;
      if (pixels[i + 3] > 128) {
        opaquePixels.push([x / scale, y / scale]);
      }
    }
  }

  // パーティクル数分のターゲット座標を生成
  const positions = new Float32Array(particleCount * 2);

  if (opaquePixels.length === 0) {
    // フォールバック: テキストがない場合はすべて中心に
    return { positions, textWidth: 0, textHeight: 0 };
  }

  // テキストのピクセル座標 → ワールド座標への変換
  const textWorldWidth = viewWidth * 0.6; // 画面幅の60%に収める
  const pixelToWorld = textWorldWidth / textPixelWidth;
  const textWorldHeight = (textPixelHeight * 1.4) * pixelToWorld;

  for (let i = 0; i < particleCount; i++) {
    // ランダムに不透明ピクセルを選択
    const pixel = opaquePixels[i % opaquePixels.length];
    // ピクセル座標をワールド座標に変換（中心をゼロに）
    positions[i * 2]     = (pixel[0] / textPixelWidth - 0.5) * textWorldWidth;
    positions[i * 2 + 1] = -(pixel[1] / (textPixelHeight * 1.4) - 0.5) * textWorldHeight;
  }

  // シャッフルして均等に分布させる
  for (let i = particleCount - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    // swap x
    const tmpX = positions[i * 2];
    positions[i * 2] = positions[j * 2];
    positions[j * 2] = tmpX;
    // swap y
    const tmpY = positions[i * 2 + 1];
    positions[i * 2 + 1] = positions[j * 2 + 1];
    positions[j * 2 + 1] = tmpY;
  }

  return {
    positions,
    textWidth: textWorldWidth,
    textHeight: textWorldHeight,
  };
}
```

- [ ] **Step 2: ブラウザのコンソールで動作を軽く確認**

devサーバーが起動していればOK（型エラーなし）。このユーティリティは次のTaskで使う。

- [ ] **Step 3: コミット**

```bash
git add src/lib/textParticles.ts
git commit -m "feat: add textParticles utility for text-to-particle coordinate generation"
```

---

### Task 3: HeroSection — パーティクル集合アニメーション

**Files:**
- Modify: `src/components/landing/LandingScene.tsx`
- Modify: `src/components/landing/HeroSection.tsx`
- Modify: `src/components/landing/LandingPage.tsx`

- [ ] **Step 1: LandingScene.tsxにターゲット座標とformProgress uniformを追加**

LandingScene.tsxを以下のように修正する。

**シェーダー修正:**

頂点シェーダーの冒頭（`attribute float aRandom;` の後）にターゲット座標attributeを追加:

```glsl
attribute vec2 aTarget;      // テキスト形状のターゲット座標
attribute float aHasTarget;  // このパーティクルにターゲットがあるか (0 or 1)
```

uniformに追加:

```glsl
uniform float uFormProgress; // 0.0=グリッド, 1.0=テキスト形状
```

mainの `vec3 pos = position;` の後、マウスインタラクションの前に以下を追加:

```glsl
// テキスト形状への遷移
if (aHasTarget > 0.5) {
  float ease = uFormProgress * uFormProgress * (3.0 - 2.0 * uFormProgress); // smoothstep
  pos.x = mix(pos.x, aTarget.x, ease);
  pos.y = mix(pos.y, aTarget.y, ease);
  pos.z = mix(pos.z, 0.0, ease);
}
```

vAlphaの計算を変更（テキスト形成中はパーティクルを少し明るく）:

```glsl
vAlpha = mix(0.25, 0.5, uFormProgress * aHasTarget);
```

**コンポーネント修正:**

`LandingScene`をforwardRefにし、外部からターゲット座標とformProgressを設定できるAPIを公開する。

`uniforms`オブジェクトに追加:

```typescript
uFormProgress: { value: 0 },
```

refから以下のメソッドを公開:

```typescript
export interface LandingSceneHandle {
  setFormProgress: (v: number) => void;
  setTargets: (positions: Float32Array, count: number) => void;
}
```

`setTargets`の実装:
- `aTarget`と`aHasTarget`のBufferAttributeをgeometryに追加
- positionsをFloat32Arrayで受け取り、各パーティクルのx,yターゲットを設定
- count個のパーティクルの`aHasTarget`を1.0にする

`setFormProgress`の実装:
- `uniforms.uFormProgress.value = v`

- [ ] **Step 2: LandingPage.tsxでLandingSceneのrefを管理**

```typescript
import { useRef } from 'react';
import type { LandingSceneHandle } from './LandingScene';

// LandingPage内:
const sceneRef = useRef<LandingSceneHandle>(null);

// JSX:
<LandingScene ref={sceneRef} />
<HeroSection sceneRef={sceneRef} />
```

HeroSectionにsceneRefをpropsで渡す。

- [ ] **Step 3: HeroSection.tsxでPretext計算とパーティクル注入**

HeroSectionの先頭に以下を追加:

```typescript
import { generateTextTargets } from '../../lib/textParticles';
import type { LandingSceneHandle } from './LandingScene';

interface HeroSectionProps {
  sceneRef: React.RefObject<LandingSceneHandle | null>;
}
```

useEffect内で、フォントロード後にテキスト座標を計算してLandingSceneに注入:

```typescript
useEffect(() => {
  const scene = sceneRef.current;
  if (!scene) return;

  document.fonts.ready.then(() => {
    const isMobile = window.innerWidth < 768;
    const particleCount = isMobile ? 500000 : 1500000;
    const font = "900 120px 'M PLUS 1'";

    // カメラのFOVから見える範囲を計算（LandingSceneと同じ）
    const aspect = window.innerWidth / window.innerHeight;
    const vFov = (50 * Math.PI) / 180;
    const viewH = 2 * Math.tan(vFov / 2) * 5;
    const viewW = viewH * aspect;

    const targets = generateTextTargets('LoPo', font, particleCount, viewW, viewH);
    scene.setTargets(targets.positions, particleCount);

    // 初期: グリッド状態
    scene.setFormProgress(0);
  });
}, [sceneRef]);
```

既存のScrollTriggerアニメーションの中で、`uFormProgress`をアニメーション:

```typescript
// 既存のscrollTrigger (contentRefのscale/z/opacity)の前に
// パーティクル集合アニメーション（ページロード時）
const formTl = gsap.timeline({ delay: 1.8 }); // ロゴ文字飛来完了後
formTl.to({}, {
  duration: 2.0,
  ease: 'power2.inOut',
  onUpdate: function() {
    scene?.setFormProgress(this.progress());
  },
});

// 既存のScrollTrigger内にformProgress→0の遷移を追加
gsap.to({}, {
  scrollTrigger: {
    trigger: sectionRef.current,
    start: 'top top',
    end: '+=100%',
    scrub: 1,
  },
  onUpdate: function() {
    // スクロールでテキスト形状が崩壊してグリッドに戻る
    scene?.setFormProgress(1 - this.progress());
  },
});
```

- [ ] **Step 4: devサーバーで動作確認**

```bash
npm run dev
```

- LPを開く → ページロード時にLoPo文字が3D飛来 → その後パーティクルがLoPo形状に集合
- マウスを近づけるとパーティクルが押し退けられる（既存動作）
- 下にスクロールするとパーティクル文字が崩壊してグリッドに戻る

- [ ] **Step 5: コミット**

```bash
git add src/components/landing/LandingScene.tsx src/components/landing/HeroSection.tsx src/components/landing/LandingPage.tsx
git commit -m "feat: hero particle text formation - particles form 'LoPo' shape on load"
```

---

### Task 4: MitiSection — テキストフロー演出

**Files:**
- Modify: `src/components/landing/MitiSection.tsx`

- [ ] **Step 1: モックアップ内容をテキスト付きに書き換え**

既存のプレースホルダーバー（`<div className="w-20 h-3 rounded bg-white/[0.06]" />`等）はそのまま上部ヘッダーに残す。

タイムライン行のデータを以下のように定義（既存のmap配列を置換）:

```typescript
const timelineRows = [
  { time: '0:10', name: 'Cross Tail Switch', bars: [3, 2, 4, 1] },
  { time: '0:25', name: 'Quadruple Crossing', bars: [2, 3, 2, 3] },
  { time: '0:42', name: 'Arcane Revelation', bars: [4, 1, 3, 2] },
  { time: '1:05', name: 'Raining Swords', bars: [1, 4, 2, 3] },
  { time: '1:22', name: 'Lethal Orbit', bars: [3, 2, 1, 4] },
  { time: '1:48', name: 'Sunrise Sabbath', bars: [2, 3, 4, 1] },
  { time: '2:10', name: 'Beckon Moonlight', bars: [4, 1, 2, 3] },
  { time: '2:35', name: 'Ion Cluster', bars: [1, 3, 4, 2] },
];
```

各行に個別のrefを付ける:

```typescript
const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
```

- [ ] **Step 2: スクロール連動のstaggerアニメーションを追加**

既存のScrollTrigger timeline内に、モックアップの中身が表示された後（mockupRefのz/opacityアニメーション完了後の0.35あたり）に行のstaggerを追加:

```typescript
// モックアップが画面に入った後、行を順次表示
rowRefs.current.forEach((row, i) => {
  if (!row) return;
  const timeEl = row.querySelector('.mock-time');
  const nameEl = row.querySelector('.mock-name');
  const barsEl = row.querySelector('.mock-bars');

  const staggerBase = 0.38 + i * 0.03;
  if (timeEl) {
    tl.fromTo(timeEl,
      { opacity: 0, x: -10 },
      { opacity: 1, x: 0, duration: 0.04, ease: 'power2.out' },
      staggerBase);
  }
  if (nameEl) {
    tl.fromTo(nameEl,
      { clipPath: 'inset(0 100% 0 0)', opacity: 1 },
      { clipPath: 'inset(0 0% 0 0)', duration: 0.05, ease: 'power3.out' },
      staggerBase + 0.01);
  }
  if (barsEl) {
    const bars = barsEl.querySelectorAll('.mock-bar');
    bars.forEach((bar, j) => {
      tl.fromTo(bar,
        { scaleX: 0, opacity: 0 },
        { scaleX: 1, opacity: 1, duration: 0.03, ease: 'power2.out' },
        staggerBase + 0.02 + j * 0.01);
    });
  }
});
```

行のJSXに対応するクラス名を付ける:

```tsx
{timelineRows.map((row, i) => (
  <div key={row.time}
    ref={el => { rowRefs.current[i] = el; }}
    className="flex items-center gap-3 py-2 border-t border-white/[0.03]">
    <div className="mock-time text-[10px] md:text-[11px] text-white/15 w-10 font-mono shrink-0 opacity-0">{row.time}</div>
    <div className="mock-name text-[11px] md:text-xs text-white/25 flex-1 truncate" style={{ clipPath: 'inset(0 100% 0 0)' }}>{row.name}</div>
    <div className="mock-bars flex gap-1">
      {row.bars.map((w, j) => (
        <div key={j} className="mock-bar h-5 md:h-6 rounded-sm bg-white/[0.03] border border-white/[0.04] origin-left"
          style={{ width: `${w * 12 + 12}px`, transform: 'scaleX(0)', opacity: 0 }} />
      ))}
    </div>
  </div>
))}
```

- [ ] **Step 3: devサーバーで動作確認**

- MitiSectionまでスクロール → モックアップが奥から飛来
- 飛来後、行が上から順にタイプイン（時間→技名→バー）
- 各行のバーが左から伸びる

- [ ] **Step 4: コミット**

```bash
git add src/components/landing/MitiSection.tsx
git commit -m "feat: miti section text flow animation - timeline rows type in on scroll"
```

---

### Task 5: FeaturesSection — エディトリアル・マガジンレイアウト

**Files:**
- Modify: `src/components/landing/FeaturesSection.tsx`

- [ ] **Step 1: レイアウトを2カラムグリッドに変更**

現在のPLACEMENTS配列とそれに基づく左右交互配置を削除し、2x2グリッドに変更する。

```typescript
export function FeaturesSection() {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      cellRefs.current.forEach((cell, i) => {
        if (!cell) return;
        const numEl = cell.querySelector('.feat-num');
        const titleEl = cell.querySelector('.feat-title');
        const descEl = cell.querySelector('.feat-desc');

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: cell,
            start: 'top 85%',
            end: 'top 30%',
            scrub: 1,
          },
        });

        if (numEl) {
          tl.fromTo(numEl,
            { scale: 1.5, opacity: 0 },
            { scale: 1, opacity: 1, duration: 0.3 }, 0);
        }
        if (titleEl) {
          tl.fromTo(titleEl,
            { y: 30, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.4, ease: 'power3.out' }, 0.1);
        }
        if (descEl) {
          tl.fromTo(descEl,
            { y: 20, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.4 }, 0.2);
        }
      });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={containerRef} className="py-24 md:py-40 px-6 md:px-16">
      <div className="grid grid-cols-1 md:grid-cols-2 border border-white/[0.05]">
        {FEATURE_KEYS.map((key, i) => (
          <div
            key={key}
            ref={el => { cellRefs.current[i] = el; }}
            className={`p-8 md:p-12 lg:p-16
              ${i % 2 === 0 ? 'md:border-r md:border-white/[0.05]' : ''}
              ${i < 2 ? 'border-b border-white/[0.05]' : ''}`}
          >
            <div className="feat-num text-[clamp(60px,8vw,100px)] font-black text-white/[0.03] leading-none mb-2 select-none opacity-0">
              {String(i + 1).padStart(2, '0')}
            </div>
            <h3 className="feat-title text-[clamp(22px,3vw,36px)] font-black leading-[1.1] mb-3 opacity-0">
              {t(`portal.features.${key}.title`)}
            </h3>
            <p className="feat-desc text-sm md:text-base text-white/30 leading-relaxed max-w-sm opacity-0">
              {t(`portal.features.${key}.desc`)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: devサーバーで動作確認**

- FeaturesSectionまでスクロール → 2x2グリッドで表示
- 各セルが順次フェードイン
- モバイル幅にリサイズ → 1カラムにフォールバック
- グリッドの区切り線が表示されている

- [ ] **Step 3: コミット**

```bash
git add src/components/landing/FeaturesSection.tsx
git commit -m "feat: features section editorial 2-column grid layout"
```

---

### Task 6: CTASection — パーティクル再集合

**Files:**
- Modify: `src/components/landing/CTASection.tsx`
- Modify: `src/components/landing/LandingScene.tsx`
- Modify: `src/components/landing/LandingPage.tsx`

- [ ] **Step 1: LandingSceneに2つ目のターゲットを追加**

LandingSceneHandleに追加:

```typescript
export interface LandingSceneHandle {
  setFormProgress: (v: number) => void;
  setTargets: (positions: Float32Array, count: number) => void;
  setCtaTargets: (positions: Float32Array, count: number) => void;
  setCtaFormProgress: (v: number) => void;
}
```

シェーダーに追加:

```glsl
attribute vec2 aCtaTarget;
attribute float aHasCtaTarget;
uniform float uCtaFormProgress;
```

main内のテキスト形状遷移を拡張:

```glsl
// Hero テキスト形状
if (aHasTarget > 0.5) {
  float ease = uFormProgress * uFormProgress * (3.0 - 2.0 * uFormProgress);
  pos.x = mix(pos.x, aTarget.x, ease);
  pos.y = mix(pos.y, aTarget.y, ease);
  pos.z = mix(pos.z, 0.0, ease);
}

// CTA テキスト形状
if (aHasCtaTarget > 0.5) {
  float ctaEase = uCtaFormProgress * uCtaFormProgress * (3.0 - 2.0 * uCtaFormProgress);
  pos.x = mix(pos.x, aCtaTarget.x, ctaEase);
  pos.y = mix(pos.y, aCtaTarget.y, ctaEase);
  pos.z = mix(pos.z, 0.0, ctaEase);
}
```

vAlphaも拡張:

```glsl
float targetHighlight = max(uFormProgress * aHasTarget, uCtaFormProgress * aHasCtaTarget);
vAlpha = mix(0.25, 0.5, targetHighlight);
```

uniformに追加:

```typescript
uCtaFormProgress: { value: 0 },
```

- [ ] **Step 2: CTASection.tsxにパーティクル再集合演出を追加**

```typescript
import { generateTextTargets } from '../../lib/textParticles';
import type { LandingSceneHandle } from './LandingScene';

interface CTASectionProps {
  sceneRef: React.RefObject<LandingSceneHandle | null>;
}
```

useEffectでCTA用のターゲットを計算:

```typescript
useEffect(() => {
  const scene = sceneRef.current;
  if (!scene) return;

  document.fonts.ready.then(() => {
    const isMobile = window.innerWidth < 768;
    const particleCount = isMobile ? 500000 : 1500000;
    const ctaText = t('portal.cta.heading'); // "無料で使えます"
    const font = "900 80px 'M PLUS 1'";

    const aspect = window.innerWidth / window.innerHeight;
    const vFov = (50 * Math.PI) / 180;
    const viewH = 2 * Math.tan(vFov / 2) * 5;
    const viewW = viewH * aspect;

    const targets = generateTextTargets(ctaText, font, particleCount, viewW, viewH);
    scene.setCtaTargets(targets.positions, particleCount);
  });
}, [sceneRef, t]);
```

ScrollTrigger内でformProgressをアニメーション:

```typescript
// 既存のScrollTriggerの中（headingのscaleアニメーション等と一緒に）
gsap.to({}, {
  scrollTrigger: {
    trigger: sectionRef.current,
    start: 'top 60%',
    end: 'top top',
    scrub: 1,
  },
  onUpdate: function() {
    sceneRef.current?.setCtaFormProgress(this.progress());
  },
});
```

- [ ] **Step 3: LandingPage.tsxにCTASection propsを追加**

```tsx
<CTASection sceneRef={sceneRef} />
```

- [ ] **Step 4: devサーバーで動作確認**

- CTAセクションまでスクロール → パーティクルが「無料で使えます」の形に集合
- Heroとの対称: 最初にLoPo形成 → 崩壊 → 各セクション → CTAで再集合

- [ ] **Step 5: コミット**

```bash
git add src/components/landing/LandingScene.tsx src/components/landing/CTASection.tsx src/components/landing/LandingPage.tsx
git commit -m "feat: CTA particle re-formation - particles form heading text at page end"
```

---

### Task 7: ビルド確認と微調整

**Files:**
- 全landing関連ファイル

- [ ] **Step 1: ビルドが通ることを確認**

```bash
npm run build
```

TypeScriptエラー、ビルドエラーがないことを確認。

- [ ] **Step 2: ビルド後の動作確認**

```bash
npx vite preview
```

ビルド後のバンドルで全演出が動作することを確認（Lightning CSSの問題がないか等）。

- [ ] **Step 3: モバイル表示確認**

DevToolsのモバイルエミュレーションで以下を確認:
- パーティクル数が50万に減っている
- FeaturesGridが1カラムになっている
- パフォーマンスが許容範囲内

- [ ] **Step 4: コミット（微調整があれば）**

```bash
git add -A
git commit -m "fix: LP pretext enhancement polish and mobile adjustments"
```

- [ ] **Step 5: ユーザーに全セクションを見せて採用判断を依頼**

各セクションの演出を順番に見せ、採用/不採用を確認。不採用のセクションは該当コミットをrevertまたは手動で元に戻す。
