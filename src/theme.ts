import { Platform } from 'react-native';

export const colors = {
  canvas: '#F5F3ED',
  paper: '#FBFAF7',
  paperStrong: '#FFFFFF',
  ink: '#1C211E',
  inkSoft: '#5E655F',
  inkFaint: '#8C928D',
  line: '#E3E0D7',
  lineStrong: '#D2CEC2',
  moss: '#315C4A',
  mossDark: '#244538',
  mossSoft: '#DCE9E1',
  lime: '#D7E9A2',
  sand: '#EDE7D8',
  amber: '#B87333',
  error: '#A9473F',
  shadow: '#1C211E',
};
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  mono: Platform.select({ ios: 'SFMono-Regular', android: 'monospace', default: 'monospace' }),
};

export const radii = {
  sm: 12,
  md: 18,
  lg: 24,
  xl: 30,
  pill: 999,
};

export const shadow = {
  card: Platform.select({
    ios: {
      shadowColor: colors.shadow,
      shadowOpacity: 0.07,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 9 },
    },
    android: { elevation: 3 },
    default: {},
  }),
  floating: Platform.select({
    ios: {
      shadowColor: colors.shadow,
      shadowOpacity: 0.16,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 10 },
    },
    android: { elevation: 8 },
    default: {},
  }),
};
