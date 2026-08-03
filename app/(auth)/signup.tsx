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
import Svg, { Circle, Polyline, Rect } from "react-native-svg";
import { AuthPayload, SIGNUP_MUTATION } from "../../app/apollo/mutations/auth";
import { useAuth } from "../../contexts/auth";

// ─── Dynamic Island ───────────────────────────────────────────────────────────
function DynamicIsland() {
  return (
    <View style={styles.islandWrap}>
      <View style={styles.island} />
    </View>
  );
}

// ─── Plugged Mark ─────────────────────────────────────────────────────────────
function PluggedMark({ color, size = 28 }: { color: string; size?: number }) {
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

// ─── Checkbox ─────────────────────────────────────────────────────────────────
function Checkbox({ checked, onToggle, label, color }: { checked: boolean; onToggle: () => void; label: string; color: string }) {
  const C = useColors();
  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.82}
      style={styles.checkRow}
    >
      <View style={[
        styles.checkBox,
        {
          backgroundColor: checked ? C.accent : "transparent",
          borderColor: checked ? C.accent : C.border2,
        },
      ]}>
        {checked && (
          <Svg width={12} height={12} viewBox="0 0 12 12" fill="none">
            <Polyline points="2,6 5,9 10,3" stroke={C.accentInv} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        )}
      </View>
      <Text style={[styles.checkLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Input ────────────────────────────────────────────────────────────────────
function Input({
  label, value, onChangeText, placeholder,
  secureTextEntry, keyboardType, autoCapitalize, autoComplete, right, style,
}: {
  label?: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address" | "numeric" | "phone-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoComplete?: "email" | "password" | "username" | "tel" | "name" | "given-name" | "family-name" | "new-password" | "off";
  right?: React.ReactNode;
  style?: object;
}) {
  const C = useColors();
  const [focused, setFocused] = useState(false);
  return (
    <View style={[{ marginBottom: 10 }, style]}>
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
export default function SignupScreen() {
  const C = useColors();
  const { signIn } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);

  const [signup, { loading, error }] = useMutation<{ signup: AuthPayload }>(SIGNUP_MUTATION, {
    onCompleted: async (data: { signup: AuthPayload }) => {
      if (data?.signup?.token) {
        await signIn(data.signup.token);
        router.replace("/(auth)/setup/moreinfo");
      }
    },
  });

  const canSubmit =
    !loading &&
    firstName.trim().length > 0 &&
    email.trim().length > 0 &&
    username.trim().length > 0 &&
    password.trim().length > 0 &&
    ageConfirmed;

  const handleSignup = () => {
    if (!canSubmit) return;
    signup({
      variables: {
        name: `${firstName.trim()} ${lastName.trim()}`.trim(),
        email: email.trim().toLowerCase(),
        password: password.trim(),
      },
    });
  };

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

          {/* Heading */}
          <Text style={[styles.heading, { color: C.txt }]}>Create your account</Text>
          <Text style={[styles.subheading, { color: C.txt2 }]}>
            Join your community and start sharing what's happening near you.
          </Text>

          {/* First + Last name (side by side) */}
          <View style={styles.nameRow}>
            <View style={{ flex: 1 }}>
              <Input
                label="First name"
                placeholder="First"
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
                autoComplete="given-name"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label="Last name"
                placeholder="Last"
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
                autoComplete="family-name"
              />
            </View>
          </View>

          <Input
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoComplete="email"
          />

          <Input
            label="Phone"
            placeholder="+1 (555) 000-0000"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoComplete="tel"
          />

          <Input
            label="Username"
            placeholder="@handle"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoComplete="username"
          />

          <Input
            label="Password"
            placeholder="Create a password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoComplete="new-password"
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

          {/* Age confirmation */}
          <Checkbox
            checked={ageConfirmed}
            onToggle={() => setAgeConfirmed(v => !v)}
            label="I confirm I am 18 years of age or older"
            color={C.txt2}
          />

          {/* Error */}
          {error && (
            <View style={[styles.errorBox, { backgroundColor: C.bg3, borderColor: C.border }]}>
              <Text style={[styles.errorText, { color: C.txt2 }]}>{error.message}</Text>
            </View>
          )}

          {/* Create account */}
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={handleSignup}
            disabled={!canSubmit}
            style={[styles.primaryBtn, { backgroundColor: C.accent, opacity: canSubmit ? 1 : 0.35 }]}
          >
            {loading
              ? <ActivityIndicator color={C.accentInv} />
              : <Text style={[styles.primaryBtnText, { color: C.accentInv }]}>Create my account</Text>
            }
          </TouchableOpacity>

          {/* OR divider */}
          <View style={styles.orRow}>
            <View style={[styles.orLine, { backgroundColor: C.border }]} />
            <Text style={[styles.orText, { color: C.txt3 }]}>or</Text>
            <View style={[styles.orLine, { backgroundColor: C.border }]} />
          </View>

          {/* Sign up with Google */}
          <TouchableOpacity
            activeOpacity={0.82}
            style={[styles.socialBtn, { backgroundColor: C.card, borderColor: C.border }]}
          >
            <Text style={[styles.socialBtnText, { color: C.txt }]}>Sign up with Google</Text>
          </TouchableOpacity>

          {/* Link back to login */}
          <View style={styles.loginRow}>
            <Text style={[styles.loginPrompt, { color: C.txt2 }]}>Already have an account?</Text>
            <TouchableOpacity onPress={() => router.push("/(auth)/login")}>
              <Text style={[styles.loginLink, { color: C.txt }]}> Sign in</Text>
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
  scroll: { paddingHorizontal: layout.screenPadding, paddingTop: 16 },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  wordmark: { ...type.appName },
  heading: { ...type.h1, marginBottom: 6 },
  subheading: { ...type.body, marginBottom: 22 },
  nameRow: { flexDirection: "row", gap: 10 },
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
  checkRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16, marginTop: 6 },
  checkBox: {
    width: 20, height: 20, borderRadius: 5,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center", justifyContent: "center",
  },
  checkLabel: { fontFamily: "Roobert-Regular", fontSize: 14, flex: 1 },
  errorBox: { borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12 },
  errorText: { fontFamily: "Roobert-Medium", fontSize: 13 },
  primaryBtn: {
    height: layout.btnHeight,
    borderRadius: layout.btnRadius,
    alignItems: "center",
    justifyContent: "center",
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
  loginRow: { flexDirection: "row", justifyContent: "center", marginTop: 16 },
  loginPrompt: { fontFamily: "Roobert-Regular", fontSize: 14 },
  loginLink: { fontFamily: "Roobert-SemiBold", fontSize: 14 },
});
