import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/auth';
import { Avatar } from '@/components/avatar';
import { theme } from '@/theme';
import Animated, { FadeInDown } from 'react-native-reanimated';

const MOCK_STATS = {
  games: 127,
  completed: 73,
  hours: 812,
  avgRating: 4.3,
};

export function Profile() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.header}>
        <Avatar username={user?.username} size={80} />
        <Text style={styles.username}>{user?.username || 'Guest'}</Text>
        <Text style={styles.bio}>{user?.bio || 'No bio yet'}</Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{MOCK_STATS.games}</Text>
          <Text style={styles.statLabel}>Games</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{MOCK_STATS.completed}</Text>
          <Text style={styles.statLabel}>Done</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{MOCK_STATS.hours}</Text>
          <Text style={styles.statLabel}>Hours</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{MOCK_STATS.avgRating}</Text>
          <Text style={styles.statLabel}>Avg</Text>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.section}>
        <Pressable style={styles.menuItem} onPress={() => router.push('/profile/edit')}>
          <Text style={styles.menuText}>Edit Profile</Text>
          <Text style={styles.menuArrow}>›</Text>
        </Pressable>
        <Pressable style={styles.menuItem} onPress={() => router.push('/feed')}>
          <Text style={styles.menuText}>Activity Feed</Text>
          <Text style={styles.menuArrow}>›</Text>
        </Pressable>
        <Pressable style={styles.menuItem} onPress={() => router.push('/(tabs)/library')}>
          <Text style={styles.menuText}>My Collection</Text>
          <Text style={styles.menuArrow}>›</Text>
        </Pressable>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(400).springify()}>
        <Pressable style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg.deep },
  header: { alignItems: 'center', paddingTop: 60, paddingBottom: 20 },
  username: { color: theme.text.primary, fontSize: 20, fontWeight: '700', marginTop: 12 },
  bio: { color: theme.text.muted, fontSize: 13, marginTop: 4 },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: theme.bg.card,
    marginHorizontal: 16,
    borderRadius: 12,
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
    padding: 14,
    borderRadius: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: theme.border.subtle,
  },
  menuText: { color: theme.text.primary, fontSize: 14, fontWeight: '500' },
  menuArrow: { color: theme.text.muted, fontSize: 20 },
  logoutButton: {
    marginHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: theme.bg.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border.subtle,
  },
  logoutText: { color: '#b07070', fontSize: 14, fontWeight: '600' },
});
