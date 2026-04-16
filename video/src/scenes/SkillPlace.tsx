import React from "react";
import {
  AbsoluteFill,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  interpolate,
} from "remotion";
import { COLORS } from "../styles";

/**
 * スキル配置（13-20秒 = 210フレーム）
 * - 動画がフェードイン (0-15f)
 * - 動画がフェードアウト (195-210f)
 */
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

  const opacity = Math.min(fadeIn, fadeOut);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <AbsoluteFill style={{ opacity }}>
        <OffthreadVideo
          src={staticFile("assets/skill-place.mp4")}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
