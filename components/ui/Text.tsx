import React from 'react';
import { Text as RNText, TextProps } from 'react-native';

interface CustomTextProps extends TextProps {
  font?: 'light' | 'regular' | 'medium' | 'semibold' | 'bold' | 'heavy';
}

const fontMap = {
  light: 'Roobert-Light',
  regular: 'Roobert-Regular',
  medium: 'Roobert-Medium',
  semibold: 'Roobert-SemiBold',
  bold: 'Roobert-Bold',
  heavy: 'Roobert-Heavy',
};

export function Text({ style, font = 'regular', ...props }: CustomTextProps) {
  const fontFamily = fontMap[font];
  
  return (
    <RNText 
      {...props} 
      style={[
        { fontFamily },
        style
      ]} 
    />
  );
}
