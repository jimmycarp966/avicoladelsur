import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { colors, useScale, useFadeIn, useFadeOut } from "../../utils/animations";

// Logo inline para evitar problemas de carga
const LogoSVG = () => (
  <svg
    viewBox="0 0 100 100"
    style={{
      width: 160,
      height: 160,
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

interface OutroSceneProps {
  companyName: string;
  website: string;
  designerName: string;
  designerEmail: string;
}

export const OutroScene = ({ companyName, website, designerName, designerEmail }: OutroSceneProps) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const logoOpacity = useFadeIn(0, 30);
  const titleOpacity = useFadeIn(30, 30);
  const ctaOpacity = useFadeIn(60, 30);
  const contactOpacity = useFadeIn(90, 30);
  const designerOpacity = useFadeIn(120, 30);

  // Fade out al final
  const globalOpacity = useFadeOut(durationInFrames - 30, 30);

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${colors.light} 0%, ${colors.white} 50%, #e0f2fe 100%)`,
        opacity: globalOpacity,
      }}
    >
      {/* Decoración de fondo */}
      <div
        style={{
          position: "absolute",
          bottom: "10%",
          right: "10%",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${colors.primary}22 0%, transparent 70%)`,
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 30,
          height: "100%",
        }}
      >
        {/* Logo */}
        <div style={{ opacity: logoOpacity }}>
          <LogoSVG />
        </div>

        {/* Título */}
        <div style={{ opacity: titleOpacity }}>
          <h1
            style={{
              fontSize: 72,
              fontWeight: 900,
              color: colors.dark,
              textAlign: "center",
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            }}
          >
            {companyName}
          </h1>
        </div>

        {/* CTA */}
        <div
          style={{
            opacity: ctaOpacity,
            background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryDark} 100%)`,
            padding: "20px 60px",
            borderRadius: 50,
            fontSize: 28,
            fontWeight: 700,
            color: colors.white,
            boxShadow: `0 8px 32px ${colors.primary}55}`,
          }}
        >
          Transformá tu distribución hoy
        </div>

        {/* Contacto */}
        <div
          style={{
            opacity: contactOpacity,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              fontSize: 24,
              color: colors.gray,
            }}
          >
            {website}
          </div>
          <div
            style={{
              fontSize: 22,
              color: colors.primary,
              fontWeight: 600,
            }}
          >
            {designerEmail}
          </div>
        </div>

        {/* Créditos */}
        <div
          style={{
            opacity: designerOpacity,
            marginTop: 40,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div
            style={{
              fontSize: 20,
              color: colors.lightGray,
              fontWeight: 600,
            }}
          >
            Diseñado por {designerName}
          </div>
          <div
            style={{
              fontSize: 18,
              color: colors.gray,
            }}
          >
            Tecnología Argentina
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
