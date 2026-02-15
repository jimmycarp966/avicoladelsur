import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { Background, Title, ProgressBar } from "../ui";
import { colors, useFadeIn } from "../../utils/animations";

const dashboardMetrics = [
  { label: "Ventas Mensuales", value: 85, color: colors.primary },
  { label: "Eficiencia Rutas", value: 92, color: colors.secondary },
  { label: "Satisfacción Clientes", value: 96, color: colors.accent },
  { label: "Control Stock", value: 100, color: "#a855f7" },
];

const benefits = [
  "Tiempo real en todas las operaciones",
  "Dashboards personalizados por rol",
  "Alertas inteligentes predictivas",
  "Reportes automáticos programables",
  "Móvil responsive para campo",
];

export const DashboardScene = () => {
  const frame = useCurrentFrame();

  const titleOpacity = useFadeIn(0, 30);

  return (
    <AbsoluteFill>
      <Background variant="gradient">
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
            <Title size="large" color={colors.white}>
              Control Total
            </Title>
          </div>

          {/* Dashboard simulado */}
          <div
            style={{
              background: `${colors.white}11`,
              backdropFilter: "blur(20px)",
              border: `2px solid ${colors.white}22}`,
              borderRadius: 32,
              padding: 50,
              width: "100%",
              maxWidth: 1400,
              opacity: useFadeIn(30, 30),
            }}
          >
            {/* Barras de progreso */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 40,
                marginBottom: 50,
              }}
            >
              {dashboardMetrics.map((metric, index) => (
                <ProgressBar
                  key={index}
                  label={metric.label}
                  startFrame={60 + index * 15}
                  duration={45}
                  maxValue={100}
                  color={metric.color}
                  height={20}
                />
              ))}
            </div>

            {/* Lista de beneficios */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 25,
              }}
            >
              {benefits.map((benefit, index) => {
                const opacity = interpolate(
                  frame,
                  [120 + index * 10, 135 + index * 10],
                  [0, 1],
                  { extrapolateRight: "clamp" }
                );
                const x = interpolate(
                  frame,
                  [120 + index * 10, 135 + index * 10],
                  [-30, 0],
                  { extrapolateRight: "clamp" }
                );

                return (
                  <div
                    key={index}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                      opacity,
                      transform: `translateX(${x}px)`,
                    }}
                  >
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        background: colors.primary,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 22,
                        color: colors.light,
                        fontWeight: 500,
                      }}
                    >
                      {benefit}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CTA */}
          <div
            style={{
              fontSize: 32,
              color: colors.primary,
              fontWeight: 700,
              opacity: useFadeIn(180, 30),
            }}
          >
            Toda la información que necesitás, cuando la necesitás
          </div>
        </div>
      </Background>
    </AbsoluteFill>
  );
};
