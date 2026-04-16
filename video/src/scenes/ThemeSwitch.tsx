import React from "react";
import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  interpolate,
} from "remotion";
import { COLORS } from "../styles";

/**
 * テーマ切替（40-45秒 = 150フレーム）
 * - ダーク（下）とライト（上）のスクリーンショットを重ねる
 * - ライトが30-90fでクロスフェード表示
 * - フェードアウト (120-150f)
 */
export const ThemeSwitch: React.FC = () => {
  const frame = useCurrentFrame();

  // ライトテーマのクロスフェード (30-90f)
  const lightOpacity = interpolate(frame, [30, 90], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // シーン全体フェードアウト (120-150f)
  const fadeOut = interpolate(frame, [120, 150], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bg,
        opacity: fadeOut,
      }}
    >
      {/* ダークテーマ（下） */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Img
          src={staticFile("assets/timeline-dark.png")}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </AbsoluteFill>

      {/* ライトテーマ（上） — クロスフェード */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: lightOpacity,
        }}
      >
        <Img
          src={staticFile("assets/timeline-light.png")}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
