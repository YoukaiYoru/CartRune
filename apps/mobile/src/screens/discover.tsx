import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { theme } from '@/theme';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';

const MOCK_RESULTS = [
  { id: '1', title: 'The Legend of Zelda: Ocarina of Time', platform: 'Nintendo 64' },
  { id: '2', title: "The Legend of Zelda: Majora's Mask", platform: 'Nintendo 64' },
  { id: '3', title: 'The Legend of Zelda: Twilight Princess', platform: 'GameCube' },
  { id: '4', title: 'The Legend of Zelda: Wind Waker', platform: 'GameCube' },
];

export function Discover() {
  const [query, setQuery] = useState('');
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.header}>
        <Text style={styles.title}>Discover</Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search games..."
          placeholderTextColor={theme.text.muted}
          value={query}
          onChangeText={setQuery}
        />
      </Animated.View>

      <FlatList
        data={query ? MOCK_RESULTS : []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🎮</Text>
            <Text style={styles.emptyText}>
              {query ? 'No results found' : 'Start typing to search'}
            </Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInRight.delay(index * 60).springify()}>
            <Pressable
              style={styles.resultCard}
              onPress={() => router.push(`/game/${item.id}`)}
            >
              <View style={styles.cover}>
                <Text style={styles.coverEmoji}>🎮</Text>
              </View>
              <View style={styles.info}>
                <Text style={styles.resultTitle}>{item.title}</Text>
                <Text style={styles.resultPlatform}>{item.platform}</Text>
              </View>
            </Pressable>
          </Animated.View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg.deep },
  header: { paddingTop: 60, paddingHorizontal: 16, paddingBottom: 8 },
  title: { color: theme.text.primary, fontSize: 24, fontWeight: '700' },
  searchWrap: { paddingHorizontal: 16, marginBottom: 8 },
  searchInput: {
    backgroundColor: theme.bg.card,
    borderRadius: 10,
    padding: 12,
    color: theme.text.primary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: theme.border.subtle,
  },
  list: { paddingHorizontal: 16 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 40, marginBottom: 12, opacity: 0.5 },
  emptyText: { color: theme.text.muted, fontSize: 14 },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.bg.card,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.border.subtle,
  },
  cover: {
    width: 50,
    height: 66,
    backgroundColor: theme.bg.surface,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverEmoji: { fontSize: 22, opacity: 0.5 },
  info: { marginLeft: 12, flex: 1 },
  resultTitle: { color: theme.text.primary, fontSize: 14, fontWeight: '600' },
  resultPlatform: { color: theme.text.muted, fontSize: 12, marginTop: 2 },
});
