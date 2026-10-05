import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuthStore } from '@/store/auth';
import { safeAuthMessage } from '@/lib/auth-validation';
import { theme } from '@/theme';

export function ResetPassword() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const confirmPasswordReset = useAuthStore((state) => state.confirmPasswordReset);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!token) { setError('This reset link is invalid.'); return; }
    setLoading(true); setError('');
    try { await confirmPasswordReset(token, password, confirm); setDone(true); }
    catch (e: unknown) { setError(safeAuthMessage(e, 'The link is invalid or expired.')); }
    finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.form}>
        <Text style={styles.title}>Choose a new password</Text>
        {done ? <><Text style={styles.success}>Your password was updated. You can sign in now.</Text><Pressable style={styles.button} onPress={() => router.replace('/login')}><Text style={styles.buttonText}>SIGN IN</Text></Pressable></> : <>
          <Text style={styles.label}>NEW PASSWORD</Text>
          <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" maxLength={128} />
          <Text style={styles.label}>CONFIRM PASSWORD</Text>
          <TextInput style={styles.input} value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" textContentType="newPassword" maxLength={128} onSubmitEditing={submit} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable style={[styles.button, loading && styles.disabled]} onPress={submit} disabled={loading}>{loading ? <ActivityIndicator color={theme.bg.deep} /> : <Text style={styles.buttonText}>UPDATE PASSWORD</Text>}</Pressable>
        </>}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg.deep, justifyContent: 'center', padding: 24 },
  form: { width: '100%' },
  title: { color: theme.text.primary, fontSize: 26, fontWeight: '800', marginBottom: 24 },
  label: { color: theme.text.secondary, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  input: { backgroundColor: theme.bg.input, borderWidth: 1, borderColor: theme.border.subtle, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: theme.text.primary, fontSize: 15, marginBottom: 16 },
  error: { color: '#e0706a', fontSize: 13, marginBottom: 12 },
  success: { color: theme.accent.primary, fontSize: 15, lineHeight: 22, marginBottom: 22 },
  button: { backgroundColor: theme.accent.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  disabled: { opacity: 0.6 },
  buttonText: { color: theme.bg.deep, fontSize: 15, fontWeight: '800', letterSpacing: 1 },
});
