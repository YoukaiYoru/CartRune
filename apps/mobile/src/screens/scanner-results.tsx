import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/screen-header';
import { theme } from '@/theme';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';

interface MatchResult {
  game_id: string;
  title: string;
  platform: string;
  region: string;
  similarity: number;
}

const MOCK_MATCHES: MatchResult[] = [
  { game_id: '1', title: 'Resident Evil 4', platform: 'PlayStation 2', region: 'USA', similarity: 0.94 },
  { game_id: '2', title: 'Resident Evil 4', platform: 'Nintendo GameCube', region: 'USA', similarity: 0.89 },
  { game_id: '3', title: 'Resident Evil 4', platform: 'PlayStation 2', region: 'Europe', similarity: 0.82 },
];

const methodLabel: Record<string, string> = {
  barcode: 'Barcode Scan',
  text: 'Text / OCR',
  embedding: 'Visual Match',
};

export function ScannerResults({ method }: { method: string }) {
  const router = useRouter();
  const [isLoading] = useState(false);

  return (
    <View style={styles.container}>
      <ScreenHeader title={`${methodLabel[method || 'embedding']} Results`} showBack />

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={theme.accent.warm} />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      ) : (
        <>
          <Text style={styles.resultCount}>
            {MOCK_MATCHES.length} possible matches
          </Text>
          <FlatList
            data={MOCK_MATCHES}
            keyExtractor={(item) => item.game_id}
            contentContainerStyle={styles.list}
            renderItem={({ item, index }) => (
              <Animated.View entering={FadeInRight.delay(index * 80).springify()}>
                <Pressable
                  style={styles.matchCard}
                  onPress={() => router.push(`/game/${item.game_id}`)}
                >
                  <View style={styles.coverPlaceholder}>
                    <Text style={styles.coverText}>🎮</Text>
                  </View>
                  <View style={styles.matchInfo}>
                    <Text style={styles.matchTitle}>{item.title}</Text>
                    <Text style={styles.matchPlatform}>{item.platform}</Text>
                    <Text style={styles.matchRegion}>{item.region}</Text>
                  </View>
                  <View style={styles.matchScore}>
                    <Text style={styles.scoreText}>{Math.round(item.similarity * 100)}%</Text>
                    <Text style={styles.scoreLabel}>match</Text>
                  </View>
                </Pressable>
              </Animated.View>
            )}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg.deep },
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
  coverText: { fontSize: 26, opacity: 0.4 },
  matchInfo: { flex: 1, marginLeft: 12 },
  matchTitle: { color: theme.text.primary, fontSize: 14, fontWeight: '600' },
  matchPlatform: { color: theme.text.secondary, fontSize: 12, marginTop: 2 },
  matchRegion: { color: theme.text.muted, fontSize: 11, marginTop: 1 },
  matchScore: { alignItems: 'center' },
  scoreText: { color: theme.accent.warm, fontSize: 18, fontWeight: '700' },
  scoreLabel: { color: theme.text.muted, fontSize: 10 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: theme.text.muted, fontSize: 13, marginTop: 12 },
});
