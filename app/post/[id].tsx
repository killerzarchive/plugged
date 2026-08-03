import { gql } from "@apollo/client";
import { useMutation, useQuery } from "@apollo/client/react";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { ResizeMode, Video } from "expo-av";
import { router, useLocalSearchParams } from "expo-router";
import { Heart, X, Send } from "lucide-react-native";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: SW, height: SH } = Dimensions.get("window");
const BLUE = "#1877F2";

// ── Types ────────────────────────────────────────────────────────────────────

export interface StoryPost {
  id: string;
  media?: string;
  type?: string;
  title?: string;
  content?: string;
  createdAt?: string;
  authorId: string;
  authorName: string;
  authorPfp?: string;
}

// ── Queries / mutations ──────────────────────────────────────────────────────

const POST_QUERY = gql`
  query StoryPost($id: Int!) {
    postById(id: $id) {
      id title content media type createdAt
      likesCount isLikedByMe
      author { id name pfp }
    }
  }
`;

const LIKE_POST = gql`
  mutation StoryLike($postId: Int!) {
    likePost(postId: $postId) { id likesCount isLikedByMe }
  }
`;

const UNLIKE_POST = gql`
  mutation StoryUnlike($postId: Int!) {
    unlikePost(postId: $postId) { id likesCount isLikedByMe }
  }
`;

// ── Helpers ──────────────────────────────────────────────────────────────────

function isVideo(media?: string, type?: string): boolean {
  if (type === "video") return true;
  if (!media) return false;
  const url = media.toLowerCase().split("?")[0];
  return url.endsWith(".mp4") || url.endsWith(".mov") || url.endsWith(".webm");
}

function timeAgo(iso?: string): string {
  if (!iso) return "";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// ── Story item ───────────────────────────────────────────────────────────────

interface StoryItemProps {
  post: StoryPost;
  index: number;
  currentIndex: number;
  onPrev: () => void;
  onNext: () => void;
  totalCount: number;
}

function StoryItem({ post, index, currentIndex, onPrev, onNext, totalCount }: StoryItemProps) {
  const insets = useSafeAreaInsets();
  const [comment, setComment] = useState("");
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);

  const { data } = useQuery<{ postById: { id: string; likesCount: number; isLikedByMe: boolean } }>(
    gql`query SILike($id: Int!) { postById(id: $id) { id likesCount isLikedByMe } }`,
    { variables: { id: parseInt(post.id, 10) }, fetchPolicy: "cache-and-network", skip: index !== currentIndex }
  );

  const isLikedByMe = data?.postById?.isLikedByMe ?? liked;
  const displayLikes = data?.postById?.likesCount ?? likesCount;

  const [likePost] = useMutation(LIKE_POST, {
    variables: { postId: parseInt(post.id, 10) },
    onCompleted: (d) => {
      setLikesCount(d.likePost.likesCount);
      setLiked(d.likePost.isLikedByMe);
    },
  });
  const [unlikePost] = useMutation(UNLIKE_POST, {
    variables: { postId: parseInt(post.id, 10) },
    onCompleted: (d) => {
      setLikesCount(d.unlikePost.likesCount);
      setLiked(d.unlikePost.isLikedByMe);
    },
  });

  const handleLike = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isLikedByMe) {
      unlikePost();
    } else {
      likePost();
    }
  }, [isLikedByMe, likePost, unlikePost]);

  const vid = isVideo(post.media, post.type);

  return (
    <View style={{ width: SW, height: SH }}>
      {/* Media */}
      <View style={StyleSheet.absoluteFillObject}>
        {post.media ? (
          vid ? (
            <Video
              source={{ uri: post.media }}
              style={StyleSheet.absoluteFillObject}
              resizeMode={ResizeMode.COVER}
              shouldPlay={index === currentIndex}
              isMuted={false}
              isLooping
            />
          ) : (
            <Image
              source={{ uri: post.media }}
              style={StyleSheet.absoluteFillObject}
              resizeMode="cover"
            />
          )
        ) : (
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "#111" }]} />
        )}
      </View>

      {/* Bottom gradient */}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.5)", "rgba(0,0,0,0.92)"]}
        style={[StyleSheet.absoluteFillObject, { top: SH * 0.45 }]}
      />

      {/* Top gradient (for legibility of header) */}
      <LinearGradient
        colors={["rgba(0,0,0,0.55)", "transparent"]}
        style={[StyleSheet.absoluteFillObject, { bottom: SH * 0.72 }]}
      />

      {/* Tap zones — prev/next */}
      <View style={st.tapZones} pointerEvents="box-none">
        <TouchableOpacity
          style={st.tapLeft}
          activeOpacity={1}
          onPress={onPrev}
        />
        <TouchableOpacity
          style={st.tapRight}
          activeOpacity={1}
          onPress={onNext}
        />
      </View>

      {/* Progress bars */}
      <View style={[st.progressRow, { top: insets.top + 8 }]}>
        {Array.from({ length: totalCount }).map((_, i) => (
          <View key={i} style={[st.progressTrack, { flex: 1 }]}>
            <View
              style={[
                st.progressFill,
                { width: i < index ? "100%" : i === index ? "100%" : "0%", opacity: i <= index ? 1 : 0.3 },
              ]}
            />
          </View>
        ))}
      </View>

      {/* Header row */}
      <View style={[st.headerRow, { top: insets.top + 24 }]}>
        <TouchableOpacity
          activeOpacity={0.82}
          onPress={() => router.push(`/profile-view?type=user&id=${post.authorId}` as any)}
          style={st.authorRow}
        >
          <View style={st.authorAvatar}>
            {post.authorPfp
              ? <Image source={{ uri: post.authorPfp }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
              : <Text style={st.authorInitial}>{post.authorName[0]?.toUpperCase()}</Text>
            }
          </View>
          <View>
            <Text style={st.authorName}>{post.authorName}</Text>
            {post.createdAt && <Text style={st.authorTime}>{timeAgo(post.createdAt)}</Text>}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => { Haptics.selectionAsync(); router.back(); }}
          activeOpacity={0.82}
          style={st.closeBtn}
        >
          <X size={18} color="#fff" strokeWidth={2.2} />
        </TouchableOpacity>
      </View>

      {/* Bottom content */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "position" : undefined}
        style={st.bottomContent}
      >
        {/* Description */}
        {(post.title || post.content) ? (
          <View style={st.descBlock}>
            {post.title ? <Text style={st.descTitle}>{post.title}</Text> : null}
            {post.content ? <Text style={st.descBody} numberOfLines={3}>{post.content}</Text> : null}
          </View>
        ) : null}

        {/* Actions row */}
        <View style={st.actionsRow}>
          <TouchableOpacity
            onPress={handleLike}
            activeOpacity={0.82}
            style={st.likeBtn}
          >
            <Heart
              size={22}
              color={isLikedByMe ? "#FF3B30" : "#fff"}
              fill={isLikedByMe ? "#FF3B30" : "none"}
              strokeWidth={2}
            />
            {displayLikes > 0 && (
              <Text style={st.likeCount}>{displayLikes}</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Comment input */}
        <View style={[st.commentBar, { paddingBottom: insets.bottom + 10 }]}>
          <View style={st.commentInputWrap}>
            <TextInput
              style={st.commentInput}
              placeholder="Add a comment..."
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={comment}
              onChangeText={setComment}
              returnKeyType="send"
              onSubmitEditing={() => { setComment(""); Haptics.selectionAsync(); }}
            />
          </View>
          {comment.trim().length > 0 && (
            <TouchableOpacity
              onPress={() => { setComment(""); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              activeOpacity={0.82}
              style={st.sendBtn}
            >
              <Send size={17} color="#fff" strokeWidth={2} />
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function PostViewer() {
  const { id, posts: postsParam, index: indexParam } = useLocalSearchParams<{
    id: string;
    posts?: string;
    index?: string;
  }>();

  const allPosts = useMemo<StoryPost[]>(() => {
    if (postsParam) {
      try { return JSON.parse(postsParam); } catch {}
    }
    return [];
  }, [postsParam]);

  const initialIndex = useMemo(() => {
    if (indexParam) {
      const n = parseInt(indexParam, 10);
      if (!isNaN(n)) return n;
    }
    const idx = allPosts.findIndex((p) => p.id === id);
    return idx >= 0 ? idx : 0;
  }, [indexParam, allPosts, id]);

  // Fallback: single post query when no posts list provided
  const { data: singleData, loading } = useQuery<{
    postById: {
      id: string; title?: string; content?: string; media?: string;
      type?: string; createdAt?: string; likesCount: number; isLikedByMe: boolean;
      author: { id: string; name: string; pfp?: string };
    }
  }>(POST_QUERY, {
    variables: { id: parseInt(id || "0", 10) },
    skip: !id || allPosts.length > 0,
    fetchPolicy: "cache-and-network",
  });

  const posts: StoryPost[] = useMemo(() => {
    if (allPosts.length > 0) return allPosts;
    if (singleData?.postById) {
      const p = singleData.postById;
      return [{
        id: p.id,
        media: p.media,
        type: p.type,
        title: p.title,
        content: p.content,
        createdAt: p.createdAt,
        authorId: p.author.id,
        authorName: p.author.name,
        authorPfp: p.author.pfp,
      }];
    }
    return [];
  }, [allPosts, singleData]);

  const listRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const scrollToIndex = useCallback((idx: number) => {
    if (idx < 0 || idx >= posts.length) {
      router.back();
      return;
    }
    Haptics.selectionAsync();
    listRef.current?.scrollToIndex({ index: idx, animated: false });
    setCurrentIndex(idx);
  }, [posts.length]);

  const goNext = useCallback(() => scrollToIndex(currentIndex + 1), [currentIndex, scrollToIndex]);
  const goPrev = useCallback(() => scrollToIndex(currentIndex - 1), [currentIndex, scrollToIndex]);

  if (loading && posts.length === 0) {
    return <View style={{ flex: 1, backgroundColor: "#000" }} />;
  }

  if (posts.length === 0) {
    return <View style={{ flex: 1, backgroundColor: "#000" }} />;
  }

  return (
    <>
      <StatusBar hidden />
      <FlatList
        ref={listRef}
        data={posts}
        keyExtractor={(p) => p.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        initialScrollIndex={initialIndex}
        getItemLayout={(_, index) => ({ length: SW, offset: SW * index, index })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        renderItem={({ item, index }) => (
          <StoryItem
            post={item}
            index={index}
            currentIndex={currentIndex}
            onPrev={goPrev}
            onNext={goNext}
            totalCount={posts.length}
          />
        )}
      />
    </>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  tapZones: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    zIndex: 1,
  },
  tapLeft: {
    width: SW * 0.38,
    height: "100%",
  },
  tapRight: {
    flex: 1,
    height: "100%",
  },
  progressRow: {
    position: "absolute",
    left: 14,
    right: 14,
    flexDirection: "row",
    gap: 4,
    zIndex: 10,
  },
  progressTrack: {
    height: 2.5,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.25)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#fff",
    borderRadius: 2,
  },
  headerRow: {
    position: "absolute",
    left: 14,
    right: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 10,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  authorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#222",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.3)",
  },
  authorInitial: {
    color: "#fff",
    fontFamily: "Roobert-Bold",
    fontSize: 14,
  },
  authorName: {
    color: "#fff",
    fontFamily: "Roobert-SemiBold",
    fontSize: 13,
    letterSpacing: -0.2,
  },
  authorTime: {
    color: "rgba(255,255,255,0.5)",
    fontFamily: "Roobert-Regular",
    fontSize: 11,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  bottomContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  descBlock: {
    paddingHorizontal: 18,
    paddingBottom: 10,
  },
  descTitle: {
    color: "#fff",
    fontFamily: "Roobert-Bold",
    fontSize: 16,
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  descBody: {
    color: "rgba(255,255,255,0.75)",
    fontFamily: "Roobert-Regular",
    fontSize: 13,
    lineHeight: 18,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingBottom: 10,
    gap: 16,
  },
  likeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  likeCount: {
    color: "#fff",
    fontFamily: "Roobert-SemiBold",
    fontSize: 13,
  },
  commentBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  commentInputWrap: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  commentInput: {
    color: "#fff",
    fontFamily: "Roobert-Regular",
    fontSize: 13,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
});
