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
 * ロゴイントロ（0-5秒 = 150フレーム）
 * - 黒画面 → ぶどうアイコンがスプリングスケールでフェードイン (0-30f)
 * - "LoPo" テキストが右からスライドイン (20-50f)
 * - シーン全体がフェードアウト (120-150f)
 */
export const LogoIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // アイコン: スプリングスケール (0-30f)
  const iconScale = spring({
    frame,
    fps,
    config: { damping: 12, mass: 0.8 },
  });

  // テキスト: 右からスライドイン (20-50f)
  const textProgress = spring({
    frame: Math.max(0, frame - 20),
    fps,
    config: { damping: 15, mass: 0.8 },
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
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: fadeOut,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        {/* ぶどうアイコン */}
        <Img
          src={staticFile("assets/grape-icon.png")}
          style={{
            width: 100,
            height: 100,
            borderRadius: 20,
            transform: `scale(${iconScale})`,
          }}
        />

        {/* "LoPo" テキスト */}
        <div
          style={{
            fontFamily: FONT.main,
            fontSize: 96,
            fontWeight: 800,
            color: COLORS.text,
            transform: `translateX(${(1 - textProgress) * 60}px)`,
            opacity: textProgress,
          }}
        >
          LoPo
        </div>
      </div>
    </AbsoluteFill>
  );
};
