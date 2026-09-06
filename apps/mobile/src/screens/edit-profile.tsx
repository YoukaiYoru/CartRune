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
import { Avatar } from '@/components/avatar';
import { useAuthStore } from '@/store/auth';
import { useUpdateProfile } from '@/hooks/useProfile';
import { theme } from '@/theme';

export function EditProfile() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const updateProfile = useUpdateProfile();
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [error, setError] = useState('');

  const handleSave = () => {
    if (username.trim().length < 2) {
      setError('Username must be at least 2 characters');
      return;
    }
    setError('');
    updateProfile.mutate(
      { username: username.trim(), bio: bio.trim() },
      {
        onSuccess: (updated) => {
          useAuthStore.setState({ user: { ...user, ...updated } });
          router.back();
        },
        onError: (e: any) =>
          setError(e?.response?.data?.error || 'Failed to save. Try again.'),
      }
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <ScreenHeader
        title="Edit Profile"
        showBack
        rightAction={{ label: 'Save', onPress: handleSave }}
      />

      <View style={styles.avatarSection}>
        <Avatar username={username} size={90} />
        <Pressable style={styles.changePhotoBtn}>
          <Text style={styles.changePhoto}>Change Photo</Text>
        </Pressable>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Username</Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          placeholder="Username"
          placeholderTextColor={theme.text.muted}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Bio</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={bio}
          onChangeText={setBio}
          placeholder="Tell us about yourself"
          placeholderTextColor={theme.text.muted}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {updateProfile.isPending && (
        <ActivityIndicator color={theme.accent.primary} style={{ marginTop: 8 }} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg.deep },
  avatarSection: { alignItems: 'center', paddingVertical: 24 },
  changePhotoBtn: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: theme.bg.elevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border.subtle,
  },
  changePhoto: { color: theme.accent.warm, fontSize: 13, fontWeight: '500' },
  field: { paddingHorizontal: 16, marginBottom: 16 },
  label: { color: theme.text.primary, fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: {
    backgroundColor: theme.bg.card,
    borderRadius: 10,
    padding: 12,
    color: theme.text.primary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: theme.border.subtle,
  },
  textarea: { height: 110 },
  error: { color: '#e0706a', fontSize: 13, paddingHorizontal: 16, marginTop: 8 },
});
