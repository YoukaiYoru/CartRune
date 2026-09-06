import { View, Text, StyleSheet, FlatList } from 'react-native';
import { theme } from '@/theme';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';

const MOCK_FEED = [
  { id: '1', username: 'gamer42', type: 'completed', game: 'Resident Evil 4', time: '2h ago' },
  { id: '2', username: 'retrofan', type: 'review', game: 'Zelda: Ocarina of Time', rating: 5, time: '5h ago' },
  { id: '3', username: 'horrorlover', type: 'added', game: 'Silent Hill 2', time: '1d ago' },
  { id: '4', username: 'gamer42', type: 'playing', game: 'Metroid Prime', progress: 45, time: '2d ago' },
];

const typeEmoji: Record<string, string> = {
  completed: '🏆',
  review: '📝',
  added: '📚',
  playing: '🎮',
};

export function Feed() {
  return (
    <View style={styles.container}>
      <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.header}>
        <Text style={styles.title}>Activity Feed</Text>
      </Animated.View>

      <FlatList
        data={MOCK_FEED}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInRight.delay(index * 60).springify()}>
            <View style={styles.feedItem}>
              <Text style={styles.emoji}>{typeEmoji[item.type] || '•'}</Text>
              <View style={styles.feedInfo}>
                <Text style={styles.feedText}>
                  <Text style={styles.feedUser}>{item.username}</Text>
                  {' '}
                  {item.type === 'completed' && 'completed'}
                  {item.type === 'review' && `reviewed (${'★'.repeat(item.rating || 0)})`}
                  {item.type === 'added' && 'added to library'}
                  {item.type === 'playing' && `is playing (${item.progress}%)`}
                  {' '}
                  <Text style={styles.feedGame}>{item.game}</Text>
                </Text>
                <Text style={styles.feedTime}>{item.time}</Text>
              </View>
            </View>
          </Animated.View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg.deep },
  header: { paddingTop: 60, paddingHorizontal: 16, paddingBottom: 12 },
  title: { color: theme.text.primary, fontSize: 24, fontWeight: '700' },
  list: { paddingHorizontal: 16 },
  feedItem: {
    flexDirection: 'row',
    backgroundColor: theme.bg.card,
    borderRadius: 10,
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
