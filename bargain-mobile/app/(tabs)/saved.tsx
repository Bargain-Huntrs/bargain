// Saved — the price watchlist (bargain-api /api/v1/watchlist, auth required).
// Each row compares the live scraped price against your target — that IS the
// compare surface: current vs. target at a glance, "at target" when the deal
// is on. Free tier is limited to 10 items (server enforces — the error is
// surfaced verbatim).

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  addWatchlistItem,
  deleteWatchlistItem,
  listWatchlist,
  refreshWatchlistItem,
  type WatchlistItem,
} from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Btn, Empty, Field, Screen } from '../../components/ui';
import { hostOf, usd } from '../../lib/format';
import { colors } from '../../theme/colors';

export default function Saved() {
  const router = useRouter();
  const { status, freshToken } = useAuth();
  const [rows, setRows] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [target, setTarget] = useState('');
  const [addBusy, setAddBusy] = useState(false);
  const [addErr, setAddErr] = useState('');

  const load = useCallback(
    async (isRefresh = false) => {
      if (status !== 'authed') {
        setLoading(false);
        return;
      }
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError('');
      try {
        const t = await freshToken();
        if (!t) throw new Error('Session expired — sign in again.');
        setRows(await listWatchlist(t));
      } catch (e: any) {
        setError(e?.message || 'Could not load your watchlist.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [status, freshToken],
  );

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    if (addBusy) return;
    setAddErr('');
    if (!name.trim()) {
      setAddErr('Name the item (e.g. "RTX 5070").');
      return;
    }
    if (!/^https?:\/\/.+\..+/.test(url.trim())) {
      setAddErr('Paste the full retailer URL (https://…).');
      return;
    }
    const targetPrice = target.trim() ? Number(target.trim().replace(/[$,]/g, '')) : undefined;
    if (target.trim() && (!Number.isFinite(targetPrice) || (targetPrice as number) <= 0)) {
      setAddErr('Target price must be a number like 199.99');
      return;
    }
    setAddBusy(true);
    try {
      const t = await freshToken();
      if (!t) throw new Error('Session expired — sign in again.');
      await addWatchlistItem(t, {
        item_name: name.trim(),
        retailer_url: url.trim(),
        ...(targetPrice ? { target_price: targetPrice } : {}),
      });
      setName('');
      setUrl('');
      setTarget('');
      setShowAdd(false);
      await load(true);
    } catch (e: any) {
      setAddErr(e?.message || 'Could not add the item.');
    } finally {
      setAddBusy(false);
    }
  };

  const refreshOne = async (item: WatchlistItem) => {
    try {
      const t = await freshToken();
      if (!t) return;
      await refreshWatchlistItem(t, item.id);
      await load(true);
    } catch (e: any) {
      Alert.alert('Refresh failed', e?.message || 'Try again later.');
    }
  };

  const removeOne = (item: WatchlistItem) => {
    Alert.alert('Remove item?', `Stop tracking "${item.item_name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            const t = await freshToken();
            if (!t) return;
            await deleteWatchlistItem(t, item.id);
            setRows((r) => r.filter((x) => x.id !== item.id));
          } catch (e: any) {
            Alert.alert('Remove failed', e?.message || 'Try again later.');
          }
        },
      },
    ]);
  };

  // ---- guest ---------------------------------------------------------------
  if (status === 'guest') {
    return (
      <Screen>
        <View style={styles.center}>
          <Empty
            title="Your price watchlist"
            sub="Sign in to watch any product link — set a target price and BargainHuntrs tracks the live price against it."
            action={<Btn title="Sign in / Create account" small onPress={() => router.push('/login')} />}
          />
        </View>
      </Screen>
    );
  }

  const header = (
    <View>
      <View style={styles.headerRow}>
        <Text style={styles.wordmark}>Saved</Text>
        <Pressable onPress={() => setShowAdd((s) => !s)} hitSlop={8}>
          <Text style={styles.addToggle}>{showAdd ? 'Close' : '+ Track item'}</Text>
        </Pressable>
      </View>
      <Text style={styles.sub}>Current price vs. your target — compared at a glance.</Text>

      {showAdd && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.addCard}>
            <Field label="Item name" value={name} onChangeText={setName} placeholder="e.g. Dyson V15" maxLength={120} />
            <Field
              label="Retailer URL"
              value={url}
              onChangeText={setUrl}
              placeholder="https://www.walmart.com/ip/…"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <Field
              label="Target price (optional)"
              value={target}
              onChangeText={setTarget}
              placeholder="199.99"
              keyboardType="decimal-pad"
            />
            {addErr ? <Text style={styles.errText}>{addErr}</Text> : null}
            <Btn title="Start tracking" onPress={add} loading={addBusy} small />
          </View>
        </KeyboardAvoidingView>
      )}
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
        keyExtractor={(i) => i.id}
        ListHeaderComponent={header}
        renderItem={({ item }) => {
          const atTarget =
            item.target_price != null &&
            item.current_price != null &&
            item.current_price <= item.target_price;
          const link = item.retailers?.[0]?.url;
          return (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {item.item_name}
                </Text>
                {link ? (
                  <Pressable onPress={() => Linking.openURL(link).catch(() => {})} hitSlop={4}>
                    <Text style={styles.rowHost}>{hostOf(link)} ↗</Text>
                  </Pressable>
                ) : null}
                <View style={styles.rowPrices}>
                  <Text style={styles.rowCurrent}>
                    {item.current_price != null ? usd(item.current_price) : 'no price yet'}
                  </Text>
                  {item.target_price != null && (
                    <Text style={[styles.rowTarget, atTarget && styles.rowTargetHit]}>
                      target {usd(item.target_price)}
                      {atTarget ? ' — on!' : ''}
                    </Text>
                  )}
                </View>
              </View>
              <Pressable onPress={() => refreshOne(item)} hitSlop={10} style={styles.rowBtn}>
                <Ionicons name="refresh" size={17} color={colors.brandLight} />
              </Pressable>
              <Pressable onPress={() => removeOne(item)} hitSlop={10} style={styles.rowBtn}>
                <Ionicons name="trash-outline" size={17} color={colors.danger} />
              </Pressable>
            </View>
          );
        }}
        ListEmptyComponent={
          <Empty
            title="Nothing tracked yet"
            sub="Paste a retailer link above — BargainHuntrs scrapes the live price and compares it to your target. Free accounts track up to 10 items."
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  wordmark: { color: colors.text, fontSize: 22, fontWeight: '800' },
  addToggle: { color: colors.brandLight, fontSize: 14, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 12, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 14 },
  addCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  rowTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  rowHost: { color: colors.faint, fontSize: 11, marginTop: 2 },
  rowPrices: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 6 },
  rowCurrent: { color: colors.text, fontSize: 15, fontWeight: '800' },
  rowTarget: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  rowTargetHit: { color: colors.brandLight },
  rowBtn: { padding: 6 },
  errText: { color: colors.danger, fontSize: 13, marginBottom: 10 },
});
