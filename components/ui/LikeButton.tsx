import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import { Pressable } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

interface Props {
  initialLiked?: boolean;
  onToggle?: (liked: boolean) => void;
  size?: number;
}

export function LikeButton({ initialLiked = false, onToggle, size = 18 }: Props) {
  const [liked, setLiked] = useState(initialLiked);
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  function handle() {
    const next = !liked;
    setLiked(next);
    Haptics.impactAsync(
      next ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light,
    );
    scale.value = next
      ? withSequence(
          withSpring(1.6, { damping: 5, stiffness: 500 }),
          withSpring(1, { damping: 10, stiffness: 300 }),
        )
      : withSpring(1, { damping: 15, stiffness: 300 });
    onToggle?.(next);
  }

  return (
    <Pressable onPress={handle} hitSlop={10}>
      <Animated.View style={animStyle}>
        <Svg width={size} height={size} viewBox="0 0 24 24" fill={liked ? "#EF4444" : "none"}>
          <Path
            d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
            stroke={liked ? "#EF4444" : "rgba(255,255,255,0.25)"}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </Animated.View>
    </Pressable>
  );
}
