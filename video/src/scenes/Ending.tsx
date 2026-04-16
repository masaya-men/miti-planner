import React from "react";
import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  spring,
  useVideoConfig,
} from "remotion";
import { COLORS, FONT } from "../styles";

/**
 * エンディング（55-60秒 = 150フレーム）
 * - ぶどうアイコン + "LoPo" がスプリングで出現 (delay 0)
 * - "lopoly.app" がスプリングで出現 (delay 30)
 * - "@lopoly_app" がスプリングで出現 (delay 45)
 */
export const Ending: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ロゴ: スプリング (delay 0)
  const logoProgress = spring({
    frame,
    fps,
    config: { damping: 12, mass: 0.8 },
  });

  // URL: スプリング (delay 30)
  const urlProgress = spring({
    frame: Math.max(0, frame - 30),
    fps,
    config: { damping: 15, mass: 0.8 },
  });

  // SNS: スプリング (delay 45)
  const snsProgress = spring({
    frame: Math.max(0, frame - 45),
    fps,
    config: { damping: 15, mass: 0.8 },
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
        }}
      >
        {/* ぶどうアイコン + "LoPo" */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            transform: `scale(${logoProgress})`,
            opacity: logoProgress,
          }}
        >
          <Img
            src={staticFile("assets/grape-icon.png")}
            style={{
              width: 80,
              height: 80,
              borderRadius: 16,
            }}
          />
          <div
            style={{
              fontFamily: FONT.main,
              fontSize: 80,
              fontWeight: 800,
              color: COLORS.text,
            }}
          >
            LoPo
          </div>
        </div>

        {/* URL */}
        <div
          style={{
            fontFamily: FONT.main,
            fontSize: 36,
            fontWeight: 500,
            color: COLORS.text,
            opacity: urlProgress,
            transform: `translateY(${(1 - urlProgress) * 20}px)`,
          }}
        >
          lopoly.app
        </div>

        {/* SNSハンドル */}
        <div
          style={{
            fontFamily: FONT.main,
            fontSize: 24,
            fontWeight: 500,
            color: COLORS.muted,
            opacity: snsProgress,
            transform: `translateY(${(1 - snsProgress) * 20}px)`,
          }}
        >
          @lopoly_app
        </div>
      </div>
    </AbsoluteFill>
  );
};
