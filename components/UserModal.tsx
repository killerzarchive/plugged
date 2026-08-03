import { Hotspot } from "@/app/(tabs)/explore";
import { FirstRoute, SecondRoute, ThirdRoute } from "@/app/(tabs)/profile";
import { ME_QUERY } from "@/app/apollo/queries/general";
import EventHotspotModal from "@/components/EventHotspotModal";
import PostModal from "@/components/PostModal";
import tw from "@/lib/tw";
import { gql } from "@apollo/client";
import { useMutation, useQuery } from "@apollo/client/react";
import { Star } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  Image,
  Modal,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";

export interface UserModalProps {
  visible: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    pfp: string;
    visits: number;
    ratings: number;
    bio: string;
    type: string;
    joined?: string | null;
    location?: {
      latitude?: number | null;
      longitude?: number | null;
      address?: string | null;
    };
    reviews: Array<{
      id: number;
      Comment: string;
      hotspot: {
        id: number;
        name: string;
        avatar?: string | null;
        description?: string | null;
      };
    }>;
    hotspots: Array<Hotspot>;
    posts?: Array<{
      id: number;
      title?: string | null;
      media?: string | null;
      type?: string | null;
      createdAt: string;
    }>;
    followersCount?: number;
    isFollowingUser?: boolean;
  } | null;
  onClose: () => void;
}

// Local hook to geocode an address into a map region.
// Defined here to avoid circular imports with `profile.tsx` (which imports from
// `explore.tsx`, and `explore.tsx` imports `UserModal`).
export const useUserMapRegionLocal = (address?: string | null) => {
  const [region, setRegion] = React.useState<any>(null);
  React.useEffect(() => {
    let mounted = true;
    if (address) {
      (async () => {
        try {
          const geocoded = await (
            await import("expo-location")
          ).geocodeAsync(address);
          if (geocoded && geocoded.length > 0 && mounted) {
            setRegion({
              latitude: geocoded[0].latitude,
              longitude: geocoded[0].longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            });
          }
        } catch {
          if (mounted) setRegion(null);
        }
      })();
    } else {
      setRegion(null);
    }
    return () => {
      mounted = false;
    };
  }, [address]);
  return region;
};

export default function UserModal({ visible, user, onClose }: UserModalProps) {
  const FOLLOW_USER = gql`
    mutation FollowUser($userId: Int!) {
      followUser(userId: $userId) {
        id
        isFollowingUser
        followersCount
      }
    }
  `;

  const UNFOLLOW_USER = gql`
    mutation UnfollowUser($userId: Int!) {
      unfollowUser(userId: $userId) {
        id
        isFollowingUser
        followersCount
      }
    }
  `;

  const { data: meData } = useQuery<any>(ME_QUERY);
  const [followUserMut, { loading: followLoading }] = useMutation(FOLLOW_USER, {
    refetchQueries: [{ query: ME_QUERY }],
    awaitRefetchQueries: true,
  });
  const [unfollowUserMut, { loading: unfollowLoading }] = useMutation(
    UNFOLLOW_USER,
    {
      refetchQueries: [{ query: ME_QUERY }],
      awaitRefetchQueries: true,
    }
  );

  const [localFollowing, setLocalFollowing] = useState<boolean | null>(null);
  const [localFollowers, setLocalFollowers] = useState<number | null>(
    user?.followersCount ?? null
  );
  const [userCoords, setUserCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const USER_QUERY = gql`
    query user($userId: Int!) {
      user(userId: $userId) {
        id
        name
        email
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
        joined
      }
    }
  `;

  const { data: fullUserData, loading: fullUserLoading } = useQuery<any>(
    USER_QUERY,
    {
      variables: { userId: user ? parseInt(String(user.id), 10) : 0 },
      skip:
        !user ||
        !!(user as any).location?.latitude ||
        !!(user as any).location?.address,
    }
  );
  const [activeTab, setActiveTab] = React.useState("Posts");
  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const [selectedHotspot, setSelectedHotspot] = useState<any | null>(null);
  const [hotspotModalVisible, setHotspotModalVisible] = useState(false);

  const openHotspotModal = (h: any) => {
    setSelectedHotspot(h);
    setHotspotModalVisible(true);
  };

  const closeHotspotModal = () => {
    setHotspotModalVisible(false);
    setSelectedHotspot(null);
  };
  const routes = React.useMemo(
    () => [
      { key: "Posts", title: "Posts" },
      { key: "Hotspots", title: "Hotspots" },
      { key: "Reviews", title: "Reviews" },
    ],
    []
  );
  useEffect(() => {
    if (!user) return;
    const derived =
      (user as any).isFollowingUser ||
      !!meData?.me?.following?.find(
        (u: any) => String(u.id) === String((user as any).id)
      );
    setLocalFollowing(Boolean(derived));
    setLocalFollowers(user.followersCount ?? null);
  }, [user, meData]);

  useEffect(() => {
    let mounted = true;
    const resolveCoords = async () => {
      setUserCoords(null);
      setGeocoding(false);
      if (!user && !fullUserData?.user) return;
      const loc = (user as any).location || fullUserData?.user?.location;
      if (loc?.latitude && loc?.longitude) {
        setUserCoords({ latitude: loc.latitude, longitude: loc.longitude });
        return;
      }
      if (loc?.address) {
        try {
          setGeocoding(true);
          const ExpoLocation = await import("expo-location");
          const results = await ExpoLocation.geocodeAsync(loc.address);
          if (!mounted) return;
          if (results && results.length > 0) {
            setUserCoords({
              latitude: results[0].latitude,
              longitude: results[0].longitude,
            });
          }
        } catch (e) {
          console.warn("Failed to geocode user address", e);
        } finally {
          if (mounted) setGeocoding(false);
        }
      }
    };
    resolveCoords();
    return () => {
      mounted = false;
    };
  }, [user, fullUserData]);

  const formatJoined = (joined?: string | null) => {
    if (!joined) return "";
    try {
      const d = new Date(joined);
      // e.g. "January 2024"
      return d.toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      });
    } catch {
      return joined;
    }
  };
  const handleFollowToggle = async () => {
    if (!user?.id) return;
    const idNum = parseInt(String(user.id), 10);
    try {
      if (localFollowing) {
        setLocalFollowing(false);
        setLocalFollowers((c) => (c != null ? Math.max(0, c - 1) : c));
        await unfollowUserMut({ variables: { userId: idNum } });
      } else {
        setLocalFollowing(true);
        setLocalFollowers((c) => (c != null ? c + 1 : 1));
        await followUserMut({ variables: { userId: idNum } });
      }
    } catch (e) {
      console.warn("Follow/unfollow failed", e);
    }
  };
  // derive an effective location object from either the passed-in `user` or the
  // `fullUserData` fetched from the server so we can show the address even when
  // a map is rendered from coordinates. We compute this before calling the
  // geocoding hook so the hook will run when the address comes from
  // `fullUserData` as well.
  const effectiveLocation: {
    latitude?: number | null;
    longitude?: number | null;
    address?: string | null;
  } | null = (user as any)?.location || fullUserData?.user?.location || null;
  const displayedAddress = effectiveLocation?.address ?? null;

  // Use the local geocoding hook with the effective address (may come from
  // `user` prop or `fullUserData`).
  const region = useUserMapRegionLocal(effectiveLocation?.address);

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={tw`flex-1 justify-end relative bg-black overflow-hidden bg-opacity-60`}>
        <View style={tw`h-[85%] w-full`}>
        <View style={tw`bg-black rounded-t-[40px] relative overflow-hidden `}>
            <View
            style={tw`absolute bottom-0 left-0 right-0 z-50 px-3 pb-5 pt-3 bg-black border-t border-[#222] items-center justify-center`}
          >
            <View style={tw`flex-row items-center gap-3`}>
              
                {meData?.me?.id == user?.id ? (
                  <TouchableOpacity
                style={tw`px-4 py-2 flex-1 bg-white rounded-xl`}
                  >
                    <Text
                      style={[
                        tw`text-black text-xs py-1 text-center`,
                        { fontFamily: "Roobert-SemiBold" },
                      ]}
                    >
                      Edit
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={handleFollowToggle}
                    disabled={followLoading || unfollowLoading}
                    style={
                      localFollowing
                        ? tw`border border-[#222] rounded-full px-4 py-2`
                        : tw`bg-white p-2 px-4 rounded-full`
                    }
                  >
                    <Text
                      style={
                        localFollowing
                          ? tw`text-white text-center`
                          : tw`text-black text-center`
                      }
                    >
                      {localFollowing ? "Unfollow" : "Follow"}
                    </Text>
                  </TouchableOpacity>
                )}

              <TouchableOpacity
                onPress={onClose}
                style={tw`px-4 py-2 bg-white flex-1 rounded-xl`}
              >
                <Text
                  style={[
                    tw`text-black text-center py-1`,
                    { fontFamily: "Roobert-Bold" },
                  ]}
                >
                  Close
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <ScrollView style={tw`pt-0 pb-1`} contentContainerStyle={tw`items-center justify-start`}>
            <View style={tw`bg-white w-full h-28`} />
            <View style={tw`items-center px-6 gap-4 -mt-8`}>
              {user?.pfp ? (
                <Image
                  source={{ uri: user.pfp }}
                  style={tw`w-20 h-20 border overflow-hidden border-4 border-black rounded-full`}
                />
              ) : (
                <View
                  style={tw`w-20 h-20 rounded-full bg-black border-4 border-black items-center justify-center`}
                >
                  <Text style={tw`text-white text-lg`}>
                    {user?.name?.charAt(0)?.toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            <View style={tw`mt-1 items-center justify-center`}>
              <View style={tw`items-center  justify-center`}>
                <Text
                  style={[
                    tw`text-white text-lg`,
                    { fontFamily: "Roobert-Bold" },
                  ]}
                >
                  {user?.name}
                </Text>
                <View
                  style={tw`items-center justify-center gap-4 flex-row mt-1`}
                >
                  <Text
                    style={[
                      tw`text-gray-500`,
                      { fontFamily: "Roobert-SemiBold" },
                    ]}
                  >
                    {user?.type || "Other"}
                  </Text>
                  <View style={tw`h-4 w-[1px] bg-gray-700`} />
                  <Text
                    style={[
                      tw`text-gray-500`,
                      { fontFamily: "Roobert-Medium" },
                    ]}
                  >
                    Joined {formatJoined(user?.joined)}
                  </Text>
                </View>
                {user?.bio && (
                  <Text
                    style={[
                      tw`text-white px-6 text-center text-sm mt-1`,
                      { fontFamily: "Roobert-Medium" },
                    ]}
                  >
                    {user?.bio}
                  </Text>
                )}

                {/* Hotspots badge + Map view for user's address */}
                <View
                  style={tw`mt-2 border border-[#222] p-1 px-2 max-w-24 items-center justify-center rounded-full flex-row items-center`}
                >
                  <Star size={10} color="#fff" fill="#fff" />
                  <Text
                    style={[
                      tw`text-white text-xs ml-2`,
                      { fontFamily: "Roobert-SemiBold" },
                    ]}
                  >
                    {user?.hotspots?.length} Hotspots
                  </Text>
                </View>
                </View>

                  
                    
                <View style={tw`mt-2 w-full flex flex-row gap-5`}>
                  <View style={tw`items-center flex flex-row gap-1`}>
                    <Text
                      style={[
                        tw`text-white text-sm`,
                        { fontFamily: "Roobert-Bold" },
                      ]}
                    >
                      {user?.posts?.length || 0}
                    </Text>
                    <Text
                      style={[
                        tw`text-gray-400 text-xs`,
                        { fontFamily: "Roobert-Medium" },
                      ]}
                    >
                      Posts
                    </Text>
                  </View>
                  <View style={tw`items-center flex flex-row gap-1`}>
                    <Text
                      style={[
                        tw`text-white text-sm`,
                        { fontFamily: "Roobert-Bold" },
                      ]}
                    >
                      {user?.visits || 0}
                    </Text>
                    <Text
                      style={[
                        tw`text-gray-400 text-xs`,
                        { fontFamily: "Roobert-Medium" },
                      ]}
                    >
                      Followers
                    </Text>
                  </View>
                  <View style={tw`items-center flex flex-row gap-1`}>
                    <Text
                      style={[
                        tw`text-white text-sm`,
                        { fontFamily: "Roobert-Bold" },
                      ]}
                    >
                      {user?.ratings || 0}
                    </Text>
                    <Text
                      style={[
                        tw`text-gray-400 text-xs`,
                        { fontFamily: "Roobert-Medium" },
                      ]}
                    >
                      Reviews
                    </Text>
                  </View>
                </View>
                
              </View>
            <View style={tw`px-6 pb-6 bg-black`}>
                {effectiveLocation?.address && region && (
                      <View style={[tw`h-52 rounded-2xl border border-[#222] overflow-hidden mb-4 mt-4`]}> 
                        <MapView
                          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                          style={{ flex: 1 }}
                          initialRegion={region}
                          showsUserLocation={false}
                          showsMyLocationButton={false}
                          showsCompass={true}
                          zoomControlEnabled={true}
                        >
                          <Marker
                            coordinate={{
                              latitude: region?.latitude,
                              longitude: region?.longitude,
                            }}
                          >
                            
                <View
                  style={tw`bg-black rounded-full w-8 h-8 items-center justify-center border-2 border-white`}
                >
                  {user?.pfp ? (
                    <Image
                      source={{ uri: user?.pfp }}
                      style={tw`w-6 h-6 rounded-full`}
                    />
                  ) : (
                    <Text
                      style={[
                        tw`text-white text-xs`,
                        { fontFamily: "Roobert-Bold" },
                      ]}
                    >
                      {user?.name.charAt(0)}
                    </Text>
                  )}
                </View>
                            </Marker>
                        </MapView>
                      </View>
                    )}
              
            <View style={tw`mt-2 h-72 w-full`}>
              <View
                style={tw`w-full flex items-center flex-row justify-between items-center mb-3`}
              >
                <View>
                  <Text
                    style={[
                      tw`text-white text-lg w-full`,
                      { fontFamily: "Roobert-SemiBold" },
                    ]}
                  >
                    {activeTab}
                  </Text>
                </View>
                <View
                  style={tw`flex-row bg-black gap-4 w-56 mt-4 items-center justify-center my-2 rounded-xl border border-[#222]`}
                >
                  {routes?.map((route) => {
                    const isFocused = activeTab === route.key;
                    return (
                      <TouchableOpacity
                        key={route.key}
                        onPress={() => setActiveTab(route.key)}
                        style={tw`items-center justify-center py-2`}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            tw`${isFocused ? "text-white" : "text-gray-500"}`,
                            {
                              fontFamily: isFocused
                                ? "Roobert-Bold"
                                : "Roobert-SemiBold",
                            },
                          ]}
                        >
                          {route.title}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              <View style={tw`flex-1 overflow-hidden rounded-t-[40px]`}>
                {activeTab === "Posts" ? (
                  <FirstRoute posts={user?.posts} onPress={(p) => setSelectedPost(p)} />
                ) : activeTab === "Hotspots" ? (
                  <SecondRoute hotspots={user?.hotspots || []} onPress={openHotspotModal} />
                ) : (
                  <ThirdRoute reviews={user?.reviews || []} />
                )}
              </View>
            </View>
            </View>
          </ScrollView>
        </View>
      </View>
      </View>
      <PostModal visible={!!selectedPost} post={selectedPost} onClose={() => setSelectedPost(null)} />
      <EventHotspotModal visible={hotspotModalVisible} hotspot={selectedHotspot} onClose={closeHotspotModal} />
    </Modal>
  );
}
