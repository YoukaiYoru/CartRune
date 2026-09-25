import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { theme } from '@/theme';
import { resolveApiUrl } from '@/services/api';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  coverUrl?: string | null;
  title?: string;
  width?: number;
  height?: number;
  onPress?: () => void;
};

/** Lightweight 2.5D cover treatment. It uses the real catalogue image and no GL canvas. */
export function DepthCover({ coverUrl, title, width = 112, height = 152, onPress }: Props) {
  const pressed = useSharedValue(0);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: theme.depth.perspective },
      { rotateX: `${interpolate(pressed.value, [0, 1], [0, 1.8])}deg` },
      { rotateY: `${interpolate(pressed.value, [0, 1], [0, -2.5])}deg` },
      { translateY: interpolate(pressed.value, [0, 1], [0, -theme.depth.lift]) },
      { scale: interpolate(pressed.value, [0, 1], [1, 0.985]) },
    ],
  }));

  return (
    <AnimatedPressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={title ? `${title} cover` : 'Game cover'}
      disabled={!onPress}
      onPress={onPress}
      onPressIn={() => { pressed.value = withTiming(1, { duration: theme.motion.micro }); }}
      onPressOut={() => { pressed.value = withTiming(0, { duration: theme.motion.micro }); }}
      style={[styles.shadow, { width, height }, cardStyle]}
    >
      <View style={styles.frame}>
        {coverUrl ? (
          <Image source={{ uri: resolveApiUrl(coverUrl) }} style={styles.image} contentFit="contain" transition={180} />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderMark}>✦</Text>
            <Text style={styles.placeholderText}>NO COVER</Text>
          </View>
        )}
        <View pointerEvents="none" style={styles.edge} />
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  shadow: {
    borderRadius: 14,
    shadowColor: '#000',
    shadowOpacity: theme.depth.shadowOpacity,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 9 },
    elevation: 7,
  },
  frame: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 14,
    backgroundColor: theme.bg.input,
    borderWidth: 1,
    borderColor: theme.border.default,
  },
  image: { width: '100%', height: '100%' },
  edge: {
    ...StyleSheet.absoluteFill,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 5 },
  placeholderMark: { color: theme.accent.primary, fontSize: 28 },
  placeholderText: { color: theme.text.muted, fontSize: 8, fontWeight: '800', letterSpacing: 1.2 },
});
