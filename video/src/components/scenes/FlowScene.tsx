import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { colors, useFadeIn } from "../../utils/animations";

interface FlowStep {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
}

const flowSteps: FlowStep[] = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 48, height: 48 }}>
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
      </svg>
    ),
    title: "WhatsApp",
    description: "Pedidos por mensaje",
    color: colors.primary,
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 48, height: 48 }}>
        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
      </svg>
    ),
    title: "Presupuesto",
    description: "Generación automática",
    color: colors.secondary,
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 48, height: 48 }}>
        <path d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z" />
      </svg>
    ),
    title: "Almacén",
    description: "Control FIFO & Pesaje",
    color: colors.accent,
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 48, height: 48 }}>
        <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />
      </svg>
    ),
    title: "Reparto",
    description: "Rutas optimizadas + GPS",
    color: "#a855f7",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 48, height: 48 }}>
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z" />
      </svg>
    ),
    title: "Cobro",
    description: "Recaudación y firma",
    color: "#22c55e",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 48, height: 48 }}>
        <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
      </svg>
    ),
    title: "Conciliación",
    description: "IA automática",
    color: colors.secondary,
  },
];

// Componente separado para cada paso del flujo
const FlowStepItem = ({ step, index }: { step: FlowStep; index: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const delay = 45 + index * 8;
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
        gap: 20,
        zIndex: 1,
        transform: `scale(${scale})`,
        opacity,
      }}
    >
      {/* Círculo con icono */}
      <div
        style={{
          width: 100,
          height: 100,
          borderRadius: "50%",
          background: step.color + "22",
          border: `3px solid ${step.color}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: step.color,
          boxShadow: `0 8px 32px ${step.color}44`,
        }}
      >
        {step.icon}
      </div>

      {/* Título */}
      <div
        style={{
          fontSize: 24,
          fontWeight: 700,
          color: colors.dark,
          textAlign: "center",
        }}
      >
        {step.title}
      </div>

      {/* Descripción */}
      <div
        style={{
          fontSize: 18,
          color: colors.gray,
          textAlign: "center",
          maxWidth: 150,
        }}
      >
        {step.description}
      </div>
    </div>
  );
};

// Componente para las flechas
const ArrowItem = ({ index, total }: { index: number; total: number }) => {
  const frame = useCurrentFrame();
  
  const arrowOpacity = interpolate(
    frame,
    [45 + index * 10, 60 + index * 10],
    [0, 1],
    { extrapolateRight: "clamp" }
  );
  const leftPercent = ((index + 1) / total) * 100 - 5;

  return (
    <div
      key={index}
      style={{
        position: "absolute",
        top: "50%",
        left: `${leftPercent}%`,
        transform: "translate(-50%, -50%)",
        fontSize: 32,
        color: colors.primary,
        opacity: arrowOpacity,
      }}
    >
      →
    </div>
  );
};

export const FlowScene = () => {
  const frame = useCurrentFrame();

  const titleOpacity = useFadeIn(0, 30);
  const lineProgress = interpolate(frame, [30, 90], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${colors.white} 0%, ${colors.light} 50%, #e0f2fe 100%)`,
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
          background: `radial-gradient(circle at 30% 70%, ${colors.primary}11 0%, transparent 50%)`,
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
            Flujo Inteligente de Negocio
          </h2>
        </div>

          {/* Línea de tiempo horizontal */}
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              maxWidth: 1600,
              padding: "0 60px",
            }}
          >
            {/* Línea conectora */}
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: 80,
                right: 80,
                height: 4,
                background: `linear-gradient(90deg, ${colors.primary} 0%, ${colors.secondary} ${lineProgress * 100}%)`,
                transform: "translateY(-50%)",
                borderRadius: 2,
              }}
            />

            {/* Flechas */}
            {flowSteps.slice(0, -1).map((_, i) => (
              <ArrowItem key={i} index={i} total={flowSteps.length} />
            ))}

            {/* Pasos */}
            {flowSteps.map((step, index) => (
              <FlowStepItem key={index} step={step} index={index} />
            ))}
          </div>

          {/* Subtítulo */}
          <div
            style={{
              fontSize: 28,
              color: colors.gray,
              textAlign: "center",
              maxWidth: 1000,
              opacity: useFadeIn(120, 30),
            }}
          >
            Desde el pedido hasta la conciliación bancaria, todo integrado
          </div>
        </div>
    </AbsoluteFill>
  );
};
