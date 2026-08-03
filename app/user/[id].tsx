import tw from '@/lib/tw';
import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import { Link, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';

const USER_QUERY = gql`
  query user($userId: Int!) {
    user(userId: $userId) {
      id
      name
      email
      pfp
      bio
      visits
      ratings
      followersCount
      followingCount
      isFollowingUser
      location {
        latitude
        longitude
        address
      }
    }
  }
`;

const ME_QUERY = gql`
  query Me {
    me {
      id
    }
  }
`;

const FOLLOW_USER = gql`
  mutation FollowUser($userId: Int!) {
    followUser(userId: $userId) {
      id
      isFollowingUser
      followersCount
    }
  }
`;

const UNFOLLOW_USER = gql`
  mutation UnfollowUser($userId: Int!) {
    unfollowUser(userId: $userId) {
      id
      isFollowingUser
      followersCount
    }
  }
`;

interface User {
  id: string;
  name: string;
  email: string;
  pfp?: string;
  bio?: string;
  visits: number;
  ratings: number;
  followersCount: number;
  followingCount: number;
  isFollowingUser: boolean;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
}

interface UserData {
  user: User;
}

export default function UserPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, error, refetch } = useQuery<UserData>(USER_QUERY, {
    variables: { userId: id ? parseInt(id, 10) : 0 },
    skip: !id,
  });

  const { data: meData } = useQuery<{ me: { id: string } }>(ME_QUERY);
  const [followUser, { loading: followLoading }] = useMutation(FOLLOW_USER);
  const [unfollowUser, { loading: unfollowLoading }] = useMutation(UNFOLLOW_USER);

  const isOwnProfile = meData?.me?.id === id;

  const handleFollowToggle = async () => {
    if (!id) return;
    
    try {
      if (user.isFollowingUser) {
        await unfollowUser({
          variables: { userId: parseInt(id, 10) },
        });
      } else {
        await followUser({
          variables: { userId: parseInt(id, 10) },
        });
      }
      await refetch();
    } catch (error) {
      console.error('Follow/unfollow error:', error);
    }
  };

  if (loading) {
    return (
      <View style={tw`flex-1 bg-black items-center justify-center`}>
        <ActivityIndicator color="#fff" />
        <Text style={tw`text-white mt-2`}>Loading user...</Text>
      </View>
    );
  }

  if (error || !data?.user) {
    return (
      <View style={tw`flex-1 bg-black items-center justify-center px-4`}>
        <Text style={tw`text-red-500 text-center mb-2`}>Error loading user</Text>
        <Text style={tw`text-gray-400 text-xs text-center`}>
          {error?.message || 'User not found'}
        </Text>
        <Link href="/(tabs)/explore" asChild>
          <TouchableOpacity style={tw`mt-4 bg-blue-600 rounded px-4 py-2`}>
            <Text style={tw`text-white`}>Go Back</Text>
          </TouchableOpacity>
        </Link>
      </View>
    );
  }

  const user = data.user;

  return (
    <ScrollView style={tw`flex-1 bg-black`}>
      <View style={tw`p-4`}>
        {/* Header with back button */}
        <Link href="/(tabs)/explore" asChild>
          <TouchableOpacity style={tw`mb-4`}>
            <Text style={tw`text-blue-500`}>← Back</Text>
          </TouchableOpacity>
        </Link>

        {/* Profile Picture and Name */}
        <View style={tw`items-center mb-6`}>
          {user.pfp ? (
            <Image source={{ uri: user.pfp }} style={tw`w-24 h-24 rounded-full mb-3`} />
          ) : (
            <View style={tw`w-24 h-24 rounded-full mb-3 bg-gray-700 items-center justify-center`}>
              <Text style={tw`text-white text-3xl`}>{user.name[0]?.toUpperCase()}</Text>
            </View>
          )}
          <Text style={tw`text-white text-2xl font-bold`}>{user.name}</Text>
          {user.bio && (
            <Text style={tw`text-gray-400 text-center mt-2 px-4`}>{user.bio}</Text>
          )}
        </View>

        {/* Stats */}
        <View style={tw`flex-row justify-around mb-6 bg-gray-900 rounded-lg p-4`}>
          <View style={tw`items-center`}>
            <Text style={tw`text-white text-xl font-bold`}>{user.followersCount}</Text>
            <Text style={tw`text-gray-400 text-xs`}>Followers</Text>
          </View>
          <View style={tw`items-center`}>
            <Text style={tw`text-white text-xl font-bold`}>{user.followingCount}</Text>
            <Text style={tw`text-gray-400 text-xs`}>Following</Text>
          </View>
          <View style={tw`items-center`}>
            <Text style={tw`text-white text-xl font-bold`}>{user.visits}</Text>
            <Text style={tw`text-gray-400 text-xs`}>Visits</Text>
          </View>
          <View style={tw`items-center`}>
            <Text style={tw`text-white text-xl font-bold`}>{user.ratings}</Text>
            <Text style={tw`text-gray-400 text-xs`}>Ratings</Text>
          </View>
        </View>

        {/* Follow or Edit Button */}
        {isOwnProfile ? (
          <TouchableOpacity
            style={tw`bg-gray-700 rounded-lg py-3 mb-4`}
          >
            <Text style={tw`text-white text-center font-bold`}>
              Edit Profile
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleFollowToggle}
            disabled={followLoading || unfollowLoading}
            style={tw`${user.isFollowingUser ? 'bg-gray-700' : 'bg-blue-600'} rounded-lg py-3 mb-4 ${
              (followLoading || unfollowLoading) ? 'opacity-50' : ''
            }`}
          >
            {followLoading || unfollowLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={tw`text-white text-center font-bold`}>
                {user.isFollowingUser ? 'Following' : 'Follow'}
              </Text>
            )}
          </TouchableOpacity>
        )}

        {/* Location */}
        {user.location?.address && (
          <View style={tw`bg-gray-900 rounded-lg p-4 mb-4`}>
            <Text style={tw`text-gray-400 text-xs mb-1`}>Location</Text>
            <Text style={tw`text-white`}>{user.location.address}</Text>
          </View>
        )}

        {/* Email */}
        <View style={tw`bg-gray-900 rounded-lg p-4`}>
          <Text style={tw`text-gray-400 text-xs mb-1`}>Email</Text>
          <Text style={tw`text-white`}>{user.email}</Text>
        </View>
      </View>
    </ScrollView>
  );
}
