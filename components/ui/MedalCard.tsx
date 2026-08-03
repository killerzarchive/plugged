import { TIER_COLORS, type MedalDef } from "@/constants/medals";
import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";

interface Props {
  medal: MedalDef & { earned: boolean };
  style?: ViewStyle;
  size?: "sm" | "md";
}

export function MedalCard({ medal, style, size = "md" }: Props) {
  const tierColor = TIER_COLORS[medal.tier];
  const isSm = size === "sm";

  const dimOpacity = medal.earned ? 1 : 0.28;
  const bgColor = medal.earned
    ? `${tierColor}18`
    : "rgba(255,255,255,0.04)";
  const borderColor = medal.earned
    ? `${tierColor}55`
    : "rgba(255,255,255,0.08)";

  return (
    <View
      style={[
        styles.card,
        {
          opacity: dimOpacity,
          backgroundColor: bgColor,
          borderColor,
          width: isSm ? 72 : 84,
          padding: isSm ? 8 : 10,
        },
        style,
      ]}
    >
      <Text style={[styles.icon, { fontSize: isSm ? 20 : 24 }]}>{medal.icon}</Text>
      <Text
        style={[
          styles.name,
          { color: medal.earned ? tierColor : "rgba(255,255,255,0.5)", fontSize: isSm ? 9 : 10 },
        ]}
        numberOfLines={2}
      >
        {medal.name}
      </Text>
      {medal.earned && medal.points > 0 && (
        <View style={[styles.ptsPill, { borderColor: `${tierColor}44` }]}>
          <Text style={[styles.ptsText, { color: tierColor }]}>+{medal.points}</Text>
        </View>
      )}
      {!medal.earned && (
        <Text style={styles.locked}>🔒</Text>
      )}
    </View>
  );
}

export function MedalTierBadge({ tier }: { tier: MedalDef["tier"] }) {
  const color = TIER_COLORS[tier];
  return (
    <View style={[styles.tierBadge, { backgroundColor: `${color}22`, borderColor: `${color}55` }]}>
      <Text style={[styles.tierText, { color }]}>{tier.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    gap: 5,
  },
  icon: {
    textAlign: "center",
  },
  name: {
    fontFamily: "Roobert-SemiBold",
    textAlign: "center",
    letterSpacing: -0.2,
    lineHeight: 13,
  },
  ptsPill: {
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
  ptsText: {
    fontFamily: "Roobert-Bold",
    fontSize: 9,
    letterSpacing: 0.1,
  },
  locked: {
    fontSize: 10,
    opacity: 0.5,
  },
  tierBadge: {
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tierText: {
    fontFamily: "Roobert-Bold",
    fontSize: 8,
    letterSpacing: 0.5,
  },
});
