import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/auth';
import { Avatar } from '@/components/avatar';
import { useProfile } from '@/hooks/useProfile';
import { theme } from '@/theme';
import Animated, { FadeInDown } from 'react-native-reanimated';

export function Profile() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { data: profile } = useProfile(user?.username ?? '');

  const stats = profile
    ? {
        games: profile.games_count,
        completed: profile.completed_count,
        hours: Math.round(profile.hours_played),
        avgRating: profile.avg_rating.toFixed(1),
      }
    : { games: 0, completed: 0, hours: 0, avgRating: '0.0' };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.header}>
        <Avatar username={user?.username} size={80} />
        <Text style={styles.eyebrow}>COLLECTOR PROFILE</Text>
        <Text style={styles.username}>{user?.username || 'Guest'}</Text>
        <Text style={styles.bio}>{user?.bio || 'No bio yet'}</Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{stats.games}</Text>
          <Text style={styles.statLabel}>Games</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{stats.completed}</Text>
          <Text style={styles.statLabel}>Done</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{stats.hours}</Text>
          <Text style={styles.statLabel}>Hours</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{stats.avgRating}</Text>
          <Text style={styles.statLabel}>Avg</Text>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.section}>
        <Pressable style={styles.menuItem} onPress={() => router.push('/profile/edit')} accessibilityRole="button">
          <View style={styles.menuLeading}><Ionicons name="person-outline" size={18} color={theme.accent.primary} /><Text style={styles.menuText}>Edit Profile</Text></View>
          <Ionicons name="chevron-forward" size={18} color={theme.text.muted} />
        </Pressable>
        <Pressable style={styles.menuItem} onPress={() => router.push('/feed')} accessibilityRole="button">
          <View style={styles.menuLeading}><Ionicons name="pulse-outline" size={18} color={theme.accent.primary} /><Text style={styles.menuText}>Activity Feed</Text></View>
          <Ionicons name="chevron-forward" size={18} color={theme.text.muted} />
        </Pressable>
        <Pressable style={styles.menuItem} onPress={() => router.push('/(tabs)/library')} accessibilityRole="button">
          <View style={styles.menuLeading}><Ionicons name="library-outline" size={18} color={theme.accent.primary} /><Text style={styles.menuText}>My Collection</Text></View>
          <Ionicons name="chevron-forward" size={18} color={theme.text.muted} />
        </Pressable>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(400).springify()}>
        <Pressable style={styles.logoutButton} onPress={logout} accessibilityRole="button" accessibilityLabel="Log out">
          <Ionicons name="log-out-outline" size={17} color="#e0706a" />
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg.deep },
  header: { alignItems: 'center', paddingTop: 60, paddingBottom: 20 },
  eyebrow: { color: theme.text.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginTop: 16 },
  username: { color: theme.text.primary, fontSize: 28, fontWeight: '700', marginTop: 6 },
  bio: { color: theme.text.muted, fontSize: 13, marginTop: 4 },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: theme.bg.card,
    marginHorizontal: 16,
    borderRadius: 24,
    paddingVertical: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: theme.border.subtle,
  },
  stat: { alignItems: 'center', flex: 1 },
  statValue: { color: theme.text.primary, fontSize: 16, fontWeight: '700' },
  statLabel: { color: theme.text.muted, fontSize: 10, marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.5 },
  statDivider: { width: 1, height: 24, backgroundColor: theme.border.subtle },
  section: { marginHorizontal: 16, marginBottom: 24 },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.bg.card,
    paddingHorizontal: 15,
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: theme.border.subtle,
  },
  menuLeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuText: { color: theme.text.primary, fontSize: 14, fontWeight: '600' },
  logoutButton: {
    marginHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: theme.bg.card,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.border.subtle,
  },
  logoutText: { color: '#e0706a', fontSize: 14, fontWeight: '700' },
});
