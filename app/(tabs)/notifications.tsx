import { IconSymbol } from "@/components/ui/icon-symbol";
import tw from "@/lib/tw";
import { useMutation, useQuery } from "@apollo/client/react";
import React from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { pickImage, uploadPfp } from "../../lib/uploadPfp";
import { PFP_MUTATION } from "../apollo/mutations/app";
import { ME_QUERY } from "../apollo/queries/general";
import { MeData } from "./profile";

export default function NotificationsScreen() {
  const { data, error, loading } = useQuery<MeData>(ME_QUERY);
  const [updatingPfp, setUpdatingPfp] = React.useState(false);
  const [editingBio, setEditingBio] = React.useState(false);
  const [bioText, setBioText] = React.useState("");
  const [savingBio, setSavingBio] = React.useState(false);
  const [updateProfile] = useMutation(PFP_MUTATION, {
    refetchQueries: [ME_QUERY],
  });

  const handleAddPfp = React.useCallback(async () => {
    try {
      setUpdatingPfp(true);
      const uri = await pickImage();
      if (!uri) return;
      const userId = data?.me?.id;
      if (!userId) throw new Error('Missing user id');
      // Upload to Supabase storage
      const { publicUrl } = await uploadPfp(userId, uri);
      // Persist via GraphQL mutation
      await updateProfile({ variables: { data: { pfp: publicUrl } } });
    } catch (e) {
      console.warn('Failed to update profile picture:', e);
    } finally {
      setUpdatingPfp(false);
    }
  }, [data?.me?.id, updateProfile]);

  const startEditBio = React.useCallback(() => {
    setBioText("");
    setEditingBio(true);
  }, []);

  const cancelEditBio = React.useCallback(() => {
    setEditingBio(false);
    setBioText("");
  }, []);

  const saveBio = React.useCallback(async () => {
    const value = bioText.trim();
    if (!value) return;
    try {
      setSavingBio(true);
      await updateProfile({ variables: { data: { bio: value } } });
      setEditingBio(false);
      setBioText("");
    } catch (e) {
      console.warn("Failed to update bio:", e);
    } finally {
      setSavingBio(false);
    }
  }, [bioText, updateProfile]);
  if (loading)
    return (
      <View>
        <Text>Loading...</Text>
      </View>
    );
  if (error)
    return (
      <View>
        <Text>Error: {error.message}</Text>
      </View>
    );
  const me = data?.me;
  return (
    <View style={tw`flex flex-col bg-black`}>
      <View style={tw`mt-4 py-10 px-7`}>
        <Text style={tw`text-white mb-10 mt-1 text-center font-semibold`}>
          Activity Center
        </Text>
        <View style={tw` flex-col`}>
          <View>
            {(!me?.pfp || !me?.bio) && (
              <View style={tw`mb-5`}>
                <Text style={tw`text-white font-bold text-xl`}>
                  Complete your profile
                </Text>
                {!me?.pfp && (
                  <View style={tw`mt-3 flex flex-row items-center gap-3`}>
                    <View
                      style={tw`h-14 w-14 rounded-full border-gray-500 border`}
                    ></View>
                    <View style={tw`flex-1 flex-shrink`}>
                      <Text style={tw`text-white font-bold`}>
                        Add Profile Pic
                      </Text>
                      <Text style={tw`text-gray-400 text-sm`}>
                        Add a profile picture to your profile
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={handleAddPfp}
                      disabled={updatingPfp}
                      style={tw`px-4 py-2 rounded bg-blue-600`}
                    >
                      <Text style={tw`text-white font-semibold`}>
                        {updatingPfp ? 'Uploading...' : 'Add'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
                {!me?.bio && !editingBio && (
                  <View style={tw`mt-3 flex flex-row items-center gap-3`}>
                    <View style={tw`h-14 w-14 rounded-full border-gray-500 border`} />
                    <View style={tw`flex-1 flex-shrink`}>
                      <Text style={tw`text-white font-bold`}>Add Bio</Text>
                      <Text style={tw`text-gray-400 text-sm`}>Add a bio to your profile</Text>
                    </View>
                    <TouchableOpacity onPress={startEditBio} style={tw`px-4 py-2 rounded bg-blue-600`}>
                      <Text style={tw`text-white font-semibold`}>Add</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {!me?.bio && editingBio && (
                  <View style={tw`mt-3 flex flex-col gap-3`}>
                    <TextInput
                      value={bioText}
                      onChangeText={setBioText}
                      placeholder="Tell people about yourself..."
                      placeholderTextColor="#9CA3AF"
                      style={tw`text-white border border-gray-600 rounded px-3 py-2`}
                      multiline
                      maxLength={160}
                    />
                    <View style={tw`flex-row gap-3`}>
                      <TouchableOpacity onPress={cancelEditBio} style={tw`px-4 py-2 rounded bg-gray-700`} disabled={savingBio}>
                        <Text style={tw`text-white`}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={saveBio} style={tw`px-4 py-2 rounded bg-blue-600`} disabled={savingBio || bioText.trim().length === 0}>
                        <Text style={tw`text-white font-semibold`}>{savingBio ? 'Saving...' : 'Save'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>
          <View>
            <Text style={tw`text-white font-bold text-xl`}>Activity</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

NotificationsScreen.options = {
  title: "Notifications",
  tabBarIcon: ({ color }: { color: string }) => (
    <IconSymbol
      size={28}
      name="chevron.left.forwardslash.chevron.right"
      color={color}
    />
  ),
};

const styles = StyleSheet.create({
  headerImage: {
    color: "#808080",
    bottom: -90,
    left: -35,
    position: "absolute",
  },
  titleContainer: {
    flexDirection: "row",
    gap: 8,
  },
});
