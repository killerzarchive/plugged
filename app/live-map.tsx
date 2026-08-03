import { LEADERBOARD_HOTSPOTS } from "@/app/apollo/queries/general";
import { useQuery } from "@apollo/client/react";
import * as Haptics from "expo-haptics";
import * as ExpoLocation from "expo-location";
import { router } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, Region } from "react-native-maps";
import { ArrowLeft, Flame, Navigation } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColors } from "@/contexts/theme";

interface LeaderboardHotspot {
  id: string; name: string; avatar?: string; type?: string;
  checkins?: { id: string; createdAt?: string }[];
  location?: { latitude?: number; longitude?: number; address?: string };
}

function cutoff24h() { return Date.now() - 86_400_000; }
function cutoff1h()  { return Date.now() - 3_600_000; }

function getVibe(count: number) {
  if (count >= 10) return { label: "Lit",  opacity: 1.0 };
  if (count >= 3)  return { label: "Mid",  opacity: 0.5 };
  return               { label: "Dead", opacity: 0.25 };
}

function getCityState(address?: string | null) {
  if (!address) return null;
  const parts = address.split(",").map(p => p.trim()).filter(Boolean);
  if (parts.length < 2) return parts[0] ?? null;
  return `${parts[parts.length - 2]}, ${parts[parts.length - 1].replace(/\d/g, "").trim()}`;
}

export default function LiveMapScreen() {
  const C = useColors();
  const mapRef = useRef<MapView>(null);
  const [selected, setSelected] = useState<LeaderboardHotspot | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  const { data, loading, startPolling, stopPolling } = useQuery<{ leaderboardHotspots: LeaderboardHotspot[] }>(
    LEADERBOARD_HOTSPOTS,
    { fetchPolicy: "network-only" }
  );

  // Poll every 30s for live data
  useEffect(() => {
    startPolling(30000);
    return () => stopPolling();
  }, []);

  // Get user GPS
  useEffect(() => {
    (async () => {
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const pos = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced });
      setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
    })();
  }, []);

  // Zoom to user
  const goToMe = () => {
    if (!userLocation || !mapRef.current) return;
    Haptics.selectionAsync();
    mapRef.current.animateToRegion({
      ...userLocation,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    }, 400);
  };

  const hotspots = useMemo(() => {
    return (data?.leaderboardHotspots ?? []).filter(
      h => h.location?.latitude != null && h.location?.longitude != null
    );
  }, [data]);

  // Fit all pins on load
  useEffect(() => {
    if (!hotspots.length || !mapRef.current) return;
    const coords = hotspots.map(h => ({
      latitude: h.location!.latitude!,
      longitude: h.location!.longitude!,
    }));
    setTimeout(() => {
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 100, right: 40, bottom: 300, left: 40 },
        animated: true,
      });
    }, 500);
  }, [hotspots.length]);

  // Sort hotspots by 24h count for bottom strip
  const sorted = useMemo(() => {
    return [...hotspots]
      .map(h => ({
        hotspot: h,
        count: (h.checkins ?? []).filter(c => c.createdAt && new Date(c.createdAt).getTime() >= cutoff24h()).length,
        live: (h.checkins ?? []).filter(c => c.createdAt && new Date(c.createdAt).getTime() >= cutoff1h()).length,
      }))
      .sort((a, b) => b.count - a.count);
  }, [hotspots]);

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <StatusBar barStyle="light-content" />

      {/* Full-screen map */}
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        mapType="mutedStandard"
        initialRegion={{ latitude: 37.78, longitude: -122.43, latitudeDelta: 0.15, longitudeDelta: 0.15 }}
      >
        {sorted.map(({ hotspot, count, live }) => {
          const vibe = getVibe(count);
          const initial = hotspot.name[0]?.toUpperCase() ?? "?";
          const isSelected = selected?.id === hotspot.id;

          return (
            <Marker
              key={hotspot.id}
              coordinate={{ latitude: hotspot.location!.latitude!, longitude: hotspot.location!.longitude! }}
              onPress={() => { Haptics.selectionAsync(); setSelected(hotspot); }}
              tracksViewChanges={false}
              zIndex={isSelected ? 999 : count}
            >
              <View style={{ alignItems: "center" }}>
                {/* Main pin */}
                <View style={{
                  width: isSelected ? 56 : 46,
                  height: isSelected ? 56 : 46,
                  borderRadius: isSelected ? 18 : 14,
                  overflow: "hidden",
                  borderWidth: isSelected ? 3 : 2,
                  borderColor: isSelected ? "#fff" : "rgba(255,255,255,0.4)",
                  backgroundColor: "#1C1C1E",
                  shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
                  elevation: 8,
                }}>
                  {hotspot.avatar
                    ? <Image source={{ uri: hotspot.avatar }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                    : <View style={{ flex: 1, backgroundColor: "#2C2C2E", alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Roobert-Bold", fontSize: isSelected ? 20 : 16 }}>{initial}</Text>
                      </View>
                  }
                </View>

                {/* Live badge (if checked in last hour) */}
                {live > 0 && (
                  <View style={{
                    position: "absolute", top: -6, right: -6,
                    backgroundColor: "#fff", borderRadius: 8,
                    paddingHorizontal: 5, paddingVertical: 2,
                    borderWidth: 1.5, borderColor: "#000",
                    minWidth: 16, alignItems: "center",
                  }}>
                    <Text style={{ color: "#000", fontFamily: "Roobert-Bold", fontSize: 9 }}>{live}</Text>
                  </View>
                )}

                {/* Count pill */}
                <View style={{
                  backgroundColor: "rgba(255,255,255,0.9)",
                  borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2,
                  marginTop: 3,
                }}>
                  <Text style={{ color: "#000", fontFamily: "Roobert-Bold", fontSize: 10, opacity: vibe.opacity }}>{count}</Text>
                </View>

                {/* Stem */}
                <View style={{ width: 2, height: 6, backgroundColor: "#fff", borderRadius: 1, marginTop: 1 }} />
                <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: "#fff" }} />
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Top bar */}
      <SafeAreaView style={{ position: "absolute", top: 0, left: 0, right: 0 }} edges={["top"]} pointerEvents="box-none">
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, gap: 10 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" }}
          >
            <ArrowLeft size={20} color="#fff" />
          </TouchableOpacity>

          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.accent }} />
            <Text style={{ color: "#fff", fontFamily: "Roobert-Bold", fontSize: 14 }}>Live hotspot map</Text>
            {loading && <ActivityIndicator color="#fff" size="small" style={{ marginLeft: "auto" }} />}
          </View>

          <TouchableOpacity
            onPress={goToMe}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" }}
          >
            <Navigation size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Legend */}
        <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 16, marginTop: 8 }} pointerEvents="none">
          {[{ label: "Lit" }, { label: "Mid" }, { label: "Dead" }].map(v => (
            <View key={v.label} style={{ backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 }}>
              <Text style={{ color: "#fff", fontFamily: "Roobert-SemiBold", fontSize: 11 }}>{v.label}</Text>
            </View>
          ))}
        </View>
      </SafeAreaView>

      {/* Selected callout */}
      {selected ? (() => {
        const entry = sorted.find(s => s.hotspot.id === selected.id);
        const count = entry?.count ?? 0;
        const live  = entry?.live ?? 0;
        const vibe  = getVibe(count);
        const city  = getCityState(selected.location?.address);
        return (
          <View style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            backgroundColor: C.card,
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            padding: 20, paddingBottom: 44,
            shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 20, shadowOffset: { width: 0, height: -4 },
            elevation: 10,
          }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.border2, alignSelf: "center", marginBottom: 16 }} />

            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <View style={{ width: 60, height: 60, borderRadius: 16, overflow: "hidden", backgroundColor: C.bg3 }}>
                {selected.avatar
                  ? <Image source={{ uri: selected.avatar }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                  : <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ color: C.txt2, fontFamily: "Roobert-Bold", fontSize: 22 }}>{selected.name[0]}</Text>
                    </View>
                }
              </View>

              <View style={{ flex: 1 }}>
                <Text style={{ color: C.txt, fontFamily: "Roobert-Bold", fontSize: 18 }} numberOfLines={1}>{selected.name}</Text>
                {city && <Text style={{ color: C.txt2, fontFamily: "Roobert-Regular", fontSize: 13, marginTop: 1 }}>{city}</Text>}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
                  <View style={{ backgroundColor: C.pill, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3 }}>
                    <Text style={{ color: C.txt2, fontFamily: "Roobert-Bold", fontSize: 12 }}>{vibe.label}</Text>
                  </View>
                  <Text style={{ color: C.txt2, fontFamily: "Roobert-Regular", fontSize: 12 }}>{count} check-ins today</Text>
                  {live > 0 && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.accent }} />
                      <Text style={{ color: C.txt2, fontFamily: "Roobert-SemiBold", fontSize: 12 }}>{live} this hour</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
              <TouchableOpacity
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/profile-view?type=hotspot&id=${selected.id}` as any); }}
                style={{ flex: 1, backgroundColor: C.accent, paddingVertical: 13, borderRadius: 14, alignItems: "center" }}
              >
                <Text style={{ color: "#fff", fontFamily: "Roobert-Bold", fontSize: 15 }}>View Hotspot</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setSelected(null)}
                style={{ paddingVertical: 13, paddingHorizontal: 18, borderRadius: 14, backgroundColor: C.bg3 }}
              >
                <Text style={{ color: C.txt, fontFamily: "Roobert-SemiBold", fontSize: 15 }}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })() : (
        /* Bottom cards strip */
        <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, paddingBottom: 34 }}>
          <ScrollView
            horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingVertical: 12 }}
          >
            {sorted.slice(0, 15).map(({ hotspot, count, live }) => {
              const vibe = getVibe(count);
              return (
                <TouchableOpacity
                  key={hotspot.id}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelected(hotspot);
                    mapRef.current?.animateToRegion({
                      latitude: hotspot.location!.latitude!,
                      longitude: hotspot.location!.longitude!,
                      latitudeDelta: 0.02, longitudeDelta: 0.02,
                    }, 400);
                  }}
                  activeOpacity={0.88}
                  style={{
                    backgroundColor: C.card,
                    borderRadius: 18, padding: 12, minWidth: 160,
                    shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
                    elevation: 5,
                  }}
                >
                  {/* Avatar */}
                  <View style={{ width: "100%", height: 80, borderRadius: 12, overflow: "hidden", backgroundColor: C.bg3, marginBottom: 8 }}>
                    {hotspot.avatar
                      ? <Image source={{ uri: hotspot.avatar }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                      : <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                          <Text style={{ color: C.txt2, fontFamily: "Roobert-Bold", fontSize: 28 }}>{hotspot.name[0]}</Text>
                        </View>
                    }
                    {/* Live badge */}
                    {live > 0 && (
                      <View style={{ position: "absolute", top: 6, right: 6, backgroundColor: C.accent, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, flexDirection: "row", alignItems: "center", gap: 3 }}>
                        <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: C.accentInv }} />
                        <Text style={{ color: C.accentInv, fontFamily: "Roobert-Bold", fontSize: 9 }}>LIVE</Text>
                      </View>
                    )}
                  </View>

                  <Text style={{ color: C.txt, fontFamily: "Roobert-SemiBold", fontSize: 13 }} numberOfLines={1}>{hotspot.name}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <View style={{ backgroundColor: C.pill, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 }}>
                      <Text style={{ color: C.txt2, fontFamily: "Roobert-Bold", fontSize: 10 }}>{vibe.label}</Text>
                    </View>
                    <Text style={{ color: C.txt2, fontFamily: "Roobert-Regular", fontSize: 10 }}>{count} today</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}
