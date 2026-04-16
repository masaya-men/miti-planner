import React from "react";
import { Composition } from "remotion";
import { VIDEO, sec } from "./styles";
import { LPVideo } from "./LPVideo";
import { SNSVideo } from "./SNSVideo";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="LPVideo"
      component={LPVideo}
      durationInFrames={sec(60)}
      fps={VIDEO.fps}
      width={VIDEO.width}
      height={VIDEO.height}
    />
    <Composition
      id="SNSVideo"
      component={SNSVideo}
      durationInFrames={sec(15)}
      fps={VIDEO.fps}
      width={VIDEO.width}
      height={VIDEO.height}
    />
  </>
);
