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
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/auth';
import { theme } from '@/theme';
import { registerSchema, safeAuthMessage } from '@/lib/auth-validation';
import { Ionicons } from '@expo/vector-icons';

export function Register() {
  const router = useRouter();
  const register = useAuthStore((s) => s.register);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async () => {
    const parsed = registerSchema.safeParse({ username, email, password, confirm });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    setError('');
    try {
      await register(parsed.data.username, parsed.data.email, parsed.data.password);
    } catch (e: unknown) {
      setError(safeAuthMessage(e, 'Could not create the account. Try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Start building your physical game shelf.</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>USERNAME</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="player_one"
            placeholderTextColor={theme.text.muted}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={50}
            spellCheck={false}
          />

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
              autoComplete="new-password"
              textContentType="newPassword"
              maxLength={128}
              returnKeyType="next"
            />
            <Pressable onPress={() => setShowPassword((value) => !value)} accessibilityRole="button" accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} style={styles.eyeButton}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={21} color={theme.text.muted} />
            </Pressable>
          </View>

          <Text style={styles.label}>CONFIRM PASSWORD</Text>
          <View style={styles.passwordWrap}>
            <TextInput
              style={styles.passwordInput}
              value={confirm}
              onChangeText={setConfirm}
              placeholder="••••••••"
              placeholderTextColor={theme.text.muted}
              secureTextEntry={!showConfirm}
              autoComplete="new-password"
              textContentType="newPassword"
              maxLength={128}
              returnKeyType="done"
              onSubmitEditing={handleRegister}
            />
            <Pressable onPress={() => setShowConfirm((value) => !value)} accessibilityRole="button" accessibilityLabel={showConfirm ? 'Hide password confirmation' : 'Show password confirmation'} style={styles.eyeButton}>
              <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={21} color={theme.text.muted} />
            </Pressable>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
            accessibilityRole="button"
          >
            {loading ? (
              <ActivityIndicator color={theme.bg.deep} />
            ) : (
              <Text style={styles.buttonText}>CREATE ACCOUNT</Text>
            )}
          </Pressable>

          <Pressable
            style={styles.linkWrap}
            onPress={() => router.back()}
            accessibilityRole="button"
          >
            <Text style={styles.linkMuted}>Already have an account? </Text>
            <Text style={styles.linkAccent}>Sign in</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bg.deep,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  brand: { alignItems: 'center', marginBottom: 32 },
  title: { color: theme.text.primary, fontSize: 26, fontWeight: '800', letterSpacing: 0.5 },
  subtitle: { color: theme.text.muted, fontSize: 14, marginTop: 6 },
  form: { width: '100%' },
  label: { color: theme.text.secondary, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  input: {
    backgroundColor: theme.bg.input,
    borderWidth: 1,
    borderColor: theme.border.subtle,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: theme.text.primary,
    fontSize: 15,
    marginBottom: 16,
  },
  passwordWrap: { position: 'relative', marginBottom: 0 },
  passwordInput: {
    backgroundColor: theme.bg.input,
    borderWidth: 1,
    borderColor: theme.border.subtle,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingRight: 48,
    paddingVertical: 12,
    color: theme.text.primary,
    fontSize: 15,
    marginBottom: 16,
  },
  eyeButton: { position: 'absolute', right: 12, top: 0, bottom: 16, justifyContent: 'center', paddingHorizontal: 4 },
  error: { color: '#e0706a', fontSize: 13, marginBottom: 12 },
  button: {
    backgroundColor: theme.accent.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: theme.bg.deep, fontSize: 15, fontWeight: '800', letterSpacing: 1 },
  linkWrap: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  linkMuted: { color: theme.text.muted, fontSize: 14 },
  linkAccent: { color: theme.accent.warm, fontSize: 14, fontWeight: '600' },
});
