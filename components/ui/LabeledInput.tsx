import { useColors } from "@/contexts/theme";
import { layout } from "@/constants/layout";
import React from "react";
import { StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from "react-native";

interface LabeledInputProps extends TextInputProps {
  label: string;
  containerStyle?: ViewStyle;
}

export function LabeledInput({ label, containerStyle, ...props }: LabeledInputProps) {
  const C = useColors();
  const [focused, setFocused] = React.useState(false);
  return (
    <View style={[{ marginBottom: layout.gap.md }, containerStyle]}>
      <Text style={{
        color: C.txt3, fontFamily: "Roobert-SemiBold", fontSize: 11,
        letterSpacing: 0.06, marginBottom: 7,
      }}>
        {label}
      </Text>
      <TextInput
        placeholderTextColor={C.txt3}
        style={{
          height: layout.inputHeight,
          backgroundColor: C.input,
          borderRadius: layout.inputRadius,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: focused ? C.accent : C.inputBorder,
          paddingHorizontal: 14,
          color: C.txt,
          fontFamily: "Roobert-Regular",
          fontSize: 14,
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...props}
      />
    </View>
  );
}
