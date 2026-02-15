import { useCurrentFrame } from "remotion";
import { useProgress } from "../../utils/animations";
import { colors } from "../../utils/animations";

interface ProgressBarProps {
  startFrame: number;
  duration: number;
  value?: number;
  maxValue?: number;
  height?: number;
  color?: string;
  backgroundColor?: string;
  label?: string;
  showValue?: boolean;
}

export const ProgressBar = ({
  startFrame,
  duration,
  value,
  maxValue = 100,
  height = 16,
  color = colors.primary,
  backgroundColor = colors.white + "22",
  label,
  showValue = true,
}: ProgressBarProps) => {
  const progress = value ?? useProgress(startFrame, duration, maxValue);
  const percentage = Math.min(100, (progress / maxValue) * 100);

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {label && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 20,
            color: colors.gray,
            fontWeight: 500,
          }}
        >
          <span>{label}</span>
          {showValue && <span>{Math.round(progress)}%</span>}
        </div>
      )}
      <div
        style={{
          width: "100%",
          height,
          borderRadius: height,
          backgroundColor,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            width: `${percentage}%`,
            height: "100%",
            background: `linear-gradient(90deg, ${color}, ${color}dd)`,
            borderRadius: height,
            boxShadow: `0 0 20px ${color}66`,
            transition: "width 0.1s",
          }}
        />
      </div>
    </div>
  );
};
