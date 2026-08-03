import { FirstRoute, ThirdRoute } from "@/app/(tabs)/profile";
import { CREATE_CHECKIN } from "@/app/apollo/mutations/app";
import { ME_QUERY } from "@/app/apollo/queries/general";
import tw from "@/lib/tw";
import { gql } from "@apollo/client";
import { useMutation, useQuery } from "@apollo/client/react";
import { Navigation, Star } from "lucide-react-native";
import * as ExpoLocation from "expo-location";
import React, { useEffect, useState } from "react";
import {
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker } from "react-native-maps";

interface Props {
  visible: boolean;
  hotspot: any | null;
  onClose: () => void;
}

export default function EventHotspotModal({
  visible,
  hotspot,
  onClose,
}: Props) {
  useEffect(() => {
    try {
      console.log(
        "EventHotspotModal visible:",
        visible,
        "hotspotId:",
        hotspot?.id
      );
    } catch (e) {
      // ignore logging failures
    }
  }, [visible, hotspot]);
  // Extract city and state from a full address string, remove ZIP/postal code
  const getCityState = (address?: string | null) => {
    if (!address) return null;
    const parts = address
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 0) return null;

    const zipRegex = /^\d{5}(-\d{4})?$/;
    // Remove parts that are pure zip/postal codes
    const cleaned = parts.filter((p) => !zipRegex.test(p));

    if (cleaned.length >= 2) {
      let stateCandidate = cleaned[cleaned.length - 1];
      // Remove any trailing zip left in the same part (e.g., "CA 90210")
      stateCandidate = stateCandidate.replace(/\b\d{5}(-\d{4})?\b/, "").trim();
      const cityCandidate = cleaned[cleaned.length - 2];
      return `${cityCandidate}${stateCandidate ? `, ${stateCandidate}` : ""}`;
    }

    if (parts.length >= 2) {
      // Fallback: return the last two parts
      return `${parts[parts.length - 2]}, ${parts[parts.length - 1]}`;
    }
    return parts[0] || null;
  };

  // GraphQL mutations to follow/unfollow a hotspot
  const FOLLOW_HOTSPOT = gql`
    mutation FollowHotspot($hotspotId: Int!) {
      followHotspot(hotspotId: $hotspotId) {
        id
        followersCount
        isFollowingHotspot
      }
    }
  `;

  const UNFOLLOW_HOTSPOT = gql`
    mutation UnfollowHotspot($hotspotId: Int!) {
      unfollowHotspot(hotspotId: $hotspotId) {
        id
        followersCount
        isFollowingHotspot
      }
    }
  `;

  // If the passed `hotspot` object doesn't include `author`, fetch details for display
  const HOTSPOT_DETAIL = gql`
    query HotspotDetail($hotspotId: Int!) {
      hotspot(hotspotId: $hotspotId) {
        id
        author {
          id
          name
          pfp
        }
      }
    }
  `;

  const { data: hotspotDetailData, refetch: refetchHotspotDetail } =
    useQuery<any>(HOTSPOT_DETAIL, {
      variables: {
        hotspotId: hotspot?.id ? parseInt(String(hotspot.id), 10) : 0,
      },
      skip: !hotspot?.id || !!hotspot?.author,
      fetchPolicy: "cache-and-network",
    });

  const authorToShow =
    hotspot?.author ?? hotspotDetailData?.hotspot?.author ?? null;

  const { data: meData } = useQuery<any>(ME_QUERY);
  const [followHotspotMut, { loading: followLoading }] = useMutation(
    FOLLOW_HOTSPOT,
    { refetchQueries: [{ query: ME_QUERY }], awaitRefetchQueries: true }
  );
  const [unfollowHotspotMut, { loading: unfollowLoading }] = useMutation(
    UNFOLLOW_HOTSPOT,
    { refetchQueries: [{ query: ME_QUERY }], awaitRefetchQueries: true }
  );

  const [createCheckinMut, { loading: checkinLoading }] = useMutation(
    CREATE_CHECKIN,
    { 
      onCompleted: () => {
        setCheckinSuccess(true);
        setTimeout(() => setCheckinSuccess(false), 3000);
      },
      onError: (error) => {
        console.warn('Check-in failed:', error);
      }
    }
  );

  const [checkinSuccess, setCheckinSuccess] = useState(false);
  const [localFollowing, setLocalFollowing] = useState<boolean | null>(null);
  const [localFollowers, setLocalFollowers] = useState<number | null>(
    hotspot?.followersCount ?? null
  );

  const [hotspotCoords, setHotspotCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [geocoding, setGeocoding] = useState(false);

  useEffect(() => {
    if (!hotspot) return;
    const derived =
      hotspot.isFollowingHotspot ||
      !!meData?.me?.followingEventHotspots?.find(
        (h: any) => h.id === hotspot.id
      );
    setLocalFollowing(Boolean(derived));
    setLocalFollowers(hotspot.followersCount ?? null);
  }, [hotspot, meData]);

  // Build the small follower avatar list: prefer recent post authors as proxies for followers
  const followerAvatars = React.useMemo(() => {
    const list: { id: string; name?: string; pfp?: string }[] = [];
    const pushIfNew = (u: any) => {
      if (!u || !u.id) return;
      if (!list.find((x) => String(x.id) === String(u.id))) {
        list.push({ id: String(u.id), name: u.name, pfp: u.pfp });
      }
    };
    // Include authors from recent posts (if any)
    (hotspot?.posts || []).forEach((p: any) => pushIfNew(p.author));
    // Include displayPosts authors? some APIs include displayPosts without author
    // If current user follows this event, include them at the front
    const me = meData?.me;
    const iFollow = !!me?.followingEventHotspots?.find(
      (h: any) => String(h.id) === String(hotspot?.id)
    );
    if (iFollow && me) {
      // ensure me is first
      if (!list.find((x) => x.id === String(me.id))) {
        list.unshift({ id: String(me.id), name: me.name, pfp: me.pfp });
      }
    }
    return list.slice(0, 3);
  }, [hotspot?.posts, meData, hotspot?.id]);

  // Resolve coordinates for the hotspot (use location lat/lng if available, otherwise geocode address)
  useEffect(() => {
    let mounted = true;
    setHotspotCoords(null);
    if (!hotspot) return;
    (async () => {
      try {
        setGeocoding(true);
        const loc = hotspot.location;
        if (loc?.latitude && loc?.longitude) {
          if (mounted)
            setHotspotCoords({
              latitude: loc.latitude,
              longitude: loc.longitude,
            });
          return;
        }
        if (loc?.address) {
          try {
            const results = await ExpoLocation.geocodeAsync(loc.address);
            if (mounted && results && results.length > 0) {
              setHotspotCoords({
                latitude: results[0].latitude,
                longitude: results[0].longitude,
              });
            }
          } catch (e) {
            // ignore geocode errors
          }
        }
      } finally {
        if (mounted) setGeocoding(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [hotspot]);

  // Open external site safely (prepend https:// if needed)
  const openSite = async (url?: string | null) => {
    if (!url) return;
    let safe = String(url).trim();
    if (!/^https?:\/\//i.test(safe)) safe = `https://${safe}`;
    try {
      await Linking.openURL(safe);
    } catch (e) {
      console.warn("Failed to open site", safe, e);
    }
  };

  // Format event time: "Mon 5th, 1:30 PM" -> show "Mar 5th, 1:30 PM"
  const formatEventTime = (iso?: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    const month = d.toLocaleString("en-US", { month: "short" });
    const day = d.getDate();
    const ordinal = (n: number) => {
      const j = n % 10,
        k = n % 100;
      if (j === 1 && k !== 11) return `${n}st`;
      if (j === 2 && k !== 12) return `${n}nd`;
      if (j === 3 && k !== 13) return `${n}rd`;
      return `${n}th`;
    };
    const dayStr = ordinal(day);
    const time = d.toLocaleString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return `${month} ${dayStr}, ${time}`;
  };

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
    if (!hotspot?.id) return;
    const idNum = parseInt(String(hotspot.id), 10);
    try {
      if (localFollowing) {
        // unfollow
        setLocalFollowing(false);
        setLocalFollowers((c) => (c != null ? Math.max(0, c - 1) : c));
        await unfollowHotspotMut({ variables: { hotspotId: idNum } });
      } else {
        // follow
        setLocalFollowing(true);
        setLocalFollowers((c) => (c != null ? c + 1 : 1));
        await followHotspotMut({ variables: { hotspotId: idNum } });
      }
    } catch (e) {
      console.warn("Follow/unfollow failed", e);
    }
  };

  const handleCheckin = async () => {
    if (!hotspot?.id) return;
    const idNum = parseInt(String(hotspot.id), 10);
    try {
      await createCheckinMut({ variables: { hotspotId: idNum } });
    } catch (e) {
      console.warn('Check-in failed', e);
    }
  };

  // Add activeTab and routes state
  const [activeTab, setActiveTab] = useState("Posts");
  const routes = [
    { key: "Posts", title: "Posts" },
    { key: "Reviews", title: "Reviews" },
  ];

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View
        style={tw`flex-1 justify-end relative bg-black overflow-hidden bg-opacity-60`}
      >
        <View
          style={tw`h-[85%] w-full bg-black border border-[#222] rounded-t-[40px] overflow-hidden`}
        >
          <View
            style={tw`absolute bottom-0 left-0 bg-black right-0 z-50 px-3 pb-5 pt-3 bg-black border-t border-[#222] items-center justify-center`}
          >
            <View style={tw`flex-row items-center gap-2 w-full`}>
              {hotspot?.id ? (
                <TouchableOpacity
                  onPress={handleFollowToggle}
                  disabled={followLoading || unfollowLoading}
                  style={
                    localFollowing
                      ? tw`border border-[#222] rounded-xl px-3 py-2 flex-1 items-center`
                      : tw`bg-white p-2 px-3 rounded-xl flex-1 items-center`
                  }
                >
                  <Text
                    style={[
                      localFollowing
                        ? tw`text-white py-1 text-sm`
                        : tw`text-black py-1 text-sm`,
                      { fontFamily: "Roobert-Bold" },
                    ]}
                  >
                    {localFollowing ? "Unfollow" : "Follow"}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={tw`flex-1`} />
              )}

              {hotspot?.id && (
                <TouchableOpacity
                  onPress={handleCheckin}
                  disabled={checkinLoading}
                  style={
                    checkinSuccess
                      ? tw`bg-green-500 px-3 py-2 rounded-xl flex-1 items-center`
                      : tw`bg-blue-500 px-3 py-2 rounded-xl flex-1 items-center`
                  }
                >
                  <Text
                    style={[
                      tw`text-white py-1 text-sm text-center`,
                      { fontFamily: "Roobert-Bold" },
                    ]}
                  >
                    {checkinLoading ? "Checking in..." : checkinSuccess ? "Checked in!" : "Check-in"}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={onClose}
                style={tw`px-3 py-2 bg-white flex-1 rounded-xl`}
              >
                <Text
                  style={[
                    tw`text-black text-center py-1 text-sm`,
                    { fontFamily: "Roobert-Bold" },
                  ]}
                >
                  Close
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            style={tw`pt-0 pb-1`}
            contentContainerStyle={tw`items-center justify-start`}
          >
            
            <View style={tw`w-full mt-20 mb-3`}>
              <View style={tw`items-center px-6 gap-4 -mt-14 mb-2`}>
                {hotspot?.avatar ? (
                  <Image
                    source={{ uri: hotspot.avatar }}
                    style={tw`w-20 h-20 border border-[#222] rounded-full`}
                  />
                ) : (
                  <View
                    style={tw`w-20 h-20 rounded-full bg-black border border-[#222] items-center justify-center`}
                  >
                    <Text style={tw`text-white text-lg`}>
                      {hotspot?.name?.charAt(0)?.toUpperCase()}
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
                    {hotspot?.name}
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
                      {hotspot?.type || "Other"}
                    </Text>
                    <View style={tw`h-4 w-[1px] bg-gray-700`} />
                    <Text
                      style={[
                        tw`text-gray-500`,
                        { fontFamily: "Roobert-Medium" },
                      ]}
                    >
                      Created {formatJoined(hotspot?.createdAt)}
                    </Text>
                  </View>
                  {hotspot?.description && (
                    <Text
                      style={[
                        tw`text-white px-6 text-center text-sm mt-1`,
                        { fontFamily: "Roobert-Medium" },
                      ]}
                    >
                      {hotspot?.description}
                    </Text>
                  )}
                  <View
                    style={tw`mt-2 border border-[#222] p-1 px-4 max-w-32 items-center justify-center rounded-full flex-row items-center`}
                  >
                    <Text
                      style={[
                        tw`text-white text-green-400 text-xs`,
                        { fontFamily: "Roobert-Bold" },
                      ]}
                    >
                      {hotspot?.isEvent === true ? "Event" : "Hotspot"}
                    </Text>
                  </View>
                  {/* Hotspots badge + Map view for user's address */}
                  <View
                    style={tw`mt-2 border border-[#222] p-1 px-2 max-w-32 items-center justify-center rounded-full flex-row items-center`}
                  >
                    <Navigation size={10} color="#fff" />
                    <Text
                      style={[
                        tw`text-white text-xs ml-2`,
                        { fontFamily: "Roobert-SemiBold" },
                      ]}
                    >
                      {hotspot?.isEvent === true
                        ? `${hotspot?.followersCount} Followed`
                        : `${hotspot?.checkins?.length} Checked in`}
                    </Text>
                  </View>
                  <View
                    style={tw`mt-2 ${hotspot?.isEvent === true ? 'hidden' : 'flex'} border border-[#222] p-1 px-2 max-w-32 items-center justify-center rounded-full flex-row items-center`}
                  >
                    <Star size={10} color="yellow" fill="yellow" />
                    <Text
                      style={[
                        tw`text-white text-xs ml-2`,
                        { fontFamily: "Roobert-SemiBold" },
                      ]}
                    >
                      {hotspot?.ratings}/5 Stars
                    </Text>
                  </View>
                </View>

                <View
                  style={tw`mt-2 w-full items-center justify-center flex flex-row ${
                    hotspot?.isEvent === true ? "hidden" : "flex"
                  } gap-3`}
                >
                  <View style={tw`items-center flex flex-col gap-1`}>
                    <Text
                      style={[
                        tw`text-white text-sm`,
                        { fontFamily: "Roobert-Bold" },
                      ]}
                    >
                      {hotspot?.posts?.length || 0}
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
                  <View style={tw`items-center flex flex-col gap-1`}>
                    <Text
                      style={[
                        tw`text-white text-sm`,
                        { fontFamily: "Roobert-Bold" },
                      ]}
                    >
                      {hotspot?.followersCount || 0}
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
                  <View style={tw`items-center flex flex-col gap-1`}>
                    <Text
                      style={[
                        tw`text-white text-sm`,
                        { fontFamily: "Roobert-Bold" },
                      ]}
                    >
                      {hotspot?.ratings || 0}
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
            </View>
            {hotspot?.site ? (
              <TouchableOpacity
                onPress={() => openSite(hotspot.site)}
                style={tw`mb-3`}
              >
                <Text
                  style={[
                    tw`text-white underline`,
                    { fontFamily: "Roobert-SemiBold" },
                  ]}
                  numberOfLines={1}
                >
                  {hotspot.site}
                </Text>
              </TouchableOpacity>
            ) : null}
            <View style={tw`flex-1 w-full px-6 mt-2`}>
              {hotspotCoords ? (
                <View style={tw`mb-3 rounded-2xl overflow-hidden w-full`}>
                  <MapView
                    provider={Platform.OS === "android" ? undefined : undefined}
                    initialRegion={{
                      latitude: hotspotCoords.latitude,
                      longitude: hotspotCoords.longitude,
                      latitudeDelta: 0.01,
                      longitudeDelta: 0.01,
                    }}
                    style={{ width: "100%", height: 210 }}
                    scrollEnabled={false}
                    zoomEnabled={false}
                  >
                    <Marker
                      coordinate={{
                        latitude: hotspotCoords.latitude,
                        longitude: hotspotCoords.longitude,
                      }}
                      title={hotspot?.name}
                    >
                      <View style={tw`items-center`}>
                        <View
                          style={tw`bg-black rounded-full w-8 h-8 items-center justify-center border-2 border-white`}
                        >
                          {hotspot?.avatar ? (
                            <Image
                              source={{ uri: hotspot.avatar }}
                              style={tw`w-6 h-6 rounded-full`}
                            />
                          ) : (
                            <Text
                              style={[
                                tw`text-white text-xs`,
                                { fontFamily: "Roobert-Bold" },
                              ]}
                            >
                              {hotspot?.name.charAt(0)}
                            </Text>
                          )}
                        </View>
                        <View
                          style={tw`w-0 h-0 border-l-4 border-r-4 border-t-8 border-l-transparent border-r-transparent border-t-black`}
                        />
                      </View>
                    </Marker>
                  </MapView>
                </View>
              ) : geocoding ? (
                <Text style={tw`text-gray-400 text-xs mt-2`}>Loading map…</Text>
              ) : null}
            </View>
            <View style={tw`border border-[#222] px-4 py-2 rounded-xl`}>
              <Text
                numberOfLines={1}
                style={[
                  tw`text-white text-xs`,
                  { fontFamily: "Roobert-SemiBold" },
                ]}
              >
                {hotspot?.location?.address ??
                  hotspot?.address ??
                  "No address provided"}
              </Text>
            </View>
            <View style={tw`flex-row items-center justify-center w-full mb-3`}>
              <View>
                {hotspot?.time && (
                  <>
                    <Text
                      style={[
                        tw`text-gray-400 text-center mt-2 text-xs`,
                        { fontFamily: "Roobert-SemiBold" },
                      ]}
                    >
                      Time
                    </Text>
                    <Text
                      style={[
                        tw`text-white`,
                        { fontFamily: "Roobert-SemiBold" },
                      ]}
                    >
                      {formatEventTime(hotspot.time)}
                    </Text>
                  </>
                )}
              </View>
            </View>
            <View
              style={tw`h-inherit px-6 w-full ${
                hotspot?.isEvent === true ? "hidden" : "flex"
              }`}
            >
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
                  style={tw`flex-row bg-black gap-4 w-36 mt-4 items-center justify-center my-2 rounded-xl border border-[#222]`}
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
                  <FirstRoute posts={hotspot?.posts} />
                ) :  (
                  <ThirdRoute reviews={hotspot?.reviews || []} />
                )}
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
