import { useColors } from "@/contexts/theme";
import { layout } from "@/constants/layout";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface StreakBadgeProps {
  streak: number;
  size?: "sm" | "md" | "lg";
}

export default function StreakBadge({ streak, size = "md" }: StreakBadgeProps) {
  const C = useColors();
  if (streak < 1) return null;

  const configs = {
    sm: { px: 8,  py: 3, radius: 10, numSize: 11, labelSize: 11 },
    md: { px: 12, py: 6, radius: 14, numSize: 14, labelSize: 12 },
    lg: { px: 16, py: 9, radius: 18, numSize: 18, labelSize: 14 },
  };
  const cfg = configs[size];

  return (
    <View style={{
      flexDirection: "row", alignItems: "center", gap: 5,
      backgroundColor: C.pill,
      borderRadius: cfg.radius,
      paddingHorizontal: cfg.px, paddingVertical: cfg.py,
      borderWidth: StyleSheet.hairlineWidth, borderColor: C.pillBorder,
    }}>
      <Text style={{ color: C.txt, fontFamily: "Roobert-Bold", fontSize: cfg.numSize }}>
        {streak}
      </Text>
      {size !== "sm" && (
        <Text style={{ color: C.txt3, fontFamily: "Roobert-Regular", fontSize: cfg.labelSize }}>
          {streak === 1 ? "day" : "days"}
        </Text>
      )}
    </View>
  );
}
