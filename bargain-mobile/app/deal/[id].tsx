// Deal detail — GET /api/v1/arbitrage/deals/public/{id}. "Get this deal" runs
// the same click-out the site does: POST /api/v1/affiliate/click[/public]
// returns the tagged affiliate URL, then the OS browser opens it.

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { fetchDeal, trackClick, type Deal } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Btn, Chip, Screen } from '../../components/ui';
import { ago, pctOff, retailerLabel, usd } from '../../lib/format';
import { colors } from '../../theme/colors';

export default function DealDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { token, freshToken } = useAuth();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [clickBusy, setClickBusy] = useState(false);
  const [clickErr, setClickErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setDeal(await fetchDeal(String(id)));
    } catch (e: any) {
      setError(e?.message || 'Could not load this deal.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const openDeal = async () => {
    if (!deal || clickBusy) return;
    setClickBusy(true);
    setClickErr('');
    try {
      // Authed clicks get credited to the user; guests hit the public route.
      const t = token ? await freshToken() : null;
      const url = await trackClick(deal, t);
      if (!url) throw new Error('No deal link available.');
      await Linking.openURL(url);
    } catch (e: any) {
      // Fall back to the raw retailer link if tracking failed.
      if (deal.buy_url) {
        try {
          await Linking.openURL(deal.buy_url);
          return;
        } catch {
          /* fall through */
        }
      }
      setClickErr(e?.message || 'Could not open the deal link.');
    } finally {
      setClickBusy(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brandLight} />
        </View>
      </Screen>
    );
  }

  if (error || !deal) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.errText}>{error || 'Deal not found.'}</Text>
          <Btn title="Back to deals" onPress={() => router.back()} small />
        </View>
      </Screen>
    );
  }

  const off = pctOff(deal.historical_avg, deal.buy_price);
  const tier = (deal.deal_tier || '').replace(/_/g, ' ');
  const sourceLabel =
    deal.deal_source === 'in_store' ? 'In-store' : deal.deal_source === 'online' ? 'Online' : null;

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={styles.navRow}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
            <Text style={styles.backText}>Deals</Text>
          </Pressable>
          {deal.detected_at ? <Text style={styles.spotted}>spotted {ago(deal.detected_at)}</Text> : null}
        </View>

        {deal.image_url ? (
          <Image source={{ uri: deal.image_url }} style={styles.hero} resizeMode="contain" />
        ) : (
          <View style={[styles.hero, styles.heroFallback]}>
            <Ionicons name="pricetag-outline" size={48} color={colors.faint} />
          </View>
        )}

        <View style={styles.body}>
          <Text style={styles.title}>{deal.title}</Text>

          <View style={styles.chips}>
            <Chip label={retailerLabel(deal.retailer)} tone="brand" />
            {tier ? <Chip label={tier} /> : null}
            {sourceLabel ? <Chip label={sourceLabel} /> : null}
            {deal.niche ? <Chip label={deal.niche} /> : null}
          </View>

          {/* price block */}
          <View style={styles.priceCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.priceLabel}>Buy now</Text>
              <Text style={styles.price}>{usd(deal.buy_price)}</Text>
              {deal.historical_avg ? (
                <Text style={styles.was}>
                  typical {usd(deal.historical_avg)}
                  {off !== null ? `  ·  ${off}% off` : ''}
                </Text>
              ) : null}
            </View>
            {deal.net_profit != null && deal.net_profit > 0 && (
              <View style={styles.profitBox}>
                <Text style={styles.profitLabel}>Est. flip profit</Text>
                <Text style={styles.profitValue}>{usd(deal.net_profit)}</Text>
                {deal.roi != null && (
                  <Text style={styles.profitSub}>{Math.round(deal.roi * 100)}% ROI</Text>
                )}
              </View>
            )}
          </View>

          {/* flip math — same numbers the site's detail page shows */}
          {(deal.sell_price != null || deal.platform_fee != null || deal.total_costs != null) && (
            <View style={styles.mathCard}>
              {deal.sell_price != null && (
                <Row label="Resale value" value={usd(deal.sell_price)} />
              )}
              {deal.platform_fee != null && (
                <Row label="Platform fees" value={`−${usd(deal.platform_fee)}`} />
              )}
              {deal.total_costs != null && (
                <Row label="Total costs" value={`−${usd(deal.total_costs)}`} />
              )}
              {deal.bsr != null && (
                <Row label="Best-seller rank" value={`#${deal.bsr.toLocaleString()}`} />
              )}
            </View>
          )}

          {deal.best_coupon?.code && (
            <View style={styles.couponCard}>
              <Ionicons name="ticket-outline" size={18} color={colors.brandLight} />
              <View style={{ flex: 1 }}>
                <Text style={styles.couponTitle}>Coupon {deal.best_coupon.code}</Text>
                <Text style={styles.couponSub}>
                  {deal.best_coupon.savings
                    ? `Saves about ${usd(deal.best_coupon.savings)} at checkout`
                    : 'Auto-matched coupon for this deal'}
                </Text>
              </View>
            </View>
          )}

          {clickErr ? <Text style={styles.errText}>{clickErr}</Text> : null}
          <Btn
            title={deal.buy_url ? `Get this deal at ${retailerLabel(deal.retailer)}` : 'Deal link unavailable'}
            onPress={openDeal}
            loading={clickBusy}
            disabled={!deal.buy_url}
          />

          <Text style={styles.disclosure}>
            Deal links are affiliate links — BargainHuntrs may earn a commission
            at no cost to you. Prices change fast; verify on the retailer's site.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  backText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  spotted: { color: colors.faint, fontSize: 12 },
  hero: { width: '100%', height: 260, backgroundColor: '#fff' },
  heroFallback: { backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 20, paddingTop: 18 },
  title: { color: colors.text, fontSize: 19, fontWeight: '800', lineHeight: 25 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  priceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    marginTop: 18,
    gap: 12,
  },
  priceLabel: { color: colors.faint, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  price: { color: colors.text, fontSize: 28, fontWeight: '800', marginTop: 2 },
  was: { color: colors.muted, fontSize: 12, marginTop: 4 },
  profitBox: {
    backgroundColor: colors.brandTint,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'flex-end',
  },
  profitLabel: { color: colors.brandLight, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  profitValue: { color: colors.brandLight, fontSize: 20, fontWeight: '800', marginTop: 2 },
  profitSub: { color: colors.brandLight, fontSize: 11, fontWeight: '600', marginTop: 2 },
  mathCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    gap: 10,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { color: colors.muted, fontSize: 13 },
  rowValue: { color: colors.text, fontSize: 13, fontWeight: '700' },
  couponCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.brandTint,
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
  },
  couponTitle: { color: colors.brandLight, fontSize: 14, fontWeight: '800' },
  couponSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  errText: { color: colors.danger, fontSize: 13, textAlign: 'center', marginTop: 14 },
  disclosure: {
    color: colors.faint,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 18,
  },
});
