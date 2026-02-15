import { useCurrentFrame } from "remotion";
import { useFadeIn, useSlide } from "../../utils/animations";
import { colors } from "../../utils/animations";

interface ModuleCardProps {
  icon: React.ReactNode;
  title: string;
  description: string[];
  index: number;
  startFrame: number;
}

export const ModuleCard = ({
  icon,
  title,
  description,
  index,
  startFrame,
}: ModuleCardProps) => {
  const { transform } = useSlide("right", 150, startFrame + index * 15, 30);

  return (
    <div
      style={{
        background: `linear-gradient(135deg, ${colors.white}11 0%, ${colors.white}06 100%)`,
        backdropFilter: "blur(20px)",
        border: `2px solid ${colors.white}22}`,
        borderRadius: 28,
        padding: 40,
        display: "flex",
        flexDirection: "column",
        gap: 24,
        transform: transform as string,
        minWidth: 420,
        height: 400,
      }}
    >
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: 20,
          background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryDark} 100%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 40,
        }}
      >
        {icon}
      </div>
      <div>
        <div
          style={{
            fontSize: 32,
            fontWeight: 700,
            color: colors.white,
            marginBottom: 16,
          }}
        >
          {title}
        </div>
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
          }}
        >
          {description.map((item, i) => (
            <li
              key={i}
              style={{
                fontSize: 20,
                color: colors.gray,
                marginBottom: 8,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span
                style={{
                  color: colors.primary,
                  fontSize: 16,
                }}
              >
                ✓
              </span>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
