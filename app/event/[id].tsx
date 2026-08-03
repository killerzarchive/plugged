import tw from "@/lib/tw";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, Image, Text, TouchableOpacity, View } from "react-native";
import MapView, { Marker } from "react-native-maps";

const HOTSPOT_QUERY = gql`
  query HotspotDetail($hotspotId: Int!) {
    hotspot(hotspotId: $hotspotId) {
      id
      name
      description
      type
      site
      time
      avatar
      location {
        address
        latitude
        longitude
      }
      posts {
        id
        title
        media
      }
      author {
        id
        name
        pfp
      }
      followersCount
    }
  }
`;

export default function EventPage() {
  const params = useLocalSearchParams();
  const idParam = params.id as string | undefined;
  const router = useRouter();

  const hotspotId = idParam ? parseInt(idParam, 10) : NaN;

  const { data, loading, error } = useQuery<any>(HOTSPOT_QUERY, {
    variables: { hotspotId: isNaN(hotspotId) ? 0 : hotspotId },
    skip: !idParam,
    fetchPolicy: "network-only",
  });

  if (!idParam) {
    return (
      <View style={tw`flex-1 items-center justify-center bg-black`}> 
        <Text style={tw`text-white`}>No event id provided.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={tw`flex-1 items-center justify-center bg-black`}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={tw`flex-1 items-center justify-center bg-black`}>
        <Text style={tw`text-red-400`}>Failed to load event.</Text>
        <TouchableOpacity onPress={() => router.back()} style={tw`mt-4 px-4 py-2 bg-white rounded-xl`}>
          <Text style={tw`text-black`}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const hotspot = data?.hotspot ?? null;

  if (!hotspot) {
    return (
      <View style={tw`flex-1 items-center justify-center bg-black`}>
        <Text style={tw`text-white`}>Event not found.</Text>
        <TouchableOpacity onPress={() => router.back()} style={tw`mt-4 px-4 py-2 bg-white rounded-xl`}>
          <Text style={tw`text-black`}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Determine if this hotspot should be treated as an event
  const isEvent = Boolean(hotspot.time || hotspot.type === "event" || hotspot.type === "Event");

  return (
    <View style={tw`flex-1 bg-black p-4`}> 
      {!isEvent ? (
        <View style={tw`flex-1 items-center justify-center`}> 
          <Text style={tw`text-white text-lg mb-2`}>Not an event</Text>
          <Text style={tw`text-gray-400 text-center mb-4`}>This hotspot isn't marked as an event. Showing basic details instead.</Text>
          <Text style={tw`text-white text-xl mb-2`}>{hotspot.name}</Text>
          <Text style={tw`text-gray-300 mb-2`}>{hotspot.description}</Text>
          <TouchableOpacity onPress={() => router.back()} style={tw`mt-4 px-4 py-2 bg-white rounded-xl`}>
            <Text style={tw`text-black`}>Go back</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={tw`flex-1`}> 
          <View style={tw`flex-row items-center mb-4`}> 
            {hotspot.avatar ? (
              <Image source={{ uri: hotspot.avatar }} style={tw`w-14 h-14 rounded-full mr-3`} />
            ) : (
              <View style={tw`w-14 h-14 rounded-full bg-gray-800 mr-3 items-center justify-center`}>
                <Text style={tw`text-white`}>{hotspot.name?.charAt(0)}</Text>
              </View>
            )}
            <View style={tw`flex-1`}> 
              <Text style={tw`text-white text-xl`}>{hotspot.name}</Text>
              {hotspot.author && (
                <Text style={tw`text-gray-400 text-sm`}>Event by {hotspot.author.name}</Text>
              )}
            </View>
          </View>

          {hotspot.time && (
            <View style={tw`mb-3`}> 
              <Text style={tw`text-gray-400 text-xs`}>Time</Text>
              <Text style={tw`text-white`}>{new Date(hotspot.time).toLocaleString()}</Text>
            </View>
          )}

          {hotspot.site && (
            <TouchableOpacity onPress={() => {
              let url = String(hotspot.site || "").trim();
              if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
              try { (async () => await (await import('react-native').then(m=>m.Linking)).openURL(url))(); } catch {}
            }} style={tw`mb-3`}> 
              <Text style={tw`text-white underline`}>{hotspot.site}</Text>
            </TouchableOpacity>
          )}

          {hotspot.location?.latitude && hotspot.location?.longitude ? (
            <View style={tw`mb-3 h-48 overflow-hidden rounded-md`}> 
              <MapView
                initialRegion={{
                  latitude: hotspot.location.latitude,
                  longitude: hotspot.location.longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
                style={{ flex: 1 }}
                scrollEnabled={false}
                zoomEnabled={false}
              >
                <Marker coordinate={{ latitude: hotspot.location.latitude, longitude: hotspot.location.longitude }} title={hotspot.name} />
              </MapView>
            </View>
          ) : hotspot.location?.address ? (
            <Text style={tw`text-gray-400 mb-3`}>{hotspot.location.address}</Text>
          ) : null}

          {hotspot.description && (
            <Text style={tw`text-gray-200 mb-3`}>{hotspot.description}</Text>
          )}

          {hotspot.posts && hotspot.posts.length > 0 && (
            <View style={tw`mt-3`}> 
              <Text style={tw`text-white mb-2`}>Recent posts</Text>
              {hotspot.posts.map((p: any) => (
                <View key={p.id} style={tw`mb-2 border border-[#222] rounded-xl p-3`}> 
                  <Text style={tw`text-white`}>{p.title}</Text>
                </View>
              ))}
            </View>
          )}

        </View>
      )}
    </View>
  );
}
