import { Composition } from "remotion";
import { MarketingVideo } from "./compositions/MarketingVideo";
import "./global.css";

const VIDEO_DURATION = 2280;

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="MarketingVideo"
        component={MarketingVideo as React.FC<any>}
        durationInFrames={VIDEO_DURATION}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          companyName: "Avícola del Sur",
          tagline: "Distribución y logística integral",
          website: "avicola.delsur.com",
          designerName: "DaniR",
          designerEmail: "adani.romano@gmail.com"
        }}
      />
    </>
  );
};
