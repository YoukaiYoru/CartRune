import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import type { MatchResult } from '@/services/types';
import { usePrimaryLibrary, useAddGameToLibrary } from '@/hooks/useCollections';
import { theme } from '@/theme';
import { resolveApiUrl } from '@/services/api';

interface Props {
  item: MatchResult;
  defaultStatus?: string;
}

export function MatchCard({ item, defaultStatus = 'backlog' }: Props) {
  const router = useRouter();
  const { library, isLoading } = usePrimaryLibrary();
  const [added, setAdded] = useState(false);

  const alreadyOwned = library?.games?.some((g) => g.game_id === item.game_id) || false;

  const addGame = useAddGameToLibrary(library?.id || '');
  const disabled = addGame.isPending || added || alreadyOwned || !library?.id || isLoading;

  const handleAdd = () => {
    if (!library?.id || added || alreadyOwned) return;
    addGame.mutate(
      { game_id: item.game_id, release_id: item.release_id, status: defaultStatus },
      { onSuccess: () => setAdded(true) }
    );
  };

  return (
    <View style={styles.card}>
      <Pressable
        style={styles.row}
        onPress={() => router.push(`/game/${item.game_id}`)}
      >
        {item.cover_url ? (
          <Image source={{ uri: resolveApiUrl(item.cover_url) }} style={styles.cover} />
        ) : (
          <View style={styles.coverPlaceholder}>
            <Text style={styles.coverText}>🎮</Text>
          </View>
        )}
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={2}>
            {item.title}
          </Text>
          {item.platform ? <Text style={styles.platform}>{item.platform}</Text> : null}
          {item.region ? <Text style={styles.region}>{item.region}</Text> : null}
        </View>
        {typeof item.similarity === 'number' && item.similarity > 0 ? (
          <View style={styles.score}>
            <Text style={styles.scoreText}>{Math.round(item.similarity * 100)}%</Text>
            <Text style={styles.scoreLabel}>match</Text>
          </View>
        ) : null}
      </Pressable>

      {library ? (
        <Pressable
          style={[styles.addButton, (disabled && styles.addButtonDone)]}
          onPress={handleAdd}
          disabled={disabled}
        >
          {addGame.isPending ? (
            <ActivityIndicator size="small" color={theme.bg.deep} />
          ) : added || alreadyOwned ? (
            <Text style={styles.addButtonText}>✓ In shelf</Text>
          ) : (
            <Text style={styles.addButtonText}>Add to shelf</Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.bg.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.border.subtle,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  coverPlaceholder: {
    width: 60,
    height: 78,
    backgroundColor: theme.bg.surface,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cover: { width: 60, height: 78, borderRadius: 6, backgroundColor: theme.bg.surface },
  coverText: { fontSize: 26, opacity: 0.4 },
  info: { flex: 1, marginLeft: 12, marginRight: 8 },
  title: { color: theme.text.primary, fontSize: 14, fontWeight: '600' },
  platform: { color: theme.text.secondary, fontSize: 12, marginTop: 2 },
  region: { color: theme.text.muted, fontSize: 11, marginTop: 1 },
  score: { alignItems: 'center' },
  scoreText: { color: theme.accent.warm, fontSize: 18, fontWeight: '700' },
  scoreLabel: { color: theme.text.muted, fontSize: 10 },
  addButton: {
    marginTop: 10,
    backgroundColor: theme.accent.warm,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
  },
  addButtonDone: { backgroundColor: theme.bg.surface },
  addButtonText: { color: theme.text.primary, fontSize: 13, fontWeight: '700' },
});
