import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/auth';
import { passwordResetRequestSchema, safeAuthMessage } from '@/lib/auth-validation';
import { theme } from '@/theme';

export function ForgotPassword() {
  const router = useRouter();
  const requestPasswordReset = useAuthStore((state) => state.requestPasswordReset);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    const parsed = passwordResetRequestSchema.safeParse({ email });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message || 'Enter a valid email'); return; }
    setLoading(true); setError('');
    try { await requestPasswordReset(parsed.data.email); setSent(true); }
    catch (e: unknown) { setError(safeAuthMessage(e, 'Could not request a reset link. Try again.')); }
    finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.form}>
        <Text style={styles.title}>Reset password</Text>
        <Text style={styles.subtitle}>Enter your email and we will send a one-time reset link.</Text>
        {sent ? <Text style={styles.success}>If an account exists for that email, check your inbox.</Text> : null}
        <Text style={styles.label}>EMAIL</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={theme.text.muted} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" maxLength={254} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={[styles.button, loading && styles.disabled]} onPress={submit} disabled={loading} accessibilityRole="button">
          {loading ? <ActivityIndicator color={theme.bg.deep} /> : <Text style={styles.buttonText}>SEND RESET LINK</Text>}
        </Pressable>
        <Pressable style={styles.link} onPress={() => router.replace('/login')} accessibilityRole="button"><Text style={styles.linkText}>Back to sign in</Text></Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg.deep, justifyContent: 'center', padding: 24 },
  form: { width: '100%' },
  title: { color: theme.text.primary, fontSize: 28, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: theme.text.muted, fontSize: 14, lineHeight: 21, marginBottom: 28 },
  label: { color: theme.text.secondary, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  input: { backgroundColor: theme.bg.input, borderWidth: 1, borderColor: theme.border.subtle, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: theme.text.primary, fontSize: 15, marginBottom: 16 },
  success: { color: theme.accent.primary, fontSize: 14, lineHeight: 20, marginBottom: 18 },
  error: { color: '#e0706a', fontSize: 13, marginBottom: 12 },
  button: { backgroundColor: theme.accent.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  disabled: { opacity: 0.6 },
  buttonText: { color: theme.bg.deep, fontSize: 15, fontWeight: '800', letterSpacing: 1 },
  link: { alignItems: 'center', marginTop: 22 },
  linkText: { color: theme.accent.warm, fontSize: 14, fontWeight: '600' },
});
