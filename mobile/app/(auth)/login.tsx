import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView,
  Platform, ActivityIndicator, Alert,
} from 'react-native';
import { Link } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) Alert.alert('Login failed', error.message);
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>Card Advisor</Text>
      <Text style={styles.subtitle}>Sign in to your account</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholderTextColor="#9ca3af"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholderTextColor="#9ca3af"
      />

      <Pressable style={styles.button} onPress={handleLogin} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Sign In</Text>
        )}
      </Pressable>

      <Link href="/(auth)/signup" style={styles.link}>
        Don't have an account? Sign up
      </Link>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#f8fafc' },
  title: { fontSize: 32, fontWeight: '800', color: '#1e293b', marginBottom: 4 },
  subtitle: { fontSize: 16, color: '#64748b', marginBottom: 32 },
  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0',
    borderRadius: 12, padding: 16, fontSize: 16, color: '#1e293b', marginBottom: 12,
  },
  button: {
    backgroundColor: '#6366f1', borderRadius: 12, padding: 16,
    alignItems: 'center', marginTop: 8,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  link: { textAlign: 'center', marginTop: 24, color: '#6366f1', fontSize: 15 },
});
