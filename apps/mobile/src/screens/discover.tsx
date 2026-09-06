import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  Pressable,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { theme } from '@/theme';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { useSearchGames } from '@/hooks/useGames';

export function Discover() {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data, isLoading } = useSearchGames(debounced);
  const results = data?.games ?? [];

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
          autoCapitalize="none"
          autoCorrect={false}
        />
      </Animated.View>

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            {isLoading ? (
              <ActivityIndicator color={theme.accent.primary} />
            ) : (
              <>
                <Text style={styles.emptyIcon}>🎮</Text>
                <Text style={styles.emptyText}>
                  {debounced ? 'No results found' : 'Start typing to search'}
                </Text>
              </>
            )}
          </View>
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInRight.delay(index * 60).springify()}>
            <Pressable
              style={styles.resultCard}
              onPress={() => router.push(`/game/${item.id}`)}
            >
              <View style={styles.cover}>
                {item.cover_url ? (
                  <Image source={{ uri: item.cover_url }} style={styles.coverImage} resizeMode="cover" />
                ) : (
                  <Text style={styles.coverEmoji}>🎮</Text>
                )}
              </View>
              <View style={styles.info}>
                <Text style={styles.resultTitle}>{item.title}</Text>
                <Text style={styles.resultPlatform}>{item.developer || item.publisher || 'Unknown developer'}</Text>
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
    overflow: 'hidden',
  },
  coverImage: { width: '100%', height: '100%', backgroundColor: theme.bg.surface },
  coverEmoji: { fontSize: 22, opacity: 0.5 },
  info: { marginLeft: 12, flex: 1 },
  resultTitle: { color: theme.text.primary, fontSize: 14, fontWeight: '600' },
  resultPlatform: { color: theme.text.muted, fontSize: 12, marginTop: 2 },
});