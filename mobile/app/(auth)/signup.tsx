import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView,
  Platform, ActivityIndicator, Alert,
} from 'react-native';
import { Link } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignup() {
    if (!email || !password) return;
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) Alert.alert('Sign up failed', error.message);
    else Alert.alert('Check your email', 'Confirm your account then sign in.');
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>Create Account</Text>
      <Text style={styles.subtitle}>Start finding your best card</Text>

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

      <Pressable style={styles.button} onPress={handleSignup} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Create Account</Text>
        )}
      </Pressable>

      <Link href="/(auth)/login" style={styles.link}>
        Already have an account? Sign in
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
