import { DARK_MAP_STYLE } from "@/constants/mapStyle";
import {
  computeEarnedMedals,
  computeMedalPointsForUser,
  computeStreak,
  MEDALS,
} from "@/constants/medals";
import { HotspotRow, PulseDot } from "@/components/ui/HotspotRow";
import {
  LEADERBOARD_USERS_BY_POINTS,
  LEADERBOARD_HOTSPOTS_BY_POINTS,
  USER_CHECKINS,
} from "@/app/apollo/queries/general";
import { gql } from "@apollo/client";
import { useMutation, useQuery } from "@apollo/client/react";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { LinearGradient } from "expo-linear-gradient";
import { ResizeMode, Video } from "expo-av";
import { router, useLocalSearchParams } from "expo-router";
import { BadgeCheck, Play, Star, Zap } from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";

const { height: SH } = Dimensions.get("window");
const SHEET_H = SH * 0.82;
const MAP_H = 200;
const AVATAR_SIZE = 72;
const BLUE = "#1877F2";
const TWENTY_FOUR_H = 24 * 60 * 60 * 1000;

// ── Queries ───────────────────────────────────────────────────────────────────

const USER_QUERY = gql`
  query PVUser($userId: Int!) {
    user(userId: $userId) {
      id name pfp bio visits ratings points
      followersCount followingCount isFollowingUser
      location { latitude longitude address }
      reviews { id }
      hotspots {
        id name avatar type visits
        location { latitude longitude address }
        posts { id media createdAt }
      }
      posts { id title media type createdAt }
    }
  }
`;

const HOTSPOT_QUERY = gql`
  query PVHotspot($hotspotId: Int!) {
    hotspot(hotspotId: $hotspotId) {
      id name avatar description type isEvent isPopup points
      author { id name pfp bio followersCount points }
      location { id latitude longitude address }
      ratings visits followersCount isFollowingHotspot
      checkins { id createdAt user { id name pfp } }
      posts { id title media type createdAt author { id name pfp } }
      reviews { id rating comment createdAt user { id name pfp } }
    }
  }
`;

const ME_QUERY = gql`
  query PVMe { me { id } }
`;

const FOLLOW_USER = gql`
  mutation PVFollowUser($userId: Int!) {
    followUser(userId: $userId) { id isFollowingUser followersCount }
  }
`;
const UNFOLLOW_USER = gql`
  mutation PVUnfollowUser($userId: Int!) {
    unfollowUser(userId: $userId) { id isFollowingUser followersCount }
  }
`;
const FOLLOW_HOTSPOT = gql`
  mutation PVFollowHotspot($hotspotId: Int!) {
    followHotspot(hotspotId: $hotspotId) { id followersCount isFollowingHotspot }
  }
`;
const UNFOLLOW_HOTSPOT = gql`
  mutation PVUnfollowHotspot($hotspotId: Int!) {
    unfollowHotspot(hotspotId: $hotspotId) { id followersCount isFollowingHotspot }
  }
`;

// ── Hotspot badge system ──────────────────────────────────────────────────────

interface HotspotBadge {
  id: string;
  name: string;
  tier: "bronze" | "silver" | "gold" | "platinum" | "diamond";
}

const HOTSPOT_BADGE_DEFS: HotspotBadge[] = [
  // Check-in milestones
  { id: "ci_5",    name: "First Crowd",      tier: "bronze"   },
  { id: "ci_10",   name: "Getting Busy",     tier: "bronze"   },
  { id: "ci_25",   name: "Popular Spot",     tier: "silver"   },
  { id: "ci_50",   name: "Hot Right Now",    tier: "silver"   },
  { id: "ci_100",  name: "Scene Staple",     tier: "gold"     },
  { id: "ci_250",  name: "City Landmark",    tier: "platinum" },
  { id: "ci_500",  name: "Legendary Venue",  tier: "diamond"  },
  // Posts
  { id: "p_1",  name: "On The Map",    tier: "bronze" },
  { id: "p_5",  name: "Content Hub",   tier: "bronze" },
  { id: "p_10", name: "Active Scene",  tier: "silver" },
  { id: "p_25", name: "Media Hotspot", tier: "gold"   },
  // Followers
  { id: "f_5",   name: "Getting Known",  tier: "bronze"   },
  { id: "f_10",  name: "Rising Venue",   tier: "bronze"   },
  { id: "f_25",  name: "Scene Favorite", tier: "silver"   },
  { id: "f_50",  name: "City Staple",    tier: "gold"     },
  { id: "f_100", name: "Cult Classic",   tier: "platinum" },
  // Rating
  { id: "r_4",   name: "Well Rated",    tier: "bronze" },
  { id: "r_4_5", name: "Top Rated",     tier: "silver" },
  { id: "r_4_8", name: "Perfect Score", tier: "gold"   },
  // Reviews
  { id: "rv_3",  name: "Reviewed",      tier: "bronze" },
  { id: "rv_10", name: "Well Reviewed", tier: "silver" },
  // Leaderboard
  { id: "lb_50", name: "Trending",    tier: "bronze"   },
  { id: "lb_25", name: "Hot Spot",    tier: "silver"   },
  { id: "lb_10", name: "Top 10",      tier: "gold"     },
  { id: "lb_3",  name: "Podium",      tier: "platinum" },
  { id: "lb_1",  name: "City's Best", tier: "diamond"  },
  // Special
  { id: "event", name: "Event Venue", tier: "gold"   },
  { id: "popup", name: "Pop-Up Spot", tier: "silver" },
];

function computeHotspotBadges(d: {
  visits: number; posts: number; followers: number;
  rating: number; reviews: number;
  isEvent: boolean; isPopup: boolean; rank: number;
}): HotspotBadge[] {
  const ids: string[] = [];
  if (d.visits >= 5)   ids.push("ci_5");
  if (d.visits >= 10)  ids.push("ci_10");
  if (d.visits >= 25)  ids.push("ci_25");
  if (d.visits >= 50)  ids.push("ci_50");
  if (d.visits >= 100) ids.push("ci_100");
  if (d.visits >= 250) ids.push("ci_250");
  if (d.visits >= 500) ids.push("ci_500");
  if (d.posts >= 1)    ids.push("p_1");
  if (d.posts >= 5)    ids.push("p_5");
  if (d.posts >= 10)   ids.push("p_10");
  if (d.posts >= 25)   ids.push("p_25");
  if (d.followers >= 5)   ids.push("f_5");
  if (d.followers >= 10)  ids.push("f_10");
  if (d.followers >= 25)  ids.push("f_25");
  if (d.followers >= 50)  ids.push("f_50");
  if (d.followers >= 100) ids.push("f_100");
  if (d.rating >= 4.0) ids.push("r_4");
  if (d.rating >= 4.5) ids.push("r_4_5");
  if (d.rating >= 4.8) ids.push("r_4_8");
  if (d.reviews >= 3)  ids.push("rv_3");
  if (d.reviews >= 10) ids.push("rv_10");
  if (d.rank > 0 && d.rank <= 50) ids.push("lb_50");
  if (d.rank > 0 && d.rank <= 25) ids.push("lb_25");
  if (d.rank > 0 && d.rank <= 10) ids.push("lb_10");
  if (d.rank > 0 && d.rank <= 3)  ids.push("lb_3");
  if (d.rank === 1)                ids.push("lb_1");
  if (d.isEvent) ids.push("event");
  if (d.isPopup) ids.push("popup");
  return ids.map((id) => HOTSPOT_BADGE_DEFS.find((b) => b.id === id)!).filter(Boolean);
}

function getHotspotStatusTitle(badgeCount: number): string {
  if (badgeCount === 0)  return "New to the Scene";
  if (badgeCount <= 2)   return "Gaining Traction";
  if (badgeCount <= 5)   return "Local Favorite";
  if (badgeCount <= 9)   return "Scene Staple";
  if (badgeCount <= 14)  return "City Hotspot";
  if (badgeCount <= 20)  return "Legendary Spot";
  return "Icon Venue";
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  "Austin":        { lat: 30.2672,  lng: -97.7431 },
  "Houston":       { lat: 29.7604,  lng: -95.3698 },
  "Dallas":        { lat: 32.7767,  lng: -96.7970 },
  "San Antonio":   { lat: 29.4241,  lng: -98.4936 },
  "New York":      { lat: 40.7128,  lng: -74.0060 },
  "Los Angeles":   { lat: 34.0522,  lng: -118.2437 },
  "Chicago":       { lat: 41.8781,  lng: -87.6298 },
  "Miami":         { lat: 25.7617,  lng: -80.1918 },
  "Atlanta":       { lat: 33.7490,  lng: -84.3880 },
  "Nashville":     { lat: 36.1627,  lng: -86.7816 },
  "Denver":        { lat: 39.7392,  lng: -104.9903 },
  "Phoenix":       { lat: 33.4484,  lng: -112.0740 },
  "Seattle":       { lat: 47.6062,  lng: -122.3321 },
  "San Francisco": { lat: 37.7749,  lng: -122.4194 },
  "Las Vegas":     { lat: 36.1699,  lng: -115.1398 },
  "New Orleans":   { lat: 29.9511,  lng: -90.0715 },
  "Portland":      { lat: 45.5051,  lng: -122.6750 },
  "Minneapolis":   { lat: 44.9778,  lng: -93.2650 },
  "Boston":        { lat: 42.3601,  lng: -71.0589 },
  "Philadelphia":  { lat: 39.9526,  lng: -75.1652 },
};

function cityToCoords(city: string | null): { lat: number; lng: number } | null {
  if (!city) return null;
  const key = Object.keys(CITY_COORDS).find(
    (k) => city.toLowerCase().includes(k.toLowerCase())
  );
  return key ? CITY_COORDS[key] : null;
}

function extractCity(address: string): string {
  const parts = address.split(",").map((s) => s.trim());
  for (const part of parts) {
    if (/^\d/.test(part)) continue;
    if (/\d{4,}/.test(part)) continue;
    if (/^(United States|USA|UK|Canada|Australia)$/i.test(part)) continue;
    if (/^[A-Z]{2}$/.test(part)) continue;
    return part;
  }
  return parts[0];
}

function getContributionScore(opts: { hotspots: number; posts: number; checkins: number; reviews: number }): number {
  return opts.hotspots * 40 + opts.reviews * 15 + opts.posts * 10 + opts.checkins * 5;
}
function getContributionTier(score: number): { label: string; next: number } {
  if (score < 50)   return { label: "Just Arrived", next: 50 };
  if (score < 150)  return { label: "Local Scout", next: 150 };
  if (score < 350)  return { label: "Active Contributor", next: 350 };
  if (score < 700)  return { label: "City Builder", next: 700 };
  if (score < 1200) return { label: "Scene Pillar", next: 1200 };
  return { label: "Local Legend", next: score };
}
function getExperienceTitle(count: number): string {
  if (count === 0)  return "Just Getting Started";
  if (count <= 2)   return "Newcomer";
  if (count <= 5)   return "Getting Plugged In";
  if (count <= 9)   return "Scene Regular";
  if (count <= 14)  return "Night Owl";
  if (count <= 20)  return "Scene Veteran";
  if (count <= 30)  return "City Expert";
  if (count <= 40)  return "Scene Legend";
  return "Plugged Icon";
}

function getHotspotTierColor(badgeCount: number): string {
  if (badgeCount === 0)  return "#555555";
  if (badgeCount <= 2)   return "#A0A0A0";
  if (badgeCount <= 5)   return "#CD7F32";
  if (badgeCount <= 9)   return "#A8B2BD";
  if (badgeCount <= 14)  return "#FFD700";
  if (badgeCount <= 20)  return "#C084FC";
  return "#7DD6F5";
}

function getExperienceTierColorFromPoints(pts: number): string {
  if (pts <= 0)    return "#555555";
  if (pts < 50)    return "#A0A0A0";
  if (pts < 150)   return "#CD7F32";
  if (pts < 350)   return "#A8B2BD";
  if (pts < 600)   return "#FFD700";
  if (pts < 1000)  return "#C084FC";
  if (pts < 2000)  return "#7DD6F5";
  if (pts < 4000)  return "#FF8C42";
  return "#FFFFFF";
}

function getExperienceTierColor(count: number): string {
  if (count === 0)  return "#555555";          // unstarted — dark gray
  if (count <= 2)   return "#A0A0A0";          // newcomer — light gray
  if (count <= 5)   return "#CD7F32";          // getting plugged in — bronze
  if (count <= 9)   return "#A8B2BD";          // scene regular — silver
  if (count <= 14)  return "#FFD700";          // night owl — gold
  if (count <= 20)  return "#C084FC";          // scene veteran — amethyst
  if (count <= 30)  return "#7DD6F5";          // city expert — diamond blue
  if (count <= 40)  return "#FF8C42";          // scene legend — ember orange
  return "#FFFFFF";                            // plugged icon — pure white
}

// ── Achievement / badge crown (shared) ───────────────────────────────────────

const TIER_NUM: Record<string, string> = {
  bronze: "I", silver: "II", gold: "III", platinum: "IV", diamond: "V",
};
const TIER_CROWN_COLOR: Record<string, string> = {
  bronze: "#CD7F32", silver: "#A8B2BD", gold: "#FFD700",
  platinum: "#C8C8D4", diamond: "#7DD6F5",
};

function AchievementCrown({ tier, size = 32 }: { tier: string; size?: number }) {
  const color = TIER_CROWN_COLOR[tier] ?? "#FFD700";
  const num   = TIER_NUM[tier] ?? "1";
  const h     = size * 0.75;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={h} viewBox="0 0 100 75">
        <Path d="M3,68 Q50,74 97,68 L88,36 L78,52 L68,24 L58,44 L50,16 L42,44 L32,24 L22,52 L12,36 Z" fill={color} />
        <Circle cx="12" cy="27" r="9" fill={color} />
        <Circle cx="32" cy="15" r="9" fill={color} />
        <Circle cx="50" cy="7"  r="9" fill={color} />
        <Circle cx="68" cy="15" r="9" fill={color} />
        <Circle cx="88" cy="27" r="9" fill={color} />
      </Svg>
      <Text style={{ position: "absolute", bottom: 4, color: "#fff", fontFamily: "Roobert-Bold", fontSize: size * 0.28, letterSpacing: -0.3 }}>
        {num}
      </Text>
    </View>
  );
}

// ── Map pin ───────────────────────────────────────────────────────────────────

function ProfileMapPin({ uri, name }: { uri?: string; name: string }) {
  return (
    <View style={{ alignItems: "center" }}>
      <View style={pinSt.circle}>
        {uri
          ? <Image source={{ uri }} style={{ width: "100%", height: "100%", borderRadius: 999 }} resizeMode="cover" />
          : <Text style={{ color: "#fff", fontFamily: "Roobert-Bold", fontSize: 14 }}>{name[0]?.toUpperCase() ?? "?"}</Text>
        }
      </View>
      <View style={pinSt.triangle} />
    </View>
  );
}

const pinSt = StyleSheet.create({
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

// ── Star rating ───────────────────────────────────────────────────────────────

function StarRow({ rating }: { rating: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 3, alignItems: "center" }}>
      {Array.from({ length: Math.round(rating) }, (_, i) => (
        <Star key={i} size={13} color="#FFD700" fill="#FFD700" strokeWidth={1.5} />
      ))}
      <Text style={{ color: "rgba(255,255,255,0.45)", fontFamily: "Roobert-Medium", fontSize: 12, marginLeft: 4 }}>
        {rating.toFixed(1)}
      </Text>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ProfileViewScreen() {
  const insets = useSafeAreaInsets();
  const { type, id } = useLocalSearchParams<{ type: string; id: string }>();
  const numId    = id ? parseInt(id, 10) : 0;
  const isUser    = type === "user";
  const isHotspot = type === "hotspot";

  const { data: meData } = useQuery<{ me: { id: string } }>(ME_QUERY);

  const { data: userData, loading: userLoading, refetch: userRefetch } = useQuery<{
    user: {
      id: string; name: string; pfp?: string; bio?: string;
      visits: number; ratings: number; points: number;
      followersCount: number; followingCount: number; isFollowingUser: boolean;
      location?: { latitude?: number; longitude?: number; address?: string };
      reviews?: { id: string }[];
      hotspots?: { id: string; name: string; avatar?: string; type?: any; visits?: number; location?: any; posts?: any[] }[];
      posts?: { id: string; title?: string; media?: string; type?: string; createdAt?: string }[];
    };
  }>(USER_QUERY, { variables: { userId: numId }, skip: !isUser || !numId });

  const { data: hotspotData, loading: hotspotLoading, refetch: hotspotRefetch } = useQuery<{
    hotspot: {
      id: string; name: string; avatar?: string; description?: string; points?: number;
      type?: string; isEvent?: boolean; isPopup?: boolean;
      author?: { id: string; name: string; pfp?: string; bio?: string; followersCount?: number; points?: number };
      location?: { latitude?: number; longitude?: number; address?: string };
      ratings: number; visits: number; followersCount?: number; isFollowingHotspot?: boolean;
      checkins?: { id: string; createdAt?: string; user?: { id: string; name: string; pfp?: string } }[];
      posts?: { id: string; title?: string; media?: string; type?: string; createdAt?: string; author?: { id: string; name: string; pfp?: string } }[];
      reviews?: { id: string; rating: number; comment?: string; createdAt: string; user: { id: string; name: string; pfp?: string } }[];
    };
  }>(HOTSPOT_QUERY, { variables: { hotspotId: numId }, skip: !isHotspot || !numId });

  // User-only queries
  const { data: userCheckinsData } = useQuery<{
    userCheckIns: { id: string; createdAt?: string; hotspot?: { id: string; name: string; avatar?: string; type?: string; isEvent?: boolean; location?: { latitude?: number; longitude?: number; address?: string } } }[]
  }>(USER_CHECKINS, { variables: { userId: numId }, skip: !isUser || !numId });

  const { data: userLbData } = useQuery<{
    leaderboardUsersByPoints: { periodPoints: number; user: { id: string; points: number; visits?: number; followersCount?: number; hotspots?: { id: string }[]; reviews?: { id: string }[]; posts?: { id: string }[] } }[];
  }>(LEADERBOARD_USERS_BY_POINTS, { variables: { period: "weekly", take: 500 }, skip: !isUser });

  // Hotspot-only leaderboard
  const { data: hotspotLbData } = useQuery<{
    leaderboardHotspotsByPoints: { periodPoints: number; hotspot: { id: string } }[];
  }>(LEADERBOARD_HOTSPOTS_BY_POINTS, { variables: { period: "weekly", take: 500 }, skip: !isHotspot });

  const [followUser]      = useMutation(FOLLOW_USER);
  const [unfollowUser]    = useMutation(UNFOLLOW_USER);
  const [followHotspot]   = useMutation(FOLLOW_HOTSPOT);
  const [unfollowHotspot] = useMutation(UNFOLLOW_HOTSPOT);

  const user    = userData?.user;
  const hotspot = hotspotData?.hotspot;
  const loading = userLoading || hotspotLoading;
  const isOwnProfile = isUser && meData?.me?.id === id;

  // ── User medals + points ────────────────────────────────────────────────────
  const userCheckins = userCheckinsData?.userCheckIns ?? [];

  const earnedMedals = useMemo(() => {
    if (!isUser || !user) return [];
    const checkinDates   = userCheckins.map((c) => c.createdAt ?? "").filter(Boolean);
    const uniqueVenues   = new Set(userCheckins.map((c) => c.hotspot?.id).filter(Boolean)).size;
    const eventsAttended = userCheckins.filter((c) => c.hotspot?.isEvent).length;
    const earned = computeEarnedMedals({
      totalCheckins:   user.visits ?? 0,
      longestStreak:   computeStreak(checkinDates),
      hotspotsCreated: (user.hotspots ?? []).length,
      uniqueVenues,
      followers:       user.followersCount ?? 0,
      reviewsWritten:  (user.reviews ?? []).length,
      postsCreated:    (user.posts ?? []).length,
      totalPoints:     user.points ?? 0,
      eventsAttended,
    });
    return MEDALS.filter((m) => earned.has(m.id));
  }, [isUser, user, userCheckins]);

  const medalPoints = earnedMedals.reduce((s, m) => s + m.points, 0);

  // ── User rank ───────────────────────────────────────────────────────────────
  const userLeaderboardRank = useMemo(() => {
    if (!userLbData?.leaderboardUsersByPoints?.length) return 0;
    const sorted = [...userLbData.leaderboardUsersByPoints]
      .map((e) => ({ ...e, total: e.user.points + computeMedalPointsForUser(e.user) }))
      .sort((a, b) => b.total - a.total);
    const idx = sorted.findIndex((e) => String(e.user.id) === String(numId));
    return idx >= 0 ? idx + 1 : 0;
  }, [userLbData, numId]);

  // ── User last check-in ──────────────────────────────────────────────────────
  const latestCheckin = useMemo(() => {
    if (!userCheckins.length) return null;
    return [...userCheckins].sort((a, b) => ((b.createdAt ?? "") > (a.createdAt ?? "") ? 1 : -1))[0];
  }, [userCheckins]);
  const lcLat = latestCheckin?.hotspot?.location?.latitude;
  const lcLng = latestCheckin?.hotspot?.location?.longitude;
  const hasCheckinCoords = !!(lcLat && lcLng && !(lcLat === 0 && lcLng === 0));

  // ── Hotspot badges + rank ───────────────────────────────────────────────────
  const hotspotLbRank = useMemo(() => {
    if (!hotspotLbData?.leaderboardHotspotsByPoints?.length) return 0;
    const idx = hotspotLbData.leaderboardHotspotsByPoints.findIndex(
      (e) => String(e.hotspot.id) === String(numId)
    );
    return idx >= 0 ? idx + 1 : 0;
  }, [hotspotLbData, numId]);

  const hotspotBadges = useMemo(() => {
    if (!isHotspot || !hotspot) return [];
    return computeHotspotBadges({
      visits:    hotspot.visits ?? 0,
      posts:     (hotspot.posts ?? []).length,
      followers: hotspot.followersCount ?? 0,
      rating:    hotspot.ratings ?? 0,
      reviews:   (hotspot.reviews ?? []).length,
      isEvent:   hotspot.isEvent ?? false,
      isPopup:   hotspot.isPopup ?? false,
      rank:      hotspotLbRank,
    });
  }, [isHotspot, hotspot, hotspotLbRank]);

  // ── Recent check-in visitors (hotspot) ─────────────────────────────────────
  const recentVisitors = useMemo(() => {
    if (!hotspot?.checkins) return [];
    const cutoff = Date.now() - TWENTY_FOUR_H;
    const seen = new Set<string>();
    const result: { id: string; name: string; pfp?: string; createdAt?: string }[] = [];
    for (const c of [...(hotspot.checkins)].sort((a, b) => ((b.createdAt ?? "") > (a.createdAt ?? "") ? 1 : -1))) {
      if (!c.user) continue;
      if (seen.has(c.user.id)) continue;
      seen.add(c.user.id);
      result.push({ ...c.user, createdAt: c.createdAt });
      if (result.length >= 8) break;
    }
    return result;
  }, [hotspot]);

  const handleFollowToggle = async () => {
    Haptics.selectionAsync();
    try {
      if (isUser && user) {
        user.isFollowingUser
          ? await unfollowUser({ variables: { userId: numId } })
          : await followUser({ variables: { userId: numId } });
        userRefetch();
      } else if (isHotspot && hotspot) {
        hotspot.isFollowingHotspot
          ? await unfollowHotspot({ variables: { hotspotId: numId } })
          : await followHotspot({ variables: { hotspotId: numId } });
        hotspotRefetch();
      }
    } catch {}
  };

  const name      = isUser ? (user?.name ?? "—") : (hotspot?.name ?? "—");
  const avatarUri = isUser ? user?.pfp : hotspot?.avatar;
  const initial   = name[0]?.toUpperCase() ?? "?";

  const location  = isUser ? user?.location : hotspot?.location;
  const cityLabel = location?.address ? extractCity(location.address) : null;
  const rawLat    = location?.latitude;
  const rawLng    = location?.longitude;
  const hasRawLoc = !!(rawLat && rawLng && !(rawLat === 0 && rawLng === 0));

  const [geocodedCoords, setGeocodedCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (hasRawLoc || !location?.address) return;
    setGeocodedCoords(null);
    Location.geocodeAsync(location.address).then((results: { latitude: number; longitude: number }[]) => {
      if (results.length > 0) {
        setGeocodedCoords({ lat: results[0].latitude, lng: results[0].longitude });
      }
    }).catch(() => {});
  }, [location?.address, hasRawLoc]);

  const cityFallback = (!hasRawLoc && !geocodedCoords) ? cityToCoords(cityLabel) : null;
  const lat = hasRawLoc ? rawLat : (geocodedCoords?.lat ?? cityFallback?.lat ?? null);
  const lng = hasRawLoc ? rawLng : (geocodedCoords?.lng ?? cityFallback?.lng ?? null);
  const hasLoc = !!(lat && lng);
  const isFollowing = isUser ? user?.isFollowingUser : hotspot?.isFollowingHotspot;

  const posts = useMemo(() => isUser ? (user?.posts ?? []) : (hotspot?.posts ?? []), [isUser, user, hotspot]);

  // User contribution values
  const hotspots   = user?.hotspots ?? [];
  const userPosts  = user?.posts ?? [];
  const userVisits = user?.visits ?? 0;
  const userPoints = (user?.points ?? 0) + medalPoints;
  const followers  = user?.followersCount ?? 0;

  const contributionScore = isUser ? getContributionScore({
    hotspots: hotspots.length, posts: userPosts.length,
    checkins: userVisits, reviews: (user?.reviews ?? []).length,
  }) : 0;
  const { label: contribTier, next: contribNext } = getContributionTier(contributionScore);
  const contribProgress = contribNext > contributionScore ? Math.min(contributionScore / contribNext, 1) : 1;

  // Hotspot avg rating
  const hsReviews  = hotspot?.reviews ?? [];
  const avgRating  = hsReviews.length
    ? hsReviews.reduce((s, r) => s + r.rating, 0) / hsReviews.length
    : (hotspot?.ratings ?? 0);

  return (
    <View style={{ flex: 1, justifyContent: "flex-end" }}>
      {/* Backdrop */}
      <TouchableOpacity
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.55)" }}
        activeOpacity={1}
        onPress={() => router.back()}
      />

      {/* Sheet */}
      <View style={st.sheet}>

        {loading && !(isUser ? user : hotspot) ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={BLUE} />
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>

            {/* ── Map zone ─────────────────────────────────────────────────── */}
            <View style={{ position: "relative" }}>
              <View style={{ height: MAP_H, overflow: "hidden" }}>
                {hasLoc ? (
                  <MapView
                    style={StyleSheet.absoluteFillObject}
                    provider={PROVIDER_GOOGLE}
                    customMapStyle={DARK_MAP_STYLE}
                    initialRegion={{ latitude: lat!, longitude: lng!, latitudeDelta: hasRawLoc ? 0.018 : 0.08, longitudeDelta: hasRawLoc ? 0.018 : 0.08 }}
                    showsUserLocation={false} showsMyLocationButton={false}
                    showsCompass={false} showsScale={false} showsBuildings={false}
                    showsTraffic={false} showsIndoors={false}
                    rotateEnabled={false} pitchEnabled={false}
                    scrollEnabled={false} zoomEnabled={false} moveOnMarkerPress={false}
                  >
                    {hasRawLoc && (
                      <Marker coordinate={{ latitude: lat!, longitude: lng! }} anchor={{ x: 0.5, y: 1 }} tracksViewChanges={false}>
                        <ProfileMapPin uri={avatarUri} name={name} />
                      </Marker>
                    )}
                  </MapView>
                ) : (
                  <LinearGradient
                    colors={["rgba(24,119,242,0.35)", "rgba(0,0,0,0.9)", "#000"]}
                    start={{ x: 0.4, y: 0 }} end={{ x: 0.6, y: 1 }}
                    style={StyleSheet.absoluteFillObject}
                  />
                )}
              </View>

              {/* Points pill — top-left */}
              <View style={st.mapPtsPill}>
                <Zap size={11} color="#FFD700" strokeWidth={2.5} fill="#FFD700" />
                <Text style={st.mapPtsText}>
                  {isUser ? userPoints.toLocaleString() : (hotspot?.points ?? 0).toLocaleString()} pts
                </Text>
              </View>

              {/* Author pill — top-right (hotspot only) */}
              {isHotspot && hotspot?.author && (
                <TouchableOpacity
                  onPress={() => { Haptics.selectionAsync(); router.replace(`/profile-view?type=user&id=${hotspot!.author!.id}` as any); }}
                  activeOpacity={0.82}
                  style={st.mapAuthorPill}
                >
                  <View style={st.mapAuthorAvatar}>
                    {hotspot.author.pfp
                      ? <Image source={{ uri: hotspot.author.pfp }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                      : <Text style={{ color: "#fff", fontFamily: "Roobert-Bold", fontSize: 7 }}>{hotspot.author.name[0]?.toUpperCase()}</Text>
                    }
                  </View>
                  <BadgeCheck
                    size={12}
                    color={getExperienceTierColorFromPoints(hotspot.author.points ?? 0)}
                    strokeWidth={2.5}
                  />
                  <Text style={st.mapAuthorText}>{hotspot.author.name}</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* ── Profile panel ────────────────────────────────────────────── */}
            <View style={{ position: "relative" }}>
              <View style={st.avatarFloater}>
                <View style={[st.avatar, { backgroundColor: "#000" }]}>
                  {avatarUri
                    ? <Image source={{ uri: avatarUri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                    : <Text style={st.avatarInitial}>{initial}</Text>
                  }
                </View>
              </View>

              <View style={st.panel}>
                {/* Name */}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <Text style={st.name}>{name}</Text>
                </View>

                {/* Bio / description */}
                {(isUser ? user?.bio : hotspot?.description) ? (
                  <Text style={st.bio}>{isUser ? user?.bio : hotspot?.description}</Text>
                ) : null}

                {/* Experience / type pill */}
                {isUser && (
                  <View style={st.expTitlePill}>
                    <BadgeCheck size={13} color={getExperienceTierColor(earnedMedals.length)} strokeWidth={2.5} />
                    <Text style={st.expTitle}>{getExperienceTitle(earnedMedals.length)}</Text>
                  </View>
                )}
                {isHotspot && (
                  <View style={st.expTitlePill}>
                    <BadgeCheck size={13} color={getHotspotTierColor(hotspotBadges.length)} strokeWidth={2.5} />
                    <Text style={st.expTitle}>{getHotspotStatusTitle(hotspotBadges.length)}</Text>
                  </View>
                )}
      

                {isHotspot && avgRating > 0 && (
                  <View style={{ alignSelf: "center", marginTop: 6 }}>
                    <StarRow rating={avgRating} />
                  </View>
                )}

                {/* City */}
             
                {/* Follow button */}
                {!isOwnProfile && (
                  <View style={st.actionRow}>
                    <TouchableOpacity
                      onPress={handleFollowToggle}
                      activeOpacity={0.82}
                      style={[st.followBtn, isFollowing && st.followBtnActive]}
                    >
                      <Text style={[st.followBtnText, isFollowing && st.followBtnTextActive]}>
                        {isFollowing ? "Following" : "Follow"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Stats row */}
                <View style={st.statsRow}>
                  {isUser && user ? (
                    <>
                      <View style={st.statItem}><Text style={st.statNum}>{fmtNum(userVisits)}</Text><Text style={st.statLabel}>Check ins</Text></View>
                      <View style={st.statItem}><Text style={st.statNum}>{fmtNum(userPoints)}</Text><Text style={st.statLabel}>Points</Text></View>
                      <View style={st.statDivider} />
                      <View style={st.statItem}><Text style={st.statNum}>{fmtNum(followers)}</Text><Text style={st.statLabel}>Followers</Text></View>
                      <View style={st.statDivider} />
                      <View style={st.statItem}><Text style={st.statNum}>{String(hotspots.length)}</Text><Text style={st.statLabel}>Hotspots</Text></View>
                    </>
                  ) : hotspot ? (
                    <>
                      <View style={st.statItem}><Text style={st.statNum}>{fmtNum(hotspot.visits)}</Text><Text style={st.statLabel}>Check ins</Text></View>
                      <View style={st.statDivider} />
                      <View style={st.statItem}><Text style={st.statNum}>{avgRating > 0 ? avgRating.toFixed(1) : "—"}</Text><Text style={st.statLabel}>Rating</Text></View>
                      <View style={st.statDivider} />
                      <View style={st.statItem}><Text style={st.statNum}>{fmtNum(hotspot.followersCount ?? 0)}</Text><Text style={st.statLabel}>Followers</Text></View>
                      <View style={st.statDivider} />
                      <View style={st.statItem}><Text style={st.statNum}>{fmtNum((hotspot.posts ?? []).length)}</Text><Text style={st.statLabel}>Posts</Text></View>
                    </>
                  ) : null}
                </View>

                {/* ═══════════════════════════════════════════════════════════
                    USER SECTIONS
                ═══════════════════════════════════════════════════════════ */}
                {isUser && (
                  <>
                    {/* ── Achievements ─────────────────────────────────────── */}
                    <View style={st.achieveSection}>
                      <View style={st.achieveHeader}>
                        <View>
                          <Text style={st.achieveEyebrow}>ACHIEVEMENTS</Text>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: BLUE }} />
                            <Text style={st.achieveTitle}>{getExperienceTitle(earnedMedals.length)}</Text>
                          </View>
                        </View>
                        <Text style={st.achieveCount}>{earnedMedals.length}</Text>
                      </View>
                      {earnedMedals.length > 0 ? (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 16, paddingVertical: 4 }}>
                          {earnedMedals.slice(0, 20).map((m) => (
                            <View key={m.id} style={st.storyItem}>
                              <LinearGradient colors={[BLUE, BLUE]} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={st.storyRing}>
                                <View style={st.storyGap}>
                                  <View style={st.storyInner}><AchievementCrown tier={m.tier} size={22} /></View>
                                </View>
                              </LinearGradient>
                              <Text style={st.storyName} numberOfLines={1}>{m.name}</Text>
                              <View style={st.storyDots}>
                                {Array.from({ length: { bronze: 1, silver: 2, gold: 3, platinum: 4, diamond: 5 }[m.tier] ?? 1 }).map((_, i) => (
                                  <View key={i} style={st.storyDot} />
                                ))}
                              </View>
                            </View>
                          ))}
                        </ScrollView>
                      ) : (
                        <Text style={[st.emptyText, { textAlign: "center", paddingHorizontal: 16 }]}>No achievements yet</Text>
                      )}
                    </View>

                    {/* ── Hotspots list ─────────────────────────────────────── */}
                    {hotspots.length > 0 && (
                      <View style={st.section}>
                        <View style={st.sectionHeader}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: BLUE }} />
                            <Text style={st.sectionTitle}>Hotspots</Text>
                          </View>
                        </View>
                        <View>
                          {(() => {
                            const sorted = [...hotspots].sort((a, b) => {
                              const aL = (a.posts ?? []).reduce<string | undefined>((acc, p) => p.createdAt && (!acc || p.createdAt > acc) ? p.createdAt : acc, undefined);
                              const bL = (b.posts ?? []).reduce<string | undefined>((acc, p) => p.createdAt && (!acc || p.createdAt > acc) ? p.createdAt : acc, undefined);
                              if (aL && bL) return bL.localeCompare(aL);
                              if (aL) return -1;
                              if (bL) return 1;
                              return (b.visits ?? 0) - (a.visits ?? 0);
                            });
                            return sorted.slice(0, 5).map((h, i) => {
                              const lastPostAt = (h.posts ?? []).reduce<string | undefined>(
                                (acc, p: any) => p.createdAt && (!acc || p.createdAt > acc) ? p.createdAt : acc, undefined
                              );
                              return (
                                <HotspotRow
                                  key={h.id}
                                  hotspot={{ id: h.id, name: h.name, avatar: h.avatar, type: h.type, location: h.location, posts: (h.posts ?? []).map((p: any) => ({ id: p.id, media: p.media })), checkinCount: h.visits, lastPostAt }}
                                  isLast={i === Math.min(sorted.length, 5) - 1}
                                />
                              );
                            });
                          })()}
                        </View>
                      </View>
                    )}

                    {/* ── Rank card ─────────────────────────────────────────── */}
                    {user && (
                      <View style={st.section}>
                        <View style={st.sectionHeader}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: BLUE }} />
                            <Text style={st.sectionTitle}>Rank</Text>
                          </View>
                        </View>
                        <View style={st.rankCard}>
                          <Text style={[st.rankNum, { color: userLeaderboardRank === 1 ? BLUE : "rgba(255,255,255,0.35)" }]}>
                            {userLeaderboardRank > 0 ? `#${userLeaderboardRank}` : "—"}
                          </Text>
                          <PulseDot color={BLUE} size={5} />
                          <View style={{ flex: 1 }}><Text style={st.rankName} numberOfLines={1}>{name}</Text></View>
                          <Text style={st.rankPts}>{userPoints.toLocaleString()} pts</Text>
                          <View style={st.rankAvatar}>
                            {avatarUri
                              ? <Image source={{ uri: avatarUri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                              : <Text style={{ color: "#fff", fontFamily: "Roobert-Bold", fontSize: 10 }}>{initial}</Text>
                            }
                          </View>
                        </View>
                      </View>
                    )}

                    {/* ── City contribution ─────────────────────────────────── */}
                    {user && (
                      <View style={[st.section, { marginTop: 16 }]}>
                        <View style={st.sectionHeader}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: BLUE }} />
                            <Text style={st.sectionTitle}>City Contribution</Text>
                          </View>
                        </View>
                        <View style={st.contribCard}>
                          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                            <Text style={st.contribTierLabel}>{contribTier}</Text>
                            <Text style={st.contribScore}>{contributionScore.toLocaleString()} pts</Text>
                          </View>
                          <View style={st.contribBarTrack}>
                            <View style={[st.contribBarFill, { width: `${Math.round(contribProgress * 100)}%` as any }]} />
                          </View>
                          {contribProgress < 1 && (
                            <Text style={st.contribNextHint}>{(contribNext - contributionScore).toLocaleString()} pts to next tier</Text>
                          )}
                          <View style={st.contribGrid}>
                            <View style={st.contribStat}><Text style={st.contribStatNum}>{hotspots.length}</Text><Text style={st.contribStatLabel}>HOTSPOTS</Text></View>
                            <View style={[st.contribStat, st.contribStatBorder]}><Text style={st.contribStatNum}>{userPosts.length}</Text><Text style={st.contribStatLabel}>POSTS</Text></View>
                            <View style={[st.contribStat, st.contribStatBorder]}><Text style={st.contribStatNum}>{userVisits}</Text><Text style={st.contribStatLabel}>CHECK-INS</Text></View>
                            <View style={[st.contribStat, st.contribStatBorder]}><Text style={st.contribStatNum}>{(user.reviews ?? []).length}</Text><Text style={st.contribStatLabel}>REVIEWS</Text></View>
                          </View>
                        </View>
                      </View>
                    )}

                    {/* ── Posts ─────────────────────────────────────────────── */}
                    {posts.filter((p) => p.media).length > 0 && (
                      <View style={st.section}>
                        <View style={st.sectionHeader}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: BLUE }} />
                            <Text style={st.sectionTitle}>Posts</Text>
                          </View>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 2, paddingVertical: 4 }}>
                          {(() => {
                            const sorted = [...posts].filter((p) => p.media).sort((a, b) => ((b.createdAt ?? "") > (a.createdAt ?? "") ? 1 : -1));
                            const storyPosts = JSON.stringify(sorted.map((p) => ({
                              id: p.id, media: p.media, type: p.type, title: p.title, content: p.title,
                              createdAt: p.createdAt,
                              authorId: user?.id ?? "", authorName: user?.name ?? "", authorPfp: user?.pfp,
                            })));
                            return sorted.map((p, idx) => {
                              const isVid = p.type === "video" || /\.(mp4|mov|webm)$/i.test(p.media ?? "");
                              return (
                                <TouchableOpacity
                                  key={p.id}
                                  activeOpacity={0.82}
                                  onPress={() => { Haptics.selectionAsync(); router.push({ pathname: "/post/[id]", params: { id: p.id, posts: storyPosts, index: String(idx) } } as any); }}
                                >
                                  <View style={st.postScrollCell}>
                                    <View style={st.postScrollRing}><View style={st.postScrollGap}><View style={st.postScrollInner}>
                                      {isVid ? <Video source={{ uri: p.media! }} style={st.postGridImg} resizeMode={ResizeMode.COVER} shouldPlay={false} isMuted isLooping={false} /> : <Image source={{ uri: p.media! }} style={st.postGridImg} resizeMode="cover" />}
                                      {isVid && <View style={st.postScrollPlayOverlay}><Play size={14} color="#fff" fill="#fff" strokeWidth={0} /></View>}
                                    </View></View></View>
                                    <Text style={st.postScrollLabel} numberOfLines={1}>{p.title ?? (isVid ? "Video" : "Photo")}</Text>
                                  </View>
                                </TouchableOpacity>
                              );
                            });
                          })()}
                        </ScrollView>
                      </View>
                    )}

                    {/* ── Last Check-In ─────────────────────────────────────── */}
                    {user && (
                      <View style={st.section}>
                        <View style={st.sectionHeader}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: BLUE }} />
                            <Text style={st.sectionTitle}>Last Check-In</Text>
                          </View>
                          {latestCheckin?.createdAt && <Text style={st.seeAll}>{timeAgo(latestCheckin.createdAt)} ago</Text>}
                        </View>
                        <View style={st.checkinMapCard}>
                          {latestCheckin && hasCheckinCoords ? (
                            <MapView
                              style={StyleSheet.absoluteFillObject} provider={PROVIDER_GOOGLE}
                              customMapStyle={DARK_MAP_STYLE}
                              initialRegion={{ latitude: lcLat!, longitude: lcLng!, latitudeDelta: 0.008, longitudeDelta: 0.008 }}
                              scrollEnabled={false} zoomEnabled={false} rotateEnabled={false} pitchEnabled={false}
                              showsUserLocation={false} showsMyLocationButton={false} showsCompass={false} showsBuildings={false} showsTraffic={false} moveOnMarkerPress={false}
                            >
                              <Marker coordinate={{ latitude: lcLat!, longitude: lcLng! }} anchor={{ x: 0.5, y: 1 }} tracksViewChanges={false}>
                                <View style={{ alignItems: "center" }}>
                                  <View style={pinSt.circle}>
                                    {latestCheckin.hotspot?.avatar ? <Image source={{ uri: latestCheckin.hotspot.avatar }} style={{ width: "100%", height: "100%", borderRadius: 999 }} resizeMode="cover" /> : <Text style={{ color: "#fff", fontFamily: "Roobert-Bold", fontSize: 14 }}>{latestCheckin.hotspot?.name?.[0]?.toUpperCase() ?? "?"}</Text>}
                                  </View>
                                  <View style={pinSt.triangle} />
                                </View>
                              </Marker>
                            </MapView>
                          ) : hasLoc ? (
                            <MapView
                              style={StyleSheet.absoluteFillObject} provider={PROVIDER_GOOGLE}
                              customMapStyle={DARK_MAP_STYLE}
                              initialRegion={{ latitude: lat!, longitude: lng!, latitudeDelta: 0.06, longitudeDelta: 0.06 }}
                              scrollEnabled={false} zoomEnabled={false} rotateEnabled={false} pitchEnabled={false}
                              showsUserLocation={false} showsMyLocationButton={false} showsCompass={false} showsBuildings={false} showsTraffic={false} moveOnMarkerPress={false}
                            >
                              <Marker coordinate={{ latitude: lat!, longitude: lng! }} anchor={{ x: 0.5, y: 1 }} tracksViewChanges={false}>
                                <ProfileMapPin uri={avatarUri} name={name} />
                              </Marker>
                            </MapView>
                          ) : (
                            <LinearGradient colors={["rgba(24,119,242,0.12)", "#000"]} style={StyleSheet.absoluteFillObject} />
                          )}
                          <View style={st.checkinMapOverlay}>
                            <Text style={st.checkinMapName} numberOfLines={1}>{latestCheckin?.hotspot?.name ?? cityLabel ?? "Somewhere in the city"}</Text>
                            {latestCheckin?.hotspot?.location?.address && <Text style={st.checkinMapAddr} numberOfLines={1}>{latestCheckin.hotspot.location.address}</Text>}
                            {!latestCheckin && <Text style={st.checkinMapAddr}>No check-ins yet</Text>}
                          </View>
                        </View>
                      </View>
                    )}
                  </>
                )}

                {/* ═══════════════════════════════════════════════════════════
                    HOTSPOT SECTIONS
                ═══════════════════════════════════════════════════════════ */}
                {isHotspot && hotspot && (
                  <>
                    {/* ── Badges ───────────────────────────────────────────── */}
                    <View style={st.achieveSection}>
                      <View style={st.achieveHeader}>
                        <View>
                          <Text style={st.achieveEyebrow}>HOTSPOT BADGES</Text>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: BLUE }} />
                            <Text style={st.achieveTitle}>{getHotspotStatusTitle(hotspotBadges.length)}</Text>
                          </View>
                        </View>
                        <Text style={st.achieveCount}>{hotspotBadges.length}</Text>
                      </View>
                      {hotspotBadges.length > 0 ? (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 16, paddingVertical: 4 }}>
                          {hotspotBadges.map((b) => (
                            <View key={b.id} style={st.storyItem}>
                              <LinearGradient colors={[BLUE, BLUE]} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={st.storyRing}>
                                <View style={st.storyGap}>
                                  <View style={st.storyInner}><AchievementCrown tier={b.tier} size={22} /></View>
                                </View>
                              </LinearGradient>
                              <Text style={st.storyName} numberOfLines={1}>{b.name}</Text>
                              <View style={st.storyDots}>
                                {Array.from({ length: { bronze: 1, silver: 2, gold: 3, platinum: 4, diamond: 5 }[b.tier] ?? 1 }).map((_, i) => (
                                  <View key={i} style={st.storyDot} />
                                ))}
                              </View>
                            </View>
                          ))}
                        </ScrollView>
                      ) : (
                        <Text style={[st.emptyText, { textAlign: "center", paddingHorizontal: 16 }]}>Just getting started</Text>
                      )}
                    </View>

                    {/* ── Posts (story circles) ─────────────────────────────── */}
                    {posts.filter((p) => p.media).length > 0 && (
                      <View style={st.section}>
                        <View style={st.sectionHeader}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: BLUE }} />
                            <Text style={st.sectionTitle}>Posts</Text>
                          </View>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 2, paddingVertical: 4 }}>
                          {(() => {
                            const filtered = posts.filter((p) => p.media);
                            const storyPosts = JSON.stringify(filtered.map((p) => ({
                              id: p.id, media: p.media, type: p.type, title: (p as any).title, content: (p as any).title,
                              createdAt: p.createdAt,
                              authorId: (p as any).author?.id ?? hotspot?.author?.id ?? "",
                              authorName: (p as any).author?.name ?? hotspot?.author?.name ?? hotspot?.name ?? "",
                              authorPfp: (p as any).author?.pfp ?? hotspot?.author?.pfp,
                            })));
                            return filtered.map((p, idx) => {
                              const isVid = p.type === "video" || /\.(mp4|mov|webm)$/i.test(p.media ?? "");
                              return (
                                <TouchableOpacity
                                  key={p.id}
                                  activeOpacity={0.82}
                                  onPress={() => { Haptics.selectionAsync(); router.push({ pathname: "/post/[id]", params: { id: p.id, posts: storyPosts, index: String(idx) } } as any); }}
                                >
                                  <View style={st.postScrollCell}>
                                    <View style={st.postScrollRing}><View style={st.postScrollGap}><View style={st.postScrollInner}>
                                      {isVid ? <Video source={{ uri: p.media! }} style={st.postGridImg} resizeMode={ResizeMode.COVER} shouldPlay={false} isMuted isLooping={false} /> : <Image source={{ uri: p.media! }} style={st.postGridImg} resizeMode="cover" />}
                                      {isVid && <View style={st.postScrollPlayOverlay}><Play size={14} color="#fff" fill="#fff" strokeWidth={0} /></View>}
                                    </View></View></View>
                                    <Text style={st.postScrollLabel} numberOfLines={1}>{(p as any).title ?? (p.createdAt ? timeAgo(p.createdAt) : "Post")}</Text>
                                  </View>
                                </TouchableOpacity>
                              );
                            });
                          })()}
                        </ScrollView>
                      </View>
                    )}

                    {/* ── Recent Visitors (≈ hotspot list for users) ────────── */}
                    <View style={st.section}>
                      <View style={st.sectionHeader}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: BLUE }} />
                          <Text style={st.sectionTitle}>Recent Visitors</Text>
                        </View>
                        {hotspot.visits > 0 && <Text style={st.seeAll}>{fmtNum(hotspot.visits)} total</Text>}
                      </View>
                      {recentVisitors.length > 0 ? (
                        <View>
                          {recentVisitors.map((v, i) => (
                            <TouchableOpacity
                              key={v.id}
                              onPress={() => { Haptics.selectionAsync(); router.replace(`/profile-view?type=user&id=${v.id}` as any); }}
                              activeOpacity={0.82}
                              style={[st.visitorRow, i < recentVisitors.length - 1 && st.visitorRowBorder]}
                            >
                              <View style={st.visitorAvatar}>
                                {v.pfp
                                  ? <Image source={{ uri: v.pfp }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                                  : <Text style={{ color: "#fff", fontFamily: "Roobert-Bold", fontSize: 14 }}>{v.name[0]?.toUpperCase()}</Text>
                                }
                              </View>
                              <Text style={st.visitorName} numberOfLines={1}>{v.name}</Text>
                              {v.createdAt && <Text style={st.visitorTime}>{timeAgo(v.createdAt)} ago</Text>}
                            </TouchableOpacity>
                          ))}
                        </View>
                      ) : (
                        <Text style={st.emptyText}>No recent visitors</Text>
                      )}
                    </View>

                    {/* ── Leaderboard rank (≈ rank card for users) ─────────── */}
                    <View style={st.section}>
                      <View style={st.sectionHeader}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: BLUE }} />
                          <Text style={st.sectionTitle}>Leaderboard</Text>
                        </View>
                      </View>
                      <View style={st.rankCard}>
                        <Text style={[st.rankNum, { color: hotspotLbRank === 1 ? BLUE : "rgba(255,255,255,0.35)" }]}>
                          {hotspotLbRank > 0 ? `#${hotspotLbRank}` : "—"}
                        </Text>
                        <PulseDot color={BLUE} size={5} />
                        <View style={{ flex: 1 }}><Text style={st.rankName} numberOfLines={1}>{name}</Text></View>
                        <Text style={st.rankPts}>{(hotspot.points ?? 0).toLocaleString()} pts</Text>
                        <View style={st.rankAvatar}>
                          {avatarUri
                            ? <Image source={{ uri: avatarUri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                            : <Text style={{ color: "#fff", fontFamily: "Roobert-Bold", fontSize: 10 }}>{initial}</Text>
                          }
                        </View>
                      </View>
                    </View>

                    {/* ── Venue Stats (≈ city contribution for users) ───────── */}
                    <View style={[st.section, { marginTop: 16 }]}>
                      <View style={st.sectionHeader}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: BLUE }} />
                          <Text style={st.sectionTitle}>Venue Stats</Text>
                        </View>
                      </View>
                      <View style={st.contribCard}>
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                          <Text style={st.contribTierLabel}>{getHotspotStatusTitle(hotspotBadges.length)}</Text>
                          <Text style={st.contribScore}>{hotspotBadges.length} badges</Text>
                        </View>
                        <View style={st.contribBarTrack}>
                          <View style={[st.contribBarFill, { width: `${Math.min((hotspot.visits / 100) * 100, 100)}%` as any }]} />
                        </View>
                        <Text style={st.contribNextHint}>
                          {hotspot.visits < 100 ? `${100 - hotspot.visits} more check-ins to Scene Staple` : "Scene Staple achieved"}
                        </Text>
                        <View style={st.contribGrid}>
                          <View style={st.contribStat}><Text style={st.contribStatNum}>{fmtNum(hotspot.visits)}</Text><Text style={st.contribStatLabel}>CHECK-INS</Text></View>
                          <View style={[st.contribStat, st.contribStatBorder]}><Text style={st.contribStatNum}>{(hotspot.posts ?? []).length}</Text><Text style={st.contribStatLabel}>POSTS</Text></View>
                          <View style={[st.contribStat, st.contribStatBorder]}><Text style={st.contribStatNum}>{fmtNum(hotspot.followersCount ?? 0)}</Text><Text style={st.contribStatLabel}>FOLLOWERS</Text></View>
                          <View style={[st.contribStat, st.contribStatBorder]}><Text style={st.contribStatNum}>{hsReviews.length}</Text><Text style={st.contribStatLabel}>REVIEWS</Text></View>
                        </View>
                      </View>
                    </View>

                    {/* ── Reviews (≈ last check-in for users) ──────────────── */}
                    <View style={st.section}>
                      <View style={st.sectionHeader}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: BLUE }} />
                          <Text style={st.sectionTitle}>Reviews</Text>
                        </View>
                        {hsReviews.length > 0 && avgRating > 0 && (
                          <StarRow rating={avgRating} />
                        )}
                      </View>
                      {hsReviews.length > 0 ? (
                        <View style={{ gap: 10 }}>
                          {hsReviews.slice(0, 6).map((r) => (
                            <View key={r.id} style={st.reviewCard}>
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                <View style={st.reviewAvatar}>
                                  {r.user.pfp
                                    ? <Image source={{ uri: r.user.pfp }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                                    : <Text style={{ color: "#fff", fontFamily: "Roobert-Bold", fontSize: 10 }}>{r.user.name[0]?.toUpperCase()}</Text>
                                  }
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={st.reviewName}>{r.user.name}</Text>
                                  <StarRow rating={r.rating} />
                                </View>
                                <Text style={st.reviewTime}>{timeAgo(r.createdAt)}</Text>
                              </View>
                              {r.comment ? <Text style={st.reviewComment} numberOfLines={4}>{r.comment}</Text> : null}
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text style={st.emptyText}>No reviews yet</Text>
                      )}
                    </View>
                  </>
                )}

              </View>
            </View>
          </ScrollView>
        )}
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  sheet: {
    height: SHEET_H, backgroundColor: "#000",
    borderTopLeftRadius: 50, borderTopRightRadius: 50, overflow: "hidden",
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)", alignSelf: "center", marginTop: 10,
  },
  mapPtsPill: {
    position: "absolute", top: 16, left: 16,
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#000", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6,
  },
  mapPtsText: { color: "#fff", fontFamily: "Roobert-SemiBold", fontSize: 11, letterSpacing: -0.2 },
  mapAuthorPill: {
    position: "absolute", top: 16, right: 16,
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#000", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6,
  },
  mapAuthorAvatar: {
    width: 18, height: 18, borderRadius: 9, backgroundColor: "#222",
    overflow: "hidden", alignItems: "center", justifyContent: "center",
  },
  mapAuthorText: { color: "#fff", fontFamily: "Roobert-SemiBold", fontSize: 11, letterSpacing: -0.2 },
  avatarFloater: {
    position: "absolute", top: -(AVATAR_SIZE / 1), left: 0, right: 0, alignItems: "center", zIndex: 10,
  },
  avatar: {
    width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2,
    overflow: "hidden", alignItems: "center", justifyContent: "center",
    borderWidth: 5, borderColor: "#000",
  },
  avatarInitial: { color: "#fff", fontFamily: "Roobert-Bold", fontSize: 32 },
  panel: {
    marginTop: -42, borderRadius: 40, backgroundColor: "#000",
    paddingTop: AVATAR_SIZE / 2 + 12, paddingBottom: 22, overflow: "hidden",
  },
  name: { color: "#fff", fontFamily: "Roobert-Bold", fontSize: 22, letterSpacing: -0.5, textAlign: "center" },
  bio: { color: "#fff", fontFamily: "Roobert-Medium", fontSize: 12.5, lineHeight: 19, textAlign: "center", paddingHorizontal: 24, marginTop: 8 },
  expTitlePill: {
    flexDirection: "row", alignItems: "center", alignSelf: "center", gap: 7,
    marginTop: 8, paddingHorizontal: 13, paddingVertical: 7,
    borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: "#222",
  },
  expTitle: { color: "#fff", fontFamily: "Roobert-SemiBold", fontSize: 10, letterSpacing: -0.1 },
  authorRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 8 },
  authorAvatar: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: "#1a1a1a",
    overflow: "hidden", alignItems: "center", justifyContent: "center",
  },
  authorName: { color: "rgba(255,255,255,0.45)", fontFamily: "Roobert-Medium", fontSize: 12 },
  cityRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, marginTop: 5 },
  cityText: { color: "rgba(255,255,255,0.45)", fontFamily: "Roobert-Medium", fontSize: 13 },
  actionRow: { flexDirection: "row", justifyContent: "center", gap: 10, marginTop: 20, marginBottom: 4, paddingHorizontal: 24 },
  followBtn: { paddingHorizontal: 28, paddingVertical: 10, borderRadius: 20, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  followBtnActive: { backgroundColor: "#000", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.18)" },
  followBtnText: { color: "#000", fontFamily: "Roobert-Bold", fontSize: 11, letterSpacing: -0.3 },
  followBtnTextActive: { color: "#fff" },
  statsRow: { flexDirection: "row", marginHorizontal: 48, borderRadius: 14, overflow: "hidden" },
  statItem: { flex: 1, alignItems: "center", paddingVertical: 14, gap: 1.5 },
  statNum: { color: "#fff", fontFamily: "Roobert-Bold", fontSize: 15, letterSpacing: -0.5 },
  statLabel: { color: "#fff", fontFamily: "Roobert-SemiBold", fontSize: 11, letterSpacing: 0.1 },
  statDivider: { marginVertical: 10 },
  // Achievements / badges
  achieveSection: { paddingTop: 4, paddingBottom: 5 },
  achieveHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingHorizontal: 16, marginBottom: 14 },
  achieveEyebrow: { color: "rgba(255,255,255,0.28)", fontFamily: "Roobert-SemiBold", fontSize: 9, letterSpacing: 0.8, marginBottom: 4 },
  achieveTitle: { color: "#fff", fontFamily: "Roobert-Bold", fontSize: 18, letterSpacing: -0.5 },
  achieveCount: { color: "#fff", fontFamily: "Roobert-Bold", fontSize: 20, letterSpacing: -0.6 },
  storyItem: { alignItems: "center", gap: 4, width: 58 },
  storyRing: { width: 56, height: 56, borderRadius: 34, alignItems: "center", justifyContent: "center" },
  storyGap: { width: 52, height: 52, borderRadius: 27, backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  storyInner: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  storyName: { fontFamily: "Roobert-SemiBold", fontSize: 10, color: "#fff", textAlign: "center", letterSpacing: -0.1 },
  storyDots: { flexDirection: "row", gap: 3, alignItems: "center", justifyContent: "center" },
  storyDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: BLUE },
  emptyText: { color: "rgba(255,255,255,0.25)", fontFamily: "Roobert-Regular", fontSize: 13, paddingVertical: 16 },
  // Sections
  section: { marginTop: 10, marginHorizontal: 12 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  sectionTitle: { color: "#fff", fontFamily: "Roobert-Bold", fontSize: 16, letterSpacing: -0.4 },
  seeAll: { color: "rgba(255,255,255,0.35)", fontFamily: "Roobert-Medium", fontSize: 12 },
  // Posts story circles
  postScrollCell: { width: 69, alignItems: "center", gap: 5 },
  postScrollRing: { width: 64, height: 64, borderRadius: 999, borderWidth: 2, borderColor: BLUE, alignItems: "center", justifyContent: "center" },
  postScrollGap: { width: 58, height: 58, borderRadius: 999, backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  postScrollInner: { width: 54, height: 54, borderRadius: 999, overflow: "hidden" },
  postScrollPlayOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.35)" },
  postScrollLabel: { color: "rgba(255,255,255,0.6)", fontFamily: "Roobert-SemiBold", fontSize: 10, letterSpacing: -0.1, textAlign: "center", width: "100%" },
  postGridImg: { width: "100%", height: "100%" },
  // Rank card
  rankCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#111", borderRadius: 24, paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  rankNum: { fontFamily: "Roobert-Bold", fontSize: 13, width: 28 },
  rankAvatar: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#000", overflow: "hidden", alignItems: "center", justifyContent: "center" },
  rankName: { color: "#fff", fontFamily: "Roobert-Bold", fontSize: 15, letterSpacing: -0.4 },
  rankPts: { color: "rgba(255,255,255,0.5)", fontFamily: "Roobert-SemiBold", fontSize: 10 },
  // Contribution / venue stats
  contribCard: { backgroundColor: "#111", borderRadius: 34, padding: 14 },
  contribTierLabel: { color: "#fff", fontFamily: "Roobert-Bold", fontSize: 14, letterSpacing: -0.3 },
  contribScore: { color: BLUE, fontFamily: "Roobert-Bold", fontSize: 13, letterSpacing: -0.3 },
  contribBarTrack: { height: 4, borderRadius: 2, backgroundColor: "#222", marginBottom: 6, overflow: "hidden" },
  contribBarFill: { height: "100%", borderRadius: 2, backgroundColor: BLUE },
  contribNextHint: { color: "#999", fontFamily: "Roobert-SemiBold", fontSize: 10, marginBottom: 14 },
  contribGrid: { flexDirection: "row", marginTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#222", paddingTop: 14 },
  contribStat: { flex: 1, alignItems: "center", gap: 3 },
  contribStatBorder: { borderLeftColor: "#222" },
  contribStatNum: { color: "#fff", fontFamily: "Roobert-Bold", fontSize: 18, letterSpacing: -0.5 },
  contribStatLabel: { color: "#fff", fontFamily: "Roobert-SemiBold", fontSize: 7, letterSpacing: 0.5 },
  // Recent visitors
  visitorRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  visitorRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(255,255,255,0.07)" },
  visitorAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#1a1a1a", overflow: "hidden", alignItems: "center", justifyContent: "center" },
  visitorName: { flex: 1, color: "#fff", fontFamily: "Roobert-Medium", fontSize: 13, letterSpacing: -0.2 },
  visitorTime: { color: "rgba(255,255,255,0.3)", fontFamily: "Roobert-Regular", fontSize: 11 },
  // Last check-in / reviews
  checkinMapCard: { height: 180, borderRadius: 30, overflow: "hidden" },
  checkinMapOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "rgba(0,0,0,0.55)" },
  checkinMapName: { color: "#fff", fontFamily: "Roobert-Bold", fontSize: 14, letterSpacing: -0.3 },
  checkinMapAddr: { color: "rgba(255,255,255,0.45)", fontFamily: "Roobert-Regular", fontSize: 11, marginTop: 2 },
  reviewCard: { backgroundColor: "#111", borderRadius: 16, padding: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: "#1a1a1a" },
  reviewAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#1a1a1a", overflow: "hidden", alignItems: "center", justifyContent: "center" },
  reviewName: { color: "#fff", fontFamily: "Roobert-SemiBold", fontSize: 12, letterSpacing: -0.2, marginBottom: 2 },
  reviewTime: { color: "rgba(255,255,255,0.25)", fontFamily: "Roobert-Regular", fontSize: 11 },
  reviewComment: { color: "rgba(255,255,255,0.6)", fontFamily: "Roobert-Regular", fontSize: 12, lineHeight: 18 },
});

