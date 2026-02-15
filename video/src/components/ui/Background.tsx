import { AbsoluteFill } from "remotion";
import { colors } from "../../utils/animations";

interface BackgroundProps {
  variant?: "dark" | "gradient" | "animated";
  children?: React.ReactNode;
}

export const Background = ({ variant = "dark", children }: BackgroundProps) => {
  if (variant === "gradient") {
    return (
      <AbsoluteFill
        style={{
          background: `linear-gradient(135deg, ${colors.darker} 0%, ${colors.dark} 50%, ${colors.secondary} 100%)`,
        }}
      >
        {children}
      </AbsoluteFill>
    );
  }

  if (variant === "animated") {
    return (
      <AbsoluteFill
        style={{
          background: colors.darker,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(circle at 50% 50%, ${colors.secondary}22 0%, transparent 50%)`,
            animation: "pulse 4s ease-in-out infinite",
          }}
        />
        {children}
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill
      style={{
        background: colors.darker,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
