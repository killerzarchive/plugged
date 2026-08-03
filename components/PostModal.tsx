import { client as apolloClient } from "@/app/apollo/client";
import { ALL_HOTSPOTS, GET_POST } from "@/app/apollo/queries/general";
import tw from "@/lib/tw";
import { gql } from "@apollo/client";
import { useMutation, useQuery } from "@apollo/client/react";
import { Video } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import { Link } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Image,
    Linking,
    Modal,
    Platform,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";

export interface PostItem {
  id: string;
  caption?: string;
  media?: string;
  likes: number;
  comments: number;
  content: string;
  createdAt: string;
  author: { id: string; name: string; pfp?: string };
  hotspot?: {
    id: string;
    name: string;
    type: string;
    avatar?: string;
    description?: string;
    location: {
      id?: string;
      latitude?: number;
      longitude?: number;
      address?: string;
    };
  } & { ratings?: number };
}

export default function PostModal({
  visible,
  post,
  onClose,
}: {
  visible: boolean;
  post: PostItem | null;
  onClose: () => void;
}) {
  if (!post) return null;

  const media = post?.media || undefined;
  const isVideo = media
    ? (media.toLowerCase().endsWith(".mov") || media.toLowerCase().includes(".mp4") || media.toLowerCase().includes("video"))
    : false;
  const [region, setRegion] = useState<any | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeResults, setGeocodeResults] = useState<any[] | null>(null);
  const [selectedGeocode, setSelectedGeocode] = useState<any | null>(null);
  const [hotspotCoords, setHotspotCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const runGeocode = async (loc: { address?: string } | null) => {
    if (!loc || !loc.address) return null;
    try {
      setGeocoding(true);
      const ExpoLocation = await import("expo-location");
      // normalize address: remove newlines and excess whitespace
      const normalized = loc.address
        .replace(/\n+/g, ", ")
        .replace(/\s+/g, " ")
        .trim();
      const results = await ExpoLocation.geocodeAsync(normalized);
      setGeocodeResults(results || []);
      if (results && results.length > 0) setSelectedGeocode(results[0]);
      return results || [];
    } catch (e) {
      console.warn("PostModal: failed to geocode hotspot address", e);
      return null;
    } finally {
      setGeocoding(false);
    }
  };
  const LIKE_POST_MUTATION = gql`
    mutation LikePost($postId: Int!) {
      likePost(postId: $postId) {
        id
        likesCount
        isLikedByMe
      }
    }
  `;

  const UNLIKE_POST_MUTATION = gql`
    mutation UnlikePost($postId: Int!) {
      unlikePost(postId: $postId) {
        id
        likesCount
        isLikedByMe
      }
    }
  `;

  // Local like state to make the UI responsive in the modal
  const [localLikesCount, setLocalLikesCount] = useState<number>(
    (post as any).likesCount ?? post.likes ?? 0
  );
  const [localIsLiked, setLocalIsLiked] = useState<boolean>(
    (post as any).isLikedByMe ?? false
  );
  useEffect(() => {
    setLocalLikesCount((post as any).likesCount ?? post.likes ?? 0);
    setLocalIsLiked((post as any).isLikedByMe ?? false);
  }, [post]);

  const [likePostMut, { loading: likeLoading }] = useMutation(
    LIKE_POST_MUTATION,
    {
      update(cache, { data }) {
        const updated = (data as any)?.likePost;
        if (!updated) return;
        try {
          const id = cache.identify({ __typename: "Post", id: updated.id });
          cache.writeFragment({
            id,
            fragment: gql`
              fragment PostLike on Post {
                likesCount
                isLikedByMe
              }
            `,
            data: {
              likesCount: updated.likesCount,
              isLikedByMe: updated.isLikedByMe,
            },
          });
        } catch (e) {
          // ignore cache updates
        }
      },
    }
  );

  const [unlikePostMut, { loading: unlikeLoading }] = useMutation(
    UNLIKE_POST_MUTATION,
    {
      update(cache, { data }) {
        const updated = (data as any)?.unlikePost;
        if (!updated) return;
        try {
          const id = cache.identify({ __typename: "Post", id: updated.id });
          cache.writeFragment({
            id,
            fragment: gql`
              fragment PostLike on Post {
                likesCount
                isLikedByMe
              }
            `,
            data: {
              likesCount: updated.likesCount,
              isLikedByMe: updated.isLikedByMe,
            },
          });
        } catch (e) {
          // ignore cache updates
        }
      },
    }
  );

  const [isMutating, setIsMutating] = useState(false);

  const handleLike = async () => {
    if (!post?.id) return;
    if (isMutating) return;
    const prevLiked = localIsLiked;
    const prevCount = localLikesCount;
    const newLiked = !prevLiked;
    const newCount = prevCount + (newLiked ? 1 : -1);

    // Optimistically update UI
    setLocalIsLiked(newLiked);
    setLocalLikesCount(newCount);
    setIsMutating(true);

    try {
      if (newLiked) {
        await likePostMut({
          variables: { postId: parseInt(post.id, 10) },
          optimisticResponse: {
            likePost: {
              __typename: "Post",
              id: parseInt(post.id, 10),
              likesCount: newCount,
              isLikedByMe: newLiked,
            },
          },
        });
      } else {
        await unlikePostMut({
          variables: { postId: parseInt(post.id, 10) },
          optimisticResponse: {
            unlikePost: {
              __typename: "Post",
              id: parseInt(post.id, 10),
              likesCount: newCount,
              isLikedByMe: newLiked,
            },
          },
        });
      }
    } catch (e) {
      const msg = (e as any)?.message || JSON.stringify(e);
      if (msg && (/already liked/i.test(msg) || /already unliked/i.test(msg))) {
        try {
          const res = await apolloClient.query({
            query: GET_POST,
            variables: { id: parseInt(post.id, 10) },
            fetchPolicy: "network-only",
          });
          const server = (res as any)?.data?.postById;
          if (server) {
            setLocalIsLiked(Boolean(server.isLikedByMe));
            setLocalLikesCount(server.likesCount ?? prevCount);
            return;
          }
        } catch (err) {
          // ignore
        }
      }
      // generic rollback on other errors
      setLocalIsLiked(prevLiked);
      setLocalLikesCount(prevCount);
      console.warn("Failed to like/unlike post", e);
    } finally {
      setIsMutating(false);
    }
  };

  // populate hotspotCoords from lat/lng or geocode
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const loc = post?.hotspot?.location;
      if (!loc) return;
      // consider explicit coordinates only when they are present and not the invalid 0,0 pair
      const hasLat = typeof loc.latitude === "number";
      const hasLon = typeof loc.longitude === "number";
      const coordsAreZero =
        hasLat && hasLon && loc.latitude === 0 && loc.longitude === 0;
      if (hasLat && hasLon && !coordsAreZero) {
        if (mounted) {
          setHotspotCoords({
            latitude: loc.latitude as number,
            longitude: loc.longitude as number,
          });
          setSelectedGeocode(null);
        }
        return;
      }
      if (loc.address) {
        try {
          const results = await runGeocode(loc);
          if (mounted && results && results.length > 0) {
            setHotspotCoords({
              latitude: results[0].latitude,
              longitude: results[0].longitude,
            });
          }
        } catch (e) {
          console.warn("Failed to geocode hotspot address", e);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [post]);

  // sync region from hotspotCoords
  useEffect(() => {
    if (hotspotCoords) {
      setRegion({
        latitude: hotspotCoords.latitude,
        longitude: hotspotCoords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    } else {
      setRegion(null);
    }
  }, [hotspotCoords]);

  const getCityState = (address?: string | null) => {
    if (!address) return null;
    const parts = address
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 0) return null;

    const zipRegex = /^\d{5}(-\d{4})?$/;
    const cleaned = parts.filter((p) => !zipRegex.test(p));

    if (parts.length >= 4) {
      const city = parts[1];
      const state = parts[2].replace(/\b\d{5}(-\d{4})?\b/, "").trim();
      return `${city}${state ? `, ${state}` : ""}`;
    }
    if (parts.length === 3) {
      const city = parts[0];
      const state = parts[1].replace(/\b\d{5}(-\d{4})?\b/, "").trim();
      return `${city}${state ? `, ${state}` : ""}`;
    }
    if (parts.length === 2) {
      const city = parts[0];
      const state = parts[1].replace(/\b\d{5}(-\d{4})?\b/, "").trim();
      return `${city}${state ? `, ${state}` : ""}`;
    }
    return parts[0] || null;
  };

  // compute marker coord helper
  const markerCoord = hotspotCoords
    ? { latitude: hotspotCoords.latitude, longitude: hotspotCoords.longitude }
    : selectedGeocode
    ? {
        latitude: selectedGeocode.latitude,
        longitude: selectedGeocode.longitude,
      }
    : geocodeResults && geocodeResults.length > 0
    ? {
        latitude: geocodeResults[0].latitude,
        longitude: geocodeResults[0].longitude,
      }
    : null;

  const openInMaps = async (lat?: number, lon?: number, label?: string) => {
    if (lat == null || lon == null) return;
    try {
      const q = `${lat},${lon}`;
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        q
      )}`;
      await Linking.openURL(url);
    } catch (e) {
      console.warn("Failed to open maps", e);
    }
  };

  // Fetch all hotspots (server doesn't expose hotspotById); we'll pick the relevant hotspot
  const { data: hotspotsData } = useQuery(ALL_HOTSPOTS, {
    skip: !post?.hotspot?.id,
  });

  // derive unique authors who posted at this hotspot
  const authorsAtHotspot = React.useMemo(() => {
    try {
      const list = ((hotspotsData as any)?.allHotspots || []) as any[];
      const target = list.find(
        (h: any) => String(h.id) === String(post?.hotspot?.id)
      );
      if (!target || !target.posts) return [];
      const map: Record<string, any> = {};
      for (const p of target.posts) {
        if (p?.author) map[String(p.author.id)] = p.author;
      }
      return Object.values(map) as Array<{
        id: string;
        name: string;
        pfp?: string;
      }>;
    } catch (e) {
      return [];
    }
  }, [hotspotsData, post?.hotspot?.id]);

  // (Authors are rendered below the map as a horizontal row.)

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View
        style={tw`flex-1 justify-end relative bg-black overflow-hidden bg-opacity-60`}
      >
        <View
          style={tw`h-[85%] w-full relative border-[#222] border bg-black overflow-hidden rounded-t-[40px]`}
        >
          {/* Footer area: absolute at bottom of modal panel. Place buttons here. */}
          <View
            style={tw`absolute bottom-0 left-0 right-0 z-50 px-3 pb-5 pt-3 bg-black border-t border-[#222] items-center justify-center`}
          >
            <View style={tw`w-full flex-row items-center gap-3`}>
              <TouchableOpacity
                onPress={onClose}
                style={tw`px-4 py-2 flex-1 bg-white rounded-xl`}
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
              <TouchableOpacity
                onPress={handleLike}
                disabled={isMutating || likeLoading || unlikeLoading}
                style={tw`py-1 flex-1 border h-full items-center justify-center border-[#222] rounded-xl`}
              >
                <Text
                  style={[
                    tw`text-white text-center py-1`,
                    { fontFamily: "Roobert-Bold" },
                  ]}
                >
                  {localIsLiked ? "Liked" : "Like"}{" "}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <ScrollView
            style={{ flex: 1 }}
            // add extra bottom padding to keep content above the footer
            contentContainerStyle={{ paddingBottom: 80 }}
            showsVerticalScrollIndicator={false}
          >
            {media ? (
              isVideo ? (
                <View style={tw`relative`}>
                  <Link
                    href={{
                      pathname: "/user/[id]",
                      params: { id: post.author.id },
                    }}
                    asChild
                  >
                    <TouchableOpacity
                      style={tw`flex-row w-full gap-2 absolute top-3 left-2 z-50  justify-between px-4 items-center mb-4`}
                    >
                      <View style={tw`flex-row items-center gap-2`}>
                        {post.author.pfp ? (
                          <View style={tw`relative`}>
                            <LinearGradient
                              colors={["#FF0080", "#7928CA"]}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={tw`rounded-full w-10 h-10 flex items-center justify-center`}
                            >
                              <Image
                                source={{ uri: post.author.pfp }}
                                style={tw`w-9 h-9 rounded-full`}
                              />
                            </LinearGradient>
                            <Image
                              source={{ uri: post?.hotspot?.avatar }}
                              style={tw`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-black`}
                            />
                          </View>
                        ) : (
                          <View
                            style={tw`w-9 h-9 rounded-full mr-3 bg-gray-700 items-center justify-center`}
                          >
                            <Text style={tw`text-white text-lg`}>
                              {post.author.name[0]?.toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <View>
                          <Text
                            style={[
                              tw`text-white text-sm`,
                              { fontFamily: "Roobert-Bold" },
                            ]}
                          >
                            {post.author.name}
                          </Text>
                          <Text
                            style={[
                              tw`text-white text-xs`,
                              { fontFamily: "Roobert-Medium" },
                            ]}
                          >
                            {post.hotspot
                              ? `${post.hotspot.name}${
                                  post.hotspot.location?.address
                                    ? ` · ${getCityState(
                                        post.hotspot.location.address
                                      )}`
                                    : " •"
                                }`
                              : "Posted"}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  </Link>
                 <Video
                  source={{ uri: media }}
                  style={{ width: "100%", height: 370 }}
                  useNativeControls
                  shouldPlay={true}
                  isLooping={true}
                  resizeMode={"cover" as any}
                />
                </View>
              ) : (
                <View style={tw`relative`}>
                  <Link
                    href={{
                      pathname: "/user/[id]",
                      params: { id: post.author.id },
                    }}
                    asChild
                  >
                    <TouchableOpacity
                      style={tw`flex-row w-full gap-2 absolute top-3 left-2 z-50  justify-between px-4 items-center mb-4`}
                    >
                      <View style={tw`flex-row items-center gap-2`}>
                        {post.author.pfp ? (
                          <View style={tw`relative`}>
                            <LinearGradient
                              colors={["#FF0080", "#7928CA"]}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={tw`rounded-full w-10 h-10 flex items-center justify-center`}
                            >
                              <Image
                                source={{ uri: post.author.pfp }}
                                style={tw`w-9 h-9 rounded-full`}
                              />
                            </LinearGradient>
                            <Image
                              source={{ uri: post?.hotspot?.avatar }}
                              style={tw`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-black`}
                            />
                          </View>
                        ) : (
                          <View
                            style={tw`w-9 h-9 rounded-full mr-3 bg-gray-700 items-center justify-center`}
                          >
                            <Text style={tw`text-white text-lg`}>
                              {post.author.name[0]?.toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <View>
                          <Text
                            style={[
                              tw`text-white text-sm`,
                              { fontFamily: "Roobert-Bold" },
                            ]}
                          >
                            {post.author.name}
                          </Text>
                          <Text
                            style={[
                              tw`text-white text-xs`,
                              { fontFamily: "Roobert-Medium" },
                            ]}
                          >
                            {post.hotspot
                              ? `${post.hotspot.name}${
                                  post.hotspot.location?.address
                                    ? ` · ${getCityState(
                                        post.hotspot.location.address
                                      )}`
                                    : " •"
                                }`
                              : "Posted"}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  </Link>
                  <Image
                    source={{ uri: media }}
                    style={{ width: "100%", height: 370 }}
                    resizeMode="cover"
                  />
                </View>
              )
            ) : (
              <View
                style={tw`w-full h-44 bg-gray-800 items-center justify-center`}
              >
                <Text style={tw`text-gray-400`}>No media</Text>
              </View>
            )}

            <View style={tw` py-3 px-3`}>
              <View style={tw`flex items-center flex-row justify-between`}>
                <View style={tw`flex-row items-center gap-2`}>
                  <View
                    style={tw`flex-row flex items-center max-w-52 px-2 gap-2 h-6 rounded-full border border-[#222]`}
                  >
                    <Image
                      style={tw`w-3 h-3 rounded-full`}
                      source={{ uri: post.hotspot?.avatar }}
                    />
                    <Text
                      numberOfLines={1}
                      style={[
                        tw`text-white text-[10px] max-w-40`,
                        { fontFamily: "Roobert-SemiBold" },
                      ]}
                    >
                     {post.hotspot?.name}
                    </Text>
                  </View>
                  <View style={tw`flex-row items-center gap-2`}>
                    <View
                      style={tw`px-3 items-center justify-center h-6 rounded-full border border-[#222]`}
                    >
                      <Text
                        numberOfLines={1}
                        style={[
                          tw`text-white text-[10px]`,
                          { fontFamily: "Roobert-SemiBold" },
                        ]}
                      >
                        {localLikesCount} Likes
                      </Text>
                    </View>
                  </View>
                </View>
                <Text
                  style={[
                    tw`text-green-500 text-xs`,
                    { fontFamily: "Roobert-SemiBold" },
                  ]}
                >
                  {post.hotspot?.type}
                </Text>
              </View>
            </View>
            <View
              style={tw`px-4 py-3 border rounded-2xl border-[#222] mx-3 mb-3`}
            >
              <View style={tw`flex-row items-center gap-1.5`}>
                <Image
                  source={{ uri: post.author.pfp }}
                  style={tw`w-5 h-5 rounded-full`}
                />
                <Text
                  style={[
                    tw`text-white text-xs`,
                    { fontFamily: "Roobert-SemiBold" },
                  ]}
                >
                  {post.author.name}
                </Text>
              </View>
              <Text
                style={[
                  tw`text-white text-xs mt-1`,
                  { fontFamily: "Roobert-Medium" },
                ]}
              >
                {post.content}
              </Text>
            </View>
            <View style={tw`px-5 flex-row items-center mb-3 gap-2`}>
              {authorsAtHotspot && authorsAtHotspot.length > 0 && (
                <View style={tw`flex-row items-center ml-[-5px]`}>
                  {authorsAtHotspot.map((a) => (
                    <View
                      style={tw`w-7 h-7 rounded-full overflow-hidden border-2 border-black items-center justify-center`}
                    >
                      {a.pfp ? (
                        <Image source={{ uri: a.pfp }} style={tw`w-5 h-5 rounded-full`} />
                      ) : (
                        <Text style={tw`text-black`}>{a.name?.charAt(0)}</Text>
                      )}
                    </View>
                  ))}
                </View>
              )}
              <Text style={[tw`text-white text-[10px]`, { fontFamily: "Roobert-SemiBold" }]}>{authorsAtHotspot.length} posted at this hotspot</Text>
            </View>
            <View style={tw`px-3`}>
              {geocoding && (
                <View style={tw`py-2`}>
                  <ActivityIndicator color="#fff" />
                </View>
              )}

              {(post.hotspot || geocodeResults) && (
                <View
                  style={tw`rounded-xl h-60 overflow-hidden z-50 border border-[#222] mb-3`}
                >
                  {(() => {
                    const initialRegion = region
                      ? region
                      : hotspotCoords
                      ? {
                          latitude: hotspotCoords.latitude,
                          longitude: hotspotCoords.longitude,
                          latitudeDelta: 0.01,
                          longitudeDelta: 0.01,
                        }
                      : geocodeResults && geocodeResults.length > 0
                      ? {
                          latitude: geocodeResults[0].latitude,
                          longitude: geocodeResults[0].longitude,
                          latitudeDelta: 0.01,
                          longitudeDelta: 0.01,
                        }
                      : {
                          latitude: 0,
                          longitude: 0,
                          latitudeDelta: 60,
                          longitudeDelta: 60,
                        };

                    return (
                      <MapView
                        provider={
                          Platform.OS === "android"
                            ? PROVIDER_GOOGLE
                            : undefined
                        }
                        style={{ flex: 1 }}
                        initialRegion={initialRegion}
                        region={region || undefined}
                        showsUserLocation={false}
                        showsMyLocationButton={false}
                        showsCompass={true}
                        zoomControlEnabled={true}
                      >
                        {markerCoord && (
                          <>
                            <Marker
                              coordinate={markerCoord}
                              title={post.hotspot?.name}
                              description={
                                (selectedGeocode
                                  ? (selectedGeocode.name ||
                                      selectedGeocode.street ||
                                      "") +
                                    (selectedGeocode.city
                                      ? `, ${selectedGeocode.city}`
                                      : "") +
                                    (selectedGeocode.region
                                      ? `, ${selectedGeocode.region}`
                                      : "")
                                  : post.hotspot?.location?.address) ||
                                undefined
                              }
                            >
                              <View style={tw`items-center`}>
                                <View
                                  style={tw`bg-black rounded-full w-8 h-8 items-center justify-center border-2 border-white`}
                                >
                                  {post.hotspot?.avatar ? (
                                    <Image
                                      source={{ uri: post.hotspot.avatar }}
                                      style={tw`w-6 h-6 rounded-full`}
                                    />
                                  ) : (
                                    <Text
                                      style={[
                                        tw`text-white text-xs`,
                                        { fontFamily: "Roobert-Bold" },
                                      ]}
                                    >
                                      {post.hotspot?.name.charAt(0)}
                                    </Text>
                                  )}
                                </View>
                                <View
                                  style={tw`w-0 h-0 border-l-4 border-r-4 border-t-8 border-l-transparent border-r-transparent border-t-black`}
                                />
                              </View>
                            </Marker>

                            {/* authors will be shown in a row underneath the map instead of map markers */}
                          </>
                        )}
                      </MapView>
                    );
                  })()}
                  <View style={tw`p-2`}>
                    {post.hotspot?.location?.address && (
                      <Text
                        style={[
                          tw`text-white text-xs`,
                          { fontFamily: "Roobert-Medium" },
                        ]}
                      >
                        {post.hotspot.location.address}
                      </Text>
                    )}
                  </View>
                </View>
              )}

              {geocodeResults && geocodeResults.length > 1 && (
                <View style={tw`px-3 mb-3`}>
                  <Text style={tw`text-white mb-2`}>
                    Multiple matches found — pick the correct location:
                  </Text>
                  {geocodeResults.map((r, i) => (
                    <View key={i} style={tw`mb-2`}>
                      <Text style={tw`text-white text-xs`}>
                        {(r.name || r.street || "") +
                          (r.city ? `, ${r.city}` : "") +
                          (r.region ? `, ${r.region}` : "")}
                      </Text>
                      <Text style={tw`text-gray-400 text-xs`}>
                        Lat: {r.latitude?.toFixed(6)} Lon:{" "}
                        {r.longitude?.toFixed(6)}
                      </Text>
                      <View style={tw`flex-row gap-2 mt-1`}>
                        <TouchableOpacity
                          onPress={() => {
                            setHotspotCoords({
                              latitude: r.latitude,
                              longitude: r.longitude,
                            });
                            setGeocodeResults([r]);
                            setSelectedGeocode(r);
                          }}
                          style={tw`px-3 py-1 bg-white rounded-md`}
                        >
                          <Text style={tw`text-black text-xs`}>Use this</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => {}}
                          style={tw`px-3 py-1 border border-[#222] rounded-md`}
                        >
                          <Text style={tw`text-white text-xs`}>Ignore</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() =>
                            openInMaps(
                              r.latitude,
                              r.longitude,
                              r.name || post.hotspot?.name
                            )
                          }
                          style={tw`px-3 py-1 border border-[#222] rounded-md`}
                        >
                          <Text style={tw`text-white text-xs`}>Open</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {!geocoding && !region && post.hotspot?.location?.address && (
                <View style={tw`py-2`}>
                  <TouchableOpacity
                    onPress={async () => {
                      const loc = post.hotspot?.location;
                      if (!loc) return;
                      if (loc.latitude != null && loc.longitude != null) {
                        setHotspotCoords({
                          latitude: loc.latitude,
                          longitude: loc.longitude,
                        });
                        return;
                      }
                      const results = await runGeocode(loc);
                      if (results && results.length > 0) {
                        setHotspotCoords({
                          latitude: results[0].latitude,
                          longitude: results[0].longitude,
                        });
                      }
                    }}
                    style={tw`px-3 py-2 bg-white rounded-full items-center`}
                  >
                    <Text style={tw`text-black`}>Show on Map</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
