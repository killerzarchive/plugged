import tw from "@/lib/tw";
import { useMutation, useQuery } from "@apollo/client/react";
import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import { router } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { MeData } from "../../(tabs)/profile";
import { pickImage, uploadPfp } from "../../../lib/uploadPfp";
import { PFP_MUTATION } from "../../apollo/mutations/app";
import { ME_QUERY } from "../../apollo/queries/general";

export default function ProfileSetupScreen() {
  const navigation = useNavigation();
  const { data: meData } = useQuery<MeData>(ME_QUERY);
  const [bio, setBio] = React.useState("");
  const [pfpUri, setPfpUri] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  const [updateProfile] = useMutation(PFP_MUTATION);

  const handlePickImage = React.useCallback(async () => {
    try {
      setUploading(true);
      setError("");
      const uri = await pickImage();
      if (uri) {
        setPfpUri(uri);
      }
    } catch (e) {
      setError("Failed to pick image");
      console.warn("Image picker error:", e);
    } finally {
      setUploading(false);
    }
  }, []);

  const handleSave = React.useCallback(async () => {
    try {
      setSaving(true);
      setError("");

      const updates: { bio?: string; pfp?: string } = {};
      const userId = meData?.me?.id;

      if (!userId) {
        throw new Error("User ID not found");
      }

      // Upload profile picture using Supabase if selected
      const uploadPromise = pfpUri ? uploadPfp(userId, pfpUri) : null;

      // Add bio if provided
      if (bio.trim()) {
        updates.bio = bio.trim();
      }

      // Wait for upload to complete
      if (uploadPromise) {
        const { publicUrl } = await uploadPromise;
        updates.pfp = publicUrl;
      }

      // Only call mutation if there are updates
      if (Object.keys(updates).length > 0) {
        await updateProfile({ variables: { data: updates } });
      }

      // Proceed to location setup next (do not mark onboarding complete until location saved)
      try {
        router.push("/(auth)/setup/location");
      } catch (e) {
        navigation.navigate("LocationSetup" as never);
      }
    } catch (e) {
      setError("Failed to save profile");
      console.warn("Save profile error:", e);
      setSaving(false);
    }
  }, [pfpUri, bio, meData?.me?.id, updateProfile, navigation]);

  const handleSkip = React.useCallback(async () => {
    try {
      router.push("/(auth)/setup/location");
    } catch (e) {
      navigation.navigate("LocationSetup" as never);
    }
  }, [navigation]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={tw`flex-1 bg-black`}
    >
      <ScrollView
        contentContainerStyle={tw`px-7 py-10 flex-grow`}
        keyboardShouldPersistTaps="handled"
      >
        <View style={tw`mt-10 flex-1`}>
          <Text style={tw`text-white text-3xl font-bold mb-2`}>
            Complete Your Profile
          </Text>
          <Text style={tw`text-gray-400 text-sm mb-8`}>
            Add a profile picture and bio to help others get to know you
          </Text>

          {error && (
            <View style={tw`bg-red-900 rounded-lg p-3 mb-4`}>
              <Text style={tw`text-red-200`}>{error}</Text>
            </View>
          )}

          {/* Profile Picture Section */}
          <View style={tw`items-center mb-8`}>
            <TouchableOpacity
              onPress={handlePickImage}
              disabled={uploading}
              style={tw`mb-3`}
            >
              {pfpUri ? (
                <Image
                  source={{ uri: pfpUri }}
                  style={tw`h-32 w-32 rounded-full`}
                />
              ) : (
                <View
                  style={tw`h-32 w-32 rounded-full bg-gray-800 border-2 border-gray-600 items-center justify-center`}
                >
                  {uploading ? (
                    <ActivityIndicator color="#60a5fa" />
                  ) : (
                    <Text style={tw`text-gray-400 text-4xl`}>+</Text>
                  )}
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={handlePickImage} disabled={uploading}>
              <Text style={tw`text-blue-500 font-semibold`}>
                {pfpUri ? "Change Photo" : "Add Profile Picture"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Bio Section */}
          <View style={tw`mb-8`}>
            <Text style={tw`text-white font-semibold mb-2`}>Bio</Text>
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder="Tell us about yourself..."
              placeholderTextColor="#9CA3AF"
              style={tw`text-white border border-gray-700 rounded-lg px-4 py-3 bg-gray-900 min-h-24`}
              multiline
              maxLength={160}
              textAlignVertical="top"
            />
            <Text style={tw`text-gray-500 text-xs mt-1 text-right`}>
              {bio.length}/160
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={tw`mt-auto gap-3`}>
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving || uploading}
              style={tw`bg-blue-600 rounded-lg py-4 items-center ${
                saving || uploading ? "opacity-50" : ""
              }`}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={tw`text-white font-semibold text-lg`}>
                  Continue
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSkip}
              disabled={saving || uploading}
              style={tw`py-3 items-center`}
            >
              <Text style={tw`text-gray-400 font-semibold`}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
