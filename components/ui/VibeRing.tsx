import React, { useEffect, useRef } from "react";
import { Animated, View } from "react-native";

interface VibeRingProps {
  /** Number of check-ins in the relevant time window */
  count: number;
  /** Diameter of the avatar inside */
  size: number;
  children: React.ReactNode;
}

/** Returns ring color based on activity level */
function vibeColor(count: number) {
  if (count >= 10) return "#FF3B30"; // fire
  if (count >= 5) return "#FF9500";  // warm
  if (count >= 2) return "#FFD60A";  // mild
  return null; // no ring
}

export default function VibeRing({ count, size, children }: VibeRingProps) {
  const color = vibeColor(count);
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!color) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [color]);

  if (!color) return <>{children}</>;

  const ringPad = 3;
  const outer = size + ringPad * 2 + 4;

  return (
    <View style={{ width: outer, height: outer, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={{
          position: "absolute",
          width: outer,
          height: outer,
          borderRadius: outer / 2,
          borderWidth: 2.5,
          borderColor: color,
          transform: [{ scale: pulse }],
          opacity: 0.85,
        }}
      />
      <View style={{ width: size, height: size }}>
        {children}
      </View>
    </View>
  );
}
