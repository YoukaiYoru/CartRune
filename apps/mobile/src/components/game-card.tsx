import { StyleSheet, Pressable, View, Text } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { theme } from '@/theme';
import { resolveApiUrl } from '@/services/api';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const BLURHASH = 'LON8t;~qM{Rj?w%Mofofxut7t7t7';

interface GameCardProps {
  title: string;
  platform: string;
  progress?: number;
  size?: 'small' | 'medium';
  coverUrl?: string;
  onPress: () => void;
}

export function GameCard({
  title,
  platform,
  progress,
  size = 'medium',
  coverUrl,
  onPress,
}: GameCardProps) {
  const isSmall = size === 'small';
  const scale = useSharedValue(1);
  const translateY = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: translateY.value },
    ],
  }));

  const onPressIn = () => {
    scale.value = withSpring(0.97, { damping: 15, stiffness: 400 });
    translateY.value = withTiming(-3, { duration: 150 });
  };

  const onPressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
    translateY.value = withTiming(0, { duration: 200 });
  };

  return (
    <AnimatedPressable
      style={[styles.card, isSmall && styles.cardSmall, animatedStyle]}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${platform}`}
    >
      <View style={[styles.cover, isSmall && styles.coverSmall]}>
        {coverUrl ? (
          <Image
            source={{ uri: resolveApiUrl(coverUrl) }}
            style={styles.coverImage}
            contentFit="contain"
            transition={150}
            placeholder={BLURHASH}
          />
        ) : (
          <Text style={styles.coverEmoji}>🎮</Text>
        )}
        <View style={styles.coverShine} />
      </View>
      <Text style={styles.title} numberOfLines={2}>{title}</Text>
      <Text style={styles.platform}>{platform}</Text>
      {progress != null && progress > 0 && (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '48%',
    marginBottom: 16,
  },
  cardSmall: { width: 130, marginLeft: 0, marginBottom: 0 },
  cover: {
    width: '100%',
    aspectRatio: 0.7,
    backgroundColor: theme.bg.surface,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.border.subtle,
  },
  coverSmall: { width: 130, height: 170, aspectRatio: undefined },
  coverEmoji: { fontSize: 36 },
  coverImage: { width: '100%', height: '100%', backgroundColor: theme.bg.surface },
  coverShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '30%',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  title: { color: theme.text.primary, fontSize: 13, lineHeight: 17, fontWeight: '700' },
  platform: { color: theme.text.muted, fontSize: 11, marginTop: 3 },
  progressTrack: {
    height: 3,
    backgroundColor: theme.bg.elevated,
    borderRadius: 2,
    marginTop: 6,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: theme.accent.warm, borderRadius: 2 },
});
