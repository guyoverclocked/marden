import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

import { colors } from '../theme';

type BrandMarkProps = {
  size?: number;
  inverted?: boolean;
};

export function BrandMark({ size = 38, inverted = false }: BrandMarkProps) {
  const background = inverted ? colors.paper : colors.moss;
  const foreground = inverted ? colors.moss : colors.lime;

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" accessibilityLabel="Marden logo">
      <Rect width="48" height="48" rx="14" fill={background} />
      <Path
        d="M13.5 14.25c5.4-.2 9.05 1.46 10.5 5 1.45-3.54 5.1-5.2 10.5-5v18.1c-4.45-.16-7.95 1.05-10.5 3.65-2.55-2.6-6.05-3.81-10.5-3.65v-18.1Z"
        fill={foreground}
      />
      <Path d="M24 19.25V36" stroke={background} strokeWidth="2.1" strokeLinecap="round" opacity={0.8} />
      <Path d="M27.2 23.4c2.5-1.7 4.6-1.9 6.3-.65" stroke={background} strokeWidth="1.65" strokeLinecap="round" opacity={0.65} />
    </Svg>
  );
}
