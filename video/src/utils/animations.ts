import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// Colores del branding - Tema claro
export const colors = {
  primary: "#16a34a", // Green
  primaryDark: "#15803d",
  secondary: "#1e40af", // Blue
  accent: "#f59e0b", // Orange
  dark: "#1e293b",     // Slate más claro
  darker: "#0f172a",
  light: "#f1f5f9",    // Fondo claro
  white: "#ffffff",
  gray: "#475569",
  lightGray: "#94a3b8",
};

// Easing functions personalizadas
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const easeOutElastic = (t: number) => {
  const c4 = (2 * Math.PI) / 3;
  return t === 0
    ? 0
    : t === 1
    ? 1
    : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
};

// Hook para fade in
export const useFadeIn = (delay = 0, duration = 30) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [delay, delay + duration],
    [0, 1],
    { extrapolateRight: "clamp" }
  );
  return opacity;
};

// Hook para fade out
export const useFadeOut = (startFrame: number, duration = 30) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [startFrame, startFrame + duration],
    [1, 0],
    { extrapolateLeft: "clamp" }
  );
  return opacity;
};

// Hook para slide desde diferentes direcciones
export const useSlide = (
  direction: "left" | "right" | "up" | "down" = "left",
  distance = 100,
  delay = 0,
  duration = 30
) => {
  const frame = useCurrentFrame();
  const progress = interpolate(
    frame,
    [delay, delay + duration],
    [0, 1],
    { extrapolateRight: "clamp" }
  );

  const easedProgress = easeOut(progress);

  const transforms = {
    left: [`translateX(${-distance}px)`, "translateX(0)"],
    right: [`translateX(${distance}px)`, "translateX(0)"],
    up: [`translateY(${-distance}px)`, "translateY(0)"],
    down: [`translateY(${distance}px)`, "translateY(0)"],
  };

  const t = transforms[direction] as [string, string];
  return {
    transform: interpolate(
      progress,
      [0, 1],
      [0, 1]
    ) > 0.5 ? t[1] : t[0],
    opacity: progress,
  };
};

// Hook para spring genérico
export const useSpring = (
  from = 0,
  to = 1,
  delay = 0,
  duration = 30,
  config?: { damping?: number; stiffness?: number }
) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  // Asegurar que duration sea al menos 1 para evitar errores de interpolación
  const safeDuration = Math.max(1, duration);
  
  const progress = interpolate(
    frame,
    [delay, delay + safeDuration],
    [0, 1],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  
  const springValue = spring({
    frame: frame - delay,
    fps,
    config: {
      damping: config?.damping ?? 200,
      stiffness: config?.stiffness ?? 100,
    },
  });
  
  return from + (to - from) * springValue;
};

// Hook para scale animation
export const useScale = (
  from = 0,
  to = 1,
  delay = 0,
  duration = 30,
  config?: { damping?: number; stiffness?: number }
) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return spring({
    frame: frame - delay,
    fps,
    config: {
      damping: config?.damping ?? 200,
      stiffness: config?.stiffness ?? 100,
    },
  });
};

// Hook para stagger animation
export const useStagger = (
  index: number,
  staggerDelay = 5,
  delay = 0
) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const totalDelay = delay + index * staggerDelay;

  return spring({
    frame: frame - totalDelay,
    fps,
    config: { damping: 200, stiffness: 100 },
  });
};

// Hook para counter animation
export const useCounter = (
  target: number,
  startFrame: number,
  duration: number
) => {
  const frame = useCurrentFrame();
  return Math.floor(
    interpolate(frame, [startFrame, startFrame + duration], [0, target], {
      extrapolateRight: "clamp",
    })
  );
};

// Hook para typewriter effect
export const useTypewriter = (text: string, speed = 2, delay = 0) => {
  const frame = useCurrentFrame();
  const index = Math.floor((frame - delay) / speed);
  return text.slice(0, Math.max(0, index));
};

// Hook para progress bar
export const useProgress = (
  startFrame: number,
  duration: number,
  maxValue = 100
) => {
  const frame = useCurrentFrame();
  return interpolate(
    frame,
    [startFrame, startFrame + duration],
    [0, maxValue],
    { extrapolateRight: "clamp" }
  );
};

// Hook para rotation
export const useRotation = (
  startFrame: number,
  duration: number,
  rotations = 1
) => {
  const frame = useCurrentFrame();
  return interpolate(
    frame,
    [startFrame, startFrame + duration],
    [0, rotations * 360],
    { extrapolateRight: "clamp" }
  );
};

// Hook para wave animation (para líneas y formas)
export const useWave = (
  index: number,
  total: number,
  frequency = 2,
  amplitude = 20
) => {
  const frame = useCurrentFrame();
  const offset = (index / total) * Math.PI * 2;
  const wave =
    Math.sin((frame / 30) * frequency + offset) * amplitude;
  return wave;
};

// Hook para pulse animation
export const usePulse = (
  minScale = 1,
  maxScale = 1.1,
  duration = 60
) => {
  const frame = useCurrentFrame();
  const progress = (Math.sin((frame / duration) * Math.PI * 2) + 1) / 2;
  return interpolate(progress, [0, 1], [minScale, maxScale]);
};

// Hook para shuffle text (efecto de descifrado)
export const useShuffleText = (
  targetText: string,
  startFrame: number,
  duration = 30
) => {
  const frame = useCurrentFrame();
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  if (frame < startFrame) return "";
  if (frame > startFrame + duration) return targetText;

  const progress = (frame - startFrame) / duration;
  const revealedLength = Math.floor(targetText.length * progress);

  const revealed = targetText.slice(0, revealedLength);
  const remaining = targetText.slice(revealedLength);

  const shuffled = remaining
    .split("")
    .map(() => chars[Math.floor(Math.random() * chars.length)])
    .join("");

  return revealed + shuffled;
};

// Hook para 3D flip effect
export const useFlip = (
  startFrame: number,
  duration = 30,
  axis: "x" | "y" = "y"
) => {
  const frame = useCurrentFrame();
  const progress = interpolate(
    frame,
    [startFrame, startFrame + duration],
    [0, 1],
    { extrapolateRight: "clamp" }
  );

  const rotation = progress * 180;

  return {
    transform: `rotate${axis.toUpperCase()}(${rotation}deg)`,
    opacity: progress > 0.5 ? 1 : 0,
  };
};

// Hook para glitch effect
export const useGlitch = (
  intensity = 10,
  probability = 0.1
) => {
  const frame = useCurrentFrame();
  const shouldGlitch = Math.random() < probability;

  if (!shouldGlitch) return { x: 0, y: 0 };

  return {
    x: (Math.random() - 0.5) * intensity,
    y: (Math.random() - 0.5) * intensity,
  };
};

// Hook para circular progress
export const useCircularProgress = (
  startFrame: number,
  duration: number,
  maxValue = 100
) => {
  const frame = useCurrentFrame();
  const progress = interpolate(
    frame,
    [startFrame, startFrame + duration],
    [0, maxValue],
    { extrapolateRight: "clamp" }
  );

  const percentage = (progress / maxValue) * 100;

  return {
    progress,
    percentage,
    strokeDashoffset: 440 - (440 * percentage) / 100, // 440 = 2 * PI * 70
  };
};

// Función para delay en serie
export const seriesDelay = (index: number, delay: number) => {
  return index * delay;
};

// Función para calcular duración total de una serie
export const totalSeriesDuration = (
  itemCount: number,
  itemDuration: number,
  transitionDuration = 15
) => {
  return itemCount * itemDuration - (itemCount - 1) * transitionDuration;
};
