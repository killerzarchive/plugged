import { MY_NOTIFICATIONS } from "@/app/apollo/queries/general";
import { MARK_NOTIFICATIONS_READ } from "@/app/apollo/mutations/app";
import { useColors } from "@/contexts/theme";
import { useMutation, useQuery } from "@apollo/client/react";
import {
  Bell,
  FileText,
  Flame,
  MapPin,
  Megaphone,
  UserPlus,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// ─── Types ────────────────────────────────────────────────────────────────────
type NotifType = "NEW_FOLLOWER" | "CHECKIN" | "PSA" | "NEW_POST" | "TRENDING";

interface Notification {
  id: string;
  createdAt: string;
  read: boolean;
  type: NotifType;
  message: string;
  actorId?: string;
  hotspotId?: string;
  postId?: string;
  actor?: { id: string; name: string; pfp?: string };
  hotspot?: { id: string; name: string; avatar?: string };
}

interface NotifData {
  myNotifications: Notification[];
  unreadNotificationCount: number;
}

type FilterKey = "All" | "Check-ins" | "Followers" | "Alerts" | "Posts";

const FILTERS: { key: FilterKey; types?: NotifType[] }[] = [
  { key: "All" },
  { key: "Check-ins", types: ["CHECKIN"] },
  { key: "Followers", types: ["NEW_FOLLOWER"] },
  { key: "Alerts", types: ["PSA", "TRENDING"] },
  { key: "Posts", types: ["NEW_POST"] },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function sectionLabel(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 86400) return "Today";
  if (diff < 172800) return "Yesterday";
  if (diff < 604800) return "This Week";
  return "Earlier";
}

function notifIcon(type: NotifType) {
  switch (type) {
    case "NEW_FOLLOWER":
      return UserPlus;
    case "CHECKIN":
      return MapPin;
    case "PSA":
      return Megaphone;
    case "NEW_POST":
      return FileText;
    case "TRENDING":
      return Flame;
    default:
      return Bell;
  }
}

// ─── Notification row ─────────────────────────────────────────────────────────
function NotifRow({
  notif,
  onPress,
}: {
  notif: Notification;
  onPress: () => void;
}) {
  const C = useColors();
  const Icon = notifIcon(notif.type);
  const avatar = notif.actor?.pfp ?? notif.hotspot?.avatar;

  return (
    <TouchableOpacity
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      activeOpacity={0.7}
      style={[styles.row, { backgroundColor: notif.read ? C.bg : C.bg2 }]}
    >
      {/* Unread left bar */}
    

      {/* Avatar */}
      <View style={styles.avatarWrap}>
        {avatar ? (
          <View style={[styles.avatarCircle, { backgroundColor: C.bg3 }]}>
            <Image
              source={{ uri: avatar }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
            />
          </View>
        ) : (
          <View style={[styles.avatarCircle, { backgroundColor: C.bg3 }]}>
            <Icon size={22} color={C.txt2} strokeWidth={1.5} />
          </View>
        )}
        {/* Type badge */}
        <View
          style={[
            styles.typeBadge,
            { backgroundColor: C.bg, borderColor: C.bg },
          ]}
        >
          <View
            style={[
              styles.typeBadgeInner,
              { backgroundColor: notif.read ? C.bg3 : C.txt },
            ]}
          >
            <Icon size={9} color={notif.read ? C.txt2 : C.bg} strokeWidth={2} />
          </View>
        </View>
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        <Text style={[styles.message, { color: C.txt }]} numberOfLines={2}>
          {notif.message}
        </Text>
        {notif.hotspot && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              marginTop: 3,
            }}
          >
            <MapPin size={10} color={C.txt3} />
            <Text
              style={[styles.hotspotName, { color: C.txt3 }]}
              numberOfLines={1}
            >
              {notif.hotspot.name}
            </Text>
          </View>
        )}
        <Text style={[styles.timeText, { color: C.txt3 }]}>
          {timeAgo(notif.createdAt)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHead({ label }: { label: string }) {
  const C = useColors();
  return (
    <View style={[styles.sectionHead, { backgroundColor: C.bg }]}>
      <Text style={[styles.sectionLabel, { color: C.txt3 }]}>{label}</Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function NotificationsScreen() {
  const C = useColors();
  const { data, loading, error, refetch } = useQuery<NotifData>(
    MY_NOTIFICATIONS,
    {
      variables: { skip: 0, take: 50 },
      fetchPolicy: "cache-and-network",
    },
  );
  const [markRead] = useMutation(MARK_NOTIFICATIONS_READ);
  const [activeFilter, setActiveFilter] = useState<FilterKey>("All");

  useEffect(() => {
    if (data?.unreadNotificationCount && data.unreadNotificationCount > 0) {
      markRead().catch(() => {});
    }
  }, [data?.unreadNotificationCount]);

  function handlePress(notif: Notification) {
    if (notif.type === "NEW_FOLLOWER" && notif.actorId) {
      router.push(`/profile-view?type=user&id=${notif.actorId}` as any);
    } else if (notif.hotspotId) {
      router.push(`/profile-view?type=hotspot&id=${notif.hotspotId}` as any);
    } else if (notif.postId) {
      router.push(`/post/${notif.postId}` as any);
    }
  }

  const notifications = data?.myNotifications ?? [];
  const unread = data?.unreadNotificationCount ?? 0;

  const filteredNotifications = useMemo(() => {
    const filter = FILTERS.find((f) => f.key === activeFilter);
    if (!filter?.types) return notifications;
    return notifications.filter((n) => filter.types!.includes(n.type));
  }, [notifications, activeFilter]);

  const sectioned = useMemo(() => {
    const groups: Record<string, Notification[]> = {};
    const ORDER = ["Today", "Yesterday", "This Week", "Earlier"];
    for (const n of filteredNotifications) {
      const label = sectionLabel(n.createdAt);
      if (!groups[label]) groups[label] = [];
      groups[label].push(n);
    }
    const items: Array<
      { type: "header"; label: string } | { type: "item"; notif: Notification }
    > = [];
    for (const label of ORDER) {
      if (!groups[label]?.length) continue;
      items.push({ type: "header", label });
      for (const n of groups[label]) items.push({ type: "item", notif: n });
    }
    return items;
  }, [filteredNotifications]);

  const Header = (
    <View>
      {/* Title row */}
      <View style={styles.titleRow}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View className="flex flex-row items-center gap-3">
            <View className="w-2 h-2 rounded-full bg-white" />
            <Text style={[styles.title, { color: C.txt }]}>Activity</Text>
          </View>
         
        </View>
      </View>

      {/* Unread banner */}
      {unread > 0 && (
        <View style={[styles.banner, { backgroundColor: C.txt }]}>
          <View style={[styles.bannerDot, { backgroundColor: C.bg }]} />
          <Text
            style={{
              color: C.bg,
              fontFamily: "Roobert-SemiBold",
              fontSize: 13,
              flex: 1,
            }}
          >
            {unread} unread notification{unread !== 1 ? "s" : ""}
          </Text>
          <TouchableOpacity
            onPress={() => markRead().catch(() => {})}
            activeOpacity={0.7}
          >
            <Text
              style={{
                color: C.bg,
                fontFamily: "Roobert-Bold",
                fontSize: 12,
                opacity: 0.6,
              }}
            >
              Mark all read
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {FILTERS.map((f) => {
          const active = activeFilter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              onPress={() => {
                Haptics.selectionAsync();
                setActiveFilter(f.key);
              }}
              activeOpacity={0.75}
              style={[
                styles.filterChip,
                { backgroundColor: active ? C.txt : C.bg2 },
              ]}
            >
              <Text
                style={{
                  color: active ? C.bg : C.txt2,
                  fontFamily: active ? "Roobert-Bold" : "Roobert-Medium",
                  fontSize: 13,
                }}
              >
                {f.key}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
      <StatusBar barStyle={C.statusBar} backgroundColor={C.bg} />

      {loading && notifications.length === 0 ? (
        <>
          {Header}
          <View
            style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
          >
            <ActivityIndicator color={C.txt3} />
          </View>
        </>
      ) : error ? (
        <>
          {Header}
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 40,
            }}
          >
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
        </>
      ) : (
        <FlatList
          data={sectioned}
          keyExtractor={(item) =>
            item.type === "header" ? `h-${item.label}` : `n-${item.notif.id}`
          }
          ListHeaderComponent={Header}
          ListEmptyComponent={
            <View
              style={{
                paddingTop: 80,
                alignItems: "center",
                paddingHorizontal: 40,
              }}
            >
           
              <Text
                style={{
                  color: C.txt,
                  fontFamily: "Roobert-Bold",
                  fontSize: 20,
                  textAlign: "center",
                  marginTop: 20,
                }}
              >
                All caught up
              </Text>
              <Text
                style={{
                  color: C.txt3,
                  fontFamily: "Roobert-Regular",
                  fontSize: 14,
                  marginTop: 8,
                  textAlign: "center",
                  lineHeight: 22,
                }}
              >
                {activeFilter === "All"
                  ? "Activity from people and places you follow will show up here."
                  : `No ${activeFilter.toLowerCase()} notifications yet.`}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            if (item.type === "header")
              return <SectionHead label={item.label} />;
            return (
              <NotifRow
                notif={item.notif}
                onPress={() => handlePress(item.notif)}
              />
            );
          }}
          onRefresh={refetch}
          refreshing={loading}
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          bounces
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
  },
  title: {
    fontFamily: "Roobert-Bold",
    fontSize: 22,
    letterSpacing: -0.8,
  },
  unreadBadge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  filterRow: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 22,
  },
  sectionHead: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  sectionLabel: {
    fontFamily: "Roobert-Bold",
    fontSize: 13,
    letterSpacing: -0.2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 14,
    position: "relative",
  },
  unreadBar: {
    position: "absolute",
    left: 0,
    top: 10,
    bottom: 10,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  avatarWrap: {
    position: "relative",
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  typeBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    borderRadius: 10,
    borderWidth: 2,
  },
  typeBadgeInner: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  message: {
    fontFamily: "Roobert-Medium",
    fontSize: 14,
    lineHeight: 20,
  },
  hotspotName: {
    fontFamily: "Roobert-Regular",
    fontSize: 12,
  },
  timeText: {
    fontFamily: "Roobert-Regular",
    fontSize: 12,
    marginTop: 4,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
  },
  bannerDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
});
