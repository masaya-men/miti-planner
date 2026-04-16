import { Composition } from "remotion";
import { VIDEO, sec } from "./styles";

const Placeholder: React.FC = () => (
  <div
    style={{
      background: "#0F0F10",
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <span style={{ color: "#F0F0F0", fontSize: 48 }}>LoPo PV</span>
  </div>
);

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="LPVideo"
      component={Placeholder}
      durationInFrames={sec(60)}
      fps={VIDEO.fps}
      width={VIDEO.width}
      height={VIDEO.height}
    />
    <Composition
      id="SNSVideo"
      component={Placeholder}
      durationInFrames={sec(15)}
      fps={VIDEO.fps}
      width={VIDEO.width}
      height={VIDEO.height}
    />
  </>
);
