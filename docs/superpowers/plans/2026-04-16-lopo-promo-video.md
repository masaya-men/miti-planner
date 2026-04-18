# LoPo プロモーション動画 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** LoPoブランド紹介PV（LP版60秒 + SNS版15秒）をRemotionで作成する

**Architecture:** `video/` サブフォルダにRemotionプロジェクトを構築。シーンごとにコンポーネントを分割し、LP版・SNS版それぞれのCompositionで再利用する。動画・画像素材は `video/public/assets/` に配置し `staticFile()` で参照。

**Tech Stack:** Remotion 4.x, React 19, TypeScript

**設計書:** `docs/superpowers/specs/2026-04-16-lopo-promo-video-design.md`

---

## ファイル構成

```
video/
├── package.json
├── tsconfig.json
├── remotion.config.ts
├── src/
│   ├── Root.tsx                # Composition登録（LP版・SNS版）
│   ├── LPVideo.tsx             # LP版60秒メインコンポーネント
│   ├── SNSVideo.tsx            # SNS版15秒メインコンポーネント
│   ├── styles.ts               # 色・フォント・共通定数
│   ├── scenes/
│   │   ├── LogoIntro.tsx       # 0-5秒: ロゴイントロ
│   │   ├── BrandMessage.tsx    # 5-10秒: ブランドメッセージ
│   │   ├── FeatureIntro.tsx    # 10-13秒: 第一弾紹介
│   │   ├── SkillPlace.tsx      # 13-20秒: スキル配置
│   │   ├── DamageCalc.tsx      # 20-27秒: ダメージ計算
│   │   ├── ManualTimeline.tsx  # 27-34秒: 手入力タイムライン
│   │   ├── MobileView.tsx      # 34-40秒: モバイル対応
│   │   ├── ThemeSwitch.tsx     # 40-45秒: テーマ切替
│   │   ├── FeatureList.tsx     # 45-50秒: 機能一覧
│   │   ├── Teaser.tsx          # 50-55秒: ティーザー
│   │   └── Ending.tsx          # 55-60秒: エンディング
│   └── components/
│       ├── FadeIn.tsx          # フェードインラッパー
│       ├── SlideIn.tsx         # スライドインラッパー
│       └── PhoneFrame.tsx      # スマホフレーム
└── public/
    └── assets/                 # 素材（コピー済み）
        ├── timeline-dark.png   # １.png → リネーム
        ├── timeline-light.png  # ２.png → リネーム
        ├── skill-place.mp4     # ３.mp4 → リネーム
        ├── damage-calc.mp4     # ４.mp4 → リネーム
        ├── manual-timeline.mp4 # 5.mp4 → リネーム
        ├── mobile-view.mp4     # 6.MP4 → リネーム
        ├── grape-icon.png      # apple-touch-icon.png → コピー
        └── ogp.png             # ogp.png → コピー
```

---

## Task 1: Remotionプロジェクトセットアップ

**Files:**
- Create: `video/package.json`
- Create: `video/tsconfig.json`
- Create: `video/remotion.config.ts`
- Create: `video/src/Root.tsx`
- Create: `video/src/styles.ts`

- [ ] **Step 1: Remotionプロジェクト作成**

```bash
cd c:/Users/masay/Desktop/FF14Sim
mkdir video && cd video
npm init -y
npm install remotion @remotion/cli @remotion/player react react-dom
npm install -D typescript @types/react @types/react-dom
```

- [ ] **Step 2: tsconfig.json作成**

`video/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: remotion.config.ts作成**

`video/remotion.config.ts`:
```ts
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
```

- [ ] **Step 4: styles.ts — 共通定数**

`video/src/styles.ts`:
```ts
export const COLORS = {
  bg: "#0F0F10",
  text: "#F0F0F0",
  muted: "#a1a1aa",
} as const;

export const FONT = {
  main: "Rajdhani, M PLUS 1, system-ui, sans-serif",
  weight: 500,
  letterSpacing: "0.02em",
} as const;

export const VIDEO = {
  fps: 30,
  width: 1920,
  height: 1080,
} as const;

// フレーム数ヘルパー（秒→フレーム）
export const sec = (s: number) => s * VIDEO.fps;
```

- [ ] **Step 5: Root.tsx — Composition登録（空のプレースホルダ）**

`video/src/Root.tsx`:
```tsx
import { Composition } from "remotion";
import { VIDEO, sec } from "./styles";

const Placeholder: React.FC = () => (
  <div style={{ background: "#0F0F10", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
    <span style={{ color: "#F0F0F0", fontSize: 48 }}>LoPo PV</span>
  </div>
);

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="LPVideo"
      component={Placeholder}
      durationInFrames={sec(60)}
      fps={VIDEO.fps}
      width={VIDEO.width}
      height={VIDEO.height}
    />
    <Composition
      id="SNSVideo"
      component={Placeholder}
      durationInFrames={sec(15)}
      fps={VIDEO.fps}
      width={VIDEO.width}
      height={VIDEO.height}
    />
  </>
);
```

- [ ] **Step 6: package.jsonにスクリプト追加**

`video/package.json`の`scripts`に追加:
```json
{
  "scripts": {
    "studio": "remotion studio src/Root.tsx",
    "render:lp": "remotion render src/Root.tsx LPVideo out/lp-video.mp4",
    "render:sns": "remotion render src/Root.tsx SNSVideo out/sns-video.mp4",
    "render:all": "npm run render:lp && npm run render:sns"
  }
}
```

- [ ] **Step 7: Remotion Studioで動作確認**

```bash
cd video && npm run studio
```

ブラウザが開き、黒背景に「LoPo PV」テキストが表示されることを確認。

- [ ] **Step 8: コミット**

```bash
git add video/
git commit -m "feat: Remotionプロジェクトセットアップ"
```

---

## Task 2: 素材配置とアニメーション基盤コンポーネント

**Files:**
- Create: `video/public/assets/` （素材コピー）
- Create: `video/src/components/FadeIn.tsx`
- Create: `video/src/components/SlideIn.tsx`
- Create: `video/src/components/PhoneFrame.tsx`

- [ ] **Step 1: 素材をコピー・リネーム**

```bash
cd c:/Users/masay/Desktop/FF14Sim/video
mkdir -p public/assets
cp "C:/Users/masay/Downloads/動画素材/１.png" public/assets/timeline-dark.png
cp "C:/Users/masay/Downloads/動画素材/２.png" public/assets/timeline-light.png
cp "C:/Users/masay/Downloads/動画素材/３.mp4" public/assets/skill-place.mp4
cp "C:/Users/masay/Downloads/動画素材/４.mp4" public/assets/damage-calc.mp4
cp "C:/Users/masay/Downloads/動画素材/5.mp4" public/assets/manual-timeline.mp4
cp "C:/Users/masay/Downloads/動画素材/6.MP4" public/assets/mobile-view.mp4
cp ../public/apple-touch-icon.png public/assets/grape-icon.png
cp ../public/ogp.png public/assets/ogp.png
```

- [ ] **Step 2: FadeIn.tsx — フェードインラッパー**

`video/src/components/FadeIn.tsx`:
```tsx
import React from "react";
import { useCurrentFrame, interpolate } from "remotion";

export const FadeIn: React.FC<{
  children: React.ReactNode;
  delay?: number;
  duration?: number;
}> = ({ children, delay = 0, duration = 20 }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [delay, delay + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return <div style={{ opacity }}>{children}</div>;
};
```

- [ ] **Step 3: SlideIn.tsx — スライドインラッパー**

`video/src/components/SlideIn.tsx`:
```tsx
import React from "react";
import { useCurrentFrame, spring, useVideoConfig } from "remotion";

export const SlideIn: React.FC<{
  children: React.ReactNode;
  delay?: number;
  direction?: "up" | "down" | "left" | "right";
  distance?: number;
}> = ({ children, delay = 0, direction = "up", distance = 40 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: { damping: 15, mass: 0.8 },
  });

  const transforms: Record<string, string> = {
    up: `translateY(${(1 - progress) * distance}px)`,
    down: `translateY(${(progress - 1) * distance}px)`,
    left: `translateX(${(1 - progress) * distance}px)`,
    right: `translateX(${(progress - 1) * distance}px)`,
  };

  return (
    <div style={{ transform: transforms[direction], opacity: progress }}>
      {children}
    </div>
  );
};
```

- [ ] **Step 4: PhoneFrame.tsx — スマホフレーム**

`video/src/components/PhoneFrame.tsx`:
```tsx
import React from "react";

export const PhoneFrame: React.FC<{
  children: React.ReactNode;
  width?: number;
}> = ({ children, width = 320 }) => {
  const height = width * (16 / 9);
  const bezel = 12;
  const radius = 36;

  return (
    <div
      style={{
        width: width + bezel * 2,
        height: height + bezel * 2,
        background: "#2a2a2a",
        borderRadius: radius,
        padding: bezel,
        boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
      }}
    >
      <div
        style={{
          width,
          height,
          borderRadius: radius - bezel,
          overflow: "hidden",
          background: "#000",
        }}
      >
        {children}
      </div>
    </div>
  );
};
```

- [ ] **Step 5: Studioで各コンポーネントが読み込めることを確認**

Root.tsxでFadeInをimportして表示テスト → エラーなし。

- [ ] **Step 6: コミット**

```bash
git add video/
git commit -m "feat: 素材配置 + アニメーション基盤コンポーネント"
```

---

## Task 3: シーン実装 — ロゴイントロ + ブランドメッセージ（0-10秒）

**Files:**
- Create: `video/src/scenes/LogoIntro.tsx`
- Create: `video/src/scenes/BrandMessage.tsx`

- [ ] **Step 1: LogoIntro.tsx（0-5秒 = 150フレーム）**

`video/src/scenes/LogoIntro.tsx`:
```tsx
import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, spring, useVideoConfig, interpolate } from "remotion";
import { COLORS, FONT } from "../styles";

export const LogoIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ブドウアイコン: 中央にフェードイン (0-30f)
  const iconOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const iconScale = spring({ frame, fps, config: { damping: 12, mass: 0.8 } });

  // LoPo テキスト: アイコンの右にスライドイン (20-50f)
  const textProgress = spring({
    frame: Math.max(0, frame - 20),
    fps,
    config: { damping: 14, mass: 0.6 },
  });

  // 全体フェードアウト (120-150f)
  const fadeOut = interpolate(frame, [120, 150], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: fadeOut,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <Img
          src={staticFile("assets/grape-icon.png")}
          style={{
            width: 100,
            height: 100,
            opacity: iconOpacity,
            transform: `scale(${iconScale})`,
            borderRadius: 20,
          }}
        />
        <span
          style={{
            fontFamily: FONT.main,
            fontSize: 96,
            fontWeight: 800,
            color: COLORS.text,
            letterSpacing: "0.04em",
            opacity: textProgress,
            transform: `translateX(${(1 - textProgress) * 30}px)`,
          }}
        >
          LoPo
        </span>
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: BrandMessage.tsx（5-10秒 = 150フレーム）**

`video/src/scenes/BrandMessage.tsx`:
```tsx
import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { COLORS, FONT } from "../styles";
import { SlideIn } from "../components/SlideIn";

export const BrandMessage: React.FC = () => {
  const frame = useCurrentFrame();

  // フェードアウト (120-150f)
  const fadeOut = interpolate(frame, [120, 150], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: fadeOut,
      }}
    >
      <SlideIn delay={10} direction="up">
        <span
          style={{
            fontFamily: FONT.main,
            fontSize: 48,
            fontWeight: 400,
            color: COLORS.muted,
            letterSpacing: "0.08em",
          }}
        >
          Tools for FFXIV players.
        </span>
      </SlideIn>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 3: Studioでプレビュー確認**

Root.tsxにimportしてSequenceで配置し、アニメーション確認。

- [ ] **Step 4: コミット**

```bash
git add video/src/scenes/LogoIntro.tsx video/src/scenes/BrandMessage.tsx
git commit -m "feat: ロゴイントロ + ブランドメッセージシーン"
```

---

## Task 4: シーン実装 — 第一弾紹介 + スキル配置 + ダメージ計算（10-27秒）

**Files:**
- Create: `video/src/scenes/FeatureIntro.tsx`
- Create: `video/src/scenes/SkillPlace.tsx`
- Create: `video/src/scenes/DamageCalc.tsx`

- [ ] **Step 1: FeatureIntro.tsx（10-13秒 = 90フレーム）**

`video/src/scenes/FeatureIntro.tsx`:
```tsx
import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { COLORS, FONT } from "../styles";

export const FeatureIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // テキスト「軽減プランナー」フェードイン (0-20f)
  const textOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // スクリーンショットがズームイン (20-90f)
  const imgProgress = spring({
    frame: Math.max(0, frame - 20),
    fps,
    config: { damping: 20, mass: 1.2 },
  });
  const imgScale = interpolate(imgProgress, [0, 1], [1.15, 1]);
  const imgOpacity = interpolate(frame, [20, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      {/* タイムライン全景 */}
      <AbsoluteFill style={{ opacity: imgOpacity }}>
        <Img
          src={staticFile("assets/timeline-dark.png")}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: `scale(${imgScale})`,
          }}
        />
        {/* 暗いオーバーレイ（テキスト視認性） */}
        <AbsoluteFill
          style={{
            background: "linear-gradient(180deg, rgba(15,15,16,0.7) 0%, rgba(15,15,16,0.3) 50%, rgba(15,15,16,0.7) 100%)",
          }}
        />
      </AbsoluteFill>

      {/* テキスト「軽減プランナー」 */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: textOpacity,
        }}
      >
        <span
          style={{
            fontFamily: FONT.main,
            fontSize: 64,
            fontWeight: 700,
            color: COLORS.text,
            letterSpacing: "0.06em",
            textShadow: "0 2px 20px rgba(0,0,0,0.8)",
          }}
        >
          軽減プランナー
        </span>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: SkillPlace.tsx（13-20秒 = 210フレーム）**

`video/src/scenes/SkillPlace.tsx`:
```tsx
import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile, useCurrentFrame, interpolate } from "remotion";
import { COLORS } from "../styles";

export const SkillPlace: React.FC = () => {
  const frame = useCurrentFrame();

  // フェードイン (0-15f)
  const fadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // フェードアウト (195-210f)
  const fadeOut = interpolate(frame, [195, 210], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg, opacity: fadeIn * fadeOut }}>
      <OffthreadVideo
        src={staticFile("assets/skill-place.mp4")}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
        }}
      />
    </AbsoluteFill>
  );
};
```

- [ ] **Step 3: DamageCalc.tsx（20-27秒 = 210フレーム）**

`video/src/scenes/DamageCalc.tsx`:
```tsx
import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile, useCurrentFrame, interpolate } from "remotion";
import { COLORS } from "../styles";

export const DamageCalc: React.FC = () => {
  const frame = useCurrentFrame();

  const fadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const fadeOut = interpolate(frame, [195, 210], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg, opacity: fadeIn * fadeOut }}>
      <OffthreadVideo
        src={staticFile("assets/damage-calc.mp4")}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
        }}
      />
    </AbsoluteFill>
  );
};
```

- [ ] **Step 4: Studioでプレビュー確認**

3シーンをSequenceで配置し、映像のタイミング・カットを確認。動画素材が長い場合は `startFrom` propsで開始位置を調整。

- [ ] **Step 5: コミット**

```bash
git add video/src/scenes/FeatureIntro.tsx video/src/scenes/SkillPlace.tsx video/src/scenes/DamageCalc.tsx
git commit -m "feat: 第一弾紹介 + スキル配置 + ダメージ計算シーン"
```

---

## Task 5: シーン実装 — 手入力タイムライン + モバイル + テーマ切替（27-45秒）

**Files:**
- Create: `video/src/scenes/ManualTimeline.tsx`
- Create: `video/src/scenes/MobileView.tsx`
- Create: `video/src/scenes/ThemeSwitch.tsx`

- [ ] **Step 1: ManualTimeline.tsx（27-34秒 = 210フレーム）**

`video/src/scenes/ManualTimeline.tsx`:
```tsx
import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile, useCurrentFrame, interpolate } from "remotion";
import { COLORS, FONT } from "../styles";
import { SlideIn } from "../components/SlideIn";

export const ManualTimeline: React.FC = () => {
  const frame = useCurrentFrame();

  const fadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const fadeOut = interpolate(frame, [195, 210], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg, opacity: fadeIn * fadeOut }}>
      <OffthreadVideo
        src={staticFile("assets/manual-timeline.mp4")}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
        }}
      />
      {/* テキストオーバーレイ */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          paddingBottom: 80,
        }}
      >
        <SlideIn delay={60} direction="up">
          <span
            style={{
              fontFamily: FONT.main,
              fontSize: 40,
              fontWeight: 600,
              color: COLORS.text,
              letterSpacing: "0.04em",
              textShadow: "0 2px 20px rgba(0,0,0,0.9)",
              background: "rgba(15,15,16,0.6)",
              padding: "12px 32px",
              borderRadius: 8,
            }}
          >
            自分だけのタイムラインを作ろう。
          </span>
        </SlideIn>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: MobileView.tsx（34-40秒 = 180フレーム）**

`video/src/scenes/MobileView.tsx`:
```tsx
import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile, useCurrentFrame, spring, useVideoConfig, interpolate } from "remotion";
import { COLORS, FONT } from "../styles";
import { PhoneFrame } from "../components/PhoneFrame";
import { SlideIn } from "../components/SlideIn";

export const MobileView: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const phoneScale = spring({
    frame,
    fps,
    config: { damping: 14, mass: 0.8 },
  });

  const fadeOut = interpolate(frame, [150, 180], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 80,
        opacity: fadeOut,
      }}
    >
      {/* スマホフレーム */}
      <div style={{ transform: `scale(${phoneScale})` }}>
        <PhoneFrame width={280}>
          <OffthreadVideo
            src={staticFile("assets/mobile-view.mp4")}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </PhoneFrame>
      </div>

      {/* テキスト */}
      <SlideIn delay={20} direction="left" distance={60}>
        <span
          style={{
            fontFamily: FONT.main,
            fontSize: 44,
            fontWeight: 600,
            color: COLORS.text,
            letterSpacing: "0.04em",
          }}
        >
          どこでも確認
        </span>
      </SlideIn>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 3: ThemeSwitch.tsx（40-45秒 = 150フレーム）**

`video/src/scenes/ThemeSwitch.tsx`:
```tsx
import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, interpolate } from "remotion";
import { COLORS } from "../styles";

export const ThemeSwitch: React.FC = () => {
  const frame = useCurrentFrame();

  // ダーク→ライトのクロスフェード (30-90f)
  const lightOpacity = interpolate(frame, [30, 90], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // 全体フェードアウト (120-150f)
  const fadeOut = interpolate(frame, [120, 150], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg, opacity: fadeOut }}>
      {/* ダークモード（下層） */}
      <AbsoluteFill>
        <Img
          src={staticFile("assets/timeline-dark.png")}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </AbsoluteFill>
      {/* ライトモード（上層、フェードイン） */}
      <AbsoluteFill style={{ opacity: lightOpacity }}>
        <Img
          src={staticFile("assets/timeline-light.png")}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 4: Studioでプレビュー確認**

- [ ] **Step 5: コミット**

```bash
git add video/src/scenes/ManualTimeline.tsx video/src/scenes/MobileView.tsx video/src/scenes/ThemeSwitch.tsx video/src/components/PhoneFrame.tsx
git commit -m "feat: 手入力タイムライン + モバイル + テーマ切替シーン"
```

---

## Task 6: シーン実装 — 機能一覧 + ティーザー + エンディング（45-60秒）

**Files:**
- Create: `video/src/scenes/FeatureList.tsx`
- Create: `video/src/scenes/Teaser.tsx`
- Create: `video/src/scenes/Ending.tsx`

- [ ] **Step 1: FeatureList.tsx（45-50秒 = 150フレーム）**

`video/src/scenes/FeatureList.tsx`:
```tsx
import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { COLORS, FONT } from "../styles";
import { SlideIn } from "../components/SlideIn";

const FEATURES = ["4言語対応", "オフライン対応", "モバイル対応", "無料"];

export const FeatureList: React.FC = () => {
  const frame = useCurrentFrame();

  const fadeOut = interpolate(frame, [120, 150], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: fadeOut,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 28, alignItems: "center" }}>
        {FEATURES.map((feature, i) => (
          <SlideIn key={feature} delay={i * 15} direction="up">
            <span
              style={{
                fontFamily: FONT.main,
                fontSize: 48,
                fontWeight: 600,
                color: COLORS.text,
                letterSpacing: "0.06em",
              }}
            >
              {feature}
            </span>
          </SlideIn>
        ))}
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Teaser.tsx（50-55秒 = 150フレーム）**

`video/src/scenes/Teaser.tsx`:
```tsx
import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { COLORS, FONT } from "../styles";

export const Teaser: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const textProgress = spring({
    frame: Math.max(0, frame - 20),
    fps,
    config: { damping: 12, mass: 0.6 },
  });

  // 「?」のパルスアニメーション
  const pulse = interpolate(frame % 40, [0, 20, 40], [1, 1.08, 1]);

  const fadeOut = interpolate(frame, [120, 150], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        opacity: fadeOut,
      }}
    >
      <span
        style={{
          fontFamily: FONT.main,
          fontSize: 56,
          fontWeight: 400,
          color: COLORS.muted,
          letterSpacing: "0.08em",
          opacity: textProgress,
          transform: `translateY(${(1 - textProgress) * 20}px)`,
        }}
      >
        Next...
      </span>
      <span
        style={{
          fontFamily: FONT.main,
          fontSize: 120,
          fontWeight: 700,
          color: COLORS.text,
          opacity: textProgress,
          transform: `scale(${pulse})`,
        }}
      >
        ?
      </span>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 3: Ending.tsx（55-60秒 = 150フレーム）**

`video/src/scenes/Ending.tsx`:
```tsx
import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, spring, useVideoConfig } from "remotion";
import { COLORS, FONT } from "../styles";

export const Ending: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoProgress = spring({
    frame,
    fps,
    config: { damping: 14, mass: 0.8 },
  });

  const urlProgress = spring({
    frame: Math.max(0, frame - 30),
    fps,
    config: { damping: 14, mass: 0.6 },
  });

  const snsProgress = spring({
    frame: Math.max(0, frame - 45),
    fps,
    config: { damping: 14, mass: 0.6 },
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
      }}
    >
      {/* ロゴ + テキスト */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 20,
          opacity: logoProgress,
          transform: `scale(${logoProgress})`,
        }}
      >
        <Img
          src={staticFile("assets/grape-icon.png")}
          style={{ width: 80, height: 80, borderRadius: 16 }}
        />
        <span
          style={{
            fontFamily: FONT.main,
            fontSize: 80,
            fontWeight: 800,
            color: COLORS.text,
            letterSpacing: "0.04em",
          }}
        >
          LoPo
        </span>
      </div>

      {/* URL */}
      <span
        style={{
          fontFamily: FONT.main,
          fontSize: 36,
          fontWeight: 400,
          color: COLORS.text,
          letterSpacing: "0.06em",
          opacity: urlProgress,
          transform: `translateY(${(1 - urlProgress) * 15}px)`,
        }}
      >
        lopoly.app
      </span>

      {/* SNS */}
      <span
        style={{
          fontFamily: FONT.main,
          fontSize: 24,
          fontWeight: 400,
          color: COLORS.muted,
          letterSpacing: "0.04em",
          opacity: snsProgress,
          transform: `translateY(${(1 - snsProgress) * 10}px)`,
        }}
      >
        @lopoly_app
      </span>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 4: Studioでプレビュー確認**

- [ ] **Step 5: コミット**

```bash
git add video/src/scenes/FeatureList.tsx video/src/scenes/Teaser.tsx video/src/scenes/Ending.tsx
git commit -m "feat: 機能一覧 + ティーザー + エンディングシーン"
```

---

## Task 7: LP版・SNS版の組み立てとレンダリング

**Files:**
- Create: `video/src/LPVideo.tsx`
- Create: `video/src/SNSVideo.tsx`
- Modify: `video/src/Root.tsx`

- [ ] **Step 1: LPVideo.tsx — LP版60秒の全シーン配置**

`video/src/LPVideo.tsx`:
```tsx
import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { COLORS, sec } from "./styles";
import { LogoIntro } from "./scenes/LogoIntro";
import { BrandMessage } from "./scenes/BrandMessage";
import { FeatureIntro } from "./scenes/FeatureIntro";
import { SkillPlace } from "./scenes/SkillPlace";
import { DamageCalc } from "./scenes/DamageCalc";
import { ManualTimeline } from "./scenes/ManualTimeline";
import { MobileView } from "./scenes/MobileView";
import { ThemeSwitch } from "./scenes/ThemeSwitch";
import { FeatureList } from "./scenes/FeatureList";
import { Teaser } from "./scenes/Teaser";
import { Ending } from "./scenes/Ending";

export const LPVideo: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
    <Sequence from={sec(0)} durationInFrames={sec(5)} name="Logo Intro">
      <LogoIntro />
    </Sequence>
    <Sequence from={sec(5)} durationInFrames={sec(5)} name="Brand Message">
      <BrandMessage />
    </Sequence>
    <Sequence from={sec(10)} durationInFrames={sec(3)} name="Feature Intro">
      <FeatureIntro />
    </Sequence>
    <Sequence from={sec(13)} durationInFrames={sec(7)} name="Skill Place">
      <SkillPlace />
    </Sequence>
    <Sequence from={sec(20)} durationInFrames={sec(7)} name="Damage Calc">
      <DamageCalc />
    </Sequence>
    <Sequence from={sec(27)} durationInFrames={sec(7)} name="Manual Timeline">
      <ManualTimeline />
    </Sequence>
    <Sequence from={sec(34)} durationInFrames={sec(6)} name="Mobile View">
      <MobileView />
    </Sequence>
    <Sequence from={sec(40)} durationInFrames={sec(5)} name="Theme Switch">
      <ThemeSwitch />
    </Sequence>
    <Sequence from={sec(45)} durationInFrames={sec(5)} name="Feature List">
      <FeatureList />
    </Sequence>
    <Sequence from={sec(50)} durationInFrames={sec(5)} name="Teaser">
      <Teaser />
    </Sequence>
    <Sequence from={sec(55)} durationInFrames={sec(5)} name="Ending">
      <Ending />
    </Sequence>
  </AbsoluteFill>
);
```

- [ ] **Step 2: SNSVideo.tsx — SNS版15秒の切り出し**

`video/src/SNSVideo.tsx`:
```tsx
import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { COLORS, sec } from "./styles";
import { LogoIntro } from "./scenes/LogoIntro";
import { FeatureIntro } from "./scenes/FeatureIntro";
import { SkillPlace } from "./scenes/SkillPlace";
import { Teaser } from "./scenes/Teaser";
import { Ending } from "./scenes/Ending";

export const SNSVideo: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
    <Sequence from={sec(0)} durationInFrames={sec(3)} name="Logo Intro">
      <LogoIntro />
    </Sequence>
    <Sequence from={sec(3)} durationInFrames={sec(3)} name="Feature Intro">
      <FeatureIntro />
    </Sequence>
    <Sequence from={sec(6)} durationInFrames={sec(4)} name="Skill Place">
      <SkillPlace />
    </Sequence>
    <Sequence from={sec(10)} durationInFrames={sec(2)} name="Teaser">
      <Teaser />
    </Sequence>
    <Sequence from={sec(12)} durationInFrames={sec(3)} name="Ending">
      <Ending />
    </Sequence>
  </AbsoluteFill>
);
```

- [ ] **Step 3: Root.tsx更新 — LP版・SNS版を登録**

`video/src/Root.tsx`:
```tsx
import { Composition } from "remotion";
import { VIDEO, sec } from "./styles";
import { LPVideo } from "./LPVideo";
import { SNSVideo } from "./SNSVideo";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="LPVideo"
      component={LPVideo}
      durationInFrames={sec(60)}
      fps={VIDEO.fps}
      width={VIDEO.width}
      height={VIDEO.height}
    />
    <Composition
      id="SNSVideo"
      component={SNSVideo}
      durationInFrames={sec(15)}
      fps={VIDEO.fps}
      width={VIDEO.width}
      height={VIDEO.height}
    />
  </>
);
```

- [ ] **Step 4: Studioで通し確認**

```bash
cd video && npm run studio
```

LP版・SNS版それぞれを通しで再生。タイミング・トランジションを確認。動画素材のカットタイミングは `startFrom` / `endAt` propsで調整。

- [ ] **Step 5: MP4レンダリング**

```bash
cd video
npm run render:lp
npm run render:sns
```

`video/out/lp-video.mp4`（60秒）と `video/out/sns-video.mp4`（15秒）が生成される。

- [ ] **Step 6: 出力動画を再生して最終確認**

- [ ] **Step 7: コミット**

```bash
git add video/src/LPVideo.tsx video/src/SNSVideo.tsx video/src/Root.tsx
git commit -m "feat: LP版・SNS版の組み立てとレンダリング設定"
```

---

## Task 8: 微調整とポリッシュ

**Files:**
- Modify: 各シーンファイル（タイミング調整）

- [ ] **Step 1: 動画素材のカットタイミング調整**

各 `OffthreadVideo` にプロパティ追加:
- `startFrom={フレーム数}` — 動画の開始位置（不要な冒頭をスキップ）
- `endAt={フレーム数}` — 動画の終了位置
- `playbackRate={0.8}` — スロー再生が効果的な場合

StudioのプレビューでフレームごとにScrubしながら最適なカットポイントを特定する。

- [ ] **Step 2: フォントの読み込み確認**

Rajdhani / M PLUS 1 がレンダリング環境にない場合、Google Fontsから読み込むスタイルを `Root.tsx` に追加:

```tsx
import { continueRender, delayRender, staticFile } from "remotion";
```

またはシステムフォントのフォールバック（`system-ui, sans-serif`）で十分な品質か確認。

- [ ] **Step 3: 最終レンダリング**

```bash
cd video
npm run render:all
```

- [ ] **Step 4: コミット**

```bash
git add video/
git commit -m "polish: 動画カットタイミング + フォント調整"
```
