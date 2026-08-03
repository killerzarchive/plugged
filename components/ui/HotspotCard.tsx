import { Avatar } from "@/components/ui/Avatar";
import { useColors } from "@/contexts/theme";
import { layout } from "@/constants/layout";
import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface HotspotCardProps {
  name: string;
  type?: string;
  address?: string;
  coverImage?: string;
  authorName?: string;
  authorPfp?: string;
  checkinCount?: number;
  distance?: number;
  onPress?: () => void;
}

export function HotspotCard({
  name, type, address, coverImage,
  authorName, authorPfp, checkinCount, distance, onPress,
}: HotspotCardProps) {
  const C = useColors();

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      style={{
        borderRadius: layout.cardRadius,
        overflow: "hidden",
        marginBottom: layout.gap.md,
        backgroundColor: C.card,
        borderWidth: StyleSheet.hairlineWidth, borderColor: C.border,
      }}
    >
      {coverImage ? (
        <Image
          source={{ uri: coverImage }}
          style={{ width: "100%", height: 140, backgroundColor: C.bg3 }}
          resizeMode="cover"
        />
      ) : (
        <View style={{ width: "100%", height: 140, backgroundColor: C.bg3, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: C.txt4, fontFamily: "Roobert-Bold", fontSize: 48 }}>
            {name.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}

      <View style={{ padding: layout.cardPadding }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={{ color: C.txt, fontSize: 15, fontFamily: "Roobert-SemiBold", letterSpacing: -0.2 }} numberOfLines={1}>
              {name}
            </Text>
            {address && (
              <Text style={{ color: C.txt3, fontSize: 12, fontFamily: "Roobert-Regular", marginTop: 2 }} numberOfLines={1}>
                {address}
              </Text>
            )}
          </View>
          {type && (
            <View style={{
              backgroundColor: C.pill, borderRadius: layout.pillRadius,
              paddingHorizontal: 8, paddingVertical: 3,
              borderWidth: StyleSheet.hairlineWidth, borderColor: C.pillBorder,
            }}>
              <Text style={{ color: C.txt2, fontFamily: "Roobert-SemiBold", fontSize: 10, letterSpacing: 0.06 }}>
                {type}
              </Text>
            </View>
          )}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          {authorName ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Avatar uri={authorPfp} name={authorName} size={20} />
              <Text style={{ color: C.txt3, fontSize: 11, fontFamily: "Roobert-Regular" }}>
                {authorName}
              </Text>
            </View>
          ) : <View />}

          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            {checkinCount != null && checkinCount > 0 && (
              <Text style={{ color: C.txt3, fontSize: 11, fontFamily: "Roobert-Medium" }}>
                {checkinCount} check-ins
              </Text>
            )}
            {distance != null && (
              <Text style={{ color: C.txt3, fontSize: 11, fontFamily: "Roobert-Regular" }}>
                {distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1)} km`}
              </Text>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}
