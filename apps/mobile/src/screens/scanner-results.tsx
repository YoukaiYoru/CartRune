import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { scanBarcode, scanText, matchEmbedding } from '@/services/scanner';
import { getEmbedding } from '@/lib/embedding-cache';
import { Image } from 'expo-image';
import { MatchCard } from '@/components/match-card';
import {
  useScreenScraperSearch,
  useImportScreenScraperGame,
  useScreenScraperMediaForTitle,
} from '@/hooks/useScreenscraper';
import { MediaGallery } from '@/components/media-gallery';
import { ScreenHeader } from '@/components/screen-header';
import { theme } from '@/theme';
import type { ScanResponse } from '@/services/types';

const methodLabel: Record<string, string> = {
  barcode: 'Barcode Scan',
  text: 'Text / OCR',
  embedding: 'Visual Match',
};

export function ScannerResults() {
  const router = useRouter();
  const [isImportMode, setIsImportMode] = useState(false);
  const { method, value, photo, failed } = useLocalSearchParams<{
    method: string;
    value?: string;
    photo?: string;
    type?: string;
    failed?: string;
  }>();

  const embedding = photo ? getEmbedding(photo) : undefined;

  const scanFn =
    method === 'barcode' && value
      ? () => scanBarcode(value)
      : method === 'text' && value
        ? () => scanText(value)
        : method === 'embedding' && embedding
          ? () => matchEmbedding(embedding)
          : null;

  const noopFn: () => Promise<ScanResponse> = async () => ({
    matches: [],
    method: 'none',
  });
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['scanner', method, value ?? photo],
    queryFn: scanFn ?? noopFn,
    enabled: !!scanFn,
    retry: 1,
  });

  const results = data?.matches ?? [];
  const methodKey = method ?? 'barcode';

  // Auto-resolve ScreenScraper media for the top detected title so a gallery
  // (covers, screenshots, logos, videos) shows right after a successful scan.
  const autoTitle = results[0]?.title || (method === 'text' ? value : undefined) || null;
  const { data: mediaDetail, isLoading: mediaLoading } = useScreenScraperMediaForTitle(
    autoTitle,
    !!data && autoTitle !== null
  );

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

    if (failed === '1') {
      return (
        <View style={styles.stateWrap}>
          <Text style={styles.stateIcon}>🧠</Text>
          <Text style={styles.stateTitle}>Could not analyze the cover</Text>
          <Text style={styles.stateText}>
            The embedding service is offline. Try again from the scanner.
          </Text>
        </View>
      );
    }

    if (method === 'embedding' && !embedding) {
      return (
        <View style={styles.stateWrap}>
          <Text style={styles.stateIcon}>🧠</Text>
          <Text style={styles.stateTitle}>Analyzing cover...</Text>
          <Text style={styles.stateText}>
            Embedding not ready. Capture the cover again.
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

    if (results.length === 0 && !isImportMode) {
      const fallback = (
        <View style={styles.fallbackRow}>
          <Pressable
            style={styles.fallbackBtn}
            onPress={() => router.push({ pathname: '/(tabs)/scanner', params: { preset: 'text' } })}
          >
            <Text style={styles.fallbackBtnText}>🔤 OCR</Text>
          </Pressable>
          <Pressable
            style={styles.fallbackBtn}
            onPress={() => router.push({ pathname: '/(tabs)/scanner', params: { preset: 'embedding' } })}
          >
            <Text style={styles.fallbackBtnText}>🧠 Visual</Text>
          </Pressable>
          <Pressable
            style={styles.fallbackBtn}
            onPress={() => setIsImportMode(true)}
          >
            <Text style={styles.fallbackBtnText}>🗄️ Import</Text>
          </Pressable>
        </View>
      );
      return (
        <View style={styles.stateWrap}>
          <Text style={styles.stateIcon}>🔍</Text>
          <Text style={styles.stateTitle}>No local matches</Text>
          <Text style={styles.stateText}>
            {`No ${methodKey === 'barcode' ? 'game with that barcode' : 'match'} in your catalog.`}
          </Text>
          {fallback}
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

      {isLoading || isError || (method === 'text' && !value) || (method === 'embedding' && !embedding) || failed === '1' ? (
        <View style={styles.bodyWrap}>{renderState()}</View>
      ) : results.length > 0 ? (
        <>
          <Text style={styles.resultCount}>
            {results.length} {results.length === 1 ? 'match' : 'matches'} in your shelf
          </Text>
          <FlatList
            data={results}
            keyExtractor={(item) => item.game_id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => <MatchCard item={item} />}
          />
          {mediaDetail ? <MediaGallery detail={mediaDetail} isLoading={mediaLoading} /> : null}
        </>
      ) : isImportMode ? (
        <ImportPanel
          onImported={() => {
            setIsImportMode(false);
            refetch();
          }}
        />
      ) : (
        <View style={styles.bodyWrap}>{renderState()}</View>
      )}
    </View>
  );
}

function ImportPanel({ onImported }: { onImported: () => void }) {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState<string | null>(null);
  const { data, isLoading, isError } = useScreenScraperSearch(submitted, submitted !== null);
  const importGame = useImportScreenScraperGame();

  return (
    <>
      <View style={styles.importHead}>
        <Text style={styles.importTitle}>Not in your catalog yet?</Text>
        <Text style={styles.importSubtitle}>
          Search the ScreenScraper database and import the physical game.
        </Text>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Game title..."
            placeholderTextColor={theme.text.muted}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => setSubmitted(query.trim() || null)}
            returnKeyType="search"
          />
          <Pressable
            style={[styles.searchBtn, !query.trim() && styles.searchBtnDisabled]}
            onPress={() => setSubmitted(query.trim() || null)}
            disabled={!query.trim()}
          >
            <Text style={styles.searchBtnText}>Search</Text>
          </Pressable>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.stateWrap}>
          <ActivityIndicator size="large" color={theme.accent.warm} />
          <Text style={styles.stateText}>Searching ScreenScraper...</Text>
        </View>
      ) : isError ? (
        <View style={styles.stateWrap}>
          <Text style={styles.stateIcon}>🛰️</Text>
          <Text style={styles.stateTitle}>Search failed</Text>
          <Text style={styles.stateText}>ScreenScraper may be unreachable.</Text>
        </View>
      ) : submitted && data?.length ? (
        <FlatList
          data={data}
          keyExtractor={(item) => item.game_id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              style={styles.matchCard}
              onPress={() => {
                importGame.mutateAsync(item.game_id).then(() => {
                  setSubmitted(null);
                  setQuery('');
                  onImported();
                });
              }}
            >
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
                {item.system ? <Text style={styles.matchPlatform}>{item.system}</Text> : null}
                {item.region ? <Text style={styles.matchRegion}>{item.region}</Text> : null}
              </View>
              <View style={styles.importAction}>
                {importGame.isPending ? (
                  <ActivityIndicator size="small" color={theme.accent.warm} />
                ) : (
                  <>
                    <Text style={styles.importActionText}>
                      {importGame.variables === item.game_id ? 'Importing...' : 'Import'}
                    </Text>
                  </>
                )}
              </View>
            </Pressable>
          )}
        />
      ) : (
        <View style={styles.stateWrap}>
          <Text style={styles.stateIcon}>🗄️</Text>
          <Text style={styles.stateTitle}>Type a title to search</Text>
          <Text style={styles.stateText}>
            Matches will be imported into your catalog and then added to your shelf.
          </Text>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg.deep },
  bodyWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  photoWrap: { alignItems: 'center', paddingTop: 12 },
  photoPreview: { width: 96, height: 126, borderRadius: 8, backgroundColor: theme.bg.card },
  resultCount: { color: theme.text.muted, fontSize: 13, paddingHorizontal: 16, marginBottom: 10 },
  list: { paddingHorizontal: 16 },
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
  fallbackRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  fallbackBtn: {
    backgroundColor: theme.bg.surface,
    borderWidth: 1,
    borderColor: theme.border.default,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  fallbackBtnText: { color: theme.text.primary, fontWeight: '700', fontSize: 14 },
  importHead: { paddingHorizontal: 16, paddingBottom: 12 },
  importTitle: { color: theme.text.primary, fontSize: 16, fontWeight: '700' },
  importSubtitle: { color: theme.text.muted, fontSize: 13, marginTop: 4, marginBottom: 14 },
  searchRow: { flexDirection: 'row', gap: 8 },
  searchInput: {
    flex: 1,
    backgroundColor: theme.bg.card,
    borderWidth: 1,
    borderColor: theme.border.subtle,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: theme.text.primary,
    fontSize: 14,
  },
  searchBtn: {
    backgroundColor: theme.accent.warm,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  searchBtnDisabled: { opacity: 0.5 },
  searchBtnText: { color: theme.bg.deep, fontWeight: '700', fontSize: 14 },
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
  importAction: { alignItems: 'center', justifyContent: 'center' },
  importActionText: { color: theme.accent.warm, fontSize: 13, fontWeight: '700' },
});