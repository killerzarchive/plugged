module.exports = function (api) {
  api.cache(true);
  console.log("[babel] Using project babel.config.js with NativeWind + Reanimated");
  return {
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }], "nativewind/babel"],
    plugins: [
      // Reanimated plugin must be listed last
      require.resolve("react-native-reanimated/plugin"),
    ],
  };
};
