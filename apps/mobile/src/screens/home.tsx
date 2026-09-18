import { View, Text, StyleSheet, ScrollView, Pressable, FlatList, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/auth';
import { GameCard } from '@/components/game-card';
import { useGames } from '@/hooks/useGames';
import { useFeed } from '@/hooks/useFeed';
import { theme } from '@/theme';
import Animated, { FadeInDown, SlideInRight } from 'react-native-reanimated';

export function Home() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { data, isLoading } = useGames(1);
  const recentGames = data?.games.slice(0, 5) ?? [];
  const { data: feed } = useFeed(1);
  const activity = feed ?? [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Animated.View entering={FadeInDown.delay(80).springify()} style={styles.topBar}>
        <View><Text style={styles.kicker}>CARTRUNE / 01</Text><Text style={styles.greeting}>Hey, {user?.username || 'collector'}.</Text></View>
        <Pressable style={styles.bell} onPress={() => router.push('/feed')}><Ionicons name="notifications-outline" size={20} color={theme.text.primary} /><View style={styles.notificationDot} /></Pressable>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(140).springify()} style={styles.hero}>
        <View style={styles.heroCopy}>
          <View style={styles.livePill}><View style={styles.liveDot} /><Text style={styles.liveText}>YOUR COLLECTION</Text></View>
          <Text style={styles.heroTitle}>Make room{`\n`}for one more.</Text>
          <Text style={styles.heroBody}>Scan a cover, add it to your shelf, and keep the hunt alive.</Text>
          <Pressable style={styles.heroButton} onPress={() => router.push('/(tabs)/scanner')}><Ionicons name="scan-outline" size={17} color={theme.bg.deep} /><Text style={styles.heroButtonText}>Scan a game</Text></Pressable>
        </View>
        <View style={styles.heroOrbit}><Text style={styles.heroConsole}>✦</Text><Text style={styles.heroPixel}>LEVEL UP</Text></View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(220).springify()} style={styles.quickRow}>
        <QuickStat icon="library-outline" value={`${data?.total ?? 0}`} label="in shelf" />
        <QuickStat icon="flame-outline" value="07" label="day streak" />
        <QuickStat icon="trophy-outline" value="03" label="milestones" />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.section}>
        <SectionHeading kicker="THE SHELF" title="Recent pickups" action="See all" onPress={() => router.push('/(tabs)/library')} />
        {isLoading ? <ActivityIndicator color={theme.accent.primary} style={{ marginVertical: 28 }} /> : recentGames.length ? (
          <FlatList horizontal data={recentGames} keyExtractor={(item) => item.id} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gamesRow} renderItem={({ item, index }) => (
            <Animated.View entering={SlideInRight.delay(350 + index * 70).springify()} style={styles.gameItem}><GameCard title={item.title} platform={item.developer || 'Unknown'} coverUrl={item.cover_url} size="small" onPress={() => router.push(`/game/${item.id}`)} /></Animated.View>
          )} />
        ) : <Pressable style={styles.emptyCard} onPress={() => router.push('/(tabs)/scanner')}><Ionicons name="add-circle-outline" size={26} color={theme.accent.primary} /><Text style={styles.emptyTitle}>Your first game is waiting</Text><Text style={styles.emptyBody}>Point the camera at a cover to start your shelf.</Text></Pressable>}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(420).springify()} style={styles.section}>
        <SectionHeading kicker="FROM THE COMMUNITY" title="Collector radar" action="Open feed" onPress={() => router.push('/feed')} />
        {activity.length ? activity.slice(0, 2).map((item) => <View key={item.id} style={styles.activityCard}><View style={styles.activityIcon}><Ionicons name={item.type === 'review' ? 'chatbubble-ellipses-outline' : 'game-controller-outline'} size={18} color={theme.accent.primary} /></View><View style={styles.activityCopy}><Text style={styles.activityText}><Text style={styles.activityUser}>{item.username}</Text> {activityText(item.type)}{item.title ? ` ${item.title}` : ''}</Text><Text style={styles.activityTime}>recently</Text></View></View>) : <Pressable style={styles.communityCard} onPress={() => router.push('/feed')}><View style={styles.communityBadge}><Ionicons name="people-outline" size={21} color={theme.bg.deep} /></View><View style={styles.communityInfo}><Text style={styles.communityTitle}>Your people are out there</Text><Text style={styles.communityText}>Trade recommendations, reviews, and rare finds.</Text></View><Ionicons name="chevron-forward" size={19} color={theme.text.muted} /></Pressable>}
      </Animated.View>
    </ScrollView>
  );
}

function SectionHeading({ kicker, title, action, onPress }: { kicker: string; title: string; action: string; onPress: () => void }) { return <View style={styles.sectionHeader}><View><Text style={styles.sectionKicker}>{kicker}</Text><Text style={styles.sectionTitle}>{title}</Text></View><Pressable onPress={onPress}><Text style={styles.link}>{action} <Ionicons name="arrow-forward" size={13} /></Text></Pressable></View>; }
function QuickStat({ icon, value, label }: { icon: keyof typeof Ionicons.glyphMap; value: string; label: string }) { return <View style={styles.quickStat}><Ionicons name={icon} size={18} color={theme.accent.warm} /><Text style={styles.quickValue}>{value}</Text><Text style={styles.quickLabel}>{label}</Text></View>; }
function activityText(type: string): string { return type === 'review' ? 'wrote a review of' : type === 'completed' ? 'completed' : type === 'added' ? 'added' : 'started playing'; }

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg.deep }, content: { paddingHorizontal: 18, paddingTop: 58, paddingBottom: 30 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }, kicker: { color: theme.accent.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 7 }, greeting: { color: theme.text.primary, fontSize: 25, lineHeight: 29, fontWeight: '800' },
  bell: { width: 42, height: 42, borderRadius: 15, borderWidth: 1, borderColor: theme.border.subtle, backgroundColor: theme.bg.card, alignItems: 'center', justifyContent: 'center' }, notificationDot: { position: 'absolute', right: 10, top: 9, width: 6, height: 6, borderRadius: 3, backgroundColor: theme.accent.warm },
  hero: { minHeight: 240, overflow: 'hidden', borderRadius: 24, backgroundColor: theme.bg.card, borderWidth: 1, borderColor: theme.border.subtle, padding: 20, flexDirection: 'row', marginBottom: 14 }, heroCopy: { flex: 1, zIndex: 1 }, livePill: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 15 }, liveDot: { width: 7, height: 7, borderRadius: 2, backgroundColor: theme.accent.primary }, liveText: { color: theme.accent.primary, fontSize: 9, fontWeight: '800', letterSpacing: 1.2 }, heroTitle: { color: theme.text.primary, fontSize: 31, lineHeight: 32, fontWeight: '900', letterSpacing: -0.8 }, heroBody: { color: theme.text.secondary, fontSize: 13, lineHeight: 18, marginTop: 12, maxWidth: 210 }, heroButton: { alignSelf: 'flex-start', marginTop: 18, backgroundColor: theme.accent.primary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 7 }, heroButtonText: { color: theme.bg.deep, fontSize: 13, fontWeight: '800' }, heroOrbit: { width: 94, height: 160, borderRadius: 47, borderWidth: 1, borderColor: theme.accent.warm, opacity: 0.75, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-18deg' }], marginTop: 20, marginRight: -32 }, heroConsole: { color: theme.accent.warm, fontSize: 58, fontWeight: '900', transform: [{ rotate: '18deg' }] }, heroPixel: { color: theme.accent.warm, fontSize: 8, fontWeight: '900', letterSpacing: 1, transform: [{ rotate: '18deg' }] },
  quickRow: { flexDirection: 'row', backgroundColor: theme.bg.panel, borderRadius: 18, borderWidth: 1, borderColor: theme.border.subtle, paddingVertical: 14, marginBottom: 30 }, quickStat: { flex: 1, alignItems: 'center', gap: 3, borderRightWidth: 1, borderRightColor: theme.border.subtle }, quickValue: { color: theme.text.primary, fontSize: 17, fontWeight: '800', marginTop: 3 }, quickLabel: { color: theme.text.muted, fontSize: 10 },
  section: { marginBottom: 29 }, sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }, sectionKicker: { color: theme.text.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1.4, marginBottom: 5 }, sectionTitle: { color: theme.text.primary, fontSize: 21, fontWeight: '800' }, link: { color: theme.accent.primary, fontSize: 12, fontWeight: '700' }, gamesRow: { paddingRight: 10 }, gameItem: { width: 128, marginRight: 13 },
  emptyCard: { borderRadius: 18, borderWidth: 1, borderColor: theme.border.default, borderStyle: 'dashed', padding: 20, alignItems: 'center' }, emptyTitle: { color: theme.text.primary, fontSize: 15, fontWeight: '800', marginTop: 8 }, emptyBody: { color: theme.text.muted, fontSize: 12, marginTop: 5, textAlign: 'center' }, activityCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.bg.card, borderWidth: 1, borderColor: theme.border.subtle, borderRadius: 16, padding: 13, marginBottom: 8 }, activityIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: theme.bg.elevated, alignItems: 'center', justifyContent: 'center' }, activityCopy: { flex: 1, marginLeft: 11 }, activityText: { color: theme.text.secondary, fontSize: 13, lineHeight: 18 }, activityUser: { color: theme.text.primary, fontWeight: '800' }, activityTime: { color: theme.text.muted, fontSize: 10, marginTop: 3 }, communityCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.bg.card, borderWidth: 1, borderColor: theme.border.subtle, borderRadius: 16, padding: 14 }, communityBadge: { width: 40, height: 40, borderRadius: 13, backgroundColor: theme.accent.primary, alignItems: 'center', justifyContent: 'center' }, communityInfo: { flex: 1, marginLeft: 11 }, communityTitle: { color: theme.text.primary, fontSize: 14, fontWeight: '800' }, communityText: { color: theme.text.muted, fontSize: 12, marginTop: 3 },
});
