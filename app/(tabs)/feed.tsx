import {
  ALL_HOTSPOTS,
  ALL_POPUPS,
  LEADERBOARD_HOTSPOTS,
  LEADERBOARD_PLUGGED_IN_USERS,
  LEADERBOARD_USERS_BY_POINTS,
  ME_QUERY,
} from "@/app/apollo/queries/general";
import {
  getActivityStatus,
  HotspotRow,
  PulseDot,
} from "@/components/ui/HotspotRow";
import { DARK_MAP_STYLE } from "@/constants/mapStyle";
import { computeMedalPointsForUser } from "@/constants/medals";
import { useColors } from "@/contexts/theme";
import { useQuery } from "@apollo/client/react";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import * as ExpoLocation from "expo-location";
import { router } from "expo-router";
import {
  CalendarDays,
  Coffee,
  Compass,
  MapPin,
  Maximize2,
  Music,
  ShoppingBag,
  Utensils,
  Wine,
  X,
} from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle as SvgCircle, Path } from "react-native-svg";

const { width: SW } = Dimensions.get("window");

const RADIUS_KM = 40.23; // 25 miles
const RADIUS_M = 40233.5; // 25 miles in meters for Circle
const geocodeCache = new Map<string, { lat: number; lng: number }>();

const CATEGORIES = [
  { id: "restaurant", label: "Eats", Icon: Utensils },
  { id: "club", label: "Clubs", Icon: Music },
  { id: "bar", label: "Bars", Icon: Wine },
  { id: "outing", label: "Outings", Icon: Compass },
  { id: "event", label: "Events", Icon: CalendarDays },
  { id: "market", label: "Markets", Icon: ShoppingBag },
  { id: "coffee", label: "Coffee", Icon: Coffee },
] as const;

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

interface StoryUser {
  id: string;
  name: string;
  pfp?: string;
  location?: { latitude: number; longitude: number };
}
interface StorySpot {
  id: string;
  name: string;
  avatar?: string;
  type?: string;
  location?: { latitude?: number; longitude?: number; address?: string };
  posts?: { createdAt: string }[];
}

interface MeData {
  me: {
    pfp?: string;
    name: string;
    points?: number;
  };
}

type StoryItem =
  | { kind: "user"; data: StoryUser }
  | { kind: "hotspot"; data: StorySpot };

// ─── Story bubble ─────────────────────────────────────────────────────────────
function StoryBubble({ item }: { item: StoryItem }) {
  const C = useColors();
  const uri = item.kind === "user" ? item.data.pfp : item.data.avatar;
  const label = item.data.name;
  const initial = label[0]?.toUpperCase() ?? "?";

  function onPress() {
    Haptics.selectionAsync();
    if (item.kind === "user") router.push(`/profile-view?type=user&id=${item.data.id}` as any);
    else router.push(`/profile-view?type=hotspot&id=${item.data.id}` as any);
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      style={styles.bubbleWrap}
    >
      <LinearGradient
        colors={["#1877F2", "#1877F2", "#1877F2"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: 54,
          height: 54,
          borderRadius: 27,
          padding: 2.5,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          style={{
            width: 49,
            height: 49,
            borderRadius: 24.5,
            backgroundColor: C.bg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View
            style={{
              width: 45,
              height: 45,
              borderRadius: 22.5,
              overflow: "hidden",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: 'black',
            }}
          >
            {uri ? (
              <Image
                source={{ uri }}
                style={StyleSheet.absoluteFillObject}
                resizeMode="cover"
              />
            ) : (
              <Text
                style={{
                  color: "#fff",
                  fontFamily: "Roobert-Bold",
                  fontSize: 15,
                }}
              >
                {initial}
              </Text>
            )}
          </View>
        </View>
      </LinearGradient>
      <Text style={[styles.bubbleLabel, { color: C.txt }]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Hotspot card ─────────────────────────────────────────────────────────────
function HotspotCard({ hotspot }: { hotspot: StorySpot }) {
  const C = useColors();
  const { color, label } = getActivityStatus(0);

  return (
    <TouchableOpacity
      onPress={() => {
        Haptics.selectionAsync();
        router.push(`/profile-view?type=hotspot&id=${hotspot.id}` as any);
      }}
      activeOpacity={0.82}
      style={[styles.hotspotCard, { backgroundColor: "#000" }]}
    >
      <View style={[styles.hotspotAvatar, {}]}>
        {hotspot.avatar ? (
          <Image
            source={{ uri: hotspot.avatar }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
          />
        ) : (
          <MapPin size={18} color={C.txt3} strokeWidth={1.5} />
        )}
      </View>
      <View style={styles.hotspotInfo}>
        <Text style={[styles.hotspotName, { color: C.txt }]} numberOfLines={1}>
          {hotspot.name}
        </Text>
        {hotspot.type && (
          <Text
            style={[styles.hotspotType, { color: C.txt3 }]}
            numberOfLines={1}
          >
            {hotspot.type}
          </Text>
        )}
        {hotspot.location?.address ? (
          <Text
            style={[styles.hotspotAddress, { color: C.txt3 }]}
            numberOfLines={2}
          >
            {hotspot.location.address}
          </Text>
        ) : null}
        <View style={styles.hotspotStatus}>
          <PulseDot color="#3B82F6" size={5} />
          <Text style={[styles.hotspotStatusLabel, { color }]}>{label}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const H24 = 24 * 60 * 60 * 1000;

function extractCity(address: string): string {
  const parts = address.split(",").map((s) => s.trim());
  return parts.length >= 3 ? parts[1] : parts[0];
}

function cityHeat(score: number): string {
  if (score === 0) return "quiet";
  if (score <= 4) return "warming up";
  if (score <= 12) return "active";
  if (score <= 25) return "buzzing";
  return "on fire";
}

function cityHeatColor(score: number): string {
  return score === 0 ? "rgba(255,255,255,0.25)" : "#E1306C";
}

const RANK_COLORS = ["#3B82F6", "#FFFFFF", "#3B82F6"];

interface LbHotspot {
  id: string;
  name: string;
  avatar?: string;
  type?: string;
  isEvent?: boolean;
  isPopup?: boolean;
  points: number;
  location?: { address?: string; latitude?: number; longitude?: number };
  followersCount?: number;
  followers?: { id: string; name: string; pfp?: string }[];
  checkins: { createdAt: string }[];
  posts: { id: string; media?: string; createdAt: string; author?: { id: string; name: string; pfp?: string } }[];
}

interface PopupItem {
  id: string;
  name: string;
  avatar?: string;
  type?: string;
  description?: string;
  isPopup: boolean;
  popupStart?: string;
  popupEnd?: string;
  location?: { latitude?: number; longitude?: number; address?: string };
  followersCount?: number;
  followers?: { id: string; name: string; pfp?: string }[];
  author?: { id: string; name: string; pfp?: string };
  posts?: { id: string; media?: string; createdAt: string }[];
}

interface MapHotspot {
  id: string;
  name: string;
  avatar?: string;
  isEvent?: boolean;
  type?: string;
  location?: { latitude?: number; longitude?: number; address?: string };
}
type ResolvedHotspot = MapHotspot & { resolvedLat: number; resolvedLng: number };
type ResolvedPopup = PopupItem & { resolvedLat: number; resolvedLng: number };

interface HotCity {
  city: string;
  score: number;
  hotspotCount: number;
  topHotspots: { id: string; name: string; avatar?: string }[];
}

// ─── City leaderboard row ─────────────────────────────────────────────────────
function CityRow({
  item,
  rank,
  isLast,
}: {
  item: HotCity;
  rank: number;
  isLast: boolean;
}) {
  const C = useColors();
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.2,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  const rankColor = RANK_COLORS[rank - 1] ?? C.txt3;
  const heatColor = cityHeatColor(item.score);

  return (
    <View
      style={[
        styles.cityRow,
        !isLast && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: C.border,
        },
      ]}
    >
      <Text style={[styles.cityRank, { color: rankColor }]}>#{rank}</Text>
      <Animated.View
        style={{
          width: 5,
          height: 5,
          borderRadius: 3,
          backgroundColor: "#3B82F6",
          opacity,
          marginRight: 10,
        }}
      />
      <View style={{ flex: 1 }}>
        <Text style={[styles.cityName, { color: C.txt }]} numberOfLines={1}>
          {item.city}
        </Text>
      </View>
      {item.topHotspots.length > 0 && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginRight: 10,
          }}
        >
          {item.topHotspots.map((h, i) => (
            <View
              key={h.id}
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                overflow: "hidden",
                backgroundColor: "#000",
                borderWidth: 1.5,
                borderColor: "#111",
                marginLeft: i === 0 ? 0 : -8,
                zIndex: 3 - i,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {h.avatar ? (
                <Image
                  source={{ uri: h.avatar }}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="cover"
                />
              ) : (
                <Text style={{ color: "#fff", fontFamily: "Roobert-Bold", fontSize: 9 }}>
                  {h.name[0]?.toUpperCase()}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}
      <View style={{ alignItems: "flex-end" }}>
        <Text style={[styles.cityScore]}>{item.score} pts</Text>
      </View>
    </View>
  );
}

// ─── Nearby plugger row ───────────────────────────────────────────────────────
interface NearbyPlugger {
  id: string;
  name: string;
  pfp?: string;
  points: number;
  visits?: number;
  followersCount?: number;
  hotspots?: { id: string }[];
  reviews?: { id: string }[];
  posts?: { id: string }[];
  location?: { latitude?: number; longitude?: number; address?: string };
}

function PluggerRow({
  item,
  rank,
  isLast,
}: {
  item: NearbyPlugger;
  rank: number;
  isLast: boolean;
}) {
  const C = useColors();
  const rankColor = RANK_COLORS[rank - 1] ?? C.txt3;
  const city = item.location?.address
    ? extractCity(item.location.address)
    : null;

  return (
    <TouchableOpacity
      onPress={() => {
        Haptics.selectionAsync();
        router.push(`/profile-view?type=user&id=${item.id}` as any);
      }}
      activeOpacity={0.82}
      style={[
        styles.cityRow,
        !isLast && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: C.border,
        },
      ]}
    >
      <Text style={[styles.cityRank, { color: rankColor }]}>#{rank}</Text>
      <View
        style={[
          styles.pluggerAvatar,
          {
            backgroundColor: "#444",
            borderColor: rank === 1 ? "#3B82F6" : C.border,
          },
        ]}
      >
        {item.pfp ? (
          <Image
            source={{ uri: item.pfp }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
          />
        ) : (
          <Text
            style={{ color: C.txt3, fontFamily: "Roobert-Bold", fontSize: 13 }}
          >
            {item.name[0]?.toUpperCase()}
          </Text>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.cityName, { color: C.txt }]} numberOfLines={1}>
          {item.name}
        </Text>
        {city && (
          <Text style={[styles.cityMeta, { color: C.txt3 }]} numberOfLines={1}>
            {city}
          </Text>
        )}
      </View>
      <Text style={[styles.cityScore, { color: rankColor }]}>
        {item.points} pts
      </Text>
    </TouchableOpacity>
  );
}

// ─── Popup card ───────────────────────────────────────────────────────────────
function formatCountdown(endIso: string): string {
  const ms = new Date(endIso).getTime() - Date.now();
  if (ms <= 0) return "ended";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

function formatTimeRange(startIso?: string, endIso?: string): string {
  if (!startIso) return "";
  const fmt = (iso: string) => {
    const d = new Date(iso);
    const h = d.getHours() % 12 || 12;
    const m = d.getMinutes().toString().padStart(2, "0");
    const ap = d.getHours() >= 12 ? "pm" : "am";
    return `${h}:${m}${ap}`;
  };
  return endIso ? `${fmt(startIso)} – ${fmt(endIso)}` : fmt(startIso);
}


// ─── Upgrade banner ───────────────────────────────────────────────────────────
function UpgradeBanner() {
  const C = useColors();
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => {
        Haptics.selectionAsync();
        router.push("/pluggedplus" as any);
      }}
      style={[styles.upgradeBanner, { backgroundColor: C.txt }]}
    >
      <View style={styles.upgradeLeft}>
        <View
          style={[
            styles.upgradePill,
            {
              backgroundColor: C.bg,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            },
          ]}
        >
          <PulseDot color="#fff" size={3} />
          <Text style={[styles.upgradePillText, { color: C.txt }]}>
            plug black
          </Text>
        </View>
        <Text style={[styles.upgradeHeadline, { color: C.bg }]}>
          Unlock the{"\n"}full city.
        </Text>
        <Text style={[styles.upgradeSub, { color: C.bg }]}>
          incognito · early alerts · crew board
        </Text>
        <View style={[styles.upgradeBtn, { backgroundColor: C.bg }]}>
          <Text style={[styles.upgradeBtnText, { color: C.txt }]}>
            Upgrade →
          </Text>
        </View>
      </View>

      <View style={styles.upgradeRight} pointerEvents="none">
        <Svg width={96} height={96} viewBox="0 0 96 96">
          <SvgCircle cx="48" cy="48" r="18" fill={C.bg} fillOpacity={0.1} />
          <Path
            d="M54 30 L40 52 H50 L42 66 L62 44 H52 Z"
            fill={C.bg}
            fillOpacity={0.85}
          />
        </Svg>
      </View>
    </TouchableOpacity>
  );
}

// ─── Map pin (circle + triangle, matches explore/leaderboard) ─────────────────
function FeedPin({ uri, initial }: { uri?: string; initial: string }) {
  return (
    <View style={{ alignItems: "center" }}>
      <View style={feedPinStyles.circle}>
        {uri
          ? <Image source={{ uri }} style={{ width: "100%", height: "100%", borderRadius: 999 }} resizeMode="cover" />
          : <Text style={{ color: "#fff", fontFamily: "Roobert-Bold", fontSize: 14 }}>{initial}</Text>
        }
      </View>
      <View style={feedPinStyles.triangle} />
    </View>
  );
}
const feedPinStyles = StyleSheet.create({
  circle: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: "#1a1a1a", borderWidth: 2, borderColor: "#fff",
    overflow: "hidden", alignItems: "center", justifyContent: "center",
  },
  triangle: {
    width: 0, height: 0,
    borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 9,
    borderLeftColor: "transparent", borderRightColor: "transparent",
    borderTopColor: "#fff", marginTop: -1,
  },
});

// ─── Plugger pin (checkin card style — card + pfp bubble + name bar + tail) ────
function PluggerPin({ uri, name }: { uri?: string; name: string }) {
  const initial = name[0]?.toUpperCase() ?? "?";
  return (
    <View style={{ alignItems: "center" }}>
      {/* small pfp bubble floating above the card */}
      <View style={pluggerPinStyles.pfpBubble}>
        {uri
          ? <Image source={{ uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
          : <Text style={{ color: "#fff", fontFamily: "Roobert-Bold", fontSize: 9 }}>{initial}</Text>
        }
      </View>
      {/* card */}
      <View style={pluggerPinStyles.card}>
        {uri
          ? <Image source={{ uri }} style={{ width: "100%", height: "100%", borderRadius: 12 }} resizeMode="cover" />
          : <Text style={{ color: "#fff", fontFamily: "Roobert-Bold", fontSize: 16 }}>{initial}</Text>
        }
        <View style={pluggerPinStyles.nameBar}>
          <Text style={pluggerPinStyles.nameText} numberOfLines={1}>{name}</Text>
        </View>
      </View>
      {/* tail */}
      <View style={pluggerPinStyles.tail} />
    </View>
  );
}
const pluggerPinStyles = StyleSheet.create({
  pfpBubble: {
    width: 24, height: 24, borderRadius: 12,
    overflow: "hidden", backgroundColor: "#444",
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#000",
    marginBottom: -10, zIndex: 2,
  },
  card: {
    width: 64, height: 64, borderRadius: 14,
    overflow: "hidden", backgroundColor: "#1a1a1a",
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#fff",
  },
  nameBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 4, paddingVertical: 3,
  },
  nameText: {
    color: "#fff", fontFamily: "Roobert-Bold",
    fontSize: 8, letterSpacing: -0.1, textAlign: "center",
  },
  tail: {
    width: 3, height: 7, backgroundColor: "#fff",
    borderRadius: 2, marginTop: -1,
  },
});

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function FeedScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();

  const { data: meData, refetch: meRefetch } = useQuery<MeData>(ME_QUERY, {
    pollInterval: 30_000,
  });
  const { data: lbData, refetch: lbRefetch } = useQuery<{
    leaderboardHotspots: LbHotspot[];
  }>(LEADERBOARD_HOTSPOTS, { pollInterval: 60_000 });
  const { data: usersData, refetch: usersRefetch } = useQuery<{
    leaderboardUsersByPoints: { periodPoints: number; user: NearbyPlugger }[];
  }>(LEADERBOARD_USERS_BY_POINTS, {
    variables: { take: 100 },
    pollInterval: 60_000,
  });
  const { data: allHotspotsData } = useQuery<{ allHotspots: MapHotspot[] }>(
    ALL_HOTSPOTS,
    { pollInterval: 120_000 },
  );
  const { data: popupsData, refetch: popupsRefetch } = useQuery<{
    allPopups: PopupItem[];
  }>(ALL_POPUPS, { pollInterval: 120_000 });
  const { data: pluggedInData, refetch: pluggedInRefetch } = useQuery<{
    leaderboardPluggedInUsers: { periodPoints: number; user: NearbyPlugger }[];
  }>(LEADERBOARD_PLUGGED_IN_USERS, {
    variables: { take: 100 },
    pollInterval: 30_000,
    errorPolicy: "ignore",
  });
  const pfp = meData?.me?.pfp;
  const initial = meData?.me?.name?.[0]?.toUpperCase() ?? "?";

  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<"city" | "world">("city");
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [lbTab, setLbTab] = useState<"cities" | "hotspots" | "pluggers">("cities");
  const [geocodeTick, setGeocodeTick] = useState(0);
  const [userCoords, setUserCoords] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const [search, setSearch] = useState("");

  async function onRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([
        meRefetch(),
        lbRefetch(),
        usersRefetch(),
        popupsRefetch(),
        pluggedInRefetch(),
      ]);
    } catch {}
    setRefreshing(false);
  }

  useEffect(() => {
    (async () => {
      try {
        const { status } =
          await ExpoLocation.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const pos = await ExpoLocation.getCurrentPositionAsync({
          accuracy: ExpoLocation.Accuracy.Balanced,
        });
        setUserCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      } catch {}
    })();
  }, []);

  // Geocode hotspot + popup addresses — address is ground truth, never use raw DB coords when address present
  useEffect(() => {
    const allH = allHotspotsData?.allHotspots ?? [];
    const allP = popupsData?.allPopups ?? [];
    const items: { id: string; address: string }[] = [
      ...allH.filter((h) => !!h.location?.address && !geocodeCache.has(h.id))
             .map((h) => ({ id: h.id, address: h.location!.address! })),
      ...allP.filter((p) => !!p.location?.address && !geocodeCache.has(`p-${p.id}`))
             .map((p) => ({ id: `p-${p.id}`, address: p.location!.address! })),
    ];
    if (!items.length) return;
    (async () => {
      let didUpdate = false;
      for (let i = 0; i < items.length; i += 5) {
        await Promise.all(
          items.slice(i, i + 5).map(async ({ id, address }) => {
            try {
              const results = await ExpoLocation.geocodeAsync(address);
              if (results?.[0]) {
                geocodeCache.set(id, { lat: results[0].latitude, lng: results[0].longitude });
                didUpdate = true;
              }
            } catch {}
          }),
        );
      }
      if (didUpdate) setGeocodeTick((t) => t + 1);
    })();
  }, [allHotspotsData, popupsData]);

  // Header pulse dot
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.2,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  const { stories, nearbyHotspots, nearbyEvents } = useMemo(() => {
    function inRange(loc?: { latitude?: number; longitude?: number }) {
      if (view === "world") return true;
      if (!userCoords || loc?.latitude == null || loc?.longitude == null)
        return true;
      return (
        haversineKm(
          userCoords.lat,
          userCoords.lon,
          loc.latitude!,
          loc.longitude!,
        ) <= RADIUS_KM
      );
    }

    const allHotspots = lbData?.leaderboardHotspots ?? [];
    const allUsers = (usersData?.leaderboardUsersByPoints ?? []).map(
      (e) => e.user,
    );

    const nearbyH = allHotspots.filter((h) => inRange(h.location));
    const nearbyU = allUsers.filter((u) => inRange(u.location));

    const storyHotspots = nearbyH.filter((h) => !h.isEvent && !h.isPopup);
    const storyList: StoryItem[] = [
      ...nearbyU.slice(0, 10).map(
        (u): StoryItem => ({
          kind: "user",
          data: {
            id: u.id,
            name: u.name,
            pfp: u.pfp,
            location: u.location as any,
          },
        }),
      ),
      ...storyHotspots
        .slice(0, 10)
        .map((h): StoryItem => ({ kind: "hotspot", data: h })),
    ];

    return {
      stories: storyList,
      nearbyHotspots: nearbyH.filter((h) => !h.isEvent && !h.isPopup),
      nearbyEvents: nearbyH.filter((h) => h.isEvent),
    };
  }, [lbData, usersData, userCoords, view]);

  const nearbyPopups = useMemo<PopupItem[]>(() => {
    if (selectedCategory && !matchesCategory(selectedCategory, selectedCategory)) return [];
    const now = Date.now();
    return (popupsData?.allPopups ?? []).filter((p) => {
      if (p.popupEnd && new Date(p.popupEnd).getTime() < now) return false;
      if (selectedCategory && !matchesCategory(p.type, selectedCategory)) return false;
      if (view === "world") return true;
      if (
        !userCoords ||
        p.location?.latitude == null ||
        p.location?.longitude == null
      )
        return true;
      return (
        haversineKm(
          userCoords.lat,
          userCoords.lon,
          p.location.latitude!,
          p.location.longitude!,
        ) <= RADIUS_KM
      );
    });
  }, [popupsData, userCoords, view, selectedCategory]);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  function matchesCategory(type: string | undefined, cat: string): boolean {
    if (!type) return false;
    const t = type.toLowerCase();
    const aliases: Record<string, string[]> = {
      restaurant: ["restaurant", "food", "dining", "eat"],
      club:       ["club", "nightclub", "lounge"],
      bar:        ["bar", "pub", "brewery", "cocktail"],
      outing:     ["outing", "activity", "outdoor", "park", "adventure"],
      event:      ["event"],
      market:     ["market", "shop", "store", "retail", "boutique"],
      coffee:     ["coffee", "cafe", "café", "tea", "bakery"],
    };
    return (aliases[cat] ?? [cat]).some((alias) => t.includes(alias));
  }

  const filteredHotspots = useMemo(() => {
    let list = nearbyHotspots;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((h) => h.name.toLowerCase().includes(q));
    }
    if (selectedCategory && selectedCategory !== "event") {
      list = list.filter((h) => matchesCategory(h.type, selectedCategory));
    }
    if (selectedCategory === "event") list = [];
    return list;
  }, [nearbyHotspots, search, selectedCategory]);

  const filteredEvents = useMemo(() => {
    if (selectedCategory && selectedCategory !== "event") return [];
    let list = nearbyEvents;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((h) => h.name.toLowerCase().includes(q));
    }
    return list;
  }, [nearbyEvents, search, selectedCategory]);

  const hotCities = useMemo<HotCity[]>(() => {
    const map = new Map<
      string,
      {
        score: number;
        hotspotCount: number;
        hotspots: { id: string; name: string; avatar?: string; points: number }[];
      }
    >();
    for (const h of lbData?.leaderboardHotspots ?? []) {
      const addr = h.location?.address;
      if (!addr) continue;
      if (
        view === "city" &&
        userCoords &&
        h.location?.latitude != null &&
        h.location?.longitude != null
      ) {
        if (
          haversineKm(
            userCoords.lat,
            userCoords.lon,
            h.location.latitude,
            h.location.longitude,
          ) > RADIUS_KM
        )
          continue;
      }
      const city = extractCity(addr);
      const prev = map.get(city) ?? { score: 0, hotspotCount: 0, hotspots: [] };
      prev.hotspots.push({ id: h.id, name: h.name, avatar: h.avatar, points: h.points ?? 0 });
      map.set(city, {
        score: prev.score + (h.points ?? 0),
        hotspotCount: prev.hotspotCount + 1,
        hotspots: prev.hotspots,
      });
    }
    return [...map.entries()]
      .map(([city, d]) => ({
        city,
        score: d.score,
        hotspotCount: d.hotspotCount,
        topHotspots: d.hotspots.sort((a, b) => b.points - a.points).slice(0, 3),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 50);
  }, [lbData, userCoords, view]);

  const nearbyPluggers = useMemo<NearbyPlugger[]>(() => {
    const entries = usersData?.leaderboardUsersByPoints ?? [];
    return entries
      .filter(({ user: u }) => {
        if (view === "world") return true;
        if (!userCoords) return true;
        if (u.location?.latitude == null || u.location?.longitude == null)
          return false;
        return (
          haversineKm(
            userCoords.lat,
            userCoords.lon,
            u.location.latitude!,
            u.location.longitude!,
          ) <= RADIUS_KM
        );
      })
      .map(({ user: u }) => u)
      .slice(0, 8);
  }, [usersData, userCoords, view]);

  const nearbyPluggedIn = useMemo<NearbyPlugger[]>(() => {
    const entries =
      pluggedInData?.leaderboardPluggedInUsers ??
      usersData?.leaderboardUsersByPoints ??
      [];
    return entries
      .filter(({ user: u }) => {
        if (view === "world") return true;
        if (!userCoords) return true;
        if (u.location?.latitude == null || u.location?.longitude == null)
          return false;
        return (
          haversineKm(
            userCoords.lat,
            userCoords.lon,
            u.location.latitude!,
            u.location.longitude!,
          ) <= RADIUS_KM
        );
      })
      .map(({ user: u }) => u)
      .slice(0, 8);
  }, [pluggedInData, usersData, userCoords, view]);

  const mapHotspots = useMemo<ResolvedHotspot[]>(() => {
    const result: ResolvedHotspot[] = [];
    for (const h of allHotspotsData?.allHotspots ?? []) {
      if (selectedCategory && !matchesCategory((h as any).type, selectedCategory)) continue;
      const geo = geocodeCache.get(h.id);
      let lat: number | undefined;
      let lng: number | undefined;
      if (h.location?.address) {
        // address present → only trust geocoded result, never raw DB coords
        lat = geo?.lat;
        lng = geo?.lng;
      } else {
        const rawLat = h.location?.latitude;
        const rawLng = h.location?.longitude;
        if (rawLat && rawLng && !(rawLat === 0 && rawLng === 0)) { lat = rawLat; lng = rawLng; }
      }
      if (lat == null || lng == null) continue;
      if (view === "city" && userCoords && haversineKm(userCoords.lat, userCoords.lon, lat, lng) > RADIUS_KM) continue;
      result.push({ ...h, resolvedLat: lat, resolvedLng: lng });
    }
    return result;
  }, [allHotspotsData, geocodeTick, userCoords, view, selectedCategory]);

  const resolvedPopups = useMemo<ResolvedPopup[]>(() => {
    const now = Date.now();
    const result: ResolvedPopup[] = [];
    for (const p of popupsData?.allPopups ?? []) {
      // Skip if ended or started more than 24 h ago
      if (p.popupEnd && new Date(p.popupEnd).getTime() < now) continue;
      if (!p.popupEnd && p.popupStart && now - new Date(p.popupStart).getTime() > 86400000) continue;
      if (selectedCategory && !matchesCategory(p.type, selectedCategory)) continue;
      const geo = geocodeCache.get(`p-${p.id}`);
      let lat: number | undefined;
      let lng: number | undefined;
      if (p.location?.address) {
        lat = geo?.lat;
        lng = geo?.lng;
      } else {
        const rawLat = p.location?.latitude;
        const rawLng = p.location?.longitude;
        if (rawLat && rawLng && !(rawLat === 0 && rawLng === 0)) { lat = rawLat; lng = rawLng; }
      }
      if (lat == null || lng == null) continue;
      if (view === "city" && userCoords && haversineKm(userCoords.lat, userCoords.lon, lat, lng) > RADIUS_KM) continue;
      result.push({ ...p, resolvedLat: lat, resolvedLng: lng });
    }
    return result;
  }, [popupsData, geocodeTick, userCoords, view, selectedCategory]);

  const nearbyHotspotPosts = useMemo<
    {
      postId: string;
      media: string;
      hotspotId: string;
      hotspotName: string;
      hotspotAvatar?: string;
      hotspotPoints: number;
      isActive: boolean;
      authorId?: string;
      authorName?: string;
      authorPfp?: string;
      lat?: number;
      lng?: number;
    }[]
  >(() => {
    const posts: {
      postId: string;
      media: string;
      hotspotId: string;
      hotspotName: string;
      hotspotAvatar?: string;
      hotspotPoints: number;
      isActive: boolean;
      authorId?: string;
      authorName?: string;
      authorPfp?: string;
      lat?: number;
      lng?: number;
    }[] = [];
    const now = Date.now();
    for (const h of lbData?.leaderboardHotspots ?? []) {
      const geo = geocodeCache.get(h.id);
      const lat = h.location?.address ? geo?.lat : (h.location?.latitude || undefined);
      const lng = h.location?.address ? geo?.lng : (h.location?.longitude || undefined);
      if (view === "city") {
        if (!userCoords || lat == null || lng == null) continue;
        if (haversineKm(userCoords.lat, userCoords.lon, lat, lng) > RADIUS_KM) continue;
      }
      const isActive =
        h.posts.some((p) => p.createdAt && now - new Date(p.createdAt).getTime() < H24) ||
        h.checkins.some((c) => c.createdAt && now - new Date(c.createdAt).getTime() < H24);
      for (const p of h.posts) {
        if (p.media)
          posts.push({
            postId: p.id,
            media: p.media,
            hotspotId: h.id,
            hotspotName: h.name,
            hotspotAvatar: h.avatar,
            hotspotPoints: h.points ?? 0,
            isActive,
            authorId: p.author?.id,
            authorName: p.author?.name,
            authorPfp: p.author?.pfp,
            lat,
            lng,
          });
      }
    }
    return posts.sort((a, b) => b.hotspotPoints - a.hotspotPoints).slice(0, 20);
  }, [lbData, userCoords, view, geocodeTick]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <View
        style={[
          styles.topPanel,
          { paddingTop: insets.top + 10, backgroundColor: C.bg, paddingBottom: 5, borderBottomLeftRadius: 12, borderBottomRightRadius: 12 },
        ]}
      >
        <View style={styles.header}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
            <Text style={[styles.title, { color: C.txt }]}>feed</Text>
         
          </View>
          <View
            style={[
              styles.viewToggle,
              {
                backgroundColor: "#000",
                borderColor: "rgba(255,255,255,0.10)",
              },
            ]}
          >
            {(["city", "world"] as const).map((v) => (
              <TouchableOpacity
                key={v}
                onPress={() => {
                  Haptics.selectionAsync();
                  setView(v);
                }}
                activeOpacity={0.82}
                style={[
                  styles.viewToggleBtn,
                  view === v && { backgroundColor: C.txt },
                ]}
              >
                <Text
                  style={{
                    fontFamily: "Roobert-Bold",
                    fontSize: 12,
                    color: view === v ? C.bg : "white",
                  }}
                >
                  {v === "city" ? "City" : "World"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            onPress={() => {
              Haptics.selectionAsync();
              router.push("/(tabs)/profile" as any);
            }}
            activeOpacity={0.82}
            style={[
              styles.pfpBtn,
              { backgroundColor: C.card2, borderColor: C.border2 },
            ]}
          >
            {pfp ? (
              <Image
                source={{ uri: pfp }}
                style={StyleSheet.absoluteFillObject}
                resizeMode="cover"
              />
            ) : (
              <Text
                style={{
                  color: C.txt,
                  fontFamily: "Roobert-Bold",
                  fontSize: 14,
                }}
              >
                {initial}
              </Text>
            )}
          </TouchableOpacity>
        </View>

      </View>

      {/* ── Feed scroll ───────────────────────────────────────────────────── */}
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={C.txt}
          />
        }
      >
        {/* Stories */}
        {stories.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.storyRow}
            style={[styles.storyScroll, { marginTop: 12 }]}
          >
            {stories.map((item) => (
              <StoryBubble key={`${item.kind}-${item.data.id}`} item={item} />
            ))}
          </ScrollView>
        )}

        {/* Categories */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 7 }}
            >
              <View style={styles.sectionDot} />
              <Text style={[styles.sectionTitle, { color: C.txt }]}>
                categories
              </Text>
            </View>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 22, gap: 8 }}
          >
            {Array.from({ length: Math.ceil(CATEGORIES.length / 2) }).map((_, colIdx) => {
              const top = CATEGORIES[colIdx * 2];
              const bottom = CATEGORIES[colIdx * 2 + 1];
              const colW = (SW - 44 - 8) / 2;
              return (
                <View key={colIdx} style={{ width: colW, gap: 8 }}>
                  {[top, bottom].map((cat) => {
                    if (!cat) return null;
                    const active = selectedCategory === cat.id;
                    const { id, label, Icon } = cat;
                    return (
                      <TouchableOpacity
                        key={id}
                        activeOpacity={0.82}
                        onPress={() => { Haptics.selectionAsync(); setSelectedCategory(active ? null : id); }}
                        style={[styles.catPill, { width: "100%", backgroundColor: active ? C.txt : C.card, borderColor: active ? C.txt : C.border }]}
                      >
                        <Icon size={13} color={active ? C.bg : C.txt2} strokeWidth={1.6} />
                        <Text style={[styles.catPillLabel, { color: active ? C.bg : C.txt }]}>{label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })}
          </ScrollView>
        </View>

        {/* Mini map */}
        {userCoords && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: C.txt }]}>
                where you are 👇
              </Text>
            </View>
            <View style={styles.miniMap}>
              <MapView
                style={StyleSheet.absoluteFillObject}
                provider={PROVIDER_GOOGLE}
                customMapStyle={DARK_MAP_STYLE}
                initialRegion={{
                  latitude: userCoords.lat,
                  longitude: userCoords.lon,
                  latitudeDelta: 0.8,
                  longitudeDelta: 0.8,
                }}
                showsMyLocationButton={false}
                showsCompass={false}
                showsScale={false}
                showsBuildings={false}
                showsTraffic={false}
                showsIndoors={false}
                rotateEnabled={false}
                pitchEnabled={false}
                scrollEnabled={true}
                zoomEnabled={true}
                legalLabelInsets={{
                  top: 0,
                  left: 0,
                  bottom: -100,
                  right: -100,
                }}
              >
                <Marker
                  coordinate={{
                    latitude: userCoords.lat,
                    longitude: userCoords.lon,
                  }}
                  anchor={{ x: 0.5, y: 0.5 }}
                  tracksViewChanges={false}
                >
                  <View style={styles.userPin}>
                    {pfp ? (
                      <Image
                        source={{ uri: pfp }}
                        style={StyleSheet.absoluteFillObject}
                        resizeMode="cover"
                      />
                    ) : (
                      <Text
                        style={{
                          color: "#fff",
                          fontFamily: "Roobert-Bold",
                          fontSize: 13,
                        }}
                      >
                        {initial}
                      </Text>
                    )}
                  </View>
                </Marker>
                {userCoords && (
                  <Circle
                    center={{ latitude: userCoords.lat, longitude: userCoords.lon }}
                    radius={RADIUS_M}
                    strokeColor="rgba(0,0,0,0.6)"
                    fillColor="rgba(0,0,0,0.08)"
                    strokeWidth={1}
                  />
                )}
                {mapHotspots.slice(0, 20).map((h) => (
                  <Marker
                    key={h.id}
                    coordinate={{ latitude: h.resolvedLat, longitude: h.resolvedLng }}
                    anchor={{ x: 0.5, y: 1 }}
                    tracksViewChanges={false}
                    onPress={() => {
                      Haptics.selectionAsync();
                      router.push(`/profile-view?type=hotspot&id=${h.id}` as any);
                    }}
                  >
                    <FeedPin uri={h.avatar} initial={h.name[0]?.toUpperCase() ?? "?"} />
                  </Marker>
                ))}
                {resolvedPopups.slice(0, 10).map((p) => (
                  <Marker
                    key={`popup-${p.id}`}
                    coordinate={{ latitude: p.resolvedLat, longitude: p.resolvedLng }}
                    anchor={{ x: 0.5, y: 1 }}
                    tracksViewChanges={false}
                    onPress={() => {
                      Haptics.selectionAsync();
                      router.push(`/profile-view?type=hotspot&id=${p.id}` as any);
                    }}
                  >
                    <FeedPin uri={p.avatar} initial={p.name[0]?.toUpperCase() ?? "?"} />
                  </Marker>
                ))}
                {nearbyPluggers.slice(0, 6).map((u) => {
                  const geo = geocodeCache.get(`u-${u.id}`);
                  const lat = u.location?.address ? geo?.lat : u.location?.latitude;
                  const lng = u.location?.address ? geo?.lng : u.location?.longitude;
                  if (!lat || !lng) return null;
                  return (
                    <Marker
                      key={`plugger-${u.id}`}
                      coordinate={{ latitude: lat, longitude: lng }}
                      anchor={{ x: 0.5, y: 1 }}
                      tracksViewChanges={false}
                      onPress={() => {
                        Haptics.selectionAsync();
                        router.push(`/profile-view?type=user&id=${u.id}` as any);
                      }}
                    >
                      <PluggerPin uri={u.pfp} name={u.name} />
                    </Marker>
                  );
                })}
                {nearbyPluggedIn.slice(0, 6).map((u) => {
                  const geo = geocodeCache.get(`u-${u.id}`);
                  const lat = u.location?.address ? geo?.lat : u.location?.latitude;
                  const lng = u.location?.address ? geo?.lng : u.location?.longitude;
                  if (!lat || !lng) return null;
                  return (
                    <Marker
                      key={`pluggedin-${u.id}`}
                      coordinate={{ latitude: lat, longitude: lng }}
                      anchor={{ x: 0.5, y: 1 }}
                      tracksViewChanges={false}
                      onPress={() => {
                        Haptics.selectionAsync();
                        router.push(`/profile-view?type=user&id=${u.id}` as any);
                      }}
                    >
                      <PluggerPin uri={u.pfp} name={u.name} />
                    </Marker>
                  );
                })}
              </MapView>
              {/* Expand button */}
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  setMapFullscreen(true);
                }}
                activeOpacity={0.82}
                style={{
                  position: "absolute",
                  bottom: 10,
                  right: 10,
                  width: 34,
                  height: 34,
                  borderRadius: 20,
                  backgroundColor: "rgba(0,0,0,0.75)",
             
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Maximize2 size={14} color="#fff" strokeWidth={1.5} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Hotspots */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 7 }}
            >
              <View style={styles.sectionDot} />
              <Text style={[styles.sectionTitle, { color: C.txt }]}>
                {view === "city" ? "hotspots near you" : "top hotspots"}
              </Text>
            </View>
            \
          </View>
          {filteredHotspots.length > 0 &&
            (() => {
              const chunks: StorySpot[][] = [];
              for (let i = 0; i < filteredHotspots.length; i += 3)
                chunks.push(filteredHotspots.slice(i, i + 3));
              return (
                <FlatList
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  decelerationRate="fast"
                  removeClippedSubviews
                  initialNumToRender={2}
                  maxToRenderPerBatch={2}
                  windowSize={3}
                  data={chunks}
                  keyExtractor={(_, i) => String(i)}
                  renderItem={({ item: group }) => (
                    <View
                      style={{ width: SW - 44, marginHorizontal: 22, gap: 10 }}
                    >
                      {group.map((h, i) => {
                        const cutoff24h = Date.now() - 86_400_000;
                        const recentCheckins = (h.checkins ?? []).filter(c => new Date(c.createdAt).getTime() >= cutoff24h).length;
                        const recentPosts = (h.posts ?? []).filter(p => new Date(p.createdAt).getTime() >= cutoff24h).length;
                        const activityScore = recentCheckins + recentPosts;
                        const lastPostAt = h.posts?.length
                          ? h.posts.reduce(
                              (latest, p) =>
                                p.createdAt > latest ? p.createdAt : latest,
                              "",
                            )
                          : undefined;
                        return (
                          <HotspotRow
                            key={h.id}
                            hotspot={{ ...h, lastPostAt }}
                            isLast={i === group.length - 1}
                            activityScore={activityScore}
                            disableSwipe
                          />
                        );
                      })}
                    </View>
                  )}
                />
              );
            })()}
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 7,
            paddingHorizontal: 22,
            marginBottom: 10,
            marginTop: 4,
          }}
        >
          <View
            style={{
              width: 7,
              height: 7,
              borderRadius: 4,
              backgroundColor: "#3B82F6",
            }}
          />
          <Text
            style={{
              fontFamily: "Roobert-Bold",
              fontSize: 18,
              letterSpacing: -0.6,
              color: C.txt,
            }}
          >
            upgrade
          </Text>
        </View>
        <UpgradeBanner />

        {/* Events */}
        {filteredEvents.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 7 }}
              >
                <View style={styles.sectionDot} />
                <Text style={[styles.sectionTitle, { color: C.txt }]}>
                  {view === "city" ? "events near you" : "top events"}
                </Text>
              </View>
            </View>
            {(() => {
              const chunks: LbHotspot[][] = [];
              for (let i = 0; i < filteredEvents.length; i += 3)
                chunks.push(filteredEvents.slice(i, i + 3));
              return (
                <FlatList
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  decelerationRate="fast"
                  removeClippedSubviews
                  initialNumToRender={2}
                  maxToRenderPerBatch={2}
                  windowSize={3}
                  data={chunks}
                  keyExtractor={(_, i) => String(i)}
                  renderItem={({ item: group }) => (
                    <View
                      style={{ width: SW - 44, marginHorizontal: 22, gap: 10 }}
                    >
                      {group.map((h, i) => {
                        const lastPostAt = h.posts?.length
                          ? h.posts.reduce(
                              (latest, p) =>
                                p.createdAt > latest ? p.createdAt : latest,
                              "",
                            )
                          : undefined;
                        return (
                          <HotspotRow
                            key={h.id}
                            hotspot={{ ...h, lastPostAt, followersCount: h.followersCount, followers: h.followers }}
                            isLast={i === group.length - 1}
                            showFollowers
                            disableSwipe
                          />
                        );
                      })}
                    </View>
                  )}
                />
              );
            })()}
          </View>
        )}

        {/* Popups near you */}
        {nearbyPopups.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 7 }}
              >
                <View style={styles.sectionDot} />
                <Text style={[styles.sectionTitle, { color: C.txt }]}>
                  {view === "city" ? "popups near you" : "active popups"}
                </Text>
              </View>
            </View>
            {(() => {
              const chunks: PopupItem[][] = [];
              for (let i = 0; i < nearbyPopups.length; i += 3)
                chunks.push(nearbyPopups.slice(i, i + 3));
              return (
                <FlatList
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  decelerationRate="fast"
                  removeClippedSubviews
                  initialNumToRender={2}
                  maxToRenderPerBatch={2}
                  windowSize={3}
                  data={chunks}
                  keyExtractor={(_, i) => String(i)}
                  renderItem={({ item: group }) => (
                    <View
                      style={{ width: SW - 44, marginHorizontal: 22, gap: 10 }}
                    >
                      {group.map((p, i) => {
                        const lastPostAt = p.posts?.length
                          ? p.posts.reduce(
                              (latest, post) =>
                                post.createdAt > latest ? post.createdAt : latest,
                              "",
                            )
                          : undefined;
                        const followerList =
                          p.followers && p.followers.length > 0
                            ? p.followers
                            : p.author
                            ? [p.author]
                            : [];
                        return (
                          <HotspotRow
                            key={p.id}
                            hotspot={{
                              id: p.id,
                              name: p.name,
                              avatar: p.avatar,
                              type: p.type,
                              location: p.location,
                              followersCount: p.followersCount,
                              followers: followerList,
                              lastPostAt,
                              posts: [],
                              popupStart: p.popupStart,
                              popupEnd: p.popupEnd,
                            }}
                            isLast={i === group.length - 1}
                            showFollowers
                            disableSwipe
                          />
                        );
                      })}
                    </View>
                  )}
                />
              );
            })()}
          </View>
        )}

        {/* Cities right now */}
        {hotCities.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 7 }}
              >
                <View style={styles.sectionDot} />
                <Text style={[styles.sectionTitle, { color: C.txt }]}>
                  {view === "city" ? "cities right now" : "top cities"}
                </Text>
              </View>

             
            </View>
            <View style={[styles.listCard, { backgroundColor: "#111" }]}>
              {hotCities.map((item, i) => (
                <CityRow
                  key={item.city}
                  item={item}
                  rank={i + 1}
                  isLast={i === hotCities.length - 1}
                />
              ))}
            </View>
          </View>
        )}

        {/* Top pluggers nearby */}
        {nearbyPluggers.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 7 }}
              >
                <View style={styles.sectionDot} />
                <Text style={[styles.sectionTitle, { color: C.txt }]}>
                  {view === "city" ? "top pluggers nearby" : "top pluggers"}
                </Text>
              </View>
            </View>
            <View style={{ paddingHorizontal: 22, gap: 15, marginTop: 16 }}>
              {[nearbyPluggers.slice(0, 4), nearbyPluggers.slice(4, 8)].map(
                (row, ri) => (
                  <View
                    key={ri}
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                    }}
                  >
                    {row.map((item, ci) => {
                      const idx = ri * 4 + ci;
                      return (
                        <TouchableOpacity
                          key={item.id}
                          onPress={() => {
                            Haptics.selectionAsync();
                            router.push(`/profile-view?type=user&id=${item.id}` as any);
                          }}
                          activeOpacity={0.82}
                          style={{
                            alignItems: "center",
                            gap: 6,
                            width: (SW - 44 - 24) / 4,
                          }}
                        >
                          <View
                            style={{
                              position: "relative",
                              alignItems: "center",
                            }}
                          >
                            {idx === 0 && (
                              <View
                                style={{
                                  position: "absolute",
                                  top: -14,
                                  right: -2,
                                  alignItems: "center",
                                  zIndex: 1,
                                }}
                              >
                                <Svg
                                  width={30}
                                  height={25}
                                  viewBox="0 0 20 16"
                                  style={{ transform: [{ rotate: "20deg" }] }}
                                >
                                  <Path
                                    d="M2 14 L4 6 L8 10 L10 2 L12 10 L16 6 L18 14 Z"
                                    fill="#f9bf00"
                                  />
                                </Svg>
                              </View>
                            )}

                            <View
                              style={[
                                styles.pluggerAvatar,
                                { backgroundColor: C.bg3 },
                              ]}
                            >
                              {item.pfp ? (
                                <Image
                                  source={{ uri: item.pfp }}
                                  style={StyleSheet.absoluteFillObject}
                                  resizeMode="cover"
                                />
                              ) : (
                                <Text
                                  style={{
                                    color: "#fff",
                                    fontFamily: "Roobert-Bold",
                                    fontSize: 15,
                                  }}
                                >
                                  {item.name[0]?.toUpperCase()}
                                </Text>
                              )}
                            </View>
                          </View>
                          <Text
                            style={{
                              color: C.txt,
                              fontFamily: "Roobert-Bold",
                              fontSize: 11,
                              letterSpacing: -0.2,
                              textAlign: "center",
                            }}
                            numberOfLines={1}
                          >
                            {item.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ),
              )}
            </View>
          </View>
        )}

        {/* Nearby hotspot posts */}
        {nearbyHotspotPosts.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 7 }}
              >
                <View style={styles.sectionDot} />
                <Text style={[styles.sectionTitle, { color: C.txt }]}>
                  {view === "city" ? "posts near you" : "top posts"}
                </Text>
              </View>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 22, gap: 12 }}
            >
              {nearbyHotspotPosts.map((p) => (
                <TouchableOpacity
                  key={p.postId}
                  onPress={() => { Haptics.selectionAsync(); router.push(`/profile-view?type=hotspot&id=${p.hotspotId}` as any); }}
                  activeOpacity={0.82}
                  style={{ width: 110 }}
                >
                  {p.isActive ? (
                    <LinearGradient
                      colors={["#833AB4", "#1877F2", "#E1306C"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{ borderRadius: 18, padding: 2 }}
                    >
                      <View style={[styles.nearbyPostCard, { width: "100%" }]}>
                        <Image source={{ uri: p.media }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                        <View style={[styles.nearbyPostOverlay, { backgroundColor: C.bg }]} />
                        {p.hotspotAvatar && (
                          <View style={{ position: "absolute", top: 8, right: 8, width: 26, height: 26, borderRadius: 13, overflow: "hidden", backgroundColor: C.bg3, borderWidth: 1.5, borderColor: "#000" }}>
                            <Image source={{ uri: p.hotspotAvatar }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                          </View>
                        )}
                        <Text style={{ position: "absolute", bottom: 8, left: 8, right: 8, color: "#fff", fontFamily: "Roobert-SemiBold", fontSize: 10, letterSpacing: -0.2 }} numberOfLines={1}>{p.hotspotName}</Text>
                      </View>
                    </LinearGradient>
                  ) : (
                    <View style={[styles.nearbyPostCard, { width: "100%" }]}>
                      <Image source={{ uri: p.media }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                      <View style={[styles.nearbyPostOverlay, { backgroundColor: C.bg }]} />
                      {p.hotspotAvatar && (
                        <View style={{ position: "absolute", top: 8, right: 8, width: 26, height: 26, borderRadius: 13, overflow: "hidden", backgroundColor: C.bg3, borderWidth: 1.5, borderColor: "#000" }}>
                          <Image source={{ uri: p.hotspotAvatar }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                        </View>
                      )}
                      <Text style={{ position: "absolute", bottom: 8, left: 8, right: 8, color: "#fff", fontFamily: "Roobert-SemiBold", fontSize: 10, letterSpacing: -0.2 }} numberOfLines={1}>{p.hotspotName}</Text>
                    </View>
                  )}
                  {p.authorName && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6, paddingHorizontal: 2 }}>
                      <View style={{ width: 18, height: 18, borderRadius: 9, overflow: "hidden", backgroundColor: C.card2, alignItems: "center", justifyContent: "center" }}>
                        {p.authorPfp
                          ? <Image source={{ uri: p.authorPfp }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                          : <Text style={{ color: "#fff", fontFamily: "Roobert-Bold", fontSize: 7 }}>{p.authorName.charAt(0)}</Text>
                        }
                      </View>
                      <Text style={{ color: "#fff", fontFamily: "Roobert-SemiBold", fontSize: 10, flex: 1 }} numberOfLines={1}>
                        {p.authorName}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            {(() => {
              const postPins = nearbyHotspotPosts.filter(
                (p) => p.lat != null && p.lng != null && p.media,
              );
              if (!postPins.length || !userCoords) return null;
              return (
                <View style={{ marginHorizontal: 22, marginTop: 16, borderRadius: 20, overflow: "hidden", height: 200 }}>
                  <MapView
                    style={StyleSheet.absoluteFillObject}
                    provider={PROVIDER_GOOGLE}
                    customMapStyle={DARK_MAP_STYLE}
                    initialRegion={{
                      latitude: userCoords.lat,
                      longitude: userCoords.lon,
                      latitudeDelta: 0.72,
                      longitudeDelta: 0.72,
                    }}
                    showsMyLocationButton={false}
                    showsCompass={false}
                    showsScale={false}
                    showsBuildings={false}
                    showsTraffic={false}
                    showsIndoors={false}
                    rotateEnabled={false}
                    pitchEnabled={false}
                    scrollEnabled={true}
                    zoomEnabled={true}
                    legalLabelInsets={{ top: 0, left: 0, bottom: -100, right: -100 }}
                  >
                    <Marker
                      coordinate={{ latitude: userCoords.lat, longitude: userCoords.lon }}
                      anchor={{ x: 0.5, y: 0.5 }}
                      tracksViewChanges={false}
                    >
                      <View style={styles.userPin}>
                        {pfp
                          ? <Image source={{ uri: pfp }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                          : <Text style={{ color: "#fff", fontFamily: "Roobert-Bold", fontSize: 11 }}>{initial}</Text>
                        }
                      </View>
                    </Marker>
                    {postPins.map((p) => (
                      <Marker
                        key={p.postId}
                        coordinate={{ latitude: p.lat!, longitude: p.lng! }}
                        anchor={{ x: 0.5, y: 1 }}
                        tracksViewChanges={false}
                        onPress={() => { Haptics.selectionAsync(); router.push(`/profile-view?type=hotspot&id=${p.hotspotId}` as any); }}
                      >
                        <View style={{ alignItems: "center" }}>
                          <View style={{ width: 44, height: 44, borderRadius: 11, overflow: "hidden", borderWidth: 2, borderColor: "#fff" }}>
                            <Image source={{ uri: p.media }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                          </View>
                          <View style={{ width: 3, height: 6, backgroundColor: "#fff", borderRadius: 2, marginTop: -1 }} />
                        </View>
                      </Marker>
                    ))}
                  </MapView>
                </View>
              );
            })()}
            <TouchableOpacity
              activeOpacity={0.82}
              onPress={() => { Haptics.selectionAsync(); router.push(`/posts?view=${view}` as any); }}
              style={{ alignSelf: "center", backgroundColor: 'black', paddingHorizontal: 14, marginTop: 12, padding: 9, borderRadius: 52, borderColor: '#111', borderWidth: 1, alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ fontFamily: "Roobert-Bold", fontSize: 13, color: 'white' }}>see more</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Top plugged in */}
        {nearbyPluggedIn.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 7 }}
              >
                <View style={styles.sectionDot} />
                <Text style={[styles.sectionTitle, { color: C.txt }]}>
                  {view === "city" ? "top plugged in nearby" : "top plugged in"}
                </Text>
              </View>
            </View>
            <View style={{ paddingHorizontal: 22, gap: 15, marginTop: 16 }}>
              {[nearbyPluggedIn.slice(0, 4), nearbyPluggedIn.slice(4, 8)].map(
                (row, ri) => (
                  <View
                    key={ri}
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                    }}
                  >
                    {row.map((item, ci) => {
                      const idx = ri * 4 + ci;
                      return (
                        <TouchableOpacity
                          key={item.id}
                          onPress={() => {
                            Haptics.selectionAsync();
                            router.push(`/profile-view?type=user&id=${item.id}` as any);
                          }}
                          activeOpacity={0.82}
                          style={{
                            alignItems: "center",
                            gap: 6,
                            width: (SW - 44 - 24) / 4,
                          }}
                        >
                          <View
                            style={{
                              position: "relative",
                              alignItems: "center",
                            }}
                          >
                            {idx === 0 && (
                              <View
                                style={{
                                  position: "absolute",
                                  top: -14,
                                  right: -2,
                                  alignItems: "center",
                                  zIndex: 1,
                                }}
                              >
                                <Svg
                                  width={30}
                                  height={25}
                                  viewBox="0 0 20 16"
                                  style={{ transform: [{ rotate: "20deg" }] }}
                                >
                                  <Path
                                    d="M2 14 L4 6 L8 10 L10 2 L12 10 L16 6 L18 14 Z"
                                    fill="#f9bf00"
                                  />
                                </Svg>
                              </View>
                            )}
                            <View
                              style={[
                                styles.pluggerAvatar,
                                { backgroundColor: C.bg3 },
                              ]}
                            >
                              {item.pfp ? (
                                <Image
                                  source={{ uri: item.pfp }}
                                  style={StyleSheet.absoluteFillObject}
                                  resizeMode="cover"
                                />
                              ) : (
                                <Text
                                  style={{
                                    color: "#fff",
                                    fontFamily: "Roobert-Bold",
                                    fontSize: 15,
                                  }}
                                >
                                  {item.name[0]?.toUpperCase()}
                                </Text>
                              )}
                            </View>
                          </View>
                          <Text
                            style={{
                              color: C.txt,
                              fontFamily: "Roobert-Bold",
                              fontSize: 11,
                              letterSpacing: -0.2,
                              textAlign: "center",
                            }}
                            numberOfLines={1}
                          >
                            {item.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ),
              )}
            </View>
          </View>
        )}

        {/* Leaderboard */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
              <View style={styles.sectionDot} />
              <Text style={[styles.sectionTitle, { color: C.txt }]}>leaderboard</Text>
            </View>
          </View>

          {/* Tab selector */}
          <View style={{ flexDirection: "row", marginHorizontal: 22, marginBottom: 14, backgroundColor: 'black', borderRadius: 30, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, padding: 5, gap: 3 }}>
            {(["cities", "hotspots", "pluggers"] as const).map((tab) => (
              <TouchableOpacity
                key={tab}
                activeOpacity={0.82}
                onPress={() => { Haptics.selectionAsync(); setLbTab(tab); }}
                style={{ flex: 1, borderRadius: 22, paddingVertical: 7, alignItems: "center", backgroundColor: lbTab === tab ? C.txt : "transparent" }}
              >
                <Text style={{ fontFamily: lbTab === tab ? "Roobert-Bold" : "Roobert-SemiBold", fontSize: 11, color: lbTab === tab ? C.bg : 'white' }}>
                  {tab}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Cities */}
          {lbTab === "cities" && (
            <View style={[styles.listCard, { backgroundColor: C.card }]}>
              {hotCities.map((item, i) => (
                <View key={item.city} style={[styles.cityRow, i < hotCities.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }]}>
                  <Text style={[styles.cityRank, { color: i === 0 ? "#3B82F6" : C.txt3 }]}>#{i + 1}</Text>
                  <PulseDot color="#3B82F6" size={5} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cityName, { color: C.txt }]} numberOfLines={1}>{item.city}</Text>
                  </View>
                  {item.topHotspots.length > 0 && (
                    <View style={{ flexDirection: "row", alignItems: "center", marginRight: 10 }}>
                      {item.topHotspots.map((h, hi) => (
                        <View key={h.id} style={{ width: 24, height: 24, borderRadius: 12, overflow: "hidden", backgroundColor: "#000", borderWidth: 1.5, borderColor: C.card, marginLeft: hi === 0 ? 0 : -8, zIndex: 3 - hi, alignItems: "center", justifyContent: "center" }}>
                          {h.avatar
                            ? <Image source={{ uri: h.avatar }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                            : <Text style={{ color: "#fff", fontFamily: "Roobert-Bold", fontSize: 9 }}>{h.name[0]?.toUpperCase()}</Text>
                          }
                        </View>
                      ))}
                    </View>
                  )}
                  <Text style={[styles.cityScore, { color: C.txt2 }]}>{item.score} pts</Text>
                </View>
              ))}
            </View>
          )}

          {/* Hotspots */}
          {lbTab === "hotspots" && (
            <View style={[styles.listCard, { backgroundColor: C.card }]}>
              {(lbData?.leaderboardHotspots ?? [])
                .filter((h) => !h.isEvent && !h.isPopup)
                .sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
                .slice(0, 50)
                .map((h, i, list) => {
                return (
                  <TouchableOpacity
                    key={h.id}
                    activeOpacity={0.82}
                    onPress={() => { Haptics.selectionAsync(); router.push(`/profile-view?type=hotspot&id=${h.id}` as any); }}
                    style={[styles.cityRow, i < list.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }]}
                  >
                    <Text style={[styles.cityRank, { color: i === 0 ? "#3B82F6" : C.txt3 }]}>#{i + 1}</Text>
                    <PulseDot color="#3B82F6" size={5} />
                    <View style={[styles.mapPillAvatar, { backgroundColor: "#000", alignItems: "center", justifyContent: "center" }]}>
                      {h.avatar
                        ? <Image source={{ uri: h.avatar }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                        : <Text style={{ color: "#fff", fontFamily: "Roobert-Bold", fontSize: 9 }}>{h.name[0]?.toUpperCase()}</Text>
                      }
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cityName, { color: C.txt }]} numberOfLines={1}>{h.name}</Text>
                    </View>
                    <Text style={[styles.cityScore, { color: C.txt2 }]}>{h.points} pts</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Pluggers */}
          {lbTab === "pluggers" && (
            <View style={[styles.listCard, { backgroundColor: C.card }]}>
              {[...(usersData?.leaderboardUsersByPoints ?? [])]
                .map(({ user: u }) => ({ user: u, total: u.points + computeMedalPointsForUser(u) }))
                .sort((a, b) => b.total - a.total)
                .slice(0, 50)
                .map(({ user: u, total }, i, arr) => {
                const city = u.location?.address ? extractCity(u.location.address) : null;
                return (
                  <TouchableOpacity
                    key={u.id}
                    activeOpacity={0.82}
                    onPress={() => { Haptics.selectionAsync(); router.push(`/profile-view?type=user&id=${u.id}` as any); }}
                    style={[styles.cityRow, i < arr.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }]}
                  >
                    <Text style={[styles.cityRank, { color: i === 0 ? "#3B82F6" : C.txt3 }]}>#{i + 1}</Text>
                    <PulseDot color="#3B82F6" size={5} />
                    <View style={[styles.pluggerAvatar, { width: 32, height: 32, borderRadius: 16, backgroundColor: "#000", alignItems: "center", justifyContent: "center" }]}>
                      {u.pfp
                        ? <Image source={{ uri: u.pfp }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                        : <Text style={{ color: "#fff", fontFamily: "Roobert-Bold", fontSize: 12 }}>{u.name[0]?.toUpperCase()}</Text>
                      }
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cityName, { color: C.txt }]} numberOfLines={1}>{u.name}</Text>
                    </View>
                    <Text style={[styles.cityScore, { color: C.txt2 }]}>
                      {total.toLocaleString()} pts
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

      </ScrollView>

      {/* Fullscreen map modal */}
      <Modal
        visible={mapFullscreen}
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setMapFullscreen(false)}
      >
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          {userCoords && (
            <MapView
              style={StyleSheet.absoluteFillObject}
              provider={PROVIDER_GOOGLE}
              customMapStyle={DARK_MAP_STYLE}
              initialRegion={{
                latitude: userCoords.lat,
                longitude: userCoords.lon,
                latitudeDelta: 0.018,
                longitudeDelta: 0.018,
              }}
              showsMyLocationButton={false}
              showsCompass={false}
              showsScale={false}
              showsBuildings={false}
              showsTraffic={false}
              showsIndoors={false}
              rotateEnabled={false}
              pitchEnabled={false}
              scrollEnabled={true}
              zoomEnabled={true}
              legalLabelInsets={{ top: 0, left: 0, bottom: -100, right: -100 }}
            >
              <Marker
                coordinate={{
                  latitude: userCoords.lat,
                  longitude: userCoords.lon,
                }}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={false}
              >
                <View style={styles.userPin}>
                  {pfp ? (
                    <Image
                      source={{ uri: pfp }}
                      style={StyleSheet.absoluteFillObject}
                      resizeMode="cover"
                    />
                  ) : (
                    <Text
                      style={{
                        color: "#fff",
                        fontFamily: "Roobert-Bold",
                        fontSize: 13,
                      }}
                    >
                      {initial}
                    </Text>
                  )}
                </View>
              </Marker>
              {userCoords && (
                <Circle
                  center={{ latitude: userCoords.lat, longitude: userCoords.lon }}
                  radius={RADIUS_M}
                  strokeColor="rgba(0,0,0,0.6)"
                  fillColor="rgba(0,0,0,0.08)"
                  strokeWidth={1}
                />
              )}
              {mapHotspots.map((h) => (
                <Marker
                  key={h.id}
                  coordinate={{ latitude: h.resolvedLat, longitude: h.resolvedLng }}
                  anchor={{ x: 0.5, y: 1 }}
                  tracksViewChanges={false}
                  onPress={() => {
                    setMapFullscreen(false);
                    Haptics.selectionAsync();
                    router.push(`/profile-view?type=hotspot&id=${h.id}` as any);
                  }}
                >
                  <FeedPin uri={h.avatar} initial={h.name[0]?.toUpperCase() ?? "?"} />
                </Marker>
              ))}
              {resolvedPopups.map((p) => (
                <Marker
                  key={`fs-popup-${p.id}`}
                  coordinate={{ latitude: p.resolvedLat, longitude: p.resolvedLng }}
                  anchor={{ x: 0.5, y: 1 }}
                  tracksViewChanges={false}
                  onPress={() => {
                    setMapFullscreen(false);
                    Haptics.selectionAsync();
                    router.push(`/profile-view?type=hotspot&id=${p.id}` as any);
                  }}
                >
                  <FeedPin uri={p.avatar} initial={p.name[0]?.toUpperCase() ?? "?"} />
                </Marker>
              ))}
              {nearbyPluggers.slice(0, 12).map((u) => {
                const geo = geocodeCache.get(`u-${u.id}`);
                const lat = u.location?.address ? geo?.lat : u.location?.latitude;
                const lng = u.location?.address ? geo?.lng : u.location?.longitude;
                if (!lat || !lng) return null;
                return (
                  <Marker
                    key={`fs-plugger-${u.id}`}
                    coordinate={{ latitude: lat, longitude: lng }}
                    anchor={{ x: 0.5, y: 1 }}
                    tracksViewChanges={false}
                    onPress={() => {
                      setMapFullscreen(false);
                      Haptics.selectionAsync();
                      router.push(`/profile-view?type=user&id=${u.id}` as any);
                    }}
                  >
                    <PluggerPin uri={u.pfp} name={u.name} />
                  </Marker>
                );
              })}
              {nearbyPluggedIn.slice(0, 12).map((u) => {
                const geo = geocodeCache.get(`u-${u.id}`);
                const lat = u.location?.address ? geo?.lat : u.location?.latitude;
                const lng = u.location?.address ? geo?.lng : u.location?.longitude;
                if (!lat || !lng) return null;
                return (
                  <Marker
                    key={`fs-pluggedin-${u.id}`}
                    coordinate={{ latitude: lat, longitude: lng }}
                    anchor={{ x: 0.5, y: 1 }}
                    tracksViewChanges={false}
                    onPress={() => {
                      setMapFullscreen(false);
                      Haptics.selectionAsync();
                      router.push(`/profile-view?type=user&id=${u.id}` as any);
                    }}
                  >
                    <PluggerPin uri={u.pfp} name={u.name} />
                  </Marker>
                );
              })}
            </MapView>
          )}
          {/* Close button */}
          <TouchableOpacity
            onPress={() => {
              Haptics.selectionAsync();
              setMapFullscreen(false);
            }}
            activeOpacity={0.82}
            style={{
              position: "absolute",
              top: insets.top + 12,
              right: 16,
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: "rgba(0,0,0,0.75)",
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: "rgba(255,255,255,0.18)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={16} color="#fff" strokeWidth={1.5} />
          </TouchableOpacity>
          {/* Legend */}
          <View style={{ position: "absolute", bottom: insets.bottom + 20, left: 16, gap: 5 }}>
            {[
              { label: "hotspots / events / popups", shape: "circle" },
              { label: "pluggers / plugged in", shape: "card" },
            ].map(({ label, shape }) => (
              <View
                key={label}
                style={{
                  flexDirection: "row", alignItems: "center", gap: 6,
                  backgroundColor: "rgba(0,0,0,0.7)", borderRadius: 10,
                  paddingHorizontal: 10, paddingVertical: 6,
                  borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.12)",
                }}
              >
                {shape === "circle"
                  ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#fff", borderWidth: 1, borderColor: "#fff" }} />
                  : <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: "#fff", borderWidth: 1, borderColor: "#fff" }} />
                }
                <Text style={{ color: "#fff", fontFamily: "Roobert-Medium", fontSize: 10 }}>{label}</Text>
              </View>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  // Top panel
  topPanel: {
    paddingHorizontal: 22,
    zIndex: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontFamily: "Roobert-Bold",
    fontSize: 26,
    letterSpacing: -1.2,
  },
  pfpBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  // Shared list card (hotspots, cities)
  listCard: {
    marginHorizontal: 22,
    borderRadius: 20,
    overflow: "hidden",
  },
  // Section dot accent
  sectionDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#3B82F6",
  },
  // "See all" pill
  seeAllPill: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  seeAllText: {
    fontFamily: "Roobert-Medium",
    fontSize: 11,
    letterSpacing: -0.1,
  },
  // Mini map
  miniMap: {
    marginHorizontal: 22,
    height: 220,
    borderRadius: 28,
    overflow: "hidden",
  },
  userPin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 2.5,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111",
  },
  hotspotPin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#222",
  },
  // Stories
  storyScroll: {
    marginTop: 12,
  },
  storyRow: {
    paddingHorizontal: 12,

    gap: 3,
  },
  bubbleWrap: {
    alignItems: "center",
    gap: 6,
    width: 64,
  },
  gradRing: {
    width: 50,
    height: 50,
    borderRadius: 30,
    padding: 2.5,
    alignItems: "center",
    justifyContent: "center",
  },
  innerRing: {
    width: "100%",
    height: "100%",
    borderRadius: 28,
    padding: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  bubbleCircle: {
    width: 50,
    height: 50,
    borderRadius: 26,
    borderColor: "#3B82F6",
    borderWidth: 3,
    padding: 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  bubbleLabel: {
    fontFamily: "Roobert-SemiBold",
    fontSize: 10,
    letterSpacing: -0.2,
    width: 54,
    textAlign: "center",
  },
  hRowCard: {
    marginHorizontal: 22,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  // Hotspot cards
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontFamily: "Roobert-Bold",
    fontSize: 18,
    letterSpacing: -0.6,
  },
  hotspotRow: {
    paddingHorizontal: 22,
    paddingBottom: 4,
    gap: 12,
  },
  hotspotGrid: {
    paddingHorizontal: 22,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12,
  },
  hotspotCard: {
    width: "100%",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    padding: 10,
    gap: 8,
  },
  hotspotAvatar: {
    width: "100%",
    height: 90,
    borderRadius: 10,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  hotspotInfo: {
    gap: 3,
  },
  hotspotName: {
    fontFamily: "Roobert-SemiBold",
    fontSize: 13,
    letterSpacing: -0.3,
  },
  hotspotType: {
    fontFamily: "Roobert-Regular",
    fontSize: 10,
    letterSpacing: 0.1,
    textTransform: "uppercase",
  },
  hotspotAddress: {
    fontFamily: "Roobert-Regular",
    fontSize: 10,
    lineHeight: 14,
  },
  hotspotStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
  },
  hotspotStatusLabel: {
    fontFamily: "Roobert-Medium",
    fontSize: 10,
  },
  // Upgrade banner
  upgradeBanner: {
    marginHorizontal: 22,
    borderRadius: 40,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    minHeight: 148,
  },
  upgradeLeft: {
    flex: 1,
    gap: 6,
  },
  upgradePill: {
    alignSelf: "flex-start",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 2,
  },
  upgradePillText: {
    fontFamily: "Roobert-Bold",
    fontSize: 9,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  upgradeHeadline: {
    fontFamily: "Roobert-Bold",
    fontSize: 22,
    letterSpacing: -0.8,
  },
  upgradeSub: {
    fontFamily: "Roobert-SemiBold",
    fontSize: 10,
    opacity: 0.35,
    letterSpacing: 0.1,
  },
  upgradeBtn: {
    alignSelf: "flex-start",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 6,
  },
  upgradeBtnText: {
    fontFamily: "Roobert-SemiBold",
    fontSize: 12,
    letterSpacing: -0.2,
  },
  upgradeRight: {
    marginLeft: 12,
    opacity: 0.9,
  },
  upgradeAdTag: {
    position: "absolute",
    bottom: 10,
    right: 14,
    fontFamily: "Roobert-Regular",
    fontSize: 8,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    opacity: 0.25,
  },
  // Section headers
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    marginBottom: 14,
  },
  seeAll: {
    fontFamily: "Roobert-Regular",
    fontSize: 12,
  },
  emptyText: {
    fontFamily: "Roobert-Regular",
    fontSize: 13,
    paddingHorizontal: 22,
    paddingVertical: 8,
  },
  // Categories
  catRow: {
    paddingHorizontal: 22,
    gap: 18,
  },
  catItem: {
    alignItems: "center",
    gap: 6,
  },
  catCircle: {
    width: 54,
    height: 54,
    borderRadius: 20,
    borderWidth: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  catLabel: {
    fontFamily: "Roobert-Bold",
    fontSize: 10,
    letterSpacing: -0.1,
  },
  // Categories grid
  catGrid: {
    paddingHorizontal: 22,
    gap: 8,
  },
  catGridRow: {
    flexDirection: "row",
    gap: 8,
  },
  catPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: (SW - 44 - 8) / 2,
  },
  catPillLabel: {
    fontFamily: "Roobert-Bold",
    fontSize: 12,
    letterSpacing: -0.2,
  },
  // City leaderboard
  cityLeaderboard: {
    marginHorizontal: 22,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  cityRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  cityRank: {
    fontFamily: "Roobert-Bold",
    fontSize: 13,
    width: 28,
  },
  cityHeat: {
    fontFamily: "Roobert-Medium",
    fontSize: 9,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  cityName: {
    fontFamily: "Roobert-Bold",
    fontSize: 15,
    letterSpacing: -0.4,
  },
  cityMeta: {
    fontFamily: "Roobert-Regular",
    fontSize: 10,
  },
  cityScore: {
    fontFamily: "Roobert-SemiBold",
    fontSize: 10,
    color: "#fff",
  },
  pluggerAvatar: {
    width: 55,
    height: 55,
    borderRadius: 999,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  nearbyPostCard: {
    width: 140,
    height: 190,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#1A1A1A",
  },
  nearbyPostOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.15,
  },
  nearbyPostAvatarWrap: {
    position: "absolute",
    top: 8,
    right: 8,
  },
  nearbyPostGradRing: {
    width: 36,
    height: 36,
    borderRadius: 18,
    padding: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  nearbyPostAvatarInner: {
    width: "100%",
    height: "100%",
    borderRadius: 16,
    padding: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  nearbyPostAvatar: {
    width: "100%",
    height: "100%",
    borderRadius: 999,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  viewToggle: {
    flexDirection: "row",
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 3,
    alignSelf: "flex-start",
  },
  viewToggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  pointsBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pluggerGradRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    padding: 2.5,
    alignItems: "center",
    justifyContent: "center",
  },
  pluggerRingInner: {
    width: "100%",
    height: "100%",
    borderRadius: 28,
    padding: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  userMapPin: {
    width: 30,
    height: 30,
    borderRadius: 15,
    overflow: "hidden",
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#222",
  },
  mapPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#000",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.22)",
    maxWidth: 140,
  },
  mapPillAvatar: {
    width: 28,
    height: 28,
    borderRadius: 19,
    overflow: "hidden",
    backgroundColor: "#333",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  mapPillName: {
    color: "#fff",
    fontFamily: "Roobert-Bold",
    fontSize: 10,
    letterSpacing: -0.2,
  },
  mapPillAddr: {
    color: "rgba(255,255,255,0.45)",
    fontFamily: "Roobert-Regular",
    fontSize: 9,
  },
  mapPillTail: {
    width: 2,
    height: 6,
    backgroundColor: "rgba(255,255,255,0.5)",
    borderRadius: 1,
  },
});

