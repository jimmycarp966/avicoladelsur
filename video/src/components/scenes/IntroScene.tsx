import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import { Title, Subtitle } from "../ui";
import { colors, useScale, useFadeIn } from "../../utils/animations";

// Logo inline para evitar problemas de carga
const LogoSVG = () => (
  <svg
    viewBox="0 0 100 100"
    style={{
      width: 180,
      height: 180,
    }}
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="50" cy="50" r="48" fill="#16a34a" />
    <circle cx="50" cy="50" r="40" fill="#ffffff" />
    <text
      x="50"
      y="55"
      textAnchor="middle"
      fontSize="28"
      fontWeight="bold"
      fill="#16a34a"
      fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    >
      A
    </text>
    <ellipse cx="50" cy="50" rx="35" ry="20" fill="none" stroke="#16a34a" strokeWidth="2" transform="rotate(-30 50 50)" />
    <ellipse cx="50" cy="50" rx="35" ry="20" fill="none" stroke="#16a34a" strokeWidth="2" transform="rotate(30 50 50)" />
    <ellipse cx="50" cy="50" rx="35" ry="20" fill="none" stroke="#16a34a" strokeWidth="2" transform="rotate(90 50 50)" />
  </svg>
);

interface IntroSceneProps {
  companyName: string;
  tagline: string;
}

export const IntroScene = ({ companyName, tagline }: IntroSceneProps) => {
  const frame = useCurrentFrame();

  const logoScale = useScale(0.3, 1, 0, 60, { damping: 150, stiffness: 100 });
  const logoOpacity = useFadeIn(0, 30);
  const titleOpacity = useFadeIn(45, 30);
  const subtitleOpacity = useFadeIn(90, 30);
  const ctaOpacity = useFadeIn(135, 30);

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${colors.light} 0%, ${colors.white} 50%, #e0f2fe 100%)`,
      }}
    >
      {/* Decoración de fondo */}
      <div
        style={{
          position: "absolute",
          top: "10%",
          right: "10%",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${colors.primary}22 0%, transparent 70%)`,
          opacity: 0.6,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "10%",
          left: "10%",
          width: 300,
          height: 300,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${colors.secondary}22 0%, transparent 70%)`,
          opacity: 0.6,
        }}
      />

      {/* Contenido principal */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 35,
          height: "100%",
        }}
      >
        {/* Logo */}
        <div
          style={{
            transform: `scale(${logoScale})`,
            opacity: logoOpacity,
          }}
        >
          <LogoSVG />
        </div>

        {/* Título */}
        <div style={{ opacity: titleOpacity }}>
          <h1
            style={{
              fontSize: 96,
              fontWeight: 900,
              color: colors.dark,
              textAlign: "center",
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
              lineHeight: 1.1,
              textShadow: `0 2px 10px ${colors.white}88`,
            }}
          >
            {companyName}
          </h1>
        </div>

        {/* Subtítulo */}
        <div style={{ opacity: subtitleOpacity }}>
          <p
            style={{
              fontSize: 36,
              fontWeight: 500,
              color: colors.gray,
              textAlign: "center",
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
              letterSpacing: "0.02em",
            }}
          >
            {tagline}
          </p>
        </div>

        {/* Tagline adicional */}
        <div
          style={{
            opacity: ctaOpacity,
            fontSize: 28,
            color: colors.primary,
            fontWeight: 700,
            textAlign: "center",
            maxWidth: 800,
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          }}
        >
          Tecnología de vanguardia para distribución y logística
        </div>
      </div>
    </AbsoluteFill>
  );
};
