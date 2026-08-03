import {
  ALL_HOTSPOTS,
  FOLLOWING_HOTSPOTS,
  ME_QUERY,
  SEARCH_POSTS,
  SEARCH_QUERY,
} from "@/app/apollo/queries/general";
import FloatingCreateButton from "@/components/ui/FloatingCreateButton";
import { IconSymbol } from "@/components/ui/icon-symbol";
import tw from "@/lib/tw";
import { useLazyQuery, useQuery } from "@apollo/client/react";
import { LinearGradient } from "expo-linear-gradient";
import { Link } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
interface Hotspot {
  id: string;
  name: string;
  avatar?: string;
  description?: string;
  type?: string;
  location: {
    id: string;
    latitude: number;
    longitude: number;
    address?: string;
  };
  ratings?: number;
  visits?: number;
  author?: {
    id: string;
    name: string;
    pfp?: string;
  };
}

interface AllHotspotsData {
  allHotspots: Hotspot[];
}

interface FollowingHotspotsData {
  followerHotspots: Hotspot[];
}

interface User {
  id: string;
  name: string;
  pfp?: string;
  bio?: string;
  followersCount?: number;
  isFollowingUser?: boolean;
  reviews?: { id: string }[];
}

interface Post {
  id: string;
  title: string;
  media?: string;
  type?: string;
  createdAt: string;
  author: {
    id: string;
    name: string;
    pfp?: string;
  };
  hotspot?: {
    id: string;
    name: string;
  };
}

interface MeData {
  me: {
    id: string;
    name: string;
    email: string;
    pfp?: string;
    bio?: string;
    following: User[];
  };
}

interface SearchUsersData {
  searchUsers: User[];
}

interface SearchPostsData {
  searchPosts: Post[];
}

export default function HomeScreen() {
  const screenHeight = Dimensions.get("window").height;
  const cardHeight = (screenHeight * 2) / 3;

  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    "all" | "hotspots" | "users" | "posts"
  >("all");

  // Derive City, State from a composed address string like
  // "123 Main St, City, State, Postal, Country"
  const getCityState = (address?: string | null) => {
    if (!address) return null;
    const parts = address
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    // Heuristic based on how we compose addresses in create.tsx
    // [addressLine, city, region, postalCode, country]
    if (parts.length >= 3) {
      const city = parts[1];
      const state = parts[2];
      return `${city}${state ? `, ${state}` : ""}`;
    }
    if (parts.length >= 2) {
      return `${parts[0]}, ${parts[1]}`;
    }
    return parts[0] || null;
  };

  const tabs = [
    { id: 0, label: "For you", content: "Feed content goes here" },
    { id: 1, label: "Explore", content: "Explore content goes here" },
  ];

  // Queries
  const { data: meData, loading: meLoading } = useQuery<MeData>(ME_QUERY);
  const { data: followingHotspotsData, loading: followingHotspotsLoading } =
    useQuery<FollowingHotspotsData>(FOLLOWING_HOTSPOTS, {
      variables: { skip: 0, take: 50 },
    });
  const { data: hotspotsData, loading: hotspotsLoading } =
    useQuery<AllHotspotsData>(ALL_HOTSPOTS);
  const [searchUsers, { data: usersData, loading: usersLoading, error: usersError }] =
    useLazyQuery<SearchUsersData>(SEARCH_QUERY);
  const [searchPosts, { data: postsData, loading: postsLoading, error: postsError }] =
    useLazyQuery<SearchPostsData>(SEARCH_POSTS);

  // Debug helper: log pfp values when data changes
  React.useEffect(() => {
    if (meData?.me) {
      console.log("[pfp debug] me.pfp =", meData.me.pfp);
      console.log(
        "[pfp debug] following pfps =",
        meData.me.following.map((f) => ({ id: f.id, pfp: f.pfp }))
      );
    }
  }, [meData?.me]);

  // Debug helper: log posts search results/errors
  React.useEffect(() => {
    if (postsData) {
      console.log("[posts debug] postsData.searchPosts count =", postsData?.searchPosts?.length);
    }
    if (postsError) {
      console.log("[posts debug] error =", postsError);
    }
  }, [postsData, postsError]);

  // Handle search
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults("all");
      return;
    }

    // Search users and posts
    await Promise.all([
      searchUsers({
        variables: {
          searchString: searchQuery,
          skip: 0,
          take: 20,
        },
      }),
      searchPosts({
        variables: {
          searchString: searchQuery,
          skip: 0,
          take: 20,
        },
      }),
    ]);
  };

  // Filter hotspots by search query
  const filteredHotspots =
    hotspotsData?.allHotspots.filter(
      (hotspot) =>
        hotspot.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        hotspot.description?.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

  const filteredUsers = usersData?.searchUsers || [];

  const filteredPosts = postsData?.searchPosts || [];

  const showSearchResults = searchQuery.trim().length > 0;

  if (meLoading) {
    return (
      <View style={tw`flex-1 items-center justify-center bg-black`}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  return (
    <View style={tw`flex-1 bg-black`}>
      {/* Search Bar */}
      <View style={tw`px-3 pt-12 pb-2 bg-black`}>
        <View style={tw`bg-black flex-row items-center gap-2`}>
          <View
            style={tw`flex-row items-center flex-1 bg-[#222] rounded-xl px-3 py-2`}
          >
            <IconSymbol name="magnifyingglass" size={20} color="#777" />
            <TextInput
              style={[
                tw`flex-1 text-white ml-2`,
                { fontFamily: "Roobert-Medium" },
              ]}
              placeholder="Search hotspots, users, posts..."
              placeholderTextColor="#777"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <IconSymbol name="xmark.circle.fill" size={20} color="#aaa" />
              </TouchableOpacity>
            )}
          </View>
          <View>
            <Image
              source={{ uri: meData?.me?.pfp }}
              style={tw`w-7 h-7 rounded-full`}
            />
          </View>
        </View>
      </View>

      {showSearchResults ? (
        <View style={tw`flex-1`}>
          {/* Search Filter Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={tw`px-3 my-1`}
            contentContainerStyle={tw`items-center`}
          >
            {["all", "hotspots", "users", "posts"].map((filter) => (
              <TouchableOpacity
                key={filter}
                style={tw`mr-3 px-1  py-2 rounded-full ${
                  searchResults === filter ? "bg-black" : "bg-black"
                }`}
                onPress={() => setSearchResults(filter as any)}
              >
                <Text
                  style={[
                    tw`${
                      searchResults === filter ? "text-white" : "text-gray-400"
                    } capitalize`,
                    {
                      fontFamily:
                        searchResults === filter
                          ? "Roobert-Bold"
                          : "Roobert-SemiBold",
                    },
                  ]}
                >
                  {filter}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Search Results */}
          <ScrollView style={tw`px-4`}>
            {hotspotsLoading || usersLoading || postsLoading ? (
              <View style={tw`flex-1 items-center justify-center py-10`}>
                <ActivityIndicator color="#fff" />
                <Text style={tw`text-white mt-2`}>Searching...</Text>
              </View>
            ) : (
              <>
                {/* Hotspots Results */}
                {(searchResults === "all" || searchResults === "hotspots") &&
                  filteredHotspots.length > 0 && (
                    <View style={tw`mb-1`}>
                      <View style={tw`justify-between flex-row items-center`}>
                        <Text
                          style={[
                            tw`text-white text-lg mb-3`,
                            { fontFamily: "Roobert-Bold" },
                          ]}
                        >
                          Hotspots
                        </Text>
                        <View
                          style={tw`px-3 rounded-md py-1 text-[10px] bg-green-300`}
                        >
                          <Text
                            style={[
                              tw`text-[10px] text-green-700`,
                              { fontFamily: "Roobert-SemiBold" },
                            ]}
                          >
                            {filteredHotspots.length} Hotspots Found
                          </Text>
                        </View>
                      </View>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={tw`items-start`}
                        style={tw`-mx-1`}
                      >
                        {filteredHotspots.map((hotspot) => (
                          <View style={tw`w-64 mr-3 mb-4`} key={hotspot.id}>
                            <View style={tw`flex flex-row items-center gap-2 mb-3`}>
                              {hotspot.avatar ? (
                                <Image
                                  source={{ uri: hotspot.avatar }}
                                  style={tw`w-7 h-7 rounded-full`}
                                />
                              ) : (
                                <LinearGradient
                                  colors={["#FF0080", "#7928CA"]}
                                  start={{ x: 0, y: 0 }}
                                  end={{ x: 1, y: 1 }}
                                  style={tw`rounded-full w-7 h-7 items-center justify-center`}
                                >
                                  <View
                                    style={tw`w-6 h-6 rounded-full flex items-center justify-center bg-black  items-center justify-center`}
                                  >
                                    <Text
                                      style={[tw`text-white text-[10px]`, { fontFamily: "Roobert-Bold" }]}
                                    >
                                      {hotspot.name.charAt(0)}
                                    </Text>
                                  </View>
                                </LinearGradient>
                              )}

                              <Text
                                numberOfLines={1}
                                style={[tw`text-white flex-1`, { fontFamily: "Roobert-SemiBold" }]}
                              >
                                {hotspot.name}
                              </Text>
                            </View>
                            <Link
                              key={hotspot.id}
                              href={{ pathname: "/hotspot/[id]", params: { id: hotspot.id } }}
                              asChild
                            >
                              <TouchableOpacity style={tw`w-full h-[66] p-3 relative rounded-xl bg-white items-center justify-center`}>
                                <View style={tw`bg-black absolute top-3 left-2 rounded-lg px-3 py-1.5`}>
                                  <Text
                                    numberOfLines={1}
                                    style={[tw`text-white text-[10px]`, { fontFamily: "Roobert-Bold" }]}
                                  >
                                    {(hotspot as any)?.reviews?.length ?? hotspot.ratings ?? 0} ratings
                                  </Text>
                                </View>
                                <View style={tw`bg-blue-500 absolute bottom-3 left-2 rounded-md px-2 py-1`}>
                                  <Text
                                    numberOfLines={1}
                                    style={[tw`text-white text-[10px]`, { fontFamily: "Roobert-Bold" }]}
                                  >
                                    {getCityState(hotspot.location?.address) || "Unknown"}
                                  </Text>
                                </View>
                                {hotspot.avatar ? (
                                  <LinearGradient
                                    colors={["#FF0080", "#7928CA"]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={tw`rounded-full w-14 h-14 items-center justify-center`}
                                  >
                                    <Image
                                      source={{ uri: hotspot.avatar }}
                                      style={tw`w-12 h-12 rounded-full bg-white`}
                                    />
                                  </LinearGradient>
                                ) : (
                                  <LinearGradient
                                    colors={["#FF0080", "#7928CA"]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={tw`rounded-full w-14 h-14 items-center justify-center`}
                                  >
                                    <View style={tw`rounded-full flex items-center justify-center bg-black w-12 h-12`}>
                                      <Text style={[tw`text-white`, { fontFamily: "Roobert-Bold" }]}>
                                        {hotspot.name.charAt(0)}
                                      </Text>
                                    </View>
                                  </LinearGradient>
                                )}
                              </TouchableOpacity>
                            </Link>
                            <View style={tw`mt-2 px-2`}>
                              <Text
                                numberOfLines={1}
                                style={[tw`text-white`, { fontFamily: "Roobert-SemiBold" }]}
                              >
                                {hotspot.description}
                              </Text>
                              <View style={tw`flex-row justify-between items-center mt-1`}>
                                <Text style={[tw`text-green-400 text-xs`, { fontFamily: "Roobert-SemiBold" }]}>
                                  {hotspot.type || "General"}
                                </Text>
                                <Text style={[tw`text-gray-400 text-xs`, { fontFamily: "Roobert-Medium" }]}>
                                  {hotspot.visits} visits
                                </Text>
                              </View>
                            </View>
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                {/* Users Results */}
                {(searchResults === "all" || searchResults === "users") &&
                  filteredUsers.length > 0 && (
                    <View style={tw`mb-6`}>
                      <Text
                        style={[
                          tw`text-white text-lg mb-1`,
                          { fontFamily: "Roobert-Bold" },
                        ]}
                      >
                        Users
                      </Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={tw`items-center`}
                        style={tw`-mx-1`}
                      >
                        {filteredUsers.map((user) => (
                          <View>
                            <Link
                              key={user.id}
                              href={{
                                pathname: "/user/[id]",
                                params: { id: user.id },
                              }}
                              asChild
                            >
                              <TouchableOpacity
                                style={tw`flex flex-col w-72 relative rounded-3xl border border-[#222]  overflow-hidden  mr-3`}
                              >
                                <View
                                  style={tw`bg-white  w-full flex items-center justify-center h-16`}
                                >
                                  <View
                                    style={tw`absolute bottom-[-25px] left-3`}
                                  >
                                    {user.pfp ? (
                                      <Image
                                        source={{ uri: user.pfp }}
                                        style={tw`w-12 h-12 border-4 border-black rounded-full`}
                                      />
                                    ) : (
                                      <View
                                        style={tw`bg-white w-12 h-12 border-4 border-black  rounded-full flex items-center justify-center`}
                                      >
                                        <Text
                                          style={[
                                            tw`text-black text-sm`,
                                            { fontFamily: "Roobert-SemiBold" },
                                          ]}
                                        >
                                          {user.name.charAt(0)}
                                        </Text>
                                      </View>
                                    )}
                                  </View>
                                </View>

                                <View style={tw`p-4 mt-3 flex`}>
                                  <View
                                    style={tw`flex flex-row items-center justify-between`}
                                  >
                                    <View>
                                      <Text
                                        style={[
                                          tw`text-white`,
                                          { fontFamily: "Roobert-Bold" },
                                        ]}
                                      >
                                        {user.name}
                                      </Text>
                                    </View>
                                    <View>
                                      {user.isFollowingUser ? (
                                        <TouchableOpacity
                                          style={tw`bg-black px-3 border border-[#222] py-1.5 rounded-full`}
                                        >
                                          <Text
                                            style={[
                                              tw`text-white text-xs`,
                                              { fontFamily: "Roobert-Bold" },
                                            ]}
                                          >
                                            Following
                                          </Text>
                                        </TouchableOpacity>
                                      ) : (
                                        <TouchableOpacity
                                          style={tw`bg-white px-3 py-1.5 rounded-full`}
                                        >
                                          <Text
                                            style={[
                                              tw`text-black text-xs`,
                                              { fontFamily: "Roobert-Bold" },
                                            ]}
                                          >
                                            Follow
                                          </Text>
                                        </TouchableOpacity>
                                      )}
                                    </View>
                                  </View>
                                  {user.bio && (
                                    <Text
                                      style={[
                                        tw`text-white text-sm`,
                                        { fontFamily: "Roobert-Medium" },
                                      ]}
                                      numberOfLines={2}
                                    >
                                      {user.bio || "No bio available"}
                                    </Text>
                                  )}
                                </View>
                              </TouchableOpacity>
                            </Link>
                            <View style={tw`justify-between px-3 flex flex-row mt-2`}>
                              <Text
                                style={[
                                  tw`text-white text-sm`,
                                  { fontFamily: "Roobert-SemiBold" },
                                ]}
                              >
                                {user.reviews?.length || 0} reviews
                              </Text>
                            </View>               
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                {/* Posts Results */}
                {(searchResults === "all" || searchResults === "posts") && (
                    <View style={tw`mb-6`}>
                      <View style={tw`justify-between flex-row items-center`}>
                        <Text
                          style={[
                            tw`text-white text-lg mb-3`,
                            { fontFamily: "Roobert-Bold" },
                          ]}
                        >
                          Posts
                        </Text>
                        {postsLoading ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <View style={tw`px-3 rounded-md py-1 text-[10px] bg-green-300`}>
                            <Text
                              style={[tw`text-[10px] text-green-700`, { fontFamily: "Roobert-SemiBold" }]}
                            >
                              {filteredPosts.length} Posts Found
                            </Text>
                          </View>
                        )}
                      </View>

                      {postsError && (
                        <Text style={[tw`text-red-400 mb-2`, { fontFamily: "Roobert-Medium" }]}>
                          Failed to load posts. Try again later.
                        </Text>
                      )}

                      {filteredPosts.length > 0 ? (
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={tw`items-start`}
                          style={tw`-mx-1`}
                        >
                          {filteredPosts.map((post) => {
                            const mediaUrl = Array.isArray(post.media)
                              ? post.media[0]
                              : post.media;
                            return (
                              <View key={post.id} style={tw`w-64 mr-3`}>
                                <Link
                                  href={{ pathname: "/post/[id]", params: { id: post.id } }}
                                  asChild
                                >
                                  <TouchableOpacity style={tw`bg-white rounded-xl p-3`}>
                                    {mediaUrl ? (
                                      <Image source={{ uri: mediaUrl }} style={tw`w-full h-28 rounded-md mb-2`} />
                                    ) : (
                                      <LinearGradient
                                        colors={["#FF0080", "#7928CA"]}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                        style={tw`w-full h-28 rounded-md mb-2 items-center justify-center`}
                                      >
                                        <Text style={[tw`text-white`, { fontFamily: "Roobert-Bold" }]}>
                                          {post.title?.charAt(0) || "P"}
                                        </Text>
                                      </LinearGradient>
                                    )}
                                    <Text
                                      numberOfLines={1}
                                      style={[tw`text-black`, { fontFamily: "Roobert-SemiBold" }]}
                                    >
                                      {post.title || "Untitled"}
                                    </Text>
                                    <View style={tw`flex-row items-center justify-between mt-1`}>
                                      <Text
                                        numberOfLines={1}
                                        style={[tw`text-gray-600 text-xs`, { fontFamily: "Roobert-Medium" }]}
                                      >
                                        {post.author?.name || "Unknown"}
                                      </Text>
                                      <View style={tw`px-2 py-0.5 rounded bg-black`}>
                                        <Text style={[tw`text-white text-[10px]`, { fontFamily: "Roobert-SemiBold" }]}>
                                          {post.type || "post"}
                                        </Text>
                                      </View>
                                    </View>
                                  </TouchableOpacity>
                                </Link>
                              </View>
                            );
                          })}
                        </ScrollView>
                      ) : !postsLoading ? (
                        <Text style={[tw`text-gray-400`, { fontFamily: "Roobert-Regular" }]}>No posts found</Text>
                      ) : null}
                    </View>
                  )}

                {/* No Results */}
                {filteredHotspots.length === 0 &&
                  filteredUsers.length === 0 &&
                  filteredPosts.length === 0 && (
                    <View style={tw`items-center justify-center py-10`}>
                      <IconSymbol
                        name="magnifyingglass"
                        size={48}
                        color="#666"
                      />
                      <Text
                        style={[
                          tw`text-white text-lg mt-4`,
                          { fontFamily: "Roobert-Medium" },
                        ]}
                      >
                        No results found
                      </Text>
                      <Text
                        style={[
                          tw`text-gray-400 text-center mt-2`,
                          { fontFamily: "Roobert-Regular" },
                        ]}
                      >
                        Try searching for something else
                      </Text>
                    </View>
                  )}
              </>
            )}
          </ScrollView>
        </View>
      ) : (
        <>
          <View
            style={tw`flex items-center mt-4 justify-between flex-row px-2`}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={tw`bg-black`}
              contentContainerStyle={tw``}
            >
              {tabs.map((tab) => (
                <TouchableOpacity
                  key={tab.id}
                  style={tw`px-2 mr-2 items-center`}
                  onPress={() => setActiveTab(tab.id)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      tw`${
                        activeTab === tab.id ? "text-white" : "text-gray-500"
                      } text-sm`,
                      {
                        fontFamily:
                          activeTab === tab.id
                            ? "Roobert-Bold"
                            : "Roobert-SemiBold",
                      },
                    ]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={tw`flex flex-row items-center mx-[-4px]`}>
              {meData?.me.following && meData.me.following.length > 0 && (
                <View>
                  {meData.me.following.map((user) => (
                    <Image
                      source={{ uri: user.pfp }}
                      style={tw`w-7 h-7 border-2 border-black rounded-full mx-1`}
                    />
                  ))}
                </View>
              )}
            </View>
          </View>

          {/* Tab Content */}
          <ScrollView style={tw`h-full`}>
            {activeTab === 0 ? (
              // Following Feed - Show Hotspots from people you follow
              <View style={tw`py-4`}>
                {/* Followed Users Horizontal Scroll */}

                <View style={tw`px-4`}>
                  {followingHotspotsLoading ? (
                    <View style={tw`items-center justify-center py-10`}>
                      <ActivityIndicator color="#fff" />
                      <Text
                        style={[
                          tw`text-white mt-2`,
                          { fontFamily: "Roobert-Regular" },
                        ]}
                      >
                        Loading hotspots from following...
                      </Text>
                    </View>
                  ) : followingHotspotsData?.followerHotspots &&
                    followingHotspotsData.followerHotspots.length > 0 ? (
                    <>
                      {/* Followed Users Horizontal Scroll */}
                     
                      <Text
                        style={[
                          tw`text-white text-xl mb-4`,
                          { fontFamily: "Roobert-SemiBold" },
                        ]}
                      >
                        Hotspots
                      </Text>
                      <View style={tw`flex-row flex-wrap gap-2 mb-3`}>
                        {followingHotspotsData.followerHotspots.map(
                          (hotspot) => (
                            <View style={tw`w-[48%] mb-4`} key={hotspot.id}>
                              <View
                                style={tw`flex flex-row items-center gap-2 mb-3`}
                              >
                                {hotspot.avatar ? (
                                  <Image
                                    source={{ uri: hotspot.avatar }}
                                    style={tw`w-7 h-7 rounded-full`}
                                  />
                                ) : (
                                  <LinearGradient
                                    colors={["#FF0080", "#7928CA"]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={tw`rounded-full w-7 h-7 items-center justify-center`}
                                  >
                                    <View
                                      style={tw`w-6 h-6 rounded-full flex items-center justify-center bg-black  items-center justify-center`}
                                    >
                                      <Text
                                        style={[
                                          tw`text-white text-[10px]`,
                                          { fontFamily: "Roobert-Bold" },
                                        ]}
                                      >
                                        {hotspot.name.charAt(0)}
                                      </Text>
                                    </View>
                                  </LinearGradient>
                                )}

                                <Text
                                  numberOfLines={1}
                                  style={[
                                    tw`text-white flex-1`,
                                    { fontFamily: "Roobert-SemiBold" },
                                  ]}
                                >
                                  {hotspot.name}
                                </Text>
                              </View>
                              <Link
                                key={hotspot.id}
                                href={{
                                  pathname: "/hotspot/[id]",
                                  params: { id: hotspot.id },
                                }}
                                asChild
                              >
                                <TouchableOpacity
                                  style={tw`w-full h-[66] p-3 relative rounded-xl bg-white items-center justify-center`}
                                >
                                  <View
                                    style={tw`bg-black absolute top-3 left-2 rounded-lg px-3 py-1.5`}
                                  >
                                    <Text
                                      numberOfLines={1}
                                      style={[
                                        tw`text-white text-[10px]`,
                                        { fontFamily: "Roobert-Bold" },
                                      ]}
                                    >
                                      {(hotspot as any)?.reviews?.length ??
                                        hotspot.ratings ??
                                        0}{" "}
                                      ratings
                                    </Text>
                                  </View>
                                  <View
                                    style={tw`bg-blue-500 absolute bottom-3 left-2 rounded-md px-2 py-1`}
                                  >
                                    <Text
                                      numberOfLines={1}
                                      style={[
                                        tw`text-white text-[10px]`,
                                        { fontFamily: "Roobert-Bold" },
                                      ]}
                                    >
                                      {getCityState(
                                        hotspot.location?.address
                                      ) || "Unknown"}
                                    </Text>
                                  </View>
                                  {hotspot.avatar ? (
                                    <LinearGradient
                                      colors={["#FF0080", "#7928CA"]}
                                      start={{ x: 0, y: 0 }}
                                      end={{ x: 1, y: 1 }}
                                      style={tw`rounded-full w-14 h-14 items-center justify-center`}
                                    >
                                      <Image
                                        source={{ uri: hotspot.avatar }}
                                        style={tw`w-12 h-12 rounded-full bg-white`}
                                      />
                                    </LinearGradient>
                                  ) : (
                                    <LinearGradient
                                      colors={["#FF0080", "#7928CA"]}
                                      start={{ x: 0, y: 0 }}
                                      end={{ x: 1, y: 1 }}
                                      style={tw`rounded-full w-14 h-14 items-center justify-center`}
                                    >
                                      <View
                                        style={tw`rounded-full flex items-center justify-center bg-black w-12 h-12`}
                                      >
                                        <Text
                                          style={[
                                            tw`text-white`,
                                            { fontFamily: "Roobert-Bold" },
                                          ]}
                                        >
                                          {hotspot.name.charAt(0)}
                                        </Text>
                                      </View>
                                    </LinearGradient>
                                  )}
                                </TouchableOpacity>
                              </Link>
                              <View style={tw`mt-2 px-2`}>
                                <Text
                                  style={[
                                    tw`text-white`,
                                    { fontFamily: "Roobert-SemiBold" },
                                  ]}
                                >
                                  {hotspot.description}
                                </Text>
                                <View
                                  style={tw`flex-row justify-between items-center mt-1`}
                                >
                                  <Text
                                    style={[
                                      tw`text-green-400 text-xs`,
                                      { fontFamily: "Roobert-SemiBold" },
                                    ]}
                                  >
                                    {hotspot.type || "General"}
                                  </Text>
                                  <Text
                                    style={[
                                      tw`text-gray-400 text-xs`,
                                      { fontFamily: "Roobert-Medium" },
                                    ]}
                                  >
                                    {hotspot.visits} visits
                                  </Text>
                                </View>
                              </View>
                            </View>
                          )
                        )}
                      </View>
                    </>
                  ) : (
                    <View style={tw`items-center justify-center py-10`}>
                      <IconSymbol name="mappin.slash" size={48} color="#666" />
                      <Text
                        style={[
                          tw`text-white text-lg mt-4`,
                          { fontFamily: "Roobert-Medium" },
                        ]}
                      >
                        No hotspots yet
                      </Text>
                      <Text
                        style={[
                          tw`text-gray-400 text-center mt-2 px-8`,
                          { fontFamily: "Roobert-Regular" },
                        ]}
                      >
                        Follow people to see their hotspots here, or explore to
                        find new places
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ) : (
              <View style={tw`p-5 items-center justify-center`}>
                <Text
                  style={[
                    tw`text-white text-lg`,
                    { fontFamily: "Roobert-Regular" },
                  ]}
                >
                  {tabs[activeTab].content}
                </Text>
              </View>
            )}
          </ScrollView>
        </>
      )}
      {/* Floating Create Button */}
      <FloatingCreateButton />
    </View>
  );
}

HomeScreen.options = {
  title: "Home",
  tabBarIcon: ({ color }: { color: string }) => (
    <IconSymbol size={28} name="house.fill" color={color} />
  ),
};
