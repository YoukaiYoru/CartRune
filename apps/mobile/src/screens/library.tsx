import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { theme } from '@/theme';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const FILTERS = ['All', 'Playing', 'Completed', 'Backlog'];

const MOCK_GAMES = [
  { id: '1', title: 'Resident Evil 4', platform: 'PS2', status: 'completed', progress: 100, color: '#3a4a3a' },
  { id: '2', title: 'Zelda: Twilight Princess', platform: 'GameCube', status: 'playing', progress: 75, color: '#3a3a4a' },
  { id: '3', title: 'Shadow of the Colossus', platform: 'PS2', status: 'playing', progress: 30, color: '#4a3a3a' },
  { id: '4', title: 'Metroid Prime', platform: 'GameCube', status: 'backlog', progress: 0, color: '#3a3a38' },
  { id: '5', title: 'Final Fantasy X', platform: 'PS2', status: 'completed', progress: 100, color: '#383a4a' },
  { id: '6', title: 'God of War', platform: 'PS2', status: 'playing', progress: 50, color: '#4a3838' },
];

function ShelfGameCard({
  item,
  index,
  onPress,
}: {
  item: (typeof MOCK_GAMES)[0];
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
        <View style={[styles.gameCover, { backgroundColor: item.color }]}>
          <Text style={styles.gameEmoji}>🎮</Text>
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

import {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

export function Library() {
  const [activeFilter, setActiveFilter] = useState('All');
  const router = useRouter();

  const filtered =
    activeFilter === 'All'
      ? MOCK_GAMES
      : MOCK_GAMES.filter((g) => g.status === activeFilter.toLowerCase());

  const renderItem = useCallback(
    ({ item, index }: { item: (typeof MOCK_GAMES)[0]; index: number }) => (
      <ShelfGameCard
        item={item}
        index={index}
        onPress={() => router.push(`/game/${item.id}`)}
      />
    ),
    [router]
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Shelf</Text>
        <Text style={styles.count}>{MOCK_GAMES.length} games</Text>
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
        <View style={styles.shelfPlank} />
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.shelfRow}
          contentContainerStyle={styles.shelfContent}
          renderItem={renderItem}
        />
        <View style={styles.shelfBottom}>
          <View style={styles.shelfLip} />
        </View>
      </View>
    </View>
  );
}

import {
  useSharedValue as useSharedValue2,
  useAnimatedStyle as useAnimatedStyle2,
  withSpring as withSpring2,
} from 'react-native-reanimated';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg.deep },
  header: { paddingTop: 60, paddingHorizontal: 16, paddingBottom: 4 },
  title: { color: theme.text.primary, fontSize: 24, fontWeight: '700' },
  count: { color: theme.text.muted, fontSize: 13, marginTop: 2 },
  filters: { paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
  filter: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: theme.bg.card,
    marginRight: 8,
    borderWidth: 1,
    borderColor: theme.border.subtle,
  },
  filterActive: {
    backgroundColor: theme.bg.elevated,
    borderColor: theme.accent.warm,
  },
  filterText: { color: theme.text.muted, fontSize: 12, fontWeight: '600' },
  filterTextActive: { color: theme.accent.warm },
  shelfWrapper: { flex: 1 },
  shelfPlank: {
    height: 6,
    backgroundColor: theme.shelf.top,
    marginHorizontal: 12,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  shelfContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
  },
  shelfRow: { justifyContent: 'space-between', marginBottom: 16 },
  shelfBottom: {
    backgroundColor: theme.shelf.face,
    marginHorizontal: 8,
    height: 14,
    borderTopWidth: 1,
    borderTopColor: theme.shelf.top,
    borderBottomWidth: 3,
    borderBottomColor: theme.shelf.shadow,
    borderLeftWidth: 2,
    borderLeftColor: theme.shelf.edge,
    borderRightWidth: 2,
    borderRightColor: theme.shelf.edge,
  },
  shelfLip: {
    flex: 1,
    backgroundColor: theme.shelf.edge,
    marginHorizontal: -2,
  },
  gameCase: {
    width: '48%',
    marginBottom: 4,
  },
  gameCover: {
    width: '100%',
    aspectRatio: 0.7,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
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
});
