import { CREATE_HOTSPOT } from "@/app/apollo/mutations/app";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { pickHotspotImage, uploadHotspotImage } from "@/lib/uploadHotspotImage";
import { useMutation } from "@apollo/client/react";
// Removed automatic GPS location; hotspots should be entered manually.
import tw from "@/lib/tw";
import * as SecureStore from "expo-secure-store";
import React from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function CreateScreen() {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [type, setType] = React.useState("");
  const [site, setSite] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [number, setNumber] = React.useState("");
  const [isGroup, setIsGroup] = React.useState(false);
  const [isOrganization, setIsOrganization] = React.useState(false);
  const [isShop, setIsShop] = React.useState(false);
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);
  const [picking, setPicking] = React.useState(false);
  const [addressLine, setAddressLine] = React.useState("");
  const [city, setCity] = React.useState("");
  const [region, setRegion] = React.useState(""); // state/province
  const [postalCode, setPostalCode] = React.useState("");
  const [country, setCountry] = React.useState("");
  // Manual coordinates (keep default 0)
  const [latitude, setLatitude] = React.useState<string>("0");
  const [longitude, setLongitude] = React.useState<string>("0");

  const [createHotspot, { loading }] = useMutation(CREATE_HOTSPOT);

  // Build a single address string from manual parts
  const composedAddress = React.useMemo(() => {
    return [addressLine, city, region, postalCode, country]
      .map((p) => p.trim())
      .filter(Boolean)
      .join(", ");
  }, [addressLine, city, region, postalCode, country]);

  const onPickImage = React.useCallback(async () => {
    try {
      setPicking(true);
      const uri = await pickHotspotImage();
      if (!uri) return;
      // Try to associate upload with the current user id if available
      const userId = (await SecureStore.getItemAsync("userId")) || "anonymous";
      const uploaded = await uploadHotspotImage(userId, uri);
      setImageUrl(uploaded.publicUrl);
    } catch (e) {
      console.warn("Image pick/upload failed", e);
    } finally {
      setPicking(false);
    }
  }, []);

  const onCreate = React.useCallback(async () => {
    // Basic validation
    if (!name.trim()) {
      alert("Please enter a name");
      return;
    }

    // Validate required address
    if (!composedAddress.trim()) {
      alert("Please enter an address");
      return;
    }

    // Build input object, excluding empty values
    const data: Record<string, any> = {
      name: name.trim(),
      description: description.trim() || undefined,
      type: type.trim() || undefined,
      site: site.trim() || undefined,
      email: email.trim() || undefined,
      number: number.trim() || undefined,
      isGroup,
      isOrganization,
      isShop,
    };

    // Tentatively include avatar image URL if available; key name may vary server-side.
    // Include avatar field if image was uploaded
    if (imageUrl) {
      data.avatar = imageUrl;
    }

    // Include location with address and coordinates
    (data as any).location = {
      address: composedAddress,
      latitude: isNaN(parseFloat(latitude)) ? 0 : parseFloat(latitude),
      longitude: isNaN(parseFloat(longitude)) ? 0 : parseFloat(longitude),
    };

    // Remove undefined fields
    Object.keys(data).forEach((k) => data[k] === undefined && delete data[k]);

    try {
      await createHotspot({ variables: { data } });
      // Success UX
      setName("");
      setDescription("");
      setType("");
      setSite("");
      setEmail("");
      setNumber("");
      setIsGroup(false);
      setIsOrganization(false);
      setIsShop(false);
      setImageUrl(null);
      setAddressLine("");
      setCity("");
      setRegion("");
      setPostalCode("");
      setCountry("");
      setLatitude("0");
      setLongitude("0");
      alert("Hotspot created");
    } catch (e: any) {
      alert(e?.message || "Failed to create hotspot");
    }
  }, [
    name,
    description,
    type,
    site,
    email,
    number,
    isGroup,
    isOrganization,
    isShop,
    imageUrl,
    composedAddress,
    createHotspot,
  ]);

  // Removed GPS-based location acquisition; hotspots rely on manual address entry.

  return (
    <ScrollView
      style={tw`flex-1 bg-black`}
      contentContainerStyle={tw`px-5 py-6`}
    >
      <Text style={tw`text-white text-xl font-semibold mb-4`}>
        Create a Hotspot
      </Text>

      <TouchableOpacity
        onPress={onPickImage}
        disabled={picking}
        style={tw`mb-4 items-center justify-center h-32 rounded-xl bg-gray-900 border border-gray-800`}
      >
        {picking ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={tw`text-gray-300`}>
            {imageUrl ? "Change avatar image" : "Pick avatar image"}
          </Text>
        )}
      </TouchableOpacity>
      {imageUrl && (
        <Text style={tw`text-gray-400 text-xs mb-4`} numberOfLines={1}>
          Image: {imageUrl}
        </Text>
      )}

      <Text style={tw`text-white text-lg mt-2 mb-2`}>Location (manual)</Text>
      <LabeledInput
        label="Address line"
        value={addressLine}
        onChangeText={setAddressLine}
        placeholder="123 Main St"
      />
      <LabeledInput
        label="City"
        value={city}
        onChangeText={setCity}
        placeholder="City"
      />
      <LabeledInput
        label="State / Region"
        value={region}
        onChangeText={setRegion}
        placeholder="State / Region"
      />
      <LabeledInput
        label="Postal Code"
        value={postalCode}
        onChangeText={setPostalCode}
        placeholder="Postal Code"
        keyboardType="number-pad"
      />
      <LabeledInput
        label="Country"
        value={country}
        onChangeText={setCountry}
        placeholder="Country"
      />
      <LabeledInput
        label="Latitude"
        value={latitude}
        onChangeText={setLatitude}
        placeholder="0"
        keyboardType="decimal-pad"
      />
      <LabeledInput
        label="Longitude"
        value={longitude}
        onChangeText={setLongitude}
        placeholder="0"
        keyboardType="decimal-pad"
      />
      {composedAddress ? (
        <Text style={tw`text-gray-400 text-xs mb-4`}>
          Full address preview: {composedAddress}
        </Text>
      ) : (
        <Text style={tw`text-gray-600 text-xs mb-4`}>
          Enter location details so people know where to go.
        </Text>
      )}

      <LabeledInput
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder="Hotspot name"
      />
      <LabeledInput
        label="Description"
        value={description}
        onChangeText={setDescription}
        placeholder="What is this hotspot?"
        multiline
      />
      <LabeledInput
        label="Type"
        value={type}
        onChangeText={setType}
        placeholder="e.g., bar, club, shop"
      />
      <LabeledInput
        label="Website"
        value={site}
        onChangeText={setSite}
        placeholder="https://example.com"
        autoCapitalize="none"
      />
      <LabeledInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="contact@example.com"
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <LabeledInput
        label="Phone"
        value={number}
        onChangeText={setNumber}
        placeholder="(555) 123-4567"
        keyboardType="phone-pad"
      />

      <View style={tw`flex-row items-center justify-between mt-2`}>
        <Text style={tw`text-white`}>Is Group</Text>
        <Switch value={isGroup} onValueChange={setIsGroup} />
      </View>
      <View style={tw`flex-row items-center justify-between mt-2`}>
        <Text style={tw`text-white`}>Is Organization</Text>
        <Switch value={isOrganization} onValueChange={setIsOrganization} />
      </View>
      <View style={tw`flex-row items-center justify-between mt-2`}>
        <Text style={tw`text-white`}>Is Shop</Text>
        <Switch value={isShop} onValueChange={setIsShop} />
      </View>

      <TouchableOpacity
        onPress={onCreate}
        disabled={loading}
        style={tw`mt-6 bg-blue-600 py-3 rounded-xl items-center ${
          loading ? "opacity-60" : ""
        }`}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={tw`text-white font-semibold`}>Create Hotspot</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

CreateScreen.options = {
  title: "Create",
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

function LabeledInput({ label, style, ...props }: any) {
  return (
    <View style={tw`mb-3`}>
      <Text style={tw`text-gray-400 mb-1`}>{label}</Text>
      <TextInput
        placeholderTextColor="#666"
        style={tw`bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-white`}
        {...props}
      />
    </View>
  );
}
