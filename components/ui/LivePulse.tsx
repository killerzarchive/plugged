import { useColors } from "@/contexts/theme";
import React, { useEffect, useRef } from "react";
import { Animated, View } from "react-native";

interface LivePulseProps {
  size?: number;
}

export default function LivePulse({ size = 8 }: LivePulseProps) {
  const C = useColors();
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.25, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={{
          width: size, height: size, borderRadius: size / 2,
          backgroundColor: C.accent,
          opacity,
        }}
      />
    </View>
  );
}
