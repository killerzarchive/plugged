import { ALL_HOTSPOTS, ME_QUERY } from "@/app/apollo/queries/general";
import { useColors } from "@/contexts/theme";
import { DARK_MAP_STYLE } from "@/constants/mapStyle";
import { useQuery } from "@apollo/client/react";
import { ResizeMode, Video } from "expo-av";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import * as ExpoLocation from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import { MapPin, Play, Search, X } from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: SW, height: SH } = Dimensions.get("window");
const SHEET_H = SH * 0.8;
const POST_THUMB_W = (SW - 44 - 12) / 3;
const RADIUS_KM = 40.23; // 25 miles

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

type Tab = "all" | "popular" | "trending" | "new";

interface SceneDef {
  id: string;
  label: string;
  match: (h: any) => boolean;
  postMatch?: (p: any) => boolean;
}

interface PostThumb {
  id: string;
  media: string;
  mediaType: "video" | "image";
  hotspotId: string;
  hotspotName: string;
  hotspotAvatar?: string;
  authorId?: string;
  authorPfp?: string;
  authorName?: string;
  isRecent: boolean;
  hotspotActive: boolean;
  lat?: number;
  lng?: number;
}

interface ComputedScene {
  def: SceneDef;
  hotspotCount: number;
  totalFollowers: number;
  totalPoints: number;
  posts: PostThumb[];
  cover?: string;
}

function typeStr(h: any): string {
  if (typeof h.type === "string") return h.type.toLowerCase();
  if (h.type && typeof h.type === "object" && typeof h.type.name === "string")
    return h.type.name.toLowerCase();
  return "";
}

function isVideo(p: any): boolean {
  if (p.type === "video") return true;
  if (typeof p.media === "string") {
    const url = p.media.toLowerCase().split("?")[0];
    return url.endsWith(".mp4") || url.endsWith(".mov") || url.endsWith(".webm");
  }
  return false;
}

function hasRecentCheckin(h: any, withinMs: number): boolean {
  const now = Date.now();
  return (h.checkins ?? []).some(
    (c: any) => now - new Date(c.createdAt).getTime() < withinMs,
  );
}

const SCENES: SceneDef[] = [
  {
    id: "bars",
    label: "#bars",
    match: (h) => !h.isEvent && !h.isPopup && typeStr(h).includes("bar"),
  },
  {
    id: "clubs",
    label: "#clubs",
    match: (h) => !h.isEvent && !h.isPopup && typeStr(h).includes("club"),
  },
  {
    id: "eats",
    label: "#eats",
    match: (h) =>
      !h.isEvent &&
      !h.isPopup &&
      (typeStr(h).includes("restaurant") ||
        typeStr(h).includes("food") ||
        typeStr(h).includes("eat")),
  },
  {
    id: "live",
    label: "#live",
    match: (h) => hasRecentCheckin(h, 12 * 3600000),
  },
  {
    id: "new",
    label: "#new",
    match: (h) =>
      !h.isEvent &&
      !h.isPopup &&
      Date.now() - new Date(h.createdAt || 0).getTime() < 7 * 86400000,
  },
  {
    id: "events",
    label: "#events",
    match: (h) => !!h.isEvent && !h.isPopup,
  },
  {
    id: "popups",
    label: "#popups",
    match: (h) => !!h.isPopup,
  },
  {
    id: "music",
    label: "#music",
    match: (h) =>
      !h.isPopup &&
      (typeStr(h).includes("music") ||
        typeStr(h).includes("concert") ||
        typeStr(h).includes("dj") ||
        typeStr(h).includes("jazz") ||
        typeStr(h).includes("live")),
  },
  {
    id: "rooftop",
    label: "#rooftop",
    match: (h) => !h.isPopup && typeStr(h).includes("rooftop"),
  },
  {
    id: "lounge",
    label: "#lounge",
    match: (h) => !h.isEvent && !h.isPopup && typeStr(h).includes("lounge"),
  },
  {
    id: "sports",
    label: "#sports",
    match: (h) =>
      !h.isPopup &&
      (typeStr(h).includes("sport") ||
        typeStr(h).includes("game") ||
        typeStr(h).includes("watch")),
  },
  {
    id: "cocktails",
    label: "#cocktails",
    match: (h) =>
      !h.isEvent &&
      !h.isPopup &&
      (typeStr(h).includes("cocktail") ||
        typeStr(h).includes("mixology") ||
        typeStr(h).includes("craft")),
  },
  {
    id: "hookah",
    label: "#hookah",
    match: (h) => !h.isPopup && typeStr(h).includes("hookah"),
  },
  {
    id: "brunch",
    label: "#brunch",
    match: (h) => !h.isPopup && typeStr(h).includes("brunch"),
  },
  {
    id: "outdoor",
    label: "#outdoor",
    match: (h) =>
      !h.isPopup &&
      (typeStr(h).includes("outdoor") ||
        typeStr(h).includes("patio") ||
        typeStr(h).includes("terrace") ||
        typeStr(h).includes("garden") ||
        typeStr(h).includes("park")),
  },
  {
    id: "dancing",
    label: "#dancing",
    match: (h) =>
      !h.isPopup &&
      (typeStr(h).includes("danc") ||
        typeStr(h).includes("nightclub") ||
        typeStr(h).includes("rave")),
  },
  {
    id: "latenight",
    label: "#latenight",
    match: (h) =>
      !h.isPopup &&
      (typeStr(h).includes("late") ||
        typeStr(h).includes("after") ||
        typeStr(h).includes("midnight")),
  },
  {
    id: "college",
    label: "#college",
    match: (h) =>
      !h.isPopup &&
      (typeStr(h).includes("college") ||
        typeStr(h).includes("university") ||
        typeStr(h).includes("campus")),
  },
  {
    id: "hidden",
    label: "#hidden",
    match: (h) =>
      !h.isEvent &&
      !h.isPopup &&
      (h.followersCount ?? 0) < 10 &&
      ([...(h.displayPosts ?? []), ...(h.posts ?? [])].length > 0),
  },
  {
    id: "trending",
    label: "#trending",
    match: (h) => (h.points ?? 0) > 0,
  },
  {
    id: "hottest",
    label: "#hottest",
    match: (h) => (h.followersCount ?? 0) > 0,
  },
  {
    id: "videos",
    label: "#videos",
    match: (h) => [...(h.displayPosts ?? []), ...(h.posts ?? [])].some(isVideo),
    postMatch: isVideo,
  },
];

const TABS: { id: Tab; label: string }[] = [
  { id: "all",      label: "All" },
  { id: "popular",  label: "Hot" },
  { id: "trending", label: "Top" },
  { id: "new",      label: "New" },
];

function BluePulseDot() {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.15, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, []);
  return <Animated.View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: "#1877F2", opacity }} />;
}

function PostMediaItem({ post, style }: { post: PostThumb; style?: object }) {
  if (post.mediaType === "video") {
    return (
      <Video
        source={{ uri: post.media }}
        style={[StyleSheet.absoluteFillObject, style]}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isMuted
        isLooping
      />
    );
  }
  return (
    <Image
      source={{ uri: post.media }}
      style={[StyleSheet.absoluteFillObject, style as any]}
      resizeMode="cover"
    />
  );
}

export default function PostsScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ view?: string }>();
  const view = (params.view === "world" ? "world" : "city") as "city" | "world";

  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(null);

  const { data: meData } = useQuery<{ me: any }>(ME_QUERY, { fetchPolicy: "cache-and-network" });
  const { data: allHotspotsData } = useQuery<{ allHotspots: any[] }>(ALL_HOTSPOTS, { fetchPolicy: "cache-and-network" });

  const me = meData?.me;
  const meId = me?.id as string | undefined;
  const pfp = me?.pfp as string | undefined;
  const initial = (me?.name as string | undefined)?.charAt(0) ?? "?";

  useEffect(() => {
    (async () => {
      try {
        const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const pos = await ExpoLocation.getCurrentPositionAsync({
          accuracy: ExpoLocation.Accuracy.Balanced,
        });
        setUserCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      } catch {}
    })();
  }, []);

  // All hotspots filtered by city radius when in city mode
  const allHotspots: any[] = useMemo(() => {
    const hotspots = allHotspotsData?.allHotspots ?? [];
    if (view === "world" || !userCoords) return hotspots;
    return hotspots.filter((h) => {
      const lat = h.location?.latitude;
      const lng = h.location?.longitude;
      if (!lat || !lng || (lat === 0 && lng === 0)) return true; // include if no coords available
      return haversineKm(userCoords.lat, userCoords.lon, lat, lng) <= RADIUS_KM;
    });
  }, [allHotspotsData, userCoords, view]);

  const computedScenes = useMemo<ComputedScene[]>(() => {
    return SCENES.map((def) => {
      const hotspots = allHotspots.filter(def.match);
      const seen = new Set<string>();
      const posts: PostThumb[] = [];
      let totalFollowers = 0;
      let totalPoints = 0;

      const H24 = 24 * 60 * 60 * 1000;
      for (const h of hotspots) {
        totalFollowers += h.followersCount ?? 0;
        totalPoints += h.points ?? 0;

        const now = Date.now();
        const hotspotActive =
          (h.posts ?? []).some((p: any) => p.createdAt && now - new Date(p.createdAt).getTime() < H24) ||
          (h.checkins ?? []).some((c: any) => c.createdAt && now - new Date(c.createdAt).getTime() < H24);

        const sources = [...(h.posts ?? []), ...(h.displayPosts ?? [])];
        for (const p of sources) {
          // Skip posts by the logged-in user
          if (p.author?.id && p.author.id === meId) continue;
          if (p.media && !seen.has(p.id) && (!def.postMatch || def.postMatch(p))) {
            seen.add(p.id);
            const ageMs = p.createdAt ? now - new Date(p.createdAt).getTime() : Infinity;
            posts.push({
              id: p.id,
              media: p.media,
              mediaType: isVideo(p) ? "video" : "image",
              hotspotId: h.id,
              hotspotName: h.name,
              hotspotAvatar: h.avatar,
              authorId: p.author?.id,
              authorPfp: p.author?.pfp,
              authorName: p.author?.name,
              isRecent: ageMs < 7 * 86400000,
              hotspotActive,
              lat: h.location?.latitude ?? undefined,
              lng: h.location?.longitude ?? undefined,
            });
          }
        }
      }

      const cover = hotspots[0]?.avatar ?? posts[0]?.media;
      return { def, hotspotCount: hotspots.length, totalFollowers, totalPoints, posts, cover };
    }).filter((s) => s.posts.length > 0 || s.hotspotCount > 0);
  }, [allHotspots, meId]);

  const sortedScenes = useMemo(() => {
    let list = computedScenes;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s) => s.def.label.includes(q));
    }
    switch (tab) {
      case "popular":  return [...list].sort((a, b) => b.totalFollowers - a.totalFollowers);
      case "trending": return [...list].sort((a, b) => b.totalPoints - a.totalPoints);
      case "new":      return [...list].reverse();
      default:         return list;
    }
  }, [computedScenes, tab, search]);

  const mapPosts = useMemo(() => {
    const seen = new Set<string>();
    const result: { postId: string; media: string; hotspotId: string; lat: number; lng: number; isActive: boolean }[] = [];
    for (const scene of sortedScenes) {
      for (const p of scene.posts) {
        if (!p.lat || !p.lng || (p.lat === 0 && p.lng === 0)) continue;
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        result.push({ postId: p.id, media: p.media, hotspotId: p.hotspotId, lat: p.lat, lng: p.lng, isActive: p.hotspotActive });
      }
    }
    return result;
  }, [sortedScenes]);

  return (
    <View style={{ flex: 1, justifyContent: "flex-end" }}>
      <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => router.back()} />
      <View style={{ height: SHEET_H, backgroundColor: C.bg, borderTopLeftRadius: 40, borderTopRightRadius: 40, overflow: "hidden", borderColor: C.border, borderWidth: StyleSheet.hairlineWidth }}>

        {/* ── Header ── */}
        <View
          style={[
            styles.topPanel,
            {
              paddingTop: 12,
              backgroundColor: C.bg,
            },
          ]}
        >
          <View style={styles.headerRow}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <BluePulseDot />
              <Text style={[styles.title, { color: C.txt }]}>posts</Text>
              {/* City/world badge */}
              
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <TouchableOpacity
                onPress={() => router.push("/(tabs)/profile" as any)}
                activeOpacity={0.82}
                style={[styles.pfpBtn, { backgroundColor: C.card2, borderColor: C.border2 }]}
              >
                {pfp ? (
                  <Image source={{ uri: pfp }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                ) : (
                  <Text style={{ color: C.txt, fontFamily: "Roobert-Bold", fontSize: 14 }}>{initial}</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { Haptics.selectionAsync(); router.back(); }}
                activeOpacity={0.82}
                style={[styles.iconBtn, { backgroundColor: C.card2, borderColor: C.border2 }]}
              >
                <X size={16} color={C.txt} strokeWidth={2} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.searchBar, { backgroundColor: '#111', borderColor: C.border }]}>
            <Search size={14} color={C.txt3} strokeWidth={2} />
            <TextInput
              placeholder="search..."
              placeholderTextColor={C.txt3}
              value={search}
              onChangeText={setSearch}
              style={[styles.searchInput, { color: C.txt }]}
            />
          </View>

          <View style={styles.tabsRow}>
            {TABS.map((t) => (
              <TouchableOpacity
                key={t.id}
                onPress={() => { Haptics.selectionAsync(); setTab(t.id); }}
                activeOpacity={0.82}
                style={[
                  styles.tabPill,
                  { flex: 1, backgroundColor: tab === t.id ? C.txt : '#000', borderColor: tab === t.id ? C.txt : C.border },
                ]}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 }}>
                  {tab === t.id && <BluePulseDot />}
                  <Text style={{ color: tab === t.id ? C.bg : '#fff', fontFamily: "Roobert-Bold", fontSize: 12 }}>
                    {t.label}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Content ── */}
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        >
          {/* Post map */}
         

          {/* Scene sections */}
          {sortedScenes.map((s) => (
            <View key={s.def.id} style={styles.sceneSection}>
              <View style={styles.sceneTitleRow}>
                <View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#fff" }} />
                    <Text style={[styles.sceneLabel, { color: C.txt }]}>{s.def.label}</Text>
                  </View>
                  <Text style={[styles.sceneMeta, { color: '#1877F2' }]}>
                    {s.posts.length} {s.posts.length === 1 ? "post" : "posts"}
                  </Text>
                </View>
                {(() => {
                  const seen = new Set<string>();
                  const authors: { id: string; pfp?: string; name?: string }[] = [];
                  for (const p of s.posts) {
                    if (p.authorId && !seen.has(p.authorId)) {
                      seen.add(p.authorId);
                      authors.push({ id: p.authorId, pfp: p.authorPfp, name: p.authorName });
                    }
                  }
                  const visible = authors.slice(0, 3);
                  const extra = authors.length - visible.length;
                  if (visible.length === 0) return null;
                  return (
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      {visible.map((a, i) => (
                        <View
                          key={a.id}
                          style={{
                            width: 28, height: 28, borderRadius: 14,
                            overflow: "hidden",
                            backgroundColor: C.card2,
                            borderWidth: 1.5,
                            borderColor: C.bg,
                            marginLeft: i === 0 ? 0 : -8,
                            zIndex: visible.length - i,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {a.pfp
                            ? <Image source={{ uri: a.pfp }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                            : <Text style={{ color: C.txt3, fontFamily: "Roobert-Bold", fontSize: 10 }}>{a.name?.charAt(0)}</Text>
                          }
                        </View>
                      ))}
                      {extra > 0 && (
                        <Text style={{ color: C.txt3, fontFamily: "Roobert-SemiBold", fontSize: 11, marginLeft: 6 }}>
                          +{extra}
                        </Text>
                      )}
                    </View>
                  );
                })()}
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 22, gap: 6, paddingBottom: 4 }}
              >
                {s.posts.slice(0, 8).map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    activeOpacity={0.82}
                    onPress={() => {
                      Haptics.selectionAsync();
                      const scenePosts = s.posts.filter((sp) => sp.media).map((sp) => ({
                        id: sp.id, media: sp.media, type: sp.mediaType,
                        authorId: sp.authorId ?? "", authorName: sp.authorName ?? "", authorPfp: sp.authorPfp,
                      }));
                      const idx = scenePosts.findIndex((sp) => sp.id === p.id);
                      router.push({ pathname: "/post/[id]", params: { id: p.id, posts: JSON.stringify(scenePosts), index: String(Math.max(0, idx)) } } as any);
                    }}
                    style={{ width: POST_THUMB_W }}
                  >
                    {p.hotspotActive ? (
                      <LinearGradient
                        colors={["#833AB4", "#1877F2", "#E1306C"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{ borderRadius: 14, padding: 2 }}
                      >
                        <View style={styles.postThumb}>
                          <PostMediaItem post={p} />
                          <LinearGradient colors={["transparent", "rgba(0,0,0,0.65)"]} style={StyleSheet.absoluteFillObject} />
                          {p.mediaType === "video" && (
                            <View style={styles.playIcon}><Play size={12} color="#fff" fill="#fff" /></View>
                          )}
                          {p.hotspotAvatar && (
                            <View style={styles.postThumbAvatar}>
                              <Image source={{ uri: p.hotspotAvatar }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                            </View>
                          )}
                          <Text style={styles.postThumbName} numberOfLines={1}>{p.hotspotName}</Text>
                        </View>
                      </LinearGradient>
                    ) : (
                      <View style={[styles.postThumb, { borderRadius: 12 }]}>
                        <PostMediaItem post={p} />
                        <LinearGradient colors={["transparent", "rgba(0,0,0,0.65)"]} style={StyleSheet.absoluteFillObject} />
                        {p.mediaType === "video" && (
                          <View style={styles.playIcon}><Play size={12} color="#fff" fill="#fff" /></View>
                        )}
                        {p.hotspotAvatar && (
                          <View style={styles.postThumbAvatar}>
                            <Image source={{ uri: p.hotspotAvatar }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                          </View>
                        )}
                        <Text style={styles.postThumbName} numberOfLines={1}>{p.hotspotName}</Text>
                      </View>
                    )}

                    {p.authorName && (
                      <View style={styles.authorRow}>
                        <View style={styles.authorAvatar}>
                          {p.authorPfp
                            ? <Image source={{ uri: p.authorPfp }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                            : <Text style={{ color: "#fff", fontFamily: "Roobert-Bold", fontSize: 7 }}>{p.authorName.charAt(0)}</Text>
                          }
                        </View>
                        <Text style={[styles.authorName, { color: 'white' }]} numberOfLines={1}>{p.authorName}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ))}

          {sortedScenes.length === 0 && (
            <View style={{ alignItems: "center", paddingTop: 80 }}>
              <Text style={{ color: C.txt3, fontFamily: "Roobert-Regular", fontSize: 14 }}>
                No posts found{view === "city" ? " near you" : ""}.
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topPanel: {
    paddingBottom: 4,
    zIndex: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    marginBottom: 12,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
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
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 22,
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 12,
    marginBottom: 2,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Roobert-Regular",
    fontSize: 13,
  },
  tabsRow: {
    flexDirection: "row",
    alignSelf: "center",
    width: SW * 0.7,
    gap: 6,
    marginVertical: 10,
    borderColor: "#111",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 40,
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  tabPill: {
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  section: {
    paddingTop: 20,
    paddingBottom: 4,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: "Roobert-Bold",
    fontSize: 17,
    letterSpacing: -0.4,
  },
  seeAll: {
    fontFamily: "Roobert-Regular",
    fontSize: 12,
  },
  sceneSection: {
    paddingTop: 22,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.07)",
    marginTop: 8,
  },
  sceneTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    marginBottom: 10,
  },
  sceneLabel: {
    fontFamily: "Roobert-Bold",
    fontSize: 20,
    gap: 4,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    letterSpacing: -0.6,
  },
  sceneMeta: {
    fontFamily: "Roobert-SemiBold",
    fontSize: 12,
    marginTop: 2,
  },
  postThumb: {
    height: 150,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
    justifyContent: "flex-end",
    padding: 8,
  },
  playIcon: {
    position: "absolute",
    top: 8,
    left: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  postThumbAvatar: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "#000",
  },
  postThumbName: {
    fontFamily: "Roobert-SemiBold",
    fontSize: 10,
    color: "#fff",
    letterSpacing: -0.2,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 5,
    paddingHorizontal: 2,
  },
  authorAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
    alignItems: "center",
    justifyContent: "center",
  },
  authorName: {
    fontFamily: "Roobert-SemiBold",
    fontSize: 10,
    flex: 1,
  },
});
