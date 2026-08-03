import { ME_QUERY } from "@/app/apollo/queries/general";
import { useQuery } from "@apollo/client/react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Image, View } from "react-native";

export default function TabLayout() {
  const { data: meData } = useQuery<{ me: { pfp?: string } }>(ME_QUERY);
  const pfp = meData?.me?.pfp;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 68,
          backgroundColor: "#000",
          borderTopLeftRadius: 40,
          borderTopRightRadius: 40,
          borderColor: "transparent",
          paddingTop: 7,
          paddingBottom: 7,
          elevation: 0,
          shadowOpacity: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons name={focused ? "map" : "map-outline"} color="#fff" size={27} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons name={focused ? "compass" : "compass-outline"} color="#fff" size={27} />
          ),
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons name={focused ? "trophy" : "trophy-outline"} color="#fff" size={27} />
          ),
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={{ alignItems: "center", justifyContent: "center" }}>
              <Ionicons name={focused ? "newspaper" : "newspaper-outline"} color="#fff" size={27} />
              <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: "#3B82F6", position: "absolute", bottom: -7 }} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) =>
            pfp ? (
              <Image source={{ uri: pfp }} style={{ width: 27, height: 27, borderRadius: 14 }} />
            ) : (
              <Ionicons name={focused ? "person" : "person-outline"} color="#fff" size={27} />
            ),
        }}
      />
      <Tabs.Screen name="create" options={{ href: null }} />
    </Tabs>
  );
}
