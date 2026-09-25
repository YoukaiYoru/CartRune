import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  Pressable,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { scanBarcode, scanText, matchEmbedding } from '@/services/scanner';
import { embedPhoto } from '@/services/embeddings';
import { getEmbedding, setEmbedding } from '@/lib/embedding-cache';
import { getScanCapture } from '@/lib/scan-capture';
import { Image } from 'expo-image';
import {
  useScreenScraperSearch,
  useImportScreenScraperGame,
} from '@/hooks/useScreenscraper';
import { ScreenHeader } from '@/components/screen-header';
import { theme } from '@/theme';
import { resolveApiUrl } from '@/services/api';
import type { CoverAnalysis, ScanResponse } from '@/services/types';
import { useAddGameToLibrary, usePrimaryLibrary } from '@/hooks/useCollections';

const methodLabel: Record<string, string> = {
  barcode: 'Barcode Scan',
  text: 'Text / OCR',
  embedding: 'Cover Match',
};

export function ScannerResults() {
  const router = useRouter();
  const { method, value, photo, capture_key, failed, error, analysis: analysisParam, embedding: embeddingParam } = useLocalSearchParams<{
    method: string;
    value?: string;
    photo?: string;
    capture_key?: string;
    type?: string;
    failed?: string;
    error?: string;
    analysis?: string;
    embedding?: string;
  }>();

  const analysis = parseAnalysis(analysisParam);
  const photoUri = normalizePhotoUri(photo) || getScanCapture(capture_key);
  // Keep the catalog query focused on the title. Adding edition/region and
  // console labels makes ScreenScraper return weaker or malformed candidates.
  const analysisQuery = analysis?.title || analysis?.query || [analysis?.console, analysis?.region].filter(Boolean).join(' ');

  const cachedEmbedding = photoUri ? getEmbedding(photoUri) ?? parseEmbedding(embeddingParam) : undefined;
  const recoveredEmbeddingQuery = useQuery({
    queryKey: ['scanner', 'recover-embedding', photoUri],
    queryFn: async () => {
      if (!photoUri) throw new Error('cover photo is missing');
      const recovered = await embedPhoto(photoUri);
      setEmbedding(photoUri, recovered);
      return recovered;
    },
    enabled: method === 'embedding' && !!photoUri && !cachedEmbedding,
    retry: 1,
  });
  const embedding = cachedEmbedding ?? recoveredEmbeddingQuery.data;

  const scanFn =
    method === 'barcode' && value
      ? () => scanBarcode(value)
    : method === 'text' && value
      ? () => scanText(value)
    : method === 'embedding' && embedding
      ? () => scanEmbeddingWithFallback(embedding, analysis, analysisQuery)
      : null;

  const noopFn: () => Promise<ScanResponse> = async () => ({
    matches: [],
    method: 'none',
  });
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['scanner', method, value ?? photoUri],
    queryFn: scanFn ?? noopFn,
    enabled: !!scanFn,
    retry: 1,
  });

  const results = data?.matches ?? [];
  const matchSource = data?.match_source ?? (method === 'embedding' ? 'visual' : 'catalog');
  const methodKey = method ?? 'barcode';
  const [selectedMatchKey, setSelectedMatchKey] = useState<string | null>(null);
  const selectedMatch = results.find((item) => matchKey(item) === selectedMatchKey) ?? results[0];


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
            {error
              ? `Error: ${error}`
              : 'The embedding service is offline. Try again from the scanner.'}
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
            Cover analysis is not ready. Capture the cover again.
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
            Cover {photoUri ? 'captured. OCR will read the title next.' : 'capture the cover first.'}
          </Text>
        </View>
      );
    }

    if (results.length === 0) {
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

      <ScrollView
        style={styles.resultsScroll}
        contentContainerStyle={styles.resultsContent}
        showsVerticalScrollIndicator={false}
      >
        {photoUri && (
          <View style={styles.photoWrap}>
            <Text style={styles.photoLabel}>CAPTURED COVER</Text>
            <Image source={{ uri: photoUri }} style={styles.photoPreview} contentFit="contain" cachePolicy="memory-disk" transition={120} />
          </View>
        )}

        {analysis ? <AnalysisCard analysis={analysis} /> : null}

        {isLoading || isError || recoveredEmbeddingQuery.isLoading || (method === 'text' && !value) || (method === 'embedding' && !embedding) || failed === '1' ? (
          <View style={styles.bodyWrap}>{renderState()}</View>
        ) : results.length > 0 ? (
          <>
            {selectedMatch ? <CoverMatchHero item={selectedMatch} source={matchSource} /> : null}
            {results.length > 1 ? (
              <View style={styles.alternativesSection}>
                <Text style={styles.sectionLabel}>OTHER MATCHES</Text>
                {results.map((item) => (
                  <MatchOption
                    key={matchKey(item)}
                    item={item}
                    source={matchSource}
                    selected={matchKey(item) === matchKey(selectedMatch)}
                    onPress={() => setSelectedMatchKey(matchKey(item))}
                  />
                ))}
              </View>
            ) : null}
            {selectedMatch ? <ShelfAction item={selectedMatch} /> : null}
          </>
        ) : (
          <View style={styles.bodyWrap}>{renderState()}</View>
        )}
      </ScrollView>
    </View>
  );
}

async function scanEmbeddingWithFallback(
  embedding: number[],
  analysis: CoverAnalysis | null,
  analysisQuery?: string
): Promise<ScanResponse> {
  try {
    // Visual similarity remains the primary signal. Qwen metadata is used to
    // narrow/fallback the catalog search, never to replace the image match.
    const visual = await matchEmbedding(embedding, analysis?.console);
    if (visual.matches.length > 0 || !analysisQuery) return visual;
    const text = await scanText(analysisQuery, analysis?.console);
    return text.matches.length > 0 ? { ...text, match_source: 'catalog' } : { ...visual, match_source: 'visual' };
  } catch (error) {
    if (!analysisQuery) throw error;
    return { ...(await scanText(analysisQuery, analysis?.console)), match_source: 'catalog' };
  }
}

function parseAnalysis(value?: string | string[]): CoverAnalysis | null {
  if (!value || Array.isArray(value)) return null;
  try {
    const parsed = JSON.parse(value) as Partial<CoverAnalysis>;
    if (typeof parsed.title !== 'string') return null;
    return {
      title: parsed.title || '', console: parsed.console || '', region: parsed.region || '',
      edition: parsed.edition || '', publisher: parsed.publisher || '', query: parsed.query || parsed.title,
    };
  } catch { return null; }
}

function parseEmbedding(value?: string | string[]): number[] | undefined {
  if (!value || Array.isArray(value)) return undefined;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === 'number')
      ? parsed
      : undefined;
  } catch {
    return undefined;
  }
}

function normalizePhotoUri(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function matchKey(item?: { game_id: string; release_id?: string } | null): string {
  return item ? `${item.game_id}:${item.release_id ?? ''}` : '';
}

function CoverMatchHero({ item, source }: { item: NonNullable<ScanResponse['matches']>[number]; source: 'visual' | 'catalog' }) {
  return (
    <View style={styles.matchHero}>
      <Text style={styles.matchHeroEyebrow}>{source === 'visual' ? 'COVER MATCH RESULT' : 'CATALOG MATCH RESULT'}</Text>
      <View style={styles.matchHeroImageFrame}>
        {item.cover_url ? (
          <Image
            source={{ uri: resolveApiUrl(item.cover_url) }}
            style={styles.matchHeroImage}
            contentFit="contain"
            transition={180}
          />
        ) : (
          <Text style={styles.matchHeroPlaceholder}>🎮</Text>
        )}
      </View>
      <Text style={styles.matchHeroTitle} numberOfLines={2}>{item.title}</Text>
      <Text style={styles.matchHeroMeta}>
        {[item.platform, item.region].filter(Boolean).join(' · ') || 'Platform not identified'}
      </Text>
      <View style={styles.matchScoreBadge}>
        <Text style={styles.matchScoreText}>
          {source === 'visual' ? `${Math.round(item.similarity * 100)}% visual match` : 'Matched by title and platform'}
        </Text>
      </View>
    </View>
  );
}

function MatchOption({
  item,
  source,
  selected,
  onPress,
}: {
  item: NonNullable<ScanResponse['matches']>[number];
  source: 'visual' | 'catalog';
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.matchOption, selected && styles.matchOptionSelected]} onPress={onPress}>
      {item.cover_url ? (
        <Image source={{ uri: resolveApiUrl(item.cover_url) }} style={styles.matchOptionImage} contentFit="contain" />
      ) : (
        <View style={styles.matchOptionPlaceholder}><Text>🎮</Text></View>
      )}
      <View style={styles.matchOptionInfo}>
        <Text style={styles.matchOptionTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.matchOptionMeta} numberOfLines={1}>
          {[item.platform, item.region].filter(Boolean).join(' · ') || 'Unknown release'}
        </Text>
      </View>
      <Text style={styles.matchOptionScore}>{source === 'visual' ? `${Math.round(item.similarity * 100)}%` : 'Catalog'}</Text>
    </Pressable>
  );
}

function ShelfAction({ item }: { item: NonNullable<ScanResponse['matches']>[number] }) {
  const statuses = [
    ['backlog', 'Backlog'],
    ['playing', 'Playing'],
    ['completed', 'Completed'],
    ['paused', 'Paused'],
    ['dropped', 'Dropped'],
  ] as const;
  const { library } = usePrimaryLibrary();
  const addGame = useAddGameToLibrary(library?.id ?? '');
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const alreadyAdded = !!library?.games?.some((game) => game.game_id === item.game_id);

  const addWithStatus = (status: (typeof statuses)[number][0]) => {
    if (!library?.id || saved || alreadyAdded) return;
    setOpen(false);
    addGame.mutate(
      { game_id: item.game_id, release_id: item.release_id, status },
      { onSuccess: () => setSaved(true) }
    );
  };

  if (!library?.id) return null;

  return (
    <View style={styles.shelfAction}>
      {open ? (
        <View style={styles.shelfMenu}>
          {statuses.map(([value, label]) => (
            <Pressable key={value} style={styles.shelfMenuItem} onPress={() => addWithStatus(value)} accessibilityRole="button" accessibilityLabel={`Add to ${label}`}>
              <Text style={styles.shelfMenuText}>{label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Pressable
        style={[styles.shelfButton, (alreadyAdded || saved) && styles.shelfButtonSaved]}
        onPress={() => setOpen((value) => !value)}
        disabled={addGame.isPending || alreadyAdded || saved}
        accessibilityRole="button"
        accessibilityLabel={alreadyAdded || saved ? 'Game already in your shelf' : 'Choose shelf status'}
      >
        {addGame.isPending ? <ActivityIndicator size="small" color={theme.bg.deep} /> : (
          <Text style={styles.shelfButtonText}>{alreadyAdded || saved ? '✓ In your shelf' : 'Add to shelf ▾'}</Text>
        )}
      </Pressable>
      {addGame.isError ? <Text style={styles.shelfError}>Could not save. Choose a status to try again.</Text> : null}
    </View>
  );
}

function AnalysisCard({ analysis }: { analysis: CoverAnalysis }) {
  const fields = [
    ['GAME', analysis.title], ['CONSOLE', analysis.console], ['REGION', analysis.region],
    ['EDITION', analysis.edition],
  ].filter(([, value]) => value);
  return (
    <View style={styles.analysisCard}>
      <View style={styles.analysisHeader}><View style={styles.aiBadge}><Text style={styles.aiBadgeText}>AI</Text></View><View><Text style={styles.analysisTitle}>Cover notes</Text><Text style={styles.analysisSubtitle}>Vision model found these hints</Text></View></View>
      <View style={styles.analysisGrid}>{fields.map(([label, value]) => <View key={label} style={styles.analysisField}><Text style={styles.analysisLabel}>{label}</Text><Text style={styles.analysisValue} numberOfLines={1}>{value}</Text></View>)}</View>
    </View>
  );
}

function ImportPanel({ onImported, initialQuery }: { onImported: () => void; initialQuery?: string }) {
  const shelfStatuses = [
    ['backlog', 'Backlog'],
    ['playing', 'Playing'],
    ['completed', 'Completed'],
    ['paused', 'Paused'],
    ['dropped', 'Dropped'],
  ] as const;
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState<string | null>(initialQuery ?? null);
  const [status, setStatus] = useState<(typeof shelfStatuses)[number][0]>('backlog');
  const { data, isLoading, isError } = useScreenScraperSearch(submitted, submitted !== null);
  const importGame = useImportScreenScraperGame();
  const { library } = usePrimaryLibrary();
  const addGame = useAddGameToLibrary(library?.id || '');
  const [savedGameIds, setSavedGameIds] = useState<string[]>([]);

  const importAndSave = async (item: { game_id: string }) => {
    const imported = await importGame.mutateAsync(item.game_id);
    if (library?.id && imported.game_id) {
      await addGame.mutateAsync({ game_id: imported.game_id, status });
      setSavedGameIds((current) => [...current, item.game_id]);
    }
    setSubmitted(null);
    setQuery('');
    onImported();
  };

  const isSaving = importGame.isPending || addGame.isPending;

  return (
    <>
      <View style={styles.importHead}>
        <Text style={styles.importTitle}>Not in your catalog yet?</Text>
        <Text style={styles.importSubtitle}>
          Search the extended catalog and import the physical game.
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
        <Text style={styles.statusLabel}>Save as</Text>
        <View style={styles.statusRow}>
          {shelfStatuses.map(([value, label]) => (
            <Pressable
              key={value}
              style={[styles.statusChip, status === value && styles.statusChipActive]}
              onPress={() => setStatus(value)}
            >
              <Text style={[styles.statusChipText, status === value && styles.statusChipTextActive]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.stateWrap}>
          <ActivityIndicator size="large" color={theme.accent.warm} />
          <Text style={styles.stateText}>Searching the extended catalog...</Text>
        </View>
      ) : isError ? (
        <View style={styles.stateWrap}>
          <Text style={styles.stateIcon}>🛰️</Text>
          <Text style={styles.stateTitle}>Search failed</Text>
          <Text style={styles.stateText}>The extended catalog may be unreachable.</Text>
        </View>
      ) : submitted && data?.length ? (
        <FlatList
          data={data}
          keyExtractor={(item) => item.game_id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View
              style={styles.matchCard}
            >
              {item.cover_url ? (
                <Image source={{ uri: resolveApiUrl(item.cover_url) }} style={styles.coverImage} contentFit="contain" />
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
              <Pressable
                style={styles.importAction}
                onPress={() => importAndSave(item)}
                disabled={isSaving || savedGameIds.includes(item.game_id)}
                accessibilityRole="button"
              >
                {importGame.isPending ? (
                  <ActivityIndicator size="small" color={theme.accent.warm} />
                ) : (
                  <>
                    <Text style={styles.importActionText}>
                      {savedGameIds.includes(item.game_id)
                        ? '✓ In shelf'
                        : isSaving
                          ? 'Saving...'
                          : library?.id
                            ? 'Import & shelf'
                            : 'Import'}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          )}
        />
      ) : (
        <View style={styles.stateWrap}>
          <Text style={styles.stateIcon}>🗄️</Text>
          <Text style={styles.stateTitle}>Type a title to search</Text>
          <Text style={styles.stateText}>
            Matches will be added to your catalog and then to your shelf.
          </Text>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg.deep },
  bodyWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  photoWrap: { alignItems: 'center', paddingTop: 12, paddingBottom: 4 },
  resultsScroll: { flex: 1 },
  resultsContent: { paddingBottom: 30 },
  photoLabel: { color: theme.text.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1, marginBottom: 6 },
  photoPreview: { width: 150, height: 190, borderRadius: 14, backgroundColor: theme.bg.card, borderWidth: 1, borderColor: theme.border.subtle },
  matchHero: { marginHorizontal: 16, marginTop: 12, marginBottom: 16, padding: 16, borderRadius: 22, backgroundColor: theme.bg.card, borderWidth: 1, borderColor: theme.accent.primary, alignItems: 'center' },
  matchHeroEyebrow: { alignSelf: 'flex-start', color: theme.accent.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.2, marginBottom: 10 },
  matchHeroImageFrame: { width: 190, height: 240, borderRadius: 16, backgroundColor: theme.bg.surface, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: theme.border.subtle },
  matchHeroImage: { width: '100%', height: '100%' },
  matchHeroPlaceholder: { fontSize: 48, opacity: 0.4 },
  matchHeroTitle: { color: theme.text.primary, fontSize: 21, lineHeight: 25, fontWeight: '800', textAlign: 'center', marginTop: 12 },
  matchHeroMeta: { color: theme.text.muted, fontSize: 12, marginTop: 4 },
  matchScoreBadge: { marginTop: 10, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: theme.bg.surface },
  matchScoreText: { color: theme.accent.warm, fontSize: 11, fontWeight: '800' },
  alternativesSection: { paddingHorizontal: 16, marginBottom: 12 },
  sectionLabel: { color: theme.text.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.2, marginBottom: 8 },
  matchOption: { minHeight: 66, flexDirection: 'row', alignItems: 'center', padding: 8, marginBottom: 7, borderRadius: 14, backgroundColor: theme.bg.card, borderWidth: 1, borderColor: theme.border.subtle },
  matchOptionSelected: { borderColor: theme.accent.primary, backgroundColor: theme.bg.elevated },
  matchOptionImage: { width: 42, height: 54, borderRadius: 7, backgroundColor: theme.bg.surface },
  matchOptionPlaceholder: { width: 42, height: 54, borderRadius: 7, backgroundColor: theme.bg.surface, alignItems: 'center', justifyContent: 'center' },
  matchOptionInfo: { flex: 1, marginHorizontal: 10 },
  matchOptionTitle: { color: theme.text.primary, fontSize: 13, fontWeight: '700' },
  matchOptionMeta: { color: theme.text.muted, fontSize: 11, marginTop: 3 },
  matchOptionScore: { color: theme.accent.warm, fontSize: 13, fontWeight: '800' },
  shelfAction: { marginHorizontal: 16, marginTop: 4, marginBottom: 22 },
  shelfMenu: { marginBottom: 8, padding: 6, borderRadius: 14, backgroundColor: theme.bg.card, borderWidth: 1, borderColor: theme.border.subtle, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  shelfMenuItem: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 999, backgroundColor: theme.bg.surface },
  shelfMenuText: { color: theme.text.secondary, fontSize: 12, fontWeight: '700' },
  shelfButton: { minHeight: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.accent.warm },
  shelfButtonSaved: { backgroundColor: theme.accent.primary },
  shelfButtonText: { color: theme.bg.deep, fontSize: 14, fontWeight: '900' },
  shelfError: { color: theme.accent.warm, fontSize: 12, textAlign: 'center', marginTop: 8 },
  extendedSearchButton: { marginHorizontal: 16, marginBottom: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.accent.primary, alignItems: 'center' },
  extendedSearchText: { color: theme.accent.primary, fontSize: 13, fontWeight: '800' },
  analysisCard: { marginHorizontal: 16, marginTop: 12, marginBottom: 14, padding: 14, borderRadius: 18, backgroundColor: theme.bg.card, borderWidth: 1, borderColor: theme.accent.primary },
  analysisHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  aiBadge: { width: 34, height: 34, borderRadius: 11, backgroundColor: theme.accent.primary, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  aiBadgeText: { color: theme.bg.deep, fontSize: 12, fontWeight: '900' },
  analysisTitle: { color: theme.text.primary, fontSize: 14, fontWeight: '800' },
  analysisSubtitle: { color: theme.text.muted, fontSize: 11, marginTop: 2 },
  analysisGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  analysisField: { minWidth: '45%', flex: 1 },
  analysisLabel: { color: theme.text.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  analysisValue: { color: theme.text.secondary, fontSize: 13, fontWeight: '700', marginTop: 3 },
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
  statusLabel: { color: theme.text.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginTop: 14, marginBottom: 7 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  statusChip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: theme.bg.surface, borderWidth: 1, borderColor: theme.border.subtle },
  statusChipActive: { backgroundColor: theme.accent.primary, borderColor: theme.accent.primary },
  statusChipText: { color: theme.text.muted, fontSize: 11, fontWeight: '700' },
  statusChipTextActive: { color: theme.bg.deep },
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
