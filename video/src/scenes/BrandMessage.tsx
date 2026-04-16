import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { COLORS, FONT } from "../styles";
import { SlideIn } from "../components/SlideIn";

/**
 * ブランドメッセージ（5-10秒 = 150フレーム）
 * - "Tools for FFXIV players." が SlideIn で上からスライドイン (delay 10)
 * - シーン全体がフェードアウト (120-150f)
 */
export const BrandMessage: React.FC = () => {
  const frame = useCurrentFrame();

  // シーン全体フェードアウト (120-150f)
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
      <SlideIn delay={10}>
        <div
          style={{
            fontFamily: FONT.main,
            fontSize: 48,
            fontWeight: 400,
            color: COLORS.muted,
            letterSpacing: "0.08em",
          }}
        >
          Tools for FFXIV players.
        </div>
      </SlideIn>
    </AbsoluteFill>
  );
};
