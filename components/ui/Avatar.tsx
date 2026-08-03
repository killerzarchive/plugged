import { useColors } from "@/contexts/theme";
import { layout } from "@/constants/layout";
import React from "react";
import { Image, StyleSheet, Text, View, ViewStyle } from "react-native";

interface AvatarProps {
  uri?: string | null;
  name?: string;
  size?: number;
  style?: ViewStyle;
  active?: boolean;
}

export function Avatar({ uri, name, size = layout.avatarSm, style, active = false }: AvatarProps) {
  const C = useColors();
  const radius = size / 2;
  const fontSize = size * 0.38;

  const activeRing = active ? (
    <View style={{
      position: "absolute",
      top: -3, left: -3,
      width: size + 6, height: size + 6, borderRadius: radius + 3,
      borderWidth: 1.5, borderColor: C.accent,
    }} />
  ) : null;

  if (uri) {
    return (
      <View style={[{ width: size, height: size }, style]}>
        <Image
          source={{ uri }}
          style={{
            width: size, height: size, borderRadius: radius,
            borderWidth: StyleSheet.hairlineWidth, borderColor: C.border,
          }}
        />
        {activeRing}
      </View>
    );
  }

  return (
    <View style={[{ width: size, height: size }, style]}>
      <View style={{
        width: size, height: size, borderRadius: radius,
        backgroundColor: C.bg3,
        borderWidth: StyleSheet.hairlineWidth, borderColor: C.border,
        alignItems: "center", justifyContent: "center",
      }}>
        <Text style={{ color: C.txt, fontFamily: "Roobert-Bold", fontSize }}>
          {name ? name.charAt(0).toUpperCase() : "?"}
        </Text>
      </View>
      {activeRing}
    </View>
  );
}
