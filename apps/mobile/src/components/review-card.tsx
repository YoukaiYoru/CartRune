import { View, Text, StyleSheet } from 'react-native';
import { theme } from '@/theme';

interface ReviewCardProps {
  username: string;
  rating: number;
  title: string;
  content: string;
  date?: string;
}

const renderStars = (rating: number) =>
  Array.from({ length: 5 }, (_, i) => (i < rating ? '★' : '☆')).join('');

export function ReviewCard({ username, rating, title, content, date }: ReviewCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{username[0].toUpperCase()}</Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.username}>{username}</Text>
          {date && <Text style={styles.date}>{date}</Text>}
        </View>
        <Text style={styles.stars}>{renderStars(rating)}</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.content}>{content}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.bg.card,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.border.subtle,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: theme.bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: { color: theme.text.secondary, fontSize: 13, fontWeight: '700' },
  userInfo: { flex: 1 },
  username: { color: theme.text.primary, fontSize: 13, fontWeight: '600' },
  date: { color: theme.text.muted, fontSize: 11, marginTop: 1 },
  stars: { color: theme.accent.warm, fontSize: 13 },
  title: { color: theme.text.primary, fontSize: 14, fontWeight: '600', marginBottom: 4 },
  content: { color: theme.text.secondary, fontSize: 13, lineHeight: 19 },
});
