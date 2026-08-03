import { LabeledInput } from "@/components/ui/LabeledInput";
import tw from "@/lib/tw";
import { useMutation } from "@apollo/client/react";
import { router } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Image,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { pickImage, uploadPfp } from "../../../lib/uploadPfp";
import { PFP_MUTATION } from "../../apollo/mutations/app";
import { ME_QUERY } from "../../apollo/queries/general";

const USER_TYPES = [
  "Student",
  "Tourist",
  "Influencer",
  "Serial Traveler",
  "Creator",
  "Local Business",
  "Other",
];

export default function MoreInfoScreen() {
  const [pfpUri, setPfpUri] = React.useState<string | null>(null);
  const [bio, setBio] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [userType, setUserType] = React.useState<string | null>(null);

  const [updateProfile] = useMutation(PFP_MUTATION, {
    refetchQueries: [{ query: ME_QUERY }],
  });

  const handlePick = React.useCallback(async () => {
    try {
      setUploading(true);
      const uri = await pickImage();
      if (uri) setPfpUri(uri);
    } catch (e) {
      console.warn("Failed to pick image", e);
    } finally {
      setUploading(false);
    }
  }, []);

  const handleContinue = React.useCallback(async () => {
    try {
      setSaving(true);
      const updates: any = {};
      if (bio.trim()) updates.bio = bio.trim();
      if (userType) updates.type = userType;
      if (pfpUri) {
        let uid = "anonymous";
        try {
          const SecureStore = await import("expo-secure-store");
          const storedUserId = await SecureStore.getItemAsync("userId");
          if (storedUserId) uid = storedUserId;
        } catch {}
        try {
          const uploaded = await uploadPfp(uid, pfpUri);
          if (uploaded?.publicUrl) updates.pfp = uploaded.publicUrl;
        } catch (e) {
          console.warn("PFP upload failed", e);
        }
      }
      if (Object.keys(updates).length > 0) {
        await updateProfile({ variables: { data: updates } });
      }
      router.push("/(auth)/setup/location");
    } catch (e) {
      console.warn("Failed to save profile", e);
    } finally {
      setSaving(false);
    }
  }, [bio, pfpUri, updateProfile, userType]);

  const busy = saving || uploading;

  return (
    <SafeAreaView style={tw`flex-1 bg-black`}>
      <ScrollView
        contentContainerStyle={tw`px-7 py-8`}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Progress indicator */}
        <View style={tw`flex-row gap-1.5 mb-8`}>
          <View style={tw`h-1 flex-1 bg-white rounded-full`} />
          <View style={tw`h-1 flex-1 bg-[#222] rounded-full`} />
        </View>

        <Text style={[tw`text-white text-4xl mb-2`, { fontFamily: "Roobert-Bold" }]}>
          Set up your profile
        </Text>
        <Text style={[tw`text-gray-400 mb-8`, { fontFamily: "Roobert-Regular" }]}>
          Help your community know who you are.
        </Text>

        {/* Profile photo */}
        <TouchableOpacity
          onPress={handlePick}
          activeOpacity={0.8}
          style={tw`items-center mb-8`}
        >
          {pfpUri ? (
            <Image source={{ uri: pfpUri }} style={tw`w-24 h-24 rounded-full`} />
          ) : (
            <View
              style={tw`w-24 h-24 rounded-full border border-[#2a2a2a] items-center justify-center`}
            >
              {uploading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={[tw`text-white text-3xl`, { fontFamily: "Roobert-Light" }]}>
                  +
                </Text>
              )}
            </View>
          )}
          <Text style={[tw`text-gray-500 text-xs mt-2`, { fontFamily: "Roobert-Medium" }]}>
            {pfpUri ? "Tap to change" : "Add photo"}
          </Text>
        </TouchableOpacity>

        {/* User type */}
        <Text style={[tw`text-white mb-3`, { fontFamily: "Roobert-SemiBold" }]}>
          What brings you here?
        </Text>
        <View style={tw`flex-row flex-wrap gap-2 mb-6`}>
          {USER_TYPES.map((t) => {
            const selected = userType === t;
            return (
              <TouchableOpacity
                key={t}
                onPress={() => setUserType(selected ? null : t)}
                activeOpacity={0.8}
                style={[
                  tw`px-4 py-2 rounded-xl`,
                  selected
                    ? tw`bg-white`
                    : tw`border border-[#2a2a2a]`,
                ]}
              >
                <Text
                  style={[
                    tw`text-sm`,
                    selected ? tw`text-black` : tw`text-gray-300`,
                    { fontFamily: "Roobert-SemiBold" },
                  ]}
                >
                  {t}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Bio */}
        <LabeledInput
          label="Bio"
          value={bio}
          onChangeText={setBio}
          placeholder="Tell people what you're about…"
          multiline
          numberOfLines={3}
          containerStyle={{ marginBottom: 32 }}
        />

        {/* CTA */}
        <TouchableOpacity
          onPress={handleContinue}
          disabled={busy}
          activeOpacity={0.85}
          style={[tw`w-full bg-white py-4 rounded-2xl items-center`, busy && tw`opacity-40`]}
        >
          {saving ? (
            <ActivityIndicator color="#000" size="small" />
          ) : (
            <Text style={[tw`text-black text-base`, { fontFamily: "Roobert-SemiBold" }]}>
              Continue
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("/(auth)/setup/location")}
          activeOpacity={0.7}
          style={tw`items-center mt-4`}
        >
          <Text style={[tw`text-gray-600 text-sm`, { fontFamily: "Roobert-Medium" }]}>
            Skip for now
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
