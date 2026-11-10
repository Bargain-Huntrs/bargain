// Deals feed — the public marketplace scan. GET /api/v1/arbitrage/deals/public
// (no auth — the same feed bargainhuntrs.com's homepage renders). Retailer
// chips come from /deals/public-retailers; source chips map to the API's
// `source` param (online / in_store / nearby). Pull-to-refresh, honest empty
// and error states.

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { fetchDeals, fetchRetailers, type Deal } from '../../services/api';
import { DealCard } from '../../components/DealCard';
import { Btn, Empty, Screen } from '../../components/ui';
import { retailerLabel } from '../../lib/format';
import { colors } from '../../theme/colors';

const SOURCES = [
  { key: '', label: 'All' },
  { key: 'online', label: 'Online' },
  { key: 'in_store', label: 'In-store' },
  { key: 'nearby', label: 'Nearby' },
] as const;

export default function Feed() {
  const router = useRouter();
  const [retailer, setRetailer] = useState('');
  const [source, setSource] = useState('');
  const [retailers, setRetailers] = useState<{ retailer: string; deals: number }[]>([]);
  const [rows, setRows] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError('');
      try {
        setRows(
          await fetchDeals({
            retailer: retailer || undefined,
            source: source || undefined,
            limit: 40,
          }),
        );
      } catch (e: any) {
        setError(e?.message || 'Could not load deals.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [retailer, source],
  );

  useEffect(() => {
    load();
  }, [load]);

  // Retailer chips — top stores by live deal count (public endpoint).
  useEffect(() => {
    fetchRetailers()
      .then((rs) => setRetailers(rs.slice(0, 10)))
      .catch(() => {});
  }, []);

  const header = (
    <View>
      <View style={styles.headerRow}>
        <Text style={styles.wordmark}>BargainHuntrs</Text>
        <Text style={styles.headerSub}>Live deals — all 20%+ off</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {SOURCES.map((s) => {
          const on = source === s.key;
          return (
            <Pressable key={s.key} onPress={() => setSource(s.key)} style={[styles.chip, on && styles.chipOn]}>
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{s.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.chips, { paddingTop: 0 }]}
      >
        <Pressable onPress={() => setRetailer('')} style={[styles.chip, retailer === '' && styles.chipOn]}>
          <Text style={[styles.chipText, retailer === '' && styles.chipTextOn]}>All stores</Text>
        </Pressable>
        {retailers.map((r) => {
          const on = retailer === r.retailer;
          return (
            <Pressable
              key={r.retailer}
              onPress={() => setRetailer(on ? '' : r.retailer)}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>
                {retailerLabel(r.retailer)} · {r.deals}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  if (loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brandLight} />
        </View>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        {header}
        <View style={styles.center}>
          <Text style={styles.errText}>{error}</Text>
          <Btn title="Retry" onPress={() => load()} small />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        data={rows}
        keyExtractor={(d) => d.id}
        renderItem={({ item }) => (
          <DealCard deal={item} onPress={() => router.push(`/deal/${item.id}`)} />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <Empty
            title="No deals in this slice right now"
            sub="The scanner adds deals around the clock — pull to refresh, or widen the filters."
          />
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={colors.brandLight}
            colors={[colors.brandLight]}
            progressBackgroundColor={colors.card}
          />
        }
        contentContainerStyle={{ paddingBottom: 24, flexGrow: 1 }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  wordmark: { color: colors.text, fontSize: 22, fontWeight: '800' },
  headerSub: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  chips: { paddingHorizontal: 16, gap: 8, paddingBottom: 12, paddingTop: 2 },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.brandTint, borderColor: 'rgba(52,211,153,0.5)' },
  chipText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  chipTextOn: { color: colors.brandLight },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errText: { color: colors.muted, fontSize: 14, textAlign: 'center', marginBottom: 16 },
});
