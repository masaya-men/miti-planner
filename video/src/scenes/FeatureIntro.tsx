import React from "react";
import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  spring,
  useVideoConfig,
  interpolate,
} from "remotion";
import { COLORS, FONT } from "../styles";

/**
 * 第一弾紹介（10-13秒 = 90フレーム）
 * - "軽減プランナー" テキストがフェードイン (0-20f)
 * - スクリーンショットが背景でズームイン (20-90f) spring, scale 1.15→1
 * - テキスト視認性のためダークグラデーションオーバーレイ
 */
export const FeatureIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // テキストフェードイン (0-20f)
  const textOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // スクリーンショットズームイン (20-90f): spring で scale 1.15→1
  const zoomProgress = spring({
    frame: Math.max(0, frame - 20),
    fps,
    config: { damping: 20, mass: 1.2 },
  });
  const imageScale = interpolate(zoomProgress, [0, 1], [1.15, 1]);

  // スクリーンショットフェードイン (20f以降)
  const imageOpacity = interpolate(frame, [20, 35], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      {/* スクリーンショット背景 */}
      <AbsoluteFill style={{ opacity: imageOpacity }}>
        <Img
          src={staticFile("assets/timeline-dark.png")}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: `scale(${imageScale})`,
          }}
        />
      </AbsoluteFill>

      {/* ダークグラデーションオーバーレイ */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(15,15,16,0.85) 0%, rgba(15,15,16,0.4) 50%, rgba(15,15,16,0.85) 100%)",
        }}
      />

      {/* テキスト */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: textOpacity,
        }}
      >
        <div
          style={{
            fontFamily: FONT.main,
            fontSize: 64,
            fontWeight: 700,
            color: COLORS.text,
            textShadow: "0 2px 20px rgba(0,0,0,0.8), 0 0 40px rgba(0,0,0,0.5)",
          }}
        >
          軽減プランナー
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
