import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { COLORS, sec } from "./styles";
import { LogoIntro } from "./scenes/LogoIntro";
import { BrandMessage } from "./scenes/BrandMessage";
import { FeatureIntro } from "./scenes/FeatureIntro";
import { SkillPlace } from "./scenes/SkillPlace";
import { DamageCalc } from "./scenes/DamageCalc";
import { ManualTimeline } from "./scenes/ManualTimeline";
import { MobileView } from "./scenes/MobileView";
import { ThemeSwitch } from "./scenes/ThemeSwitch";
import { FeatureList } from "./scenes/FeatureList";
import { Teaser } from "./scenes/Teaser";
import { Ending } from "./scenes/Ending";

export const LPVideo: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
    <Sequence from={sec(0)} durationInFrames={sec(5)} name="Logo Intro">
      <LogoIntro />
    </Sequence>
    <Sequence from={sec(5)} durationInFrames={sec(5)} name="Brand Message">
      <BrandMessage />
    </Sequence>
    <Sequence from={sec(10)} durationInFrames={sec(3)} name="Feature Intro">
      <FeatureIntro />
    </Sequence>
    <Sequence from={sec(13)} durationInFrames={sec(7)} name="Skill Place">
      <SkillPlace />
    </Sequence>
    <Sequence from={sec(20)} durationInFrames={sec(7)} name="Damage Calc">
      <DamageCalc />
    </Sequence>
    <Sequence from={sec(27)} durationInFrames={sec(7)} name="Manual Timeline">
      <ManualTimeline />
    </Sequence>
    <Sequence from={sec(34)} durationInFrames={sec(6)} name="Mobile View">
      <MobileView />
    </Sequence>
    <Sequence from={sec(40)} durationInFrames={sec(5)} name="Theme Switch">
      <ThemeSwitch />
    </Sequence>
    <Sequence from={sec(45)} durationInFrames={sec(5)} name="Feature List">
      <FeatureList />
    </Sequence>
    <Sequence from={sec(50)} durationInFrames={sec(5)} name="Teaser">
      <Teaser />
    </Sequence>
    <Sequence from={sec(55)} durationInFrames={sec(5)} name="Ending">
      <Ending />
    </Sequence>
  </AbsoluteFill>
);
