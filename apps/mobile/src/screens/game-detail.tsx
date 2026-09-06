import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/screen-header';
import { ProgressBar } from '@/components/progress-bar';
import { theme } from '@/theme';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';

const MOCK_GAME = {
  id: '1',
  title: 'Resident Evil 4',
  platform: 'PlayStation 2',
  developer: 'Capcom',
  publisher: 'Capcom',
  release_date: '2005-01-11',
  description: "Leon S. Kennedy is sent on a mission to rescue the U.S. President's daughter...",
  avg_rating: 4.7,
  reviews_count: 128,
  progress: 75,
  status: 'playing',
};

export function GameDetail({ id }: { id: string }) {
  const router = useRouter();

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <ScreenHeader title="" showBack />

      <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.coverWrap}>
        <View style={styles.cover}>
          <Text style={styles.coverEmoji}>🎮</Text>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.info}>
        <Text style={styles.title}>{MOCK_GAME.title}</Text>
        <Text style={styles.platform}>{MOCK_GAME.platform}</Text>

        <View style={styles.ratingRow}>
          <Text style={styles.rating}>★ {MOCK_GAME.avg_rating}</Text>
          <Text style={styles.reviewsCount}>{MOCK_GAME.reviews_count} reviews</Text>
        </View>

        <Text style={styles.meta}>
          {MOCK_GAME.developer} · {MOCK_GAME.publisher} · {MOCK_GAME.release_date}
        </Text>

        <Text style={styles.description}>{MOCK_GAME.description}</Text>
      </Animated.View>

      <Animated.View entering={FadeInRight.delay(300).springify()}>
        <Pressable style={styles.addButton}>
          <Text style={styles.addButtonText}>+ Add to Library</Text>
        </Pressable>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(400).springify()} style={styles.progressSection}>
        <Text style={styles.sectionTitle}>Your Progress</Text>
        <ProgressBar progress={MOCK_GAME.progress} showLabel label={`${MOCK_GAME.progress}% · ${MOCK_GAME.status}`} />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(500).springify()}>
        <Pressable
          style={styles.reviewsLink}
          onPress={() => router.push(`/game/${id}/reviews`)}
        >
          <Text style={styles.sectionTitle}>Reviews</Text>
          <Text style={styles.arrow}>›</Text>
        </Pressable>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg.deep },
  coverWrap: { alignItems: 'center', paddingVertical: 16 },
  cover: {
    width: 180,
    height: 240,
    backgroundColor: theme.bg.surface,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.border.subtle,
  },
  coverEmoji: { fontSize: 56, opacity: 0.4 },
  info: { paddingHorizontal: 16 },
  title: { color: theme.text.primary, fontSize: 22, fontWeight: '700' },
  platform: { color: theme.text.muted, fontSize: 14, marginTop: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 10 },
  rating: { color: theme.accent.warm, fontSize: 15, fontWeight: '700' },
  reviewsCount: { color: theme.text.muted, fontSize: 13 },
  meta: { color: theme.text.muted, fontSize: 12, marginTop: 8 },
  description: { color: theme.text.secondary, fontSize: 13, lineHeight: 19, marginTop: 12 },
  addButton: {
    backgroundColor: theme.accent.warm,
    marginHorizontal: 16,
    marginTop: 18,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  addButtonText: { color: theme.bg.deep, fontSize: 14, fontWeight: '700' },
  progressSection: { marginTop: 20, paddingHorizontal: 16 },
  sectionTitle: { color: theme.text.primary, fontSize: 16, fontWeight: '700' },
  reviewsLink: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 16,
  },
  arrow: { color: theme.text.muted, fontSize: 22 },
});
