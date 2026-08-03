import tw from '@/lib/tw';
import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import { Link, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Image, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { CREATE_REVIEW } from '../apollo/mutations/app';

const HOTSPOT_QUERY = gql`
  query hotspot($hotspotId: Int!) {
    hotspot(hotspotId: $hotspotId) {
      id
      name
      avatar
      description
      type
      location {
        id
        latitude
        longitude
        address
      }
      ratings
      visits
      followersCount
      isFollowingHotspot
    }
  }
`;

const FOLLOW_HOTSPOT = gql`
  mutation FollowHotspot($hotspotId: Int!) {
    followHotspot(hotspotId: $hotspotId) {
      id
      followersCount
      isFollowingHotspot
    }
  }
`;

const UNFOLLOW_HOTSPOT = gql`
  mutation UnfollowHotspot($hotspotId: Int!) {
    unfollowHotspot(hotspotId: $hotspotId) {
      id
      followersCount
      isFollowingHotspot
    }
  }
`;

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
  followersCount?: number;
  isFollowingHotspot?: boolean;
}

interface HotspotData {
  hotspot: Hotspot;
}

export default function HotspotPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  
  const { data, loading, error, refetch } = useQuery<HotspotData>(HOTSPOT_QUERY, {
    variables: { hotspotId: id ? parseInt(id, 10) : 0 },
    skip: !id,
  });

  const [followHotspot, { loading: followLoading }] = useMutation(FOLLOW_HOTSPOT);
  const [unfollowHotspot, { loading: unfollowLoading }] = useMutation(UNFOLLOW_HOTSPOT);
  const [createReview, { loading: reviewLoading }] = useMutation(CREATE_REVIEW);

  if (loading) {
    return (
      <View style={tw`flex-1 bg-black items-center justify-center`}>
        <ActivityIndicator color="#fff" />
        <Text style={tw`text-white mt-2`}>Loading hotspot...</Text>
      </View>
    );
  }

  if (error || !data?.hotspot) {
    return (
      <View style={tw`flex-1 bg-black items-center justify-center px-4`}>
        <Text style={tw`text-red-500 text-center mb-2`}>Error loading hotspot</Text>
        <Text style={tw`text-gray-400 text-xs text-center`}>
          {error?.message || 'Hotspot not found'}
        </Text>
        <Link href="/(tabs)/explore" asChild>
          <TouchableOpacity style={tw`mt-4 bg-blue-600 rounded px-4 py-2`}>
            <Text style={tw`text-white`}>Go Back</Text>
          </TouchableOpacity>
        </Link>
      </View>
    );
  }

  const hotspot = data.hotspot;
  const hasCoordinates = hotspot.location.latitude && hotspot.location.longitude;

  const handleFollowToggle = async () => {
    if (!id) return;
    try {
      if (hotspot.isFollowingHotspot) {
        await unfollowHotspot({ variables: { hotspotId: parseInt(id, 10) } });
      } else {
        await followHotspot({ variables: { hotspotId: parseInt(id, 10) } });
      }
      // Re-run the hotspot query to get the latest state
      // Apollo will refetch because this component depends on the query
      // Note: using network-only could be added if needed
    } catch (e) {
      console.warn('Failed to toggle follow on hotspot', e);
    }
  };

  const handleSubmitReview = async () => {
    if (!id || !comment.trim()) return;
    
    try {
      await createReview({
        variables: {
          hotspotId: parseInt(id, 10),
          rating: rating,
          comment: comment.trim(),
        },
      });
      
      // Reset form and close
      setComment('');
      setRating(5);
      setShowReviewForm(false);
      
      // Refetch hotspot data to update ratings
      await refetch();
      
      alert('Review submitted successfully!');
    } catch (e: any) {
      console.warn('Failed to submit review', e);
      alert('Failed to submit review: ' + (e?.message || 'Unknown error'));
    }
  };

  return (
    <ScrollView style={tw`flex-1 bg-black`}>
      <View style={tw`p-4`}>
        {/* Header with back button */}
        <Link href="/(tabs)/explore" asChild>
          <TouchableOpacity style={tw`mb-4`}>
            <Text style={tw`text-blue-500`}>← Back</Text>
          </TouchableOpacity>
        </Link>

        {/* Hotspot Image */}
        {hotspot.avatar ? (
          <Image 
            source={{ uri: hotspot.avatar }} 
            style={tw`w-full h-64 rounded-lg mb-4`}
            resizeMode="cover"
          />
        ) : (
          <View style={tw`w-full h-64 rounded-lg mb-4 bg-gray-800 items-center justify-center`}>
            <Text style={tw`text-gray-500 text-4xl`}>📍</Text>
          </View>
        )}

        {/* Name and Type */}
        <View style={tw`mb-4`}>
          <Text style={tw`text-white text-3xl font-bold mb-2`}>{hotspot.name}</Text>
          {hotspot.type && (
            <View style={tw`bg-blue-600 rounded-full px-3 py-1 self-start`}>
              <Text style={tw`text-white text-xs`}>{hotspot.type}</Text>
            </View>
          )}
        </View>

        {/* Follow Button */}
        <TouchableOpacity
          onPress={handleFollowToggle}
          disabled={followLoading || unfollowLoading}
          style={tw`${hotspot.isFollowingHotspot ? 'bg-gray-700' : 'bg-blue-600'} rounded-lg py-3 mb-4 ${
            (followLoading || unfollowLoading) ? 'opacity-50' : ''
          }`}
        >
          {followLoading || unfollowLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={tw`text-white text-center font-bold`}>
              {hotspot.isFollowingHotspot ? 'Following' : 'Follow'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Stats */}
        <View style={tw`flex-row justify-around mb-6 bg-gray-900 rounded-lg p-4`}>
          <View style={tw`items-center`}>
            <Text style={tw`text-white text-xl font-bold`}>{hotspot.visits}</Text>
            <Text style={tw`text-gray-400 text-xs`}>Visits</Text>
          </View>
          <View style={tw`items-center`}>
            <Text style={tw`text-white text-xl font-bold`}>{hotspot.ratings}</Text>
            <Text style={tw`text-gray-400 text-xs`}>Ratings</Text>
          </View>
          {typeof hotspot.followersCount === 'number' && (
            <View style={tw`items-center`}>
              <Text style={tw`text-white text-xl font-bold`}>{hotspot.followersCount}</Text>
              <Text style={tw`text-gray-400 text-xs`}>Followers</Text>
            </View>
          )}
        </View>

        {/* Description */}
        {hotspot.description && (
          <View style={tw`bg-gray-900 rounded-lg p-4 mb-4`}>
            <Text style={tw`text-gray-400 text-xs mb-2`}>Description</Text>
            <Text style={tw`text-white`}>{hotspot.description}</Text>
          </View>
        )}

        {/* Location */}
        {hotspot.location.address && (
          <View style={tw`bg-gray-900 rounded-lg p-4 mb-4`}>
            <Text style={tw`text-gray-400 text-xs mb-2`}>Location</Text>
            <Text style={tw`text-white`}>{hotspot.location.address}</Text>
          </View>
        )}

        {/* Map */}
        {hasCoordinates && (
          <View style={tw`mb-4`}>
            <Text style={tw`text-gray-400 text-xs mb-2`}>Map</Text>
            <View style={tw`h-64 rounded-lg overflow-hidden`}>
              <MapView
                style={tw`flex-1`}
                initialRegion={{
                  latitude: hotspot.location.latitude,
                  longitude: hotspot.location.longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
              >
                <Marker
                  coordinate={{
                    latitude: hotspot.location.latitude,
                    longitude: hotspot.location.longitude,
                  }}
                  title={hotspot.name}
                />
              </MapView>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={tw`flex-row gap-2 mb-4`}>
          <TouchableOpacity
            style={tw`flex-1 bg-blue-600 rounded-lg py-3`}
          >
            <Text style={tw`text-white text-center font-bold`}>Check In</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={tw`flex-1 bg-green-600 rounded-lg py-3`}
            onPress={() => setShowReviewForm(!showReviewForm)}
          >
            <Text style={tw`text-white text-center font-bold`}>
              {showReviewForm ? 'Cancel Review' : 'Write Review'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Review Form */}
        {showReviewForm && (
          <View style={tw`bg-gray-900 rounded-lg p-4 mb-4`}>
            <Text style={tw`text-white text-lg font-bold mb-3`}>Write a Review</Text>
            
            {/* Star Rating */}
            <View style={tw`mb-4`}>
              <Text style={tw`text-gray-400 text-sm mb-2`}>Rating</Text>
              <View style={tw`flex-row gap-2`}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => setRating(star)}
                    style={tw`w-10 h-10 items-center justify-center`}
                  >
                    <Text style={tw`text-3xl`}>
                      {star <= rating ? '⭐' : '☆'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Comment Input */}
            <View style={tw`mb-4`}>
              <Text style={tw`text-gray-400 text-sm mb-2`}>Comment</Text>
              <TextInput
                style={tw`bg-gray-800 text-white rounded-lg p-3 min-h-24`}
                placeholder="Share your experience..."
                placeholderTextColor="#666"
                multiline
                numberOfLines={4}
                value={comment}
                onChangeText={setComment}
                textAlignVertical="top"
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              onPress={handleSubmitReview}
              disabled={reviewLoading || !comment.trim()}
              style={tw`bg-blue-600 rounded-lg py-3 ${
                (reviewLoading || !comment.trim()) ? 'opacity-50' : ''
              }`}
            >
              {reviewLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={tw`text-white text-center font-bold`}>
                  Submit Review
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
