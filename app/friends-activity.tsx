import { FOLLOWING_CHECKINS } from "@/app/apollo/queries/general";
import { useQuery } from "@apollo/client/react";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import * as ExpoLocation from "expo-location";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker, Region } from "react-native-maps";
import { ArrowLeft } from "lucide-react-native";
import { useColors } from "@/contexts/theme";



interface CheckInItem {
  id: string;
  createdAt: string;
  user: { id: string; name: string; pfp?: string };
  hotspot: {
    id: string; name: string; avatar?: string; type?: string;
    location?: { latitude?: number; longitude?: number; address?: string };
  };
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function FriendsActivityScreen() {
  const C = useColors();
  const { data, loading } = useQuery<{ followerRecentCheckins: CheckInItem[] }>(FOLLOWING_CHECKINS, {
    variables: { skip: 0, take: 50 },
    fetchPolicy: "cache-and-network",
  });

  const mapRef = useRef<MapView>(null);
  const [selected, setSelected] = useState<CheckInItem | null>(null);

  const checkins = data?.followerRecentCheckins ?? [];
  const mapped = checkins.filter(
    c => c.hotspot.location?.latitude != null && c.hotspot.location?.longitude != null
  );

  // Fit map to all pins once loaded
  useEffect(() => {
    if (!mapped.length || !mapRef.current) return;
    const coords = mapped.map(c => ({
      latitude: c.hotspot.location!.latitude!,
      longitude: c.hotspot.location!.longitude!,
    }));
    setTimeout(() => {
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 80, right: 40, bottom: 260, left: 40 },
        animated: true,
      });
    }, 400);
  }, [mapped.length]);

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
        initialRegion={{ latitude: 37.78, longitude: -122.43, latitudeDelta: 0.1, longitudeDelta: 0.1 }}
      >
        {mapped.map(c => (
          <Marker
            key={c.id}
            coordinate={{ latitude: c.hotspot.location!.latitude!, longitude: c.hotspot.location!.longitude! }}
            onPress={() => { Haptics.selectionAsync(); setSelected(c); }}
            tracksViewChanges={false}
          >
            {/* Stacked: user pfp on top of hotspot avatar */}
            <View style={{ alignItems: "center" }}>
              {/* Hotspot avatar (base) */}
              <View style={{
                width: 48, height: 48, borderRadius: 14,
                overflow: "hidden", borderWidth: 2.5, borderColor: "#fff",
                backgroundColor: "#1C1C1E",
                shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
                elevation: 6,
              }}>
                {c.hotspot.avatar
                  ? <Image source={{ uri: c.hotspot.avatar }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                  : <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#2C2C2E" }}>
                      <Text style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Roobert-Bold", fontSize: 18 }}>
                        {c.hotspot.name[0]}
                      </Text>
                    </View>
                }
              </View>

              {/* User pfp (floating top-right) */}
              <View style={{
                position: "absolute", top: -8, right: -8,
                width: 24, height: 24, borderRadius: 12,
                overflow: "hidden", borderWidth: 2, borderColor: "#fff",
                backgroundColor: C.accent,
                shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
                elevation: 4,
              }}>
                {c.user.pfp
                  ? <Image source={{ uri: c.user.pfp }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                  : <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ color: "#fff", fontFamily: "Roobert-Bold", fontSize: 9 }}>{c.user.name[0]}</Text>
                    </View>
                }
              </View>

              {/* Stem */}
              <View style={{ width: 2.5, height: 10, backgroundColor: "#fff", borderRadius: 1.5, marginTop: 1 }} />
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#fff" }} />
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Back button */}
      <SafeAreaView style={{ position: "absolute", top: 0, left: 0, right: 0 }} edges={["top"]} pointerEvents="box-none">
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            marginTop: 8, marginLeft: 16,
            width: 40, height: 40, borderRadius: 20,
            backgroundColor: "rgba(0,0,0,0.5)",
            alignItems: "center", justifyContent: "center",
          }}
        >
          <ArrowLeft size={20} color="#fff" />
        </TouchableOpacity>
      </SafeAreaView>

      {/* Header title */}
      <View style={{ position: "absolute", top: 60, left: 0, right: 0, alignItems: "center" }} pointerEvents="none">
        <View style={{ backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6 }}>
          <Text style={{ color: "#fff", fontFamily: "Roobert-Bold", fontSize: 15 }}>
            {mapped.length} friend{mapped.length !== 1 ? "s" : ""} checked in
          </Text>
        </View>
      </View>

      {/* Loading */}
      {loading && (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color="#fff" size="large" />
        </View>
      )}

      {/* Bottom sheet — selected callout */}
      {selected ? (
        <View style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          backgroundColor: C.card,
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          padding: 20, paddingBottom: 40,
          shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 20, shadowOffset: { width: 0, height: -4 },
          elevation: 10,
        }}>
          {/* Handle */}
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.tertiary, alignSelf: "center", marginBottom: 16 }} />

          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            {/* Hotspot avatar */}
            <View style={{ width: 60, height: 60, borderRadius: 16, overflow: "hidden", backgroundColor: "#F0F0F0" }}>
              {selected.hotspot.avatar
                ? <Image source={{ uri: selected.hotspot.avatar }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                : <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: C.secondary, fontFamily: "Roobert-Bold", fontSize: 22 }}>{selected.hotspot.name[0]}</Text>
                  </View>
              }
            </View>

            <View style={{ flex: 1 }}>
              <Text style={{ color: C.primary, fontFamily: "Roobert-Bold", fontSize: 17 }} numberOfLines={1}>
                {selected.hotspot.name}
              </Text>
              {selected.hotspot.type && (
                <Text style={{ color: C.secondary, fontFamily: "Roobert-Regular", fontSize: 13, marginTop: 2 }}>
                  {selected.hotspot.type}
                </Text>
              )}

              {/* User row */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginTop: 8 }}>
                <View style={{ width: 22, height: 22, borderRadius: 11, overflow: "hidden", backgroundColor: C.accent }}>
                  {selected.user.pfp
                    ? <Image source={{ uri: selected.user.pfp }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                    : <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ color: "#fff", fontFamily: "Roobert-Bold", fontSize: 9 }}>{selected.user.name[0]}</Text>
                      </View>
                  }
                </View>
                <Text style={{ color: C.secondary, fontFamily: "Roobert-SemiBold", fontSize: 13 }}>{selected.user.name}</Text>
                <Text style={{ color: C.tertiary, fontFamily: "Roobert-Regular", fontSize: 12 }}>· {timeAgo(selected.createdAt)}</Text>
              </View>
            </View>
          </View>

          {/* Actions */}
          <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/profile-view?type=hotspot&id=${selected.hotspot.id}` as any); }}
              style={{ flex: 1, backgroundColor: C.accent, paddingVertical: 13, borderRadius: 14, alignItems: "center" }}
            >
              <Text style={{ color: "#fff", fontFamily: "Roobert-Bold", fontSize: 15 }}>View Hotspot</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setSelected(null)}
              style={{ paddingVertical: 13, paddingHorizontal: 18, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.06)", alignItems: "center" }}
            >
              <Text style={{ color: C.primary, fontFamily: "Roobert-SemiBold", fontSize: 15 }}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* Bottom cards strip when nothing selected */
        <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, paddingBottom: 34 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingVertical: 12 }}
          >
            {mapped.map(c => (
              <TouchableOpacity
                key={c.id}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelected(c);
                  mapRef.current?.animateToRegion({
                    latitude: c.hotspot.location!.latitude!,
                    longitude: c.hotspot.location!.longitude!,
                    latitudeDelta: 0.02,
                    longitudeDelta: 0.02,
                  }, 400);
                }}
                activeOpacity={0.88}
                style={{
                  flexDirection: "row", alignItems: "center", gap: 10,
                  backgroundColor: "rgba(255,255,255,0.95)",
                  borderRadius: 18, paddingVertical: 10, paddingHorizontal: 12,
                  shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
                  elevation: 5, minWidth: 180,
                }}
              >
                {/* Hotspot avatar */}
                <View style={{ width: 42, height: 42, borderRadius: 12, overflow: "hidden", backgroundColor: "#F0F0F0" }}>
                  {c.hotspot.avatar
                    ? <Image source={{ uri: c.hotspot.avatar }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                    : <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ color: C.secondary, fontFamily: "Roobert-Bold", fontSize: 16 }}>{c.hotspot.name[0]}</Text>
                      </View>
                  }
                  {/* User pfp badge */}
                  <View style={{ position: "absolute", bottom: -4, right: -4, width: 18, height: 18, borderRadius: 9, overflow: "hidden", borderWidth: 1.5, borderColor: "#fff", backgroundColor: C.accent }}>
                    {c.user.pfp
                      ? <Image source={{ uri: c.user.pfp }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                      : <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                          <Text style={{ color: "#fff", fontSize: 7, fontFamily: "Roobert-Bold" }}>{c.user.name[0]}</Text>
                        </View>
                    }
                  </View>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.primary, fontFamily: "Roobert-SemiBold", fontSize: 13 }} numberOfLines={1}>{c.hotspot.name}</Text>
                  <Text style={{ color: C.secondary, fontFamily: "Roobert-Regular", fontSize: 11, marginTop: 1 }} numberOfLines={1}>
                    {c.user.name} · {timeAgo(c.createdAt)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}
