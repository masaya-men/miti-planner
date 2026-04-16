import React from "react";
import {
  AbsoluteFill,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  interpolate,
} from "remotion";
import { COLORS, FONT } from "../styles";
import { SlideIn } from "../components/SlideIn";

/**
 * 手入力タイムライン（27-34秒 = 210フレーム）
 * - 動画がフェードイン/アウトで再生 (0-15f in, 195-210f out)
 * - 下部テキストオーバーレイ: "自分だけのタイムラインを作ろう。"
 */
export const ManualTimeline: React.FC = () => {
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

  const opacity = Math.min(fadeIn, fadeOut);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bg,
        opacity,
      }}
    >
      <AbsoluteFill>
        <OffthreadVideo
          src={staticFile("assets/manual-timeline.mp4")}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </AbsoluteFill>

      {/* 下部テキストオーバーレイ */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          paddingBottom: 60,
        }}
      >
        <SlideIn delay={60} direction="up">
          <div
            style={{
              fontFamily: FONT.main,
              fontSize: 40,
              fontWeight: 600,
              color: COLORS.text,
              textShadow: "0 2px 12px rgba(0,0,0,0.8)",
              backgroundColor: "rgba(15, 15, 16, 0.6)",
              padding: "12px 32px",
              borderRadius: 8,
            }}
          >
            自分だけのタイムラインを作ろう。
          </div>
        </SlideIn>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
