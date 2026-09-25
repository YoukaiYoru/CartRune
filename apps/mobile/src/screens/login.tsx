import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/auth';
import { theme } from '@/theme';
import { ImmersiveBackdrop } from '@/components/immersive-backdrop';

export function Login() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Email and password are required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(email.trim(), password);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ImmersiveBackdrop />
      <View style={styles.brand}>
        <Text style={styles.logo}>📚</Text>
        <Text style={styles.title}>CartRune</Text>
        <Text style={styles.subtitle}>Your physical game shelf, organized.</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>EMAIL</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={theme.text.muted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
        />

        <Text style={styles.label}>PASSWORD</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          placeholderTextColor={theme.text.muted}
          secureTextEntry
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
          accessibilityRole="button"
        >
          {loading ? (
            <ActivityIndicator color={theme.bg.deep} />
          ) : (
            <Text style={styles.buttonText}>SIGN IN</Text>
          )}
        </Pressable>

        <Pressable
          style={styles.linkWrap}
          onPress={() => router.push('/register')}
          accessibilityRole="button"
        >
          <Text style={styles.linkMuted}>New here? </Text>
          <Text style={styles.linkAccent}>Create an account</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bg.deep,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  brand: { alignItems: 'center', marginBottom: 40, zIndex: 1 },
  logo: { fontSize: 48, marginBottom: 8 },
  title: { color: theme.text.primary, fontSize: 32, fontWeight: '800', letterSpacing: 1 },
  subtitle: { color: theme.text.muted, fontSize: 14, marginTop: 6 },
  form: { width: '100%' },
  label: { color: theme.text.secondary, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  input: {
    backgroundColor: theme.bg.input,
    borderWidth: 1,
    borderColor: theme.border.subtle,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: theme.text.primary,
    fontSize: 15,
    marginBottom: 18,
  },
  error: { color: '#e0706a', fontSize: 13, marginBottom: 12 },
  button: {
    backgroundColor: theme.accent.primary,
    borderRadius: theme.radius.sm,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: theme.bg.deep, fontSize: 15, fontWeight: '800', letterSpacing: 1 },
  linkWrap: { flexDirection: 'row', justifyContent: 'center', marginTop: 20, zIndex: 1 },
  linkMuted: { color: theme.text.muted, fontSize: 14 },
  linkAccent: { color: theme.accent.warm, fontSize: 14, fontWeight: '600' },
});
