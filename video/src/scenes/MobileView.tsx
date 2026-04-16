import React from "react";
import {
  AbsoluteFill,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  spring,
  useVideoConfig,
  interpolate,
} from "remotion";
import { COLORS, FONT } from "../styles";
import { SlideIn } from "../components/SlideIn";
import { PhoneFrame } from "../components/PhoneFrame";

/**
 * モバイル対応（34-40秒 = 180フレーム）
 * - PhoneFrameがスプリングで中央から出現
 * - "どこでも確認" テキストが左からスライドイン
 * - フェードアウト (150-180f)
 */
export const MobileView: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // PhoneFrame: スプリングスケールで出現
  const phoneScale = spring({
    frame,
    fps,
    config: { damping: 12, mass: 0.8 },
  });

  // シーン全体フェードアウト (150-180f)
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
        opacity: fadeOut,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: 80,
        }}
      >
        {/* PhoneFrame + 動画 */}
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
          <div
            style={{
              fontFamily: FONT.main,
              fontSize: 44,
              fontWeight: 600,
              color: COLORS.text,
            }}
          >
            どこでも確認
          </div>
        </SlideIn>
      </div>
    </AbsoluteFill>
  );
};
