import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { COLORS, FONT } from "../styles";
import { SlideIn } from "../components/SlideIn";

/**
 * ティーザー（50-55秒 = 150フレーム）
 * - "Next..." テキストがスプリングでフェードイン
 * - "?" がパルスアニメーション（40フレーム周期でスケール 1 → 1.08 → 1）
 * - フェードアウト (120-150f)
 */
export const Teaser: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // "?" スプリング出現
  const questionSpring = spring({
    frame: Math.max(0, frame - 30),
    fps,
    config: { damping: 12, mass: 0.8 },
  });

  // パルスアニメーション: 40フレーム周期でスケール 1 → 1.08 → 1
  const pulsePhase = (frame % 40) / 40;
  const pulseScale = 1 + 0.08 * Math.sin(pulsePhase * Math.PI * 2);

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
          gap: 20,
        }}
      >
        {/* "Next..." テキスト */}
        <SlideIn delay={20}>
          <div
            style={{
              fontFamily: FONT.main,
              fontSize: 56,
              fontWeight: 400,
              color: COLORS.muted,
              letterSpacing: "0.08em",
            }}
          >
            Next...
          </div>
        </SlideIn>

        {/* "?" パルスアニメーション */}
        <div
          style={{
            fontFamily: FONT.main,
            fontSize: 120,
            fontWeight: 700,
            color: COLORS.text,
            transform: `scale(${questionSpring * pulseScale})`,
            opacity: questionSpring,
          }}
        >
          ?
        </div>
      </div>
    </AbsoluteFill>
  );
};
