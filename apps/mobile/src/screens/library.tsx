import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { theme } from '@/theme';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { usePrimaryLibrary } from '@/hooks/useCollections';
import { useAuthStore } from '@/store/auth';
import type { LibraryGame } from '@/services/types';
import { resolveApiUrl } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const FILTERS = ['All', 'Playing', 'Completed', 'Backlog'];

function ShelfGameCard({
  item,
  index,
  onPress,
}: {
  item: LibraryGame;
  index: number;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const translateY = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: translateY.value },
    ],
  }));

  const onPressIn = () => {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 400 });
    translateY.value = withSpring(-3, { damping: 15, stiffness: 400 });
  };

  const onPressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
    translateY.value = withSpring(0, { damping: 15, stiffness: 400 });
  };

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).springify()}>
      <AnimatedPressable
        style={[styles.gameCase, animatedStyle]}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={onPress}
      >
        <View style={styles.gameCover}>
          {item.cover_url ? (
            <Image
              source={{ uri: resolveApiUrl(item.cover_url) }}
              style={styles.coverImage}
              contentFit="contain"
              transition={150}
            />
          ) : (
            <Text style={styles.gameEmoji}>🎮</Text>
          )}
        </View>
        <View style={styles.spine} />
        <View style={styles.gameInfo}>
          <Text style={styles.gameTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.gamePlatform}>{item.platform}</Text>
          {item.progress > 0 && (
            <View style={styles.miniProgress}>
              <View style={[styles.miniProgressFill, { width: `${item.progress}%` }]} />
            </View>
          )}
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

export function Library() {
  const [activeFilter, setActiveFilter] = useState('All');
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { library, isLoading } = usePrimaryLibrary();

  const allGames = library?.games ?? [];
  const filtered =
    activeFilter === 'All'
      ? allGames
      : allGames.filter((g) => g.status === activeFilter.toLowerCase());

  const renderItem = useCallback(
    ({ item, index }: { item: LibraryGame; index: number }) => (
      <ShelfGameCard
        item={item}
        index={index}
        onPress={() => router.push(`/game/${item.game_id}`)}
      />
    ),
    [router]
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}><View><Text style={styles.eyebrow}>PLAYER LIBRARY</Text><Text style={styles.title}>{library?.name || 'My Shelf'}</Text></View><View style={styles.shelfMark}><Ionicons name="library" size={19} color={theme.accent.primary} /></View></View>
        <Text style={styles.count}>
          {isLoading ? 'Loading…' : `${allGames.length} physical games · keep collecting`}
        </Text>
      </View>

      <FlatList
        horizontal
        data={FILTERS}
        keyExtractor={(item) => item}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.filter, activeFilter === item && styles.filterActive]}
            onPress={() => setActiveFilter(item)}
          >
            <Text style={[styles.filterText, activeFilter === item && styles.filterTextActive]}>
              {item}
            </Text>
          </Pressable>
        )}
      />

      <View style={styles.shelfWrapper}>
        {isLoading ? (
          <ActivityIndicator color={theme.accent.primary} style={{ marginVertical: 32 }} />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.game_id}
            numColumns={2}
            columnWrapperStyle={styles.shelfRow}
            contentContainerStyle={styles.shelfContent}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="library-outline" size={25} color={theme.accent.primary} />
                </View>
                <Text style={styles.emptyTitle}>Your shelf is waiting</Text>
                <Text style={styles.emptyText}>
                  {user?.username
                    ? 'Scan a cover or discover a game to start collecting.'
                    : 'Create a library to get started.'}
                </Text>
                <Pressable
                  style={styles.emptyButton}
                  onPress={() => router.push('/(tabs)/scanner')}
                  accessibilityRole="button"
                  accessibilityLabel="Scan a game to add it to your shelf"
                >
                  <Ionicons name="scan-outline" size={16} color={theme.bg.deep} />
                  <Text style={styles.emptyButtonText}>Scan a game</Text>
                </Pressable>
              </View>
            }
            renderItem={renderItem}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg.deep },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 7 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  shelfMark: { width: 42, height: 42, borderRadius: 15, backgroundColor: theme.bg.card, borderWidth: 1, borderColor: theme.border.subtle, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: theme.accent.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 7 },
  title: { color: theme.text.primary, fontSize: 30, fontWeight: '800' },
  count: { color: theme.text.muted, fontSize: 12, marginTop: 5 },
  filters: { paddingHorizontal: 20, paddingVertical: 14, gap: 8 },
  filter: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: theme.bg.panel,
    marginRight: 8,
    borderWidth: 1,
    borderColor: theme.border.subtle,
  },
  filterActive: {
    backgroundColor: theme.accent.primary,
    borderColor: theme.accent.primary,
  },
  filterText: { color: theme.text.muted, fontSize: 12, fontWeight: '600' },
  filterTextActive: { color: theme.bg.deep },
  shelfWrapper: { flex: 1 },
  shelfContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
  },
  shelfRow: { justifyContent: 'space-between', marginBottom: 16 },
  gameCase: {
    width: '48%',
    marginBottom: 4,
  },
  gameCover: {
    width: '100%',
    aspectRatio: 0.7,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    backgroundColor: theme.bg.surface,
  },
  coverImage: { width: '100%', height: '100%', backgroundColor: theme.bg.surface },
  gameEmoji: { fontSize: 32, opacity: 0.6 },
  spine: {
    height: 3,
    backgroundColor: theme.shelf.edge,
    marginHorizontal: 2,
    borderRadius: 1,
  },
  gameInfo: {
    paddingHorizontal: 2,
    paddingTop: 4,
  },
  gameTitle: { color: theme.text.primary, fontSize: 11, fontWeight: '600', lineHeight: 15 },
  gamePlatform: { color: theme.text.muted, fontSize: 10, marginTop: 2 },
  miniProgress: {
    height: 2,
    backgroundColor: theme.bg.elevated,
    borderRadius: 1,
    marginTop: 4,
    overflow: 'hidden',
  },
  miniProgressFill: { height: '100%', backgroundColor: theme.accent.muted, borderRadius: 1 },
  emptyState: { alignItems: 'center', marginHorizontal: 20, marginTop: 28, padding: 24, borderRadius: 22, backgroundColor: theme.bg.card, borderWidth: 1, borderColor: theme.border.subtle },
  emptyIcon: { width: 52, height: 52, borderRadius: 17, backgroundColor: theme.bg.elevated, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { color: theme.text.primary, fontSize: 17, fontWeight: '800' },
  emptyText: { color: theme.text.muted, fontSize: 13, lineHeight: 19, textAlign: 'center', paddingHorizontal: 8, paddingTop: 6 },
  emptyButton: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 16, backgroundColor: theme.accent.primary, borderRadius: 12, paddingHorizontal: 15, paddingVertical: 11 },
  emptyButtonText: { color: theme.bg.deep, fontSize: 13, fontWeight: '800' },
});
