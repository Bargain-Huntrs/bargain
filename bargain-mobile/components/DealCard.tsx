// Deal card — the feed row. Shows the same fields the site's deal cards do:
// image, retailer + tier, buy price vs. typical price, % off, and the
// estimated net profit from the scanner.

import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Deal } from '../services/api';
import { hapticTap } from '../services/haptics';
import { pctOff, retailerLabel, usd } from '../lib/format';
import { colors } from '../theme/colors';

export function DealCard({ deal, onPress }: { deal: Deal; onPress: () => void }) {
  const off = pctOff(deal.historical_avg, deal.buy_price);
  return (
    <Pressable
      onPress={() => {
        hapticTap();
        onPress();
      }}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.thumbWrap}>
        {deal.image_url ? (
          <Image source={{ uri: deal.image_url }} style={styles.thumb} resizeMode="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbFallback]}>
            <Ionicons name="pricetag-outline" size={26} color={colors.faint} />
          </View>
        )}
        {off !== null && (
          <View style={styles.offBadge}>
            <Text style={styles.offText}>-{off}%</Text>
          </View>
        )}
      </View>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {deal.title}
        </Text>
        <Text style={styles.retailer}>{retailerLabel(deal.retailer)}</Text>

        <View style={styles.priceRow}>
          <Text style={styles.price}>{usd(deal.buy_price)}</Text>
          {deal.historical_avg ? (
            <Text style={styles.was}>{usd(deal.historical_avg)}</Text>
          ) : null}
          {deal.net_profit != null && deal.net_profit > 0 ? (
            <Text style={styles.profit}>+{usd(deal.net_profit)}</Text>
          ) : null}
        </View>
      </View>

      <Ionicons name="chevron-forward" size={16} color={colors.faint} style={styles.chev} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    overflow: 'hidden',
    alignItems: 'center',
  },
  thumbWrap: { width: 92, height: 92 },
  thumb: { width: 92, height: 92, backgroundColor: colors.cardSoft },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  offBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: colors.brand,
    borderRadius: 7,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  offText: { color: colors.brandInk, fontSize: 11, fontWeight: '800' },
  body: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, gap: 4 },
  title: { color: colors.text, fontSize: 13.5, fontWeight: '600', lineHeight: 18 },
  retailer: { color: colors.faint, fontSize: 11, fontWeight: '600' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 2 },
  price: { color: colors.text, fontSize: 16, fontWeight: '800' },
  was: { color: colors.faint, fontSize: 12, textDecorationLine: 'line-through' },
  profit: { color: colors.brandLight, fontSize: 12, fontWeight: '800' },
  chev: { marginRight: 10 },
});
