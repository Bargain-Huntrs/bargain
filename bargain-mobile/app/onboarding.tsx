// First-launch onboarding — 3 brand slides explaining the deal feed, then a
// sign-up CTA. Sets the AsyncStorage flag so this runs once per install.
// Copy mirrors bargainhuntrs.com's hero + FAQ — no invented claims.

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { ONBOARD_KEY } from '../services/auth';
import { BrandMark, Btn, Screen } from '../components/ui';
import { colors } from '../theme/colors';

const SLIDES: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }[] = [
  {
    icon: 'flash-outline',
    title: 'Find it underpriced',
    body: 'BargainHuntrs scans 500+ retailers around the clock — price drops, clearance, and glitches — and verifies every discount is real before it hits your feed. All deals are 20%+ off.',
  },
  {
    icon: 'trending-up-outline',
    title: 'See the profit spread',
    body: 'Every deal shows the buy price, real resale value, platform fees, net profit and ROI — the math is done before you spend a dollar.',
  },
  {
    icon: 'bookmark-outline',
    title: 'Track any price',
    body: 'Watch any product link, set your target price, and compare current vs. target at a glance. Free accounts track up to 10 items — Hunter unlocks unlimited.',
  },
];

export default function Onboarding() {
  const router = useRouter();
  const [i, setI] = useState(0);
  const last = i === SLIDES.length - 1;

  const finish = async () => {
    await AsyncStorage.setItem(ONBOARD_KEY, '1').catch(() => {});
    router.replace('/login');
  };

  const slide = SLIDES[i];
  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.skipRow}>
        {!last && (
          <Pressable onPress={finish} hitSlop={12}>
            <Text style={styles.skip}>Skip</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.center}>
        <BrandMark size={76} />
        <View style={styles.iconWrap}>
          <Ionicons name={slide.icon} size={30} color={colors.brandLight} />
        </View>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.body}>{slide.body}</Text>
      </View>

      <View style={styles.dots}>
        {SLIDES.map((_, d) => (
          <View key={d} style={[styles.dot, d === i && styles.dotOn]} />
        ))}
      </View>

      <View style={styles.footer}>
        <Btn
          title={last ? 'Get started' : 'Next'}
          onPress={() => (last ? finish() : setI(i + 1))}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  skipRow: { height: 44, alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: 20 },
  skip: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  iconWrap: {
    marginTop: 26,
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 22,
  },
  body: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
    marginTop: 14,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 18 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.cardSoft },
  dotOn: { backgroundColor: colors.brandLight, width: 20 },
  footer: { paddingHorizontal: 20, paddingBottom: 12 },
});
