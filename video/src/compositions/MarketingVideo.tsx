import {
  AbsoluteFill,
  Series,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import {
  IntroScene,
  StackScene,
  FlowScene,
  ModulesScene,
  FeaturesScene,
  DashboardScene,
  OutroScene,
} from "../components/scenes";

interface MarketingVideoProps {
  companyName: string;
  tagline: string;
  website: string;
  designerName: string;
  designerEmail: string;
}

// Duraciones en frames (30 fps)
const DURATIONS = {
  intro: 240,      // 8 segundos
  stack: 300,      // 10 segundos
  flow: 360,       // 12 segundos
  modules: 420,    // 14 segundos
  features: 360,   // 12 segundos
  dashboard: 360,  // 12 segundos
  outro: 240,      // 8 segundos
};

// Duración total: 2280 frames = 76 segundos
const TOTAL_DURATION = Object.values(DURATIONS).reduce((a, b) => a + b, 0);

export const MarketingVideo = ({
  companyName,
  tagline,
  website,
  designerName,
  designerEmail,
}: MarketingVideoProps) => {
  const { durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill>
      <Series>
        {/* Intro - Logo y título */}
        <Series.Sequence durationInFrames={DURATIONS.intro}>
          <IntroScene companyName={companyName} tagline={tagline} />
        </Series.Sequence>

        {/* Stack Tecnológico */}
        <Series.Sequence durationInFrames={DURATIONS.stack}>
          <StackScene />
        </Series.Sequence>

        {/* Flujo de Negocio */}
        <Series.Sequence durationInFrames={DURATIONS.flow}>
          <FlowScene />
        </Series.Sequence>

        {/* Módulos */}
        <Series.Sequence durationInFrames={DURATIONS.modules}>
          <ModulesScene />
        </Series.Sequence>

        {/* Features / KPIs */}
        <Series.Sequence durationInFrames={DURATIONS.features}>
          <FeaturesScene />
        </Series.Sequence>

        {/* Dashboard */}
        <Series.Sequence durationInFrames={DURATIONS.dashboard}>
          <DashboardScene />
        </Series.Sequence>

        {/* Outro - Call to Action */}
        <Series.Sequence durationInFrames={DURATIONS.outro}>
          <OutroScene companyName={companyName} website={website} designerName={designerName} designerEmail={designerEmail} />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};

// Duración por defecto del video
MarketingVideo.durationInFrames = TOTAL_DURATION;
