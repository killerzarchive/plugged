import {
  LEADERBOARD_USERS_BY_POINTS,
  ME_QUERY,
  USER_CHECKINS,
} from "@/app/apollo/queries/general";
import { HotspotRow, PulseDot } from "@/components/ui/HotspotRow";
import { useAuth } from "@/contexts/auth";
import { DARK_MAP_STYLE } from "@/constants/mapStyle";
import { computeMedalPointsForUser } from "@/constants/medals";
import { useMedals } from "@/hooks/useMedals";
import { useQuery } from "@apollo/client/react";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import * as ExpoLocation from "expo-location";
import { router } from "expo-router";
import { ResizeMode, Video } from "expo-av";
import { Maximize2, Minimize2, Play, X, Zap } from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";

const { width: SW } = Dimensions.get("window");
const BLUE = "#1877F2";
const MAP_H = 200;
const AVATAR_SIZE = 72;

const geocodeCache = new Map<string, { lat: number; lng: number }>();

// ─── Helpers ─────────────────────────────────────────────────────────────────
function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function extractCity(address: string): string {
  const parts = address.split(",").map((s) => s.trim());
  for (const part of parts) {
    if (/^\d/.test(part)) continue;           // skip "123 Main St"
    if (/\d{4,}/.test(part)) continue;        // skip zip codes
    if (/^(United States|USA|UK|Canada|Australia)$/i.test(part)) continue;
    if (/^[A-Z]{2}$/.test(part)) continue;    // skip state abbrevs like "TX"
    return part;
  }
  return parts[0];
}

function getContributionScore(opts: {
  hotspots: number;
  posts: number;
  checkins: number;
  reviews: number;
}): number {
  return (
    opts.hotspots * 40 + opts.reviews * 15 + opts.posts * 10 + opts.checkins * 5
  );
}

function getContributionTier(score: number): { label: string; next: number } {
  if (score < 50) return { label: "Just Arrived", next: 50 };
  if (score < 150) return { label: "Local Scout", next: 150 };
  if (score < 350) return { label: "Active Contributor", next: 350 };
  if (score < 700) return { label: "City Builder", next: 700 };
  if (score < 1200) return { label: "Scene Pillar", next: 1200 };
  return { label: "Local Legend", next: score };
}

function getExperienceTitle(count: number): string {
  if (count === 0) return "Just Getting Started";
  if (count <= 2) return "Newcomer";
  if (count <= 5) return "Getting Plugged In";
  if (count <= 9) return "Scene Regular";
  if (count <= 14) return "Night Owl";
  if (count <= 20) return "Scene Veteran";
  if (count <= 30) return "City Expert";
  if (count <= 40) return "Scene Legend";
  return "Plugged Icon";
}

const TIER_NUM: Record<string, string> = {
  bronze: "I",
  silver: "II",
  gold: "III",
  platinum: "IV",
  diamond: "V",
};
const TIER_CROWN_COLOR: Record<string, string> = {
  bronze: "#CD7F32",
  silver: "#A8B2BD",
  gold: "#FFD700",
  platinum: "#C8C8D4",
  diamond: "#7DD6F5",
};

function AchievementCrown({
  tier,
  size = 32,
}: {
  tier: string;
  size?: number;
}) {
  const color = TIER_CROWN_COLOR[tier] ?? "#FFD700";
  const num = TIER_NUM[tier] ?? "1";
  const h = size * 0.75;
  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
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
      <Text
        style={{
          position: "absolute",
          bottom: 4,
          color: "#fff",
          fontFamily: "Roobert-Bold",
          fontSize: size * 0.28,
          letterSpacing: -0.3,
        }}
      >
        {num}
      </Text>
    </View>
  );
}

// ─── User map pin (matches FeedPin / hotspot pin style) ──────────────────────
function UserMapPin({ uri, name }: { uri?: string; name: string }) {
  const initial = name[0]?.toUpperCase() ?? "?";
  return (
    <View style={{ alignItems: "center" }}>
      <View style={pinStyles.circle}>
        {uri ? (
          <Image
            source={{ uri }}
            style={{ width: "100%", height: "100%", borderRadius: 999 }}
            resizeMode="cover"
          />
        ) : (
          <Text
            style={{ color: "#fff", fontFamily: "Roobert-Bold", fontSize: 14 }}
          >
            {initial}
          </Text>
        )}
      </View>
      <View style={pinStyles.triangle} />
    </View>
  );
}

const pinStyles = StyleSheet.create({
  circle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#1a1a1a",
    borderWidth: 2,
    borderColor: "#fff",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  triangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 9,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#fff",
    marginTop: -1,
  },
});

// ─── Types ───────────────────────────────────────────────────────────────────
interface MeData {
  me: {
    id: string;
    name: string;
    bio?: string;
    pfp?: string;
    points?: number;
    visits?: number;
    followersCount?: number;
    ratings?: number;
    location?: { latitude?: number; longitude?: number; address?: string };
    following?: { id: string }[];
    reviews?: { id: string }[];
    hotspots?: {
      id: string;
      name: string;
      type?: string;
      avatar?: string;
      visits?: number;
      isEvent?: boolean;
      location?: { latitude?: number; longitude?: number; address?: string };
      posts?: { id: string; media?: string; createdAt?: string }[];
    }[];
    posts?: {
      id: string;
      title?: string;
      media?: string;
      type?: string;
      createdAt?: string;
    }[];
  };
}

interface CheckIn {
  id: string;
  createdAt?: string;
  hotspot?: {
    id: string;
    name: string;
    avatar?: string;
    type?: string;
    location?: { address?: string; latitude?: number; longitude?: number };
  };
}

// ─── Screen ──────────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const [showCta, setShowCta] = useState(true);
  const [showAllHotspots, setShowAllHotspots] = useState(false);
  const [showAllMedals, setShowAllMedals] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);

  const {
    earned: earnedMedals,
    locked: lockedMedals,
    totalPoints: medalPoints,
  } = useMedals();

  const { data: meData, loading } = useQuery<MeData>(ME_QUERY);
  const me = meData?.me;

  const { data: checkinsData } = useQuery<{ userCheckIns: CheckIn[] }>(
    USER_CHECKINS,
    {
      variables: { userId: me?.id ? parseInt(me.id) : 0 },
      skip: !me?.id,
    },
  );

  const { data: lbData } = useQuery<{
    leaderboardUsersByPoints: {
      periodPoints: number;
      user: {
        id: string;
        points: number;
        visits?: number;
        followersCount?: number;
        hotspots?: { id: string }[];
        reviews?: { id: string }[];
        posts?: { id: string }[];
      };
    }[];
  }>(LEADERBOARD_USERS_BY_POINTS, {
    variables: { period: "weekly", take: 500 },
  });

  const sortedLeaderboard = lbData?.leaderboardUsersByPoints
    ? [...lbData.leaderboardUsersByPoints]
        .map((e) => ({
          ...e,
          total: e.user.points + computeMedalPointsForUser(e.user),
        }))
        .sort((a, b) => b.total - a.total)
    : [];

  const leaderboardRank = sortedLeaderboard.length
    ? sortedLeaderboard.findIndex((e) => e.user.id === me?.id) + 1
    : 0;

  const [geocodeTick, setGeocodeTick] = useState(0);

  const checkins = checkinsData?.userCheckIns ?? [];
  const latestCheckin = [...checkins].sort((a, b) =>
    (b.createdAt ?? "") > (a.createdAt ?? "") ? 1 : -1
  )[0] ?? null;
  const lcLat = latestCheckin?.hotspot?.location?.latitude;
  const lcLng = latestCheckin?.hotspot?.location?.longitude;
  const hasCheckinCoords = !!(lcLat && lcLng && !(lcLat === 0 && lcLng === 0));
  const hotspots = me?.hotspots ?? [];
  const posts = me?.posts ?? [];
  const reviews = me?.reviews ?? [];
  const followers = me?.followersCount ?? 0;
  const visits = me?.visits ?? 0;
  const points = (me?.points ?? 0) + medalPoints;
  const initial = me?.name?.[0]?.toUpperCase() ?? "?";

  const city = me?.location?.address ? extractCity(me.location.address) : null;
  const contributionScore = getContributionScore({
    hotspots: hotspots.length,
    posts: posts.length,
    checkins: visits,
    reviews: reviews.length,
  });
  const { label: contribTier, next: contribNext } =
    getContributionTier(contributionScore);
  const contribProgress =
    contribNext > contributionScore
      ? Math.min(contributionScore / contribNext, 1)
      : 1;

  const userLat = me?.location?.latitude;
  const userLng = me?.location?.longitude;
  const hasLocation = !!(
    userLat &&
    userLng &&
    !(userLat === 0 && userLng === 0)
  );

  useEffect(() => {
    const toGeocode = hotspots.filter(
      (h) => h.location?.address && !geocodeCache.has(h.id),
    );
    if (!toGeocode.length) return;
    let didUpdate = false;
    (async () => {
      await Promise.all(
        toGeocode.map(async (h) => {
          try {
            const results = await ExpoLocation.geocodeAsync(
              h.location!.address!,
            );
            if (results?.[0]) {
              geocodeCache.set(h.id, {
                lat: results[0].latitude,
                lng: results[0].longitude,
              });
              didUpdate = true;
            }
          } catch {}
        }),
      );
      if (didUpdate) setGeocodeTick((t) => t + 1);
    })();
  }, [hotspots]);

  const resolvedHotspots = useMemo(() => {
    return hotspots.flatMap((h) => {
      const geo = geocodeCache.get(h.id);
      let lat: number | undefined, lng: number | undefined;
      if (h.location?.address) {
        lat = geo?.lat;
        lng = geo?.lng;
      } else {
        const rawLat = h.location?.latitude,
          rawLng = h.location?.longitude;
        if (rawLat && rawLng && !(rawLat === 0 && rawLng === 0)) {
          lat = rawLat;
          lng = rawLng;
        }
      }
      if (lat == null || lng == null) return [];
      return [{ ...h, resolvedLat: lat, resolvedLng: lng }];
    });
  }, [hotspots, geocodeTick]);

  if (loading && !me) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#000",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <StatusBar
          barStyle="light-content"
          backgroundColor="transparent"
          translucent
        />
        <ActivityIndicator color={BLUE} />
      </View>
    );
  }

  const cellSize = (SW - 3) / 3;

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
      >
        <View
          style={{
            paddingBottom: 12,
            paddingHorizontal: 16,
            marginTop: insets.top,
            backgroundColor: "rgba(0,0,0,0.45)",
            borderBottomRightRadius: 20,
            borderBottomLeftRadius: 20,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <PulseDot color="#fff" size={6} />
            <Text
              style={{
                color: "#fff",
                fontFamily: "Roobert-Bold",
                fontSize: 22,
              }}
            >
              Profile
            </Text>
          </View>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: "#1a1a1a",
              borderWidth: 2,
              borderColor: "#fff",
              overflow: "hidden",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {me?.pfp ? (
              <Image
                source={{ uri: me.pfp }}
                style={{ width: "100%", height: "100%" }}
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
        </View>
        {/* ── Map zone ──────────────────────────────────────────────────── */}
        <View style={{ position: "relative" }}>
          <View
            style={{
              height: (mapExpanded ? 340 : MAP_H) + insets.top,
              borderTopLeftRadius: 40,
              borderTopRightRadius: 40,
              overflow: "hidden",
            }}
          >
            {hasLocation ? (
              <MapView
                style={StyleSheet.absoluteFillObject}
                provider={PROVIDER_GOOGLE}
                customMapStyle={DARK_MAP_STYLE}
                initialRegion={{
                  latitude: userLat!,
                  longitude: userLng!,
                  latitudeDelta: 0.018,
                  longitudeDelta: 0.018,
                }}
                showsUserLocation={false}
                showsMyLocationButton={false}
                showsCompass={false}
                showsScale={false}
                showsBuildings={false}
                showsTraffic={false}
                showsIndoors={false}
                rotateEnabled={false}
                pitchEnabled={false}
                scrollEnabled={false}
                zoomEnabled={false}
                moveOnMarkerPress={false}
              >
                <Marker
                  coordinate={{ latitude: userLat!, longitude: userLng! }}
                  anchor={{ x: 0.5, y: 1 }}
                  tracksViewChanges={false}
                >
                  <UserMapPin uri={me?.pfp} name={me?.name ?? "?"} />
                </Marker>
                {resolvedHotspots.map((h) => (
                  <Marker
                    key={h.id}
                    coordinate={{
                      latitude: h.resolvedLat,
                      longitude: h.resolvedLng,
                    }}
                    anchor={{ x: 0.5, y: 1 }}
                    tracksViewChanges={false}
                    onPress={() => {
                      Haptics.selectionAsync();
                      router.push(`/profile-view?type=hotspot&id=${h.id}` as any);
                    }}
                  >
                    <View style={{ alignItems: "center" }}>
                      <View style={pinStyles.circle}>
                        {h.avatar ? (
                          <Image
                            source={{ uri: h.avatar }}
                            style={{
                              width: "100%",
                              height: "100%",
                              borderRadius: 999,
                            }}
                            resizeMode="cover"
                          />
                        ) : (
                          <Text
                            style={{
                              color: "#fff",
                              fontFamily: "Roobert-Bold",
                              fontSize: 14,
                            }}
                          >
                            {h.name[0]?.toUpperCase() ?? "?"}
                          </Text>
                        )}
                      </View>
                      <View style={pinStyles.triangle} />
                    </View>
                  </Marker>
                ))}
              </MapView>
            ) : (
              <LinearGradient
                colors={["rgba(24,119,242,0.35)", "rgba(0,0,0,0.9)", "#000"]}
                start={{ x: 0.4, y: 0 }}
                end={{ x: 0.6, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
            )}
          </View>

          {/* Top bar — points left, expand right */}
          <View
            style={{
              position: "absolute",
              top: 14,
              left: 12,
              right: 12,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              zIndex: 10,
            }}
          >
            <View style={styles.mapPtsPill}>
              <Zap size={11} color="#FFD700" strokeWidth={2.5} fill="#FFD700" />
              <Text style={styles.mapPtsText}>
                {points.toLocaleString()} pts
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync();
                setMapExpanded((v) => !v);
              }}
              activeOpacity={0.82}
              style={styles.mapExpandBtn}
            >
              {mapExpanded ? (
                <Minimize2 size={14} color="#fff" strokeWidth={2} />
              ) : (
                <Maximize2 size={14} color="#fff" strokeWidth={2} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Profile panel ─────────────────────────────────────────────── */}
        <View style={{ position: "relative" }}>
          {/* Avatar — straddles map/panel boundary */}
          <View style={styles.avatarFloater}>
            <View style={[styles.avatar, { backgroundColor: "#000" }]}>
              {me?.pfp ? (
                <Image
                  source={{ uri: me.pfp }}
                  style={StyleSheet.absoluteFillObject}
                  resizeMode="cover"
                />
              ) : (
                <Text style={styles.avatarInitial}>{initial}</Text>
              )}
            </View>
          </View>

          <View style={styles.panel}>
            {/* Identity */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: BLUE,
                }}
              />
              <Text style={styles.name}>{me?.name ?? "—"}</Text>
            </View>

            {me?.bio && <Text style={styles.bio}>{me.bio}</Text>}

            <View style={styles.expTitlePill}>
              <PulseDot color={BLUE} size={4} />
              <Text style={styles.expTitle}>
                {getExperienceTitle(earnedMedals.length)}
              </Text>
            </View>
            <View style={styles.profileActionRow}>
              <TouchableOpacity
                onPress={() => { Haptics.selectionAsync(); router.push("/edit-profile" as any); }}
                activeOpacity={0.82}
                style={styles.editBtn}
              >
                <Text style={styles.editBtnText}>Edit Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  Haptics.selectionAsync();
                  await signOut();
                  router.replace("/(auth)/login" as any);
                }}
                activeOpacity={0.82}
                style={styles.signOutBtn}
              >
                <Text style={styles.signOutText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{fmtNum(visits)}</Text>
                <Text style={styles.statLabel}>Check ins</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{fmtNum(points)}</Text>
                <Text style={styles.statLabel}>Points</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{fmtNum(followers)}</Text>
                <Text style={styles.statLabel}>followers</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{String(hotspots.length)}</Text>
                <Text style={styles.statLabel}>Hotspots</Text>
              </View>
            </View>

            {/* ── Achievements ─────────────────────────────────────────────── */}
            <View style={styles.achieveSection}>
              {/* Header */}
              <View style={styles.achieveHeader}>
                <View>
                  <Text style={styles.achieveEyebrow}>ACHIEVEMENTS</Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 7,
                    }}
                  >
                    <View
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: "#1877F2",
                      }}
                    />
                    <Text style={styles.achieveTitle}>
                      {getExperienceTitle(earnedMedals.length)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.achieveCount}>
                  {earnedMedals.length}
                  <Text style={styles.achieveTotal}></Text>
                </Text>
              </View>

              {/* Story circles row */}
              {earnedMedals.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{
                    gap: 10,
                    paddingHorizontal: 16,
                    paddingVertical: 4,
                  }}
                >
                  {earnedMedals.slice(0, 20).map((m) => (
                    <View key={m.id} style={styles.storyItem}>
                      <LinearGradient
                        colors={["#1877F2", "#1877F2"]}
                        start={{ x: 0, y: 1 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.storyRing}
                      >
                        <View style={styles.storyGap}>
                          <View style={styles.storyInner}>
                            <AchievementCrown tier={m.tier} size={22} />
                          </View>
                        </View>
                      </LinearGradient>
                      <Text style={styles.storyName} numberOfLines={1}>
                        {m.name}
                      </Text>
                      <View style={styles.storyDots}>
                        {Array.from({
                          length:
                            {
                              bronze: 1,
                              silver: 2,
                              gold: 3,
                              platinum: 4,
                              diamond: 5,
                            }[m.tier] ?? 1,
                        }).map((_, i) => (
                          <View key={i} style={styles.storyDot} />
                        ))}
                      </View>
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <Text
                  style={[
                    styles.emptyText,
                    { textAlign: "center", paddingHorizontal: 16 },
                  ]}
                >
                  Check in, create hotspots and rate places to earn achievements
                </Text>
              )}
            </View>

            {/* ── Hotspots ────────────────────────────────────────────────── */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 7 }}
                >
                  <View
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 4,
                      backgroundColor: BLUE,
                    }}
                  />
                  <Text style={styles.sectionTitle}>Hotspots</Text>
                </View>
              </View>
              <View
                className="rounded-3xl px-3 py-2"
                style={{ borderColor: "rgba(255,255,255,0.07)" }}
              >
                {hotspots.length === 0 ? (
                  <Text style={styles.emptyText}>No hotspots yet</Text>
                ) : (
                  (() => {
                    const sorted = [...hotspots].sort((a, b) => {
                      const aLast = (a.posts ?? []).reduce<string | undefined>(
                        (acc, p) =>
                          p.createdAt && (!acc || p.createdAt > acc)
                            ? p.createdAt
                            : acc,
                        undefined,
                      );
                      const bLast = (b.posts ?? []).reduce<string | undefined>(
                        (acc, p) =>
                          p.createdAt && (!acc || p.createdAt > acc)
                            ? p.createdAt
                            : acc,
                        undefined,
                      );
                      if (aLast && bLast) return bLast.localeCompare(aLast);
                      if (aLast) return -1;
                      if (bLast) return 1;
                      return (b.visits ?? 0) - (a.visits ?? 0);
                    });
                    const visible = showAllHotspots
                      ? sorted
                      : sorted.slice(0, 3);
                    return visible.map((h, i) => {
                      const lastPostAt = (h.posts ?? []).reduce<
                        string | undefined
                      >(
                        (acc: string | undefined, p: { createdAt?: string }) =>
                          p.createdAt && (!acc || p.createdAt > acc)
                            ? p.createdAt
                            : acc,
                        undefined,
                      );
                      return (
                        <HotspotRow
                          key={h.id}
                          hotspot={{
                            id: h.id,
                            name: h.name,
                            avatar: h.avatar,
                            type: h.type,
                            location: h.location,
                            posts: (h.posts ?? []).map((p) => ({
                              id: p.id,
                              media: p.media,
                            })),
                            checkinCount: h.visits,
                            lastPostAt,
                          }}
                          isLast={i === visible.length - 1}
                        />
                      );
                    });
                  })()
                )}
              </View>
            </View>
          </View>

          {/* ── Leaderboard rank ────────────────────────────────────────── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 7 }}
              >
                <View
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 4,
                    backgroundColor: BLUE,
                  }}
                />
                <Text style={styles.sectionTitle}>Your Rank</Text>
              </View>
            </View>
            <View style={styles.rankCard}>
              <Text
                style={[
                  styles.rankRankNum,
                  {
                    color:
                      leaderboardRank === 1 ? BLUE : "rgba(255,255,255,0.35)",
                  },
                ]}
              >
                {leaderboardRank > 0 ? `#${leaderboardRank}` : "—"}
              </Text>
              <PulseDot color={BLUE} size={5} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rankName} numberOfLines={1}>
                  {me?.name ?? "—"}
                </Text>
              </View>
              <Text style={styles.rankPts}>{points.toLocaleString()} pts</Text>
              <View style={styles.rankAvatar}>
                {me?.pfp ? (
                  <Image
                    source={{ uri: me.pfp }}
                    style={StyleSheet.absoluteFillObject}
                    resizeMode="cover"
                  />
                ) : (
                  <Text
                    style={{
                      color: "#fff",
                      fontFamily: "Roobert-Bold",
                      fontSize: 10,
                    }}
                  >
                    {initial}
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* ── City Contribution ───────────────────────────────────────── */}
          <View style={[styles.section, { marginTop: 24 }]}>
            <View style={styles.sectionHeader}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 7 }}
              >
                <View
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 4,
                    backgroundColor: BLUE,
                  }}
                />
                <Text style={styles.sectionTitle}>City Contribution</Text>
              </View>
             
            </View>

            <View style={styles.contribCard}>
              {/* Tier row */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 12,
                }}
              >
                <Text style={styles.contribTierLabel}>{contribTier}</Text>
                <Text style={styles.contribScore}>
                  {contributionScore.toLocaleString()} pts
                </Text>
              </View>

              {/* Progress bar */}
              <View style={styles.contribBarTrack}>
                <View
                  style={[
                    styles.contribBarFill,
                    { width: `${Math.round(contribProgress * 100)}%` as any },
                  ]}
                />
              </View>
              {contribProgress < 1 && (
                <Text style={styles.contribNextHint}>
                  {(contribNext - contributionScore).toLocaleString()} pts to
                  next tier
                </Text>
              )}

              {/* Stats grid */}
              <View style={styles.contribGrid}>
                <View style={styles.contribStat}>
                  <Text style={styles.contribStatNum}>{hotspots.length}</Text>
                  <Text style={styles.contribStatLabel}>HOTSPOTS</Text>
                </View>
                <View style={[styles.contribStat, styles.contribStatBorder]}>
                  <Text style={styles.contribStatNum}>{posts.length}</Text>
                  <Text style={styles.contribStatLabel}>POSTS</Text>
                </View>
                <View style={[styles.contribStat, styles.contribStatBorder]}>
                  <Text style={styles.contribStatNum}>{visits}</Text>
                  <Text style={styles.contribStatLabel}>CHECK-INS</Text>
                </View>
                <View style={[styles.contribStat, styles.contribStatBorder]}>
                  <Text style={styles.contribStatNum}>{reviews.length}</Text>
                  <Text style={styles.contribStatLabel}>REVIEWS</Text>
                </View>
              </View>
            </View>
          </View>

          {/* ── Posts ───────────────────────────────────────────────────── */}
          {posts.filter((p) => p.media).length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                  <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: BLUE }} />
                  <Text style={styles.sectionTitle}>Posts</Text>
                </View>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 10, paddingHorizontal: 2, paddingVertical: 4 }}
              >
                {[...posts]
                  .filter((p) => p.media)
                  .sort((a, b) => ((b.createdAt ?? "") > (a.createdAt ?? "") ? 1 : -1))
                  .map((p) => {
                    const isVideo = p.type === "video" || /\.(mp4|mov|webm)$/i.test(p.media ?? "");
                    const label = p.title ?? (isVideo ? "Video" : "Photo");
                    return (
                      <View key={p.id} style={styles.postScrollCell}>
                        <View style={styles.postScrollRing}>
                          <View style={styles.postScrollGap}>
                            <View style={styles.postScrollInner}>
                              {isVideo ? (
                                <Video
                                  source={{ uri: p.media! }}
                                  style={styles.postGridImg}
                                  resizeMode={ResizeMode.COVER}
                                  shouldPlay={false}
                                  isMuted
                                  isLooping={false}
                                />
                              ) : (
                                <Image
                                  source={{ uri: p.media! }}
                                  style={styles.postGridImg}
                                  resizeMode="cover"
                                />
                              )}
                              {isVideo && (
                                <View style={styles.postScrollPlayOverlay}>
                                  <Play size={14} color="#fff" fill="#fff" strokeWidth={0} />
                                </View>
                              )}
                            </View>
                          </View>
                        </View>
                        <Text style={styles.postScrollLabel} numberOfLines={1}>{label}</Text>
                      </View>
                    );
                  })}
              </ScrollView>
            </View>
          )}

          {/* ── Latest Check-In ─────────────────────────────────────────── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: BLUE }} />
                <Text style={styles.sectionTitle}>Last Check-In</Text>
              </View>
              {latestCheckin?.createdAt && (
                <Text style={styles.seeAll}>{timeAgo(latestCheckin.createdAt)} ago</Text>
              )}
            </View>
            <View style={styles.checkinMapCard}>
              {latestCheckin && hasCheckinCoords ? (
                <MapView
                  style={StyleSheet.absoluteFillObject}
                  provider={PROVIDER_GOOGLE}
                  customMapStyle={DARK_MAP_STYLE}
                  initialRegion={{
                    latitude: lcLat!,
                    longitude: lcLng!,
                    latitudeDelta: 0.008,
                    longitudeDelta: 0.008,
                  }}
                  scrollEnabled={false}
                  zoomEnabled={false}
                  rotateEnabled={false}
                  pitchEnabled={false}
                  showsUserLocation={false}
                  showsMyLocationButton={false}
                  showsCompass={false}
                  showsBuildings={false}
                  showsTraffic={false}
                  moveOnMarkerPress={false}
                >
                  <Marker
                    coordinate={{ latitude: lcLat!, longitude: lcLng! }}
                    anchor={{ x: 0.5, y: 1 }}
                    tracksViewChanges={false}
                  >
                    <View style={{ alignItems: "center" }}>
                      <View style={pinStyles.circle}>
                        {latestCheckin.hotspot?.avatar ? (
                          <Image
                            source={{ uri: latestCheckin.hotspot.avatar }}
                            style={{ width: "100%", height: "100%", borderRadius: 999 }}
                            resizeMode="cover"
                          />
                        ) : (
                          <Text style={{ color: "#fff", fontFamily: "Roobert-Bold", fontSize: 14 }}>
                            {latestCheckin.hotspot?.name?.[0]?.toUpperCase() ?? "?"}
                          </Text>
                        )}
                      </View>
                      <View style={pinStyles.triangle} />
                    </View>
                  </Marker>
                </MapView>
              ) : hasLocation ? (
                <MapView
                  style={StyleSheet.absoluteFillObject}
                  provider={PROVIDER_GOOGLE}
                  customMapStyle={DARK_MAP_STYLE}
                  initialRegion={{
                    latitude: userLat!,
                    longitude: userLng!,
                    latitudeDelta: 0.06,
                    longitudeDelta: 0.06,
                  }}
                  scrollEnabled={false}
                  zoomEnabled={false}
                  rotateEnabled={false}
                  pitchEnabled={false}
                  showsUserLocation={false}
                  showsMyLocationButton={false}
                  showsCompass={false}
                  showsBuildings={false}
                  showsTraffic={false}
                  moveOnMarkerPress={false}
                >
                  <Marker
                    coordinate={{ latitude: userLat!, longitude: userLng! }}
                    anchor={{ x: 0.5, y: 1 }}
                    tracksViewChanges={false}
                  >
                    <UserMapPin uri={me?.pfp} name={me?.name ?? "?"} />
                  </Marker>
                </MapView>
              ) : (
                <LinearGradient
                  colors={["rgba(24,119,242,0.12)", "#000"]}
                  style={StyleSheet.absoluteFillObject}
                />
              )}
              {latestCheckin && (
                <View style={styles.checkinMapOverlay}>
                  <Text style={styles.checkinMapName} numberOfLines={1}>
                    {latestCheckin.hotspot?.name ?? "Unknown"}
                  </Text>
                  {latestCheckin.hotspot?.location?.address && (
                    <Text style={styles.checkinMapAddr} numberOfLines={1}>
                      {latestCheckin.hotspot.location.address}
                    </Text>
                  )}
                </View>
              )}
            </View>
            {!latestCheckin && (
              <View style={styles.checkinBelowCard}>
                <Text style={styles.checkinMapName} numberOfLines={1}>
                  {city ?? "Your city"}
                </Text>
                <Text style={styles.checkinMapAddr}>Last place checked in was here</Text>
              </View>
            )}
          </View>

          {/* end panel */}
        </View>
        {/* end avatarFloater wrapper */}
      </ScrollView>

      {/* ── Floating CTA ──────────────────────────────────────────────────── */}
      {showCta && (
        <View style={[styles.cta, { bottom: insets.bottom + 50 }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.ctaTitle}>UNLOCK PLUGGED+</Text>
            <Text style={styles.ctaSub}>
              early alerts · incognito · crew board 🔒
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              Haptics.selectionAsync();
              router.push("/pluggedplus" as any);
            }}
            activeOpacity={0.82}
          >
            <Text style={styles.ctaAction}>upgrade →</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              Haptics.selectionAsync();
              setShowCta(false);
            }}
            activeOpacity={0.82}
            style={{ paddingLeft: 10 }}
          >
            <X size={14} color="rgba(255,255,255,0.7)" strokeWidth={2} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Map ─────────────────────────────────────────────────────────────────────
  mapFade: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 90,
  },
  topBar: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  topBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.18)",
  },
  // ── Profile panel ───────────────────────────────────────────────────────────
  avatarFloater: {
    position: "absolute",
    top: -(AVATAR_SIZE / 1),
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 5,
    borderColor: "#000",
  },
  avatarInitial: {
    color: "#fff",
    fontFamily: "Roobert-Bold",
    fontSize: 32,
  },
  panel: {
    marginTop: -42,
    borderRadius: 40,
    backgroundColor: "#000",
    paddingTop: AVATAR_SIZE / 2 + 12,
    paddingBottom: 22,
    overflow: "hidden",
  },
  panelTopRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginTop: 20,
    paddingBottom: 10,
  },
  ptsBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#000",
  },
  ptsBadgeNum: {
    color: "#fff",
    fontFamily: "Roobert-Bold",
    fontSize: 13,
    letterSpacing: -0.3,
  },
  ptsBadgeLabel: {
    color: "rgba(255,255,255,0.65)",
    fontFamily: "Roobert-Regular",
    fontSize: 9,
  },
  streakBadge: {
    position: "absolute",
    bottom: 2,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#FFD60A",
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 2,
    borderColor: "#0d0d0d",
  },
  streakNum: {
    color: "#000",
    fontFamily: "Roobert-Bold",
    fontSize: 10,
  },
  name: {
    color: "#fff",
    fontFamily: "Roobert-Bold",
    fontSize: 22,
    letterSpacing: -0.5,
    textAlign: "center",
  },
  cityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    marginTop: 5,
  },
  cityText: {
    color: "rgba(255,255,255,0.45)",
    fontFamily: "Roobert-Medium",
    fontSize: 13,
  },
  bio: {
    color: "#fff",
    fontFamily: "Roobert-Medium",
    fontSize: 12.5,
    lineHeight: 19,
    textAlign: "center",
    paddingHorizontal: 24,
    marginTop: 8,
  },
  expTitlePill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 7,
    marginTop: 8,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#222",
  },
  expTitle: {
    color: "#fff",
    fontFamily: "Roobert-SemiBold",
    fontSize: 10,
    letterSpacing: -0.1,
  },
  privacyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    marginTop: 10,
  },
  privacyText: {
    color: "rgba(255,255,255,0.25)",
    fontFamily: "Roobert-Regular",
    fontSize: 11,
  },
  statsRow: {
    flexDirection: "row",
    marginHorizontal: 48,
    borderRadius: 14,
    overflow: "hidden",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    gap: 1.5,
  },
  statNum: {
    color: "#fff",
    fontFamily: "Roobert-Bold",
    fontSize: 15,
    letterSpacing: -0.5,
  },
  statLabel: {
    color: "#fff",
    fontFamily: "Roobert-SemiBold",
    fontSize: 11,
    letterSpacing: 0.1,
  },
  statDivider: {
    marginVertical: 10,
  },
  // ── Sections ────────────────────────────────────────────────────────────────
  section: {
    marginTop: 10,
    marginHorizontal: 12,
  },
  sectionTitle: {
    color: "#fff",
    fontFamily: "Roobert-Bold",
    fontSize: 16,
    letterSpacing: -0.4,
  },
  emptyText: {
    color: "rgba(255,255,255,0.25)",
    fontFamily: "Roobert-Regular",
    fontSize: 13,
    paddingVertical: 16,
  },
  // ── List rows ───────────────────────────────────────────────────────────────
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  listRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.07)",
  },
  listAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  listAvatarInitial: {
    color: "#fff",
    fontFamily: "Roobert-Bold",
    fontSize: 16,
  },
  listName: {
    color: "#fff",
    fontFamily: "Roobert-SemiBold",
    fontSize: 14,
    letterSpacing: -0.2,
  },
  listMeta: {
    fontFamily: "Roobert-Medium",
    fontSize: 12,
  },
  listRight: {
    color: "rgba(255,255,255,0.28)",
    fontFamily: "Roobert-Regular",
    fontSize: 12,
  },
  eventBadge: {
    backgroundColor: "rgba(24,119,242,0.14)",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(24,119,242,0.3)",
  },
  eventBadgeText: {
    color: BLUE,
    fontFamily: "Roobert-Bold",
    fontSize: 8,
    letterSpacing: 0.3,
  },
  // ── Posts grid ──────────────────────────────────────────────────────────────
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 1.5,
  },
  gridCell: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  gridCellText: {
    color: "rgba(255,255,255,0.35)",
    fontFamily: "Roobert-Regular",
    fontSize: 10,
    textAlign: "center",
    padding: 8,
    lineHeight: 15,
  },
  postGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderRadius: 40,
    overflow: "hidden",
  },
  postGridCell: {
    width: "33.33%",
    aspectRatio: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e8e8e8",
  },
  postGridRing: {
    width: "68%",
    aspectRatio: 1,
    borderRadius: 42,
    borderWidth: 2,
    borderColor: BLUE,
    overflow: "hidden",
  },
  postScrollCell: {
    width: 69,
    alignItems: "center",
    gap: 5,
  },
  postScrollRing: {
    width: 64,
    height: 64,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: BLUE,
    alignItems: "center",
    justifyContent: "center",
  },
  postScrollGap: {
    width: 58,
    height: 58,
    borderRadius: 999,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  postScrollInner: {
    width: 54,
    height: 54,
    borderRadius: 999,
    overflow: "hidden",
  },
  postScrollPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  postScrollLabel: {
    color: "rgba(255,255,255,0.6)",
    fontFamily: "Roobert-SemiBold",
    fontSize: 10,
    letterSpacing: -0.1,
    textAlign: "center",
    width: "100%",
  },
  postGridImg: {
    width: "100%",
    height: "100%",
  },
  postGridEmpty: {
    width: "100%",
    height: "100%",
    backgroundColor: "#f0f4ff",
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
  },
  postGridEmptyText: {
    color: BLUE,
    fontFamily: "Roobert-SemiBold",
    fontSize: 8,
    textAlign: "center",
    letterSpacing: -0.1,
  },
  // ── CTA ─────────────────────────────────────────────────────────────────────
  cta: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: "#1877F2",
    borderRadius: 36,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  ctaTitle: {
    color: "#fff",
    fontFamily: "Roobert-Bold",
    fontSize: 12,
    letterSpacing: 0.3,
  },
  ctaSub: {
    color: "rgba(255,255,255,0.7)",
    fontFamily: "Roobert-SemiBold",
    fontSize: 10,
    marginTop: 1,
  },
  ctaAction: {
    color: "#fff",
    fontFamily: "Roobert-Bold",
    fontSize: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  seeAll: {
    color: "rgba(255,255,255,0.35)",
    fontFamily: "Roobert-Medium",
    fontSize: 12,
  },
  medalCountPill: {
    backgroundColor: BLUE,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  medalCountText: {
    color: "#fff",
    fontFamily: "Roobert-Bold",
    fontSize: 10,
  },
  lockedGrid: {
    marginTop: 14,
    gap: 8,
  },
  lockedLabel: {
    color: "rgba(255,255,255,0.2)",
    fontFamily: "Roobert-Bold",
    fontSize: 9,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  // ── Achievements ─────────────────────────────────────────────────────────────
  achieveSection: {
    paddingTop: 4,
    paddingBottom: 5,
  },
  achieveHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  achieveEyebrow: {
    color: "rgba(255,255,255,0.28)",
    fontFamily: "Roobert-SemiBold",
    fontSize: 9,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  achieveTitle: {
    color: "#fff",
    fontFamily: "Roobert-Bold",
    fontSize: 18,
    letterSpacing: -0.5,
  },
  achieveCount: {
    color: "#fff",
    fontFamily: "Roobert-Bold",
    fontSize: 20,
    letterSpacing: -0.6,
  },
  achieveTotal: {
    color: "rgba(255,255,255,0.25)",
    fontFamily: "Roobert-Regular",
    fontSize: 13,
  },
  storyItem: {
    alignItems: "center",
    gap: 4,
    width: 58,
  },
  storyRing: {
    width: 56,
    height: 56,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  storyGap: {
    width: 52,
    height: 52,
    borderRadius: 27,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  storyInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  storyEmoji: {
    fontSize: 12,
  },
  storyName: {
    fontFamily: "Roobert-SemiBold",
    fontSize: 10,
    color: "#fff",
    textAlign: "center",
    letterSpacing: -0.1,
  },
  storyDots: {
    flexDirection: "row",
    gap: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  storyDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#1877F2",
  },
  mapPtsPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#000",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  mapPtsText: {
    color: "#fff",
    fontFamily: "Roobert-SemiBold",
    fontSize: 11,
    letterSpacing: -0.2,
  },
  mapExpandBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-end",
  },
  // ── City Contribution ────────────────────────────────────────────────────────
  contribCard: {
    backgroundColor: "#111",
    borderRadius: 34,
    padding: 14,
  },
  contribTierLabel: {
    color: "#fff",
    fontFamily: "Roobert-Bold",
    fontSize: 14,
    letterSpacing: -0.3,
  },
  contribScore: {
    color: BLUE,
    fontFamily: "Roobert-Bold",
    fontSize: 13,
    letterSpacing: -0.3,
  },
  contribBarTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "#222",
    marginBottom: 6,
    overflow: "hidden",
  },
  contribBarFill: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: BLUE,
  },
  contribNextHint: {
    color: "#999",
    fontFamily: "Roobert-SemiBold",
    fontSize: 10,
    marginBottom: 14,
  },
  contribGrid: {
    flexDirection: "row",
    marginTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#222",
    paddingTop: 14,
  },
  contribStat: {
    flex: 1,
    alignItems: "center",
    gap: 3,
  },
  contribStatBorder: {
    borderLeftColor: "#222",
  },
  contribStatNum: {
    color: "#fff",
    fontFamily: "Roobert-Bold",
    fontSize: 18,
    letterSpacing: -0.5,
  },
  contribStatLabel: {
    color: "#fff",
    fontFamily: "Roobert-SemiBold",
    fontSize: 7,
    letterSpacing: 0.5,
  },
  // ── Latest check-in map ──────────────────────────────────────────────────────
  checkinMapCard: {
    height: 180,
    borderRadius: 30,
    overflow: "hidden",
  },
  checkinMapOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  checkinMapName: {
    color: "#fff",
    fontFamily: "Roobert-Bold",
    fontSize: 14,
    letterSpacing: -0.3,
  },
  checkinMapAddr: {
    color: "rgba(255,255,255,0.45)",
    fontFamily: "Roobert-Regular",
    fontSize: 11,
    marginTop: 2,
  },
  checkinBelowCard: {
    paddingHorizontal: 4,
    paddingTop: 10,
    gap: 2,
  },
  // ── Rank card ───────────────────────────────────────────────────────────────
  rankCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111",
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  rankRankNum: {
    fontFamily: "Roobert-Bold",
    fontSize: 13,
    width: 28,
  },
  rankAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#000",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  rankName: {
    color: "#fff",
    fontFamily: "Roobert-Bold",
    fontSize: 15,
    letterSpacing: -0.4,
  },
  rankPts: {
    color: "rgba(255,255,255,0.5)",
    fontFamily: "Roobert-SemiBold",
    fontSize: 10,
  },
  profileActionRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    marginTop: 20,
    marginBottom: 4,
  },
  editBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  editBtnText: {
    color: "#000",
    fontFamily: "Roobert-Bold",
    fontSize: 11,
    letterSpacing: -0.3,
  },
  signOutBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.18)",
  },
  signOutText: {
    color: "#fff",
    fontFamily: "Roobert-Bold",
    fontSize: 11,
    letterSpacing: -0.3,
  },
});

