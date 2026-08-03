import React from "react";
import { Pressable, StyleProp, ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";

interface Props {
  onPress?: () => void;
  onLongPress?: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  scale?: number;
  disabled?: boolean;
}

export function ScalePress({
  onPress,
  onLongPress,
  children,
  style,
  scale = 0.95,
  disabled,
}: Props) {
  const sv = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sv.value }],
  }));

  return (
    <Pressable
      disabled={disabled}
      onPressIn={() => {
        sv.value = withSpring(scale, { damping: 20, stiffness: 500 });
      }}
      onPressOut={() => {
        sv.value = withSpring(1, { damping: 15, stiffness: 300 });
      }}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      <Animated.View style={[style, animStyle]}>{children}</Animated.View>
    </Pressable>
  );
}
