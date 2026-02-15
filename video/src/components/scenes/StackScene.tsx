import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { colors, useFadeIn } from "../../utils/animations";

// Iconos SVG simples
const ReactIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 60, height: 60 }}>
    <circle cx="12" cy="12" r="2.5" />
    <ellipse cx="12" cy="12" rx="10" ry="4" fill="none" stroke="currentColor" strokeWidth="1"/>
    <ellipse cx="12" cy="12" rx="10" ry="4" fill="none" stroke="currentColor" strokeWidth="1" transform="rotate(60 12 12)"/>
    <ellipse cx="12" cy="12" rx="10" ry="4" fill="none" stroke="currentColor" strokeWidth="1" transform="rotate(120 12 12)"/>
  </svg>
);

const NextIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 60, height: 60 }}>
    <path d="M12 2L2 19.5H22L12 2Z" fill="currentColor" opacity="0.8"/>
    <path d="M2 19.5L12 22L22 19.5" fill="currentColor" opacity="0.4"/>
  </svg>
);

const SupabaseIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 60, height: 60 }}>
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-1 15l-5-5 1.5-1.5 3.5 3.5 7.5-7.5L20 8l-9 9z" fill="currentColor"/>
  </svg>
);

const AIIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 60, height: 60 }}>
    <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7V5.73C9.4 5.39 9 4.74 9 4a2 2 0 0 1 2-2M7.5 13A2.5 2.5 0 0 0 5 15.5V17h14v-1.5a2.5 2.5 0 0 0-2.5-2.5h-9z" fill="currentColor"/>
  </svg>
);

const MapsIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 60, height: 60 }}>
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z" fill="currentColor"/>
  </svg>
);

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 60, height: 60 }}>
    <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01C17.18 3.03 14.69 2 12.04 2zM12.05 20.21l-.03-.01c-1.5-.05-2.97-.47-4.27-1.23l-3.12.82.83-3.04c-.88-1.41-1.34-3.03-1.34-4.7 0-4.91 4-8.92 8.92-8.92 2.38 0 4.62.93 6.3 2.61 1.69 1.69 2.62 3.92 2.62 6.31 0 4.91-4 8.92-8.91 8.92z" fill="currentColor"/>
  </svg>
);

const DatabaseIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 60, height: 60 }}>
    <path d="M12 2C6.48 2 2 4.02 2 6.5S6.48 11 12 11s10-2.02 10-4.5S17.52 2 12 2zm0 7c-4.42 0-8-1.57-8-3.5S7.58 2 12 2s8 1.57 8 3.5S16.42 9 12 9zm0 3c-5.52 0-10 2.02-10 4.5S6.48 21 12 21s10-2.02 10-4.5S17.52 12 12 12zm0 7c-4.42 0-8-1.57-8-3.5S7.58 12 12 12s8 1.57 8 3.5-3.58 3.5-8 3.5z" fill="currentColor"/>
  </svg>
);

const ChartIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 60, height: 60 }}>
    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" fill="currentColor"/>
  </svg>
);

const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 60, height: 60 }}>
    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" fill="currentColor"/>
  </svg>
);

const techStack = [
  { icon: <ReactIcon />, name: "React 19" },
  { icon: <NextIcon />, name: "Next.js 16" },
  { icon: <SupabaseIcon />, name: "Supabase" },
  { icon: <AIIcon />, name: "Vertex AI" },
  { icon: <MapsIcon />, name: "Google Maps" },
  { icon: <WhatsAppIcon />, name: "WhatsApp API" },
  { icon: <DatabaseIcon />, name: "PostgreSQL" },
  { icon: <ChartIcon />, name: "Recharts" },
  { icon: <ShieldIcon />, name: "Seguridad" },
];

// Componente separado para cada ítem de tecnología para evitar hooks en loops
const TechItem = ({ tech, index }: { tech: typeof techStack[0]; index: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const delay = 30 + index * 6;
  const scale = spring({
    frame: frame - delay,
    fps,
    config: { damping: 200, stiffness: 100 },
  });
  const opacity = Math.min(1, scale);

  return (
    <div
      key={index}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
        transform: `scale(${scale})`,
        opacity,
      }}
    >
      <div
        style={{
          width: 120,
          height: 120,
          borderRadius: 24,
          background: `${colors.white}`,
          border: `2px solid ${colors.primary}44`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 48,
          color: colors.primary,
          boxShadow: `0 8px 24px ${colors.primary}22`,
        }}
      >
        {tech.icon}
      </div>
      <div
        style={{
          fontSize: 18,
          color: colors.gray,
          fontWeight: 600,
          textAlign: "center",
        }}
      >
        {tech.name}
      </div>
    </div>
  );
};

export const StackScene = () => {
  const titleOpacity = useFadeIn(0, 30);

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${colors.white} 0%, ${colors.light} 100%)`,
      }}
    >
      {/* Decoración de fondo */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `radial-gradient(circle at 80% 20%, ${colors.primary}11 0%, transparent 50%)`,
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 60,
          padding: 80,
          height: "100%",
        }}
      >
        {/* Título */}
        <div style={{ opacity: titleOpacity }}>
          <h2
            style={{
              fontSize: 72,
              fontWeight: 800,
              color: colors.dark,
              textAlign: "center",
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            }}
          >
            Tecnología de Vanguardia
          </h2>
        </div>

        {/* Grid de tecnologías */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 50,
            maxWidth: 1000,
          }}
        >
          {techStack.map((tech, index) => (
            <TechItem key={index} tech={tech} index={index} />
          ))}
        </div>

        {/* Descripción */}
        <div
          style={{
            fontSize: 28,
            color: colors.gray,
            textAlign: "center",
            maxWidth: 900,
            opacity: useFadeIn(120, 30),
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          }}
        >
          Construimos con las mejores tecnologías para garantizar
          escalabilidad, seguridad y rendimiento
        </div>
      </div>
    </AbsoluteFill>
  );
};
