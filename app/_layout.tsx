import "../global.css";
import { ApolloProvider } from "@apollo/client/react";
import { useFonts } from "expo-font";
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { AuthProvider, useAuth } from "../contexts/auth";
import { ThemeProvider } from "../contexts/theme";
import { client } from "./apollo/client";

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

function RootLayoutContent() {
  const { isLoading } = useAuth();

  const [fontsLoaded] = useFonts({
    'Roobert-Regular': require('../assets/fonts/RoobertTRIAL-Regular-BF67243fd53fdf2.otf'),
    'Roobert-Medium': require('../assets/fonts/RoobertTRIAL-Medium-BF67243fd53e059.otf'),
    'Roobert-SemiBold': require('../assets/fonts/RoobertTRIAL-SemiBold-BF67243fd54213d.otf'),
    'Roobert-Bold': require('../assets/fonts/RoobertTRIAL-Bold-BF67243fd540abb.otf'),
    'Roobert-Heavy': require('../assets/fonts/RoobertTRIAL-Heavy-BF67243fd53e164.otf'),
    'Roobert-Light': require('../assets/fonts/RoobertTRIAL-Light-BF67243fd502239.otf'),
  });

  useEffect(() => {
    if (fontsLoaded) {
      // Set default font after fonts are loaded
      (Text as any).defaultProps = (Text as any).defaultProps || {};
      (Text as any).defaultProps.style = { fontFamily: 'Roobert-Regular' };
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded || isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: '#000' }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="user/[id]" options={{ headerShown: true, title: 'User Profile', presentation: 'card' }} />
      <Stack.Screen name="hotspot/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="post/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="event/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="landing" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      <Stack.Screen name="posts" options={{ headerShown: false, presentation: 'transparentModal', animation: 'slide_from_bottom', contentStyle: { backgroundColor: 'transparent' } }} />
      <Stack.Screen name="profile-view" options={{ headerShown: false, presentation: 'transparentModal', animation: 'slide_from_bottom', contentStyle: { backgroundColor: 'transparent' } }} />
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ApolloProvider client={client}>
      <AuthProvider>
        <ThemeProvider>
          <RootLayoutContent />
        </ThemeProvider>
      </AuthProvider>
    </ApolloProvider>
  );
}
