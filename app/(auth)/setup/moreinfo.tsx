import tw from "@/lib/tw";
import { useNavigation } from "@react-navigation/native";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

export default function MoreInfoScreen() {
  const navigation = useNavigation();
  
  const handleContinue = React.useCallback(() => {
    navigation.navigate("ProfileSetup" as never);
  }, [navigation]);

  return (
    <View style={tw`flex-1 bg-black px-7 justify-center`}>
      <View style={tw`items-center`}>
        <Text style={tw`text-white text-4xl font-bold mb-4 text-center`}>
          Welcome! 🎉
        </Text>
        <Text style={tw`text-gray-400 text-lg text-center mb-2`}>
          Let's set up your profile
        </Text>
        <Text style={tw`text-gray-500 text-sm text-center mb-12 px-4`}>
          We'll ask you a few questions to help you get started and connect with others
        </Text>

        <TouchableOpacity
          onPress={handleContinue}
          style={tw`bg-blue-600 rounded-lg py-4 px-12`}
          activeOpacity={0.8}
        >
          <Text style={tw`text-white font-semibold text-lg`}>
            Let's Get Started
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
