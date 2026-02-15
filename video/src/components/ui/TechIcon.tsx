import { useCurrentFrame, useVideoConfig, spring } from "remotion";
import { colors } from "../../utils/animations";

interface TechIconProps {
  icon: React.ReactNode;
  name: string;
  index: number;
  delay?: number;
}

export const TechIcon = ({ icon, name, index, delay = 0 }: TechIconProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const totalDelay = delay + index * 5;
  const scale = spring({
    frame: frame - totalDelay,
    fps,
    config: { damping: 200, stiffness: 100 },
  });
  const opacity = Math.min(1, scale);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
        transform: `scale(${scale})`,
        opacity,
      }}
    >
      <div
        style={{
          width: 120,
          height: 120,
          borderRadius: 30,
          background: `${colors.white}11`,
          border: `2px solid ${colors.white}33}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 48,
        }}
      >
        {icon}
      </div>
      <div
        style={{
          fontSize: 18,
          color: colors.gray,
          fontWeight: 500,
          textAlign: "center",
        }}
      >
        {name}
      </div>
    </div>
  );
};
