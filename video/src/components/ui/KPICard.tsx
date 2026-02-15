import { useCurrentFrame } from "remotion";
import { useStagger } from "../../utils/animations";
import { colors } from "../../utils/animations";

interface KPICardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  index: number;
  delay?: number;
  variant?: "green" | "blue" | "orange" | "purple";
}

const variantColors = {
  green: colors.primary,
  blue: colors.secondary,
  orange: colors.accent,
  purple: "#a855f7",
};

export const KPICard = ({
  icon,
  label,
  value,
  index,
  delay = 0,
  variant = "green",
}: KPICardProps) => {
  const scale = useStagger(index, 8, delay);
  const color = variantColors[variant];

  return (
    <div
      style={{
        background: `${color}11`,
        border: `2px solid ${color}44}`,
        borderRadius: 20,
        padding: 32,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
        transform: `scale(${scale})`,
        minWidth: 200,
      }}
    >
      <div
        style={{
          fontSize: 48,
          color,
        }}
      >
        {icon}
      </div>
      <div
        style={{
          fontSize: 48,
          fontWeight: 900,
          color: colors.white,
          textAlign: "center",
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 18,
          color: colors.gray,
          fontWeight: 500,
          textAlign: "center",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </div>
    </div>
  );
};
