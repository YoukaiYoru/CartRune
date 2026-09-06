import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/screen-header';
import { ReviewCard } from '@/components/review-card';

const MOCK_REVIEWS = [
  {
    id: '1',
    username: 'gamer42',
    rating: 5,
    title: 'Masterpiece',
    content: 'One of the best games ever made. The controls are tight and the atmosphere is incredible.',
    created_at: '2025-01-15',
  },
  {
    id: '2',
    username: 'retrofan',
    rating: 4,
    title: 'Great but dated',
    content: 'Still a fantastic game but the camera can be frustrating at times.',
    created_at: '2025-01-10',
  },
  {
    id: '3',
    username: 'horrorlover',
    rating: 5,
    title: 'Perfect survival horror',
    content: 'The best in the series. The village section alone is worth the price of admission.',
    created_at: '2024-12-28',
  },
];

export function GameReviews({ id }: { id: string }) {
  const router = useRouter();

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

      <FlatList
        data={MOCK_REVIEWS}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <ReviewCard
            username={item.username}
            rating={item.rating}
            title={item.title}
            content={item.content}
            date={item.created_at}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  list: { paddingHorizontal: 16 },
});
