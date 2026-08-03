import tw from "@/lib/tw";
import { useMutation } from "@apollo/client/react";
import * as ExpoLocation from "expo-location";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { UPDATE_LOCATION } from "../../apollo/mutations/location";

interface LocationCoords {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  altitudeAccuracy: number | null;
  heading: number | null;
  speed: number | null;
}

interface LocationData {
  id: string;
  latitude: number;
  longitude: number;
  address?: string;
}

interface LocationScreenProps {
  onComplete?: () => void;
}

export default function LocationScreen({ onComplete }: LocationScreenProps) {
  const [location, setLocation] = React.useState<LocationCoords | null>(null);
  const [address, setAddress] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string>("");

  const [updateLocation, { loading: updating }] = useMutation<
    { updateLocation: LocationData },
    { latitude: number; longitude: number; address?: string }
  >(UPDATE_LOCATION);

  const requestLocation = React.useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setError("Location permission was denied. You can update this in settings.");
        return;
      }

      const loc = await ExpoLocation.getCurrentPositionAsync({
        accuracy: ExpoLocation.Accuracy.Balanced,
      });
      setLocation(loc.coords);

      const geocode = await ExpoLocation.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });

      if (geocode.length > 0) {
        const place = geocode[0];
        // Build a friendly address: "City, State" or full if available
        const parts = [
          place.streetNumber,
          place.street,
          place.city,
          place.region,
          place.postalCode,
        ].filter(Boolean);
        setAddress(parts.join(", "));
      }
    } catch (e) {
      setError("Couldn't get your location. Please try again.");
      console.warn("Location error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveLocation = React.useCallback(async () => {
    if (!location) return;
    try {
      await updateLocation({
        variables: {
          latitude: location.latitude,
          longitude: location.longitude,
          address: address || undefined,
        },
      });
      await SecureStore.setItemAsync("onboardingComplete", "true");
      try {
        router.replace("/(tabs)");
      } catch {
        onComplete?.();
      }
    } catch (e) {
      setError("Couldn't save your location. Please try again.");
      console.warn("Save location error:", e);
    }
  }, [location, address, updateLocation, onComplete]);

  // Derive a friendly city/state label
  const cityLabel = React.useMemo(() => {
    if (!address) return null;
    const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 3) return `${parts[parts.length - 3]}, ${parts[parts.length - 2]}`;
    if (parts.length === 2) return `${parts[0]}, ${parts[1]}`;
    return parts[0] ?? null;
  }, [address]);

  return (
    <SafeAreaView style={tw`flex-1 bg-black`}>
      <View style={tw`flex-1 px-7 justify-between py-8`}>

        {/* Progress indicator */}
        <View style={tw`flex-row gap-1.5`}>
          <View style={tw`h-1 flex-1 bg-white rounded-full`} />
          <View style={tw`h-1 flex-1 bg-white rounded-full`} />
        </View>

        {/* Content */}
        <View>
          <Text style={[tw`text-white text-4xl mb-2`, { fontFamily: "Roobert-Bold" }]}>
            Where are you based?
          </Text>
          <Text style={[tw`text-gray-400 mb-10`, { fontFamily: "Roobert-Regular" }]}>
            We'll show you what's happening near you and help your friends find you.
          </Text>

          {/* Error */}
          {error ? (
            <View style={tw`bg-[#1a0000] border border-red-900 rounded-xl px-4 py-3 mb-6`}>
              <Text style={[tw`text-red-400 text-sm`, { fontFamily: "Roobert-Medium" }]}>
                {error}
              </Text>
            </View>
          ) : null}

          {/* Location result card */}
          {location && (
            <View style={tw`border border-[#2a2a2a] rounded-2xl p-5 mb-6`}>
              <Text style={[tw`text-gray-500 text-xs mb-1`, { fontFamily: "Roobert-Medium" }]}>
                Your location
              </Text>
              {cityLabel ? (
                <Text style={[tw`text-white text-xl`, { fontFamily: "Roobert-SemiBold" }]}>
                  {cityLabel}
                </Text>
              ) : null}
              {address ? (
                <Text style={[tw`text-gray-400 text-sm mt-1`, { fontFamily: "Roobert-Regular" }]}>
                  {address}
                </Text>
              ) : null}
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={tw`gap-3`}>
          {!location ? (
            <TouchableOpacity
              onPress={requestLocation}
              disabled={loading}
              activeOpacity={0.85}
              style={[tw`w-full bg-white py-4 rounded-2xl items-center`, loading && tw`opacity-40`]}
            >
              {loading ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <Text style={[tw`text-black text-base`, { fontFamily: "Roobert-SemiBold" }]}>
                  Use my location
                </Text>
              )}
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                onPress={saveLocation}
                disabled={updating}
                activeOpacity={0.85}
                style={[tw`w-full bg-white py-4 rounded-2xl items-center`, updating && tw`opacity-40`]}
              >
                {updating ? (
                  <ActivityIndicator color="#000" size="small" />
                ) : (
                  <Text style={[tw`text-black text-base`, { fontFamily: "Roobert-SemiBold" }]}>
                    Confirm location
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={requestLocation}
                disabled={loading}
                activeOpacity={0.85}
                style={tw`w-full border border-[#2a2a2a] py-4 rounded-2xl items-center`}
              >
                <Text style={[tw`text-white text-base`, { fontFamily: "Roobert-SemiBold" }]}>
                  Try again
                </Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity
            onPress={async () => {
              await SecureStore.setItemAsync("onboardingComplete", "true");
              router.replace("/(tabs)");
            }}
            activeOpacity={0.7}
            style={tw`items-center py-2`}
          >
            <Text style={[tw`text-gray-600 text-sm`, { fontFamily: "Roobert-Medium" }]}>
              Skip for now
            </Text>
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  );
}
