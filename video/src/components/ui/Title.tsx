import { useCurrentFrame, useVideoConfig } from "remotion";
import { useScale, useFadeIn } from "../../utils/animations";
import { colors } from "../../utils/animations";

interface TitleProps {
  children: React.ReactNode;
  delay?: number;
  color?: string;
  size?: "large" | "xlarge" | "xxlarge";
  weight?: "normal" | "bold" | "extrabold";
}

const sizes = {
  large: 72,
  xlarge: 96,
  xxlarge: 120,
};

const weights = {
  normal: 500,
  bold: 700,
  extrabold: 900,
};

export const Title = ({
  children,
  delay = 0,
  color = colors.white,
  size = "xlarge",
  weight = "bold",
}: TitleProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = useScale(0.5, 1, delay, 45, { damping: 150, stiffness: 200 });
  const opacity = useFadeIn(delay, 30);

  return (
    <h1
      style={{
        fontSize: sizes[size],
        fontWeight: weights[weight],
        color,
        textAlign: "center",
        transform: `scale(${scale})`,
        opacity,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        textShadow: `0 4px 20px ${colors.primary}22}`,
        lineHeight: 1.1,
      }}
    >
      {children}
    </h1>
  );
};
