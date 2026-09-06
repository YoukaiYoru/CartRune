import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/theme';

interface ScreenHeaderProps {
  title: string;
  showBack?: boolean;
  rightAction?: { label: string; onPress: () => void };
}

export function ScreenHeader({ title, showBack = false, rightAction }: ScreenHeaderProps) {
  const router = useRouter();

  return (
    <View style={styles.header}>
      {showBack ? (
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={20} color={theme.accent.warm} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.placeholder} />
      )}
      <Text style={styles.title}>{title}</Text>
      {rightAction ? (
        <TouchableOpacity
          style={styles.actionButton}
          onPress={rightAction.onPress}
          accessibilityRole="button"
        >
          <Text style={styles.action}>{rightAction.label}</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.placeholder} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  backText: { color: theme.accent.warm, fontSize: 15, fontWeight: '500' },
  title: { color: theme.text.primary, fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center' },
  action: { color: theme.accent.warm, fontSize: 14, fontWeight: '600' },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.bg.elevated,
    borderRadius: 8,
  },
  placeholder: { width: 80 },
});
