import {
  ALL_HOTSPOTS,
  ALL_POPUPS,
  FOLLOWING_CHECKINS,
  ME_QUERY,
} from "@/app/apollo/queries/general";
import { Avatar } from "@/components/ui/Avatar";
import DateTimeInput from "@/components/ui/DateTimeInput";
import LivePulse from "@/components/ui/LivePulse";
import { DARK_MAP_STYLE } from "@/constants/mapStyle";
import { useColors } from "@/contexts/theme";
import { useMedals } from "@/hooks/useMedals";
import { getCityState } from "@/lib/address";
import { pickHotspotImage, uploadHotspotImage } from "@/lib/uploadHotspotImage";
import { pickPostMedia, uploadPostMedia } from "@/lib/uploadPostMedia";
import { useMutation, useQuery } from "@apollo/client/react";
import { Ionicons } from "@expo/vector-icons";
import { ResizeMode, Video } from "expo-av";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import {
  ArrowRight,
  Bell,
  Bookmark,
  CalendarPlus,
  Camera,
  Check,
  ChevronRight,
  Eye,
  Heart,
  ImageIcon,
  MapPin,
  Maximize2,
  MessageCircle,
  Minimize2,
  MoreHorizontal,
  Navigation,
  Plus,
  Search,
  Send,
  Users,
  X,
  XCircle,
  Zap
} from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Animated as RNAnimated,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CREATE_CHECKIN,
  CREATE_EVENT,
  CREATE_HOTSPOT,
  CREATE_POPUP,
  CREATE_POST,
  LIKE_POST,
  UNLIKE_POST,
} from "../apollo/mutations/app";

const { width: W, height: SCREEN_H } = Dimensions.get("window");
const MAP_H = SCREEN_H * 0.5;
const CARD_W = W * 0.58;

// Module-level geocode cache — survives tab switches and re-renders
const geocodeCache = new Map<string, { lat: number; lng: number }>();

// ─── Types ────────────────────────────────────────────────────────────────────
interface CheckInItem {
  id: string;
  createdAt: string;
  user: { id: string; name: string; pfp?: string };
  hotspot: {
    id: string;
    name: string;
    avatar?: string;
    location?: { latitude?: number; longitude?: number; address?: string };
  };
}
interface PostItem {
  id: string;
  title: string;
  content?: string;
  media?: string;
  type?: string;
  createdAt: string;
  likesCount: number;
  isLikedByMe?: boolean;
  viewsCount?: number;
  author: { id: string; name: string; pfp?: string };
  hotspot?: { id: string; name: string; type?: string; avatar?: string };
}
export interface MeQueryData {
  me: {
    id: string;
    name: string;
    pfp?: string;
    points?: number;
    location?: { address?: string };
    following: { id: string; name: string; pfp?: string; posts?: any[] }[];
    followingHotspots: FollowingHotspot[];
    followingEventHotspots: FollowingHotspot[];
  };
}
interface FollowingHotspot {
  id: string;
  name: string;
  avatar?: string;
  displayPosts?: { id: string; media?: string }[];
  posts?: {
    id: string;
    media?: string;
    createdAt: string;
    title: string;
    author: { id: string; name: string; pfp?: string };
  }[];
  checkins?: { id: string }[];
  location?: { latitude?: number; longitude?: number; address?: string };
  ratings?: number;
  type?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isVideo(uri: string): boolean {
  return /\.(mp4|mov|m4v|webm|m3u8)(\?|$)/i.test(uri);
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function popupTimeLabel(startIso: string, endIso?: string): string {
  const now = Date.now();
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : null;
  if (end && now >= start && now < end) {
    const rem = Math.max(0, end - now);
    const h = Math.floor(rem / 3600000);
    const m = Math.floor((rem % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
  }
  const diff = start - now;
  if (diff <= 0) return "live now";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return h > 0 ? `starts in ${h}h ${m}m` : `starts in ${m}m`;
}

const THREE_HOURS = 3 * 60 * 60 * 1000;

type CategoryKey = null | "Bar" | "Club" | "Restaurant" | "Event";
const CATEGORIES: { key: CategoryKey; label: string }[] = [
  { key: null, label: "All" },
  { key: "Bar", label: "Bars" },
  { key: "Club", label: "Clubs" },
  { key: "Restaurant", label: "Food" },
  { key: "Event", label: "Events" },
];

// ─── Category chip ────────────────────────────────────────────────────────────
function CategoryChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.chip,
        { backgroundColor: active ? "#fff" : "rgba(0,0,0,0.6)" },
      ]}
    >
      <Text
        style={{
          color: active ? "#000" : "#fff",
          fontFamily: active ? "Roobert-Bold" : "Roobert-Medium",
          fontSize: 13,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;

function getActivityStatus(recentCount: number): {
  color: string;
  label: string;
} {
  if (recentCount === 0) return { color: "#EF4444", label: "Dead" };
  if (recentCount <= 3) return { color: "#3B82F6", label: "Steady" };
  if (recentCount <= 8) return { color: "#833AB4", label: "Active" };
  return { color: "#E1306C", label: "Poppin'" };
}

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
      }}
    />
  );
}

function ActivityPill({ recentCount }: { recentCount: number }) {
  const { color, label } = getActivityStatus(recentCount);
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingRight: 10,
        paddingVertical: 5,
        borderRadius: 20,
      }}
    >
      <PulseDot color={color} size={6} />
      <Text
        style={{
          color,
          fontFamily: "Roobert-SemiBold",
          fontSize: 11,
          letterSpacing: -0.1,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

// ─── Instagram-style story ring + viewer ─────────────────────────────────────
function StoryModal({
  hotspot,
  onClose,
}: {
  hotspot: FollowingHotspot;
  onClose: () => void;
}) {
  const recentPosts = (hotspot.posts ?? []).filter(
    (p) => Date.now() - new Date(p.createdAt).getTime() < DAY_MS && p.media,
  );
  const [idx, setIdx] = useState(0);

  if (!recentPosts.length) return null;
  const post = recentPosts[idx];

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        {/* Progress bars */}
        <View
          style={{
            flexDirection: "row",
            gap: 4,
            position: "absolute",
            top: 52,
            left: 12,
            right: 12,
            zIndex: 10,
          }}
        >
          {recentPosts.map((_, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: 2.5,
                borderRadius: 2,
                backgroundColor: i <= idx ? "#fff" : "rgba(255,255,255,0.3)",
              }}
            />
          ))}
        </View>
        {/* Header */}
        <View
          style={{
            position: "absolute",
            top: 64,
            left: 16,
            right: 16,
            zIndex: 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              overflow: "hidden",
              backgroundColor: "#222",
            }}
          >
            {hotspot.avatar ? (
              <Image
                source={{ uri: hotspot.avatar }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="cover"
              />
            ) : null}
          </View>
          <Text
            style={{
              color: "#fff",
              fontFamily: "Roobert-SemiBold",
              fontSize: 13,
              flex: 1,
            }}
          >
            {hotspot.name}
          </Text>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
            <X size={22} color="#fff" />
          </TouchableOpacity>
        </View>
        {/* Story image */}
        {post.media ? (
          <Image
            source={{ uri: post.media }}
            style={{ flex: 1 }}
            resizeMode="cover"
          />
        ) : (
          <View
            style={{
              flex: 1,
              backgroundColor: "#111",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                color: "#fff",
                fontFamily: "Roobert-Bold",
                fontSize: 16,
                paddingHorizontal: 24,
                textAlign: "center",
              }}
            >
              {post.title}
            </Text>
          </View>
        )}
        {/* Tap zones */}
        <TouchableOpacity
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: "40%",
          }}
          onPress={() => setIdx((i) => Math.max(0, i - 1))}
          activeOpacity={1}
        />
        <TouchableOpacity
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            width: "60%",
          }}
          onPress={() => {
            if (idx < recentPosts.length - 1) setIdx((i) => i + 1);
            else onClose();
          }}
          activeOpacity={1}
        />
      </View>
    </Modal>
  );
}

function HotspotStoryRing({
  hotspot,
  recentCheckinCount,
  size = 56,
}: {
  hotspot: FollowingHotspot;
  recentCheckinCount: number;
  size?: number;
}) {
  const [storyOpen, setStoryOpen] = useState(false);
  const recentPosts = (hotspot.posts ?? []).filter(
    (p) => Date.now() - new Date(p.createdAt).getTime() < DAY_MS && p.media,
  );
  const hasPosts = recentPosts.length > 0;
  const hasCheckins = recentCheckinCount > 0;
  const isActive = hasPosts || hasCheckins;

  const ringColor = isActive ? "#E1306C" : "#2a2a2a";

  return (
    <>
      <TouchableOpacity
        activeOpacity={hasPosts ? 0.8 : 1}
        onPress={() => {
          if (hasPosts) setStoryOpen(true);
        }}
      >
        <LinearGradient
          colors={
            isActive
              ? ["#833AB4", "#1877F2", "#833AB4"]
              : ["#2a2a2a", "#2a2a2a"]
          }
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
          style={{
            width: size + 6,
            height: size + 6,
            borderRadius: (size + 6) / 2,
            padding: 2.5,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
              overflow: "hidden",
              borderWidth: 2.5,
              borderColor: "#000",
            }}
          >
            {hotspot.avatar ? (
              <Image
                source={{ uri: hotspot.avatar }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="cover"
              />
            ) : (
              <View
                style={{
                  flex: 1,
                  backgroundColor: "#1a1a1a",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MapPin size={18} color="#fff" />
              </View>
            )}
          </View>
        </LinearGradient>
        {/* Check-in count badge */}
        {hasCheckins && (
          <View
            style={{
              position: "absolute",
              bottom: -2,
              right: -2,
              backgroundColor: "#fff",
              borderRadius: 10,
              minWidth: 18,
              height: 18,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 4,
              borderWidth: 1.5,
              borderColor: "#000",
            }}
          >
            <Text
              style={{ color: "#000", fontFamily: "Roobert-Bold", fontSize: 9 }}
            >
              {recentCheckinCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>
      {storyOpen && (
        <StoryModal hotspot={hotspot} onClose={() => setStoryOpen(false)} />
      )}
    </>
  );
}

// ─── Map pin — hotspot avatar body + single user pfp at top ──────────────────
function FriendPin({ checkin }: { checkin: CheckInItem }) {
  const { user, hotspot } = checkin;
  return (
    <View style={styles.clusterWrap}>
      {/* User pfp — sits above the hotspot card */}
      <View style={styles.clusterPfpRow}>
        <View style={styles.clusterPfp}>
          {user.pfp ? (
            <Image
              source={{ uri: user.pfp }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
            />
          ) : (
            <Text
              style={{ color: "#fff", fontFamily: "Roobert-Bold", fontSize: 9 }}
            >
              {user.name.charAt(0)}
            </Text>
          )}
        </View>
      </View>
      {/* Hotspot avatar card */}
      <View style={styles.clusterCard}>
        {hotspot.avatar ? (
          <Image
            source={{ uri: hotspot.avatar }}
            style={{ width: "100%", height: "100%", borderRadius: 12 }}
            resizeMode="cover"
          />
        ) : (
          <MapPin size={18} color="#fff" />
        )}
        <View style={styles.clusterNameBar}>
          <Text style={styles.clusterName} numberOfLines={1}>
            {hotspot.name}
          </Text>
        </View>
      </View>
      <View style={styles.clusterTail} />
    </View>
  );
}

// ─── Followed hotspot pin — circle avatar + triangle point ───────────────────
function FollowedHotspotPin({
  hotspot,
  selected,
}: {
  hotspot: FollowingHotspot;
  selected?: boolean;
}) {
  return (
    <View style={styles.hotspotPinWrap}>
      <View
        style={[
          styles.hotspotPinCircle,
          selected && { borderWidth: 3, borderColor: "#fff" },
        ]}
      >
        {hotspot.avatar ? (
          <Image
            source={{ uri: hotspot.avatar }}
            style={{ width: "100%", height: "100%", borderRadius: 999 }}
            resizeMode="cover"
          />
        ) : (
          <MapPin size={16} color="#fff" />
        )}
      </View>
      <View style={styles.hotspotPinTriangle} />
    </View>
  );
}

// ─── Popup map pin ────────────────────────────────────────────────────────────
function PopupPin({ popup }: { popup: any }) {
  return (
    <View style={styles.hotspotPinWrap}>
      <View
        style={[
          styles.hotspotPinCircle,
          { borderWidth: 2, borderColor: "#1877F2" },
        ]}
      >
        {popup.avatar ? (
          <Image
            source={{ uri: popup.avatar }}
            style={{ width: "100%", height: "100%", borderRadius: 999 }}
            resizeMode="cover"
          />
        ) : (
          <Zap size={14} color="#1877F2" strokeWidth={2} />
        )}
      </View>
      <View
        style={[styles.hotspotPinTriangle, { backgroundColor: "#1877F2" }]}
      />
    </View>
  );
}

// ─── Hotspot carousel card (explore-style) ───────────────────────────────────
function HotspotCarouselCard({
  hotspot,
  recentCount,
  onPress,
  onCheckIn,
}: {
  hotspot: FollowingHotspot;
  recentCount: number;
  onPress: () => void;
  onCheckIn?: () => void;
}) {
  const C = useColors();
  const cover = hotspot.avatar ?? hotspot.displayPosts?.[0]?.media;
  const { color, label } = getActivityStatus(recentCount);
  const mediaPosts = (hotspot.posts ?? []).filter((p) => p.media);
  const visiblePosts = mediaPosts.slice(0, 3);
  const overflow = mediaPosts.length - 3;

  return (
    <View style={{ width: W, paddingHorizontal: 15 }}>
      <View
        style={[
          styles.detailCard,
          { backgroundColor: C.bg, borderColor: C.border },
        ]}
      >
        {/* Top row: avatar + name + activity + stacked thumbnails */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              flex: 1,
              marginRight: 8,
            }}
          >
            <LinearGradient
              colors={
                recentCount > 0
                  ? ["#833AB4", "#1877F2", "#833AB4"]
                  : ["#1a1a1a", "#1a1a1a"]
              }
              start={{ x: 0, y: 1 }}
              end={{ x: 1, y: 0 }}
              style={{
                width: 50,
                height: 50,
                borderRadius: 30,
                padding: 2.5,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <View
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: 28,
                  overflow: "hidden",
                  borderWidth: 2,
                  borderColor: C.bg,
                  backgroundColor: C.bg3,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {cover ? (
                  <Image
                    source={{ uri: cover }}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="cover"
                  />
                ) : (
                  <MapPin size={16} color={C.txt2} strokeWidth={1.5} />
                )}
              </View>
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: C.txt,
                  fontFamily: "Roobert-Bold",
                  fontSize: 18,
                  letterSpacing: -0.6,
                  lineHeight: 24,
                }}
                numberOfLines={1}
              >
                {hotspot.name}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 3,
                  flexWrap: "wrap",
                }}
              >
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                >
                  <PulseDot color={color} size={6} />
                  <Text
                    style={{ color, fontFamily: "Roobert-Bold", fontSize: 11 }}
                  >
                    {label}
                  </Text>
                </View>
                {hotspot.type && (
                  <Text
                    style={{
                      color: "#fff",
                      fontFamily: "Roobert-SemiBold",
                      fontSize: 11,
                    }}
                  >
                    {hotspot.type}
                  </Text>
                )}
              </View>
            </View>
          </View>
          {visiblePosts.length > 0 && (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              {visiblePosts.map((post, i) => (
                <View
                  key={post.id}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    overflow: "hidden",
                    backgroundColor: C.bg3,
                    borderWidth: 4,
                    borderColor: C.bg,
                    marginLeft: i === 0 ? 0 : -12,
                    zIndex: 3 - i,
                  }}
                >
                  {isVideo(post.media!) ? (
                    <Video
                      source={{ uri: post.media! }}
                      style={{ width: "100%", height: "100%" }}
                      resizeMode={ResizeMode.COVER}
                      shouldPlay
                      isLooping
                      isMuted
                    />
                  ) : (
                    <Image
                      source={{ uri: post.media! }}
                      style={{ width: "100%", height: "100%" }}
                      resizeMode="cover"
                    />
                  )}
                </View>
              ))}
              {overflow > 0 && (
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: C.bg3,
                    borderWidth: 4,
                    borderColor: C.bg,
                    marginLeft: -12,
                    zIndex: 0,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      color: C.txt2,
                      fontFamily: "Roobert-Bold",
                      fontSize: 11,
                    }}
                  >
                    +{overflow}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Location row */}
        <TouchableOpacity
          onPress={onCheckIn}
          activeOpacity={0.82}
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 10,
            paddingVertical: 6,
          }}
        >
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              backgroundColor: "#111",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Navigation size={15} color={C.txt} strokeWidth={1.5} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{ color: C.txt, fontFamily: "Roobert-Bold", fontSize: 15 }}
            >
              Location
            </Text>
            {hotspot.location?.address && (
              <Text
                numberOfLines={2}
                style={{
                  color: C.txt,
                  fontFamily: "Roobert-Medium",
                  fontSize: 11.5,
                  lineHeight: 16,
                  marginTop: 3,
                  marginRight: 70,
                }}
              >
                {hotspot.location.address}
              </Text>
            )}
          </View>
        </TouchableOpacity>

        {/* Navigate button */}
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.85}
          style={{
            position: "absolute",
            bottom: 19,
            right: 19,
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: "#fff",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ArrowRight size={18} color="#000" strokeWidth={2.5} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Popular card ─────────────────────────────────────────────────────────────
function PopularCard({
  hotspot,
  onPress,
}: {
  hotspot: any;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      style={{ alignItems: "center", gap: 6, width: 68 }}
    >
      <LinearGradient
        colors={["#833AB4", "#1877F2", "#833AB4"]}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0 }}
        style={{
          width: 60,
          height: 60,
          borderRadius: 30,
          padding: 2.5,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 28,
            overflow: "hidden",
            borderWidth: 2,
            borderColor: "#000",
          }}
        >
          {hotspot.avatar ? (
            <Image
              source={{ uri: hotspot.avatar }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
            />
          ) : (
            <View
              style={{
                flex: 1,
                backgroundColor: "#1a1a1a",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MapPin size={18} color="#fff" />
            </View>
          )}
        </View>
      </LinearGradient>
      <Text
        style={{
          color: "#fff",
          fontFamily: "Roobert-SemiBold",
          fontSize: 10,
          textAlign: "center",
        }}
        numberOfLines={1}
      >
        {hotspot.name}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Friends out tonight ──────────────────────────────────────────────────────
function FriendsOutNow({ checkins }: { checkins: CheckInItem[] }) {
  const C = useColors();
  const outNow = useMemo(() => {
    const cutoff = Date.now() - THREE_HOURS;
    const seen = new Set<string>();
    const result: CheckInItem[] = [];
    for (const c of checkins) {
      if (new Date(c.createdAt).getTime() >= cutoff && !seen.has(c.user.id)) {
        seen.add(c.user.id);
        result.push(c);
      }
    }
    return result.slice(0, 15);
  }, [checkins]);

  if (!outNow.length) return null;

  return (
    <View style={styles.section}>
      <View style={styles.sectionRow}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
          <LivePulse size={7} />
          <Text style={[styles.sectionTitle, { color: C.txt }]}>
            Out Tonight
          </Text>
        </View>
        <View style={[styles.countPill, { backgroundColor: C.bg3 }]}>
          <Text
            style={{ color: C.txt2, fontFamily: "Roobert-Bold", fontSize: 11 }}
          >
            {outNow.length}
          </Text>
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 14 }}
      >
        {outNow.map((c) => (
          <TouchableOpacity
            key={c.user.id}
            activeOpacity={0.75}
            onPress={() => {
              Haptics.selectionAsync();
              router.push(`/profile-view?type=user&id=${c.user.id}` as any);
            }}
            style={{ alignItems: "center", gap: 6 }}
          >
            <View style={[styles.friendAvatar, { backgroundColor: C.bg3 }]}>
              {c.user.pfp ? (
                <Image
                  source={{ uri: c.user.pfp }}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="cover"
                />
              ) : (
                <Text
                  style={{
                    color: C.txt,
                    fontFamily: "Roobert-Bold",
                    fontSize: 15,
                  }}
                >
                  {c.user.name.charAt(0)}
                </Text>
              )}
              <View style={[styles.activeDot, { borderColor: C.bg }]} />
            </View>
            <Text
              style={{
                color: C.txt2,
                fontFamily: "Roobert-Medium",
                fontSize: 10,
                maxWidth: 52,
                textAlign: "center",
              }}
              numberOfLines={1}
            >
              {c.user.name.split(" ")[0]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Friends activity ─────────────────────────────────────────────────────────
function FriendsActivity({ checkins }: { checkins: CheckInItem[] }) {
  const C = useColors();
  if (!checkins.length) return null;
  return (
    <View style={styles.section}>
      <View style={styles.sectionRow}>
        <Text style={[styles.sectionTitle, { color: C.txt }]}>
          Recent Activity
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {checkins.slice(0, 10).map((c) => (
          <TouchableOpacity
            key={c.id}
            activeOpacity={0.75}
            onPress={() => {
              Haptics.selectionAsync();
              router.push(`/profile-view?type=hotspot&id=${c.hotspot.id}` as any);
            }}
            style={[styles.activityPill, { backgroundColor: C.bg2 }]}
          >
            <Avatar uri={c.user.pfp} name={c.user.name} size={20} />
            <View style={[styles.pillDot, { backgroundColor: C.border }]} />
            {c.hotspot.avatar ? (
              <Image
                source={{ uri: c.hotspot.avatar }}
                style={{ width: 18, height: 18, borderRadius: 5 }}
                resizeMode="cover"
              />
            ) : (
              <MapPin size={12} color={C.txt3} />
            )}
            <Text
              style={{
                color: C.txt,
                fontFamily: "Roobert-SemiBold",
                fontSize: 12,
              }}
              numberOfLines={1}
            >
              {c.hotspot.name}
            </Text>
            <Text
              style={{
                color: C.txt3,
                fontFamily: "Roobert-Regular",
                fontSize: 11,
              }}
            >
              {timeAgo(c.createdAt)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Check-in modal ───────────────────────────────────────────────────────────
function CheckInModal({
  visible,
  onClose,
  onSuccess,
}: {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const C = useColors();
  const { data } = useQuery<{ allHotspots: any[] }>(ALL_HOTSPOTS);
  const [createCheckIn, { loading }] = useMutation(CREATE_CHECKIN);
  const [search, setSearch] = useState("");
  const [done, setDone] = useState<string | null>(null);

  const hotspots = useMemo(() => {
    const all = data?.allHotspots ?? [];
    if (!search.trim()) return all.slice(0, 30);
    const q = search.toLowerCase();
    return all
      .filter(
        (h) =>
          h.name?.toLowerCase().includes(q) ||
          h.location?.address?.toLowerCase().includes(q),
      )
      .slice(0, 30);
  }, [data, search]);

  const handleCheckIn = async (hotspot: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await createCheckIn({ variables: { hotspotId: Number(hotspot.id) } });
      try {
        const raw = await SecureStore.getItemAsync("checkin_streak");
        const now = Date.now();
        const DAY = 86_400_000;
        let { count = 0, lastDate = 0 } = raw ? JSON.parse(raw) : {};
        const daysSinceLast = Math.floor((now - lastDate) / DAY);
        count = daysSinceLast <= 1 ? count + 1 : 1;
        await SecureStore.setItemAsync(
          "checkin_streak",
          JSON.stringify({ count, lastDate: now }),
        );
      } catch {}
      setDone(hotspot.name);
      setTimeout(() => {
        setDone(null);
        setSearch("");
        onClose();
        onSuccess?.();
      }, 1400);
    } catch {}
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalSheet, { backgroundColor: C.bg2 }]}>
          <View style={[styles.sheetHandle, { backgroundColor: C.border2 }]} />
          {done ? (
            <View style={{ alignItems: "center", paddingVertical: 48 }}>
              <View style={[styles.doneCircle, { backgroundColor: C.bg3 }]}>
                <Check size={28} color={C.txt} strokeWidth={2.5} />
              </View>
              <Text
                style={{
                  color: C.txt,
                  fontFamily: "Roobert-Bold",
                  fontSize: 18,
                  marginTop: 16,
                }}
              >
                Checked in!
              </Text>
              <Text
                style={{
                  color: C.txt3,
                  fontFamily: "Roobert-Regular",
                  fontSize: 14,
                  marginTop: 6,
                }}
              >
                {done}
              </Text>
            </View>
          ) : (
            <>
              <View style={{ paddingHorizontal: 16, marginBottom: 14 }}>
                <Text
                  style={{
                    color: C.txt,
                    fontFamily: "Roobert-Bold",
                    fontSize: 18,
                    marginBottom: 14,
                  }}
                >
                  Check in
                </Text>
                <View style={[styles.searchBar, { backgroundColor: C.bg3 }]}>
                  <Search size={15} color={C.txt3} />
                  <TextInput
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search hotspots…"
                    placeholderTextColor={C.txt3}
                    style={{
                      flex: 1,
                      fontFamily: "Roobert-Regular",
                      fontSize: 14,
                      color: C.txt,
                    }}
                    autoFocus
                  />
                </View>
              </View>
              <FlatList
                data={hotspots}
                keyExtractor={(h) => String(h.id)}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                  const city = getCityState(item.location?.address);
                  return (
                    <TouchableOpacity
                      onPress={() => handleCheckIn(item)}
                      activeOpacity={0.7}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 16,
                        paddingVertical: 13,
                        gap: 12,
                      }}
                    >
                      <View
                        style={[styles.listAvatar, { backgroundColor: C.bg3 }]}
                      >
                        {item.avatar ? (
                          <Image
                            source={{ uri: item.avatar }}
                            style={{ width: "100%", height: "100%" }}
                            resizeMode="cover"
                          />
                        ) : (
                          <MapPin size={16} color={C.txt3} />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            color: C.txt,
                            fontFamily: "Roobert-SemiBold",
                            fontSize: 14,
                          }}
                          numberOfLines={1}
                        >
                          {item.name}
                        </Text>
                        {city ? (
                          <Text
                            style={{
                              color: C.txt3,
                              fontFamily: "Roobert-Regular",
                              fontSize: 12,
                              marginTop: 2,
                            }}
                          >
                            {city}
                          </Text>
                        ) : null}
                      </View>
                      {loading ? (
                        <ActivityIndicator size="small" color={C.txt3} />
                      ) : (
                        <MapPin size={16} color={C.txt3} />
                      )}
                    </TouchableOpacity>
                  );
                }}
                ItemSeparatorComponent={() => (
                  <View
                    style={{
                      height: StyleSheet.hairlineWidth,
                      backgroundColor: C.border,
                      marginLeft: 70,
                    }}
                  />
                )}
              />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Create post modal ────────────────────────────────────────────────────────
const POST_RADIUS_KM = 40.23;
function postHaversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const POST_TYPES = ["REVIEW", "PSA", "CHECK_IN"] as const;
type PostTypeVal = (typeof POST_TYPES)[number];

const POST_TAGS = [
  "Night life", "Food", "Party", "Free",
  "Live", "Eats", "Club", "College",
  "Music", "Game", "Hidden Gem",
  "Must Try", "Fun",
];

function CreatePostModal({
  visible,
  onClose,
  me,
}: {
  visible: boolean;
  onClose: () => void;
  me?: { name: string; pfp?: string };
}) {
  const C = useColors();
  const { data: hsData } = useQuery<{ allHotspots: any[] }>(ALL_HOTSPOTS);
  const [createPost] = useMutation(CREATE_POST);
  const [title, setTitle] = useState("");
  const [postType, setPostType] = useState<PostTypeVal | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [hsSearch, setHsSearch] = useState("");
  const [hotspot, setHotspot] = useState<any>(null);
  const [media, setMedia] = useState<{ uri: string } | null>(null);
  const [step, setStep] = useState<"compose" | "hotspot">("compose");
  const [submitting, setSubmitting] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    if (!visible) return;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      } catch {}
    })();
  }, [visible]);

  const mapPosts = useMemo(() => {
    const result: { postId: string; media: string; hotspotId: string; lat: number; lng: number; isActive: boolean }[] = [];
    const now = Date.now();
    const H24 = 24 * 60 * 60 * 1000;
    for (const h of hsData?.allHotspots ?? []) {
      const lat = h.location?.latitude;
      const lng = h.location?.longitude;
      if (!lat || !lng || (lat === 0 && lng === 0)) continue;
      if (userCoords && postHaversineKm(userCoords.lat, userCoords.lon, lat, lng) > POST_RADIUS_KM) continue;
      const isActive =
        (h.posts ?? []).some((p: any) => p.createdAt && now - new Date(p.createdAt).getTime() < H24) ||
        (h.checkins ?? []).some((c: any) => c.createdAt && now - new Date(c.createdAt).getTime() < H24);
      for (const p of (h.posts ?? []) as any[]) {
        if (p.media) {
          result.push({ postId: p.id, media: p.media, hotspotId: h.id, lat, lng, isActive });
        }
      }
    }
    return result.slice(0, 20);
  }, [hsData, userCoords]);

  const hotspots = useMemo(() => {
    const all = hsData?.allHotspots ?? [];
    if (!hsSearch.trim()) return all.slice(0, 25);
    const q = hsSearch.toLowerCase();
    return all.filter((h) => h.name?.toLowerCase().includes(q)).slice(0, 25);
  }, [hsData, hsSearch]);

  const reset = () => {
    setTitle("");
    setPostType(null);
    setSelectedTags([]);
    setHsSearch("");
    setHotspot(null);
    setMedia(null);
    setStep("compose");
    setSubmitting(false);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
    Haptics.selectionAsync();
  };

  const handleSubmit = async () => {
    if (!title.trim() || !postType || !hotspot) return;
    setSubmitting(true);
    try {
      let mediaVal: string | null = null;
      if (media) {
        const up = await uploadPostMedia(media.uri);
        mediaVal = up.publicUrl;
      }
      const input: any = { title: title.trim(), type: postType };
      if (mediaVal) input.media = mediaVal;
      if (selectedTags.length > 0) input.tags = selectedTags;
      await createPost({
        variables: { hotspotId: Number(hotspot.id), data: input },
      });
      reset();
      onClose();
    } catch (e: any) {
      alert(e?.message || "Failed");
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={() => {
        reset();
        onClose();
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: C.bg, maxHeight: "92%" },
            ]}
          >
            <View
              style={[styles.sheetHandle, { backgroundColor: C.border2 }]}
            />
            <View style={styles.sheetNav}>
              <TouchableOpacity
                onPress={() => {
                  if (step === "hotspot") setStep("compose");
                  else {
                    reset();
                    onClose();
                  }
                }}
              >
                <Text
                  style={{
                    color: C.txt2,
                    fontFamily: "Roobert-Regular",
                    fontSize: 15,
                  }}
                >
                  {step === "hotspot" ? "Back" : "Cancel"}
                </Text>
              </TouchableOpacity>
              <Text
                style={{
                  color: C.txt,
                  fontFamily: "Roobert-Bold",
                  fontSize: 16,
                }}
              >
                New post
              </Text>
              <TouchableOpacity
                onPress={
                  step === "compose"
                    ? () => {
                        if (title.trim() && postType) setStep("hotspot");
                      }
                    : handleSubmit
                }
                disabled={
                  step === "compose"
                    ? !title.trim() || !postType
                    : !hotspot || submitting
                }
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={C.accent} />
                ) : (
                  <Text
                    style={{
                      color: (
                        step === "compose"
                          ? !title.trim() || !postType
                          : !hotspot
                      )
                        ? C.txt3
                        : C.txt,
                      fontFamily: "Roobert-Bold",
                      fontSize: 15,
                    }}
                  >
                    {step === "compose" ? "Next" : "Post"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ padding: 16, gap: 16 }}
            >
              {step === "compose" ? (
                <>
                  <View
                    style={{
                      flexDirection: "row",
                      gap: 12,
                      alignItems: "flex-start",
                    }}
                  >
                    <Avatar uri={me?.pfp} name={me?.name ?? "?"} size={36} />
                    <TextInput
                      style={{
                        flex: 1,
                        color: C.txt,
                        fontFamily: "Roobert-Regular",
                        fontSize: 16,
                        minHeight: 90,
                      }}
                      placeholder="What's happening?"
                      placeholderTextColor={C.txt3}
                      multiline
                      autoFocus
                      value={title}
                      onChangeText={setTitle}
                    />
                  </View>
                  {media && (
                    <View style={{ borderRadius: 14, overflow: "hidden" }}>
                      <Image
                        source={{ uri: media.uri }}
                        style={{ width: "100%", height: 180 }}
                        resizeMode="cover"
                      />
                      <TouchableOpacity
                        onPress={() => setMedia(null)}
                        style={styles.mediaRemove}
                      >
                        <X size={14} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  )}
                  <View>
                    <Text
                      style={{
                        color: C.txt3,
                        fontFamily: "Roobert-SemiBold",
                        fontSize: 11,
                        marginBottom: 10,
                        letterSpacing: 0.4,
                      }}
                    >
                      POST TYPE
                    </Text>
                    <View
                      style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}
                    >
                      {POST_TYPES.map((t) => (
                        <TouchableOpacity
                          key={t}
                          onPress={() => setPostType(t)}
                          style={[
                            styles.typePill,
                            {
                              backgroundColor: postType === t ? C.txt : C.bg3,
                              borderColor: postType === t ? C.txt : C.border,
                            },
                          ]}
                        >
                          <Text
                            style={{
                              color: postType === t ? C.bg : C.txt2,
                              fontFamily: "Roobert-SemiBold",
                              fontSize: 13,
                            }}
                          >
                            {t === "CHECK_IN"
                              ? "Check-in"
                              : t.charAt(0) + t.slice(1).toLowerCase()}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <View>
                    <Text
                      style={{
                        color: C.txt3,
                        fontFamily: "Roobert-SemiBold",
                        fontSize: 11,
                        marginBottom: 10,
                        letterSpacing: 0.4,
                      }}
                    >
                      TAGS
                    </Text>
                    <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                      {POST_TAGS.map((tag) => {
                        const active = selectedTags.includes(tag);
                        return (
                          <TouchableOpacity
                            key={tag}
                            onPress={() => toggleTag(tag)}
                            activeOpacity={0.75}
                            style={[
                              styles.typePill,
                              {
                                backgroundColor: active ? C.txt : C.bg3,
                                borderColor: active ? C.txt : C.border,
                              },
                            ]}
                          >
                            <Text
                              style={{
                                color: active ? C.bg : C.txt2,
                                fontFamily: "Roobert-SemiBold",
                                fontSize: 12,
                              }}
                            >
                              {tag}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={async () => {
                      try {
                        const r = await pickPostMedia();
                        if (r) setMedia({ uri: r });
                      } catch {}
                    }}
                    style={[styles.mediaRow, { borderTopColor: C.border }]}
                  >
                    <ImageIcon size={20} color={C.txt2} />
                    <Text
                      style={{
                        color: C.txt2,
                        fontFamily: "Roobert-SemiBold",
                        fontSize: 14,
                      }}
                    >
                      Add photo / video
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  {mapPosts.length > 0 && userCoords && (
                    <View style={{ borderRadius: 20, overflow: "hidden", height: 200, marginBottom: 4 }}>
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
                        scrollEnabled
                        zoomEnabled
                        legalLabelInsets={{ top: 0, left: 0, bottom: -100, right: -100 }}
                      >
                        {mapPosts.slice(0, 15).map((p) => (
                          <Marker
                            key={p.postId}
                            coordinate={{ latitude: p.lat, longitude: p.lng }}
                            anchor={{ x: 0.5, y: 1 }}
                            tracksViewChanges={false}
                            onPress={() => { Haptics.selectionAsync(); router.push(`/profile-view?type=hotspot&id=${p.hotspotId}` as any); }}
                          >
                            <View style={{ alignItems: "center" }}>
                              {p.isActive ? (
                                <LinearGradient
                                  colors={["#833AB4", "#1877F2", "#E1306C"]}
                                  start={{ x: 0, y: 0 }}
                                  end={{ x: 1, y: 1 }}
                                  style={{ borderRadius: 11, padding: 2 }}
                                >
                                  <View style={{ width: 40, height: 40, borderRadius: 9, overflow: "hidden" }}>
                                    <Image source={{ uri: p.media }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                                  </View>
                                </LinearGradient>
                              ) : (
                                <View style={{ width: 44, height: 44, borderRadius: 11, overflow: "hidden", borderWidth: 2, borderColor: "#fff" }}>
                                  <Image source={{ uri: p.media }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                                </View>
                              )}
                              <View style={{ width: 3, height: 6, backgroundColor: "#fff", borderRadius: 2, marginTop: -1 }} />
                            </View>
                          </Marker>
                        ))}
                      </MapView>
                    </View>
                  )}
                  <Text
                    style={{
                      color: C.txt,
                      fontFamily: "Roobert-Bold",
                      fontSize: 17,
                    }}
                  >
                    Tag a hotspot
                  </Text>
                  <View
                    style={[
                      styles.searchBar,
                      { backgroundColor: C.bg3, borderColor: C.border },
                    ]}
                  >
                    <Search size={15} color={C.txt3} />
                    <TextInput
                      value={hsSearch}
                      onChangeText={setHsSearch}
                      placeholder="Search hotspots…"
                      placeholderTextColor={C.txt3}
                      autoFocus
                      style={{
                        flex: 1,
                        color: C.txt,
                        fontFamily: "Roobert-Regular",
                        fontSize: 14,
                      }}
                    />
                  </View>
                  {hotspot && (
                    <View
                      style={[
                        styles.selectedHotspot,
                        { backgroundColor: C.bg3 },
                      ]}
                    >
                      <MapPin size={14} color={C.txt2} />
                      <Text
                        style={{
                          flex: 1,
                          color: C.txt,
                          fontFamily: "Roobert-SemiBold",
                          fontSize: 14,
                        }}
                        numberOfLines={1}
                      >
                        {hotspot.name}
                      </Text>
                      <TouchableOpacity onPress={() => setHotspot(null)}>
                        <XCircle size={16} color={C.txt3} />
                      </TouchableOpacity>
                    </View>
                  )}
                  <FlatList
                    data={hotspots}
                    keyExtractor={(h) => String(h.id)}
                    scrollEnabled={false}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        onPress={() => {
                          setHotspot(item);
                          setHsSearch("");
                          Haptics.selectionAsync();
                        }}
                        style={[
                          styles.hotspotRow,
                          { borderBottomColor: C.border },
                        ]}
                      >
                        <View
                          style={[
                            styles.listAvatar,
                            { backgroundColor: C.bg3 },
                          ]}
                        >
                          {item.avatar ? (
                            <Image
                              source={{ uri: item.avatar }}
                              style={{ width: "100%", height: "100%" }}
                              resizeMode="cover"
                            />
                          ) : (
                            <MapPin size={14} color={C.txt3} />
                          )}
                        </View>
                        <Text
                          style={{
                            flex: 1,
                            color: C.txt,
                            fontFamily: "Roobert-SemiBold",
                            fontSize: 14,
                          }}
                          numberOfLines={1}
                        >
                          {item.name}
                        </Text>
                      </TouchableOpacity>
                    )}
                  />
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Create hotspot modal ─────────────────────────────────────────────────────
function CreateHotspotModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const C = useColors();
  const [createHotspot] = useMutation(CREATE_HOTSPOT);
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [pickingImage, setPickingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setName("");
    setType("");
    setDescription("");
    setAddress("");
    setImageUrl(null);
    setSubmitting(false);
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      let lat = 0,
        lng = 0;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        }
      } catch {}
      await createHotspot({
        variables: {
          data: {
            name: name.trim(),
            ...(description.trim() && { description: description.trim() }),
            ...(type.trim() && { type: type.trim() }),
            ...(imageUrl && { avatar: imageUrl }),
            location: {
              latitude: lat,
              longitude: lng,
              ...(address.trim() && { address: address.trim() }),
            },
          },
        },
      });
      reset();
      onClose();
    } catch (e: any) {
      alert(e?.message || "Failed");
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={() => {
        reset();
        onClose();
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: C.bg, maxHeight: "92%" },
            ]}
          >
            <View
              style={[styles.sheetHandle, { backgroundColor: C.border2 }]}
            />
            <View style={styles.sheetNav}>
              <TouchableOpacity
                onPress={() => {
                  reset();
                  onClose();
                }}
              >
                <Text
                  style={{
                    color: C.txt2,
                    fontFamily: "Roobert-Regular",
                    fontSize: 15,
                  }}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
              <Text
                style={{
                  color: C.txt,
                  fontFamily: "Roobert-Bold",
                  fontSize: 16,
                }}
              >
                New hotspot
              </Text>
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={!name.trim() || submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={C.txt} />
                ) : (
                  <Text
                    style={{
                      color: name.trim() ? C.txt : C.txt3,
                      fontFamily: "Roobert-Bold",
                      fontSize: 15,
                    }}
                  >
                    Create
                  </Text>
                )}
              </TouchableOpacity>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ padding: 16, gap: 14 }}
            >
              <TouchableOpacity
                onPress={async () => {
                  try {
                    setPickingImage(true);
                    const uri = await pickHotspotImage();
                    if (!uri) return;
                    const uid =
                      (await SecureStore.getItemAsync("userId")) || "anon";
                    const up = await uploadHotspotImage(uid, uri);
                    setImageUrl(up.publicUrl);
                  } catch {
                  } finally {
                    setPickingImage(false);
                  }
                }}
                disabled={pickingImage}
                style={[
                  styles.imagePickBtn,
                  { backgroundColor: C.bg3, borderColor: C.border },
                ]}
              >
                {imageUrl ? (
                  <Image
                    source={{ uri: imageUrl }}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="cover"
                  />
                ) : pickingImage ? (
                  <ActivityIndicator color={C.txt3} />
                ) : (
                  <>
                    <Camera size={22} color={C.txt3} />
                    <Text
                      style={{
                        color: C.txt3,
                        fontFamily: "Roobert-Regular",
                        fontSize: 10,
                        marginTop: 5,
                      }}
                    >
                      Add photo
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              <FieldLabel>NAME *</FieldLabel>
              <TextInput
                style={[
                  styles.field,
                  {
                    backgroundColor: C.bg3,
                    borderColor: C.border,
                    color: C.txt,
                  },
                ]}
                placeholder="e.g. The Rooftop Bar"
                placeholderTextColor={C.txt3}
                value={name}
                onChangeText={setName}
                autoFocus
              />
              <FieldLabel>TYPE</FieldLabel>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {[
                  "Bar",
                  "Club",
                  "Restaurant",
                  "Café",
                  "Shop",
                  "Park",
                  "Gym",
                  "Event",
                  "Gallery",
                  "Hotel",
                  "Beach",
                  "Market",
                  "Lounge",
                  "Rooftop",
                  "Popup",
                ].map((tag) => (
                  <TouchableOpacity
                    key={tag}
                    onPress={() => setType(type === tag ? "" : tag)}
                    style={[
                      styles.typePill,
                      {
                        backgroundColor: type === tag ? C.txt : C.bg3,
                        borderColor: type === tag ? C.txt : C.border,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontFamily: "Roobert-SemiBold",
                        fontSize: 13,
                        color: type === tag ? C.bg : C.txt2,
                      }}
                    >
                      {tag}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <FieldLabel>ADDRESS</FieldLabel>
              <TextInput
                style={[
                  styles.field,
                  {
                    backgroundColor: C.bg3,
                    borderColor: C.border,
                    color: C.txt,
                  },
                ]}
                placeholder="Street, city, country"
                placeholderTextColor={C.txt3}
                value={address}
                onChangeText={setAddress}
              />
              <FieldLabel>DESCRIPTION</FieldLabel>
              <TextInput
                style={[
                  styles.field,
                  styles.fieldMulti,
                  {
                    backgroundColor: C.bg3,
                    borderColor: C.border,
                    color: C.txt,
                  },
                ]}
                placeholder="What's this place about?"
                placeholderTextColor={C.txt3}
                value={description}
                onChangeText={setDescription}
                multiline
              />
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Create event modal ───────────────────────────────────────────────────────
function CreateEventModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const C = useColors();
  const [createEvent] = useMutation(CREATE_EVENT);
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [time, setTime] = useState("");
  const [site, setSite] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [pickingImage, setPickingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setName("");
    setType("");
    setDescription("");
    setAddress("");
    setTime("");
    setSite("");
    setImageUrl(null);
    setSubmitting(false);
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      let lat = 0,
        lng = 0;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        }
      } catch {}
      await createEvent({
        variables: {
          data: {
            name: name.trim(),
            isEvent: true,
            ...(description.trim() && { description: description.trim() }),
            ...(type.trim() && { type: type.trim() }),
            ...(imageUrl && { avatar: imageUrl }),
            ...(time.trim() && { time: time.trim() }),
            ...(site.trim() && { site: site.trim() }),
            location: {
              latitude: lat,
              longitude: lng,
              ...(address.trim() && { address: address.trim() }),
            },
          },
        },
      });
      reset();
      onClose();
    } catch (e: any) {
      alert(e?.message || "Failed");
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={() => {
        reset();
        onClose();
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: C.bg, maxHeight: "92%" },
            ]}
          >
            <View
              style={[styles.sheetHandle, { backgroundColor: C.border2 }]}
            />
            <View style={styles.sheetNav}>
              <TouchableOpacity
                onPress={() => {
                  reset();
                  onClose();
                }}
              >
                <Text
                  style={{
                    color: C.txt2,
                    fontFamily: "Roobert-Regular",
                    fontSize: 15,
                  }}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
              <Text
                style={{
                  color: C.txt,
                  fontFamily: "Roobert-Bold",
                  fontSize: 16,
                }}
              >
                New event
              </Text>
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={!name.trim() || submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={C.txt} />
                ) : (
                  <Text
                    style={{
                      color: name.trim() ? C.txt : C.txt3,
                      fontFamily: "Roobert-Bold",
                      fontSize: 15,
                    }}
                  >
                    Create
                  </Text>
                )}
              </TouchableOpacity>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ padding: 16, gap: 14 }}
            >
              {/* Cover photo */}
              <TouchableOpacity
                onPress={async () => {
                  try {
                    setPickingImage(true);
                    const uri = await pickHotspotImage();
                    if (!uri) return;
                    const uid =
                      (await SecureStore.getItemAsync("userId")) || "anon";
                    const up = await uploadHotspotImage(uid, uri);
                    setImageUrl(up.publicUrl);
                  } catch {
                  } finally {
                    setPickingImage(false);
                  }
                }}
                disabled={pickingImage}
                style={[
                  styles.imagePickBtn,
                  { backgroundColor: C.bg3, borderColor: C.border },
                ]}
              >
                {imageUrl ? (
                  <Image
                    source={{ uri: imageUrl }}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="cover"
                  />
                ) : pickingImage ? (
                  <ActivityIndicator color={C.txt3} />
                ) : (
                  <>
                    <Camera size={22} color={C.txt3} />
                    <Text
                      style={{
                        color: C.txt3,
                        fontFamily: "Roobert-Regular",
                        fontSize: 10,
                        marginTop: 5,
                      }}
                    >
                      Add photo
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <FieldLabel>NAME *</FieldLabel>
              <TextInput
                style={[
                  styles.field,
                  {
                    backgroundColor: C.bg3,
                    borderColor: C.border,
                    color: C.txt,
                  },
                ]}
                placeholder="e.g. Rooftop NYE Party"
                placeholderTextColor={C.txt3}
                value={name}
                onChangeText={setName}
                autoFocus
              />

              <FieldLabel>TYPE</FieldLabel>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {[
                  "Concert",
                  "Party",
                  "Popup",
                  "Market",
                  "Festival",
                  "Gallery",
                  "Sports",
                  "Networking",
                  "Comedy",
                  "Other",
                ].map((tag) => (
                  <TouchableOpacity
                    key={tag}
                    onPress={() => setType(type === tag ? "" : tag)}
                    style={[
                      styles.typePill,
                      {
                        backgroundColor: type === tag ? C.txt : C.bg3,
                        borderColor: type === tag ? C.txt : C.border,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontFamily: "Roobert-SemiBold",
                        fontSize: 13,
                        color: type === tag ? C.bg : C.txt2,
                      }}
                    >
                      {tag}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <FieldLabel>DATE & TIME</FieldLabel>
              <DateTimeInput
                value={time || undefined}
                onChange={(v) => setTime(v ?? "")}
                placeholder="Pick date & time"
              />

              <FieldLabel>ADDRESS</FieldLabel>
              <TextInput
                style={[
                  styles.field,
                  {
                    backgroundColor: C.bg3,
                    borderColor: C.border,
                    color: C.txt,
                  },
                ]}
                placeholder="Street, city, country"
                placeholderTextColor={C.txt3}
                value={address}
                onChangeText={setAddress}
              />

              <FieldLabel>WEBSITE / TICKET LINK</FieldLabel>
              <TextInput
                style={[
                  styles.field,
                  {
                    backgroundColor: C.bg3,
                    borderColor: C.border,
                    color: C.txt,
                  },
                ]}
                placeholder="https://..."
                placeholderTextColor={C.txt3}
                value={site}
                onChangeText={setSite}
                autoCapitalize="none"
                keyboardType="url"
              />

              <FieldLabel>DESCRIPTION</FieldLabel>
              <TextInput
                style={[
                  styles.field,
                  styles.fieldMulti,
                  {
                    backgroundColor: C.bg3,
                    borderColor: C.border,
                    color: C.txt,
                  },
                ]}
                placeholder="What's this event about?"
                placeholderTextColor={C.txt3}
                value={description}
                onChangeText={setDescription}
                multiline
              />
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Create popup modal ───────────────────────────────────────────────────────
const POPUP_VIBES = [
  "Basketball",
  "Cookout",
  "Hangout",
  "Study",
  "Party",
  "BBQ",
  "Outdoor",
  "Gaming",
  "Pickup",
];

function CreatePopupModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const C = useColors();
  const [createPopup] = useMutation(CREATE_POPUP);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [vibe, setVibe] = useState("");
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
  const [address, setAddress] = useState("");
  const [usingGPS, setUsingGPS] = useState(true);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [pickingImage, setPickingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setName("");
    setDescription("");
    setVibe("");
    setStartTime("");
    setEndTime("");
    setAddress("");
    setUsingGPS(true);
    setImageUrl(null);
    setSubmitting(false);
  };

  const canSubmit = name.trim() && startTime && endTime && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    if (new Date(endTime) <= new Date(startTime)) {
      alert("End time must be after start time");
      return;
    }
    setSubmitting(true);
    try {
      let lat = 0,
        lng = 0,
        resolvedAddress = address.trim();
      if (usingGPS) {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === "granted") {
            const pos = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            lat = pos.coords.latitude;
            lng = pos.coords.longitude;
            if (!resolvedAddress) {
              const [geo] = await Location.reverseGeocodeAsync({
                latitude: lat,
                longitude: lng,
              });
              if (geo)
                resolvedAddress = [geo.street, geo.city, geo.region]
                  .filter(Boolean)
                  .join(", ");
            }
          }
        } catch {}
      } else if (resolvedAddress) {
        try {
          const results = await Location.geocodeAsync(resolvedAddress);
          if (results?.[0]) {
            lat = results[0].latitude;
            lng = results[0].longitude;
          }
        } catch {}
      }
      const durationSec = Math.floor(
        (new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000,
      );
      await createPopup({
        variables: {
          data: {
            name: name.trim(),
            isPopup: true,
            popupStart: startTime,
            popupEnd: endTime,
            popupDuration: durationSec,
            ...(description.trim() && { description: description.trim() }),
            ...(vibe && { type: vibe }),
            ...(imageUrl && { avatar: imageUrl }),
            location: {
              latitude: lat,
              longitude: lng,
              ...(resolvedAddress && { address: resolvedAddress }),
            },
          },
        },
      });
      reset();
      onClose();
    } catch (e: any) {
      alert(e?.message || "Failed to create popup");
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={() => {
        reset();
        onClose();
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: C.bg, maxHeight: "92%" },
            ]}
          >
            <View
              style={[styles.sheetHandle, { backgroundColor: C.border2 }]}
            />
            <View style={styles.sheetNav}>
              <TouchableOpacity
                onPress={() => {
                  reset();
                  onClose();
                }}
              >
                <Text
                  style={{
                    color: C.txt2,
                    fontFamily: "Roobert-Regular",
                    fontSize: 15,
                  }}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <Zap size={14} color={C.txt} strokeWidth={2} />
                <Text
                  style={{
                    color: C.txt,
                    fontFamily: "Roobert-Bold",
                    fontSize: 16,
                  }}
                >
                  New popup
                </Text>
              </View>
              <TouchableOpacity onPress={handleSubmit} disabled={!canSubmit}>
                {submitting ? (
                  <ActivityIndicator size="small" color={C.txt} />
                ) : (
                  <Text
                    style={{
                      color: canSubmit ? C.txt : C.txt3,
                      fontFamily: "Roobert-Bold",
                      fontSize: 15,
                    }}
                  >
                    Drop it
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ padding: 16, gap: 14 }}
            >
              {/* Cover photo */}
              <TouchableOpacity
                onPress={async () => {
                  try {
                    setPickingImage(true);
                    const uri = await pickHotspotImage();
                    if (!uri) return;
                    const uid =
                      (await SecureStore.getItemAsync("userId")) || "anon";
                    const up = await uploadHotspotImage(uid, uri);
                    setImageUrl(up.publicUrl);
                  } catch {
                  } finally {
                    setPickingImage(false);
                  }
                }}
                disabled={pickingImage}
                style={[
                  styles.imagePickBtn,
                  { backgroundColor: C.bg3, borderColor: C.border },
                ]}
              >
                {imageUrl ? (
                  <Image
                    source={{ uri: imageUrl }}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="cover"
                  />
                ) : pickingImage ? (
                  <ActivityIndicator color={C.txt3} />
                ) : (
                  <>
                    <Camera size={22} color={C.txt3} />
                    <Text
                      style={{
                        color: C.txt3,
                        fontFamily: "Roobert-Regular",
                        fontSize: 10,
                        marginTop: 5,
                      }}
                    >
                      Add photo
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <FieldLabel>NAME *</FieldLabel>
              <TextInput
                style={[
                  styles.field,
                  {
                    backgroundColor: C.bg3,
                    borderColor: C.border,
                    color: C.txt,
                  },
                ]}
                placeholder="e.g. 5v5 Basketball Run"
                placeholderTextColor={C.txt3}
                value={name}
                onChangeText={setName}
                autoFocus
              />

              <FieldLabel>VIBE</FieldLabel>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {POPUP_VIBES.map((tag) => (
                  <TouchableOpacity
                    key={tag}
                    onPress={() => setVibe(vibe === tag ? "" : tag)}
                    style={[
                      styles.typePill,
                      {
                        backgroundColor: vibe === tag ? C.txt : C.bg3,
                        borderColor: vibe === tag ? C.txt : C.border,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontFamily: "Roobert-SemiBold",
                        fontSize: 13,
                        color: vibe === tag ? C.bg : C.txt2,
                      }}
                    >
                      {tag}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <FieldLabel>START TIME *</FieldLabel>
              <DateTimeInput
                value={startTime || undefined}
                onChange={(v) => setStartTime(v ?? "")}
                placeholder="Pick start date & time"
              />

              <FieldLabel>END TIME *</FieldLabel>
              <DateTimeInput
                value={endTime || undefined}
                onChange={(v) => setEndTime(v ?? "")}
                placeholder="Pick end date & time"
              />

              <FieldLabel>LOCATION</FieldLabel>
              {/* GPS vs custom toggle */}
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 4 }}>
                {[true, false].map((isGPS) => (
                  <TouchableOpacity
                    key={String(isGPS)}
                    onPress={() => setUsingGPS(isGPS)}
                    activeOpacity={0.82}
                    style={{
                      flex: 1,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      paddingVertical: 10,
                      borderRadius: 10,
                      backgroundColor: usingGPS === isGPS ? C.txt : C.bg3,
                      borderWidth: StyleSheet.hairlineWidth,
                      borderColor: usingGPS === isGPS ? C.txt : C.border,
                    }}
                  >
                    {isGPS ? (
                      <Navigation
                        size={12}
                        color={usingGPS ? C.bg : C.txt3}
                        strokeWidth={2}
                      />
                    ) : (
                      <MapPin
                        size={12}
                        color={!usingGPS ? C.bg : C.txt3}
                        strokeWidth={2}
                      />
                    )}
                    <Text
                      style={{
                        fontFamily: "Roobert-SemiBold",
                        fontSize: 12,
                        color: usingGPS === isGPS ? C.bg : C.txt2,
                      }}
                    >
                      {isGPS ? "Use my location" : "Custom address"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {!usingGPS && (
                <TextInput
                  style={[
                    styles.field,
                    {
                      backgroundColor: C.bg3,
                      borderColor: C.border,
                      color: C.txt,
                    },
                  ]}
                  placeholder="Street, city, state"
                  placeholderTextColor={C.txt3}
                  value={address}
                  onChangeText={setAddress}
                />
              )}

              <FieldLabel>DESCRIPTION (optional)</FieldLabel>
              <TextInput
                style={[
                  styles.field,
                  styles.fieldMulti,
                  {
                    backgroundColor: C.bg3,
                    borderColor: C.border,
                    color: C.txt,
                  },
                ]}
                placeholder="What's going on? Who can join?"
                placeholderTextColor={C.txt3}
                value={description}
                onChangeText={setDescription}
                multiline
              />
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function FieldLabel({ children }: { children: string }) {
  const C = useColors();
  return (
    <Text
      style={{
        color: C.txt3,
        fontFamily: "Roobert-SemiBold",
        fontSize: 11,
        letterSpacing: 0.4,
      }}
    >
      {children}
    </Text>
  );
}

// ─── Post card ────────────────────────────────────────────────────────────────
function PostCard({ item }: { item: PostItem }) {
  const C = useColors();
  const [liked, setLiked] = React.useState(item.isLikedByMe ?? false);
  const [likeCount, setLikeCount] = React.useState(item.likesCount ?? 0);
  const [likePost] = useMutation(LIKE_POST);
  const [unlikePost] = useMutation(UNLIKE_POST);
  const isPSA = item.type?.toUpperCase() === "PSA";

  function toggleLike() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (liked) {
      setLiked(false);
      setLikeCount((n) => Math.max(0, n - 1));
      unlikePost({ variables: { postId: Number(item.id) } }).catch(() => {
        setLiked(true);
        setLikeCount((n) => n + 1);
      });
    } else {
      setLiked(true);
      setLikeCount((n) => n + 1);
      likePost({ variables: { postId: Number(item.id) } }).catch(() => {
        setLiked(false);
        setLikeCount((n) => Math.max(0, n - 1));
      });
    }
  }

  return (
    <View style={styles.postCard}>
      <View style={{ paddingTop: 2 }}>
        <TouchableOpacity
          onPress={() => router.push(`/profile-view?type=user&id=${item.author.id}` as any)}
          activeOpacity={0.8}
        >
          <View style={[styles.postAvatar, { backgroundColor: C.bg3 }]}>
            <Avatar uri={item.author.pfp} name={item.author.name} size={38} />
          </View>
        </TouchableOpacity>
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.postHeader}>
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            <TouchableOpacity
              onPress={() => router.push(`/profile-view?type=user&id=${item.author.id}` as any)}
              activeOpacity={0.8}
            >
              <Text
                style={[styles.postAuthor, { color: C.txt }]}
                numberOfLines={1}
              >
                {item.author.name}
              </Text>
            </TouchableOpacity>
            {isPSA && (
              <View style={[styles.psaBadge, { backgroundColor: C.bg3 }]}>
                <Text
                  style={{
                    color: C.txt2,
                    fontFamily: "Roobert-Bold",
                    fontSize: 9,
                    letterSpacing: 0.4,
                  }}
                >
                  PSA
                </Text>
              </View>
            )}
            <Text
              style={{
                color: C.txt3,
                fontFamily: "Roobert-Regular",
                fontSize: 13,
              }}
            >
              · {timeAgo(item.createdAt)}
            </Text>
          </View>
          <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MoreHorizontal size={16} color={C.txt3} />
          </TouchableOpacity>
        </View>
        {item.title && (
          <Text style={[styles.postTitle, { color: C.txt }]}>{item.title}</Text>
        )}
        {item.content && (
          <Text style={[styles.postBody, { color: C.txt2 }]} numberOfLines={4}>
            {item.content}
          </Text>
        )}
        {item.media && (
          <View style={[styles.postMedia, { backgroundColor: C.bg3 }]}>
            <Image
              source={{ uri: item.media }}
              style={{ width: "100%", height: W * 0.52 }}
              resizeMode="cover"
            />
          </View>
        )}
        {item.hotspot && (
          <TouchableOpacity
            onPress={() => router.push(`/profile-view?type=hotspot&id=${item.hotspot!.id}` as any)}
            activeOpacity={0.75}
            style={[styles.hotspotTag, { backgroundColor: C.bg3 }]}
          >
            {item.hotspot.avatar ? (
              <Image
                source={{ uri: item.hotspot.avatar }}
                style={{ width: 14, height: 14, borderRadius: 4 }}
                resizeMode="cover"
              />
            ) : (
              <MapPin size={10} color={C.txt3} />
            )}
            <Text
              style={{
                color: C.txt2,
                fontFamily: "Roobert-SemiBold",
                fontSize: 12,
              }}
              numberOfLines={1}
            >
              {item.hotspot.name}
            </Text>
            {item.hotspot.type && (
              <Text
                style={{
                  color: C.txt3,
                  fontFamily: "Roobert-Regular",
                  fontSize: 11,
                }}
              >
                · {item.hotspot.type}
              </Text>
            )}
          </TouchableOpacity>
        )}
        <View style={styles.postActions}>
          <TouchableOpacity activeOpacity={0.7} style={styles.actionBtn}>
            <MessageCircle size={18} color={C.txt3} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={toggleLike}
            activeOpacity={0.7}
            style={styles.actionBtn}
          >
            <Heart
              size={18}
              color={liked ? C.txt : C.txt3}
              fill={liked ? C.txt : "none"}
            />
            {likeCount > 0 && (
              <Text
                style={{
                  color: liked ? C.txt : C.txt3,
                  fontFamily: "Roobert-SemiBold",
                  fontSize: 13,
                }}
              >
                {likeCount}
              </Text>
            )}
          </TouchableOpacity>
          <View style={styles.actionBtn}>
            <Eye size={18} color={C.txt3} />
            <Text
              style={{
                color: C.txt3,
                fontFamily: "Roobert-Regular",
                fontSize: 13,
              }}
            >
              {item.viewsCount ?? 0}
            </Text>
          </View>
          <TouchableOpacity activeOpacity={0.7} style={styles.actionBtn}>
            <Send size={18} color={C.txt3} />
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7} style={styles.actionBtn}>
            <Bookmark size={18} color={C.txt3} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Check-in card ────────────────────────────────────────────────────────────
function CheckInCard({ item }: { item: CheckInItem }) {
  const C = useColors();
  const city = getCityState(item.hotspot?.location?.address);
  return (
    <View style={styles.postCard}>
      <TouchableOpacity
        onPress={() => router.push(`/profile-view?type=user&id=${item.user.id}` as any)}
        activeOpacity={0.8}
      >
        <View style={[styles.postAvatar, { backgroundColor: C.bg3 }]}>
          <Avatar uri={item.user.pfp} name={item.user.name} size={38} />
        </View>
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <View style={styles.postHeader}>
          <TouchableOpacity
            onPress={() => router.push(`/profile-view?type=user&id=${item.user.id}` as any)}
            activeOpacity={0.8}
          >
            <Text style={[styles.postAuthor, { color: C.txt }]}>
              {item.user.name}
            </Text>
          </TouchableOpacity>
          <Text
            style={{
              color: C.txt3,
              fontFamily: "Roobert-Regular",
              fontSize: 13,
            }}
          >
            · {timeAgo(item.createdAt)}
          </Text>
        </View>
        <Text
          style={{
            color: C.txt3,
            fontFamily: "Roobert-Regular",
            fontSize: 13,
            marginBottom: 10,
          }}
        >
          checked in
        </Text>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            Haptics.selectionAsync();
            router.push(`/profile-view?type=hotspot&id=${item.hotspot.id}` as any);
          }}
          style={[styles.checkinVenue, { backgroundColor: C.bg3 }]}
        >
          <View style={[styles.checkinVenueIcon, { backgroundColor: C.bg2 }]}>
            {item.hotspot.avatar ? (
              <Image
                source={{ uri: item.hotspot.avatar }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="cover"
              />
            ) : (
              <MapPin size={16} color={C.txt3} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: C.txt,
                fontFamily: "Roobert-SemiBold",
                fontSize: 14,
              }}
              numberOfLines={1}
            >
              {item.hotspot.name}
            </Text>
            {city && (
              <Text
                style={{
                  color: C.txt3,
                  fontFamily: "Roobert-Regular",
                  fontSize: 12,
                  marginTop: 2,
                }}
              >
                {city}
              </Text>
            )}
          </View>
          <ChevronRight size={14} color={C.txt3} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);

  const {
    data: meData,
    loading: meLoading,
    refetch: refetchMe,
  } = useQuery<MeQueryData>(ME_QUERY);
  const {
    data: checkinsData,
    loading: checkinsLoading,
    refetch: refetchCheckins,
  } = useQuery<{ followerRecentCheckins: CheckInItem[] }>(FOLLOWING_CHECKINS, {
    variables: { skip: 0, take: 50 },
    fetchPolicy: "cache-and-network",
    pollInterval: 30000,
  });
  const { data: hotspotsData, refetch: refetchHotspots } = useQuery<{
    allHotspots: any[];
  }>(ALL_HOTSPOTS, {
    fetchPolicy: "cache-and-network",
    pollInterval: 120_000,
  });
  const { data: popupsData, refetch: refetchPopups } = useQuery<{
    allPopups: any[];
  }>(ALL_POPUPS, {
    fetchPolicy: "cache-and-network",
    pollInterval: 120_000,
  });

  const [refreshing, setRefreshing] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [headerH, setHeaderH] = useState(0);
  const { totalPoints: medalPoints } = useMedals();
  const [checkInModal, setCheckInModal] = useState(false);
  const [postModal, setPostModal] = useState(false);
  const [hotspotModal, setHotspotModal] = useState(false);
  const [eventModal, setEventModal] = useState(false);
  const [popupModal, setPopupModal] = useState(false);
  const [activeCategory, setActiveCategory] = useState<CategoryKey>(null);
  const [selectedMapHotspot, setSelectedMapHotspot] =
    useState<FollowingHotspot | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkInDone, setCheckInDone] = useState(false);
  const [createCheckInDirect] = useMutation(CREATE_CHECKIN);
  const [geocodeTick, setGeocodeTick] = useState(0);
  const [mapRegion, setMapRegion] = useState({
    latitude: 30.2672,
    longitude: -97.7431,
    latitudeDelta: 0.06,
    longitudeDelta: 0.06,
  });

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setMapRegion({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          latitudeDelta: 0.06,
          longitudeDelta: 0.06,
        });
      } catch {}
    })();
  }, []);

  useEffect(() => {
    const checkinHotspots = (checkinsData?.followerRecentCheckins ?? []).map(
      (c: any) => c.hotspot,
    );
    const all = [
      ...(meData?.me?.followingHotspots ?? []),
      ...(meData?.me?.followingEventHotspots ?? []),
      ...checkinHotspots,
      ...(hotspotsData?.allHotspots ?? []),
      ...(popupsData?.allPopups ?? []),
    ];
    const needsGeocode = all.filter(
      (h) => !!h?.location?.address && !geocodeCache.has(h.id),
    );
    if (!needsGeocode.length) return;

    (async () => {
      let didUpdate = false;
      // Batch 5 at a time to avoid iOS CLGeocoder rate limit
      for (let i = 0; i < needsGeocode.length; i += 5) {
        const batch = needsGeocode.slice(i, i + 5);
        await Promise.all(
          batch.map(async (h) => {
            try {
              const results = await Location.geocodeAsync(h.location!.address!);
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
      }
      if (didUpdate) setGeocodeTick((t) => t + 1);
    })();
  }, [
    meData?.me?.followingHotspots,
    meData?.me?.followingEventHotspots,
    checkinsData,
    hotspotsData,
    popupsData,
  ]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refetchMe(),
      refetchCheckins(),
      refetchHotspots(),
      refetchPopups(),
    ]);
    setRefreshing(false);
  };

  const handleMapCheckIn = async () => {
    if (!selectedMapHotspot || checkingIn) return;
    setCheckingIn(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await createCheckInDirect({
        variables: { hotspotId: Number(selectedMapHotspot.id) },
      });
      setCheckInDone(true);
      setTimeout(() => {
        setCheckInDone(false);
        setSelectedMapHotspot(null);
        refetchCheckins();
      }, 1400);
    } catch {
    } finally {
      setCheckingIn(false);
    }
  };

  const feedItems = useMemo<PostItem[]>(() => {
    const items: PostItem[] = [];
    (meData?.me?.following ?? []).forEach((user: any) => {
      (user.posts ?? []).forEach((post: any) => {
        items.push({
          ...post,
          author: post.author ?? {
            id: user.id,
            name: user.name,
            pfp: user.pfp,
          },
        });
      });
    });
    return items.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [meData]);

  const activePopups = useMemo(() => {
    const now = Date.now();
    return (popupsData?.allPopups ?? [])
      .filter((p: any) => {
        if (!p.popupStart) return false;
        const end = p.popupEnd ? new Date(p.popupEnd).getTime() : null;
        if (end && now > end) return false;
        return true;
      })
      .sort(
        (a: any, b: any) =>
          new Date(a.popupStart).getTime() - new Date(b.popupStart).getTime(),
      )
      .slice(0, 8);
  }, [popupsData]);

  const popularHotspots = useMemo(() => {
    const all = hotspotsData?.allHotspots ?? [];
    const filtered = activeCategory
      ? all.filter((h: any) => h.type === activeCategory)
      : all;
    return filtered.slice(0, 12);
  }, [hotspotsData, activeCategory]);

  const friendPins = useMemo(() => {
    const checkins = [...(checkinsData?.followerRecentCheckins ?? [])].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    // One pin per user — their most recent check-in only
    const seenUsers = new Set<string>();
    const lastCheckins: CheckInItem[] = [];
    for (const c of checkins) {
      if (seenUsers.has(c.user.id)) continue;
      seenUsers.add(c.user.id);
      lastCheckins.push(c);
    }
    // Count how many friends share each hotspot so we can offset overlapping pins
    const hotspotCount = new Map<string, number>();
    for (const c of lastCheckins) {
      const geo = geocodeCache.get(c.hotspot.id);
      const rawLat = c.hotspot.location?.latitude;
      const rawLng = c.hotspot.location?.longitude;
      const lat = geo?.lat ?? rawLat;
      const lng = geo?.lng ?? rawLng;
      if (lat == null || lng == null || (lat === 0 && lng === 0)) continue;
      hotspotCount.set(c.hotspot.id, (hotspotCount.get(c.hotspot.id) ?? 0) + 1);
    }
    const hotspotIndex = new Map<string, number>();
    const SPREAD = 0.00015; // ~15m offset per step
    return lastCheckins.flatMap((c) => {
      const geo = geocodeCache.get(c.hotspot.id);
      const rawLat = c.hotspot.location?.latitude;
      const rawLng = c.hotspot.location?.longitude;
      const lat = geo?.lat ?? rawLat;
      const lng = geo?.lng ?? rawLng;
      if (lat == null || lng == null || (lat === 0 && lng === 0)) return [];
      const total = hotspotCount.get(c.hotspot.id) ?? 1;
      const idx = hotspotIndex.get(c.hotspot.id) ?? 0;
      hotspotIndex.set(c.hotspot.id, idx + 1);
      // Spread pins in a row centred on the hotspot coordinate
      const offset = total > 1 ? (idx - (total - 1) / 2) * SPREAD : 0;
      return [{ checkin: c, lat: lat + 0, lng: lng + offset }];
    });
  }, [checkinsData, geocodeTick]);

  const me = meData?.me;
  const userCity = me?.location?.address
    ? getCityState(me.location.address)?.split(",")[0]
    : null;
  const loading = meLoading || checkinsLoading;

  const ContentHeader = (
    <View>
      <FriendsOutNow checkins={checkinsData?.followerRecentCheckins ?? []} />
      <FriendsActivity checkins={checkinsData?.followerRecentCheckins ?? []} />

      {feedItems.length > 0 && (
        <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
          <Text
            style={{
              color: C.txt3,
              fontFamily: "Roobert-SemiBold",
              fontSize: 11,
              letterSpacing: 0.5,
              textTransform: "uppercase",
            }}
          >
            Feed
          </Text>
        </View>
      )}
    </View>
  );

  const EmptyFeed = (
    <View
      style={{ alignItems: "center", paddingTop: 60, paddingHorizontal: 40 }}
    >
      <View style={[styles.emptyIcon, { backgroundColor: C.bg2 }]}>
        <Users size={26} color={C.txt3} strokeWidth={1.5} />
      </View>
      <Text
        style={{
          color: C.txt,
          fontFamily: "Roobert-Bold",
          fontSize: 20,
          textAlign: "center",
          marginTop: 20,
        }}
      >
        Nothing here yet
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
        Follow friends to see their activity in your feed.
      </Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* ── Black header + following row (one flush block) ── */}
      <View
        className="fixed top-0 right-0 left-0"
        style={{
          backgroundColor: "#000",
          display: mapExpanded ? "none" : "flex",
        }}
        onLayout={(e) => setHeaderH(e.nativeEvent.layout.height)}
      >
        <View style={[styles.topHeader, { paddingTop: 50 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View
              style={{
                width: 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: "#fff",
              }}
            />
            <Text style={styles.wordmark}>plugged</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync();
                setHotspotModal(true);
              }}
              style={styles.headerBtn}
            >
              <Bell size={17} color="#fff" strokeWidth={1.8} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync();
                setEventModal(true);
              }}
              style={styles.headerBtn}
            >
              <CalendarPlus size={17} color="#fff" strokeWidth={1.8} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync();
                setPopupModal(true);
              }}
              style={styles.headerBtn}
            >
              <Zap size={17} color="#fff" strokeWidth={1.8} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync();
                setHotspotModal(true);
              }}
              style={styles.headerBtn}
            >
              <Ionicons
                size={17}
                name="compass-outline"
                color="#fff"
                strokeWidth={1.8}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push("/(tabs)/profile" as any)}
              style={[styles.mapAvatar, { backgroundColor: "#111" }]}
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
                    fontSize: 14,
                  }}
                >
                  {me?.name?.charAt(0) ?? "?"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingVertical: 10,
            gap: 14,
            alignItems: "center",
          }}
        >
          {/* Your own pfp — create button */}
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={() => {
              Haptics.selectionAsync();
              setPostModal(true);
            }}
            style={{ alignItems: "center", gap: 5 }}
          >
            <View style={{ position: "relative" }}>
              <View
                style={{
                  width: 55,
                  height: 55,
                  borderRadius: 31,
                  overflow: "hidden",
                  backgroundColor: "#111",
                }}
              >
                {me?.pfp ? (
                  <Image
                    source={{ uri: me.pfp }}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={{
                      flex: 1,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: "#fff",
                        fontFamily: "Roobert-Bold",
                        fontSize: 16,
                      }}
                    >
                      {me?.name?.charAt(0) ?? "?"}
                    </Text>
                  </View>
                )}
              </View>
              <View
                style={{
                  position: "absolute",
                  bottom: -5,
                  right: -5,
                  width: 25,
                  height: 25,
                  borderRadius: 13,
                  backgroundColor: "#fff",
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 2.5,
                  borderColor: "#000",
                }}
              >
                <Plus size={10} color="#000" strokeWidth={3} />
              </View>
            </View>
            <Text
              style={{
                color: "#fff",
                fontFamily: "Roobert-SemiBold",
                fontSize: 10,
                textAlign: "center",
              }}
            >
              You
            </Text>
          </TouchableOpacity>

          {/* Followed users */}
          {(me?.following ?? []).map(
            (u: { id: string; name: string; pfp?: string }) => (
              <TouchableOpacity
                key={u.id}
                activeOpacity={0.82}
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push(`/profile-view?type=user&id=${u.id}` as any);
                }}
                style={{ alignItems: "center", gap: 5 }}
              >
                <View className="items-center" style={{ position: "relative" }}>
                  <LinearGradient
                    colors={["#833AB4", "#1877F2", "#833AB4"]}
                    start={{ x: 0, y: 1 }}
                    end={{ x: 1, y: 0 }}
                    style={{
                      width: 59,
                      height: 59,
                      borderRadius: 30,
                      padding: 2.5,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <View
                      style={{
                        width: "100%",
                        height: "100%",
                        borderRadius: 28,
                        overflow: "hidden",
                        borderWidth: 2,
                        borderColor: "#000",
                        backgroundColor: "#1a1a1a",
                      }}
                    >
                      {u.pfp ? (
                        <Image
                          source={{ uri: u.pfp }}
                          style={{ width: "100%", height: "100%" }}
                          resizeMode="cover"
                        />
                      ) : (
                        <View
                          style={{
                            flex: 1,
                            backgroundColor: "#1a1a1a",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text
                            style={{
                              color: "#fff",
                              fontFamily: "Roobert-Bold",
                              fontSize: 14,
                            }}
                          >
                            {u.name.charAt(0)}
                          </Text>
                        </View>
                      )}
                    </View>
                  </LinearGradient>
                </View>
                <Text
                  className="w-14"
                  style={{
                    color: "#fff",
                    fontFamily: "Roobert-SemiBold",
                    fontSize: 10,
                    textAlign: "center",
                  }}
                  numberOfLines={1}
                >
                  {u.name.split(" ")[0]}
                </Text>
              </TouchableOpacity>
            ),
          )}
        </ScrollView>
      </View>

      {/* ── Map flush below header block ── */}
      <View
        style={{
          height: "100%",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderTopLeftRadius: 40,
          borderTopRightRadius: 40,
          overflow: "hidden",
        }}
      >
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          provider={PROVIDER_GOOGLE}
          customMapStyle={DARK_MAP_STYLE}
          initialRegion={mapRegion}
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
          {/* Followed hotspot pins — skip any hotspot that already has a friend check-in pin */}
          {(() => {
            const checkedInHotspotIds = new Set(
              friendPins.map((p) => p.checkin.hotspot.id),
            );
            return [
              ...(me?.followingHotspots ?? []),
              ...(me?.followingEventHotspots ?? []),
            ]
              .filter((h, i, arr) => arr.findIndex((x) => x.id === h.id) === i)
              .filter((h) => !checkedInHotspotIds.has(h.id))
              .map((h) => {
                // Geocoded-from-address coords take priority once ready.
                // Raw DB coords are used immediately while geocoding is pending.
                const geo = geocodeCache.get(h.id);
                const rawLat = h.location?.latitude;
                const rawLng = h.location?.longitude;
                const hasRaw =
                  rawLat != null &&
                  rawLng != null &&
                  !(rawLat === 0 && rawLng === 0);
                const lat = geo?.lat ?? (hasRaw ? rawLat! : undefined);
                const lng = geo?.lng ?? (hasRaw ? rawLng! : undefined);
                if (lat == null || lng == null) return null;
                return (
                  <Marker
                    key={`fh-${h.id}`}
                    coordinate={{ latitude: lat, longitude: lng }}
                    anchor={{ x: 0.5, y: 1 }}
                    tracksViewChanges={false}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setCheckInDone(false);
                      setSelectedMapHotspot(h);
                    }}
                  >
                    <FollowedHotspotPin
                      hotspot={h}
                      selected={selectedMapHotspot?.id === h.id}
                    />
                  </Marker>
                );
              });
          })()}
          {friendPins.map((p, i) => (
            <Marker
              key={`fp-${p.checkin.user.id}`}
              coordinate={{ latitude: p.lat, longitude: p.lng }}
              anchor={{ x: 0.5, y: 1 }}
              tracksViewChanges={false}
              onPress={() => {
                Haptics.selectionAsync();
                router.push(`/profile-view?type=user&id=${p.checkin.user.id}` as any);
              }}
            >
              <FriendPin checkin={p.checkin} />
            </Marker>
          ))}

          {/* Popular hotspot pins — top 20 by points, skip already-followed/checked-in */}
          {(() => {
            const followedIds = new Set([
              ...(me?.followingHotspots ?? []).map((h) => h.id),
              ...(me?.followingEventHotspots ?? []).map((h) => h.id),
              ...friendPins.map((p) => p.checkin.hotspot.id),
            ]);
            return (hotspotsData?.allHotspots ?? [])
              .filter((h: any) => !followedIds.has(h.id))
              .sort((a: any, b: any) => (b.points ?? 0) - (a.points ?? 0))
              .slice(0, 20)
              .map((h: any) => {
                const geo = geocodeCache.get(h.id);
                const rawLat = h.location?.latitude;
                const rawLng = h.location?.longitude;
                const hasRaw =
                  rawLat != null &&
                  rawLng != null &&
                  !(rawLat === 0 && rawLng === 0);
                const lat = geo?.lat ?? (hasRaw ? rawLat : undefined);
                const lng = geo?.lng ?? (hasRaw ? rawLng : undefined);
                if (lat == null || lng == null) return null;
                return (
                  <Marker
                    key={`ah-${h.id}`}
                    coordinate={{ latitude: lat, longitude: lng }}
                    anchor={{ x: 0.5, y: 1 }}
                    tracksViewChanges={false}
                    onPress={() => {
                      Haptics.selectionAsync();
                      router.push(`/profile-view?type=hotspot&id=${h.id}` as any);
                    }}
                  >
                    <FollowedHotspotPin hotspot={h} />
                  </Marker>
                );
              });
          })()}

          {/* Popup pins — blue ring to distinguish from regular hotspots */}
          {activePopups.map((p: any) => {
            const geo = geocodeCache.get(p.id);
            const rawLat = p.location?.latitude;
            const rawLng = p.location?.longitude;
            const hasRaw =
              rawLat != null &&
              rawLng != null &&
              !(rawLat === 0 && rawLng === 0);
            const lat = geo?.lat ?? (hasRaw ? rawLat : undefined);
            const lng = geo?.lng ?? (hasRaw ? rawLng : undefined);
            if (lat == null || lng == null) return null;
            return (
              <Marker
                key={`popup-${p.id}`}
                coordinate={{ latitude: lat, longitude: lng }}
                anchor={{ x: 0.5, y: 1 }}
                tracksViewChanges={false}
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push(`/profile-view?type=hotspot&id=${p.id}` as any);
                }}
              >
                <PopupPin popup={p} />
              </Marker>
            );
          })}
        </MapView>
      </View>

      {/* ── Map top overlay: points + expand ── */}
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
        {/* Points pill */}
        <View style={styles.pointsOverlayPill}>
          <Zap size={11} color="#FFD700" strokeWidth={2.5} fill="#FFD700" />
          <Text style={styles.pointsOverlayText}>
            {((me?.points ?? 0) + medalPoints).toLocaleString()} pts
          </Text>
        </View>

        {/* Expand / collapse button */}
        <TouchableOpacity
          onPress={() => {
            Haptics.selectionAsync();
            setMapExpanded((v) => !v);
          }}
          activeOpacity={0.82}
          style={styles.expandBtn}
        >
          {mapExpanded ? (
            <Minimize2 size={15} color="#fff" strokeWidth={2} />
          ) : (
            <Maximize2 size={15} color="#fff" strokeWidth={2} />
          )}
        </TouchableOpacity>
      </View>

      {/* ── Popup pills row ── */}
      {activePopups.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{
            position: "absolute",
            top: mapExpanded ? insets.top + 56 : headerH + 56,
            left: 0,
            right: 0,
            zIndex: 19,
          }}
          contentContainerStyle={{
            paddingHorizontal: 16,
            gap: 8,
            alignItems: "center",
          }}
        >
          {activePopups.map((p: any) => {
            const now = Date.now();
            const start = new Date(p.popupStart).getTime();
            const isLive = now >= start;
            return (
              <TouchableOpacity
                key={p.id}
                activeOpacity={0.82}
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push(`/profile-view?type=hotspot&id=${p.id}` as any);
                }}
                style={styles.popupPill}
              >
                <PulseDot color={isLive ? "#1877F2" : "#fff"} size={4} />

                {/* Popup avatar */}
                <View style={styles.popupPillAvatar}>
                  {p.avatar ? (
                    <Image
                      source={{ uri: p.avatar }}
                      style={{ width: "100%", height: "100%" }}
                      resizeMode="cover"
                    />
                  ) : (
                    <Zap size={10} color="#fff" strokeWidth={2} />
                  )}
                </View>

                {/* Divider */}
                <View style={styles.popupPillDivider} />

                {/* Author pfp */}
                <View style={styles.popupPillAuthor}>
                  {p.author?.pfp ? (
                    <Image
                      source={{ uri: p.author.pfp }}
                      style={{ width: "100%", height: "100%" }}
                      resizeMode="cover"
                    />
                  ) : (
                    <Text
                      style={{
                        color: "#fff",
                        fontFamily: "Roobert-Bold",
                        fontSize: 8,
                      }}
                    >
                      {p.author?.name?.charAt(0) ?? "?"}
                    </Text>
                  )}
                </View>

                <Text style={styles.popupPillName} numberOfLines={1}>
                  {p.name}
                </Text>
                <Text style={styles.popupPillTime}>
                  {popupTimeLabel(p.popupStart, p.popupEnd)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* ── Bottom section: friends strip + hotspot carousel ── */}
      {((me?.followingHotspots ?? []).length > 0 ||
        (me?.followingEventHotspots ?? []).length > 0 ||
        (checkinsData?.followerRecentCheckins ?? []).length > 0 ||
        popularHotspots.length > 0) && (
        <View style={{ position: "absolute", bottom: 80, left: 0, right: 0 }}>
          {/* Mini friends recent check-in strip */}
          {(checkinsData?.followerRecentCheckins ?? []).length > 0 && (
            <View
              style={{
                paddingVertical: 5,
                marginBottom: 6,
                borderRadius: 20,
                marginHorizontal: 16,
              }}
            >
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                  paddingHorizontal: 14,
                  gap: 10,
                  alignItems: "center",
                }}
              >
                {(checkinsData?.followerRecentCheckins as CheckInItem[])
                  .filter(
                    (c, i, arr) =>
                      arr.findIndex((x) => x.user.id === c.user.id) === i,
                  )
                  .slice(0, 12)
                  .map((c) => (
                    <TouchableOpacity
                      key={c.user.id}
                      activeOpacity={0.82}
                      onPress={() => {
                        Haptics.selectionAsync();
                        router.push(`/profile-view?type=user&id=${c.user.id}` as any);
                      }}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 0,
                        backgroundColor: "#000",
                        borderRadius: 22,
                        paddingVertical: 6,
                        paddingRight: 12,
                        paddingLeft: 12,
                        borderColor: "#222",
                      }}
                    >
                      <View style={{ marginRight: 5 }}>
                        <PulseDot color="#fff" size={5} />
                      </View>

                      {/* Hotspot avatar */}
                      <View
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 15,
                          overflow: "hidden",
                          backgroundColor: "#1a1a1a",
                        }}
                      >
                        {c.hotspot.avatar ? (
                          <Image
                            source={{ uri: c.hotspot.avatar }}
                            style={{ width: "100%", height: "100%" }}
                            resizeMode="cover"
                          />
                        ) : (
                          <View
                            style={{
                              flex: 1,
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <MapPin size={12} color="#555" />
                          </View>
                        )}
                      </View>
                      {/* Vertical divider */}
                      <View
                        style={{
                          width: StyleSheet.hairlineWidth,
                          height: 20,
                          backgroundColor: "#333",
                          marginHorizontal: 8,
                        }}
                      />
                      {/* User pfp */}
                      <View
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 13,
                          overflow: "hidden",
                          backgroundColor: "#1a1a1a",
                          marginRight: 8,
                        }}
                      >
                        {c.user.pfp ? (
                          <Image
                            source={{ uri: c.user.pfp }}
                            style={{ width: "100%", height: "100%" }}
                            resizeMode="cover"
                          />
                        ) : (
                          <View
                            style={{
                              flex: 1,
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Text
                              style={{
                                color: "#fff",
                                fontFamily: "Roobert-Bold",
                                fontSize: 9,
                              }}
                            >
                              {c.user.name.charAt(0)}
                            </Text>
                          </View>
                        )}
                      </View>
                      {/* Hotspot name · time */}
                      <Text
                        style={{
                          color: "#fff",
                          fontFamily: "Roobert-SemiBold",
                          fontSize: 11,
                        }}
                        numberOfLines={1}
                      >
                        {c.hotspot.name}
                      </Text>
                      <Text
                        style={{
                          color: "rgba(255,255,255,0.35)",
                          fontFamily: "Roobert-Regular",
                          fontSize: 10,
                          marginLeft: 5,
                        }}
                      >
                        {timeAgo(c.createdAt)}
                      </Text>
                    </TouchableOpacity>
                  ))}
              </ScrollView>
            </View>
          )}

          <FlatList
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            style={{}}
            contentContainerStyle={{}}
            data={(() => {
              const followed = [
                ...(me?.followingHotspots ?? []),
                ...(me?.followingEventHotspots ?? []),
              ].filter((h, i, arr) => arr.findIndex((x) => x.id === h.id) === i);
              return followed.length > 0 ? followed : popularHotspots;
            })()}
            keyExtractor={(h) => h.id}
            renderItem={({ item: h }) => {
              const recentCount = (
                checkinsData?.followerRecentCheckins ?? []
              ).filter(
                (c: CheckInItem) =>
                  c.hotspot.id === h.id &&
                  Date.now() - new Date(c.createdAt).getTime() < DAY_MS,
              ).length;
              return (
                <HotspotCarouselCard
                  hotspot={h}
                  recentCount={recentCount}
                  onPress={() => {
                    Haptics.selectionAsync();
                    router.push(`/profile-view?type=hotspot&id=${h.id}` as any);
                  }}
                  onCheckIn={() => {
                    setCheckInDone(false);
                    setSelectedMapHotspot(h);
                    handleMapCheckIn();
                  }}
                />
              );
            }}
          />
        </View>
      )}

      <CheckInModal
        visible={checkInModal}
        onClose={() => setCheckInModal(false)}
        onSuccess={() => {
          refetchCheckins();
          refetchMe();
        }}
      />
      <CreatePostModal
        visible={postModal}
        onClose={() => setPostModal(false)}
        me={meData?.me}
      />
      <CreateHotspotModal
        visible={hotspotModal}
        onClose={() => setHotspotModal(false)}
      />
      <CreateEventModal
        visible={eventModal}
        onClose={() => setEventModal(false)}
      />
      <CreatePopupModal
        visible={popupModal}
        onClose={() => setPopupModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Popup pills
  popupPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#000",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  popupPillAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
    alignItems: "center",
    justifyContent: "center",
  },
  popupPillDivider: {
    width: StyleSheet.hairlineWidth,
    height: 18,
    backgroundColor: "rgba(255,255,255,0.25)",
    marginHorizontal: 2,
  },
  popupPillAuthor: {
    width: 20,
    height: 20,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#2a2a2a",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
  },
  popupPillName: {
    color: "#fff",
    fontFamily: "Roobert-SemiBold",
    fontSize: 12,
    letterSpacing: -0.2,
    maxWidth: 100,
  },
  popupPillTime: {
    color: "rgba(255,255,255,0.50)",
    fontFamily: "Roobert-Regular",
    fontSize: 11,
  },
  // Map overlay
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
  // Top header
  topHeader: {
    backgroundColor: "#000",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingBottom: 6,
  },
  wordmark: {
    fontFamily: "Roobert-Bold",
    fontSize: 22,
    letterSpacing: -0.8,
    color: "#fff",
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  mapAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  // Map
  mapFade: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  chipsScroll: {
    position: "absolute",
    bottom: 54,
    left: 0,
    right: 0,
  },
  chipsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  cityPill: {
    position: "absolute",
    bottom: 14,
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderRadius: 30,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  cityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#34C759",
  },
  cityTxt: {
    color: "#fff",
    fontFamily: "Roobert-SemiBold",
    fontSize: 12,
  },
  cityCount: {
    color: "rgba(255,255,255,0.55)",
    fontFamily: "Roobert-Regular",
    fontSize: 12,
  },
  fab: {
    position: "absolute",
    bottom: 14,
    right: 16,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  // Map check-in card
  mapCheckinCard: {
    position: "absolute",
    bottom: 14,
    left: 14,
    right: 14,
    backgroundColor: "rgba(18,18,18,0.96)",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderColor: "rgba(255,255,255,0.12)",
  },
  mapCheckinClose: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  mapCheckinAvatar: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#2a2a2a",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  mapCheckinName: {
    color: "#fff",
    fontFamily: "Roobert-SemiBold",
    fontSize: 14,
    letterSpacing: -0.2,
  },
  mapCheckinAddr: {
    color: "rgba(255,255,255,0.45)",
    fontFamily: "Roobert-Regular",
    fontSize: 11,
    marginTop: 2,
  },
  mapCheckinBtn: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 80,
  },
  mapCheckinBtnLabel: {
    color: "#000",
    fontFamily: "Roobert-Bold",
    fontSize: 13,
  },
  // Map pins
  clusterWrap: {
    alignItems: "center",
  },
  clusterPfpRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: -10,
    zIndex: 2,
  },
  clusterPfp: {
    width: 24,
    height: 24,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#444",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#000",
  },
  clusterCard: {
    width: 64,
    height: 64,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  clusterNameBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 4,
    paddingVertical: 3,
  },
  clusterName: {
    color: "#fff",
    fontFamily: "Roobert-Bold",
    fontSize: 8,
    letterSpacing: -0.1,
    textAlign: "center",
  },
  clusterTail: {
    width: 3,
    height: 7,
    backgroundColor: "#fff",
    borderRadius: 2,
    marginTop: -1,
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
  hotspotPinTriangle: {
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
  // Content panel
  detailCard: {
    borderRadius: 40,
    padding: 16,
    overflow: "visible",
    position: "relative",
  },
  // Hotspot carousel card
  hCard: {
    width: 140,
    borderRadius: 16,
    overflow: "hidden",
  },
  hCardImage: {
    width: "100%",
    height: 90,
    backgroundColor: "#1a1a1a",
    alignItems: "center",
    justifyContent: "center",
  },
  hCardTypePill: {
    position: "absolute",
    bottom: 6,
    left: 8,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  hCardBody: {
    padding: 10,
  },
  hCardName: {
    fontFamily: "Roobert-SemiBold",
    fontSize: 12,
    letterSpacing: -0.2,
  },
  hCardAddr: {
    fontFamily: "Roobert-Regular",
    fontSize: 10,
    marginTop: 2,
  },
  // Sections
  section: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 14,
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontFamily: "Roobert-Bold",
    fontSize: 18,
    letterSpacing: -0.4,
  },
  countPill: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  // Friends out
  friendAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  activeDot: {
    position: "absolute",
    bottom: 1,
    right: 1,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: "#34C759",
    borderWidth: 2,
  },
  // Activity pill
  activityPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  pillDot: {
    height: 14,
  },
  // Popular card
  popularCard: {
    width: CARD_W,
    borderRadius: 18,
    overflow: "hidden",
  },
  popularImg: {
    width: CARD_W,
    height: CARD_W * 0.72,
    alignItems: "center",
    justifyContent: "center",
  },
  ratingBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  heartBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  popularInfo: {
    padding: 10,
  },
  // Post card
  postCard: {
    flexDirection: "row",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 11,
  },
  postAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
  },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    gap: 5,
  },
  postAuthor: {
    fontFamily: "Roobert-Bold",
    fontSize: 14,
  },
  psaBadge: {
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  postTitle: {
    fontFamily: "Roobert-SemiBold",
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  postBody: {
    fontFamily: "Roobert-Regular",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  postMedia: {
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 10,
  },
  hotspotTag: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 5,
    marginBottom: 12,
  },
  postActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
  },
  checkinVenue: {
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 11,
  },
  checkinVenueIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  // Modals
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 44,
    maxHeight: "82%",
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 4,
  },
  sheetNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  doneCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  listAvatar: {
    width: 42,
    height: 42,
    borderRadius: 12,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  typePill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  mediaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
  },
  mediaRemove: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 14,
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedHotspot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    padding: 10,
  },
  hotspotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
  },
  imagePickBtn: {
    alignSelf: "center",
    width: 80,
    height: 80,
    borderRadius: 20,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  field: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: "Roobert-Regular",
    fontSize: 15,
  },
  fieldMulti: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
});

