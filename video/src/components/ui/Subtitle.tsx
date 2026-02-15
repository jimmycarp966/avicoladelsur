import { useCurrentFrame, useVideoConfig } from "remotion";
import { useFadeIn } from "../../utils/animations";
import { colors } from "../../utils/animations";

interface SubtitleProps {
  children: React.ReactNode;
  delay?: number;
  color?: string;
}

export const Subtitle = ({
  children,
  delay = 0,
  color = colors.gray,
}: SubtitleProps) => {
  const opacity = useFadeIn(delay, 30);

  return (
    <p
      style={{
        fontSize: 36,
        fontWeight: 400,
        color,
        textAlign: "center",
        opacity,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        letterSpacing: "0.02em",
      }}
    >
      {children}
    </p>
  );
};
