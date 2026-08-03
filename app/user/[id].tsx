import { DARK_MAP_STYLE } from "@/constants/mapStyle";
import { gql } from "@apollo/client";
import { useMutation, useQuery } from "@apollo/client/react";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import React from "react";
import {
  ActivityIndicator,
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
import Svg, { Path } from "react-native-svg";

const BLUE = "#1877F2";
const MAP_H = 200;
const AVATAR_SIZE = 72;

const USER_QUERY = gql`
  query user($userId: Int!) {
    user(userId: $userId) {
      id
      name
      pfp
      bio
      visits
      ratings
      followersCount
      followingCount
      isFollowingUser
      location {
        latitude
        longitude
        address
      }
    }
  }
`;

const ME_QUERY = gql`
  query Me { me { id } }
`;

const FOLLOW_USER = gql`
  mutation FollowUser($userId: Int!) {
    followUser(userId: $userId) { id isFollowingUser followersCount }
  }
`;

const UNFOLLOW_USER = gql`
  mutation UnfollowUser($userId: Int!) {
    unfollowUser(userId: $userId) { id isFollowingUser followersCount }
  }
`;

interface User {
  id: string;
  name: string;
  pfp?: string;
  bio?: string;
  visits: number;
  ratings: number;
  followersCount: number;
  followingCount: number;
  isFollowingUser: boolean;
  location?: { latitude: number; longitude: number; address?: string };
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function UserPin({ uri, name }: { uri?: string; name: string }) {
  const initial = name[0]?.toUpperCase() ?? "?";
  return (
    <View style={{ alignItems: "center" }}>
      <View style={pinStyles.circle}>
        {uri ? (
          <Image source={{ uri }} style={{ width: "100%", height: "100%", borderRadius: 999 }} resizeMode="cover" />
        ) : (
          <Text style={{ color: "#fff", fontFamily: "Roobert-Bold", fontSize: 14 }}>{initial}</Text>
        )}
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

export default function UserPage() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data, loading, error, refetch } = useQuery<{ user: User }>(USER_QUERY, {
    variables: { userId: id ? parseInt(id, 10) : 0 },
    skip: !id,
  });
  const { data: meData } = useQuery<{ me: { id: string } }>(ME_QUERY);
  const [followUser, { loading: followLoading }] = useMutation(FOLLOW_USER);
  const [unfollowUser, { loading: unfollowLoading }] = useMutation(UNFOLLOW_USER);

  const user = data?.user;
  const isOwnProfile = meData?.me?.id === id;
  const initial = user?.name?.[0]?.toUpperCase() ?? "?";
  const hasLocation = !!(
    user?.location?.latitude && user?.location?.longitude &&
    !(user.location.latitude === 0 && user.location.longitude === 0)
  );

  const handleFollowToggle = async () => {
    if (!id || !user) return;
    try {
      Haptics.selectionAsync();
      if (user.isFollowingUser) {
        await unfollowUser({ variables: { userId: parseInt(id, 10) } });
      } else {
        await followUser({ variables: { userId: parseInt(id, 10) } });
      }
      await refetch();
    } catch {}
  };

  if (loading && !user) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" }}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <ActivityIndicator color={BLUE} />
      </View>
    );
  }

  if (error || !user) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <Text style={{ color: "#fff", fontFamily: "Roobert-Bold", fontSize: 16, marginBottom: 8 }}>User not found</Text>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.82}>
          <Text style={{ color: BLUE, fontFamily: "Roobert-SemiBold", fontSize: 14 }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>

        {/* ── Nav bar ───────────────────────────────────────────────────────── */}
        <View style={[styles.navBar, { marginTop: insets.top }]}>
          <TouchableOpacity onPress={() => { Haptics.selectionAsync(); router.back(); }} activeOpacity={0.82} style={styles.navBack}>
            <ArrowLeft size={18} color="#fff" strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.navTitle}>{user.name}</Text>
          <View style={styles.navAvatar}>
            {user.pfp ? (
              <Image source={{ uri: user.pfp }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
            ) : (
              <Text style={{ color: "#fff", fontFamily: "Roobert-Bold", fontSize: 13 }}>{initial}</Text>
            )}
          </View>
        </View>

        {/* ── Map zone ──────────────────────────────────────────────────────── */}
        <View style={{ position: "relative" }}>
          <View style={{ height: MAP_H + insets.top, borderTopLeftRadius: 40, borderTopRightRadius: 40, overflow: "hidden" }}>
            {hasLocation ? (
              <MapView
                style={StyleSheet.absoluteFillObject}
                provider={PROVIDER_GOOGLE}
                customMapStyle={DARK_MAP_STYLE}
                initialRegion={{
                  latitude: user.location!.latitude,
                  longitude: user.location!.longitude,
                  latitudeDelta: 0.025,
                  longitudeDelta: 0.025,
                }}
                scrollEnabled={false} zoomEnabled={false} rotateEnabled={false}
                pitchEnabled={false} showsUserLocation={false} showsMyLocationButton={false}
                showsCompass={false} showsBuildings={false} showsTraffic={false}
                moveOnMarkerPress={false}
              >
                <Marker
                  coordinate={{ latitude: user.location!.latitude, longitude: user.location!.longitude }}
                  anchor={{ x: 0.5, y: 1 }} tracksViewChanges={false}
                >
                  <UserPin uri={user.pfp} name={user.name} />
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

        {/* ── Profile panel ─────────────────────────────────────────────────── */}
        <View style={{ position: "relative" }}>
          <View style={styles.avatarFloater}>
            <View style={[styles.avatar, { backgroundColor: "#000" }]}>
              {user.pfp ? (
                <Image source={{ uri: user.pfp }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
              ) : (
                <Text style={styles.avatarInitial}>{initial}</Text>
              )}
            </View>
          </View>

          <View style={styles.panel}>
            {/* Identity */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: BLUE }} />
              <Text style={styles.name}>{user.name}</Text>
            </View>

            {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}

            {user.location?.address ? (
              <Text style={styles.locationText} numberOfLines={1}>{user.location.address}</Text>
            ) : null}

            {/* Follow button */}
            {!isOwnProfile && (
              <TouchableOpacity
                onPress={handleFollowToggle}
                activeOpacity={0.82}
                disabled={followLoading || unfollowLoading}
                style={[styles.followBtn, user.isFollowingUser && styles.followBtnFollowing]}
              >
                {followLoading || unfollowLoading ? (
                  <ActivityIndicator color={user.isFollowingUser ? "#fff" : "#000"} size="small" />
                ) : (
                  <Text style={[styles.followBtnText, user.isFollowingUser && { color: "#fff" }]}>
                    {user.isFollowingUser ? "Following" : "Follow"}
                  </Text>
                )}
              </TouchableOpacity>
            )}

            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{fmtNum(user.followersCount)}</Text>
                <Text style={styles.statLabel}>Followers</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{fmtNum(user.followingCount)}</Text>
                <Text style={styles.statLabel}>Following</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{fmtNum(user.visits)}</Text>
                <Text style={styles.statLabel}>Check-ins</Text>
              </View>
            </View>
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  navBar: {
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderBottomRightRadius: 20,
    borderBottomLeftRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  navBack: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#1a1a1a",
    borderWidth: StyleSheet.hairlineWidth, borderColor: "#333",
    alignItems: "center", justifyContent: "center",
  },
  navTitle: {
    color: "#fff", fontFamily: "Roobert-Bold", fontSize: 18, letterSpacing: -0.4,
  },
  navAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#1a1a1a", borderWidth: 2, borderColor: "#fff",
    overflow: "hidden", alignItems: "center", justifyContent: "center",
  },
  avatarFloater: {
    position: "absolute",
    top: -AVATAR_SIZE,
    left: 0, right: 0,
    alignItems: "center",
    zIndex: 10,
  },
  avatar: {
    width: AVATAR_SIZE, height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    overflow: "hidden", alignItems: "center", justifyContent: "center",
    borderWidth: 5, borderColor: "#000",
  },
  avatarInitial: {
    color: "#fff", fontFamily: "Roobert-Bold", fontSize: 32,
  },
  panel: {
    marginTop: -42,
    borderRadius: 40,
    backgroundColor: "#000",
    paddingTop: AVATAR_SIZE / 2 + 12,
    paddingBottom: 22,
    overflow: "hidden",
  },
  name: {
    color: "#fff", fontFamily: "Roobert-Bold", fontSize: 22,
    letterSpacing: -0.5, textAlign: "center",
  },
  bio: {
    color: "#fff", fontFamily: "Roobert-Medium", fontSize: 12.5,
    lineHeight: 19, textAlign: "center", paddingHorizontal: 24, marginTop: 8,
  },
  locationText: {
    color: "rgba(255,255,255,0.4)", fontFamily: "Roobert-Regular", fontSize: 12,
    textAlign: "center", marginTop: 5, paddingHorizontal: 24,
  },
  followBtn: {
    alignSelf: "center", marginTop: 16,
    height: 40, paddingHorizontal: 36,
    borderRadius: 12, backgroundColor: "#fff",
    alignItems: "center", justifyContent: "center",
  },
  followBtnFollowing: {
    backgroundColor: "transparent",
    borderWidth: StyleSheet.hairlineWidth, borderColor: "#333",
  },
  followBtnText: {
    color: "#000", fontFamily: "Roobert-Bold", fontSize: 14, letterSpacing: -0.2,
  },
  statsRow: {
    flexDirection: "row",
    marginHorizontal: 48,
    marginTop: 20,
    borderRadius: 14,
    overflow: "hidden",
  },
  statItem: {
    flex: 1, alignItems: "center", paddingVertical: 14, gap: 2,
  },
  statNum: {
    color: "#fff", fontFamily: "Roobert-Bold", fontSize: 15, letterSpacing: -0.5,
  },
  statLabel: {
    color: "#fff", fontFamily: "Roobert-SemiBold", fontSize: 11, letterSpacing: 0.1,
  },
  statDivider: {
    marginVertical: 10,
  },
  section: {
    marginTop: 10, marginHorizontal: 12,
  },
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
});
