import { useCurrentFrame, useVideoConfig } from "remotion";
import { useStagger, useScale } from "../../utils/animations";
import { colors } from "../../utils/animations";

interface CardProps {
  children: React.ReactNode;
  index?: number;
  delay?: number;
  variant?: "primary" | "secondary" | "accent" | "glass";
  style?: React.CSSProperties;
}

const cardStyles = {
  primary: {
    background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryDark} 100%)`,
    border: `2px solid ${colors.primary}`,
  },
  secondary: {
    background: `linear-gradient(135deg, ${colors.secondary} 0%, ${colors.secondary}dd 100%)`,
    border: `2px solid ${colors.secondary}`,
  },
  accent: {
    background: `linear-gradient(135deg, ${colors.accent} 0%, ${colors.accent}dd 100%)`,
    border: `2px solid ${colors.accent}`,
  },
  glass: {
    background: `${colors.white}11`,
    backdropFilter: "blur(20px)",
    border: `1px solid ${colors.white}22`,
  },
};

export const Card = ({
  children,
  index = 0,
  delay = 0,
  variant = "glass",
  style,
}: CardProps) => {
  const scale = useStagger(index, 5, delay);
  const opacity = Math.min(1, scale);

  return (
    <div
      style={{
        borderRadius: 24,
        padding: 40,
        transform: `scale(${scale})`,
        opacity,
        ...cardStyles[variant],
        ...style,
      }}
    >
      {children}
    </div>
  );
};
