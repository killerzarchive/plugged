import { CREATE_CHECKIN, CREATE_HOTSPOT, CREATE_POST } from "@/app/apollo/mutations/app";
import { ALL_HOTSPOTS, ME_QUERY } from "@/app/apollo/queries/general";
import DateTimeInput from "@/components/ui/DateTimeInput";
import { LabeledInput } from "@/components/ui/LabeledInput";
import TimeInput from "@/components/ui/TimeInput";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { CheckCircle, MapPin } from "lucide-react-native";
import tw from "@/lib/tw";
import { useColors } from "@/contexts/theme";
import { pickHotspotImage, uploadHotspotImage } from "@/lib/uploadHotspotImage";
import { pickPostMedia, uploadPostMedia } from "@/lib/uploadPostMedia";
import { useMutation, useQuery } from "@apollo/client/react";
import { Video } from 'expo-av';
import * as SecureStore from "expo-secure-store";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Image, Keyboard, KeyboardAvoidingView, Platform, ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity, TouchableWithoutFeedback, View
} from 'react-native';

const POST_TAGS = [
  "Packed", "Chill", "Lit", "Vibes", "Long Line",
  "Live Music", "DJ Set", "Dancing", "Good Drinks",
  "Dress Code", "Free Entry", "Rooftop", "Hidden Gem",
  "Must Try", "Overrated",
];

interface HotspotItem {
  id: string;
  name: string;
  avatar: string;
  type: string;
  description: string;
  location: {
    id: string;
    latitude: number;
    longitude: number;
    address: string;
  };
}

export default function CreateScreen() {
  const C = useColors();
  const [mode, setMode] = React.useState<"POST" | "CHECKIN" | "HOTSPOT">("POST");

  // Check-in state
  const [checkinQuery, setCheckinQuery] = React.useState("");
  const [selectedCheckinHotspot, setSelectedCheckinHotspot] = React.useState<HotspotItem | null>(null);
  const [createCheckin, { loading: creatingCheckin }] = useMutation(CREATE_CHECKIN, {
    refetchQueries: [{ query: ME_QUERY }],
  });

  // Post creation state
  const [postType, setPostType] = React.useState<
    "REVIEW" | "PSA" | "CHECK_IN" | null
  >(null);
  const [postTitle, setPostTitle] = React.useState("");
  const [postContent, setPostContent] = React.useState("");
  const [postTags, setPostTags] = React.useState<string[]>([]);
  const [hotspotQuery, setHotspotQuery] = React.useState("");
  const [selectedHotspot, setSelectedHotspot] =
    React.useState<HotspotItem | null>(null);
  const [mediaItems, setMediaItems] = React.useState<{ uri: string; type: string; uploading?: boolean }[]>([]);

  const togglePostTag = React.useCallback((tag: string) => {
    setPostTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }, []);

  const { data: hotspotData, loading: hotspotsLoading } = useQuery<{
    allHotspots: HotspotItem[];
  }>(ALL_HOTSPOTS);
  const { data: meData } = useQuery(ME_QUERY);

  const filteredHotspots = React.useMemo(() => {
    const list = hotspotData?.allHotspots ?? [];
    const followedIds = new Set<number>(((meData as any)?.me?.followingHotspots ?? []).map((h: any) => Number(h.id)));
    // If no query, prefer showing only hotspots the user follows. If user follows none, fall back to first 25.
    if (!hotspotQuery.trim()) {
      const followed = list.filter((h) => followedIds.has(Number(h.id)));
      return followed.length > 0 ? followed : list.slice(0, 30);
    }
    const q = hotspotQuery.toLowerCase();
    return list.filter((h) => h.name.toLowerCase().includes(q)).slice(0, 50);
  }, [hotspotData, hotspotQuery, meData]);

  React.useEffect(() => {
    if (!selectedHotspot && filteredHotspots.length === 1) {
      setSelectedHotspot(filteredHotspots[0]);
    }
  }, [filteredHotspots, selectedHotspot]);

  const [createPost, { loading: creatingPost }] = useMutation(CREATE_POST);

  // Hotspot creation state
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [type, setType] = React.useState("");
  const [site, setSite] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [number, setNumber] = React.useState("");
  const [isEvent, setIsEvent] = React.useState(false);
  const [isPopup, setIsPopup] = React.useState(false);
  const [time, setTime] = React.useState("");
  const [popupStart, setPopupStart] = React.useState("");
  const [popupEnd, setPopupEnd] = React.useState("");
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);
  const [pickingImage, setPickingImage] = React.useState(false);
  const [addressLine, setAddressLine] = React.useState("");
  const [city, setCity] = React.useState("");
  const [region, setRegion] = React.useState("");
  const [postalCode, setPostalCode] = React.useState("");
  const [country, setCountry] = React.useState("");
  const [latitude, setLatitude] = React.useState<string>("0");
  const [longitude, setLongitude] = React.useState<string>("0");
  const [createHotspot, { loading: creatingHotspot }] =
    useMutation(CREATE_HOTSPOT);

  const composedAddress = React.useMemo(
    () =>
      [addressLine, city, region, postalCode, country]
        .map((p) => p.trim())
        .filter(Boolean)
        .join(", "),
    [addressLine, city, region, postalCode, country]
  );

  const pickHotspotAvatar = React.useCallback(async () => {
    try {
      setPickingImage(true);
      const uri = await pickHotspotImage();
      if (!uri) return;
      const userId = (await SecureStore.getItemAsync("userId")) || "anonymous";
      const uploaded = await uploadHotspotImage(userId, uri);
      setImageUrl(uploaded.publicUrl);
    } catch (e) {
      console.warn("Image upload failed", e);
    } finally {
      setPickingImage(false);
    }
  }, []);

  const submitCheckin = React.useCallback(async () => {
    if (!selectedCheckinHotspot) return;
    try {
      await createCheckin({
        variables: { hotspotId: parseInt(String(selectedCheckinHotspot.id), 10) },
      });
      setSelectedCheckinHotspot(null);
      setCheckinQuery("");
      alert("Checked in! 📍");
    } catch (e: any) {
      alert(e?.message || "Failed to check in");
    }
  }, [selectedCheckinHotspot, createCheckin]);

  const resetPost = () => {
    setPostType(null);
    setPostTitle("");
    setPostContent("");
    setPostTags([]);
    setHotspotQuery("");
    setSelectedHotspot(null);
    setMediaItems([]);
  };

  const submitPost = React.useCallback(async () => {
    if (!postType || !selectedHotspot || !postTitle.trim()) return;
    try {
      const uploaded: string[] = [];
      for (const item of mediaItems) {
        if (/^https?:\/\//.test(item.uri)) {
          uploaded.push(item.uri);
        } else {
          const up = await uploadPostMedia(item.uri);
          uploaded.push(up.publicUrl);
        }
      }
      const mediaValue =
        uploaded.length === 0
          ? null
          : uploaded.length === 1
          ? uploaded[0]
          : JSON.stringify(uploaded);
      const input: any = { title: postTitle.trim(), type: postType };
      if (mediaValue) input.media = mediaValue;
      if (postContent.trim()) input.content = postContent.trim();
      if (postTags.length > 0) input.tags = postTags;
      await createPost({
        variables: {
          hotspotId: parseInt(String(selectedHotspot.id), 10),
          data: input,
        },
      });
      resetPost();
      alert("Post created");
    } catch (e: any) {
      alert(e?.message || "Failed to create post");
    }
  }, [
    postType,
    selectedHotspot,
    postTitle,
    postContent,
    postTags,
    mediaItems,
    createPost,
  ]);

  const detectMediaType = React.useCallback((uri: string) => {
    const ext = uri.split('.').pop()?.toLowerCase() || '';
    if (['mp4','mov','m4v','webm','mkv','avi'].includes(ext)) return 'video';
    if (['mp3','wav','m4a','aac','ogg'].includes(ext)) return 'audio';
    if (['jpg','jpeg','png','gif','webp','heic','heif'].includes(ext)) return 'image';
    return 'file';
  }, []);

  const submitHotspot = React.useCallback(async () => {
    if (!name.trim()) {
      alert("Name required");
      return;
    }
    if (!composedAddress.trim()) {
      alert("Address required");
      return;
    }
    // convert event time string (if provided) into ISO string accepted by GraphQL DateTime
    const parseEventTimeToISO = (input?: string) => {
      if (!input) return undefined;
      const v = input.trim();
      // Try formats: 1) YYYY-MM-DD hh:mm AM/PM  2) YYYY-MM-DD HH:mm  3) YYYY-MM-DD
      const m12 = v.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (m12) {
        const year = parseInt(m12[1].slice(0, 4), 10);
        const month = parseInt(m12[1].slice(5, 7), 10) - 1;
        const day = parseInt(m12[1].slice(8, 10), 10);
        let hour = parseInt(m12[2], 10);
        const minute = parseInt(m12[3], 10);
        const ampm = m12[4].toUpperCase();
        if (ampm === 'PM' && hour < 12) hour += 12;
        if (ampm === 'AM' && hour === 12) hour = 0;
        // create local Date object from components and then convert to ISO (includes timezone offset)
        const dt = new Date(year, month, day, hour, minute, 0);
        return dt.toISOString();
      }

      const m24 = v.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}):(\d{2})$/);
      if (m24) {
        const year = parseInt(m24[1].slice(0, 4), 10);
        const month = parseInt(m24[1].slice(5, 7), 10) - 1;
        const day = parseInt(m24[1].slice(8, 10), 10);
        const hour = parseInt(m24[2], 10);
        const minute = parseInt(m24[3], 10);
        const dt = new Date(year, month, day, hour, minute, 0);
        return dt.toISOString();
      }

      const mDateOnly = v.match(/^(\d{4}-\d{2}-\d{2})$/);
      if (mDateOnly) {
        // treat as midnight UTC for that date
        const year = parseInt(mDateOnly[1].slice(0, 4), 10);
        const month = parseInt(mDateOnly[1].slice(5, 7), 10) - 1;
        const day = parseInt(mDateOnly[1].slice(8, 10), 10);
        return new Date(year, month, day, 0, 0, 0).toISOString();
      }

      return undefined;
    };

    // Parse time-only format (HH:mm AM/PM) and combine with today's date
    const parseTimeOnlyToISO = (input?: string) => {
      if (!input) return undefined;
      const v = input.trim();
      // Match format like "02:30 PM" or "2:30 PM"
      const m12 = v.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (m12) {
        const now = new Date();
        let hour = parseInt(m12[1], 10);
        const minute = parseInt(m12[2], 10);
        const ampm = m12[3].toUpperCase();
        if (ampm === 'PM' && hour < 12) hour += 12;
        if (ampm === 'AM' && hour === 12) hour = 0;
        // Use today's date with the specified time
        const dt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0);
        return dt.toISOString();
      }
      return undefined;
    };

    const timeIso = isEvent ? parseEventTimeToISO(time) : undefined;

    if (isEvent && time && !timeIso) {
      alert('Invalid event time format. Use YYYY-MM-DD HH:mm or YYYY-MM-DD h:mm AM/PM.');
      return;
    }

    // Ensure isPopup and isEvent are mutually exclusive
    if (isPopup && isEvent) {
      alert("A hotspot cannot be both a popup and an event");
      return;
    }

    const popupStartIso = isPopup && popupStart ? parseTimeOnlyToISO(popupStart) : undefined;
    const popupEndIso = isPopup && popupEnd ? parseTimeOnlyToISO(popupEnd) : undefined;

    if (isPopup && popupStart && !popupStartIso) {
      alert('Invalid popup start time format. Use HH:mm AM/PM.');
      return;
    }
    if (isPopup && popupEnd && !popupEndIso) {
      alert('Invalid popup end time format. Use HH:mm AM/PM.');
      return;
    }

    const data: Record<string, any> = {
      name: name.trim(),
      description: description.trim() || undefined,
      type: type.trim() || undefined,
      site: site.trim() || undefined,
      email: email.trim() || undefined,
      number: number.trim() || undefined,
      isEvent,
      isPopup,
      // send ISO timestamp for GraphQL DateTime scalars when event time set
      time: timeIso,
      popupStart: popupStartIso,
      popupEnd: popupEndIso,
      location: {
        address: composedAddress,
        latitude: isNaN(parseFloat(latitude)) ? 0 : parseFloat(latitude),
        longitude: isNaN(parseFloat(longitude)) ? 0 : parseFloat(longitude),
      },
    };
    if (imageUrl) data.avatar = imageUrl;
    Object.keys(data).forEach((k) => data[k] === undefined && delete data[k]);
    try {
      await createHotspot({ variables: { data } });
      setName("");
      setDescription("");
      setType("");
      setSite("");
      setEmail("");
      setNumber("");
      setIsEvent(false);
      setTime("");
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
    isEvent,
    isPopup,
    time,
    popupStart,
    popupEnd,
    imageUrl,
    composedAddress,
    latitude,
    longitude,
    createHotspot,
  ]);

  return (
    <View style={[tw`flex-1`, { backgroundColor: C.bg }]}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0} style={{ flex: 1 }}>
      <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
        <ScrollView
          style={[tw`flex-1 pt-7`, { backgroundColor: C.bg }]}
          contentContainerStyle={[{ paddingTop: 6, paddingBottom: 160 }]}
          keyboardShouldPersistTaps="handled"
        >
      {/* Mode toggle — segmented control */}
      <View style={tw`mx-5 mt-6 mb-5`}>
        <View
          style={{
            flexDirection: "row",
            backgroundColor: C.surface,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: C.border,
            padding: 3,
          }}
        >
          {([
            { key: "POST", label: "Post" },
            { key: "CHECKIN", label: "Check In" },
            { key: "HOTSPOT", label: "Hotspot" },
          ] as const).map((m) => (
            <TouchableOpacity
              key={m.key}
              onPress={() => setMode(m.key)}
              activeOpacity={0.85}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 11,
                alignItems: "center",
                backgroundColor: mode === m.key ? C.label : "transparent",
              }}
            >
              <Text
                style={{
                  color: mode === m.key ? C.bg : C.muted,
                  fontSize: 13,
                  fontFamily: "Roobert-SemiBold",
                }}
              >
                {m.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {mode === "POST" && (
        <>
          {/* Top large media area for Post */}
          <TouchableOpacity
            onPress={async () => {
              try {
                const uri = await pickPostMedia();
                if (!uri) return;
                const type = detectMediaType(uri);
                // Add a placeholder item marked uploading so UI can show spinner
                const placeholder = { uri, type, uploading: true };
                // only allow a single media item for posts — replace any existing
                setMediaItems([placeholder]);
                try {
                  const up = await uploadPostMedia(uri);
                  // replace last item (the placeholder) with uploaded public url
                  setMediaItems((arr) => {
                    const copy = [...arr];
                    const i = copy.findIndex((m) => m.uri === uri && m.uploading);
                    if (i >= 0) {
                      copy[i] = { uri: up.publicUrl, type, uploading: false };
                    }
                    return copy;
                  });
                } catch (uploadErr: any) {
                  // mark as not uploading but keep local uri so user can retry
                  setMediaItems((arr) => arr.map(m => m.uri === uri ? { ...m, uploading: false } : m));
                  alert(uploadErr?.message || 'Upload failed');
                }
              } catch (e: any) {
                alert(e?.message || "Unable to pick media");
              }
            }}
            style={tw`mb-4 h-72 w-full bg-[#111] items-center justify-center overflow-hidden rounded-t-3xl`}
            activeOpacity={0.8}
          >
            {mediaItems.length === 0 ? (
              <>
                <IconSymbol name="plus.circle.fill" size={48} color="#9CA3AF" />
                <Text style={tw`text-gray-400 mt-3`}>Tap to add media</Text>
              </>
            ) : (
              <>
                {(() => {
                  const itm = mediaItems[0];
                  const isVideo = itm.type === 'video';
                  if (isVideo) {
                    return (
                      <View style={tw`w-full h-full bg-black`}>
                        <Video
                          source={{ uri: itm.uri }}
                          style={tw`w-full h-full`}
                          resizeMode={'cover' as any}
                          shouldPlay={false}
                          useNativeControls={false}
                        />
                        <View style={tw`absolute inset-0 items-center justify-center`}>
                          <IconSymbol name="play.fill" size={64} color="#fff" />
                        </View>
                        {itm.uploading && (
                          <View style={tw`absolute inset-0 items-center justify-center`}>
                            <ActivityIndicator color="#fff" />
                          </View>
                        )}
                      </View>
                    );
                  }
                  return (
                    <View style={tw`w-full h-full`}>
                      <Image
                        source={{ uri: itm.uri }}
                        style={tw`w-full h-full`}
                        resizeMode={'cover' as any}
                      />
                      {itm.uploading && (
                        <View style={tw`absolute inset-0 items-center justify-center`}>
                          <ActivityIndicator color="#fff" />
                        </View>
                      )}
                    </View>
                  );
                })()}
                <View
                  style={tw`absolute inset-0 bg-black/40 items-center justify-center`}
                >
                  <IconSymbol
                    name="plus.circle.fill"
                    size={40}
                    color="#D1D5DB"
                  />
                  <Text style={tw`text-gray-200 mt-2`}>Tap to add more</Text>
                </View>
              </>
            )}
          </TouchableOpacity>
          <View style={[tw`p-5 rounded-t-[40px] mt-[-50px] pb-6`, { backgroundColor: C.bg }]}>
            <Text
              style={[
                tw`text-xl mb-4`,
                { fontFamily: "Roobert-Bold", color: C.label },
              ]}
            >
              Create a Post
            </Text>
            <View style={tw`flex-row mb-4`}>
              {(["REVIEW", "PSA", "CHECK_IN"] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setPostType(t)}
                  style={[
                    tw`mr-2 px-3 py-2 rounded-xl`,
                    { backgroundColor: postType === t ? C.label : "transparent", borderWidth: postType === t ? 0 : 1, borderColor: C.border }
                  ]}
                >
                  <Text
                    style={[
                      tw`text-xs`,
                      { fontFamily: "Roobert-SemiBold", color: postType === t ? C.bg : C.label },
                    ]}
                  >
                    {t.replace("_", " ")}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <LabeledInput
              label="Title"
              value={postTitle}
              onChangeText={setPostTitle}
              placeholder="What's happening?"
            />
            <LabeledInput
              label="Content"
              value={postContent}
              onChangeText={setPostContent}
              placeholder="Add more details..."
              multiline
            />
            <View style={{ marginBottom: 14 }}>
              <Text style={{ fontFamily: "Roobert-SemiBold", color: C.label, fontSize: 12, marginBottom: 8 }}>
                Tags
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {POST_TAGS.map((tag) => {
                  const active = postTags.includes(tag);
                  return (
                    <TouchableOpacity
                      key={tag}
                      onPress={() => togglePostTag(tag)}
                      activeOpacity={0.75}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 20,
                        backgroundColor: active ? C.label : "transparent",
                        borderWidth: 1,
                        borderColor: active ? C.label : C.border,
                      }}
                    >
                      <Text style={{ fontFamily: "Roobert-SemiBold", fontSize: 12, color: active ? C.bg : C.label }}>
                        {tag}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            <LabeledInput
              label="Hotspot Search"
              value={hotspotQuery}
              onChangeText={setHotspotQuery}
              placeholder="Search hotspots by name"
            />
            {hotspotsLoading ? (
              <View style={tw`py-6 items-center`}>
                <ActivityIndicator color="#fff" />
              </View>
            ) : (
              <FlatList
                horizontal
                data={filteredHotspots}
                keyExtractor={(item) => String(item.id)}
                style={tw`max-h-48 space-x-3 mb-3`}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      tw`flex items-center flex-row gap-2 px-3 py-2 rounded-xl mr-1`,
                      { backgroundColor: selectedHotspot?.id === item.id ? C.label : "transparent", borderWidth: selectedHotspot?.id === item.id ? 0 : 1, borderColor: C.border }
                    ]}
                    onPress={() => setSelectedHotspot(item)}
                  >
                    <Image
                      source={{ uri: item.avatar }}
                      style={tw`w-5 h-5 rounded-full`}
                    />
                    <Text
                      style={[
                        { fontFamily: "Roobert-SemiBold", color: selectedHotspot?.id === item.id ? C.bg : C.label },
                      ]}
                    >
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                    <Text style={[tw`text-gray-500 text-xs  px-3 py-2`, { fontFamily: "Roobert-Medium" }]}>
                      {hotspotQuery.trim() ? "No hotspots match your search" : "You don't follow any hotspots yet — search to find them"}
                    </Text>
                }
              />
            )}


            <TouchableOpacity
              disabled={
                !postType ||
                !selectedHotspot ||
                !postTitle.trim() ||
                creatingPost
              }
              onPress={submitPost}
              style={[
                tw`rounded-xl px-4 py-3`,
                { backgroundColor: C.label, opacity: (!postType || !selectedHotspot || !postTitle.trim() || creatingPost) ? 0.4 : 1 }
              ]}
            >
              {creatingPost ? (
                <ActivityIndicator color={C.bg} />
              ) : (
                <Text style={[tw`text-center`, { fontFamily: "Roobert-Bold", color: C.bg }]}>
                  Create Post
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}

      {mode === "CHECKIN" && (
        <View style={tw`px-5`}>
          {/* Search */}
          <View style={{ backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 16 }}>
            <LabeledInput
              label="Search hotspots"
              value={checkinQuery}
              onChangeText={(t) => {
                setCheckinQuery(t);
                setSelectedCheckinHotspot(null);
              }}
              placeholder="Start typing a place name..."
              containerStyle={{ marginBottom: 0 }}
            />
          </View>

          {/* Hotspot list */}
          {checkinQuery.trim().length > 0 && (
            <View style={{ borderRadius: 12, borderWidth: 1, borderColor: "#1e1e1e", overflow: "hidden", marginBottom: 20 }}>
              {filteredHotspots
                .filter((h) => h.name.toLowerCase().includes(checkinQuery.toLowerCase()))
                .slice(0, 8)
                .map((h) => {
                  const isSelected = selectedCheckinHotspot?.id === h.id;
                  return (
                    <TouchableOpacity
                      key={h.id}
                      onPress={() => {
                        setSelectedCheckinHotspot(h);
                        setCheckinQuery(h.name);
                      }}
                      activeOpacity={0.8}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 14,
                        paddingVertical: 12,
                        borderBottomWidth: 1,
                        borderBottomColor: C.border,
                        backgroundColor: isSelected ? C.surface : C.bg,
                        gap: 10,
                      }}
                    >
                      <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: C.surface, alignItems: "center", justifyContent: "center" }}>
                        <MapPin size={14} color={C.txt3} />
                      </View>
                      <View style={tw`flex-1`}>
                        <Text style={{ color: C.label, fontFamily: "Roobert-SemiBold", fontSize: 14 }} numberOfLines={1}>
                          {h.name}
                        </Text>
                        {h.location?.address ? (
                          <Text style={{ color: C.muted, fontFamily: "Roobert-Regular", fontSize: 11, marginTop: 1 }} numberOfLines={1}>
                            {h.location.address}
                          </Text>
                        ) : null}
                      </View>
                      {isSelected && <CheckCircle size={18} color={C.txt} />}
                    </TouchableOpacity>
                  );
                })}
            </View>
          )}

          {/* Selected confirmation */}
          {selectedCheckinHotspot && (
            <View style={{ backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 16, marginBottom: 20 }}>
              <Text style={{ color: C.muted, fontFamily: "Roobert-Regular", fontSize: 11, marginBottom: 4 }}>
                Checking in at
              </Text>
              <Text style={{ color: C.label, fontFamily: "Roobert-Bold", fontSize: 17 }}>
                {selectedCheckinHotspot.name}
              </Text>
              {selectedCheckinHotspot.location?.address ? (
                <Text style={{ color: C.muted, fontFamily: "Roobert-Regular", fontSize: 12, marginTop: 3 }}>
                  {selectedCheckinHotspot.location.address}
                </Text>
              ) : null}
            </View>
          )}

          {/* Submit */}
          <TouchableOpacity
            onPress={submitCheckin}
            disabled={!selectedCheckinHotspot || creatingCheckin}
            activeOpacity={0.85}
            style={{
              backgroundColor: selectedCheckinHotspot && !creatingCheckin ? C.label : C.surface,
              borderRadius: 14,
              paddingVertical: 15,
              alignItems: "center",
            }}
          >
            {creatingCheckin ? (
              <ActivityIndicator color={C.bg} />
            ) : (
              <Text style={{ color: selectedCheckinHotspot ? C.bg : C.muted, fontFamily: "Roobert-SemiBold", fontSize: 15 }}>
                📍 Check In
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {mode === "HOTSPOT" && (
        <>
          {/* Top large avatar/media area for Hotspot */}
          <View style={tw`mb-4 relative`}>
            <TouchableOpacity
              onPress={pickHotspotAvatar}
              disabled={pickingImage}
              style={tw`items-center justify-center h-72 bg-[#111] overflow-hidden rounded-t-3xl`}
            >
              {pickingImage ? (
                <ActivityIndicator color="#fff" />
              ) : imageUrl ? (
                <>
                  <Image
                    source={{ uri: imageUrl }}
                    style={tw`w-full h-full rounded-xl`}
                              resizeMode={'cover' as any}
                  />
                  <View
                    style={tw`absolute inset-0 bg-black/40 rounded-xl items-center justify-center`}
                  >
                    <IconSymbol
                      name="photo.circle.fill"
                      size={32}
                      color="#9CA3AF"
                    />
                    <Text style={tw`text-gray-300 mt-2`}>
                      Tap to change image
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  <IconSymbol
                    name="photo.circle.fill"
                    size={32}
                    color="#9CA3AF"
                  />
                  <Text style={tw`text-gray-400 mt-2`}>
                    Tap to add avatar image
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={[tw`p-5 rounded-t-[40px] mt-[-50px] pb-4`, { backgroundColor: C.bg }]}>
            <Text style={[tw`text-xl font-semibold mb-3`, { color: C.label }]}>
              Create a Hotspot
            </Text>

            {/* Basic Info */}
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
              style={{ height: 60 }}
            />

            {/* Type tags */}
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontFamily: "Roobert-SemiBold", color: C.label, fontSize: 12, marginBottom: 8 }}>
                Type
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {["Bar", "Club", "Restaurant", "Café", "Shop", "Park", "Gym", "Event", "Gallery", "Hotel", "Beach", "Market", "Lounge", "Rooftop", "Popup"].map((tag) => (
                  <TouchableOpacity
                    key={tag}
                    onPress={() => setType(type === tag ? "" : tag)}
                    style={{
                      paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
                      backgroundColor: type === tag ? C.label : C.surface,
                      borderWidth: 1.5, borderColor: type === tag ? C.label : C.border,
                    }}
                  >
                    <Text style={{ fontFamily: "Roobert-SemiBold", fontSize: 12, color: type === tag ? C.bg : C.label }}>
                      {tag}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Contact Row */}
            <View style={tw`flex-row gap-2 mb-3`}>
              <View style={tw`flex-1`}>
                <Text style={{ fontFamily: "Roobert-SemiBold", color: C.label, fontSize: 12, marginBottom: 8 }}>
                  Phone
                </Text>
                <TextInput
                  value={number}
                  onChangeText={setNumber}
                  placeholder="123-456-7890"
                  placeholderTextColor={C.muted}
                  keyboardType="phone-pad"
                  style={{ borderWidth: 2, borderColor: C.border, borderRadius: 12, fontSize: 12, paddingHorizontal: 12, paddingVertical: 8, color: C.label, backgroundColor: C.surface, fontFamily: "Roobert-Medium" }}
                />
              </View>
            </View>

            {/* Website & Email Row */}
            <View style={tw`flex-row gap-2 mb-3`}>
              <View style={tw`flex-1`}>
                <Text
                  style={[
                    { fontFamily: "Roobert-SemiBold", color: C.label, fontSize: 12, marginBottom: 8 },
                  ]}
                >
                  Link
                </Text>
                <TextInput
                  value={site}
                  onChangeText={setSite}
                  placeholder="Example.com"
                  placeholderTextColor={C.muted}
                  autoCapitalize="none"
                  style={[
                    { borderWidth: 2, borderColor: C.border, borderRadius: 12, fontSize: 12, paddingHorizontal: 12, paddingVertical: 8, color: C.label, backgroundColor: C.surface, fontFamily: "Roobert-Medium" },
                  ]}
                />
              </View>
              <View style={tw`flex-1`}>
                <Text
                  style={[
                    { fontFamily: "Roobert-SemiBold", color: C.label, fontSize: 12, marginBottom: 8 },
                  ]}
                >
                  Email
                </Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="contact@gmail.com"
                  placeholderTextColor={C.muted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={[
                    { borderWidth: 2, borderColor: C.border, borderRadius: 12, fontSize: 12, paddingHorizontal: 12, paddingVertical: 8, color: C.label, backgroundColor: C.surface, fontFamily: "Roobert-Medium" },
                  ]}
                />
              </View>
            </View>

            {/* Location Section */}
            <LabeledInput
              label="Address"
              value={addressLine}
              onChangeText={setAddressLine}
              placeholder="123 Main St"
            />

            {/* City & State Row */}
            <View style={tw`flex-row gap-2 mb-3`}>
              <View style={tw`flex-1`}>
                <Text
                  style={[
                    { fontFamily: "Roobert-SemiBold", color: C.label, fontSize: 12, marginBottom: 8 },
                  ]}
                >
                  City
                </Text>
                <TextInput
                  value={city}
                  onChangeText={setCity}
                  placeholder="City"
                  placeholderTextColor={C.muted}
                  style={[
                    { borderWidth: 2, borderColor: C.border, borderRadius: 12, fontSize: 12, paddingHorizontal: 12, paddingVertical: 8, color: C.label, backgroundColor: C.surface, fontFamily: "Roobert-Medium" },
                  ]}
                />
              </View>
              <View style={tw`flex-1`}>
                <Text
                  style={[
                    { fontFamily: "Roobert-SemiBold", color: C.label, fontSize: 12, marginBottom: 8 },
                  ]}
                >
                  State
                </Text>
                <TextInput
                  value={region}
                  onChangeText={setRegion}
                  placeholder="State"
                  placeholderTextColor={C.muted}
                  style={[
                    { borderWidth: 2, borderColor: C.border, borderRadius: 12, fontSize: 12, paddingHorizontal: 12, paddingVertical: 8, color: C.label, backgroundColor: C.surface, fontFamily: "Roobert-Medium" },
                  ]}
                />
              </View>
            </View>

            {/* Postal & Country Row */}
            <View style={tw`flex-row gap-2 mb-3`}>
              <View style={tw`flex-1`}>
                <Text
                  style={[
                    { fontFamily: "Roobert-SemiBold", color: C.label, fontSize: 12, marginBottom: 8 },
                  ]}
                >
                  Postal Code
                </Text>
                <TextInput
                  value={postalCode}
                  onChangeText={setPostalCode}
                  placeholder="12345"
                  placeholderTextColor={C.muted}
                  keyboardType="number-pad"
                  style={[
                    { borderWidth: 2, borderColor: C.border, borderRadius: 12, fontSize: 12, paddingHorizontal: 12, paddingVertical: 8, color: C.label, backgroundColor: C.surface, fontFamily: "Roobert-Medium" },
                  ]}
                />
              </View>
              <View style={tw`flex-1`}>
                <Text
                  style={[
                    { fontFamily: "Roobert-SemiBold", color: C.label, fontSize: 12, marginBottom: 8 },
                  ]}
                >
                  Country
                </Text>
                <TextInput
                  value={country}
                  onChangeText={setCountry}
                  placeholder="USA"
                  placeholderTextColor={C.muted}
                  style={[
                    { borderWidth: 2, borderColor: C.border, borderRadius: 12, fontSize: 12, paddingHorizontal: 12, paddingVertical: 8, color: C.label, backgroundColor: C.surface, fontFamily: "Roobert-Medium" },
                  ]}
                />
              </View>
            </View>

            {composedAddress ? (
              <Text style={tw`text-gray-400 text-[10px] mb-3`}>
                📍 {composedAddress}
              </Text>
            ) : null}

            {/* Switches in a compact row */}
            <View style={tw`mb-3`}>
              <View
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 2, borderColor: C.border, borderRadius: 12, paddingHorizontal: 20, padding: 8 }}
              >
                <Text
                  style={[
                    { color: C.label, fontSize: 12, marginRight: 8 },
                    { fontFamily: "Roobert-Medium" },
                  ]}
                >
                  Event
                </Text>
                <Switch
                  value={isEvent}
                  onValueChange={(val) => {
                    setIsEvent(val);
                    // If turning on event, turn off popup
                    if (val && isPopup) {
                      setIsPopup(false);
                    }
                  }}
                />
              </View>
              {isEvent ? (
                <Text
                  style={[
                    tw`text-green-400 my-2 text-xs`,
                    { fontFamily: "Roobert-SemiBold" },
                  ]}
                >
                  Your hotspot will be marked as an event
                </Text>
              ) : (
                <Text
                  style={[
                    tw`text-gray-400 my-2 text-xs`,
                    { fontFamily: "Roobert-SemiBold" },
                  ]}
                >
                  Your hotspot will be marked as a regular location
                </Text>
              )}
              {isEvent && (
                <DateTimeInput
                  label="Event time"
                  value={time}
                  onChange={(val) => setTime(val ?? '')}
                  placeholder="Date & Time of event"
                />
              )}
            </View>

            {/* Popup Hotspot Section */}
            <View style={tw`mb-3`}>
              <View
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 2, borderColor: C.border, borderRadius: 12, paddingHorizontal: 20, padding: 8 }}
              >
                <Text
                  style={[
                    { color: C.label, fontSize: 12, marginRight: 8 },
                    { fontFamily: "Roobert-Medium" },
                  ]}
                >
                  Popup Hotspot
                </Text>
                <Switch
                  value={isPopup}
                  onValueChange={(val) => {
                    setIsPopup(val);
                    // If turning on popup, turn off event
                    if (val && isEvent) {
                      setIsEvent(false);
                    }
                  }}
                />
              </View>
              {isPopup ? (
                <Text
                  style={[
                    tw`text-green-400 my-2 text-xs`,
                    { fontFamily: "Roobert-SemiBold" },
                  ]}
                >
                  Your hotspot will be marked as a temporary popup
                </Text>
              ) : (
                <Text
                  style={[
                    tw`text-gray-400 my-2 text-xs`,
                    { fontFamily: "Roobert-SemiBold" },
                  ]}
                >
                  Your hotspot will be permanent
                </Text>
              )}
              {isPopup && (
                <>
                  <TimeInput
                    label="Popup Start Time"
                    value={popupStart}
                    onChange={(val) => setPopupStart(val ?? '')}
                    placeholder="When does the popup start?"
                  />
                  <TimeInput
                    label="Popup End Time"
                    value={popupEnd}
                    onChange={(val) => setPopupEnd(val ?? '')}
                    placeholder="When does the popup end?"
                  />
                </>
              )}
            </View>

            {mode === "HOTSPOT" && (
              <TouchableOpacity
                onPress={submitHotspot}
                disabled={creatingHotspot}
                style={[tw`py-3 rounded-xl items-center`, { backgroundColor: C.label, opacity: creatingHotspot ? 0.6 : 1 }]}
              >
                {creatingHotspot ? (
                  <ActivityIndicator color={C.bg} />
                ) : (
                  <Text
                    style={[{ color: C.bg }, { fontFamily: "Roobert-Bold" }]}
                  >
                    Create Hotspot
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </>
      )}

      {/* Absolutely positioned Create Button */}
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
    </View>
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
