import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/auth';
import { GameCard } from '@/components/game-card';
import { useGames } from '@/hooks/useGames';
import { useFeed } from '@/hooks/useFeed';
import { theme } from '@/theme';
import Animated, { FadeInDown, SlideInRight } from 'react-native-reanimated';
import type { Game } from '@/services/types';

export function Home() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { data, isLoading } = useGames(1);
  const recentGames = data?.games.slice(0, 5) ?? [];
  const { data: feed } = useFeed(1);
  const activity = feed ?? [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 24 }}>
      <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.header}>
        <Text style={styles.greeting}>Hey, {user?.username || 'Player'}</Text>
        <Text style={styles.subtitle}>What are you playing?</Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(200).springify()}>
        <Pressable
          style={styles.scanCard}
          onPress={() => router.push('/(tabs)/scanner')}
        >
          <View style={styles.scanIconWrap}>
            <Text style={styles.scanIcon}>📷</Text>
          </View>
          <View style={styles.scanTextWrap}>
            <Text style={styles.scanTitle}>SCAN A GAME</Text>
            <Text style={styles.scanDesc}>Point your camera at a game cover</Text>
          </View>
        </Pressable>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recently Added</Text>
          <Pressable onPress={() => router.push('/(tabs)/library')}>
            <Text style={styles.seeAll}>See all</Text>
          </Pressable>
        </View>
        {isLoading ? (
          <ActivityIndicator color={theme.accent.primary} style={{ marginVertical: 24 }} />
        ) : (
          <FlatList
            horizontal
            data={recentGames}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 16 }}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No games yet. Scan or discover some!</Text>
            }
            renderItem={({ item, index }) => (
              <Animated.View entering={SlideInRight.delay(400 + index * 80).springify()}>
                <View style={{ width: 130, marginLeft: 16 }}>
                  <GameCard
                    title={item.title}
                    platform={item.developer || ''}
                    coverUrl={item.cover_url}
                    size="small"
                    onPress={() => router.push(`/game/${item.id}`)}
                  />
                </View>
              </Animated.View>
            )}
          />
        )}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(500).springify()} style={styles.section}>
        <Text style={styles.sectionTitle}>Community</Text>
        {activity.length > 0 ? (
          activity.slice(0, 3).map((item) => (
            <View key={item.id} style={styles.activityRow}>
              <View style={styles.activityAvatar}>
                <Text style={styles.activityEmoji}>
                  {item.type === 'review' ? '⭐' : item.type === 'completed' ? '🏆' : '🎮'}
                </Text>
              </View>
              <View style={styles.activityInfo}>
                <Text style={styles.activityText}>
                  <Text style={styles.activityUser}>{item.username}</Text>{' '}
                  {activityText(item.type)}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <Pressable style={styles.communityCard}>
            <Text style={styles.communityEmoji}>👥</Text>
            <View style={styles.communityInfo}>
              <Text style={styles.communityTitle}>Find Friends</Text>
              <Text style={styles.communityText}>See what your friends are playing</Text>
            </View>
          </Pressable>
        )}
      </Animated.View>
    </ScrollView>
  );
}

function activityText(type: string): string {
  switch (type) {
    case 'review':
      return 'wrote a review';
    case 'completed':
      return 'completed a game';
    case 'added':
      return 'added a new game';
    case 'playing':
      return 'started playing';
    default:
      return 'is active';
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg.deep },
  header: { paddingTop: 60, paddingHorizontal: 16, paddingBottom: 20 },
  greeting: { color: theme.text.primary, fontSize: 24, fontWeight: '700' },
  subtitle: { color: theme.text.muted, fontSize: 14, marginTop: 4 },
  scanCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.bg.card,
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: theme.border.subtle,
  },
  scanIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: theme.bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanIcon: { fontSize: 22 },
  scanTextWrap: { flex: 1, marginLeft: 14 },
  scanTitle: { color: theme.text.primary, fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },
  scanDesc: { color: theme.text.muted, fontSize: 12, marginTop: 2 },
  section: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  sectionTitle: {
    color: theme.text.primary,
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  seeAll: { color: theme.accent.warm, fontSize: 13, fontWeight: '500' },
  emptyText: { color: theme.text.muted, fontSize: 13, paddingHorizontal: 16 },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.bg.card,
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.border.subtle,
  },
  activityAvatar: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: theme.bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityEmoji: { fontSize: 16 },
  activityInfo: { flex: 1, marginLeft: 12 },
  activityText: { color: theme.text.secondary, fontSize: 13 },
  activityUser: { color: theme.text.primary, fontWeight: '600' },
  communityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.bg.card,
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border.subtle,
  },
  communityEmoji: { fontSize: 26 },
  communityInfo: { flex: 1, marginLeft: 12 },
  communityTitle: { color: theme.text.primary, fontSize: 14, fontWeight: '600' },
  communityText: { color: theme.text.muted, fontSize: 12, marginTop: 2 },
});