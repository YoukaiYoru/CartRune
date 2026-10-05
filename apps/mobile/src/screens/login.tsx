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
import { loginSchema, safeAuthMessage } from '@/lib/auth-validation';
import { Ionicons } from '@expo/vector-icons';

export function Login() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || 'Enter a valid email and password');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(parsed.data.email, parsed.data.password);
    } catch (e: unknown) {
      setError(safeAuthMessage(e, 'Could not sign in. Check your credentials and try again.'));
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
        <Ionicons name="library-outline" size={48} color={theme.accent.primary} />
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
          autoComplete="email"
          textContentType="emailAddress"
          maxLength={254}
          spellCheck={false}
        />

        <Text style={styles.label}>PASSWORD</Text>
        <View style={styles.passwordWrap}>
          <TextInput
            style={styles.passwordInput}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={theme.text.muted}
            secureTextEntry={!showPassword}
            autoComplete="current-password"
            textContentType="password"
            maxLength={128}
          />
          <Pressable onPress={() => setShowPassword((value) => !value)} accessibilityRole="button" accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} style={styles.eyeButton}>
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={21} color={theme.text.muted} />
          </Pressable>
        </View>

        <Pressable style={styles.forgotLink} onPress={() => router.push('/forgot-password')} accessibilityRole="button">
          <Text style={styles.linkAccent}>Forgot password?</Text>
        </Pressable>

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
  passwordWrap: { position: 'relative', marginBottom: 4 },
  passwordInput: {
    backgroundColor: theme.bg.input,
    borderWidth: 1,
    borderColor: theme.border.subtle,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 14,
    paddingRight: 48,
    paddingVertical: 12,
    color: theme.text.primary,
    fontSize: 15,
    marginBottom: 14,
  },
  eyeButton: { position: 'absolute', right: 12, top: 0, bottom: 14, justifyContent: 'center', paddingHorizontal: 4 },
  forgotLink: { alignSelf: 'flex-end', marginBottom: 14 },
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
