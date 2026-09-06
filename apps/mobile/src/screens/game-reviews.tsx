import { View, Text, ActivityIndicator, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/screen-header';
import { ReviewCard } from '@/components/review-card';
import { useGameReviews } from '@/hooks/useGames';
import { theme } from '@/theme';
import type { Review } from '@/services/types';

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}

export function GameReviews({ id }: { id: string }) {
  const router = useRouter();
  const { data, isLoading } = useGameReviews(id);
  const reviews = data?.reviews ?? [];

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Reviews"
        showBack
        rightAction={{
          label: 'Write',
          onPress: () => router.push({ pathname: '/review/new', params: { gameId: id } }),
        }}
      />

      {isLoading ? (
        <ActivityIndicator color={theme.accent.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={reviews}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>No reviews yet. Be the first to write one!</Text>
          }
          renderItem={({ item }: { item: Review }) => (
            <ReviewCard
              username={item.username ?? 'unknown'}
              rating={item.rating}
              title={item.title}
              content={item.content}
              date={formatDate(item.created_at)}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  list: { paddingHorizontal: 16 },
  empty: { color: theme.text.muted, fontSize: 14, textAlign: 'center', marginTop: 60 },
});