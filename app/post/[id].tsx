import tw from '@/lib/tw';
import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { Link, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';

const POST_QUERY = gql`
  query Post($id: Int!) {
    Post(id: $id) {
      id
      caption
      media
      likes
      comments
      createdAt
      author {
        id
        name
        pfp
      }
      hotspot {
        id
        name
        location {
          address
        }
      }
    }
  }
`;

interface Post {
  id: string;
  caption?: string;
  media?: string;
  likes: number;
  comments: number;
  createdAt: string;
  author: {
    id: string;
    name: string;
    pfp?: string;
  };
  hotspot?: {
    id: string;
    name: string;
    location: {
      address?: string;
    };
  };
}

interface PostData {
  Post: Post;
}

export default function PostPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, error } = useQuery<PostData>(POST_QUERY, {
    variables: { id: parseInt(id || '0', 10) },
    skip: !id,
  });

  if (loading) {
    return (
      <View style={tw`flex-1 bg-black items-center justify-center`}>
        <ActivityIndicator color="#fff" />
        <Text style={tw`text-white mt-2`}>Loading post...</Text>
      </View>
    );
  }

  if (error || !data?.Post) {
    return (
      <View style={tw`flex-1 bg-black items-center justify-center px-4`}>
        <Text style={tw`text-red-500 text-center mb-2`}>Error loading post</Text>
        <Text style={tw`text-gray-400 text-xs text-center`}>
          {error?.message || 'Post not found'}
        </Text>
        <Link href="/(tabs)/explore" asChild>
          <TouchableOpacity style={tw`mt-4 bg-blue-600 rounded px-4 py-2`}>
            <Text style={tw`text-white`}>Go Back</Text>
          </TouchableOpacity>
        </Link>
      </View>
    );
  }

  const post = data.Post;

  return (
    <ScrollView style={tw`flex-1 bg-black`}>
      <View style={tw`p-4`}>
        {/* Header with back button */}
        <Link href="/(tabs)/explore" asChild>
          <TouchableOpacity style={tw`mb-4`}>
            <Text style={tw`text-blue-500`}>← Back</Text>
          </TouchableOpacity>
        </Link>

        {/* Author Info */}
        <Link
          href={{ pathname: '/user/[id]', params: { id: post.author.id } }}
          asChild
        >
          <TouchableOpacity style={tw`flex-row items-center mb-4`}>
            {post.author.pfp ? (
              <Image source={{ uri: post.author.pfp }} style={tw`w-12 h-12 rounded-full mr-3`} />
            ) : (
              <View style={tw`w-12 h-12 rounded-full mr-3 bg-gray-700 items-center justify-center`}>
                <Text style={tw`text-white text-lg`}>{post.author.name[0]?.toUpperCase()}</Text>
              </View>
            )}
            <View>
              <Text style={tw`text-white font-bold`}>{post.author.name}</Text>
              <Text style={tw`text-gray-400 text-xs`}>
                {new Date(post.createdAt).toLocaleDateString()}
              </Text>
            </View>
          </TouchableOpacity>
        </Link>

        {/* Post Media */}
        {post.media && (
          <Image 
            source={{ uri: post.media }} 
            style={tw`w-full h-96 rounded-lg mb-4`}
            resizeMode="cover"
          />
        )}

        {/* Stats */}
        <View style={tw`flex-row gap-4 mb-4`}>
          <View style={tw`flex-row items-center`}>
            <Text style={tw`text-white text-lg mr-1`}>❤️</Text>
            <Text style={tw`text-white`}>{post.likes}</Text>
          </View>
          <View style={tw`flex-row items-center`}>
            <Text style={tw`text-white text-lg mr-1`}>💬</Text>
            <Text style={tw`text-white`}>{post.comments}</Text>
          </View>
        </View>

        {/* Caption */}
        {post.caption && (
          <View style={tw`mb-4`}>
            <Text style={tw`text-white`}>
              <Text style={tw`font-bold`}>{post.author.name}</Text> {post.caption}
            </Text>
          </View>
        )}

        {/* Hotspot Info */}
        {post.hotspot && (
          <Link
            href={{ pathname: '/hotspot/[id]', params: { id: post.hotspot.id } }}
            asChild
          >
            <TouchableOpacity style={tw`bg-gray-900 rounded-lg p-4 mb-4`}>
              <Text style={tw`text-gray-400 text-xs mb-1`}>📍 Location</Text>
              <Text style={tw`text-white font-bold`}>{post.hotspot.name}</Text>
              {post.hotspot.location.address && (
                <Text style={tw`text-gray-400 text-xs mt-1`}>{post.hotspot.location.address}</Text>
              )}
            </TouchableOpacity>
          </Link>
        )}

        {/* Action Buttons */}
        <View style={tw`flex-row gap-2`}>
          <TouchableOpacity
            style={tw`flex-1 bg-red-600 rounded-lg py-3`}
          >
            <Text style={tw`text-white text-center font-bold`}>❤️ Like</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={tw`flex-1 bg-blue-600 rounded-lg py-3`}
          >
            <Text style={tw`text-white text-center font-bold`}>💬 Comment</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}
