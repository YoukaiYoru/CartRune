import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/screen-header';
import { ProgressBar } from '@/components/progress-bar';
import { useGame } from '@/hooks/useGames';
import { usePrimaryLibrary, useAddGameToLibrary } from '@/hooks/useCollections';
import { theme } from '@/theme';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { resolveApiUrl } from '@/services/api';

export function GameDetail({ id }: { id: string }) {
  const router = useRouter();
  const { data: game, isLoading } = useGame(id);
  const { library } = usePrimaryLibrary();
  const addGame = useAddGameToLibrary(library?.id ?? '');

  if (isLoading || !game) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="" showBack />
        <ActivityIndicator color={theme.accent.primary} style={{ marginTop: 60 }} />
      </View>
    );
  }

  const primaryCover = game.covers.find((c) => c.primary) ?? game.covers[0];
  const platformNames = game.platforms.map((p) => p.name).join(', ');
  const libraryGame = library?.games.find((g) => g.game_id === game.id);
  const alreadyAdded = !!libraryGame;
  const releaseDate = game.release_date
    ? new Date(game.release_date).toLocaleDateString()
    : '';

  const handleAdd = () => {
    if (!library?.id) return;
    addGame.mutate({ game_id: game.id });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <ScreenHeader title="" showBack />

      <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.coverWrap}>
        <View style={styles.cover}>
          {primaryCover ? (
            <Image
              source={{ uri: resolveApiUrl(primaryCover.url) }}
              style={styles.coverImage}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <Text style={styles.coverEmoji}>🎮</Text>
          )}
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.info}>
        <Text style={styles.title}>{game.title}</Text>
        {platformNames ? <Text style={styles.platform}>{platformNames}</Text> : null}

        <View style={styles.ratingRow}>
          <Text style={styles.rating}>★ {game.avg_rating.toFixed(1)}</Text>
          <Text style={styles.reviewsCount}>{game.reviews_count} reviews</Text>
        </View>

        {releaseDate ? (
          <Text style={styles.meta}>
            {[game.developer, game.publisher, releaseDate].filter(Boolean).join(' · ')}
          </Text>
        ) : null}

        {game.description ? (
          <Text style={styles.description}>{game.description}</Text>
        ) : null}
      </Animated.View>

      <Animated.View entering={FadeInRight.delay(300).springify()}>
        {library?.id && (
          <Pressable
            style={[styles.addButton, alreadyAdded && styles.addButtonDisabled]}
            onPress={handleAdd}
            disabled={alreadyAdded || addGame.isPending}
          >
            <Text style={styles.addButtonText}>
              {alreadyAdded
                ? '✓ In Your Library'
                : addGame.isPending
                  ? 'Adding…'
                  : '+ Add to Library'}
            </Text>
          </Pressable>
        )}
      </Animated.View>

      {libraryGame && (
        <Animated.View entering={FadeInDown.delay(400).springify()} style={styles.progressSection}>
          <Text style={styles.sectionTitle}>Your Progress</Text>
          <ProgressBar
            progress={libraryGame.progress}
            showLabel
            label={`${libraryGame.progress}% · ${libraryGame.status}`}
          />
        </Animated.View>
      )}

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
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.border.subtle,
    overflow: 'hidden',
  },
  coverImage: { width: '100%', height: '100%', backgroundColor: theme.bg.surface },
  coverEmoji: { fontSize: 56, opacity: 0.4 },
  info: { paddingHorizontal: 16 },
  title: { color: theme.text.primary, fontSize: 32, lineHeight: 36, fontWeight: '700' },
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
    borderRadius: 999,
    alignItems: 'center',
  },
  addButtonDisabled: { backgroundColor: theme.accent.muted },
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
