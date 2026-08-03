import {
  ALL_HOTSPOTS,
  GET_EVENTS,
  ME_QUERY,
  SEARCH_QUERY,
} from "@/app/apollo/queries/general";
import { useColors } from "@/contexts/theme";
import { DARK_MAP_STYLE } from "@/constants/mapStyle";
import { useQuery, useLazyQuery } from "@apollo/client/react";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { MeQueryData } from ".";
import { router } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated as RNAnimated,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Video, ResizeMode } from "expo-av";
import { ArrowRight, ArrowUpRight, MapPin, Maximize2, Minimize2, Navigation, Search, TrendingUp, X, Zap } from "lucide-react-native";

const { width: W } = Dimensions.get("window");

// ─── Types ────────────────────────────────────────────────────────────────────
interface Hotspot {
  id: string;
  name: string;
  avatar?: string;
  type?: string;
  time?: string;
  description?: string;
  isEvent?: boolean;
  ratings?: number;
  visits?: number;
  points?: number;
  followersCount?: number;
  checkins?: { id: string; createdAt?: string; user?: { id: string; name: string; pfp?: string } }[];
  displayPosts?: { id: string; media?: string }[];
  posts?: {
    id: string;
    media?: string;
    createdAt?: string;
    author?: { id: string; name: string; pfp?: string };
  }[];
  location?: {
    id?: string;
    latitude?: number;
    longitude?: number;
    address?: string;
  };
  author?: { id: string; name: string; pfp?: string };
}

interface UserResult {
  id: string;
  name: string;
  pfp?: string;
  bio?: string;
  followersCount?: number;
}

const NEARBY_KM = 40.23; // 25 miles
const geocodeCache = new Map<string, { lat: number; lng: number }>();

const TYPES = [
  "All",
  "Bar",
  "Club",
  "Restaurant",
  "Lounge",
  "Rooftop",
  "Gallery",
  "Popup",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isVideo(uri: string): boolean {
  return /\.(mp4|mov|m4v|webm|m3u8)(\?|$)/i.test(uri);
}

const GEO_SKIP = new Set([
  // Countries
  "usa", "united states", "united states of america", "us",
  "canada", "mexico", "uk", "united kingdom", "great britain",
  "australia", "france", "germany", "spain", "italy", "japan",
  "china", "india", "brazil", "nigeria", "south africa",
  // US states — full names
  "alabama", "alaska", "arizona", "arkansas", "california",
  "colorado", "connecticut", "delaware", "florida", "georgia",
  "hawaii", "idaho", "illinois", "indiana", "iowa", "kansas",
  "kentucky", "louisiana", "maine", "maryland", "massachusetts",
  "michigan", "minnesota", "mississippi", "missouri", "montana",
  "nebraska", "nevada", "new hampshire", "new jersey", "new mexico",
  "new york", "north carolina", "north dakota", "ohio", "oklahoma",
  "oregon", "pennsylvania", "rhode island", "south carolina",
  "south dakota", "tennessee", "texas", "utah", "vermont",
  "virginia", "washington", "west virginia", "wisconsin", "wyoming",
  "district of columbia",
  // Canadian provinces
  "ontario", "quebec", "british columbia", "alberta", "manitoba",
  "saskatchewan", "nova scotia", "new brunswick", "newfoundland",
  "prince edward island",
]);

function extractCity(address: string): string | null {
  const parts = address.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  for (let i = parts.length - 1; i > 0; i--) {
    const p = parts[i];
    // Skip: pure zip, state abbrev, or state+zip
    if (/^\d{5}(-\d{4})?$/.test(p)) continue;
    if (/^[A-Z]{2}(\s+\d{5}(-\d{4})?)?$/.test(p)) continue;
    // Skip: looks like a street (starts with number)
    if (/^\d/.test(p)) continue;
    // Skip: countries, states, provinces
    if (GEO_SKIP.has(p.toLowerCase())) continue;
    return p;
  }
  return null;
}

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


// ─── Pulsing dot ──────────────────────────────────────────────────────────────
function PulseDot({
  color = "#fff",
  size = 5,
}: {
  color?: string;
  size?: number;
}) {
  const opacity = useRef(new RNAnimated.Value(1)).current;
  useEffect(() => {
    const anim = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(opacity, {
          toValue: 0.1,
          duration: 500,
          useNativeDriver: true,
        }),
        RNAnimated.timing(opacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, []);
  return (
    <RNAnimated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity,
        alignSelf: "center",
      }}
    />
  );
}

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)     return "just now";
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function hasRecentPost(hotspot: Hotspot): boolean {
  const cutoff = Date.now() - TWENTY_FOUR_HOURS;
  return (hotspot.posts ?? []).some(
    (p) => p.createdAt && new Date(p.createdAt).getTime() >= cutoff,
  );
}

function getActivityStatus(score: number): { color: string; label: string } {
  if (score === 0) return { color: "#EF4444", label: "Dead" };
  if (score <= 3)  return { color: "#3B82F6", label: "Steady" };
  if (score <= 8)  return { color: "#833AB4", label: "Active" };
  return { color: "#E1306C", label: "Poppin'" };
}

function activityScore(h: Hotspot): number {
  const cutoff = Date.now() - TWENTY_FOUR_HOURS;
  const recentCheckins = (h.checkins ?? []).filter(
    (c) => c.createdAt && new Date(c.createdAt).getTime() >= cutoff,
  ).length;
  const recentPosts = (h.posts ?? []).filter(
    (p) => p.createdAt && new Date(p.createdAt).getTime() >= cutoff,
  ).length;
  return recentCheckins + recentPosts;
}

// ─── Map pin — circle avatar + triangle point (matches index.tsx) ────────────
function HotspotPin({
  hotspot,
  live,
  onReady,
}: {
  hotspot: Hotspot;
  live: boolean;
  onReady?: () => void;
}) {
  const img = hotspot.avatar || hotspot.displayPosts?.[0]?.media;
  const circle = (
    <View
      style={[styles.hotspotPinCircle, live && { borderColor: "transparent" }]}
    >
      {img ? (
        <Image
          source={{ uri: img }}
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
    <View style={styles.hotspotPinWrap}>
      {live ? (
        <LinearGradient colors={["#833AB4", "#1877F2", "#833AB4"]} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={{ borderRadius: 30, padding: 2.5, alignItems: "center", justifyContent: "center" }}>
          {circle}
        </LinearGradient>
      ) : (
        circle
      )}
    </View>
  );
}

// ─── Marker wrapper — tracks view changes until avatar image loads ─────────────
function TrackedMarker({
  hotspot,
  lat,
  lng,
}: {
  hotspot: Hotspot;
  lat: number;
  lng: number;
}) {
  const [ready, setReady] = useState(
    !hotspot.avatar && !hotspot.displayPosts?.[0]?.media,
  );
  const live = hasRecentPost(hotspot);
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
        onReady={() => setReady(true)}
      />
    </Marker>
  );
}

// ─── Active-now stories row ───────────────────────────────────────────────────
interface StoryHotspot {
  hotspot: Hotspot;
  recentPost?: { id: string; media?: string };
}

function StoryRow({ hotspots }: { hotspots: StoryHotspot[] }) {
  const C = useColors();
  if (!hotspots.length) return null;
  return (
    <View style={{ paddingTop: 7, paddingBottom: 4 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 5, gap: 10 }}
      >
        {hotspots.map(({ hotspot, recentPost }) => {
          const img = hotspot.avatar ?? recentPost?.media;
          return (
            <TouchableOpacity
              key={hotspot.id}
              activeOpacity={0.75}
              onPress={() => {
                Haptics.selectionAsync();
                router.push(`/profile-view?type=hotspot&id=${hotspot.id}` as any);
              }}
              style={{ alignItems: "center", gap: 6 }}
            >
              <LinearGradient colors={["#833AB4", "#1877F2", "#833AB4"]} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={{ width: 50, height: 50, borderRadius: 30, padding: 2.5, alignItems: "center", justifyContent: "center" }}>
                <View
                  style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: 28,
                    overflow: "hidden",
                    borderWidth: 2,
                    borderColor: C.bg,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: C.bg3,
                  }}
                >
                  {img ? (
                    <Image
                      source={{ uri: img }}
                      style={{ width: "100%", height: "100%" }}
                      resizeMode="cover"
                    />
                  ) : (
                    <MapPin size={16} color={C.txt2} strokeWidth={1.5} />
                  )}
                </View>
              </LinearGradient>
              <Text
                style={{
                  color: "white",
                  fontFamily: "Roobert-SemiBold",
                  fontSize: 10,
                  maxWidth: 52,
                  textAlign: "center",
                }}
                numberOfLines={1}
              >
                {hotspot.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── Stacked check-in avatars ─────────────────────────────────────────────────
function StackedAvatars({ checkins }: { checkins: Hotspot["checkins"] }) {
  const C = useColors();
  const cutoff = Date.now() - TWENTY_FOUR_HOURS;
  const seen = new Set<string>();
  const users: { id: string; name: string; pfp?: string }[] = [];
  for (const c of checkins ?? []) {
    if (!c.user || !c.createdAt) continue;
    if (new Date(c.createdAt).getTime() < cutoff) continue;
    if (seen.has(c.user.id)) continue;
    seen.add(c.user.id);
    users.push(c.user);
    if (users.length >= 10) break;
  }
  if (!users.length) return null;
  const visible = users.slice(0, 3);
  const overflow = users.length - 3;
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {visible.map((u, i) => (
        <View
          key={u.id}
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            borderWidth: 2,
            borderColor: C.bg,
            overflow: "hidden",
            backgroundColor: C.bg3,
            marginLeft: i === 0 ? 0 : -8,
            alignItems: "center",
            justifyContent: "center",
            zIndex: 3 - i,
          }}
        >
          {u.pfp ? (
            <Image source={{ uri: u.pfp }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
          ) : (
            <Text style={{ color: C.txt2, fontFamily: "Roobert-Bold", fontSize: 10 }}>
              {u.name?.charAt(0).toUpperCase()}
            </Text>
          )}
        </View>
      ))}
      {overflow > 0 && (
        <View
          style={{
            marginLeft: -8,
            height: 28,
            minWidth: 28,
            borderRadius: 14,
            backgroundColor: C.bg3,
            borderWidth: 2,
            borderColor: C.bg,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 4,
            zIndex: 0,
          }}
        >
          <Text style={{ color: C.txt2, fontFamily: "Roobert-Bold", fontSize: 9 }}>+{overflow}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Bottom stories strip ─────────────────────────────────────────────────────
interface BottomStory {
  hotspot: Hotspot;
  post: { id: string; media?: string; createdAt?: string; author?: { id: string; name: string; pfp?: string } };
}

function BottomStoriesStrip({ stories }: { stories: BottomStory[] }) {
  const C = useColors();
  if (!stories.length) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 26, gap: 8, paddingBottom: 10 }}
    >
      {stories.map(({ hotspot, post }) => (
        <TouchableOpacity
          key={`${hotspot.id}-${post.id}`}
          activeOpacity={0.75}
          onPress={() => { Haptics.selectionAsync(); router.push(`/profile-view?type=hotspot&id=${hotspot.id}` as any); }}
          style={{ flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#000' }}
        >
          <PulseDot color="#3B82F6" size={4} />
          <LinearGradient colors={["#833AB4", "#1877F2", "#833AB4"]} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={{ width: 22, height: 22, borderRadius: 11, padding: 1.5, alignItems: "center", justifyContent: "center" }}>
            <View style={{ width: "100%", height: "100%", borderRadius: 9, overflow: "hidden", borderWidth: 1, borderColor: "#000", backgroundColor: C.bg3, alignItems: "center", justifyContent: "center" }}>
              {post.author?.pfp
                ? <Image source={{ uri: post.author.pfp }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                : <Text style={{ color: C.txt2, fontFamily: "Roobert-Bold", fontSize: 7 }}>{post.author?.name?.charAt(0) ?? "?"}</Text>
              }
            </View>
          </LinearGradient>
          <View style={{ width: StyleSheet.hairlineWidth, height: 14, backgroundColor: C.border }} />
          {hotspot.avatar
            ? <Image source={{ uri: hotspot.avatar }} style={{ width: 18, height: 18, borderRadius: 5 }} resizeMode="cover" />
            : <MapPin size={12} color={C.txt3} strokeWidth={1.5} />
          }
          <Text style={{ color: C.txt, fontFamily: "Roobert-SemiBold", fontSize: 12 }} numberOfLines={1}>
            {hotspot.name}
          </Text>
          {post.createdAt && (
            <Text style={{ color: C.txt3, fontFamily: "Roobert-Regular", fontSize: 11 }}>
              {timeAgo(post.createdAt)}
            </Text>
          )}
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

// ─── Hotspot carousel card (matches index.tsx HotspotCarouselCard) ───────────
function HotspotCarouselCard({
  hotspot,
  onPress,
}: {
  hotspot: Hotspot;
  onPress: () => void;
}) {
  const C = useColors();
  const cover = hotspot.avatar ?? hotspot.displayPosts?.[0]?.media;
  const score = activityScore(hotspot);

  return (
    <View style={{ width: W, paddingHorizontal: 15 }}>
      <View style={[styles.detailCard, { backgroundColor: C.bg, borderColor: C.border }]}>
        {/* Top row */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1, marginRight: 8 }}>
            <LinearGradient colors={score > 0 ? ["#833AB4", "#1877F2", "#833AB4"] : ["#1a1a1a", "#1a1a1a"]} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={{ width: 50, height: 50, borderRadius: 30, padding: 2.5, alignItems: "center", justifyContent: "center" }}>
              <View style={{ width: "100%", height: "100%", borderRadius: 28, overflow: "hidden", borderWidth: 2, borderColor: C.bg, backgroundColor: C.bg3, alignItems: "center", justifyContent: "center" }}>
                {cover
                  ? <Image source={{ uri: cover }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                  : <MapPin size={16} color={C.txt2} strokeWidth={1.5} />
                }
              </View>
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.txt, fontFamily: "Roobert-Bold", fontSize: 18, letterSpacing: -0.6, lineHeight: 24 }} numberOfLines={1}>
                {hotspot.name}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
                {(() => {
                  const { color, label } = getActivityStatus(score);
                  return (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <PulseDot color={color} size={6} />
                      <Text style={{ color, fontFamily: "Roobert-Bold", fontSize: 11 }}>{label}</Text>
                    </View>
                  );
                })()}
                {hotspot.type && (
                  <Text style={{ color: 'white', fontFamily: "Roobert-SemiBold", fontSize: 11 }}>{hotspot.type}</Text>
                )}
              </View>
            </View>
          </View>
{(() => {
          const mediaPosts = (hotspot.posts ?? []).filter(p => p.media);
          if (!mediaPosts.length) return null;
          const visible = mediaPosts.slice(0, 3);
          const overflow = mediaPosts.length - 3;
          return (
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4, marginBottom: 6 }}>
              {visible.map((post, i) => (
                <View key={post.id} style={{ width: 44, height: 44, borderRadius: 22, overflow: "hidden", backgroundColor: C.bg3, borderWidth: 4, borderColor: C.bg, marginLeft: i === 0 ? 0 : -12, zIndex: 3 - i }}>
                  {isVideo(post.media!) ? (
                    <Video source={{ uri: post.media! }} style={{ width: "100%", height: "100%" }} resizeMode={ResizeMode.COVER} shouldPlay isLooping isMuted />
                  ) : (
                    <Image source={{ uri: post.media! }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                  )}
                </View>
              ))}
              {overflow > 0 && (
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.bg3, borderWidth: 4, borderColor: C.bg, marginLeft: -12, zIndex: 0, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: C.txt2, fontFamily: "Roobert-Bold", fontSize: 11 }}>+{overflow}</Text>
                </View>
              )}
            </View>
          );
        })()}        </View>

        {/* Location row */}
        {hotspot.location?.address ? (
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 6 }}>
            <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: "#111", alignItems: "center", justifyContent: "center" }}>
                        <Navigation size={15} color={C.txt} strokeWidth={1.5} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.txt, fontFamily: "Roobert-Bold", fontSize: 15 }}>Location</Text>
              <Text numberOfLines={2} style={{ color: C.txt, fontFamily: "Roobert-Medium", fontSize: 11.5, lineHeight: 16, marginTop: 3, marginRight: 70 }}>
                {hotspot.location.address}
              </Text>
            </View>
          </View>
        ) : null}
  

        {/* Navigate button */}
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.85}
          style={{ position: "absolute", bottom: 19, right: 19, width: 48, height: 48, borderRadius: 24, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }}
        >
          <ArrowRight size={18} color="#000" strokeWidth={2.5} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function ExploreScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const { data: meData } = useQuery<MeQueryData>(ME_QUERY);
  const me = meData?.me;

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("All");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTab, setSearchTab] = useState<"hotspots" | "people">("hotspots");
  const searchInputRef = useRef<TextInput>(null);

  const [runUserSearch, { data: userSearchData, loading: userSearchLoading }] =
    useLazyQuery<{ searchUsers: UserResult[] }>(SEARCH_QUERY);

  useEffect(() => {
    if (searchTab === "people" && query.trim().length >= 1) {
      runUserSearch({ variables: { searchString: query.trim(), skip: 0, take: 20 } });
    }
  }, [query, searchTab]);
  const [selectedCity, setSelectedCity] = useState<string>("Nearby");
  const [userCity, setUserCity] = useState<string>("Nearby");
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [scope, setScope] = useState<"city" | "world">("city");

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        const geo = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        if (geo?.[0]?.city) setUserCity(geo[0].city);
      } catch {}
    })();
  }, []);

  const { data: hotspotData, loading: hotspotLoading } = useQuery<{ allHotspots: Hotspot[] }>(
    ALL_HOTSPOTS,
  );

  const [geocodeTick, setGeocodeTick] = useState(0);
  const [headerH, setHeaderH] = useState(0);
  const [mapExpanded, setMapExpanded] = useState(false);

  const hotspots = hotspotData?.allHotspots ?? [];

  useEffect(() => {
    const needsGeocode = hotspots.filter(
      (h) => !!h.location?.address && !geocodeCache.has(h.id),
    );
    if (!needsGeocode.length) return;

    (async () => {
      let didUpdate = false;
      // Batch 5 at a time — iOS CLGeocoder rate-limits ~50/min
      for (let i = 0; i < needsGeocode.length; i += 5) {
        await Promise.all(
          needsGeocode.slice(i, i + 5).map(async (h) => {
            try {
              const results = await Location.geocodeAsync(h.location!.address!);
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
  }, [hotspots]);

  const withDist = useMemo(
    () =>
      hotspots
        .map((h) => {
          // Geocoded-from-address coords take priority once ready.
          // Raw DB coords are used immediately while geocoding is pending.
          const geo = geocodeCache.get(h.id);
          const rawLat = h.location?.latitude;
          const rawLng = h.location?.longitude;
          const hasRaw =
            rawLat != null && rawLng != null && !(rawLat === 0 && rawLng === 0);
          const lat = geo?.lat ?? (hasRaw ? rawLat! : undefined);
          const lng = geo?.lng ?? (hasRaw ? rawLng! : undefined);
          if (lat == null || lng == null) return null;
          return { hotspot: h, lat, lng };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null),
    [hotspots, geocodeTick],
  );

  // Map pins sorted by visits (most popular first)
  const nearbyPins = useMemo(
    () =>
      [...withDist].sort((a, b) => {
        const diff = activityScore(b.hotspot) - activityScore(a.hotspot);
        return diff !== 0 ? diff : (b.hotspot.visits ?? 0) - (a.hotspot.visits ?? 0);
      }),
    [withDist],
  );

  const selectedCityPoints = useMemo(() => {
    const pins = selectedCity === "Nearby"
      ? nearbyPins
      : withDist.filter(({ hotspot }) => extractCity(hotspot.location?.address ?? "") === selectedCity);
    return pins.reduce((sum, { hotspot }) => sum + (hotspot.points ?? 0), 0);
  }, [selectedCity, nearbyPins, withDist]);

  // Stories: unique post authors from top hotspots, last 24 hours
  const storyHotspots = useMemo<StoryHotspot[]>(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const result: StoryHotspot[] = [];
    const sorted = [...hotspots].sort(
      (a, b) => (b.visits ?? 0) - (a.visits ?? 0),
    );
    for (const hotspot of sorted) {
      const recentPost = (hotspot.posts ?? []).find(
        (p) => p.createdAt && new Date(p.createdAt).getTime() >= cutoff,
      );
      if (recentPost) {
        result.push({ hotspot, recentPost });
        if (result.length >= 20) break;
      }
    }
    return result;
  }, [hotspots]);

  // Bottom stories: most recent post per top hotspot, last 24h, sorted by activity
  const bottomStories = useMemo<BottomStory[]>(() => {
    const cutoff = Date.now() - TWENTY_FOUR_HOURS;
    const result: BottomStory[] = [];
    const sorted = [...hotspots].sort((a, b) => activityScore(b) - activityScore(a));
    for (const hotspot of sorted) {
      const post = (hotspot.posts ?? []).find(
        (p) => p.createdAt && new Date(p.createdAt).getTime() >= cutoff,
      );
      if (post) {
        result.push({ hotspot, post });
        if (result.length >= 15) break;
      }
    }
    return result;
  }, [hotspots]);

  // Cities derived from hotspot addresses — city scope limits to 25-mile radius
  const cityList = useMemo(() => {
    const cityMap = new Map<string, { lat: number; lng: number; count: number; totalActivity: number }>();
    for (const { hotspot, lat, lng } of withDist) {
      const city = extractCity(hotspot.location?.address ?? "");
      if (!city) continue;
      if (scope === "city" && userCoords) {
        const km = haversineKm(userCoords.lat, userCoords.lon, lat, lng);
        if (km > NEARBY_KM) continue;
      }
      const score = activityScore(hotspot);
      const ex = cityMap.get(city);
      if (ex) {
        ex.lat = (ex.lat * ex.count + lat) / (ex.count + 1);
        ex.lng = (ex.lng * ex.count + lng) / (ex.count + 1);
        ex.count++;
        ex.totalActivity += score;
      } else {
        cityMap.set(city, { lat, lng, count: 1, totalActivity: score });
      }
    }
    const sorted = Array.from(cityMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 8)
      .map(([name, coords]) => ({ name, ...coords }));
    const maxActivity = Math.max(...sorted.map(c => c.totalActivity), 0);
    const hotThreshold = Math.max(1, maxActivity * 0.5);
    return sorted.map(c => ({ ...c, isHot: c.totalActivity >= hotThreshold }));
  }, [withDist, scope, userCoords]);

  // Cards: type + search filter only, no radius cap
  const filtered = useMemo(() => {
    let list = withDist;
    if (typeFilter !== "All")
      list = list.filter(({ hotspot }) => hotspot.type === typeFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        ({ hotspot: h }) =>
          h.name?.toLowerCase().includes(q) ||
          (typeof h.type === "string" ? h.type : "").toLowerCase().includes(q) ||
          h.location?.address?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [withDist, typeFilter, query]);

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── Full-screen map ── */}
      <View style={{ position: "absolute", top: mapExpanded ? 0 : headerH, left: 0, right: 0, bottom: 0, borderTopLeftRadius: mapExpanded ? 0 : 40, borderTopRightRadius: mapExpanded ? 0 : 40, overflow: "hidden" }}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          provider={PROVIDER_GOOGLE}
          customMapStyle={DARK_MAP_STYLE}
          initialRegion={{
            latitude: 30.2672,
            longitude: -97.7431,
            latitudeDelta: 0.06,
            longitudeDelta: 0.06,
          }}
          showsMyLocationButton={false}
          showsCompass={false}
          showsScale={false}
          showsBuildings={false}
          showsTraffic={false}
          showsIndoors={false}
          rotateEnabled={false}
          pitchEnabled={false}
        >
          {nearbyPins.slice(0, 30).map(({ hotspot: h, lat, lng }) => (
            <TrackedMarker key={h.id} hotspot={h} lat={lat} lng={lng} />
          ))}
        </MapView>
      </View>

      {/* ── Points + expand overlay ── */}
      <View style={{ position: "absolute", top: mapExpanded ? insets.top + 14 : headerH + 14, left: 16, right: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center", zIndex: 20 }}>
        <View style={styles.pointsOverlayPill}>
          <Zap size={11} color="#FFD700" strokeWidth={2.5} fill="#FFD700" />
          <Text style={styles.pointsOverlayText}>{selectedCityPoints.toLocaleString()} pts</Text>
        </View>
        <TouchableOpacity
          onPress={() => { Haptics.selectionAsync(); setMapExpanded((v) => !v); }}
          activeOpacity={0.82}
          style={styles.expandBtn}
        >
          {mapExpanded ? <Minimize2 size={15} color="#fff" strokeWidth={2} /> : <Maximize2 size={15} color="#fff" strokeWidth={2} />}
        </TouchableOpacity>
      </View>

      {/* ── Top header (floating over map) ── */}
      <View
        onLayout={(e) => setHeaderH(e.nativeEvent.layout.height)}
        style={[styles.header, { position: "absolute", top: 0, left: 0, right: 0, paddingTop: insets.top, zIndex: 3, display: mapExpanded ? "none" : "flex" }]}
      >
        <View style={styles.headerRow}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
            <PulseDot color="#3B82F6" size={7} />
            <Text style={styles.wordmark}>explore</Text>
          </View>

          {/* City / World scope toggle */}
          <View style={styles.scopeToggle}>
            {(["city", "world"] as const).map((s) => (
              <TouchableOpacity
                key={s}
                onPress={() => { Haptics.selectionAsync(); setScope(s); }}
                activeOpacity={0.82}
                style={[styles.scopeSegment, scope === s && styles.scopeSegmentActive]}
              >
                <Text style={[styles.scopeLabel, scope === s && styles.scopeLabelActive]}>
                  {s === "city" ? "City" : "World"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync();
                setSearchOpen(true);
              }}
              activeOpacity={0.75}
              style={styles.headerIconBtn}
            >
              <Search size={16} color="#fff" strokeWidth={1.8} />
            </TouchableOpacity>
            {me?.pfp ? (
              <Image
                source={{ uri: me.pfp }}
                style={{ width: 30, height: 30, borderRadius: 15 }}
              />
            ) : (
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: "#111",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    color: "#fff",
                    fontFamily: "Roobert-Bold",
                    fontSize: 13,
                  }}
                >
                  {me?.name?.charAt(0).toUpperCase() ?? "?"}
                </Text>
              </View>
            )}
          </View>
          
        </View>

          <StoryRow hotspots={storyHotspots} />
      </View>

      {/* ── City pills strip ── */}
      {cityList.length > 0 && (
        <View style={{ position: "absolute", top: mapExpanded ? insets.top + 58 : headerH + 58, left: 0, right: 0, zIndex: 2 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8, alignItems: "center" }}
          >
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync();
                setSelectedCity("Nearby");
                if (userCoords) {
                  mapRef.current?.animateToRegion({ latitude: userCoords.lat, longitude: userCoords.lon, latitudeDelta: 0.06, longitudeDelta: 0.06 }, 600);
                }
              }}
              activeOpacity={0.82}
              style={[styles.cityPill, selectedCity === "Nearby" && styles.cityPillActive]}
            >
              <PulseDot color={selectedCity === "Nearby" ? "#000" : "#3B82F6"} size={4} />
              <Text numberOfLines={1} style={[styles.cityPillText, selectedCity === "Nearby" && { color: "#000" }]}>
                {userCity === "Nearby" ? "Nearby" : userCity}
              </Text>
            </TouchableOpacity>
            {cityList.map(({ name, lat, lng, isHot }) => (
              <TouchableOpacity
                key={name}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedCity(name);
                  mapRef.current?.animateToRegion({ latitude: lat, longitude: lng, latitudeDelta: 0.06, longitudeDelta: 0.06 }, 600);
                }}
                activeOpacity={0.82}
                style={[styles.cityPill, selectedCity === name && styles.cityPillActive]}
              >
                <PulseDot color={selectedCity === name ? "#000" : "#3B82F6"} size={4} />
                <Text numberOfLines={1} style={[styles.cityPillText, selectedCity === name && { color: "#000" }]}>
                  {name}
                </Text>
                {isHot && (
                  <TrendingUp size={11} color={selectedCity === name ? "#000" : "#3B82F6"} strokeWidth={2.5} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── Bottom stories + carousel ── */}
      {!mapExpanded && <View style={{ position: "absolute", bottom: 82, left: 0, right: 0 }}>
        <BottomStoriesStrip stories={bottomStories} />
        {hotspotLoading && nearbyPins.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 20 }}>
            <ActivityIndicator size="small" color="rgba(255,255,255,0.4)" />
          </View>
        ) : (
          <FlatList
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            data={nearbyPins.slice(0, 15)}
            keyExtractor={({ hotspot }) => hotspot.id}
            renderItem={({ item: { hotspot } }) => (
              <HotspotCarouselCard
                hotspot={hotspot}
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push(`/profile-view?type=hotspot&id=${hotspot.id}` as any);
                }}
              />
            )}
          />
        )}
      </View>}

      {/* ── Search modal ── */}
      <Modal
        visible={searchOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setSearchOpen(false)}
        onShow={() => searchInputRef.current?.focus()}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setSearchOpen(false)}
          />
          <View style={styles.modalSheet}>
            {/* Search input row */}
            <View style={styles.modalInputRow}>
              <Search size={16} color="rgba(255,255,255,0.4)" strokeWidth={1.5} />
              <TextInput
                ref={searchInputRef}
                value={query}
                onChangeText={setQuery}
                placeholder={searchTab === "people" ? "Search people…" : "Search hotspots…"}
                placeholderTextColor="rgba(255,255,255,0.3)"
                style={{ flex: 1, color: "#fff", fontFamily: "Roobert-Medium", fontSize: 13 }}
                returnKeyType="search"
                autoCorrect={false}
              />
              {query.length > 0 ? (
                <TouchableOpacity onPress={() => setQuery("")} activeOpacity={0.7}>
                  <X size={15} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => setSearchOpen(false)}
                  activeOpacity={0.7}
                  style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, backgroundColor: "#fff" }}
                >
                  <Text style={{ color: "#000", fontFamily: "Roobert-Bold", fontSize: 12 }}>Cancel</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Hotspots / People tabs */}
            <View style={{ flexDirection: "row", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, gap: 8 }}>
              {(["hotspots", "people"] as const).map((tab) => {
                const active = searchTab === tab;
                return (
                  <TouchableOpacity
                    key={tab}
                    onPress={() => { Haptics.selectionAsync(); setSearchTab(tab); }}
                    activeOpacity={0.8}
                    style={{ paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, backgroundColor: active ? "#fff" : "rgba(255,255,255,0.08)", borderWidth: StyleSheet.hairlineWidth, borderColor: active ? "#fff" : "rgba(255,255,255,0.14)" }}
                  >
                    <Text style={{ color: active ? "#000" : "rgba(255,255,255,0.7)", fontFamily: active ? "Roobert-Bold" : "Roobert-Medium", fontSize: 13 }}>
                      {tab === "hotspots" ? "Hotspots" : "People"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Type chips — hotspots tab only. Wrapped in View so paddingVertical isn't clipped by the ScrollView bounds */}
            {searchTab === "hotspots" && (
              <View style={{ paddingVertical: 6 }}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
                >
                  {TYPES.map((t) => {
                    const active = typeFilter === t;
                    return (
                      <TouchableOpacity
                        key={t}
                        onPress={() => { Haptics.selectionAsync(); setTypeFilter(t); }}
                        activeOpacity={0.8}
                        style={[styles.typeChip, { backgroundColor: active ? "#fff" : "rgba(255,255,255,0.08)", borderColor: active ? "#fff" : "rgba(255,255,255,0.14)" }]}
                      >
                        <Text style={{ color: active ? "#000" : "rgba(255,255,255,0.7)", fontFamily: active ? "Roobert-Bold" : "Roobert-Medium", fontSize: 13 }}>
                          {t}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Results */}
            {searchTab === "hotspots" ? (
              <FlatList
                data={filtered}
                keyExtractor={({ hotspot }) => hotspot.id}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 1 }}
                ListEmptyComponent={
                  <View style={{ paddingTop: 40, alignItems: "center" }}>
                    <Text style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Roobert-Medium", fontSize: 14 }}>
                      No hotspots found
                    </Text>
                  </View>
                }
                renderItem={({ item: { hotspot } }) => (
                  <TouchableOpacity
                    onPress={() => { Haptics.selectionAsync(); setSearchOpen(false); router.push(`/profile-view?type=hotspot&id=${hotspot.id}` as any); }}
                    activeOpacity={0.75}
                    style={styles.resultRow}
                  >
                    <View style={styles.resultAvatar}>
                      {hotspot.avatar ? (
                        <Image source={{ uri: hotspot.avatar }} style={{ width: "100%", height: "100%", borderRadius: 10 }} resizeMode="cover" />
                      ) : (
                        <MapPin size={16} color="rgba(255,255,255,0.3)" strokeWidth={1.5} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: "#fff", fontFamily: "Roobert-SemiBold", fontSize: 14, letterSpacing: -0.2 }} numberOfLines={1}>
                        {hotspot.name}
                      </Text>
                      {hotspot.type && (
                        <Text style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Roobert-Regular", fontSize: 12, marginTop: 2 }}>
                          {hotspot.type}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                )}
              />
            ) : (
              <FlatList
                data={userSearchData?.searchUsers ?? []}
                keyExtractor={(u) => u.id}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 1 }}
                ListEmptyComponent={
                  <View style={{ paddingTop: 40, alignItems: "center" }}>
                    <Text style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Roobert-Medium", fontSize: 14 }}>
                      {userSearchLoading ? "Searching…" : query.trim() ? "No people found" : "Type to search people"}
                    </Text>
                  </View>
                }
                renderItem={({ item: user }) => (
                  <TouchableOpacity
                    onPress={() => { Haptics.selectionAsync(); setSearchOpen(false); router.push(`/profile-view?type=user&id=${user.id}` as any); }}
                    activeOpacity={0.75}
                    style={styles.resultRow}
                  >
                    <View style={[styles.resultAvatar, { borderRadius: 22 }]}>
                      {user.pfp ? (
                        <Image source={{ uri: user.pfp }} style={{ width: "100%", height: "100%", borderRadius: 22 }} resizeMode="cover" />
                      ) : (
                        <Text style={{ color: "rgba(255,255,255,0.5)", fontFamily: "Roobert-Bold", fontSize: 18 }}>
                          {user.name?.charAt(0).toUpperCase()}
                        </Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: "#fff", fontFamily: "Roobert-SemiBold", fontSize: 14, letterSpacing: -0.2 }} numberOfLines={1}>
                        {user.name}
                      </Text>
                      {user.bio ? (
                        <Text style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Roobert-Regular", fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                          {user.bio}
                        </Text>
                      ) : null}
                    </View>
                    {(user.followersCount ?? 0) > 0 && (
                      <Text style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Roobert-Medium", fontSize: 11 }}>
                        {user.followersCount} followers
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: "#000",
    paddingHorizontal: 20,
    paddingBottom: 10,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  wordmark: {
    fontFamily: "Roobert-Bold",
    fontSize: 22,
    letterSpacing: -1.0,
    color: "#fff",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 16,
  },
  bottomPanel: {
    backgroundColor: "#000",
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    padding: 10,
    marginTop: -40,
  },
  typeChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
  },
  detailCard: {
    borderRadius: 40,
    padding: 16,
    overflow: "visible",
    position: "relative",
  },
  cardCover: {
    width: "100%",
    height: 120,
    borderRadius: 18,
    overflow: "hidden",
  },
  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  statPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  navigateBtn: {
    position: "absolute",
    bottom: 16,
    right: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  hotspotPinWrap: {
    alignItems: "center",
  },
  hotspotPinCircle: {
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
  countPill: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  storyAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  storyActiveDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#E1306C",
    borderWidth: 2,
  },
  headerIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
   
  },
  modalSheet: {
    backgroundColor: "#000",
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingTop: 16,
    maxHeight: "75%",
    borderColor: "#222",
    borderBottomWidth: 0,
  },
  modalInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 4,
    height: 46,
    borderRadius: 23,
    paddingHorizontal: 14,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#1a1a1a",
  },
  resultAvatar: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#1a1a1a",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  cityPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    maxWidth: 140,
    backgroundColor: "#000",
    borderColor: "rgba(255,255,255,0.15)",
  },
  cityPillActive: {
    backgroundColor: "#fff",
    borderColor: "#fff",
  },
  cityPillText: {
    fontFamily: "Roobert-SemiBold",
    fontSize: 12,
    letterSpacing: -0.2,
    color: "#fff",
    flexShrink: 1,
  },
  pointsOverlayPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#000000",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  
  },
  pointsOverlayText: {
    color: "#fff",
    fontFamily: "Roobert-Bold",
    fontSize: 11,
    letterSpacing: -0.2,
  },
  expandBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
  },
  scopeToggle: {
    flexDirection: "row",
    backgroundColor: "#000",
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#222",
    padding: 3,
  },
  scopeSegment: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 17,
  },
  scopeSegmentActive: {
    backgroundColor: "#fff",
  },
  scopeLabel: {
    fontFamily: "Roobert-Bold",
    fontSize: 11,
    color: "#fff",
  },
  scopeLabelActive: {
    color: "#000",
    fontFamily: "Roobert-Bold",
  },
});

