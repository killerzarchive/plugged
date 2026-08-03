import { useColors } from "@/contexts/theme";
import { layout } from "@/constants/layout";
import React from "react";
import { Text, TouchableOpacity, View, ViewStyle } from "react-native";

interface SectionHeaderProps {
  title: string;
  onSeeAll?: () => void;
  style?: ViewStyle;
}

export function SectionHeader({ title, onSeeAll, style }: SectionHeaderProps) {
  const C = useColors();
  return (
    <View style={[{
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingTop: 14, paddingHorizontal: layout.screenPadding, paddingBottom: 8,
    }, style]}>
      <Text style={{ color: C.txt, fontSize: 16, fontFamily: "Roobert-Bold", letterSpacing: -0.4 }}>
        {title}
      </Text>
      {onSeeAll && (
        <TouchableOpacity onPress={onSeeAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={{ color: C.txt3, fontSize: 12, fontFamily: "Roobert-Medium" }}>
            See all
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
