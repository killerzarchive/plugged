import { PFP_MUTATION, UPDATE_LOCATION } from "@/app/apollo/mutations/app";
import { ME_QUERY } from "@/app/apollo/queries/general";
import { pickImage, uploadPfp } from "@/lib/uploadPfp";
import { useMutation, useQuery } from "@apollo/client/react";
import * as ExpoLocation from "expo-location";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { ArrowLeft, Camera, MapPin } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const BLUE = "#1877F2";

interface MeData {
  me: {
    id: string;
    name: string;
    bio?: string;
    pfp?: string;
    location?: { latitude?: number; longitude?: number; address?: string };
  };
}

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const { data: meData } = useQuery<MeData>(ME_QUERY);
  const me = meData?.me;

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [pfpUri, setPfpUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (me) {
      setName(me.name ?? "");
      setAddress(me.location?.address ?? "");
    }
  }, [me]);

  const [updateProfile] = useMutation(PFP_MUTATION, {
    refetchQueries: [{ query: ME_QUERY }],
  });
  const [updateLocation] = useMutation(UPDATE_LOCATION, {
    refetchQueries: [{ query: ME_QUERY }],
  });

  const handlePickImage = async () => {
    try {
      setUploading(true);
      setError("");
      const uri = await pickImage();
      if (uri) setPfpUri(uri);
    } catch {
      setError("Failed to pick image");
    } finally {
      setUploading(false);
    }
  };

  const handleUseCurrentLocation = async () => {
    try {
      setLocating(true);
      setError("");
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setError("Location permission denied");
        return;
      }
      const pos = await ExpoLocation.getCurrentPositionAsync({});
      const [geo] = await ExpoLocation.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      const parts = [geo.name, geo.city, geo.region, geo.country].filter(Boolean);
      setAddress(parts.join(", "));
    } catch {
      setError("Failed to get location");
    } finally {
      setLocating(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");

      const profileUpdates: Record<string, string> = {};
      if (name.trim() && name.trim() !== me?.name) {
        profileUpdates.name = name.trim();
      }

      if (pfpUri && me?.id) {
        const { publicUrl } = await uploadPfp(me.id, pfpUri);
        profileUpdates.pfp = publicUrl;
      }

      if (Object.keys(profileUpdates).length > 0) {
        await updateProfile({ variables: { data: profileUpdates } });
      }

      if (address.trim() && address.trim() !== me?.location?.address) {
        const results = await ExpoLocation.geocodeAsync(address.trim());
        const loc = results?.[0];
        if (loc) {
          await updateLocation({
            variables: {
              latitude: loc.latitude,
              longitude: loc.longitude,
              address: address.trim(),
            },
          });
        }
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      setError("Failed to save changes");
      setSaving(false);
    }
  };

  const currentPfp = pfpUri ?? me?.pfp;
  const initial = (me?.name ?? "?")[0]?.toUpperCase();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#000" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.82}
          style={styles.backBtn}
        >
          <ArrowLeft size={18} color="#fff" strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity
          onPress={handleSave}
          activeOpacity={0.82}
          disabled={saving}
          style={[styles.saveBtn, saving && { opacity: 0.5 }]}
        >
          {saving ? (
            <ActivityIndicator color="#000" size="small" />
          ) : (
            <Text style={styles.saveBtnText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 40, paddingHorizontal: 20 }}
      >
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity
            onPress={handlePickImage}
            activeOpacity={0.82}
            disabled={uploading}
            style={styles.avatarWrap}
          >
            {currentPfp ? (
              <Image
                source={{ uri: currentPfp }}
                style={StyleSheet.absoluteFillObject}
                resizeMode="cover"
              />
            ) : (
              <Text style={styles.avatarInitial}>{initial}</Text>
            )}
            <View style={styles.cameraOverlay}>
              {uploading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Camera size={16} color="#fff" strokeWidth={2} />
              )}
            </View>
          </TouchableOpacity>
          <Text style={styles.avatarHint}>Tap to change photo</Text>
        </View>

        {/* Name */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>NAME</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor="rgba(255,255,255,0.25)"
            style={styles.input}
            autoCapitalize="words"
            returnKeyType="done"
            maxLength={50}
          />
        </View>

        {/* Location */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>LOCATION</Text>
          <TextInput
            value={address}
            onChangeText={setAddress}
            placeholder="Your city or address"
            placeholderTextColor="rgba(255,255,255,0.25)"
            style={styles.input}
            returnKeyType="done"
            multiline={false}
          />
          <TouchableOpacity
            onPress={handleUseCurrentLocation}
            activeOpacity={0.82}
            disabled={locating}
            style={styles.locateBtn}
          >
            {locating ? (
              <ActivityIndicator color={BLUE} size="small" />
            ) : (
              <MapPin size={13} color={BLUE} strokeWidth={2} />
            )}
            <Text style={styles.locateBtnText}>
              {locating ? "Detecting…" : "Use current location"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#1a1a1a",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#222",
  },
  headerTitle: {
    color: "#fff",
    fontFamily: "Roobert-Bold",
    fontSize: 16,
    letterSpacing: -0.4,
  },
  saveBtn: {
    height: 36,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 64,
  },
  saveBtnText: {
    color: "#000",
    fontFamily: "Roobert-Bold",
    fontSize: 13,
    letterSpacing: -0.2,
  },
  errorBanner: {
    backgroundColor: "rgba(255,59,48,0.12)",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,59,48,0.3)",
  },
  errorText: {
    color: "#FF3B30",
    fontFamily: "Roobert-Medium",
    fontSize: 13,
  },
  avatarSection: {
    alignItems: "center",
    paddingVertical: 32,
  },
  avatarWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#111",
    borderWidth: 2,
    borderColor: "#333",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    color: "#fff",
    fontFamily: "Roobert-Bold",
    fontSize: 34,
  },
  cameraOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 30,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarHint: {
    color: "rgba(255,255,255,0.3)",
    fontFamily: "Roobert-Regular",
    fontSize: 12,
    marginTop: 10,
  },
  fieldGroup: {
    marginBottom: 24,
  },
  fieldLabel: {
    color: "rgba(255,255,255,0.35)",
    fontFamily: "Roobert-SemiBold",
    fontSize: 10,
    letterSpacing: 0.7,
    marginBottom: 8,
  },
  input: {
    height: 46,
    borderRadius: 12,
    backgroundColor: "#111",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#222",
    paddingHorizontal: 14,
    color: "#fff",
    fontFamily: "Roobert-Regular",
    fontSize: 14,
  },
  locateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    alignSelf: "flex-start",
  },
  locateBtnText: {
    color: BLUE,
    fontFamily: "Roobert-SemiBold",
    fontSize: 12,
    letterSpacing: -0.1,
  },
});
