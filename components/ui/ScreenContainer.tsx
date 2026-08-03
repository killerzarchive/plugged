import React from 'react';
import { Platform, View, ViewStyle } from 'react-native';

interface ScreenContainerProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  /** Optional maxWidth override (defaults 960 on web, full on native) */
  maxWidth?: number;
  /** Optional horizontal padding override (defaults 16) */
  paddingHorizontal?: number;
}

/**
 * Centers tab screen content inside a constrained width so tabs/pages
 * no longer visually occupy the entire screen width on large displays (web/tablet).
 * Keeps full-width on mobile by default while adding side gutters.
 */
export const ScreenContainer: React.FC<ScreenContainerProps> = ({
  children,
  style,
  maxWidth,
  paddingHorizontal = 16,
}) => {
  const resolvedMaxWidth = maxWidth ?? (Platform.OS === 'web' ? 960 : undefined);
  return (
    <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center' }}>
      <View
        style={[
          {
            flex: 1,
            width: '100%',
            maxWidth: resolvedMaxWidth,
            paddingHorizontal,
          },
          style,
        ]}
      >
        {children}
      </View>
    </View>
  );
};

export default ScreenContainer;
