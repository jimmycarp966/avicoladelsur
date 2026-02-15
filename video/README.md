# ERP Avícola del Sur - Video Marketing

Video promocional generado con Remotion para el ERP Avícola del Sur.

## 🎬 Características del Video

- **Duración:** 76 segundos (1:16)
- **Resolución:** 1920x1080 (Full HD)
- **FPS:** 30
- **Formato:** MP4 (H.264)

## 📋 Contenido del Video

| Escena | Duración | Contenido |
|--------|----------|-----------|
| **Intro** | 8s | Logo animado + título + tagline |
| **Stack** | 10s | Tecnologías utilizadas (React, Next.js, Supabase, etc.) |
| **Flujo** | 12s | Flujo de negocio (WhatsApp → Presupuesto → Almacén → Reparto → Cobro → Conciliación) |
| **Módulos** | 14s | Los 6 módulos principales del sistema |
| **Features** | 12s | KPIs y beneficios (99% conciliación, 30% ahorro, etc.) |
| **Dashboard** | 12s | Métricas y dashboard del sistema |
| **Outro** | 8s | Call to action + contacto |

## 🚀 Instalación

```bash
cd video
npm install
```

## 📺 Ver el Video (Preview)

```bash
npm start
```

Esto abrirá el Remotion Studio en tu navegador donde podrás:
- Ver el video en tiempo real
- Editar las composiciones
- Modificar props y duraciones
- Exportar el video final

## 🎥 Renderizar el Video

```bash
# Renderizar con calidad alta (recomendado)
npm run build MarketingVideo

# O con el CLI de Remotion
npx remotion render MarketingVideo out/video.mp4 --codec=h264 --crf=18 --pixel-ratio=1
```

## 🎨 Personalización

### Cambiar textos

Edita `src/index.ts`:

```tsx
defaultProps={{
  companyName: "Avícola del Sur",
  tagline: "Gestión integral para avicultura",
  website: "avicola.delsur.com"
}}
```

### Modificar duraciones

Edita `src/compositions/MarketingVideo.tsx`:

```tsx
const DURATIONS = {
  intro: 240,      // segundos × 30
  stack: 300,
  flow: 360,
  modules: 420,
  features: 360,
  dashboard: 360,
  outro: 240,
};
```

### Cambiar colores

Edita `src/utils/animations.ts`:

```tsx
export const colors = {
  primary: "#16a34a",    // Verde principal
  secondary: "#1e40af",  // Azul secundario
  accent: "#f59e0b",     // Naranja destacado
  dark: "#0f172a",       // Fondo oscuro
  // ...
};
```

## 📁 Estructura del Proyecto

```
video/
├── src/
│   ├── components/
│   │   ├── ui/              # Componentes reutilizables
│   │   │   ├── Background.tsx
│   │   │   ├── Title.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Counter.tsx
│   │   │   ├── ProgressBar.tsx
│   │   │   ├── KPICard.tsx
│   │   │   └── ...
│   │   └── scenes/          # Escenas del video
│   │       ├── IntroScene.tsx
│   │       ├── StackScene.tsx
│   │       ├── FlowScene.tsx
│   │       ├── ModulesScene.tsx
│   │       ├── FeaturesScene.tsx
│   │       ├── DashboardScene.tsx
│   │       └── OutroScene.tsx
│   ├── compositions/
│   │   └── MarketingVideo.tsx  # Composición principal
│   ├── utils/
│   │   └── animations.ts       # Hooks de animación
│   ├── global.css
│   └── index.ts
├── public/                   # Assets estáticos
├── package.json
├── tsconfig.json
└── remotion.config.ts
```

## 🎯 Componentes Reutilizables

- **Background** - Fondos con variantes (dark, gradient, animated)
- **Title** - Títulos con animación spring
- **Subtitle** - Subtítulos con fade
- **TypingText** - Texto con efecto typewriter
- **Card** - Contenedor con glassmorphism
- **Counter** - Números que cuentan hacia arriba
- **ProgressBar** - Barras de progreso animadas
- **TechIcon** - Íconos de tecnología staggered
- **KPICard** - Tarjetas de métricas
- **ModuleCard** - Tarjetas de módulos 3D

## 🛠️ Hooks de Animación

- `useFadeIn` / `useFadeOut` - Opacidad
- `useSlide` - Deslizamiento desde cualquier dirección
- `useScale` - Escala con spring
- `useStagger` - Animación en cascada
- `useCounter` - Números progresivos
- `useTypewriter` - Efecto de máquina de escribir
- `useProgress` - Barras de progreso
- `useRotation` - Rotación
- `usePulse` - Efecto pulsante

## 📝 Scripts

```bash
npm start          # Inicia el Remotion Studio
npm run build      # Renderiza el video
npm run upgrade    # Actualiza Remotion
```

## 🌐 Recursos

- [Remotion Docs](https://www.remotion.dev/docs)
- [Remotion Transitions](https://www.remotion.dev/docs/transitions)
- [@remotion/transitions](https://github.com/remotion-dev/remotion/tree/main/packages/transitions)

## 📞 Contacto

Para más información sobre el ERP Avícola del Sur:
- Web: avicola.delsur.com
- Email: info@avicola.delsur.com
