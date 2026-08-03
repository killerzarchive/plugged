import { ALL_HOTSPOTS, SEARCH_QUERY } from '@/app/apollo/queries/general';
import { IconSymbol } from '@/components/ui/icon-symbol';
import tw from '@/lib/tw';
import { useLazyQuery, useQuery } from '@apollo/client/react';
import * as ExpoLocation from 'expo-location';
import { Link } from 'expo-router';
import React from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MapView, { Callout, Marker } from 'react-native-maps';

interface Hotspot {
  id: string;
  name: string;
  avatar?: string;
  description?: string;
  type?: string;
  location: {
    id: string;
    latitude: number;
    longitude: number;
    address?: string;
  };
  ratings: number;
  visits: number;
}

interface AllHotspotsData {
  allHotspots: Hotspot[];
}

interface GeocodedHotspot extends Hotspot {
  coordinates?: { latitude: number; longitude: number };
}

interface User {
  id: string;
  name: string;
  pfp?: string;
  bio?: string;
  followersCount: number;
  isFollowingUser: boolean;
}

interface SearchUsersData {
  searchUsers: User[];
}

export default function ExploreScreen() {
  const { data, loading, error } = useQuery<AllHotspotsData>(ALL_HOTSPOTS);
  const [searchUsers, { data: usersData, loading: usersLoading }] = useLazyQuery<SearchUsersData>(SEARCH_QUERY);
  const [geocodedHotspots, setGeocodedHotspots] = React.useState<GeocodedHotspot[]>([]);
  const [geocoding, setGeocoding] = React.useState(false);
  const [searchLocation, setSearchLocation] = React.useState('');
  const [searchName, setSearchName] = React.useState('');
  const [searchUserQuery, setSearchUserQuery] = React.useState('');
  const [mapRegion, setMapRegion] = React.useState<any>(null);
  const [searchingLocation, setSearchingLocation] = React.useState(false);
  const [showUserResults, setShowUserResults] = React.useState(false);

  React.useEffect(() => {
    if (!data?.allHotspots) return;
    const geocodeAll = async () => {
      setGeocoding(true);
      const results: GeocodedHotspot[] = [];
      for (const hotspot of data.allHotspots) {
        if (hotspot.location.latitude && hotspot.location.longitude) {
          results.push({
            ...hotspot,
            coordinates: {
              latitude: hotspot.location.latitude,
              longitude: hotspot.location.longitude,
            },
          });
        } else if (hotspot.location.address) {
          try {
            const geocoded = await ExpoLocation.geocodeAsync(hotspot.location.address);
            if (geocoded.length > 0) {
              results.push({
                ...hotspot,
                coordinates: {
                  latitude: geocoded[0].latitude,
                  longitude: geocoded[0].longitude,
                },
              });
            } else {
              results.push(hotspot);
            }
          } catch (e) {
            console.warn(`Failed to geocode address for ${hotspot.name}:`, e);
            results.push(hotspot);
          }
        } else {
          results.push(hotspot);
        }
      }
      setGeocodedHotspots(results);
      setGeocoding(false);
    };
    geocodeAll();
  }, [data]);

  // Search location geocoding
  const handleLocationSearch = async () => {
    if (!searchLocation) return;
    setSearchingLocation(true);
    try {
      const geocoded = await ExpoLocation.geocodeAsync(searchLocation);
      if (geocoded.length > 0) {
        setMapRegion({
          latitude: geocoded[0].latitude,
          longitude: geocoded[0].longitude,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        });
      }
    } catch (e) {
      console.warn('Failed to geocode searched location:', e);
    }
    setSearchingLocation(false);
  };

  // Search users function
  const handleUserSearch = async () => {
    if (!searchUserQuery.trim()) {
      setShowUserResults(false);
      return;
    }
    
    try {
      await searchUsers({
        variables: {
          searchString: searchUserQuery,
          skip: 0,
          take: 20,
        },
      });
      setShowUserResults(true);
    } catch (e) {
      console.warn('Failed to search users:', e);
    }
  };

  if (loading || geocoding) {
    return (
      <View style={tw`flex-1 bg-black items-center justify-center`}>
        <ActivityIndicator color="#fff" />
        <Text style={tw`text-white mt-2`}>{loading ? 'Loading hotspots...' : 'Geocoding addresses...'}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={tw`flex-1 bg-black items-center justify-center px-4`}>
        <Text style={tw`text-red-500 text-center mb-2`}>Error loading hotspots</Text>
        <Text style={tw`text-gray-400 text-xs text-center`}>{error.message}</Text>
      </View>
    );
  }

  // Filter hotspots by name and proximity
  let mappableHotspots = geocodedHotspots.filter((h) => h.coordinates);
  if (searchName) {
    mappableHotspots = mappableHotspots.filter((h) =>
      h.name.toLowerCase().includes(searchName.toLowerCase())
    );
  }
  if (mapRegion) {
    // Filter by proximity (within ~10km)
    mappableHotspots = mappableHotspots.filter((h) => {
      if (!h.coordinates) return false;
      const dx = h.coordinates.latitude - mapRegion.latitude;
      const dy = h.coordinates.longitude - mapRegion.longitude;
      // Rough distance calculation
      return Math.sqrt(dx * dx + dy * dy) < 0.1;
    });
  }

  // Compute initial region from search or first mappable hotspot or default
  const allMappableHotspots = geocodedHotspots.filter((h) => h.coordinates);
  const initialRegion =
    mapRegion ||
    (allMappableHotspots.length > 0
      ? {
          latitude: allMappableHotspots[0].coordinates!.latitude,
          longitude: allMappableHotspots[0].coordinates!.longitude,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        }
      : {
          latitude: 37.78825,
          longitude: -122.4324,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        });

  return (
    <View style={tw`flex-1`}>
      {/* Search Bar */}
      <View style={tw`px-4 pt-10 pb-2 bg-black z-10`}>
        <TextInput
          style={tw`bg-gray-800 text-white rounded px-3 py-2 mb-2`}
          placeholder="Search location (city, address)"
          placeholderTextColor="#aaa"
          value={searchLocation}
          onChangeText={setSearchLocation}
          onSubmitEditing={handleLocationSearch}
          returnKeyType="search"
        />
        <TouchableOpacity
          style={tw`bg-blue-600 rounded px-3 py-2 mb-2 items-center`}
          onPress={handleLocationSearch}
          disabled={searchingLocation}
        >
          <Text style={tw`text-white`}>{searchingLocation ? 'Searching...' : 'Go to Location'}</Text>
        </TouchableOpacity>
    
   
       
        {showUserResults && (
          <TouchableOpacity
            style={tw`bg-gray-700 rounded px-3 py-2 mb-2 items-center`}
            onPress={() => setShowUserResults(false)}
          >
            <Text style={tw`text-white`}>Show Map</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {showUserResults ? (
        <View style={tw`flex-1 bg-black`}>
          {usersLoading ? (
            <View style={tw`flex-1 items-center justify-center`}>
              <ActivityIndicator color="#fff" />
            </View>
          ) : usersData?.searchUsers && usersData.searchUsers.length > 0 ? (
            <FlatList
              data={usersData.searchUsers}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Link
                  href={{ pathname: '/user/[id]', params: { id: item.id } }}
                  asChild
                >
                  <TouchableOpacity
                    style={tw`flex-row items-center p-4 border-b border-gray-800`}
                  >
                    {item.pfp ? (
                      <Image source={{ uri: item.pfp }} style={tw`w-12 h-12 rounded-full mr-3`} />
                    ) : (
                      <View style={tw`w-12 h-12 rounded-full mr-3 bg-gray-700 items-center justify-center`}>
                        <Text style={tw`text-white text-lg`}>{item.name[0]?.toUpperCase()}</Text>
                      </View>
                    )}
                    <View style={tw`flex-1`}>
                      <Text style={tw`text-white font-bold`}>{item.name}</Text>
                      {item.bio && <Text style={tw`text-gray-400 text-xs`}>{item.bio}</Text>}
                      <Text style={tw`text-gray-500 text-xs mt-1`}>
                        {item.followersCount} followers
                      </Text>
                    </View>
                  </TouchableOpacity>
                </Link>
              )}
            />
          ) : (
            <View style={tw`flex-1 items-center justify-center px-4`}>
              <Text style={tw`text-white text-lg mb-2`}>No users found</Text>
              <Text style={tw`text-gray-400 text-center`}>
                Try a different search term
              </Text>
            </View>
          )}
        </View>
      ) : (
        <>
          <MapView
            style={tw`flex-1`}
            initialRegion={initialRegion}
            region={mapRegion || undefined}
          >
            {mappableHotspots.map((hotspot) => (
              <Marker
                key={hotspot.id}
                coordinate={{
                  latitude: hotspot.coordinates!.latitude,
                  longitude: hotspot.coordinates!.longitude,
                }}
                title={hotspot.name}
                description={hotspot.location.address || 'No address available'}
              >
                <Callout>
                  <View style={tw`p-2`}>
                    <Text style={tw`font-bold`}>{hotspot.name}</Text>
                    {hotspot.description && (
                      <Text style={tw`text-xs text-gray-600`}>{hotspot.description}</Text>
                    )}
                    <Text style={tw`text-xs text-gray-500 mt-1`}>
                      {hotspot.location.address || 'No address'}
                    </Text>
                    <Text style={tw`text-xs text-gray-400 mt-1`}>
                      Visits: {hotspot.visits} • Ratings: {hotspot.ratings}
                    </Text>
                  </View>
                </Callout>
              </Marker>
            ))}
          </MapView>
          {mappableHotspots.length === 0 && (
            <View style={tw`absolute bottom-20 left-0 right-0 items-center px-4`}>
              <View style={tw`bg-gray-800 rounded-lg p-4`}>
                <Text style={tw`text-white text-center mb-1`}>No hotspots in this area</Text>
                <Text style={tw`text-gray-400 text-xs text-center`}>
                  Try searching another location or clear filters
                </Text>
              </View>
            </View>
          )}
          {mappableHotspots.length > 0 && (
            <View style={tw`absolute bottom-0 left-0 right-0 bg-black bg-opacity-90 p-2 rounded-t-3xl h-72`}>
              <Text style={tw`text-white text-xs mb-2 px-2`}>Tap a hotspot to view details:</Text>
              <FlatList
                horizontal
                data={mappableHotspots}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <Link
                    href={{ pathname: '/hotspot/[id]', params: { id: item.id } }}
                    asChild
                  >
                    <TouchableOpacity style={tw`bg-gray-800 rounded-lg p-3 mr-2 w-48`}>
                      <Text style={tw`text-white font-bold text-sm`} numberOfLines={1}>{item.name}</Text>
                      <Text style={tw`text-gray-400 text-xs mt-1`} numberOfLines={2}>
                        {item.location.address || 'No address'}
                      </Text>
                      <Text style={tw`text-blue-500 text-xs mt-1`}>View →</Text>
                    </TouchableOpacity>
                  </Link>
                )}
              />
            </View>
          )}
        </>
      )}
    </View>
  );
}

ExploreScreen.options = {
  title: 'Explore',
  tabBarIcon: ({ color }: { color: string }) => <IconSymbol size={28} name="chevron.left.forwardslash.chevron.right" color={color} />,
};

const styles = StyleSheet.create({
  headerImage: {
    color: '#808080',
    bottom: -90,
    left: -35,
    position: 'absolute',
  },
  titleContainer: {
    flexDirection: 'row',
    gap: 8,
  },
});
