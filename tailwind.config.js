/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./navigation/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Roobert-Regular'],
        'roobert': ['Roobert-Regular'],
        'roobert-light': ['Roobert-Light'],
        'roobert-medium': ['Roobert-Medium'],
        'roobert-semibold': ['Roobert-SemiBold'],
        'roobert-bold': ['Roobert-Bold'],
        'roobert-heavy': ['Roobert-Heavy'],
      },
      fontWeight: {
        light: '300',
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
        heavy: '900',
      },
    },
  },
  plugins: [],
};
