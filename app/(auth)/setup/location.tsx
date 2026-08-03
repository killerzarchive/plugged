import tw from "@/lib/tw";
import { useMutation } from "@apollo/client/react";
import * as ExpoLocation from "expo-location";
import * as SecureStore from "expo-secure-store";
import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
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

// 👇 Add explicit props type here
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
        setError("Permission to access location was denied");
        return;
      }

      const loc = await ExpoLocation.getCurrentPositionAsync({
        accuracy: ExpoLocation.Accuracy.High,
      });
      setLocation(loc.coords);

      const geocode = await ExpoLocation.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });

      if (geocode.length > 0) {
        const place = geocode[0];
        const fullAddress = [
          place.streetNumber,
          place.street,
          place.city,
          place.region,
          place.postalCode,
        ]
          .filter(Boolean)
          .join(", ");
        setAddress(fullAddress);
      }
    } catch (e) {
      setError("Failed to get location");
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

      // 👇 triggers moving to MainTabs
      onComplete?.();
    } catch (e) {
      setError("Failed to save location");
      console.warn("Save location error:", e);
    }
  }, [location, address, updateLocation, onComplete]);

  return (
    <View style={tw`flex-1 bg-black px-7 py-10`}>
      <View style={tw`mt-10`}>
        <Text style={tw`text-white text-2xl font-bold mb-2`}>
          Set Your Location
        </Text>
        <Text style={tw`text-gray-400 text-sm mb-8`}>
          We'll use your location to show you nearby users and events
        </Text>

        {error && (
          <View style={tw`bg-red-900 rounded p-3 mb-4`}>
            <Text style={tw`text-red-200`}>{error}</Text>
          </View>
        )}

        {!location && (
          <TouchableOpacity
            onPress={requestLocation}
            disabled={loading}
            style={tw`bg-blue-600 rounded-lg py-4 items-center ${
              loading ? "opacity-50" : ""
            }`}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={tw`text-white font-semibold text-lg`}>
                Get My Location
              </Text>
            )}
          </TouchableOpacity>
        )}

        {location && (
          <View style={tw`bg-gray-900 rounded-lg p-4 mb-6`}>
            <Text style={tw`text-white font-semibold mb-2`}>
              Current Location
            </Text>
            <Text style={tw`text-gray-400 text-sm mb-1`}>
              Lat: {location.latitude.toFixed(6)}
            </Text>
            <Text style={tw`text-gray-400 text-sm mb-2`}>
              Lng: {location.longitude.toFixed(6)}
            </Text>
            {address && (
              <Text style={tw`text-gray-300 text-sm mt-2`}>{address}</Text>
            )}
          </View>
        )}

        {location && (
          <View style={tw`flex-row gap-3`}>
            <TouchableOpacity
              onPress={requestLocation}
              disabled={loading}
              style={tw`flex-1 bg-gray-700 rounded-lg py-3 items-center`}
            >
              <Text style={tw`text-white font-semibold`}>Refresh</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={saveLocation}
              disabled={updating}
              style={tw`flex-1 bg-blue-600 rounded-lg py-3 items-center ${
                updating ? "opacity-50" : ""
              }`}
            >
              {updating ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={tw`text-white font-semibold`}>Save Location</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({});
