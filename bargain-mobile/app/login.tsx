// Sign in / create account — one screen, segmented mode toggle, hitting
// bargain-api's real routes:
//   sign in → POST /api/v1/auth/login    {email, password}
//   sign up → POST /api/v1/auth/register {email, password, firstName,
//              lastName, phoneNumber}   (phone must be E.164 — the API
//              enforces ^\+[1-9]\d{6,14}$ and a strong password)
//   forgot  → POST /api/v1/auth/forgot-password {email}
// Guest browse is offered — the deals feed is public (app review can see it
// without an account).

import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { BrandMark, Btn, Field, Screen } from '../components/ui';
import { colors } from '../theme/colors';

const E164 = /^\+[1-9]\d{6,14}$/;

/** "555 123 4567" → "+15551234567" (US default); keeps an explicit +. */
function toE164(raw: string): string {
  const t = raw.trim();
  if (t.startsWith('+')) return '+' + t.slice(1).replace(/\D/g, '');
  const digits = t.replace(/\D/g, '');
  if (digits.length === 10) return '+1' + digits;
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits;
  return '+' + digits;
}

export default function Login() {
  const router = useRouter();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (busy) return;
    setError('');
    const em = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) {
      setError('Enter a valid email address.');
      return;
    }
    if (mode === 'in') {
      if (!password) {
        setError('Enter your password.');
        return;
      }
    } else {
      // Mirror the API's RegisterRequest validators so errors are instant.
      if (!firstName.trim() || !lastName.trim()) {
        setError('First and last name are required.');
        return;
      }
      if (!E164.test(toE164(phone))) {
        setError('Enter a valid phone number (e.g. +1 555 123 4567).');
        return;
      }
      if (
        password.length < 8 ||
        !/[A-Z]/.test(password) ||
        !/[a-z]/.test(password) ||
        !/\d/.test(password)
      ) {
        setError('Password needs 8+ characters with upper, lower, and a number.');
        return;
      }
    }
    setBusy(true);
    try {
      if (mode === 'in') {
        await signIn(em, password);
      } else {
        await signUp({
          email: em,
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phoneNumber: toE164(phone),
        });
      }
      router.replace('/(tabs)');
    } catch (e: any) {
      setError(e?.message || 'Something went wrong — try again.');
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    const em = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) {
      setError('Enter your email first, then tap "Forgot password".');
      return;
    }
    try {
      await api('/api/v1/auth/forgot-password', { body: { email: em } });
      Alert.alert('Reset link sent', 'If an account exists for that email, a reset link is on the way.');
    } catch (e: any) {
      setError(e?.message || 'Could not send the reset email.');
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <BrandMark size={64} />
            <Text style={styles.word}>BargainHuntrs</Text>
            <Text style={styles.tag}>Find it. Flip it. Profit.</Text>
          </View>

          <View style={styles.toggle}>
            {(['in', 'up'] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() => {
                  setMode(m);
                  setError('');
                }}
                style={[styles.toggleBtn, mode === m && styles.toggleBtnOn]}
              >
                <Text style={[styles.toggleText, mode === m && styles.toggleTextOn]}>
                  {m === 'in' ? 'Sign in' : 'Create account'}
                </Text>
              </Pressable>
            ))}
          </View>

          {mode === 'up' && (
            <>
              <View style={styles.nameRow}>
                <View style={{ flex: 1 }}>
                  <Field label="First name" value={firstName} onChangeText={setFirstName} textContentType="givenName" />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Last name" value={lastName} onChangeText={setLastName} textContentType="familyName" />
                </View>
              </View>
              <Field
                label="Phone"
                value={phone}
                onChangeText={setPhone}
                placeholder="+1 555 123 4567"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                hint="Required by BargainHuntrs accounts — E.164 format."
              />
            </>
          )}

          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder={mode === 'up' ? '8+ chars, upper + lower + number' : 'Your password'}
            secureTextEntry
            textContentType={mode === 'up' ? 'newPassword' : 'password'}
          />

          {mode === 'in' && (
            <Pressable onPress={forgot} style={styles.forgot} hitSlop={8}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </Pressable>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Btn
            title={mode === 'in' ? 'Sign in' : 'Create account'}
            onPress={submit}
            loading={busy}
          />

          <Pressable onPress={() => router.replace('/(tabs)')} style={styles.guest} hitSlop={10}>
            <Text style={styles.guestText}>Browse live deals without an account</Text>
          </Pressable>

          <Text style={styles.legal}>
            By continuing you agree to the BargainHuntrs terms. Deal links are
            affiliate links — BargainHuntrs may earn a commission at no cost to you.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 24, paddingBottom: 24, flexGrow: 1, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 28, marginTop: 16 },
  word: { color: colors.text, fontSize: 26, fontWeight: '800', marginTop: 14 },
  tag: { color: colors.muted, fontSize: 14, marginTop: 4 },
  nameRow: { flexDirection: 'row', gap: 10 },
  toggle: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  toggleBtnOn: { backgroundColor: colors.brand },
  toggleText: { color: colors.muted, fontSize: 14, fontWeight: '700' },
  toggleTextOn: { color: colors.brandInk },
  forgot: { alignSelf: 'flex-end', marginTop: -6, marginBottom: 14 },
  forgotText: { color: colors.brandLight, fontSize: 13, fontWeight: '600' },
  error: { color: colors.danger, fontSize: 13, marginBottom: 12 },
  guest: { alignItems: 'center', marginTop: 20 },
  guestText: { color: colors.brandLight, fontSize: 14, fontWeight: '600' },
  legal: {
    color: colors.faint,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 28,
  },
});
