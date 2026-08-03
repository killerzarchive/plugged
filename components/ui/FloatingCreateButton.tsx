import { CREATE_POST } from '@/app/apollo/mutations/app';
import { ALL_HOTSPOTS } from '@/app/apollo/queries/general';
import tw from '@/lib/tw';
import { pickPostMedia, uploadPostMedia } from '@/lib/uploadPostMedia';
import { useMutation, useQuery } from '@apollo/client/react';
import { Megaphone, MapPin, Play, Plus, Star, X } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, Pressable, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface Props {}

interface HotspotItem { id: string; name: string }

export default function FloatingCreateButton({}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [postType, setPostType] = useState<'REVIEW' | 'PSA' | 'CHECK_IN' | null>(null);
  const [title, setTitle] = useState('');
  const [query, setQuery] = useState('');
  const [selectedHotspot, setSelectedHotspot] = useState<HotspotItem | null>(null);
  const [content, setContent] = useState('');
  const [mediaUris, setMediaUris] = useState<string[]>([]);

  const { data, loading: hotspotsLoading } = useQuery<{ allHotspots: HotspotItem[] }>(ALL_HOTSPOTS);
  const [createPost, { loading: creating }] = useMutation(CREATE_POST);

  const filteredHotspots = useMemo(() => {
    const list = data?.allHotspots ?? [];
    if (!query.trim()) return list.slice(0, 25);
    const q = query.toLowerCase();
    return list.filter(h => h.name.toLowerCase().includes(q)).slice(0, 50);
  }, [data, query]);

  const openComposer = (type: 'REVIEW' | 'PSA' | 'CHECK_IN') => {
    setPostType(type);
    setMenuOpen(false);
    setComposerOpen(true);
  };

  const resetComposer = () => {
    setPostType(null);
    setTitle('');
    setQuery('');
    setSelectedHotspot(null);
    setContent('');
    setMediaUris([]);
    setComposerOpen(false);
  };

  const handleSubmit = async () => {
    if (!postType || !selectedHotspot || !title.trim()) return;
    try {
      // Upload media first
      const uploaded: string[] = [];
      for (const uri of mediaUris) {
        const up = await uploadPostMedia(uri);
        uploaded.push(up.publicUrl);
      }
      // Backend expects media as a single String (error complained about array). Serialize appropriately.
      const mediaValue = uploaded.length === 0
        ? null
        : uploaded.length === 1
          ? uploaded[0]
          : JSON.stringify(uploaded); // fallback if multiple chosen

      const postInput: any = {
        title: title.trim(),
        type: postType,
      };
      if (mediaValue) postInput.media = mediaValue;
      if (content.trim()) postInput.content = content.trim();

      await createPost({
        variables: {
          hotspotId: parseInt(String(selectedHotspot.id), 10),
          data: postInput,
        },
      });
      resetComposer();
      alert('Post created');
    } catch (e: any) {
      alert(e?.message || 'Failed to create post');
    }
  };

  return (
    <>
      {/* Floating Button */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Create"
        onPress={() => setMenuOpen(true)}
        style={tw`border border-[#222] flex flex-row items-center py-1 px-3 rounded-full bg-black`}
      >
        <Text style={[tw`text-white mr-1 text-xs`, { fontFamily: "Roobert-SemiBold" }]}>Create</Text>
        <Ionicons name="add" size={12} color="#fff" />
      </Pressable>

      {/* Backdrop + Menu */}
      {menuOpen && (
        <View style={tw`absolute inset-0 justify-end bg-black/20`}>
          <Pressable style={tw`absolute inset-0`} onPress={() => setMenuOpen(false)} />
          <View style={tw`m-4 p-3 rounded-xl bg-gray-900`}>
            <Text style={tw`text-white text-base font-bold mb-2`}>Create</Text>
            <View style={tw`flex-row`}>
              <TouchableOpacity style={tw`flex-row items-center py-2.5 px-3 bg-gray-800 rounded-lg mr-2`} onPress={() => openComposer('REVIEW')}>
                <Ionicons name="star" size={20} color="#fff" />
                <Text style={tw`text-white ml-1.5 font-semibold`}>Review</Text>
              </TouchableOpacity>
              <TouchableOpacity style={tw`flex-row items-center py-2.5 px-3 bg-gray-800 rounded-lg mr-2`} onPress={() => openComposer('PSA')}>
                <Ionicons name="megaphone" size={20} color="#fff" />
                <Text style={tw`text-white ml-1.5 font-semibold`}>PSA</Text>
              </TouchableOpacity>
              <TouchableOpacity style={tw`flex-row items-center py-2.5 px-3 bg-gray-800 rounded-lg mr-2`} onPress={() => openComposer('CHECK_IN')}>
                <Ionicons name="location" size={20} color="#fff" />
                <Text style={tw`text-white ml-1.5 font-semibold`}>Check In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Composer Modal */}
      <Modal visible={composerOpen} transparent animationType="slide" onRequestClose={resetComposer}>
        <View style={tw`flex-1 bg-black/60 justify-end`}>
          <View style={tw`bg-[#0B0F17] p-4 rounded-t-2xl`}>
            <View style={tw`flex-row items-center justify-between mb-3`}>
              <Text style={tw`text-white text-lg font-bold`}>{postType ? postType.replace('_', ' ') : ''}</Text>
              <TouchableOpacity onPress={resetComposer}>
                <Ionicons name="close" size={22} color="#aaa" />
              </TouchableOpacity>
            </View>

            {/* Title */}
            <Text style={tw`text-gray-400 text-xs mb-1`}>Title</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="What's happening?"
              placeholderTextColor="#666"
              style={tw`bg-gray-800 text-white rounded px-3 py-2 mb-3`}
            />

            {/* Content */}
            <Text style={tw`text-gray-400 text-xs mb-1`}>Content</Text>
            <TextInput
              value={content}
              onChangeText={setContent}
              placeholder="Add more details..."
              placeholderTextColor="#666"
              style={tw`bg-gray-800 text-white rounded px-3 py-2 mb-3 min-h-20`}
              multiline
              textAlignVertical="top"
            />

            {/* Hotspot Search */}
            <Text style={tw`text-gray-400 text-xs mb-1`}>Hotspot</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search hotspots by name"
              placeholderTextColor="#666"
              style={tw`bg-gray-800 text-white rounded px-3 py-2 mb-2`}
            />
            {hotspotsLoading ? (
              <View style={tw`py-6 items-center`}>
                <ActivityIndicator color="#fff" />
              </View>
            ) : (
              <FlatList
                data={filteredHotspots}
                keyExtractor={(item) => String(item.id)}
                style={tw`max-h-48 mb-3`}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[tw`px-3 py-2`, selectedHotspot?.id === item.id ? tw`bg-gray-700 rounded` : null]}
                    onPress={() => setSelectedHotspot(item)}
                  >
                    <Text style={tw`text-white`}>{item.name}</Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={tw`text-gray-500 px-3 py-2`}>No hotspots</Text>}
              />
            )}

            {selectedHotspot && (
              <View style={tw`bg-gray-800 rounded px-3 py-2 mb-3`}>
                <Text style={tw`text-white`}>Selected: {selectedHotspot.name}</Text>
              </View>
            )}

            {/* Media Picker */}
            <View style={tw`mb-3`}>
              <View style={tw`flex-row items-center justify-between mb-2`}>
                <Text style={tw`text-gray-400 text-xs`}>Media</Text>
                <TouchableOpacity
                  onPress={async () => {
                    try {
                      const uri = await pickPostMedia();
                      if (uri) setMediaUris((u) => [...u, uri]);
                    } catch (e: any) {
                      alert(e?.message || 'Unable to pick media');
                    }
                  }}
                >
                  <Text style={tw`text-blue-500 font-semibold`}>Add media</Text>
                </TouchableOpacity>
              </View>
              {mediaUris.length > 0 && (
                <FlatList
                  data={mediaUris}
                  keyExtractor={(u, i) => u + i}
                  horizontal
                  renderItem={({ item, index }) => {
                    const ext = item.split('.').pop()?.toLowerCase() || '';
                    const isVideo = ['mp4','mov','m4v','webm','mkv','avi'].includes(ext);
                    return (
                      <View style={tw`mr-2`}>
                        {isVideo ? (
                          <View style={{ width: 72, height: 72, borderRadius: 8, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="play" size={28} color="#fff" />
                          </View>
                        ) : (
                          <Image source={{ uri: item }} style={{ width: 72, height: 72, borderRadius: 8 }} />
                        )}
                        <TouchableOpacity
                          onPress={() => setMediaUris((arr) => arr.filter((_, i) => i !== index))}
                          style={tw`absolute -top-2 -right-2 bg-black/60 rounded-full p-1`}
                        >
                          <Ionicons name="close" size={14} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    );
                  }}
                />
              )}
            </View>

            <TouchableOpacity
              disabled={!postType || !selectedHotspot || !title.trim() || creating}
              onPress={handleSubmit}
              style={[tw`rounded px-4 py-3`, (!postType || !selectedHotspot || !title.trim() || creating) ? tw`bg-blue-600/50` : tw`bg-blue-600`]}
            >
              {creating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={tw`text-white text-center font-bold`}>Post</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}
