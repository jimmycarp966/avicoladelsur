import { AbsoluteFill, useCurrentFrame, spring, useVideoConfig } from "remotion";
import { Background, Title, KPICard } from "../ui";
import { colors, useFadeIn } from "../../utils/animations";

const features = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 48, height: 48 }}>
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
      </svg>
    ),
    label: "Conciliación",
    value: "99%",
    variant: "green" as const,
    description: "Automatizada con IA",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 48, height: 48 }}>
        <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />
      </svg>
    ),
    label: "Ahorro Combustible",
    value: "30%",
    variant: "blue" as const,
    description: "Rutas optimizadas",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 48, height: 48 }}>
        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
      </svg>
    ),
    label: "Pedidos Diarios",
    value: "500+",
    variant: "orange" as const,
    description: "Procesados automáticamente",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 48, height: 48 }}>
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
      </svg>
    ),
    label: "Precisión Stock",
    value: "100%",
    variant: "purple" as const,
    description: "Control FIFO estricto",
  },
];

// Componente separado para cada feature
const FeatureItem = ({ feature, index }: { feature: typeof features[0]; index: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const delay = 30 + index * 8;
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
        transform: `scale(${scale})`,
        opacity,
      }}
    >
      <KPICard
        icon={feature.icon}
        label={feature.label}
        value={feature.value}
        index={index}
        variant={feature.variant}
      />
      <div
        style={{
          fontSize: 18,
          color: colors.gray,
          textAlign: "center",
          marginTop: 16,
        }}
      >
        {feature.description}
      </div>
    </div>
  );
};

export const FeaturesScene = () => {
  const titleOpacity = useFadeIn(0, 30);

  return (
    <AbsoluteFill>
      <Background variant="animated">
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 80,
            padding: 100,
            height: "100%",
          }}
        >
          {/* Título */}
          <div style={{ opacity: titleOpacity }}>
            <Title size="large" color={colors.white}>
              Resultados Reales
            </Title>
          </div>

          {/* KPIs */}
          <div
            style={{
              display: "flex",
              gap: 50,
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            {features.map((feature, index) => (
              <FeatureItem key={index} feature={feature} index={index} />
            ))}
          </div>

          {/* Descripción adicional */}
          <div
            style={{
              fontSize: 28,
              color: colors.gray,
              textAlign: "center",
              maxWidth: 1000,
              opacity: useFadeIn(90, 30),
            }}
          >
            Tecnología que transforma la operación avícola en eficiencia pura
          </div>
        </div>
      </Background>
    </AbsoluteFill>
  );
};
