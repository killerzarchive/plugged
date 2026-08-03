import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import React from "react";
import ExploreScreen from "../app/(tabs)/explore";
import HomeScreen from "../app/(tabs)/index";
import ProfileScreen from "../app/(tabs)/profile";
import { Ionicons } from "@expo/vector-icons";
import NotificationsScreen from "@/app/(tabs)/notifications";
import CreateScreen from "@/app/(tabs)/create";

const Tab = createBottomTabNavigator();

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: { 
          backgroundColor: "#000", 
          paddingTop: 10, 
          borderTopColor: "#000"
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
         options={{
          tabBarShowLabel: false,
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <Ionicons size={28} name="albums-outline" color={"white"} />
          ),
        }}
      />
      <Tab.Screen
        name="Explore"
        component={ExploreScreen}
        options={{
                  tabBarShowLabel: false,
                  headerShown: false,
                  tabBarIcon: ({ color }) => (
                    <Ionicons size={28} name="map-outline" color={"white"} />
                  ),
                }}
      />
      <Tab.Screen
        name="Add"
        component={CreateScreen}
        options={{
                  tabBarShowLabel: false,
                  headerShown: false,
                  tabBarIcon: ({ color }) => (
                    <Ionicons size={28} name='navigate-circle-outline' color={"white"} />
                  ),
                }}
      />
        <Tab.Screen
        name="Profile"
        component={ProfileScreen}
         options={{
                  tabBarShowLabel: false,
                  headerShown: false,
                  tabBarIcon: ({ color }) => (
                    <Ionicons size={28} name="person-outline" color={"white"} />
                  ),
                }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
         options={{
                  tabBarShowLabel: false,
                  headerShown: false,
                  tabBarIcon: ({ color }) => (
                    <Ionicons size={28} name='notifications-outline' color={"white"} />
                  ),
                }}
      />
    
    </Tab.Navigator>
  );
}