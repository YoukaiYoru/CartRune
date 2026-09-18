import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { useFeed } from '@/hooks/useFeed';
import { theme } from '@/theme';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import type { FeedItem } from '@/services/types';

const typeEmoji: Record<string, string> = {
  completed: '🏆',
  review: '📝',
  added: '📚',
  playing: '🎮',
};

function typeLabel(type: string): string {
  switch (type) {
    case 'completed':
      return 'completed';
    case 'review':
      return 'reviewed';
    case 'added':
      return 'added to library';
    case 'playing':
      return 'is playing';
    default:
      return 'is active on';
  }
}

function formatTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMin = Math.floor((now - then) / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function Feed() {
  const { data, isLoading } = useFeed(1);
  const items = data ?? [];

  return (
    <View style={styles.container}>
      <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.header}>
        <Text style={styles.eyebrow}>COMMUNITY</Text>
        <Text style={styles.title}>What collectors are playing.</Text>
      </Animated.View>

      {isLoading ? (
        <ActivityIndicator color={theme.accent.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>No activity yet. Follow friends to see what they play!</Text>
          }
          renderItem={({ item, index }: { item: FeedItem; index: number }) => (
            <Animated.View entering={FadeInRight.delay(index * 60).springify()}>
              <View style={styles.feedItem}>
                <Text style={styles.emoji}>{typeEmoji[item.type] || '•'}</Text>
                <View style={styles.feedInfo}>
                  <Text style={styles.feedText}>
                    <Text style={styles.feedUser}>{item.username || 'someone'}</Text>{' '}
                    {typeLabel(item.type)}
                    {item.title ? (
                      <>
                        {' '}
                        <Text style={styles.feedGame}>{item.title}</Text>
                      </>
                    ) : null}
                  </Text>
                  <Text style={styles.feedTime}>{formatTime(item.created_at)}</Text>
                </View>
              </View>
            </Animated.View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg.deep },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16 },
  eyebrow: { color: theme.text.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginBottom: 8 },
  title: { color: theme.text.primary, fontSize: 28, lineHeight: 32, fontWeight: '700' },
  list: { paddingHorizontal: 20 },
  empty: { color: theme.text.muted, fontSize: 14, textAlign: 'center', marginTop: 60 },
  feedItem: {
    flexDirection: 'row',
    backgroundColor: theme.bg.card,
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: theme.border.subtle,
  },
  emoji: { fontSize: 20, marginRight: 10, marginTop: 2 },
  feedInfo: { flex: 1 },
  feedText: { color: theme.text.secondary, fontSize: 13, lineHeight: 19 },
  feedUser: { color: theme.text.primary, fontWeight: '600' },
  feedGame: { color: theme.accent.warm, fontWeight: '600' },
  feedTime: { color: theme.text.muted, fontSize: 11, marginTop: 4 },
});
