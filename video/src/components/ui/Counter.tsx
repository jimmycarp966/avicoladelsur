import { useCurrentFrame, useVideoConfig } from "remotion";
import { useCounter, useScale } from "../../utils/animations";
import { colors } from "../../utils/animations";

interface CounterProps {
  value: number;
  startFrame?: number;
  duration?: number;
  suffix?: string;
  prefix?: string;
  fontSize?: number;
  color?: string;
  label?: string;
}

export const Counter = ({
  value,
  startFrame = 0,
  duration = 60,
  suffix = "",
  prefix = "",
  fontSize = 72,
  color = colors.white,
  label,
}: CounterProps) => {
  const count = useCounter(value, startFrame, duration);
  const scale = useScale(0.8, 1, startFrame, 45, { damping: 150 });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
      }}
    >
      <div
        style={{
          fontSize,
          fontWeight: 900,
          color,
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          transform: `scale(${scale})`,
          textShadow: `0 4px 20px ${colors.primary}44}`,
        }}
      >
        {prefix}
        {count.toLocaleString()}
        {suffix}
      </div>
      {label && (
        <div
          style={{
            fontSize: fontSize / 3,
            color: colors.gray,
            fontWeight: 500,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
};
