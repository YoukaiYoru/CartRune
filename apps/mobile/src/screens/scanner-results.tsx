import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { scanBarcode, scanText } from '@/services/scanner';
import type { MatchResult } from '@/services/types';
import { Image } from 'expo-image';
import { ScreenHeader } from '@/components/screen-header';
import { theme } from '@/theme';

const methodLabel: Record<string, string> = {
  barcode: 'Barcode Scan',
  text: 'Text / OCR',
  embedding: 'Visual Match',
};

export function ScannerResults() {
  const router = useRouter();
  const { method, value, photo } = useLocalSearchParams<{
    method: string;
    value?: string;
    photo?: string;
    type?: string;
  }>();

  const scanFn =
    method === 'barcode' && value
      ? () => scanBarcode(value)
      : method === 'text' && value
        ? () => scanText(value)
        : null;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['scanner', method, value ?? photo],
    queryFn: scanFn!,
    enabled: !!scanFn,
    retry: 1,
  });

  const results = data?.matches ?? [];
  const methodKey = method ?? 'barcode';

  const renderState = () => {
    if (isLoading) {
      return (
        <View style={styles.stateWrap}>
          <ActivityIndicator size="large" color={theme.accent.warm} />
          <Text style={styles.stateText}>Searching your shelf...</Text>
        </View>
      );
    }

    if (isError) {
      return (
        <View style={styles.stateWrap}>
          <Text style={styles.stateIcon}>🛰️</Text>
          <Text style={styles.stateTitle}>Connection error</Text>
          <Text style={styles.stateText}>Could not reach the server.</Text>
          <Pressable style={styles.tryAgain} onPress={() => refetch()}>
            <Text style={styles.tryAgainText}>Try again</Text>
          </Pressable>
        </View>
      );
    }

    if (method === 'embedding') {
      return (
        <View style={styles.stateWrap}>
          <Text style={styles.stateIcon}>🧠</Text>
          <Text style={styles.stateTitle}>Visual matching is coming</Text>
          <Text style={styles.stateText}>
            AI cover recognition is being wired up. Check back soon.
          </Text>
        </View>
      );
    }

    if (method === 'text' && !value) {
      return (
        <View style={styles.stateWrap}>
          <Text style={styles.stateIcon}>🔤</Text>
          <Text style={styles.stateTitle}>Extracting text...</Text>
          <Text style={styles.stateText}>
            Cover {photo ? 'captured. OCR will read the title next.' : 'capture the cover first.'}
          </Text>
        </View>
      );
    }

    if (results.length === 0) {
      return (
        <View style={styles.stateWrap}>
          <Text style={styles.stateIcon}>🔍</Text>
          <Text style={styles.stateTitle}>No matches found</Text>
          <Text style={styles.stateText}>
            Nothing in your catalog matches this {methodKey === 'barcode' ? 'barcode' : 'search'}.
          </Text>
        </View>
      );
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title={`${methodLabel[methodKey]} Results`} showBack />

      {photo && (
        <View style={styles.photoWrap}>
          <Image source={{ uri: photo }} style={styles.photoPreview} />
        </View>
      )}

      {isLoading || isError || (method === 'embedding') || (method === 'text' && !value) || results.length === 0 ? (
        <View style={styles.bodyWrap}>{renderState()}</View>
      ) : (
        <>
          <Text style={styles.resultCount}>
            {results.length} {results.length === 1 ? 'match' : 'matches'} in your shelf
          </Text>
          <FlatList
            data={results}
            keyExtractor={(item) => item.game_id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <MatchRow item={item} onPress={() => router.push(`/game/${item.game_id}`)} />
            )}
          />
        </>
      )}
    </View>
  );
}

function MatchRow({ item, onPress }: { item: MatchResult; onPress: () => void }) {
  return (
    <Pressable style={styles.matchCard} onPress={onPress}>
      {item.cover_url ? (
        <Image source={{ uri: item.cover_url }} style={styles.coverImage} />
      ) : (
        <View style={styles.coverPlaceholder}>
          <Text style={styles.coverText}>🎮</Text>
        </View>
      )}
      <View style={styles.matchInfo}>
        <Text style={styles.matchTitle} numberOfLines={2}>
          {item.title}
        </Text>
        {item.platform ? <Text style={styles.matchPlatform}>{item.platform}</Text> : null}
        {item.region ? <Text style={styles.matchRegion}>{item.region}</Text> : null}
      </View>
      {typeof item.similarity === 'number' && item.similarity > 0 ? (
        <View style={styles.matchScore}>
          <Text style={styles.scoreText}>{Math.round(item.similarity * 100)}%</Text>
          <Text style={styles.scoreLabel}>match</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg.deep },
  bodyWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  photoWrap: { alignItems: 'center', paddingTop: 12 },
  photoPreview: { width: 96, height: 126, borderRadius: 8, backgroundColor: theme.bg.card },
  resultCount: { color: theme.text.muted, fontSize: 13, paddingHorizontal: 16, marginBottom: 10 },
  list: { paddingHorizontal: 16 },
  matchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.bg.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.border.subtle,
  },
  coverPlaceholder: {
    width: 60,
    height: 78,
    backgroundColor: theme.bg.surface,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverImage: { width: 60, height: 78, borderRadius: 6, backgroundColor: theme.bg.surface },
  coverText: { fontSize: 26, opacity: 0.4 },
  matchInfo: { flex: 1, marginLeft: 12 },
  matchTitle: { color: theme.text.primary, fontSize: 14, fontWeight: '600' },
  matchPlatform: { color: theme.text.secondary, fontSize: 12, marginTop: 2 },
  matchRegion: { color: theme.text.muted, fontSize: 11, marginTop: 1 },
  matchScore: { alignItems: 'center' },
  scoreText: { color: theme.accent.warm, fontSize: 18, fontWeight: '700' },
  scoreLabel: { color: theme.text.muted, fontSize: 10 },
  stateWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 32 },
  stateIcon: { fontSize: 40, marginBottom: 10, opacity: 0.7 },
  stateTitle: { color: theme.text.primary, fontSize: 16, fontWeight: '700' },
  stateText: { color: theme.text.muted, fontSize: 13, marginTop: 6, textAlign: 'center' },
  tryAgain: {
    marginTop: 16,
    backgroundColor: theme.accent.warm,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tryAgainText: { color: theme.bg.deep, fontWeight: '700', fontSize: 14 },
});