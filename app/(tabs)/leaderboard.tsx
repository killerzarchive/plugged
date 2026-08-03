import {
  LEADERBOARD_HOTSPOTS,
  LEADERBOARD_HOTSPOTS_BY_POINTS,
  ME_QUERY,
} from "@/app/apollo/queries/general";
import { getActivityStatus } from "@/components/ui/HotspotRow";
import { DARK_MAP_STYLE } from "@/constants/mapStyle";
import { useColors } from "@/contexts/theme";
import { useQuery } from "@apollo/client/react";
import * as Haptics from "expo-haptics";
import { Video, ResizeMode } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import * as ExpoLocation from "expo-location";
import { router } from "expo-router";
import {
  ArrowRight,
  ArrowUpRight,
  MapPin,
  Maximize2,
  Minimize2,
  Navigation,
  Zap,
} from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated as RNAnimated,
  Dimensions,
  FlatList,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { getCityState } from "@/lib/address";
import MapView, { Heatmap, Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";

function isVideo(uri: string): boolean {
  return /\.(mp4|mov|m4v|webm|m3u8)(\?|$)/i.test(uri);
}

function PulseDot({ color = "#fff", size = 5 }: { color?: string; size?: number }) {
  const opacity = useRef(new RNAnimated.Value(1)).current;
  useEffect(() => {
    const anim = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(opacity, { toValue: 0.15, duration: 600, useNativeDriver: true }),
        RNAnimated.timing(opacity, { toValue: 1,    duration: 600, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, []);
  return (
    <RNAnimated.View
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignSelf: "center", opacity }}
    />
  );
}

function CrownIcon({
  size = 20,
  color = "#E1306C",
}: {
  size?: number;
  color?: string;
}) {
  const h = size * 0.75;
  return (
    <Svg width={size} height={h} viewBox="0 0 100 75">
      <Path
        d="M3,68 Q50,74 97,68 L88,36 L78,52 L68,24 L58,44 L50,16 L42,44 L32,24 L22,52 L12,36 Z"
        fill={color}
      />
      <Circle cx="12" cy="27" r="9" fill={color} />
      <Circle cx="32" cy="15" r="9" fill={color} />
      <Circle cx="50" cy="7" r="9" fill={color} />
      <Circle cx="68" cy="15" r="9" fill={color} />
      <Circle cx="88" cy="27" r="9" fill={color} />
    </Svg>
  );
}

const { width: SW } = Dimensions.get("window");
const SIDE = 18;

const geocodeCache = new Map<string, { lat: number; lng: number }>();

// ─── Types ────────────────────────────────────────────────────────────────────
interface CheckIn {
  id: string;
  createdAt?: string;
}
interface PostEntry {
  id: string;
  createdAt?: string;
}
interface HotspotEntry {
  id: string;
  name: string;
  avatar?: string;
  type?: string;
  isEvent?: boolean;
  isPopup?: boolean;
  points?: number;
  checkins?: CheckIn[];
  posts?: PostEntry[];
  displayPosts?: { id: string; media?: string }[];
  location?: { latitude: number; longitude: number; address?: string };
}
interface LeaderboardEntry {
  periodPoints: number;
  hotspot: HotspotEntry;
}
type Period = "24h" | "7d" | "30d";

const PERIODS: { key: Period; label: string; dot: string }[] = [
  { key: "24h", label: "Daily", dot: "#3B82F6" },
  { key: "7d", label: "Weekly", dot: "#3B82F6" },
  { key: "30d", label: "Monthly", dot: "#3B82F6" },
];

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function cutoff(p: Period): number {
  const now = Date.now();
  if (p === "24h") return now - 86_400_000;
  if (p === "7d") return now - 604_800_000;
  return now - 2_592_000_000;
}

function checkinCount(h: HotspotEntry, p: Period): number {
  if (!h.checkins?.length) return 0;
  const since = cutoff(p);
  return h.checkins.filter(
    (ci) => ci.createdAt && new Date(ci.createdAt).getTime() >= since,
  ).length;
}

function postCount(h: HotspotEntry, p: Period): number {
  if (!h.posts?.length) return 0;
  const since = cutoff(p);
  return h.posts.filter(
    (post) => post.createdAt && new Date(post.createdAt).getTime() >= since,
  ).length;
}

// ─── Explore-style map pin ────────────────────────────────────────────────────
function HotspotPin({
  hotspot,
  live,
  isTop,
  onReady,
}: {
  hotspot: HotspotEntry;
  live: boolean;
  isTop?: boolean;
  onReady?: () => void;
}) {
  const circle = (
    <View style={[styles.pinCircle, live && { borderColor: "transparent" }]}>
      {hotspot.avatar ? (
        <Image
          source={{ uri: hotspot.avatar }}
          style={{ width: "100%", height: "100%", borderRadius: 999 }}
          resizeMode="cover"
          onLoad={onReady}
          onError={onReady}
        />
      ) : (
        <MapPin size={16} color="#fff" />
      )}
    </View>
  );

  return (
    <View style={{ alignItems: "center" }}>
      {isTop && <CrownIcon size={18} color="#f9bf00" />}
      {live ? (
        <LinearGradient
          colors={["#833AB4", "#1877F2", "#833AB4"]}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
          style={{
            borderRadius: 30,
            padding: 2.5,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {circle}
        </LinearGradient>
      ) : (
        circle
      )}
      <View
        style={[styles.pinTriangle, live && { borderTopColor: "#E1306C" }]}
      />
    </View>
  );
}

function LeaderboardMarker({
  hotspot,
  lat,
  lng,
  isTop,
}: {
  hotspot: HotspotEntry;
  lat: number;
  lng: number;
  isTop?: boolean;
}) {
  const [ready, setReady] = useState(!hotspot.avatar);
  const live = checkinCount(hotspot, "24h") > 0;
  return (
    <Marker
      coordinate={{ latitude: lat, longitude: lng }}
      anchor={{ x: 0.5, y: 1 }}
      tracksViewChanges={!ready}
      onPress={() => {
        Haptics.selectionAsync();
        router.push(`/profile-view?type=hotspot&id=${hotspot.id}` as any);
      }}
    >
      <HotspotPin
        hotspot={hotspot}
        live={live}
        isTop={isTop}
        onReady={() => setReady(true)}
      />
    </Marker>
  );
}

// ─── Cover image helper ───────────────────────────────────────────────────────
function CoverImage({
  uri,
  initial,
  fontSize = 40,
}: {
  uri?: string;
  initial: string;
  fontSize?: number;
}) {
  const C = useColors();
  return uri ? (
    <Image
      source={{ uri }}
      style={{ width: "100%", height: "100%" }}
      resizeMode="cover"
    />
  ) : (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: C.bg3,
      }}
    >
      <Text style={{ color: C.txt3, fontFamily: "Roobert-Bold", fontSize }}>
        {initial}
      </Text>
    </View>
  );
}

// ─── Top 3 strip (header) ─────────────────────────────────────────────────────
function TopThreeStrip({
  items,
}: {
  items: ({ hotspot: HotspotEntry; periodPoints: number } | undefined)[];
}) {
  const C = useColors();
  const [p1, p2, p3] = items;
  // display order: 2nd, 1st (center), 3rd
  const slots: { item: typeof p1; rank: number; size: number }[] = [
    { item: p2, rank: 2, size: 36 },
    { item: p1, rank: 1, size: 46 },
    { item: p3, rank: 3, size: 36 },
  ];
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "space-between",
      }}
    >
      {slots.map(({ item, rank, size }) => {
        const r = size / 2;
        if (!item) return <View key={rank} style={{ flex: 1 }} />;
        const initial = item.hotspot.name?.[0]?.toUpperCase() ?? "?";
        return (
          <TouchableOpacity
            key={item.hotspot.id}
            style={{ flex: 1, alignItems: "center", gap: 8 }}
            onPress={() => {
              Haptics.selectionAsync();
              router.push(`/profile-view?type=hotspot&id=${item.hotspot.id}` as any);
            }}
            activeOpacity={0.82}
          >
            <View style={{ position: "relative" }}>
              <LinearGradient
                colors={["#1877F2", "#1877F2", "#1877F2"]}
                start={{ x: 0, y: 1 }}
                end={{ x: 1, y: 0 }}
                style={{
                  width: size,
                  height: size,
                  borderRadius: r,
                  padding: 2.5,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <View
                  style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: r - 2,
                    overflow: "hidden",
                    borderWidth: 1.5,
                    borderColor: "#000",
                    backgroundColor: C.bg3,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <CoverImage
                    uri={item.hotspot.avatar}
                    initial={initial}
                    fontSize={size * 0.28}
                  />
                </View>
              </LinearGradient>
              {rank === 1 && (
                <View
                  style={{
                    position: "absolute",
                    top: -5,
                    right: -1,
                    transform: [{ rotate: "30deg" }],
                  }}
                >
                  <CrownIcon size={19} color="#f9bf00" />
                </View>
              )}
            </View>
            <View style={{ alignItems: "center", gap: 2 }}>
              <Text
                style={{
                  color: "#fff",
                  fontFamily: "Roobert-SemiBold",
                  fontSize: 10,
                  letterSpacing: -0.2,
                  maxWidth: 100,
                  textAlign: "center",
                }}
                numberOfLines={1}
              >
                {item.hotspot.name}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Carousel card (rank 4+) ──────────────────────────────────────────────────
function LeaderboardCard({
  rank,
  hotspot,
  periodPoints,
}: {
  rank: number;
  hotspot: HotspotEntry;
  periodPoints: number;
  period: Period;
}) {
  const C = useColors();
  const score = checkinCount(hotspot, "24h");
  const { color, label } = getActivityStatus(score);
  const live = score > 0 || postCount(hotspot, "24h") > 0;
  const cover = hotspot.avatar ?? hotspot.displayPosts?.[0]?.media;
  const mediaPosts = (hotspot.displayPosts ?? []).filter((p) => p.media);
  const visiblePosts = mediaPosts.slice(0, 3);
  const overflow = mediaPosts.length - 3;

  return (
    <View style={{ width: SW, paddingHorizontal: 15 }}>
      <View style={{ borderRadius: 40, borderColor: C.border, padding: 16, backgroundColor: "#000", position: "relative" }}>

        {/* Top row */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1, marginRight: 8 }}>

            {/* Avatar + rank badge */}
            <View>
              <LinearGradient
                colors={live ? ["#833AB4", "#1877F2", "#833AB4"] : ["#1a1a1a", "#1a1a1a"]}
                start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }}
                style={{ width: 50, height: 50, borderRadius: 30, padding: 2.5, alignItems: "center", justifyContent: "center" }}
              >
                <View style={{ width: "100%", height: "100%", borderRadius: 28, overflow: "hidden", borderWidth: 2, borderColor: C.bg, backgroundColor: C.bg3, alignItems: "center", justifyContent: "center" }}>
                  {cover
                    ? <Image source={{ uri: cover }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                    : <MapPin size={16} color={C.txt2} strokeWidth={1.5} />
                  }
                </View>
              </LinearGradient>
              {/* Rank badge */}
              <View style={{ position: "absolute", bottom: -5, left: -5, backgroundColor: "#000", borderRadius: 8, paddingHorizontal: 5, paddingVertical: 2, borderWidth: StyleSheet.hairlineWidth, borderColor: "#333" }}>
                <Text style={{ color: "#fff", fontFamily: "Roobert-Bold", fontSize: 10, letterSpacing: -0.3 }}>#{rank}</Text>
              </View>
            </View>

            {/* Name + status + points */}
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.txt, fontFamily: "Roobert-Bold", fontSize: 18, letterSpacing: -0.6, lineHeight: 24 }} numberOfLines={1}>
                {hotspot.name}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
                <PulseDot color={color} size={6} />
                <Text style={{ color, fontFamily: "Roobert-Bold", fontSize: 11 }}>{label}</Text>
                {hotspot.type && (
                  <Text style={{ color: "#fff", fontFamily: "Roobert-SemiBold", fontSize: 11 }}>{hotspot.type}</Text>
                )}
              </View>
              <Text style={{ color: "#3B82F6", fontFamily: "Roobert-Bold", fontSize: 11, letterSpacing: -0.2, marginTop: 3 }}>
                {periodPoints.toLocaleString()} pts
              </Text>
            </View>
          </View>

          {/* Stacked post thumbnails */}
          {visiblePosts.length > 0 && (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              {visiblePosts.map((post, i) => (
                <View key={post.id} style={{ width: 44, height: 44, borderRadius: 22, overflow: "hidden", backgroundColor: C.bg3, borderWidth: 4, borderColor: "#000", marginLeft: i === 0 ? 0 : -12, zIndex: 3 - i }}>
                  {isVideo(post.media!) ? (
                    <Video source={{ uri: post.media! }} style={{ width: "100%", height: "100%" }} resizeMode={ResizeMode.COVER} shouldPlay isLooping isMuted />
                  ) : (
                    <Image source={{ uri: post.media! }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                  )}
                </View>
              ))}
              {overflow > 0 && (
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.bg3, borderWidth: 4, borderColor: "#000", marginLeft: -12, zIndex: 0, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: C.txt2, fontFamily: "Roobert-Bold", fontSize: 11 }}>+{overflow}</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Location row */}
        {hotspot.location?.address ? (
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 6 }}>
            <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: "#111", alignItems: "center", justifyContent: "center" }}>
              <Navigation size={15} color={C.txt} strokeWidth={1.5} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.txt, fontFamily: "Roobert-Bold", fontSize: 15 }}>Location</Text>
              <Text numberOfLines={2} style={{ color: "white", fontFamily: "Roobert-Medium", fontSize: 11.5, lineHeight: 16, marginTop: 3, marginRight: 70 }}>
                {hotspot.location.address}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Navigate button */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push(`/profile-view?type=hotspot&id=${hotspot.id}` as any)}
          style={{ position: "absolute", bottom: 20, right: 19, width: 48, height: 48, borderRadius: 24, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }}
        >
          <ArrowRight size={18} color="#000" strokeWidth={2.5} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function LeaderboardScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const [headerH, setHeaderH] = useState(0);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [period, setPeriod] = useState<Period>("7d");
  const [scope, setScope] = useState<"city" | "world">("city");
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const [, setUserCity] = useState<string | null>(null);
  const [geocodeTick, setGeocodeTick] = useState(0);

  const { data: meData } = useQuery<{ me: { pfp?: string } }>(ME_QUERY);
  const mePfp = meData?.me?.pfp;

  const { data, loading, error } = useQuery<{
    leaderboardHotspotsByPoints: LeaderboardEntry[];
  }>(LEADERBOARD_HOTSPOTS_BY_POINTS, {
    variables: { period, take: 50 },
    fetchPolicy: "cache-and-network",
  });

  // Fallback: fetch all hotspots for when no point transactions exist yet
  const { data: fallbackData } = useQuery<{
    leaderboardHotspots: HotspotEntry[];
  }>(LEADERBOARD_HOTSPOTS, { fetchPolicy: "cache-and-network" });

  const pointEntries = (data?.leaderboardHotspotsByPoints ?? []).filter(
    (e) => !e.hotspot.isEvent && !e.hotspot.isPopup,
  );
  const hasPointData = pointEntries.length > 0;

  // If no point data yet, build entries from the fallback query ranked by checkin count
  const allEntries: LeaderboardEntry[] = hasPointData
    ? pointEntries
    : (fallbackData?.leaderboardHotspots ?? [])
        .filter((h) => !h.isEvent && !h.isPopup)
        .map((h) => ({
          hotspot: h,
          periodPoints: h.points ?? checkinCount(h, period) * 10,
        }))
        .sort((a, b) => b.periodPoints - a.periodPoints);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allHotspots = useMemo(() => allEntries.map((e) => e.hotspot), [data, fallbackData, period]);

  useEffect(() => {
    (async () => {
      try {
        const { status } =
          await ExpoLocation.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const pos = await ExpoLocation.getCurrentPositionAsync({
          accuracy: ExpoLocation.Accuracy.Balanced,
        });
        const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setUserCoords(coords);
        const geo = await ExpoLocation.reverseGeocodeAsync({
          latitude: coords.lat,
          longitude: coords.lon,
        });
        if (geo?.[0]?.city) setUserCity(geo[0].city);
      } catch {}
    })();
  }, []);

  // Geocode every hotspot address — address is ground truth, DB coords are user GPS at check-in
  useEffect(() => {
    const needsGeocode = allHotspots.filter(
      (h) => !!h.location?.address && !geocodeCache.has(h.id),
    );
    if (!needsGeocode.length) return;
    (async () => {
      let didUpdate = false;
      for (let i = 0; i < needsGeocode.length; i += 5) {
        await Promise.all(
          needsGeocode.slice(i, i + 5).map(async (h) => {
            try {
              const results = await ExpoLocation.geocodeAsync(h.location!.address!);
              if (results?.[0]) {
                geocodeCache.set(h.id, { lat: results[0].latitude, lng: results[0].longitude });
                didUpdate = true;
              }
            } catch {}
          }),
        );
      }
      if (didUpdate) setGeocodeTick((t) => t + 1);
    })();
  }, [allHotspots]);

  const RADIUS_KM = 80.47; // 50 miles

  // Resolve each hotspot to its real coords: geocoded address > raw DB fallback
  const withCoords = useMemo(() => {
    return allHotspots
      .map((h) => {
        const geo = geocodeCache.get(h.id);
        const rawLat = h.location?.latitude;
        const rawLng = h.location?.longitude;
        const hasRaw =
          rawLat != null && rawLng != null && !(rawLat === 0 && rawLng === 0);
        const lat = geo?.lat ?? (hasRaw ? rawLat! : undefined);
        const lng = geo?.lng ?? (hasRaw ? rawLng! : undefined);
        return lat != null && lng != null ? { hotspot: h, lat, lng } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [allHotspots, geocodeTick]);

  // All hotspots within 50 miles using real coords
  const nearbyAll = useMemo(() => {
    return withCoords.filter(({ lat, lng }) => {
      if (!userCoords) return true;
      return haversineKm(userCoords.lat, userCoords.lon, lat, lng) <= RADIUS_KM;
    });
  }, [withCoords, userCoords]);

  const pointsMap = useMemo(
    () => new Map(allEntries.map((e) => [e.hotspot.id, e.periodPoints])),
    [allEntries],
  );

  const scopedList = scope === "city" ? nearbyAll : withCoords;

  // Extract unique cities from scoped list for the city pills
  const nearbyCities = useMemo(() => {
    const counts = new Map<string, number>();
    for (const { hotspot } of scopedList) {
      const addr = hotspot.location?.address;
      if (!addr) continue;
      const parts = addr.split(",").map((s) => s.trim()).filter(Boolean);
      const city = parts.length >= 4 ? parts[1] : parts[0];
      if (city) counts.set(city, (counts.get(city) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .filter(([, count]) => count >= 4)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([city]) => city);
  }, [scopedList]);

  // Filter by selected city
  const cityFiltered = useMemo(() => {
    if (!selectedCity) return scopedList;
    return scopedList.filter(({ hotspot }) =>
      (hotspot.location?.address ?? "").includes(selectedCity),
    );
  }, [scopedList, selectedCity]);

  // Ranked list: cityFiltered sorted by server-computed period points
  const ranked = useMemo(() => {
    return cityFiltered
      .map(({ hotspot }) => ({
        hotspot,
        periodPoints: pointsMap.get(hotspot.id) ?? 0,
      }))
      .sort((a, b) => b.periodPoints - a.periodPoints)
      .slice(0, 50);
  }, [cityFiltered, pointsMap]);

  const [p1, p2, p3] = ranked;
  const rest = ranked.slice(3);

  const cityTotalPoints = useMemo(
    () => cityFiltered.reduce((sum, { hotspot }) => sum + (pointsMap.get(hotspot.id) ?? 0), 0),
    [cityFiltered, pointsMap],
  );

  const heatPoints = useMemo(() => {
    const maxPts = Math.max(...withCoords.map(({ hotspot }) => pointsMap.get(hotspot.id) ?? 0), 1);
    return withCoords
      .map(({ hotspot, lat, lng }) => ({
        latitude: lat,
        longitude: lng,
        weight: Math.max(0.1, ((pointsMap.get(hotspot.id) ?? 0) / maxPts) * 10),
      }));
  }, [withCoords, pointsMap]);

  // Fit map to all nearby hotspots using real coords
  const mapRegion = useMemo(() => {
    if (nearbyAll.length === 0) {
      return {
        latitude: userCoords?.lat ?? 30.2672,
        longitude: userCoords?.lon ?? -97.7431,
        latitudeDelta: 0.06,
        longitudeDelta: 0.06,
      };
    }
    const lats = nearbyAll.map((x) => x.lat);
    const lngs = nearbyAll.map((x) => x.lng);
    const minLat = Math.min(...lats),
      maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs),
      maxLng = Math.max(...lngs);
    const pad = 0.025;
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(0.04, maxLat - minLat + pad),
      longitudeDelta: Math.max(0.04, maxLng - minLng + pad),
    };
  }, [nearbyAll, userCoords]);

  if (loading && !data) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: C.bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <StatusBar barStyle={C.statusBar} />
        <ActivityIndicator color={C.txt3} size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: C.bg,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 40,
        }}
      >
        <StatusBar barStyle={C.statusBar} />
        <Text
          style={{
            color: C.txt2,
            fontFamily: "Roobert-Regular",
            fontSize: 14,
            textAlign: "center",
          }}
        >
          {error.message}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

      {/* ── Full-screen map behind everything ── */}
      <View
        style={{
          position: "absolute",
          top: mapExpanded ? 0 : headerH,
          left: 0,
          right: 0,
          bottom: 0,
          borderTopLeftRadius: mapExpanded ? 0 : 40,
          borderTopRightRadius: mapExpanded ? 0 : 40,
          overflow: "hidden",
        }}
      >
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          provider={PROVIDER_GOOGLE}
          customMapStyle={DARK_MAP_STYLE}
          region={mapRegion}
          showsUserLocation={false}
          showsMyLocationButton={false}
          showsCompass={false}
          showsScale={false}
          showsBuildings={false}
          showsTraffic={false}
          showsIndoors={false}
          rotateEnabled={false}
          pitchEnabled={false}
          moveOnMarkerPress={false}
        >
          {cityFiltered.slice(0, 30).map(({ hotspot, lat, lng }) => (
            <LeaderboardMarker
              key={hotspot.id}
              hotspot={hotspot}
              lat={lat}
              lng={lng}
              isTop={hotspot.id === ranked[0]?.hotspot.id}
            />
          ))}
          {userCoords && (
            <Marker
              coordinate={{
                latitude: userCoords.lat,
                longitude: userCoords.lon,
              }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  borderWidth: 2.5,
                  borderColor: "#fff",
                  overflow: "hidden",
                  backgroundColor: "#1a1a1a",
                }}
              >
                {mePfp ? (
                  <Image
                    source={{ uri: mePfp }}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={{
                      flex: 1,
                      backgroundColor: "#333",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: "#fff",
                      }}
                    />
                  </View>
                )}
              </View>
            </Marker>
          )}
          {mapExpanded && heatPoints.length > 0 && (
            <Heatmap
              points={heatPoints}
              radius={60}
              opacity={0.72}
              gradient={{
                colors: ["#3B82F6", "#833AB4", "#E1306C", "#FF6B35"],
                startPoints: [0.1, 0.4, 0.7, 1.0],
                colorMapSize: 256,
              }}
            />
          )}
        </MapView>
      </View>

      {/* ── Black header with podium ── */}
      <View
        onLayout={(e) => setHeaderH(e.nativeEvent.layout.height)}
        style={[styles.topHeader, { paddingTop: insets.top, zIndex: 2, display: mapExpanded ? "none" : "flex" }]}
      >
        {/* Title row */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View
              style={{
                width: 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: "#fff",
              }}
            />
            <Text style={styles.screenTitle}>leaderboard</Text>
          </View>
          <View
            style={{
              flexDirection: "row",
              backgroundColor: "#000",
              borderRadius: 20,
              padding: 3,
              gap: 2,
              borderColor: "#111",
              borderWidth: 1,
            }}
          >
            {(["city", "world"] as const).map((s) => (
              <TouchableOpacity
                key={s}
                onPress={() => {
                  Haptics.selectionAsync();
                  setScope(s);
                  setSelectedCity(null);
                }}
                activeOpacity={0.82}
                style={{
                  paddingHorizontal: 11,
                  paddingVertical: 7,
                  borderRadius: 15,
                  backgroundColor: scope === s ? "#fff" : "transparent",
                }}
              >
                <Text
                  style={{
                    color: scope === s ? "#000" : "#fff",
                    fontFamily: "Roobert-Bold",
                    fontSize: 11,
                  }}
                >
                  {s === "city" ? "City" : "World"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Podium */}
        {(p1 || p2 || p3) && (
          <View style={{ paddingTop: 10, paddingBottom: 3 }}>
            <TopThreeStrip items={[p1, p2, p3]} />
          </View>
        )}
      </View>

      {/* ── Map top overlay: city points + expand ── */}
      <View
        style={{
          position: "absolute",
          top: mapExpanded ? insets.top + 14 : headerH + 14,
          left: 16,
          right: 16,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          zIndex: 20,
        }}
      >
        <View style={styles.pointsOverlayPill}>
          <Zap size={11} color="#FFD700" strokeWidth={2.5} fill="#FFD700" />
          <Text style={styles.pointsOverlayText}>
            {cityTotalPoints.toLocaleString()} pts
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => { Haptics.selectionAsync(); setMapExpanded((v) => !v); }}
          activeOpacity={0.82}
          style={styles.expandBtn}
        >
          {mapExpanded
            ? <Minimize2 size={15} color="#fff" strokeWidth={2} />
            : <Maximize2 size={15} color="#fff" strokeWidth={2} />
          }
        </TouchableOpacity>
      </View>

      {/* ── City pills overlay on map ── */}
      {nearbyCities.length > 0 && (
        <View style={{ position: "absolute", top: mapExpanded ? insets.top + 55 : headerH + 55, left: 0, right: 0, zIndex: 5 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          >
            <TouchableOpacity
              onPress={() => { Haptics.selectionAsync(); setSelectedCity(null); }}
              activeOpacity={0.82}
              style={{
                flexDirection: "row", alignItems: "center", gap: 6,
                paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
                backgroundColor: selectedCity === null ? "#fff" : "rgba(0,0,0,0.72)",
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: selectedCity === null ? "#fff" : "rgba(255,255,255,0.25)",
              }}
            >
              <PulseDot color="#3B82F6" size={5} />
              <Text style={{
                color: selectedCity === null ? "#000" : "#fff",
                fontFamily: "Roobert-Bold", fontSize: 12,
              }}>All</Text>
            </TouchableOpacity>
            {nearbyCities.map((city) => (
              <TouchableOpacity
                key={city}
                onPress={() => { Haptics.selectionAsync(); setSelectedCity(city === selectedCity ? null : city); }}
                activeOpacity={0.82}
                style={{
                  flexDirection: "row", alignItems: "center", gap: 6,
                  paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
                  backgroundColor: selectedCity === city ? "#fff" : "rgba(0,0,0,0.72)",
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: selectedCity === city ? "#fff" : "rgba(255,255,255,0.25)",
                }}
              >
                <PulseDot color="#3B82F6" size={5} />
                <Text style={{
                  color: selectedCity === city ? "#000" : "#fff",
                  fontFamily: "Roobert-Bold", fontSize: 12,
                }}>{city}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── Floating period pills ── */}
      {!mapExpanded && <View style={styles.pillRow}>
        {PERIODS.map((p) => {
          const active = period === p.key;
          return (
            <TouchableOpacity
              key={p.key}
              onPress={() => {
                Haptics.selectionAsync();
                setPeriod(p.key);
              }}
              activeOpacity={0.75}
              style={[
                styles.pill,
                {
                  backgroundColor: active ? "#fff" : "#000",
                },
              ]}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
              >
                <PulseDot color={active ? "#3B82F6" : "#fff"} size={5} />
                <Text
                  style={{
                    color: active ? "#000" : "rgba(255,255,255,0.6)",
                    fontFamily: "Roobert-Bold",
                    fontSize: 11,
                  }}
                >
                  {p.label}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>}

      {/* ── Floating carousel (rank 4+) ── */}
      {!mapExpanded && <FlatList
        data={[...rest].sort((a, b) => b.periodPoints - a.periodPoints)}
        keyExtractor={({ hotspot }) => hotspot.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={SW}
        removeClippedSubviews
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        windowSize={3}
        style={styles.carousel}
        contentContainerStyle={{ paddingHorizontal: 0 }}
        renderItem={({ item, index }) => (
          <LeaderboardCard
            rank={index + 4}
            hotspot={item.hotspot}
            periodPoints={item.periodPoints}
            period={period}
          />
        )}
      />}
    </View>
  );
}

const styles = StyleSheet.create({
  mapFade: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  topHeader: {
    backgroundColor: "#000",
    flexDirection: "column",
    paddingHorizontal: SIDE,
    paddingBottom: 14,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  screenTitle: {
    fontFamily: "Roobert-Bold",
    fontSize: 22,
    letterSpacing: -0.6,
    color: "#fff",
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  // Floating pills
  pillRow: {
    position: "absolute",
    bottom: 270,
    left: 26,
    right: 26,
    flexDirection: "row",
    gap: 8,
  },
  // Carousel
  carousel: {
    position: "absolute",
    bottom: 80,
    left: 0,
    right: 0,
  },
  pill: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 7,
    borderRadius: 20,
  },
  // Rank row list
  // Map pins
  pinCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#1a1a1a",
    borderWidth: 2,
    borderColor: "#fff",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  pinTriangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 10,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#fff",
    marginTop: -1,
  },
  pointsOverlayPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#000",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  pointsOverlayText: {
    color: "#fff",
    fontFamily: "Roobert-Bold",
    fontSize: 13,
    letterSpacing: -0.2,
  },
  expandBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
});

