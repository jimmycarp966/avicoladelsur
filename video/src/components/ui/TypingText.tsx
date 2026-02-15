import { AbsoluteFill } from "remotion";
import { useTypewriter } from "../../utils/animations";
import { colors } from "../../utils/animations";

interface TypingTextProps {
  text: string;
  delay?: number;
  speed?: number;
  fontSize?: number;
  color?: string;
  showCursor?: boolean;
}

export const TypingText = ({
  text,
  delay = 0,
  speed = 3,
  fontSize = 48,
  color = colors.white,
  showCursor = true,
}: TypingTextProps) => {
  const displayText = useTypewriter(text, speed, delay);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
      }}
    >
      <span
        style={{
          fontSize,
          color,
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          fontWeight: 600,
          whiteSpace: "pre-wrap",
        }}
      >
        {displayText}
      </span>
      {showCursor && (
        <span
          style={{
            fontSize,
            color: colors.primary,
            animation: "blink 1s step-end infinite",
          }}
        >
          |
        </span>
      )}
    </div>
  );
};
