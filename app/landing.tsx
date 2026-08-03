import { useColors } from "@/contexts/theme";
import { layout } from "@/constants/layout";
import { router } from "expo-router";
import React from "react";
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function Landing() {
  const C = useColors();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle={C.statusBar} />
      <View style={{ flex: 1, paddingHorizontal: layout.screenPadding, paddingTop: 20, paddingBottom: 40, justifyContent: "space-between" }}>

        {/* Wordmark */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.accent }} />
          <Text style={{ color: C.txt, fontFamily: "Roobert-Bold", fontSize: 20, letterSpacing: -0.5 }}>
            plugged
          </Text>
        </View>

        {/* Hero */}
        <View>
          <Text style={{ color: C.txt, fontFamily: "Roobert-Bold", fontSize: 48, letterSpacing: -1.5, lineHeight: 54, marginBottom: 16 }}>
            Show friends{"\n"}where to be.
          </Text>
          <Text style={{ color: C.txt2, fontFamily: "Roobert-Regular", fontSize: 17, lineHeight: 26 }}>
            Share where you're at, drop hotspots, and let your crew know what's worth checking out nearby.
          </Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 24 }}>
            {["Drop hotspots", "See what's trending", "Follow friends"].map((label) => (
              <View key={label} style={{
                backgroundColor: C.pill, borderRadius: layout.pillRadius,
                paddingHorizontal: 14, paddingVertical: 7,
                borderWidth: StyleSheet.hairlineWidth, borderColor: C.pillBorder,
              }}>
                <Text style={{ color: C.txt2, fontFamily: "Roobert-Medium", fontSize: 13 }}>{label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* CTAs */}
        <View style={{ gap: layout.gap.sm }}>
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={() => router.push("/(auth)/signup")}
            style={{
              backgroundColor: C.accent, height: layout.btnHeight,
              borderRadius: layout.btnRadius, alignItems: "center", justifyContent: "center",
            }}
          >
            <Text style={{ color: C.accentInv, fontFamily: "Roobert-Bold", fontSize: 15, letterSpacing: -0.3 }}>
              Get started
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.82}
            onPress={() => router.push("/(auth)/login")}
            style={{
              height: layout.btnHeight, borderRadius: layout.btnRadius,
              alignItems: "center", justifyContent: "center",
              borderWidth: 0.5, borderColor: C.border,
            }}
          >
            <Text style={{ color: C.txt, fontFamily: "Roobert-SemiBold", fontSize: 15, letterSpacing: -0.3 }}>
              Sign in
            </Text>
          </TouchableOpacity>

          <Text style={{ color: C.txt3, fontFamily: "Roobert-Regular", fontSize: 11, textAlign: "center", marginTop: 4 }}>
            By continuing you agree to our Terms of Service.
          </Text>
        </View>

      </View>
    </SafeAreaView>
  );
}
