import { CREATE_REVIEW } from "@/app/apollo/mutations/app";
import { DARK_MAP_STYLE } from "@/constants/mapStyle";
import { gql } from "@apollo/client";
import { useMutation, useQuery } from "@apollo/client/react";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import * as ExpoLocation from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, Star } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  KeyboardAvoidingView,
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

const BLUE = "#1877F2";
const MAP_H = 200;
const AVATAR_SIZE = 72;
const { width: SW } = Dimensions.get("window");

const HOTSPOT_QUERY = gql`
  query hotspot($hotspotId: Int!) {
    hotspot(hotspotId: $hotspotId) {
      id
      name
      avatar
      description
      type
      author { id name pfp }
      posts {
        id media title type createdAt
        author { id name pfp }
      }
      location { id latitude longitude address }
      ratings
      visits
      followersCount
      isFollowingHotspot
      reviews {
        id rating comment createdAt
        user { id name pfp }
      }
    }
  }
`;

const FOLLOW_HOTSPOT = gql`
  mutation FollowHotspot($hotspotId: Int!) {
    followHotspot(hotspotId: $hotspotId) { id followersCount isFollowingHotspot }
  }
`;

const UNFOLLOW_HOTSPOT = gql`
  mutation UnfollowHotspot($hotspotId: Int!) {
    unfollowHotspot(hotspotId: $hotspotId) { id followersCount isFollowingHotspot }
  }
`;

const UPDATE_HOTSPOT_RATING = gql`
  mutation UpdateHotspotRating($hotspotId: Int!, $rating: Float!) {
    updateHotspotRating(hotspotId: $hotspotId, rating: $rating) { id ratings }
  }
`;

interface Review {
  id: string; rating: number; comment?: string; createdAt: string;
  user: { id: string; name: string; pfp?: string };
}
interface Hotspot {
  id: string; name: string; avatar?: string; description?: string; type?: string;
  author?: { id: string; name: string; pfp?: string };
  posts?: { id: string; title?: string; media?: string; type?: string; createdAt?: string; author?: { id: string; name: string; pfp?: string } }[];
  location: { id: string; latitude: number; longitude: number; address?: string };
  ratings: number; visits: number; followersCount?: number;
  isFollowingHotspot?: boolean; reviews?: Review[];
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function getFirstMedia(raw?: string | null): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const first = parsed[0];
      return typeof first === "string" ? first : first?.url ?? null;
    }
    return typeof parsed === "string" ? parsed : null;
  } catch { return raw; }
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function HotspotPin({ uri, name }: { uri?: string; name: string }) {
  return (
    <View style={{ alignItems: "center" }}>
      <View style={pinStyles.circle}>
        {uri
          ? <Image source={{ uri }} style={{ width: "100%", height: "100%", borderRadius: 999 }} resizeMode="cover" />
          : <Text style={{ color: "#fff", fontFamily: "Roobert-Bold", fontSize: 14 }}>{name[0]?.toUpperCase()}</Text>
        }
      </View>
      <View style={pinStyles.triangle} />
    </View>
  );
}

const pinStyles = StyleSheet.create({
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

export default function HotspotPage() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<"Posts" | "Reviews">("Posts");
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [mapRegion, setMapRegion] = useState<{ latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number } | null>(null);

  const { data, loading, error, refetch } = useQuery<{ hotspot: Hotspot }>(HOTSPOT_QUERY, {
    variables: { hotspotId: id ? parseInt(id, 10) : 0 },
    skip: !id,
  });
  const [followHotspot, { loading: followLoading }] = useMutation(FOLLOW_HOTSPOT);
  const [unfollowHotspot, { loading: unfollowLoading }] = useMutation(UNFOLLOW_HOTSPOT);
  const [createReview, { loading: reviewLoading }] = useMutation(CREATE_REVIEW);
  const [updateHotspotRating] = useMutation(UPDATE_HOTSPOT_RATING);

  const hotspot = data?.hotspot;

  useEffect(() => {
    if (!hotspot) return;
    const { latitude, longitude, address } = hotspot.location;
    if (latitude && longitude && !(latitude === 0 && longitude === 0)) {
      setMapRegion({ latitude, longitude, latitudeDelta: 0.012, longitudeDelta: 0.012 });
    } else if (address) {
      ExpoLocation.geocodeAsync(address)
        .then((r: ExpoLocation.LocationGeocodedLocation[]) => {
          if (r?.[0]) setMapRegion({ latitude: r[0].latitude, longitude: r[0].longitude, latitudeDelta: 0.012, longitudeDelta: 0.012 });
        })
        .catch(() => {});
    }
  }, [hotspot?.location]);

  const averageRating = React.useMemo(() => {
    if (!hotspot?.reviews?.length) return hotspot?.ratings ?? 0;
    return hotspot.reviews.reduce((a, r) => a + r.rating, 0) / hotspot.reviews.length;
  }, [hotspot?.reviews, hotspot?.ratings]);

  const handleFollowToggle = async () => {
    if (!id) return;
    Haptics.selectionAsync();
    try {
      if (hotspot?.isFollowingHotspot) {
        await unfollowHotspot({ variables: { hotspotId: parseInt(id, 10) } });
      } else {
        await followHotspot({ variables: { hotspotId: parseInt(id, 10) } });
      }
    } catch {}
  };

  const handleSubmitReview = async () => {
    if (!id || !comment.trim()) return;
    try {
      await createReview({ variables: { hotspotId: parseInt(id, 10), rating, comment: comment.trim() } });
      const { data: updated } = await refetch();
      if (updated?.hotspot?.reviews?.length) {
        const sum = updated.hotspot.reviews.reduce((a, r) => a + r.rating, 0);
        await updateHotspotRating({ variables: { hotspotId: parseInt(id, 10), rating: sum / updated.hotspot.reviews.length } });
      }
      await refetch();
      setComment(""); setRating(5); setShowReviewForm(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
  };

  const initial = hotspot?.name?.[0]?.toUpperCase() ?? "?";

  if (loading && !hotspot) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" }}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <ActivityIndicator color={BLUE} />
      </View>
    );
  }

  if (error || !hotspot) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <Text style={{ color: "#fff", fontFamily: "Roobert-Bold", fontSize: 16, marginBottom: 8 }}>Hotspot not found</Text>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.82}>
          <Text style={{ color: BLUE, fontFamily: "Roobert-SemiBold", fontSize: 14 }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const posts = hotspot.posts ?? [];
  const reviews = hotspot.reviews ?? [];
  const cellSize = SW / 3;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: "#000" }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>

        {/* ── Nav bar ───────────────────────────────────────────────────────── */}
        <View style={[styles.navBar, { marginTop: insets.top }]}>
          <TouchableOpacity onPress={() => { Haptics.selectionAsync(); router.back(); }} activeOpacity={0.82} style={styles.navBack}>
            <ArrowLeft size={18} color="#fff" strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.navTitle} numberOfLines={1}>{hotspot.name}</Text>
          <View style={styles.navActions}>
            <TouchableOpacity
              onPress={handleFollowToggle}
              activeOpacity={0.82}
              disabled={followLoading || unfollowLoading}
              style={[styles.navFollowBtn, hotspot.isFollowingHotspot && styles.navFollowBtnFollowing]}
            >
              {followLoading || unfollowLoading
                ? <ActivityIndicator color={hotspot.isFollowingHotspot ? "#fff" : "#000"} size="small" />
                : <Text style={[styles.navFollowText, hotspot.isFollowingHotspot && { color: "#fff" }]}>
                    {hotspot.isFollowingHotspot ? "Following" : "Follow"}
                  </Text>
              }
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Map zone ──────────────────────────────────────────────────────── */}
        <View style={{ position: "relative" }}>
          <View style={{ height: MAP_H + insets.top, borderTopLeftRadius: 40, borderTopRightRadius: 40, overflow: "hidden" }}>
            {mapRegion ? (
              <MapView
                style={StyleSheet.absoluteFillObject}
                provider={PROVIDER_GOOGLE}
                customMapStyle={DARK_MAP_STYLE}
                initialRegion={mapRegion}
                scrollEnabled={false} zoomEnabled={false} rotateEnabled={false}
                pitchEnabled={false} showsUserLocation={false} showsMyLocationButton={false}
                showsCompass={false} showsBuildings={false} showsTraffic={false}
                moveOnMarkerPress={false}
              >
                <Marker
                  coordinate={{ latitude: mapRegion.latitude, longitude: mapRegion.longitude }}
                  anchor={{ x: 0.5, y: 1 }} tracksViewChanges={false}
                >
                  <HotspotPin uri={hotspot.avatar} name={hotspot.name} />
                </Marker>
              </MapView>
            ) : (
              <LinearGradient
                colors={["rgba(24,119,242,0.35)", "rgba(0,0,0,0.9)", "#000"]}
                start={{ x: 0.4, y: 0 }} end={{ x: 0.6, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
            )}
          </View>
        </View>

        {/* ── Panel ─────────────────────────────────────────────────────────── */}
        <View style={{ position: "relative" }}>
          <View style={styles.avatarFloater}>
            <View style={[styles.avatar, { backgroundColor: "#000" }]}>
              {hotspot.avatar
                ? <Image source={{ uri: hotspot.avatar }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                : <Text style={styles.avatarInitial}>{initial}</Text>
              }
            </View>
          </View>

          <View style={styles.panel}>
            {/* Identity */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: BLUE }} />
              <Text style={styles.name}>{hotspot.name}</Text>
            </View>

            {hotspot.type ? (
              <View style={styles.typePill}>
                <Text style={styles.typeText}>{hotspot.type}</Text>
              </View>
            ) : null}

            {hotspot.description ? <Text style={styles.bio}>{hotspot.description}</Text> : null}

            {/* Author */}
            {hotspot.author ? (
              <TouchableOpacity
                onPress={() => { Haptics.selectionAsync(); router.push(`/profile-view?type=user&id=${hotspot.author!.id}` as any); }}
                activeOpacity={0.82} style={styles.authorRow}
              >
                {hotspot.author.pfp ? (
                  <Image source={{ uri: hotspot.author.pfp }} style={styles.authorAvatar} resizeMode="cover" />
                ) : (
                  <View style={[styles.authorAvatar, { backgroundColor: "#222", alignItems: "center", justifyContent: "center" }]}>
                    <Text style={{ color: "#fff", fontFamily: "Roobert-Bold", fontSize: 9 }}>{hotspot.author.name[0]?.toUpperCase()}</Text>
                  </View>
                )}
                <Text style={styles.authorName} numberOfLines={1}>by {hotspot.author.name}</Text>
              </TouchableOpacity>
            ) : null}

            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{fmtNum(hotspot.followersCount ?? 0)}</Text>
                <Text style={styles.statLabel}>Followers</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{fmtNum(posts.length)}</Text>
                <Text style={styles.statLabel}>Posts</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{fmtNum(hotspot.visits)}</Text>
                <Text style={styles.statLabel}>Check-ins</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{Number(averageRating).toFixed(1)}</Text>
                <Text style={styles.statLabel}>Rating</Text>
              </View>
            </View>

            {hotspot.location?.address ? (
              <Text style={styles.address} numberOfLines={2}>{hotspot.location.address}</Text>
            ) : null}
          </View>

          {/* ── Review button + form ─────────────────────────────────────────── */}
          <View style={styles.section}>
            <TouchableOpacity
              onPress={() => { Haptics.selectionAsync(); setShowReviewForm((v) => !v); }}
              activeOpacity={0.82} style={styles.reviewToggleBtn}
            >
              <Text style={styles.reviewToggleText}>{showReviewForm ? "Cancel" : "Write a Review"}</Text>
            </TouchableOpacity>
          </View>

          {showReviewForm && (
            <View style={[styles.section, { marginTop: 12 }]}>
              <View style={styles.reviewForm}>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <TouchableOpacity key={s} onPress={() => setRating(s)} activeOpacity={0.82} style={{ padding: 4 }}>
                      <Star size={24} color="#FFD700" fill={s <= rating ? "#FFD700" : "transparent"} strokeWidth={1.5} />
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  value={comment} onChangeText={setComment}
                  placeholder="Share your experience…"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  style={styles.reviewInput}
                  multiline numberOfLines={4} textAlignVertical="top"
                />
                <TouchableOpacity
                  onPress={handleSubmitReview}
                  activeOpacity={0.82}
                  disabled={reviewLoading || !comment.trim()}
                  style={[styles.submitBtn, (!comment.trim() || reviewLoading) && { opacity: 0.4 }]}
                >
                  {reviewLoading
                    ? <ActivityIndicator color="#000" size="small" />
                    : <Text style={styles.submitBtnText}>Submit Review</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── Tabs ────────────────────────────────────────────────────────── */}
          <View style={[styles.section, { marginTop: 20 }]}>
            <View style={styles.sectionHeader}>
              {(["Posts", "Reviews"] as const).map((tab) => (
                <TouchableOpacity
                  key={tab}
                  onPress={() => { Haptics.selectionAsync(); setActiveTab(tab); }}
                  activeOpacity={0.82}
                  style={{ flexDirection: "row", alignItems: "center", gap: 7 }}
                >
                  {activeTab === tab && <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: BLUE }} />}
                  <Text style={[styles.sectionTitle, activeTab !== tab && { color: "rgba(255,255,255,0.3)" }]}>{tab}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── Posts grid ──────────────────────────────────────────────────── */}
          {activeTab === "Posts" && (
            posts.length === 0 ? (
              <View style={styles.section}>
                <Text style={styles.emptyText}>No posts yet</Text>
              </View>
            ) : (
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {posts.map((post) => {
                  const uri = getFirstMedia(post.media);
                  return (
                    <View key={post.id} style={{ width: cellSize, height: cellSize, padding: 1 }}>
                      {uri
                        ? <Image source={{ uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                        : <View style={{ width: "100%", height: "100%", backgroundColor: "#111", alignItems: "center", justifyContent: "center" }}>
                            <Text style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Roobert-Regular", fontSize: 10 }}>No media</Text>
                          </View>
                      }
                    </View>
                  );
                })}
              </View>
            )
          )}

          {/* ── Reviews ─────────────────────────────────────────────────────── */}
          {activeTab === "Reviews" && (
            <View style={[styles.section, { gap: 10 }]}>
              {reviews.length === 0 ? (
                <Text style={styles.emptyText}>No reviews yet</Text>
              ) : (
                reviews.map((review) => {
                  const stars = Math.max(1, Math.round(Number(review.rating)));
                  return (
                    <View key={review.id} style={styles.reviewCard}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
                        {review.user.pfp ? (
                          <Image source={{ uri: review.user.pfp }} style={styles.reviewAvatar} resizeMode="cover" />
                        ) : (
                          <View style={[styles.reviewAvatar, { backgroundColor: "#222", alignItems: "center", justifyContent: "center" }]}>
                            <Text style={{ color: "#fff", fontFamily: "Roobert-Bold", fontSize: 11 }}>{review.user.name[0]?.toUpperCase()}</Text>
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={styles.reviewUser}>{review.user.name}</Text>
                          <Text style={styles.reviewTime}>{timeAgo(review.createdAt)} ago</Text>
                        </View>
                        <View style={styles.ratingPill}>
                          {Array.from({ length: stars }).map((_, i) => (
                            <Star key={i} size={10} color="#FFD700" fill="#FFD700" strokeWidth={0} />
                          ))}
                          <Text style={styles.ratingNum}>{review.rating}</Text>
                        </View>
                      </View>
                      {review.comment ? <Text style={styles.reviewComment}>{review.comment}</Text> : null}
                    </View>
                  );
                })
              )}
            </View>
          )}
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  navBar: {
    paddingBottom: 12, paddingHorizontal: 16,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderBottomRightRadius: 20, borderBottomLeftRadius: 20,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  navBack: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#1a1a1a",
    borderWidth: StyleSheet.hairlineWidth, borderColor: "#333",
    alignItems: "center", justifyContent: "center",
  },
  navTitle: {
    color: "#fff", fontFamily: "Roobert-Bold", fontSize: 18,
    letterSpacing: -0.4, flex: 1, textAlign: "center", marginHorizontal: 10,
  },
  navActions: {
    flexDirection: "row", alignItems: "center", gap: 8,
  },
  navFollowBtn: {
    height: 32, paddingHorizontal: 16, borderRadius: 10,
    backgroundColor: "#fff", alignItems: "center", justifyContent: "center",
  },
  navFollowBtnFollowing: {
    backgroundColor: "transparent", borderWidth: StyleSheet.hairlineWidth, borderColor: "#333",
  },
  navFollowText: {
    color: "#000", fontFamily: "Roobert-Bold", fontSize: 12, letterSpacing: -0.2,
  },
  avatarFloater: {
    position: "absolute", top: -AVATAR_SIZE,
    left: 0, right: 0, alignItems: "center", zIndex: 10,
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
  name: {
    color: "#fff", fontFamily: "Roobert-Bold", fontSize: 22,
    letterSpacing: -0.5, textAlign: "center",
  },
  typePill: {
    alignSelf: "center", marginTop: 8,
    paddingHorizontal: 13, paddingVertical: 7,
    borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: "#222",
  },
  typeText: {
    color: "#fff", fontFamily: "Roobert-SemiBold", fontSize: 10, letterSpacing: -0.1,
  },
  bio: {
    color: "#fff", fontFamily: "Roobert-Medium", fontSize: 12.5,
    lineHeight: 19, textAlign: "center", paddingHorizontal: 24, marginTop: 8,
  },
  authorRow: {
    flexDirection: "row", alignItems: "center", alignSelf: "center",
    gap: 6, marginTop: 10, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: "#222",
  },
  authorAvatar: {
    width: 18, height: 18, borderRadius: 9, overflow: "hidden",
  },
  authorName: {
    color: "rgba(255,255,255,0.5)", fontFamily: "Roobert-SemiBold",
    fontSize: 11, maxWidth: 160,
  },
  statsRow: {
    flexDirection: "row", marginHorizontal: 48, marginTop: 20,
    borderRadius: 14, overflow: "hidden",
  },
  statItem: { flex: 1, alignItems: "center", paddingVertical: 14, gap: 1.5 },
  statNum: { color: "#fff", fontFamily: "Roobert-Bold", fontSize: 15, letterSpacing: -0.5 },
  statLabel: { color: "#fff", fontFamily: "Roobert-SemiBold", fontSize: 11, letterSpacing: 0.1 },
  statDivider: { marginVertical: 10 },
  address: {
    color: "rgba(255,255,255,0.3)", fontFamily: "Roobert-Regular",
    fontSize: 11, textAlign: "center", paddingHorizontal: 28, marginTop: 10,
  },
  section: { marginTop: 10, marginHorizontal: 12 },
  sectionHeader: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 10,
  },
  sectionTitle: {
    color: "#fff", fontFamily: "Roobert-Bold", fontSize: 16, letterSpacing: -0.4,
  },
  emptyText: {
    color: "rgba(255,255,255,0.25)", fontFamily: "Roobert-Regular",
    fontSize: 13, paddingVertical: 16,
  },
  reviewToggleBtn: {
    alignSelf: "center", height: 40, paddingHorizontal: 28,
    borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: "#333",
    alignItems: "center", justifyContent: "center",
  },
  reviewToggleText: {
    color: "#fff", fontFamily: "Roobert-SemiBold", fontSize: 13,
  },
  reviewForm: {
    backgroundColor: "#111", borderRadius: 20, padding: 16,
    borderWidth: StyleSheet.hairlineWidth, borderColor: "#222",
  },
  starsRow: { flexDirection: "row", gap: 4, marginBottom: 12 },
  reviewInput: {
    backgroundColor: "#1a1a1a", borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: "#222",
    color: "#fff", fontFamily: "Roobert-Regular", fontSize: 13,
    padding: 12, minHeight: 90,
  },
  submitBtn: {
    marginTop: 12, height: 44, borderRadius: 12,
    backgroundColor: "#fff", alignItems: "center", justifyContent: "center",
  },
  submitBtnText: { color: "#000", fontFamily: "Roobert-Bold", fontSize: 14 },
  reviewCard: {
    backgroundColor: "#111", borderRadius: 16, padding: 14,
    borderWidth: StyleSheet.hairlineWidth, borderColor: "#1e1e1e",
  },
  reviewAvatar: { width: 32, height: 32, borderRadius: 16, overflow: "hidden" },
  reviewUser: {
    color: "#fff", fontFamily: "Roobert-SemiBold", fontSize: 13, letterSpacing: -0.2,
  },
  reviewTime: {
    color: "rgba(255,255,255,0.3)", fontFamily: "Roobert-Regular", fontSize: 11, marginTop: 1,
  },
  ratingPill: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "rgba(255,215,0,0.08)", borderRadius: 8,
    paddingHorizontal: 7, paddingVertical: 4,
    borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,215,0,0.2)",
  },
  ratingNum: { color: "#FFD700", fontFamily: "Roobert-Bold", fontSize: 10, marginLeft: 2 },
  reviewComment: {
    color: "rgba(255,255,255,0.6)", fontFamily: "Roobert-Regular", fontSize: 13, lineHeight: 19,
  },
});
