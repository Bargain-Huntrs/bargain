// Boot router — decides the first real screen once auth state is known:
//   never launched → /onboarding (first-launch slides → login)
//   signed out     → /login     (guest browse offered from there)
//   signed in      → /(tabs)
// The native splash covers this; the brand mark below is the fallback while
// the redirect resolves.

import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import { ONBOARD_KEY } from '../services/auth';
import { BrandMark } from '../components/ui';
import { colors } from '../theme/colors';

export default function Boot() {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'restoring') return;
    let cancelled = false;
    (async () => {
      const seen = await AsyncStorage.getItem(ONBOARD_KEY).catch(() => null);
      if (cancelled) return;
      if (!seen) router.replace('/onboarding');
      else if (status === 'authed') router.replace('/(tabs)');
      else router.replace('/login');
    })();
    return () => {
      cancelled = true;
    };
  }, [status, router]);

  return (
    <View style={styles.root}>
      <BrandMark size={72} />
      <Text style={styles.word}>BargainHuntrs</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  word: { color: colors.text, fontSize: 22, fontWeight: '800', marginTop: 14 },
});
