import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useQuery } from "@apollo/client/react";
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { Image, View } from "react-native";
import { ME_QUERY } from "../apollo/queries/general";

interface MeData {
  me: {
    id: string;
    name: string;
    pfp?: string;
  };
}

const ProfileTabIcon = ({ color, focused }: { color: string; focused: boolean }) => {
  const { data: meData } = useQuery<MeData>(ME_QUERY);
  
  if (meData?.me.pfp) {
    return (
      <View style={{ 
        width: 28, 
        height: 28, 
        borderRadius: 14, 
        overflow: 'hidden',
        borderWidth: focused ? 2 : 0,
        borderColor: 'white'
      }}>
        <Image 
          source={{ uri: meData.me.pfp }} 
          style={{ width: '100%', height: '100%' }}
        />
      </View>
    );
  }
  
  return <Ionicons size={28} name="person-outline" color="white" />;
};

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
        headerShown: false,
        tabBarStyle: { backgroundColor: "#000", paddingTop: 10, borderColor: "#000" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarShowLabel: false,
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <Ionicons size={28} name="albums-outline" color={"white"} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          tabBarShowLabel: false,
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <Ionicons size={28} name="map-outline" color={"white"} />
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          tabBarShowLabel: false,
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <Ionicons size={28} name="navigate-circle-outline" color={"white"} />
          ),
        }}
      />
          <Tabs.Screen
        name="notifications"
        options={{
          tabBarShowLabel: false,
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <Ionicons size={28} name="notifications-outline" color={"white"} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarShowLabel: false,
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <ProfileTabIcon color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
