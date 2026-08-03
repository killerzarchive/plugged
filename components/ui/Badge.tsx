import { useColors } from "@/contexts/theme";
import { layout } from "@/constants/layout";
import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";

interface BadgeProps {
  label: string;
  style?: ViewStyle;
}

export function Badge({ label, style }: BadgeProps) {
  const C = useColors();

  const display = label
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <View style={[{
      backgroundColor: C.pill,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
      alignSelf: "flex-start",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.pillBorder,
    }, style]}>
      <Text style={{
        color: C.txt2,
        fontSize: 10,
        fontFamily: "Roobert-SemiBold",
        letterSpacing: 0.06,
      }}>
        {display}
      </Text>
    </View>
  );
}
