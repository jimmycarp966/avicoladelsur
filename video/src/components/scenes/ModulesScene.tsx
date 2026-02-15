import { AbsoluteFill, useCurrentFrame, spring, useVideoConfig } from "remotion";
import { colors, useFadeIn } from "../../utils/animations";

const modules = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 48, height: 48 }}>
        <path d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z" />
      </svg>
    ),
    title: "Ventas & CRM",
    description: [
      "Bot WhatsApp con IA",
      "Presupuestos automáticos",
      "Gestión de clientes",
      "Listas de precios dinámicas",
    ],
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 48, height: 48 }}>
        <path d="M20 13H4c-.55 0-1 .45-1 1v6c0 .55.45 1 1 1h16c.55 0 1-.45 1-1v-6c0-.55-.45-1-1-1zM7 19c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM20 3H4c-.55 0-1 .45-1 1v6c0 .55.45 1 1 1h16c.55 0 1-.45 1-1V4c0-.55-.45-1-1-1zM7 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" />
      </svg>
    ),
    title: "Almacén",
    description: [
      "Control de stock FIFO",
      "Pesaje electrónico",
      "Producción y rendimientos",
      "Mermas controladas",
    ],
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 48, height: 48 }}>
        <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />
      </svg>
    ),
    title: "Reparto TMS",
    description: [
      "Optimización de rutas GPS",
      "Monitor en tiempo real",
      "Tracking de entregas",
      "Gestión de flotas",
    ],
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 48, height: 48 }}>
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z" />
      </svg>
    ),
    title: "Tesorería",
    description: [
      "Conciliación automática",
      "Gestión de cajas",
      "Cuentas corrientes",
      "Reportes financieros",
    ],
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 48, height: 48 }}>
        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
      </svg>
    ),
    title: "RRHH",
    description: [
      "Control de asistencia",
      "Liquidaciones automáticas",
      "Evaluaciones",
      "Gestión de adelantos",
    ],
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 48, height: 48 }}>
        <path d="M20 4H4v2h16V4zm1 10v-2l-1-5H4l-1 5v2h1v6h10v-6h4v6h2v-6h1zm-9 4H6v-4h6v4z" />
      </svg>
    ),
    title: "Sucursales",
    description: [
      "Dashboards por sucursal",
      "Transferencias",
      "Control de stock",
      "Punto de venta",
    ],
  },
];

// Componente separado para cada módulo
const ModuleCard = ({ module, index, currentCycle }: { module: typeof modules[0]; index: number; currentCycle: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  // Calcular posición en el carrusel 3D
  const cycleDuration = 90;
  const cycleIndex = Math.floor(index / 3);
  const cycleProgress = (frame % cycleDuration) / cycleDuration;
  
  // Determinar si este módulo es visible
  const isVisible = cycleIndex === currentCycle;
  const isNext = cycleIndex === currentCycle + 1;
  
  // Calcular animación
  let scale = 0;
  let opacity = 0;
  let translateZ = 0;

  if (isVisible) {
    const springProgress = spring({
      frame: frame - (cycleIndex * cycleDuration),
      fps,
      config: { damping: 120, stiffness: 100 }
    });
    scale = 0.7 + springProgress * 0.3;
    opacity = Math.min(1, cycleProgress * 2);
    translateZ = 0;
  } else if (isNext) {
    const previewProgress = Math.max(0, (cycleProgress - 0.8) * 5);
    scale = 0.7 + previewProgress * 0.3;
    opacity = previewProgress * 0.5;
    translateZ = -200 * (1 - previewProgress);
  }

  // Posición en el grid 3D
  const col = index % 3;
  const xPos = col * 400 + 200;

  return (
    <div
      key={index}
      style={{
        position: "absolute",
        left: xPos,
        top: 100,
        width: 360,
        height: 420,
        transformStyle: "preserve-3d",
        transform: `translateZ(${translateZ}px) scale(${scale})`,
        opacity: isVisible || isNext ? opacity : 0,
        transition: "none",
      }}
    >
      {/* Tarjeta del módulo */}
      <div
        style={{
          width: "100%",
          height: "100%",
          background: `linear-gradient(145deg, ${colors.white} 0%, ${colors.light} 100%)`,
          borderRadius: 28,
          padding: 32,
          border: `2px solid ${colors.primary}33`,
          boxShadow: `0 20px 60px ${colors.primary}22`,
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        {/* Icono */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 20,
            background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryDark} 100%)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: colors.white,
            fontSize: 40,
          }}
        >
          {module.icon}
        </div>

        {/* Título */}
        <div
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: colors.dark,
            textAlign: "center",
          }}
        >
          {module.title}
        </div>

        {/* Lista */}
        <div style={{ flex: 1 }}>
          {module.description.map((item, i) => (
            <div
              key={i}
              style={{
                fontSize: 18,
                color: colors.gray,
                marginBottom: 8,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span
                style={{
                  color: colors.primary,
                  fontSize: 16,
                  fontWeight: 700,
                }}
              >
                ✓
              </span>
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const ModulesScene = () => {
  const frame = useCurrentFrame();

  const titleOpacity = useFadeIn(0, 30);

  // Carrusel 3D - mostramos 3 módulos a la vez, rotando
  const cycleDuration = 90; // frames por ciclo
  const cycles = Math.ceil(modules.length / 3);
  const currentCycle = Math.floor(frame / cycleDuration);

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
          background: `radial-gradient(circle at 50% 50%, ${colors.primary}11 0%, transparent 60%)`,
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 50,
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
            Módulos Integrales
          </h2>
        </div>

        {/* Contenedor 3D para módulos */}
        <div
          style={{
            width: 1200,
            height: 450,
            position: "relative",
            perspective: 1500,
          }}
        >
          {modules.map((module, index) => (
            <ModuleCard key={index} module={module} index={index} currentCycle={currentCycle} />
          ))}
        </div>

        {/* Indicador de progreso */}
        <div
          style={{
            display: "flex",
            gap: 10,
            marginTop: 20,
          }}
        >
          {Array.from({ length: cycles }).map((_, i) => {
            const isActive = i === currentCycle;
            return (
              <div
                key={i}
                style={{
                  width: isActive ? 40 : 12,
                  height: 12,
                  borderRadius: 6,
                  background: isActive ? colors.primary : `${colors.gray}44`,
                  transition: "none",
                }}
              />
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
