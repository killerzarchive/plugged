import { TIER_COLORS, type MedalCategory, type MedalDef } from "@/constants/medals";
import React from "react";
import Svg, { G, Path } from "react-native-svg";

type FillRule = "evenodd" | "nonzero";

function getCategoryIcon(category: MedalCategory): [string, FillRule] {
  switch (category) {
    case "checkins":
      // Clean teardrop pin with inner hole
      return [
        "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z",
        "evenodd",
      ];

    case "streaks":
      // Minimal angular lightning bolt
      return ["M13 2L4 14h7l-2 8 11-12h-7z", "nonzero"];

    case "hotspots":
      // Three signal arcs + center dot (wifi-style)
      return [
        "M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z",
        "nonzero",
      ];

    case "exploration":
      // 4-pointed compass star — clean diamond cross
      return [
        "M12 2l1.5 8.5L22 12l-8.5 1.5L12 22l-1.5-8.5L2 12l8.5-1.5z",
        "nonzero",
      ];

    case "social":
      // Two people silhouettes
      return [
        "M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z",
        "nonzero",
      ];

    case "reviews":
      // Classic 5-pointed star
      return [
        "M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z",
        "nonzero",
      ];

    case "posts":
      // Camera body with lens hole
      return [
        "M12 15.5a3.5 3.5 0 110-7 3.5 3.5 0 010 7zM9 2L7.17 4H4a2 2 0 00-2 2v13a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2h-3.17L15 2H9z",
        "evenodd",
      ];

    case "points":
      // Hexagon gem with hollow center
      return [
        "M12 2L4 7v10l8 5 8-5V7L12 2zm0 3.24L17.76 9v6L12 18.76 6.24 15V9L12 5.24z",
        "evenodd",
      ];

    case "nightlife":
      // Crescent moon
      return [
        "M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z",
        "nonzero",
      ];

    case "special":
      // Crown — band + 3 upward points
      return [
        "M5 19h14a1 1 0 000-2H5a1 1 0 000 2zM3.5 17L5 9l4 2.5 3-7.5 3 7.5L19 9l1.5 8h-17z",
        "nonzero",
      ];

    default:
      return ["M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z", "evenodd"];
  }
}

interface Props {
  medal: MedalDef & { earned: boolean };
  size?: number;
  iconColor?: string;
  showRing?: boolean;
}

export function MedalSVG({ medal, size = 36, iconColor = "white", showRing = true }: Props) {
  const color = TIER_COLORS[medal.tier];
  const opacity = medal.earned ? 1 : 0.22;
  const [path, fillRule] = getCategoryIcon(medal.category);

  const iconArea = size * 0.54;
  const scale = iconArea / 24;
  const offset = (size - iconArea) / 2;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {showRing && (
        <G opacity={opacity}>
          <Path
            d={`M${size / 2} 1.5a${size / 2 - 1.5} ${size / 2 - 1.5} 0 1 0 0 ${size - 3} ${size / 2 - 1.5} ${size / 2 - 1.5} 0 0 0 0-${size - 3}z`}
            fill={`${color}1A`}
            stroke={color}
            strokeWidth={1.5}
          />
        </G>
      )}
      <G
        transform={`translate(${offset}, ${offset}) scale(${scale})`}
        opacity={opacity}
      >
        <Path d={path} fill={iconColor} fillRule={fillRule} />
      </G>
    </Svg>
  );
}
