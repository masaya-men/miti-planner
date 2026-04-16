import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { COLORS, FONT } from "../styles";
import { SlideIn } from "../components/SlideIn";

/**
 * 機能一覧（45-50秒 = 150フレーム）
 * - 4つのテキストアイテムがスタガーでスライドイン
 * - フェードアウト (120-150f)
 */
const FEATURES = ["4言語対応", "オフライン対応", "モバイル対応", "無料"];

export const FeatureList: React.FC = () => {
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
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 28,
        }}
      >
        {FEATURES.map((feature, index) => (
          <SlideIn key={feature} delay={index * 15}>
            <div
              style={{
                fontFamily: FONT.main,
                fontSize: 48,
                fontWeight: 600,
                color: COLORS.text,
                letterSpacing: "0.06em",
              }}
            >
              {feature}
            </div>
          </SlideIn>
        ))}
      </div>
    </AbsoluteFill>
  );
};
