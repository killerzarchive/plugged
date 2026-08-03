import { useMutation } from "@apollo/client/react";
import { useColors } from "@/contexts/theme";
import { layout } from "@/constants/layout";
import { type } from "@/constants/typography";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Circle, Line } from "react-native-svg";
import { AuthPayload, LOGIN_MUTATION } from "../../app/apollo/mutations/auth";
import { useAuth } from "../../contexts/auth";

// ─── Dynamic Island ───────────────────────────────────────────────────────────
function DynamicIsland() {
  return (
    <View style={styles.islandWrap}>
      <View style={styles.island} />
    </View>
  );
}

// ─── Plugged Logo Mark (SVG circle with dots) ─────────────────────────────────
function PluggedMark({ color, size = 28 }: { color: string; size?: number }) {
  const r = size / 2;
  const dot = size * 0.12;
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <Circle cx="14" cy="14" r="13" stroke={color} strokeWidth={1.5} />
      <Circle cx="14" cy="8" r={dot} fill={color} />
      <Circle cx="19.5" cy="11" r={dot} fill={color} />
      <Circle cx="19.5" cy="17" r={dot} fill={color} />
      <Circle cx="14" cy="20" r={dot} fill={color} />
      <Circle cx="8.5" cy="17" r={dot} fill={color} />
      <Circle cx="8.5" cy="11" r={dot} fill={color} />
    </Svg>
  );
}

// ─── Google / Apple icons (minimal SVG) ──────────────────────────────────────
function IconGoogle({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <Circle cx="9" cy="9" r="8" stroke="#888" strokeWidth={1.2} />
      <Line x1="9" y1="9" x2="14" y2="9" stroke="#888" strokeWidth={1.2} />
      <Line x1="9" y1="5" x2="9" y2="13" stroke="#888" strokeWidth={1.2} />
    </Svg>
  );
}

function IconApple({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="8" r="3.5" stroke={color} strokeWidth={1.5} />
      <Line x1="12" y1="11.5" x2="12" y2="20" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Line x1="7" y1="20" x2="17" y2="20" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

// ─── Input ────────────────────────────────────────────────────────────────────
function Input({
  label, value, onChangeText, placeholder,
  secureTextEntry, keyboardType, autoCapitalize, autoComplete, right,
}: {
  label?: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address" | "numeric" | "phone-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoComplete?: "email" | "password" | "username" | "tel" | "name" | "given-name" | "family-name" | "new-password" | "off";
  right?: React.ReactNode;
}) {
  const C = useColors();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginBottom: 10 }}>
      {label ? (
        <Text style={[styles.inputLabel, { color: C.txt2 }]}>{label}</Text>
      ) : null}
      <View style={[
        styles.inputWrap,
        {
          backgroundColor: focused ? C.bg3 : C.input,
          borderColor: focused ? C.border2 : C.inputBorder,
        },
      ]}>
        <TextInput
          style={[styles.inputText, { color: C.txt }]}
          placeholder={placeholder}
          placeholderTextColor={C.txt3}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize ?? "none"}
          autoComplete={autoComplete}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {right}
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function LoginScreen() {
  const C = useColors();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [login, { loading, error }] = useMutation<{ login: AuthPayload }>(LOGIN_MUTATION, {
    onCompleted: async (data: { login: AuthPayload }) => {
      if (data?.login?.token) {
        await signIn(data.login.token);
        router.replace("/(tabs)");
      }
    },
  });

  const canSubmit = !loading && email.trim().length > 0 && password.trim().length > 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.bg }]}>
      <StatusBar barStyle={C.statusBar} />
      <DynamicIsland />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: 48 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo + Wordmark */}
          <View style={styles.logoRow}>
            <PluggedMark color={C.txt} size={28} />
            <Text style={[styles.wordmark, { color: C.txt }]}>plugged</Text>
          </View>

          {/* Tagline */}
          <Text style={[styles.tagline, { color: C.txt2 }]}>
            The live map of where your city is going out.
          </Text>

          {/* Heading */}
          <Text style={[styles.heading, { color: C.txt }]}>Welcome back</Text>

          {/* Form */}
          <Input
            label="Email or phone"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoComplete="email"
          />
          <Input
            label="Password"
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoComplete="password"
            right={
              <TouchableOpacity
                onPress={() => setShowPassword(v => !v)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.showHide, { color: C.txt3 }]}>
                  {showPassword ? "Hide" : "Show"}
                </Text>
              </TouchableOpacity>
            }
          />

          {/* Forgot password */}
          <TouchableOpacity style={{ alignSelf: "flex-end", marginBottom: 4, marginTop: 2 }}>
            <Text style={[styles.forgotText, { color: C.txt2 }]}>Forgot password?</Text>
          </TouchableOpacity>

          {/* Error */}
          {error && (
            <View style={[styles.errorBox, { backgroundColor: C.bg3, borderColor: C.border }]}>
              <Text style={[styles.errorText, { color: C.txt2 }]}>{error.message}</Text>
            </View>
          )}

          {/* Sign in */}
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={() => {
              if (!canSubmit) return;
              login({ variables: { email: email.trim().toLowerCase(), password: password.trim() } });
            }}
            disabled={!canSubmit}
            style={[styles.primaryBtn, { backgroundColor: C.accent, opacity: canSubmit ? 1 : 0.35 }]}
          >
            {loading
              ? <ActivityIndicator color={C.accentInv} />
              : <Text style={[styles.primaryBtnText, { color: C.accentInv }]}>Sign in</Text>
            }
          </TouchableOpacity>

          {/* OR divider */}
          <View style={styles.orRow}>
            <View style={[styles.orLine, { backgroundColor: C.border }]} />
            <Text style={[styles.orText, { color: C.txt3 }]}>or</Text>
            <View style={[styles.orLine, { backgroundColor: C.border }]} />
          </View>

          {/* Social buttons */}
          <TouchableOpacity
            activeOpacity={0.82}
            style={[styles.socialBtn, { backgroundColor: C.card, borderColor: C.border }]}
          >
            <IconGoogle size={17} />
            <Text style={[styles.socialBtnText, { color: C.txt }]}>Continue with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.82}
            style={[styles.socialBtn, { backgroundColor: C.card, borderColor: C.border }]}
          >
            <IconApple color={C.txt} size={17} />
            <Text style={[styles.socialBtnText, { color: C.txt }]}>Continue with Apple</Text>
          </TouchableOpacity>

          {/* Link to sign up */}
          <View style={styles.signupRow}>
            <Text style={[styles.signupPrompt, { color: C.txt2 }]}>Don't have an account?</Text>
            <TouchableOpacity onPress={() => router.push("/(auth)/signup")}>
              <Text style={[styles.signupLink, { color: C.txt }]}> Sign up</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1 },
  islandWrap: { alignItems: "center", paddingTop: 8, marginBottom: 4 },
  island: {
    width: layout.dynamicIsland.width,
    height: layout.dynamicIsland.height,
    borderRadius: layout.dynamicIsland.borderRadius,
    backgroundColor: "#000",
  },
  scroll: { paddingHorizontal: layout.screenPadding, paddingTop: 20 },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  wordmark: { ...type.appName },
  tagline: { ...type.body, marginBottom: 32 },
  heading: { ...type.h1, marginBottom: 22 },
  inputLabel: { ...type.label, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.06 },
  inputWrap: {
    height: layout.inputHeight,
    borderRadius: layout.inputRadius,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
  },
  inputText: { flex: 1, fontFamily: "Roobert-Regular", fontSize: 15 },
  showHide: { fontFamily: "Roobert-Medium", fontSize: 13 },
  forgotText: { fontFamily: "Roobert-Medium", fontSize: 13, marginBottom: 16 },
  errorBox: { borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12 },
  errorText: { fontFamily: "Roobert-Medium", fontSize: 13 },
  primaryBtn: {
    height: layout.btnHeight,
    borderRadius: layout.btnRadius,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  primaryBtnText: { fontFamily: "Roobert-Bold", fontSize: 15 },
  orRow: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 18 },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth },
  orText: { fontFamily: "Roobert-Regular", fontSize: 13 },
  socialBtn: {
    height: layout.btnHeight,
    borderRadius: layout.btnRadius,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 10,
  },
  socialBtnText: { fontFamily: "Roobert-SemiBold", fontSize: 15 },
  signupRow: { flexDirection: "row", justifyContent: "center", marginTop: 16 },
  signupPrompt: { fontFamily: "Roobert-Regular", fontSize: 14 },
  signupLink: { fontFamily: "Roobert-SemiBold", fontSize: 14 },
});
