import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { COLORS, sec } from "./styles";
import { LogoIntro } from "./scenes/LogoIntro";
import { FeatureIntro } from "./scenes/FeatureIntro";
import { SkillPlace } from "./scenes/SkillPlace";
import { Teaser } from "./scenes/Teaser";
import { Ending } from "./scenes/Ending";

export const SNSVideo: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
    <Sequence from={sec(0)} durationInFrames={sec(3)} name="Logo Intro">
      <LogoIntro />
    </Sequence>
    <Sequence from={sec(3)} durationInFrames={sec(3)} name="Feature Intro">
      <FeatureIntro />
    </Sequence>
    <Sequence from={sec(6)} durationInFrames={sec(4)} name="Skill Place">
      <SkillPlace />
    </Sequence>
    <Sequence from={sec(10)} durationInFrames={sec(2)} name="Teaser">
      <Teaser />
    </Sequence>
    <Sequence from={sec(12)} durationInFrames={sec(3)} name="Ending">
      <Ending />
    </Sequence>
  </AbsoluteFill>
);
