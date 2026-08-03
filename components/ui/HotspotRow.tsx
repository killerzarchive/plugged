import { useColors } from "@/contexts/theme";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useRef } from "react";
import { Animated, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export interface HotspotRowData {
  id: string;
  name: string;
  avatar?: string;
  type?: string;
  location?: { latitude?: number; longitude?: number; address?: string };
  posts?: { id: string; media?: string }[];
  checkinCount?: number;
  userCount?: number;
  rating?: number;
  lastPostAt?: string;
  followersCount?: number;
  followers?: { id: string; name: string; pfp?: string }[];
  popupStart?: string;
  popupEnd?: string;
}

function popupTimeLabel(startIso: string, endIso?: string): string {
  const now = Date.now();
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : null;
  if (end && now >= start && now < end) {
    const rem = Math.max(0, end - now);
    const h = Math.floor(rem / 3600000);
    const m = Math.floor((rem % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
  }
  const diff = start - now;
  if (diff <= 0) return "live now";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return h > 0 ? `starts in ${h}h ${m}m` : `starts in ${m}m`;
}

export function getActivityStatus(score: number): { color: string; label: string } {
  if (score === 0) return { color: "#EF4444", label: "Dead" };
  if (score <= 3)  return { color: "#3B82F6", label: "Steady" };
  if (score <= 8)  return { color: "#833AB4", label: "Active" };
  return { color: "#E1306C", label: "Poppin'" };
}

export function PulseDot({ color = "#fff", size = 5 }: { color?: string; size?: number }) {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.15, duration: 500, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1,    duration: 500, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, []);
  return (
    <Animated.View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity, alignSelf: "center" }} />
  );
}

interface Props {
  hotspot: HotspotRowData;
  isLast: boolean;
  activityScore?: number;
  showFollowers?: boolean;
  disableSwipe?: boolean;
}

export function HotspotRow({ hotspot, isLast, activityScore = 0, showFollowers = false }: Props) {
  const C = useColors();

  const avatarContent = (
    <>
      {hotspot.avatar
        ? <Image source={{ uri: hotspot.avatar }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        : <Text style={{ color: "#fff", fontFamily: "Roobert-Bold", fontSize: 14 }}>{hotspot.name[0]?.toUpperCase()}</Text>
      }
    </>
  );

  return (
    <View style={!isLast && {}}>
      <TouchableOpacity
        onPress={() => { Haptics.selectionAsync(); router.push(`/hotspot/${hotspot.id}` as any); }}
        activeOpacity={0.82}
        style={styles.row}
      >
        {(hotspot.lastPostAt && Date.now() - new Date(hotspot.lastPostAt).getTime() < 86400000) ? (
          <LinearGradient
            colors={["#833AB4", "#1877F2", "#833AB4"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.storyRing}
          >
            <View style={[styles.storyInner, { backgroundColor: C.bg }]}>
              <View style={[styles.avatar, { backgroundColor: "#000" }]}>
                {avatarContent}
              </View>
            </View>
          </LinearGradient>
        ) : (
          <View style={[styles.avatar, { backgroundColor: C.bg3 }]}>
            {avatarContent}
          </View>
        )}

        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={[styles.name, { color: C.txt }]} numberOfLines={1}>{hotspot.name}</Text>
            {hotspot.type && (
              <View style={{ borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ color: "#3B82F6", fontFamily: "Roobert-Bold", fontSize: 10, letterSpacing: 0.2 }}>{hotspot.type}</Text>
              </View>
            )}
          </View>

          {hotspot.location?.address && (
            <Text style={[styles.sub, { color: 'white' }]} numberOfLines={1}>{hotspot.location.address}</Text>
          )}

          {hotspot.popupStart && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 }}>
              <PulseDot color="#1877F2" size={5} />
              <Text style={[styles.stats, { color: "#fff" }]} numberOfLines={1}>
                {popupTimeLabel(hotspot.popupStart, hotspot.popupEnd)}
              </Text>
            </View>
          )}

          {(() => {
            const parts: string[] = [];
            const postCount = (hotspot.posts ?? []).length;
            if (postCount > 0) parts.push(`${postCount} post${postCount !== 1 ? "s" : ""}`);
            if (hotspot.checkinCount) parts.push(`${hotspot.checkinCount} check-in${hotspot.checkinCount !== 1 ? "s" : ""}`);
            if (hotspot.userCount) parts.push(`${hotspot.userCount} here`);
            if (!parts.length) return null;
            return (
              <Text style={[styles.stats, { color: '#fff' }]} numberOfLines={1}>{parts.join(" · ")}</Text>
            );
          })()}

        
        </View>

        {(() => {
          const media = (hotspot.posts ?? []).filter(p => p.media);
          if (!media.length) return null;
          const visible = media.slice(0, 3);
          const overflow = media.length - 3;
          return (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              {visible.map((p, i) => (
                <View key={p.id} style={{ width: 28, height: 28, borderRadius: 14, overflow: "hidden", backgroundColor: C.bg3, borderWidth: 2, borderColor: C.bg, marginLeft: i === 0 ? 0 : -8, zIndex: 3 - i }}>
                  <Image source={{ uri: p.media! }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                </View>
              ))}
              {overflow > 0 && (
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: C.bg3, borderWidth: 2, borderColor: C.bg, marginLeft: -8, zIndex: 0, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: C.txt2, fontFamily: "Roobert-Bold", fontSize: 8 }}>+{overflow}</Text>
                </View>
              )}
            </View>
          );
        })()}

        {showFollowers ? (() => {
          const followers = hotspot.followers ?? [];
          const total = hotspot.followersCount ?? followers.length;
          const visible = followers.slice(0, 3);
          const remainder = total - visible.length;
          return (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <View style={{ flexDirection: "row" }}>
                {visible.map((f, i) => (
                  <View
                    key={f.id}
                    style={{
                      width: 22, height: 22, borderRadius: 11,
                      overflow: "hidden",
                      backgroundColor: "#1a1a1a",
                      borderWidth: 1.5, borderColor: "#000",
                      marginLeft: i === 0 ? 0 : -7,
                      zIndex: visible.length - i,
                      alignItems: "center", justifyContent: "center",
                    }}
                  >
                    {f.pfp
                      ? <Image source={{ uri: f.pfp }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                      : <Text style={{ color: "#fff", fontFamily: "Roobert-Bold", fontSize: 8 }}>{f.name.charAt(0)}</Text>
                    }
                  </View>
                ))}
              </View>
              {remainder > 0 && (
                <Text style={[styles.status, { color: "rgba(255,255,255,0.5)" }]}>+{remainder}</Text>
              )}
            </View>
          );
        })() : (() => {
          const { color: sc, label: sl } = getActivityStatus(activityScore);
          return (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <PulseDot color={sc} size={5} />
              <Text style={[styles.status, { color: sc }]}>{sl}</Text>
            </View>
          );
        })()}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 8,
    paddingVertical: 11,
  },
  storyRing: {
    width: 74,
    height: 74,
    borderRadius: 26,
    padding: 2.5,
    alignItems: "center",
    justifyContent: "center",
  },
  storyInner: {
    width: "100%",
    height: "100%",
    borderRadius: 23,
    padding: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 22,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    fontFamily: "Roobert-SemiBold",
    fontSize: 13,
    letterSpacing: -0.3,
  },
  sub: {
    fontFamily: "Roobert-SemiBold",
    fontSize: 11,
    marginTop: 2,
  },
  stats: {
    fontFamily: "Roobert-SemiBold",
    fontSize: 10,
    marginTop: 2,
  },
  status: {
    fontFamily: "Roobert-Bold",
    fontSize: 10,
    color: "#fff",
  },
});
