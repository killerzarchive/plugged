import { FOLLOWING_CHECKINS, LEADERBOARD_HOTSPOTS, ME_QUERY } from "@/app/apollo/queries/general";
import { useQuery } from "@apollo/client/react";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
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
import { ArrowLeft, Clock, Flame, Users } from "lucide-react-native";
import { useColors } from "@/contexts/theme";

// ─── Types ────────────────────────────────────────────────────────────────────
interface CheckInItem {
  id: string; createdAt: string;
  user: { id: string; name: string; pfp?: string };
  hotspot: { id: string; name: string; avatar?: string; type?: string; location?: { address?: string } };
}
interface LeaderboardHotspot {
  id: string; name: string; avatar?: string; type?: string;
  checkins?: { id: string; createdAt?: string }[];
  location?: { address?: string };
}

type Mode = "friends" | "activity" | "time";

const MODES: { key: Mode; label: string; icon: any; desc: string }[] = [
  { key: "friends", label: "Friends",  icon: Users, desc: "Where your crew is checking in" },
  { key: "activity", label: "Trending", icon: Flame, desc: "Most check-ins right now" },
  { key: "time",    label: "Tonight",  icon: Clock, desc: "Best spots for the time of day" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function cutoff24h() { return Date.now() - 86_400_000; }
function cutoff7d()  { return Date.now() - 604_800_000; }

function getCityState(address?: string | null) {
  if (!address) return null;
  const parts = address.split(",").map(p => p.trim()).filter(Boolean);
  if (parts.length < 2) return parts[0] ?? null;
  return `${parts[parts.length - 2]}, ${parts[parts.length - 1].replace(/\d/g, "").trim()}`;
}

function timeLabel() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12)  return { label: "Morning spots", sub: "Good places to start your day" };
  if (h >= 12 && h < 17) return { label: "Afternoon spots", sub: "Places buzzing right now" };
  if (h >= 17 && h < 21) return { label: "Evening spots", sub: "Where people go after work" };
  return { label: "Night spots", sub: "Where to be after dark" };
}

// Tags that typically fit each time window
const TIME_TAGS: Record<string, string[]> = {
  morning:   ["cafe", "coffee", "breakfast", "brunch", "gym", "park"],
  afternoon: ["restaurant", "lunch", "mall", "shop", "market", "museum"],
  evening:   ["restaurant", "bar", "dinner", "rooftop", "lounge"],
  night:     ["bar", "club", "lounge", "nightclub", "rooftop", "late night"],
};

function getTimeTags() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12)  return TIME_TAGS.morning;
  if (h >= 12 && h < 17) return TIME_TAGS.afternoon;
  if (h >= 17 && h < 21) return TIME_TAGS.evening;
  return TIME_TAGS.night;
}

// ─── Vibe tag ─────────────────────────────────────────────────────────────────
type Vibe = "all" | "lit" | "mid" | "dead";

const VIBES: { key: Vibe; label: string; min: number; max: number }[] = [
  { key: "all",  label: "All",  min: 0,  max: Infinity },
  { key: "lit",  label: "Lit",  min: 10, max: Infinity },
  { key: "mid",  label: "Mid",  min: 3,  max: 9 },
  { key: "dead", label: "Dead", min: 0,  max: 2 },
];

function getVibe(count: number): Vibe {
  if (count >= 10) return "lit";
  if (count >= 3)  return "mid";
  return "dead";
}

function VibeTag({ vibe }: { vibe: Vibe }) {
  const C = useColors();
  const v = VIBES.find(v => v.key === vibe)!;
  return (
    <View style={{
      flexDirection: "row", alignItems: "center", gap: 4,
      backgroundColor: C.pill,
      borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3,
    }}>
      <Text style={{ color: C.txt2, fontFamily: "Roobert-Bold", fontSize: 11 }}>{v.label}</Text>
    </View>
  );
}

// ─── Suggestion card ──────────────────────────────────────────────────────────
function SuggestionCard({
  hotspot, reason, badge, rank, onPress,
}: {
  hotspot: { id: string; name: string; avatar?: string; type?: string; location?: { address?: string } };
  reason: string; badge?: string; rank?: number; onPress: () => void;
}) {
  const C = useColors();
  const city = getCityState(hotspot.location?.address);
  const initial = hotspot.name?.[0]?.toUpperCase() ?? "?";

  return (
    <TouchableOpacity
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
      activeOpacity={0.88}
      style={{
        backgroundColor: C.card, borderRadius: 20, overflow: "hidden",
        marginBottom: 10,
        shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
        elevation: 2,
      }}
    >
      {/* Cover */}
      <View style={{ height: 140 }}>
        {hotspot.avatar
          ? <Image source={{ uri: hotspot.avatar }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
          : <View style={{ flex: 1, backgroundColor: "#1C1C1E", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Roobert-Bold", fontSize: 56 }}>{initial}</Text>
            </View>
        }
        <View style={{ position: "absolute", inset: 0, top: "40%", backgroundColor: "rgba(0,0,0,0.55)" }} />

        {/* Rank badge */}
        {rank != null && (
          <View style={{ position: "absolute", top: 12, left: 12, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5 }}>
            <Text style={{ color: "#fff", fontFamily: "Roobert-Bold", fontSize: 13 }}>#{rank}</Text>
          </View>
        )}

        {/* Type chip */}
        {hotspot.type && (
          <View style={{ position: "absolute", top: 12, right: 12, backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5 }}>
            <Text style={{ color: "rgba(255,255,255,0.85)", fontFamily: "Roobert-Medium", fontSize: 11 }}>{hotspot.type}</Text>
          </View>
        )}

        {/* Name overlay */}
        <View style={{ position: "absolute", bottom: 12, left: 14, right: 14 }}>
          <Text style={{ color: "#fff", fontFamily: "Roobert-Bold", fontSize: 18, letterSpacing: -0.4 }} numberOfLines={1}>
            {hotspot.name}
          </Text>
          {city && (
            <Text style={{ color: "rgba(255,255,255,0.6)", fontFamily: "Roobert-Regular", fontSize: 12, marginTop: 1 }}>{city}</Text>
          )}
        </View>
      </View>

      {/* Reason row */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 12 }}>
        <Text style={{ color: C.txt2, fontFamily: "Roobert-Regular", fontSize: 13, flex: 1 }} numberOfLines={1}>
          {reason}
        </Text>
        {badge && (
          <View style={{ backgroundColor: C.pill, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4, marginLeft: 10 }}>
            <Text style={{ color: C.txt2, fontFamily: "Roobert-SemiBold", fontSize: 12 }}>{badge}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Friend avatars strip ─────────────────────────────────────────────────────
function FriendAvatars({ users }: { users: { pfp?: string; name: string }[] }) {
  const C = useColors();
  const shown = users.slice(0, 3);
  return (
    <View style={{ flexDirection: "row" }}>
      {shown.map((u, i) => (
        <View key={i} style={{
          width: 20, height: 20, borderRadius: 10, overflow: "hidden",
          borderWidth: 1.5, borderColor: C.card,
          marginLeft: i === 0 ? 0 : -6,
          backgroundColor: C.bg3,
        }}>
          {u.pfp
            ? <Image source={{ uri: u.pfp }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
            : <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: "#fff", fontSize: 8, fontFamily: "Roobert-Bold" }}>{u.name[0]}</Text>
              </View>
          }
        </View>
      ))}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function WhereToGoScreen() {
  const C = useColors();
  const [mode, setMode] = useState<Mode>("friends");
  const [vibeFilter, setVibeFilter] = useState<Vibe>("all");

  const { data: checkinsData, loading: checkinsLoading } =
    useQuery<{ followerRecentCheckins: CheckInItem[] }>(FOLLOWING_CHECKINS, {
      variables: { skip: 0, take: 100 },
      fetchPolicy: "cache-and-network",
    });

  const { data: leaderboardData, loading: leaderboardLoading } =
    useQuery<{ leaderboardHotspots: LeaderboardHotspot[] }>(LEADERBOARD_HOTSPOTS, {
      fetchPolicy: "cache-and-network",
    });

  const loading = checkinsLoading || leaderboardLoading;
  const tl = timeLabel();

  // ── Friends mode: group by hotspot, rank by friend check-in count ──
  const friendsSuggestions = useMemo(() => {
    const checkins = checkinsData?.followerRecentCheckins ?? [];
    const since = cutoff24h();
    const recent = checkins.filter(c => new Date(c.createdAt).getTime() >= since);
    const map = new Map<string, { hotspot: CheckInItem["hotspot"]; users: CheckInItem["user"][] }>();
    for (const c of recent) {
      const entry = map.get(c.hotspot.id) ?? { hotspot: c.hotspot, users: [] };
      if (!entry.users.find(u => u.id === c.user.id)) entry.users.push(c.user);
      map.set(c.hotspot.id, entry);
    }
    return [...map.values()]
      .sort((a, b) => b.users.length - a.users.length)
      .slice(0, 10);
  }, [checkinsData]);

  // ── Activity mode: top hotspots by 24h check-in count ──
  const activitySuggestions = useMemo(() => {
    const hotspots = leaderboardData?.leaderboardHotspots ?? [];
    const since = cutoff24h();
    return hotspots
      .map(h => ({
        hotspot: h,
        count: (h.checkins ?? []).filter(c => c.createdAt && new Date(c.createdAt).getTime() >= since).length,
      }))
      .sort((a, b) => b.count - a.count)
      .filter(h => h.count > 0)
      .slice(0, 10);
  }, [leaderboardData]);

  // ── Time mode: filter hotspots by type tags relevant to time of day ──
  const timeSuggestions = useMemo(() => {
    const hotspots = leaderboardData?.leaderboardHotspots ?? [];
    const tags = getTimeTags();
    const since = cutoff7d();
    const scored = hotspots.map(h => {
      const types = Array.isArray(h.type) ? (h.type as string[]) : [h.type ?? ""];
      const typeMatch = types.some(t => tags.some(tag => t.toLowerCase().includes(tag)));
      const count = (h.checkins ?? []).filter(c => c.createdAt && new Date(c.createdAt).getTime() >= since).length;
      return { hotspot: h, count, typeMatch };
    });
    // Sort: type matches first, then by check-in count
    return scored
      .sort((a, b) => {
        if (a.typeMatch && !b.typeMatch) return -1;
        if (!a.typeMatch && b.typeMatch) return 1;
        return b.count - a.count;
      })
      .slice(0, 10);
  }, [leaderboardData]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
      <StatusBar barStyle={C.statusBar} />

      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.card, alignItems: "center", justifyContent: "center" }}
          >
            <ArrowLeft size={18} color={C.primary} />
          </TouchableOpacity>
          <View>
            <Text style={{ color: C.primary, fontFamily: "Roobert-Bold", fontSize: 26, letterSpacing: -0.8 }}>
              Where to go?
            </Text>
          </View>
          <View style={{ marginLeft: "auto" }}>
            <Clock size={22} color={C.txt3} />
          </View>
        </View>

        {/* Mode pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {MODES.map(m => {
            const active = mode === m.key;
            const Icon = m.icon;
            return (
              <TouchableOpacity
                key={m.key}
                onPress={() => { Haptics.selectionAsync(); setMode(m.key); }}
                activeOpacity={0.8}
                style={{
                  flexDirection: "row", alignItems: "center", gap: 6,
                  paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22,
                  backgroundColor: active ? C.primary : C.card,
                }}
              >
                <Icon size={14} color={active ? "#fff" : C.secondary} />
                <Text style={{ color: active ? "#fff" : C.secondary, fontFamily: "Roobert-SemiBold", fontSize: 14 }}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Mode subtitle */}
        <Text style={{ color: C.secondary, fontFamily: "Roobert-Regular", fontSize: 14, marginTop: 12, marginBottom: 12 }}>
          {mode === "time" ? tl.sub : MODES.find(m => m.key === mode)!.desc}
        </Text>

        {/* Vibe filter */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          {VIBES.map(v => {
            const active = vibeFilter === v.key;
            return (
              <TouchableOpacity
                key={v.key}
                onPress={() => { Haptics.selectionAsync(); setVibeFilter(v.key); }}
                activeOpacity={0.8}
                style={{
                  flexDirection: "row", alignItems: "center", gap: 5,
                  paddingHorizontal: 13, paddingVertical: 7, borderRadius: 20,
                  backgroundColor: active ? C.accent : C.card,
                }}
              >
                <Text style={{ color: active ? C.accentInv : C.txt2, fontFamily: "Roobert-SemiBold", fontSize: 13 }}>{v.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={C.secondary} size="large" />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
        >
          {/* ── Friends mode ── */}
          {mode === "friends" && (() => {
            const filtered = friendsSuggestions.filter(item => {
              if (vibeFilter === "all") return true;
              return getVibe(item.users.length) === vibeFilter;
            });
            return filtered.length === 0
              ? <EmptyState title="No spots match" sub="Try a different vibe filter or follow more people." />
              : filtered.map((item, i) => (
                  <View key={item.hotspot.id}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4, paddingHorizontal: 2 }}>
                      <VibeTag vibe={getVibe(item.users.length)} />
                    </View>
                    <SuggestionCard
                      hotspot={item.hotspot}
                      rank={i + 1}
                      reason={
                        item.users.length === 1
                          ? `${item.users[0].name} checked in`
                          : `${item.users[0].name} + ${item.users.length - 1} friend${item.users.length > 2 ? "s" : ""} checked in`
                      }
                      badge={`${item.users.length} friend${item.users.length !== 1 ? "s" : ""}`}
                      onPress={() => router.push(`/profile-view?type=hotspot&id=${item.hotspot.id}` as any)}
                    />
                  </View>
                ));
          })()}

          {/* ── Activity mode ── */}
          {mode === "activity" && (() => {
            const filtered = activitySuggestions.filter(item => {
              if (vibeFilter === "all") return true;
              return getVibe(item.count) === vibeFilter;
            });
            return filtered.length === 0
              ? <EmptyState title="No spots match" sub="Try a different vibe or check back soon." />
              : filtered.map((item, i) => (
                  <View key={item.hotspot.id}>
                    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4, paddingHorizontal: 2 }}>
                      <VibeTag vibe={getVibe(item.count)} />
                    </View>
                    <SuggestionCard
                      hotspot={item.hotspot}
                      rank={i + 1}
                      reason={`${item.count} check-in${item.count !== 1 ? "s" : ""} in the last 24 hours`}
                      badge={`${item.count} today`}
                      onPress={() => router.push(`/profile-view?type=hotspot&id=${item.hotspot.id}` as any)}
                    />
                  </View>
                ));
          })()}

          {/* ── Time mode ── */}
          {mode === "time" && (() => {
            const filtered = timeSuggestions.filter(item => {
              if (vibeFilter === "all") return true;
              return getVibe(item.count) === vibeFilter;
            });
            return filtered.length === 0
              ? <EmptyState title="Nothing found" sub="Try a different vibe filter or mode." />
              : filtered.map((item, i) => (
                  <View key={item.hotspot.id}>
                    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4, paddingHorizontal: 2 }}>
                      <VibeTag vibe={getVibe(item.count)} />
                    </View>
                    <SuggestionCard
                      hotspot={item.hotspot}
                      rank={i + 1}
                      reason={
                        item.typeMatch
                          ? `Good pick for ${tl.label.toLowerCase()}`
                          : `${item.count} check-ins this week`
                      }
                      badge={item.typeMatch ? tl.label : undefined}
                      onPress={() => router.push(`/profile-view?type=hotspot&id=${item.hotspot.id}` as any)}
                    />
                  </View>
                ));
          })()}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function EmptyState({ title, sub }: { title: string; sub: string }) {
  const C = useColors();
  return (
    <View style={{ paddingTop: 80, alignItems: "center", paddingHorizontal: 40 }}>
      <Flame size={40} color={C.txt3} style={{ marginBottom: 16 }} />
      <Text style={{ color: C.txt, fontFamily: "Roobert-Bold", fontSize: 20, textAlign: "center" }}>{title}</Text>
      <Text style={{ color: C.txt3, fontFamily: "Roobert-Regular", fontSize: 15, marginTop: 8, textAlign: "center", lineHeight: 22 }}>{sub}</Text>
    </View>
  );
}
