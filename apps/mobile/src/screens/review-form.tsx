import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/screen-header';
import { useCreateReview } from '@/hooks/useGames';
import { theme } from '@/theme';

export function ReviewForm({ gameId }: { gameId: string }) {
  const router = useRouter();
  const createReview = useCreateReview(gameId);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [spoiler, setSpoiler] = useState(false);
  const [error, setError] = useState('');

  const handlePost = () => {
    if (rating < 1) {
      setError('Select a rating (1–5 stars)');
      return;
    }
    setError('');
    createReview.mutate(
      { rating, title: title.trim(), content: content.trim(), spoiler },
      {
        onSuccess: () => router.back(),
        onError: (e: any) =>
          setError(e?.response?.data?.error || 'Failed to post review. Try again.'),
      }
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <ScreenHeader
        title="Write Review"
        showBack
        rightAction={{ label: 'Post', onPress: handlePost }}
      />

      <View style={styles.ratingSection}>
        <Text style={styles.label}>Rating</Text>
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Pressable key={star} onPress={() => setRating(star)}>
              <Text style={[styles.star, star <= rating && styles.starActive]}>
                {star <= rating ? '★' : '☆'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          placeholder="Summarize your thoughts"
          placeholderTextColor={theme.text.muted}
          value={title}
          onChangeText={setTitle}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Review</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder="What did you think of the game?"
          placeholderTextColor={theme.text.muted}
          value={content}
          onChangeText={setContent}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
        />
      </View>

      <Pressable
        style={styles.spoilerToggle}
        onPress={() => setSpoiler(!spoiler)}
      >
        <View style={[styles.checkbox, spoiler && styles.checkboxActive]}>
          {spoiler && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <Text style={styles.spoilerText}>Contains spoilers</Text>
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {createReview.isPending && (
        <ActivityIndicator color={theme.accent.primary} style={{ marginTop: 16 }} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg.deep },
  ratingSection: { paddingHorizontal: 16, marginBottom: 16 },
  label: { color: theme.text.primary, fontSize: 14, fontWeight: '600', marginBottom: 8 },
  stars: { flexDirection: 'row', gap: 8 },
  star: { fontSize: 26, color: theme.border.default },
  starActive: { color: theme.accent.warm },
  field: { paddingHorizontal: 16, marginBottom: 16 },
  input: {
    backgroundColor: theme.bg.card,
    borderRadius: 10,
    padding: 12,
    color: theme.text.primary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: theme.border.subtle,
  },
  textarea: { height: 130 },
  spoilerToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
    marginTop: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: theme.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: theme.accent.warm, borderColor: theme.accent.warm },
  checkmark: { color: theme.bg.deep, fontSize: 12, fontWeight: '700' },
  spoilerText: { color: theme.text.secondary, fontSize: 13 },
  error: { color: '#e0706a', fontSize: 13, paddingHorizontal: 16, marginTop: 12 },
});
