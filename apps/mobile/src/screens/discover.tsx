import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { useScreenScraperSearch, useImportScreenScraperGame } from '@/hooks/useScreenscraper';
import { resolveApiUrl } from '@/services/api';
import { theme } from '@/theme';
import type { SearchItem } from '@/services/types';

export function Discover() {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const router = useRouter();
  const importGame = useImportScreenScraperGame();

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);

  const { data, isLoading, isError } = useScreenScraperSearch(debounced || null, !!debounced);

  return (
    <View style={styles.container}>
      <Animated.View entering={FadeInDown.delay(80).springify()} style={styles.header}>
        <View style={styles.headerRow}><View><Text style={styles.kicker}>SCREEN SCRAPER CATALOG</Text><Text style={styles.title}>Find your next game.</Text></View><View style={styles.globe}><Ionicons name="earth-outline" size={19} color={theme.accent.primary} /></View></View>
        <Text style={styles.subtitle}>Search the wider archive, then bring a physical release to your shelf.</Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(140).springify()} style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={theme.text.muted} />
        <TextInput style={styles.searchInput} placeholder="Game title, console, region..." placeholderTextColor={theme.text.muted} value={query} onChangeText={setQuery} autoCapitalize="none" autoCorrect={false} returnKeyType="search" />
        {query.length > 0 ? <Pressable onPress={() => { setQuery(''); setDebounced(''); }}><Ionicons name="close-circle" size={18} color={theme.text.muted} /></Pressable> : null}
      </Animated.View>

      {!debounced ? <View style={styles.prompt}><View style={styles.promptIcon}><Ionicons name="sparkles-outline" size={22} color={theme.accent.primary} /></View><Text style={styles.promptTitle}>The archive is huge.</Text><Text style={styles.promptText}>Try “Sonic”, “PS2” or a favorite from your childhood.</Text></View> : isLoading ? <View style={styles.state}><ActivityIndicator color={theme.accent.primary} /><Text style={styles.stateText}>Searching ScreenScraper...</Text></View> : isError ? <View style={styles.state}><Ionicons name="cloud-offline-outline" size={32} color={theme.accent.warm} /><Text style={styles.stateTitle}>Catalog unavailable</Text><Text style={styles.stateText}>Check your connection or ScreenScraper credentials.</Text></View> : <FlatList data={data ?? []} keyExtractor={(item) => String(item.game_id)} contentContainerStyle={styles.list} ListEmptyComponent={<View style={styles.state}><Ionicons name="search-outline" size={32} color={theme.text.muted} /><Text style={styles.stateText}>No releases found for “{debounced}”.</Text></View>} renderItem={({ item, index }) => <CatalogCard item={item} index={index} importing={importGame.isPending && importGame.variables === item.game_id} onImport={() => importGame.mutate(item.game_id)} onOpen={() => router.push({ pathname: '/scanner/results', params: { method: 'text', value: item.title } })} />} />}
    </View>
  );
}

function CatalogCard({ item, index, importing, onImport, onOpen }: { item: SearchItem; index: number; importing: boolean; onImport: () => void; onOpen: () => void }) {
  return <Animated.View entering={FadeInRight.delay(index * 55).springify()}><View style={styles.resultCard}><Pressable style={styles.resultMain} onPress={onOpen}><View style={styles.cover}>{item.cover_url ? <Image source={{ uri: resolveApiUrl(item.cover_url) }} style={styles.coverImage} contentFit="contain" transition={150} /> : <Ionicons name="game-controller-outline" size={23} color={theme.text.muted} />}</View><View style={styles.info}><Text style={styles.resultTitle} numberOfLines={2}>{item.title}</Text><Text style={styles.resultPlatform}>{item.system || 'Console unknown'}</Text>{item.region ? <Text style={styles.resultRegion}>{item.region.toUpperCase()} · ScreenScraper</Text> : null}</View></Pressable><Pressable style={styles.importButton} onPress={onImport} disabled={importing}><Text style={styles.importText}>{importing ? '...' : 'Add'}</Text><Ionicons name="add" size={15} color={theme.bg.deep} /></Pressable></View></Animated.View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg.deep }, header: { paddingTop: 58, paddingHorizontal: 18, paddingBottom: 18 }, headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, kicker: { color: theme.accent.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1.2, marginBottom: 7 }, title: { color: theme.text.primary, fontSize: 27, lineHeight: 31, fontWeight: '800' }, subtitle: { color: theme.text.muted, fontSize: 13, lineHeight: 18, marginTop: 9, maxWidth: 320 }, globe: { width: 42, height: 42, borderRadius: 15, borderWidth: 1, borderColor: theme.border.subtle, backgroundColor: theme.bg.card, alignItems: 'center', justifyContent: 'center' }, searchWrap: { marginHorizontal: 18, marginBottom: 10, paddingHorizontal: 14, height: 50, borderRadius: 16, backgroundColor: theme.bg.input, borderWidth: 1, borderColor: theme.border.default, flexDirection: 'row', alignItems: 'center' }, searchInput: { flex: 1, color: theme.text.primary, fontSize: 14, marginHorizontal: 10 }, list: { paddingHorizontal: 18, paddingBottom: 26 }, resultCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.bg.card, borderRadius: 18, padding: 10, marginBottom: 9, borderWidth: 1, borderColor: theme.border.subtle }, resultMain: { flex: 1, flexDirection: 'row', alignItems: 'center' }, cover: { width: 53, height: 70, backgroundColor: theme.bg.surface, borderRadius: 9, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, coverImage: { width: '100%', height: '100%' }, info: { flex: 1, marginLeft: 12, marginRight: 8 }, resultTitle: { color: theme.text.primary, fontSize: 14, fontWeight: '700', lineHeight: 18 }, resultPlatform: { color: theme.text.secondary, fontSize: 12, marginTop: 4 }, resultRegion: { color: theme.accent.muted, fontSize: 9, fontWeight: '800', marginTop: 4, letterSpacing: 0.5 }, importButton: { backgroundColor: theme.accent.primary, minWidth: 58, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 2 }, importText: { color: theme.bg.deep, fontSize: 12, fontWeight: '800' }, prompt: { margin: 18, padding: 25, borderRadius: 22, backgroundColor: theme.bg.card, alignItems: 'center', borderWidth: 1, borderColor: theme.border.subtle }, promptIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: theme.bg.elevated, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }, promptTitle: { color: theme.text.primary, fontSize: 17, fontWeight: '800' }, promptText: { color: theme.text.muted, fontSize: 13, textAlign: 'center', lineHeight: 18, marginTop: 6 }, state: { alignItems: 'center', paddingHorizontal: 30, paddingTop: 65 }, stateTitle: { color: theme.text.primary, fontSize: 16, fontWeight: '800', marginTop: 12 }, stateText: { color: theme.text.muted, fontSize: 13, textAlign: 'center', lineHeight: 18, marginTop: 9 },
});
