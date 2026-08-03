import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuth } from "@/contexts/auth";
import tw from "@/lib/tw";
import { useMutation, useQuery } from "@apollo/client/react";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as ExpoLocation from "expo-location";
import { router } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { SceneMap, TabView } from "react-native-tab-view";
import { UPDATE_LOCATION } from "../apollo/mutations/location";
import { ME_QUERY } from "../apollo/queries/general";

export interface MeData {
  me: {
    id: string;
    name: string;
    email: string;
    pfp: string;
    visits: number;
    ratings: number;
    bio: string;
    location?: {
      latitude?: number | null;
      longitude?: number | null;
      address?: string | null;
    };
    posts?: Array<{
      id: number;
      title?: string | null;
      media?: string | null;
      type?: string | null;
      createdAt: string;
    }>;
  };
}

interface PostGridItemProps {
  post: {
    id: number;
    title?: string | null;
    media?: string | null;
    type?: string | null;
    createdAt: string;
  };
}

const PostGridItem: React.FC<PostGridItemProps> = ({ post }) => {
  // Parse media (could be JSON array or single URL)
  const getFirstMedia = () => {
    if (!post.media) return null;
    try {
      const parsed = JSON.parse(post.media);
      if (Array.isArray(parsed)) {
        const first = parsed[0];
        return typeof first === 'string' ? first : first?.url || null;
      }
      return typeof parsed === 'string' ? parsed : null;
    } catch {
      return post.media;
    }
  };

  const mediaUri = getFirstMedia();

  return (
    <View style={tw`w-1/3 aspect-square p-0.5`}>
      {mediaUri ? (
        <Image source={{ uri: mediaUri }} style={tw`w-full h-full`} resizeMode="cover" />
      ) : (
        <View style={tw`w-full h-full bg-gray-800 items-center justify-center`}>
          <Text style={tw`text-gray-500 text-xs text-center px-2`}>
            {post.title || 'No media'}
          </Text>
        </View>
      )}
    </View>
  );
};

const FirstRoute = ({ posts }: { posts?: Array<{ id: number; title?: string | null; media?: string | null; type?: string | null; createdAt: string }> }) => {
  if (!posts || posts.length === 0) {
    return (
      <View style={tw`flex-1 items-center justify-center bg-black`}>
        <Text style={tw`text-gray-400`}>No posts yet</Text>
      </View>
    );
  }

  return (
    <View style={tw`flex-1 bg-black`}>
      <FlatList
        data={posts}
        keyExtractor={(item) => String(item.id)}
        numColumns={3}
        renderItem={({ item }) => <PostGridItem post={item} />}
        contentContainerStyle={tw`pb-4`}
      />
    </View>
  );
};

const SecondRoute = () => <View style={tw`flex-1 bg-black`} />;
const ThirdRoute = () => <View style={tw`flex-1 bg-black`} />;
const FourthRoute = () => <View style={tw`flex-1 bg-black`} />;

const renderScene = (meData?: MeData['me']) => SceneMap({
  first: () => <FirstRoute posts={meData?.posts} />,
  second: SecondRoute,
  third: ThirdRoute,
  fourth: FourthRoute,
});

// Extract a compact "City, State" from a full postal address string.
function formatCityStateFromAddress(address?: string | null): string {
  if (!address) return "";
  let parts = address
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length >= 3) {
    parts = parts.slice(0, -1);
  }
  let regionCandidate = parts[parts.length - 1] ?? "";
  let cityCandidate = parts[parts.length - 2] ?? "";
  let cleanedRegion = regionCandidate
    .split(/\s+/)
    .filter((tok) => !/\d/.test(tok))
    .join(" ")
    .trim();
  if (!cleanedRegion && parts.length >= 2) {
    cleanedRegion = cityCandidate
      .split(/\s+/)
      .filter((tok) => !/\d/.test(tok))
      .join(" ")
      .trim();
    cityCandidate = parts[parts.length - 3] ?? "";
  }
  cleanedRegion = cleanedRegion.replace(/\d/g, "").trim();
  return [cityCandidate, cleanedRegion].filter(Boolean).join(", ");
}

export default function ProfileScreen() {
  const layout = useWindowDimensions();
  const [index, setIndex] = React.useState(0);
  const { signOut } = useAuth();
  const { data, error, loading, refetch } = useQuery<MeData>(ME_QUERY);
  const [updateLocation, { loading: updatingLocation }] =
    useMutation(UPDATE_LOCATION);

  // Derive recent posts (<24h) directly from ME_QUERY
  const recentPosts = React.useMemo(() => {
    if (!data?.me?.posts) return [];
    const now = Date.now();
    return data.me.posts.filter((p) => {
      const created = new Date(p.createdAt).getTime();
      return now - created < 24 * 60 * 60 * 1000; // 24 hours window
    });
  }, [data?.me?.posts]);

  // Story modal state
  const [storyVisible, setStoryVisible] = React.useState(false);
  const openStories = () => setStoryVisible(true);
  const closeStories = () => setStoryVisible(false);

  // Flatten media across recent posts
  const storyItems = React.useMemo(() => {
    const items: Array<{ id: string; uri: string; title?: string | null }> = [];
    recentPosts.forEach((post) => {
      if (post.media) {
        try {
          const parsed = JSON.parse(post.media);
          if (Array.isArray(parsed)) {
            parsed.forEach((m: any, idx: number) => {
              if (typeof m === "string") {
                items.push({
                  id: `${post.id}-${idx}`,
                  uri: m,
                  title: post.title,
                });
              } else if (m?.url) {
                items.push({
                  id: `${post.id}-${idx}`,
                  uri: m.url,
                  title: post.title,
                });
              }
            });
          } else if (typeof parsed === "string") {
            items.push({ id: String(post.id), uri: parsed, title: post.title });
          }
        } catch {
          // media might already be a single URL string
          items.push({
            id: String(post.id),
            uri: post.media,
            title: post.title,
          });
        }
      }
    });
    return items;
  }, [recentPosts]);

  const [routes] = React.useState([
    { key: "first", icon: "grid-outline" },
    { key: "second", icon: "pin-outline" },
    { key: "third", icon: "chatbubbles-outline" },
    { key: "fourth", icon: "link-outline" },
  ]);

  const handleUpdateLocation = React.useCallback(async () => {
    try {
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const pos = await ExpoLocation.getCurrentPositionAsync({
        accuracy: ExpoLocation.Accuracy.Balanced,
      });
      let address: string | undefined = undefined;
      try {
        const [place] = await ExpoLocation.reverseGeocodeAsync({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        if (place) {
          const full = [
            place.name,
            place.street,
            place.city,
            place.region,
            place.postalCode,
            place.country,
          ]
            .filter(Boolean)
            .join(", ");
          address = full || undefined;
        }
      } catch {}
      await updateLocation({
        variables: {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          address,
        },
      });
      await refetch();
    } catch (e) {
      console.warn("Location update failed", e);
    }
  }, [refetch, updateLocation]);

  const handleSignOut = React.useCallback(async () => {
    await signOut();
    router.replace("/(auth)/login");
  }, [signOut]);

  if (loading) {
    return (
      <View style={tw`flex-1 bg-black items-center justify-center`}>
        <Text style={tw`text-white`}>Loading...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={tw`flex-1 bg-black items-center justify-center`}>
        <Text style={tw`text-red-500`}>Error loading profile</Text>
      </View>
    );
  }

  const me = data?.me;
  if (!me) {
    return (
      <View style={tw`flex-1 bg-black items-center justify-center`}>
        <Text style={tw`text-white`}>No user data</Text>
      </View>
    );
  }

  const hasStories = storyItems.length > 0;

  return (
    <View style={tw`flex-1 flex flex-col bg-black`}>
      <View style={tw`p-5`}>
        <View style={tw`mt-10`}>
          <Text style={tw`text-white text-center text-sm font-semibold mb-2`}>
            {me.name}
          </Text>
          {me.location?.address && (
            <Text style={tw`text-gray-400 text-xs text-center`}>
              {formatCityStateFromAddress(me.location.address)}
            </Text>
          )}
        </View>
        <View style={tw`w-full items-center justify-center mt-10`}>
          <View style={tw`flex items-center flex-row justify-center`}>
            <View style={tw`flex flex-col justify-center`}>
              <Text
                style={tw`text-white text-center text-sm font-semibold mb-1`}
              >
                {me?.visits}
              </Text>
              <Text
                style={tw`text-white text-center text-sm font-semibold mb-2`}
              >
                Visits
              </Text>
            </View>
            <TouchableOpacity
              onPress={hasStories ? openStories : undefined}
              activeOpacity={hasStories ? 0.8 : 1}
            >
              {hasStories ? (
                <LinearGradient
                  colors={["#FF0080", "#7928CA"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={tw`rounded-full p-[3px] mx-4`}
                >
                  <View style={tw`bg-black rounded-full p-[2px]`}>
                    {!me?.pfp ? (
                      <View style={tw`h-16 w-16 rounded-full bg-gray-500`} />
                    ) : (
                      <Image
                        source={{ uri: me.pfp }}
                        style={tw`h-16 w-16 rounded-full`}
                      />
                    )}
                  </View>
                </LinearGradient>
              ) : (
                <View style={tw`mx-4`}>
                  {!me?.pfp ? (
                    <View style={tw`h-16 w-16 rounded-full bg-gray-500`} />
                  ) : (
                    <Image
                      source={{ uri: me.pfp }}
                      style={tw`h-16 w-16 rounded-full`}
                    />
                  )}
                </View>
              )}
            </TouchableOpacity>
            <View style={tw`flex flex-col justify-center`}>
              <View style={tw`flex flex-col justify-center`}>
                <Text
                  style={tw`text-white text-center text-sm font-semibold mb-1`}
                >
                  {me?.visits}
                </Text>
                <Text
                  style={tw`text-white text-center text-sm font-semibold mb-2`}
                >
                  Ratings
                </Text>
              </View>
            </View>
          </View>
          <View style={tw`mt-7 w-full items-center justify-center`}>
            <View style={tw`justify-between gap-5 items-center flex-row  flex`}>
              <Text style={tw`text-white  text-sm font-semibold mb-1`}>
                {me?.name}
              </Text>
              <View style={tw`w-[2px] h-6 bg-gray-900`} />
              <Text style={tw`text-white text-sm font-semibold mb-1`}>
                Type
              </Text>
            </View>
          </View>
          <View>
            <View style={tw`mx-10 mt-5 w-full`}>
              <Text style={tw`text-white text-sm font-semibold mb-1`}>
                {!me?.bio ? "No bio available" : me.bio}
              </Text>
            </View>
          </View>
          <View style={tw`mt-7 w-full flex flex-row gap-3 items-center mx-5`}>
            <TouchableOpacity style={tw`bg-gray-700  p-2 flex-1 rounded-xl`}>
              <Text style={tw`text-white font-semibold text-center`}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={tw`bg-gray-700 p-2 flex-1 rounded-xl`}>
              <Text
                style={tw`text-white font-semibold whitespace-nowrap" text-center`}
              >
                Statistics
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSignOut}
              style={tw`bg-red-600 p-2 flex-1 rounded-xl`}
            >
              <Text style={tw`text-white font-semibold text-center`}>
                Sign Out
              </Text>
            </TouchableOpacity>
          </View>
          {(me.location?.latitude == null ||
            me.location?.longitude == null) && (
            <View style={tw`mt-4 w-full flex items-center mx-5`}>
              <TouchableOpacity
                onPress={handleUpdateLocation}
                disabled={updatingLocation}
                style={tw`bg-blue-600 px-4 py-3 rounded-xl w-full items-center ${
                  updatingLocation ? "opacity-60" : ""
                }`}
              >
                {updatingLocation ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={tw`text-white font-semibold`}>
                    Update Location
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
        <View style={tw`mt-7 flex items-start justify-start gap-5`}>
          <View>
            <TouchableOpacity
              style={tw`bg-black border-gray-700 border-2 rounded-full flex items-center justify-center w-16 h-16`}
            >
              <Ionicons name="add-sharp" size={20} color={"white"} />
            </TouchableOpacity>
            <Text style={tw`text-white font-semibold text-center mt-2`}>
              Add{" "}
            </Text>
          </View>
        </View>
      </View>
      <TabView
        navigationState={{ index, routes }}
        renderScene={renderScene(me)}
        onIndexChange={setIndex}
        initialLayout={{ width: layout.width }}
        renderTabBar={(props) => {
          const { navigationState, jumpTo } = props;
          return (
            <View style={tw`flex-row bg-black`}>
              {navigationState.routes.map((route, i) => {
                const isFocused = index === i;
                return (
                  <TouchableOpacity
                    key={route.key}
                    onPress={() => jumpTo(route.key)}
                    style={tw`flex-1 items-center justify-center py-2`}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={route.icon as any}
                      size={24}
                      color={isFocused ? "#fff" : "#999"}
                    />
                    {isFocused && (
                      <View style={tw`absolute bottom-0 w-6 h-[2px]`} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        }}
      />

      {/* Story Carousel Modal */}
      <Modal
        visible={storyVisible}
        transparent
        animationType="fade"
        onRequestClose={closeStories}
      >
        <View style={tw`flex-1 bg-black/95`}>
          <View style={tw`flex-row justify-between items-center px-4 pt-10`}>
            <Text style={tw`text-white font-semibold`}>Stories</Text>
            <TouchableOpacity onPress={closeStories}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
          {loading && (
            <View style={tw`flex-1 items-center justify-center`}>
              <ActivityIndicator color="#fff" />
            </View>
          )}
          {!loading && storyItems.length === 0 && (
            <View style={tw`flex-1 items-center justify-center`}>
              <Text style={tw`text-gray-400`}>No recent posts</Text>
            </View>
          )}
          {!loading && storyItems.length > 0 && (
            <FlatList
              data={storyItems}
              keyExtractor={(item) => item.id}
              horizontal
              pagingEnabled
              style={tw`flex-1`}
              renderItem={({ item }) => (
                <View
                  style={tw`w-${layout.width} items-center justify-center px-4`}
                >
                  <Image
                    source={{ uri: item.uri }}
                    style={tw`w-full h-full`}
                    resizeMode="contain"
                  />
                  {item.title && (
                    <View style={tw`absolute bottom-10 left-4 right-4`}>
                      <Text style={tw`text-white text-sm`}>{item.title}</Text>
                    </View>
                  )}
                </View>
              )}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

ProfileScreen.options = {
  title: "Profile",
  tabBarIcon: ({ color }: { color: string }) => (
    <IconSymbol size={28} name="paperplane.fill" color={color} />
  ),
};

const styles = StyleSheet.create({
  headerImage: {
    color: "#808080",
    bottom: -90,
    left: -35,
    position: "absolute",
  },
  titleContainer: {
    flexDirection: "row",
    gap: 8,
  },
});
